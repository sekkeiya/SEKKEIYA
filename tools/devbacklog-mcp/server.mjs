#!/usr/bin/env node
// ============================================================================
// SEKKEIYA dev-backlog MCP server  (admin-only, local, single-user)
//
// Claude Code から SEKKEIYA の「開発状況」画面を読み書きする MCP サーバー。
// スプリント方式（v2.2）: 要求定義 → 要件定義（1対多・requestId 任意）→ スプリントへ割当。
// アイデアという種別は無い（スプリント未アサインの要件＝バックログがその役割）。
// UI (DevStatusPanel.tsx) と同じ挙動を再現:
//   - 種別ごとの seq 自動採番（要求1 / 要件1 …）
//   - 要件は requestId（親要求・1対多・任意）と sprintId（null=バックログ）を持つ
//   - 期限は個別に持たず「所属スプリントの終了日」に一本化
//   - スプリントは自動採番・前回終了日の翌日から2週間を自動入力
//   - スプリントのライフサイクル: 現在（未アーカイブの最小番号）→ complete_sprint で
//     アーカイブ（未完了の要件はバックログへ返却・完了済みは履歴として残る）
//   - 要求の完了は子要件から導出 / 要求削除時は子要件の requestId を null に
//
// データ: Firestore /devBacklog（項目）+ /devSprints（スプリント）
// 認証: サービスアカウント鍵をパス参照のみで使用（中身は埋め込まない）。
//   既定 = sekkeiya/serviceAccountKey.json（.gitignore 済 / project: shapeshare3d）
//   上書き = 環境変数 GOOGLE_APPLICATION_CREDENTIALS
//
// 動作確認:  node server.mjs --smoke     （MCP を介さず両コレクションを読む）
// ============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Firestore 初期化 ───────────────────────────────────────────────
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || path.resolve(__dirname, '../../serviceAccountKey.json'); // sekkeiya/serviceAccountKey.json
if (!fs.existsSync(keyPath)) {
  console.error(`[devbacklog-mcp] service account key not found at: ${keyPath}\n` +
    `Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json at sekkeiya/.`);
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount), storageBucket: 'shapeshare3d.firebasestorage.app' });
const db = getFirestore();
const items = () => db.collection('devBacklog');
const sprintsCol = () => db.collection('devSprints');

// 接続状態の可視化: コネクタ画面（管理者向け「Claude Code」カード）が読むハートビート。
// サーバー稼働中は60秒ごとに lastSeenAt を更新 → UI 側は「3分以内なら接続中」と表示する。
const touchHeartbeat = () => db.collection('devMeta').doc('claudeMcp')
  .set({ lastSeenAt: FieldValue.serverTimestamp(), version: '2.5.0' }, { merge: true })
  .catch(() => { /* ハートビートは失敗しても本処理に影響させない */ });

// ── ヘルパー（UI と同じ規約） ─────────────────────────────────────
const KEY_PREFIX = { request: '要求', requirement: '要件' };
const keyOf = (it) => it ? `${KEY_PREFIX[it.type] ?? '?'}${it.seq ?? '?'}` : '?';
// 要件の状態（4択）。旧データ（status 無し）は done/progress から推定。
const STATUSES = ['todo', 'doing', 'testing', 'done'];
const statusOf = (r) => r.status ?? (r.done ? 'done' : ((r.progress || 0) > 0 ? 'doing' : 'todo'));
const isDone = (r) => statusOf(r) === 'done';
// カテゴリ（機能単位。子アプリ scope + 横断カテゴリ）。UI の CATEGORIES と一致。
const CATEGORIES = [
  'general', 'chat', 'drive', 'ai', 'web', 'billing',
  '3dss', '3dsl', '3dsp', '3dsc', '3dsd', '3dsr', '3dsi', '3dsq', '3dsf', '3dsk', '3dsb', '3dsm', '3dsmt',
];
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function loadItems() {
  const snap = await items().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function loadSprints() {
  const snap = await sprintsCol().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.seq || 0) - (b.seq || 0));
}
const nextSeq = (all, type) =>
  Math.max(0, ...all.filter((i) => i.type === type).map((i) => i.seq || 0)) + 1;

const ok = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = (msg) => ({ content: [{ type: 'text', text: `ERROR: ${msg}` }], isError: true });
async function getItem(id) {
  const d = await items().doc(id).get();
  if (!d.exists) throw new Error(`item not found: ${id}`);
  return { id: d.id, ...d.data() };
}
async function getSprint(id) {
  const d = await sprintsCol().doc(id).get();
  if (!d.exists) throw new Error(`sprint not found: ${id}`);
  return { id: d.id, ...d.data() };
}

// ── Research & Memo（アカウントサイトのノードグラフ）─────────────────
// 保存先: users/{uid}/research/{boardId}（boardId 既定 'canvas'＝メインボード）。
// 1ボード=1ドキュメントに { title, items[], edges[] }。UIの researchBoardBridge と同じ挙動を再現。
const RESEARCH_ACCOUNT_EMAIL = 'hello@sekkeiya.com'; // 対象アカウント（管理者/SEKKEIYA公式）
const RESEARCH_DEFAULT_BOARD = 'canvas';
let _researchUid = null;
async function researchUid() {
  if (_researchUid) return _researchUid;
  const user = await getAuth().getUserByEmail(RESEARCH_ACCOUNT_EMAIL);
  _researchUid = user.uid;
  return _researchUid;
}
async function researchCol() {
  const uid = await researchUid();
  return db.collection('users').doc(uid).collection('research');
}
async function researchDocRef(boardId) {
  return (await researchCol()).doc(boardId || RESEARCH_DEFAULT_BOARD);
}
const rNewId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// 自動配置（UIと同一）: 既存の右側に 縦3枚×列 の格子で並べる。空ボードは原点から。
const R_COL_W = 300, R_ROW_H = 180, R_ROWS = 3, R_GAP_X = 80;
function autoPositions(existing, count) {
  let ox = 0, oy = 0;
  if (existing.length > 0) {
    ox = Math.max(...existing.map((i) => i.x)) + R_COL_W + R_GAP_X;
    oy = Math.min(...existing.map((i) => i.y));
  }
  return Array.from({ length: count }, (_, i) => ({
    x: ox + Math.floor(i / R_ROWS) * R_COL_W,
    y: oy + (i % R_ROWS) * R_ROW_H,
  }));
}
async function loadBoard(boardId) {
  const snap = await (await researchDocRef(boardId)).get();
  if (!snap.exists) return { items: [], edges: [], title: null };
  const d = snap.data();
  return { items: Array.isArray(d.items) ? d.items : [], edges: Array.isArray(d.edges) ? d.edges : [], title: d.title || null };
}
async function saveBoard(boardId, data) {
  const payload = { updatedAt: FieldValue.serverTimestamp() };
  if (data.items) payload.items = data.items.map(compact);
  if (data.edges) payload.edges = data.edges.map(compact);
  if (data.title !== undefined) payload.title = data.title;
  await (await researchDocRef(boardId)).set(payload, { merge: true });
}
const noteSummary = (n) => compact({ id: n.id, kind: n.kind, text: n.text, color: n.color, role: n.role, url: n.url, refTitle: n.refTitle });
const edgeSummary = (e) => compact({ id: e.id, source: e.source, target: e.target, relation: e.relation, label: e.label });

/** ボード全体のスナップショット（Claude が読みやすい形） */
async function boardSnapshot() {
  const [all, sprints] = await Promise.all([loadItems(), loadSprints()]);
  const today = jstToday();
  const reqSummary = (r) => ({
    key: keyOf(r), id: r.id, title: r.title,
    status: statusOf(r), done: isDone(r), category: r.category || null,
    request: r.requestId ? keyOf(all.find((x) => x.id === r.requestId)) : null,
  });
  const requirements = all.filter((i) => i.type === 'requirement');
  // 現在＝未アーカイブの最小番号（UI と同じ規約）
  const currentId = sprints.find((s) => !s.archived)?.id ?? null;
  return {
    today,
    sprints: sprints.map((s) => ({
      key: `Sprint ${s.seq}`, id: s.id, startDate: s.startDate, endDate: s.endDate,
      status: s.archived ? 'archived' : s.id === currentId ? 'current' : 'upcoming',
      overdue: !s.archived && s.endDate < today,
      requirements: requirements.filter((r) => r.sprintId === s.id).map(reqSummary),
    })),
    backlog: requirements.filter((r) => !r.sprintId).map(reqSummary), // スプリント未アサインの要件
    requests: all.filter((i) => i.type === 'request')
      .sort((a, b) => (a.seq || 0) - (b.seq || 0))
      .map((rq) => {
        const children = requirements.filter((r) => r.requestId === rq.id);
        return {
          key: keyOf(rq), id: rq.id, title: rq.title,
          done: children.length > 0 && children.every(isDone), // 要件から導出
          requirements: children.map((c) => keyOf(c)),
        };
      }),
  };
}

// ── MCP サーバー定義 ──────────────────────────────────────────────
const server = new McpServer({ name: 'sekkeiya-devbacklog', version: '2.5.0' });

server.registerTool('list_backlog', {
  title: '開発ボードを一覧',
  description: 'スプリント（所属要件つき）・バックログ（スプリント未アサインの要件）・要求定義（子要件つき、完了は導出）をまとめて返す。',
  inputSchema: {},
}, async () => ok(await boardSnapshot()));

server.registerTool('add_item', {
  title: '項目を追加',
  description: '要求(request) / 要件(requirement) を追加。要件は requestId（親要求・任意・1対多）・sprintId（省略時はバックログ）・status（未指定は todo）・category を指定できる。期限は持たない（スプリント終了日に一本化）。思い付きレベルのものは要求として追加する。',
  inputSchema: {
    type: z.enum(['request', 'requirement']),
    title: z.string().min(1),
    requestId: z.string().optional(),
    sprintId: z.string().optional(),
    status: z.enum(['todo', 'doing', 'testing', 'done']).optional(),
    category: z.string().optional(), // CATEGORIES の id（例: 3dss, chat, drive, general …）
  },
}, async ({ type, title, requestId, sprintId, status, category }) => {
  if ((requestId || sprintId || status || category) && type !== 'requirement') {
    return fail('requestId / sprintId / status / category は要件(requirement)にのみ指定できます');
  }
  if (requestId) {
    const parent = await getItem(requestId);
    if (parent.type !== 'request') return fail(`${requestId} is not a request`);
  }
  if (sprintId) {
    const sprint = await getSprint(sprintId);
    if (sprint.archived) return fail(`Sprint ${sprint.seq} はアーカイブ済みのため割当できません`);
  }
  if (category && !CATEGORIES.includes(category)) {
    return fail(`未知のカテゴリ: ${category}（有効: ${CATEGORIES.join(', ')}）`);
  }
  const st = status || 'todo';
  const all = await loadItems();
  const seq = nextSeq(all, type);
  const ref = await items().add({
    type, seq, title: title.trim(),
    ...(type === 'requirement'
      ? { status: st, done: st === 'done', category: category || null, requestId: requestId || null, sprintId: sprintId || null }
      : {}),
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ok({ added: { key: `${KEY_PREFIX[type]}${seq}`, id: ref.id, type, title: title.trim() } });
});

server.registerTool('update_item', {
  title: '項目を更新',
  description: 'タイトル・状態・カテゴリを更新（状態/カテゴリは要件向け）。status を done にすると done フラグも同期する（UI と同じ）。',
  inputSchema: {
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    status: z.enum(['todo', 'doing', 'testing', 'done']).optional(),
    category: z.string().nullable().optional(), // null でカテゴリ解除
  },
}, async ({ id, title, status, category }) => {
  await getItem(id); // 存在確認
  if (category && !CATEGORIES.includes(category)) {
    return fail(`未知のカテゴリ: ${category}（有効: ${CATEGORIES.join(', ')}）`);
  }
  const data = { updatedAt: FieldValue.serverTimestamp() };
  if (title !== undefined) data.title = title.trim();
  if (status !== undefined) { data.status = status; data.done = status === 'done'; }
  if (category !== undefined) data.category = category; // null 可
  await items().doc(id).update(data);
  const it = await getItem(id);
  return ok({ updated: { key: keyOf(it), id, title: it.title, status: statusOf(it), category: it.category || null } });
});

server.registerTool('set_request', {
  title: '要件の親要求を設定',
  description: '要件(requirement)の親要求(requestId)を付け替える（1対多）。requestId を null にすると「要求なし」になる。',
  inputSchema: { requirementId: z.string().min(1), requestId: z.string().nullable() },
}, async ({ requirementId, requestId }) => {
  const rq = await getItem(requirementId);
  if (rq.type !== 'requirement') return fail(`${requirementId} is not a requirement`);
  if (requestId) {
    const parent = await getItem(requestId);
    if (parent.type !== 'request') return fail(`${requestId} is not a request`);
  }
  await items().doc(requirementId).update({ requestId: requestId || null, updatedAt: FieldValue.serverTimestamp() });
  return ok({ set: { requirement: keyOf(rq), requestId: requestId || null } });
});

server.registerTool('assign_sprint', {
  title: '要件をスプリントへ割当',
  description: '要件(requirement)を指定スプリントへ移す。sprintId を null にするとバックログに戻す。',
  inputSchema: { requirementId: z.string().min(1), sprintId: z.string().nullable() },
}, async ({ requirementId, sprintId }) => {
  const rq = await getItem(requirementId);
  if (rq.type !== 'requirement') return fail(`${requirementId} is not a requirement`);
  const sprint = sprintId ? await getSprint(sprintId) : null;
  if (sprint?.archived) return fail(`Sprint ${sprint.seq} はアーカイブ済みのため割当できません`);
  await items().doc(requirementId).update({ sprintId: sprintId || null, updatedAt: FieldValue.serverTimestamp() });
  return ok({ assigned: { requirement: keyOf(rq), sprint: sprint ? `Sprint ${sprint.seq}` : 'バックログ' } });
});

server.registerTool('create_sprint', {
  title: 'スプリントを作成',
  description: 'スプリントを作成（自動採番）。日付を省略すると前回終了日の翌日から2週間（初回は今日から）が自動入力される。',
  inputSchema: {
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
}, async ({ startDate, endDate }) => {
  const sprints = await loadSprints();
  const last = sprints[sprints.length - 1];
  const start = startDate || (last ? addDays(last.endDate, 1) : jstToday());
  const end = endDate || addDays(start, 13);
  if (end < start) return fail(`endDate (${end}) が startDate (${start}) より前です`);
  const seq = (last?.seq || 0) + 1;
  const ref = await sprintsCol().add({
    seq, startDate: start, endDate: end, archived: false,
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ok({ created: { key: `Sprint ${seq}`, id: ref.id, startDate: start, endDate: end } });
});

server.registerTool('complete_sprint', {
  title: 'スプリントを完了（アーカイブ）',
  description: 'スプリントを完了してアーカイブする。未完了の要件はバックログへ返却し、完了済みの要件は履歴としてスプリントに残る（UI の「完了」と同じ）。',
  inputSchema: { sprintId: z.string().min(1) },
}, async ({ sprintId }) => {
  const s = await getSprint(sprintId);
  if (s.archived) return fail(`Sprint ${s.seq} は既にアーカイブ済みです`);
  const all = await loadItems();
  const inSprint = all.filter((r) => r.type === 'requirement' && r.sprintId === sprintId);
  const unfinished = inSprint.filter((r) => !isDone(r));
  await Promise.all(unfinished.map((r) =>
    items().doc(r.id).update({ sprintId: null, updatedAt: FieldValue.serverTimestamp() })));
  await sprintsCol().doc(sprintId).update({
    archived: true, archivedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ok({
    completed: {
      key: `Sprint ${s.seq}`,
      doneRequirements: inSprint.filter(isDone).map(keyOf),
      returnedToBacklog: unfinished.map(keyOf),
    },
  });
});

server.registerTool('reopen_sprint', {
  title: 'スプリントのアーカイブを解除',
  description: 'アーカイブ済みのスプリントを未アーカイブに戻す（UI の履歴「戻す」と同じ）。番号が最小なら現在のスプリントに復帰する。',
  inputSchema: { sprintId: z.string().min(1) },
}, async ({ sprintId }) => {
  const s = await getSprint(sprintId);
  if (!s.archived) return fail(`Sprint ${s.seq} はアーカイブされていません`);
  await sprintsCol().doc(sprintId).update({ archived: false, updatedAt: FieldValue.serverTimestamp() });
  return ok({ reopened: { key: `Sprint ${s.seq}` } });
});

server.registerTool('update_sprint', {
  title: 'スプリントの期間を変更',
  description: 'スプリントの startDate / endDate を変更する。',
  inputSchema: {
    sprintId: z.string().min(1),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  },
}, async ({ sprintId, startDate, endDate }) => {
  const s = await getSprint(sprintId);
  const start = startDate || s.startDate;
  const end = endDate || s.endDate;
  if (end < start) return fail(`endDate (${end}) が startDate (${start}) より前です`);
  await sprintsCol().doc(sprintId).update({ startDate: start, endDate: end, updatedAt: FieldValue.serverTimestamp() });
  return ok({ updated: { key: `Sprint ${s.seq}`, startDate: start, endDate: end } });
});

server.registerTool('delete_sprint', {
  title: 'スプリントを削除',
  description: 'スプリントを削除する。所属していた要件はバックログに戻る（UI と同じ）。',
  inputSchema: { sprintId: z.string().min(1) },
}, async ({ sprintId }) => {
  const s = await getSprint(sprintId);
  const all = await loadItems();
  const inSprint = all.filter((r) => r.type === 'requirement' && r.sprintId === sprintId);
  await Promise.all(inSprint.map((r) =>
    items().doc(r.id).update({ sprintId: null, updatedAt: FieldValue.serverTimestamp() })));
  await sprintsCol().doc(sprintId).delete();
  return ok({ deleted: { key: `Sprint ${s.seq}`, unassignedRequirements: inSprint.map(keyOf) } });
});

server.registerTool('delete_item', {
  title: '項目を削除',
  description: '項目を削除する。要求(request)を消す場合は、切り出し済みの子要件の requestId を null にして残す（UI と同じ）。',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => {
  const it = await getItem(id);
  if (it.type === 'request') {
    const all = await loadItems();
    const children = all.filter((r) => r.type === 'requirement' && r.requestId === id);
    await Promise.all(children.map((r) =>
      items().doc(r.id).update({ requestId: null, updatedAt: FieldValue.serverTimestamp() })));
  }
  await items().doc(id).delete();
  return ok({ deleted: { id, key: keyOf(it), title: it.title } });
});

// ── Research & Memo ツール ────────────────────────────────────────
server.registerTool('research_list_boards', {
  title: 'Research & Memo のボード一覧',
  description: `${RESEARCH_ACCOUNT_EMAIL} のアカウントサイト Research & Memo のボード一覧（メインボード＋追加ボード）を、ノード数・エッジ数つきで返す。`,
  inputSchema: {},
}, async () => {
  const snap = await (await researchCol()).get();
  const metas = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      title: (typeof x.title === 'string' && x.title.trim()) ? x.title : (d.id === RESEARCH_DEFAULT_BOARD ? 'メインボード' : '無題のボード'),
      notes: Array.isArray(x.items) ? x.items.length : 0,
      edges: Array.isArray(x.edges) ? x.edges.length : 0,
    };
  });
  if (!metas.some((m) => m.id === RESEARCH_DEFAULT_BOARD)) {
    metas.unshift({ id: RESEARCH_DEFAULT_BOARD, title: 'メインボード', notes: 0, edges: 0 });
  }
  return ok({ account: RESEARCH_ACCOUNT_EMAIL, boards: metas });
});

server.registerTool('research_get_board', {
  title: 'ボードの中身を取得',
  description: '指定ボードのノード（メモ等）とエッジ（接続）を返す。boardId 省略時はメインボード(canvas)。ノードの id はエッジ作成・更新・削除で使う。',
  inputSchema: { boardId: z.string().optional() },
}, async ({ boardId }) => {
  const { items, edges, title } = await loadBoard(boardId);
  return ok({
    boardId: boardId || RESEARCH_DEFAULT_BOARD,
    title: title || (boardId && boardId !== RESEARCH_DEFAULT_BOARD ? '無題のボード' : 'メインボード'),
    notes: items.map(noteSummary),
    edges: edges.map(edgeSummary),
  });
});

server.registerTool('research_add_notes', {
  title: 'メモ（ノード）を追加',
  description: 'ボードにノードを追加する。座標は自動配置（UIの「整列」で綺麗に並ぶ）。role=論証上の役割（evidence根拠/interpretation解釈/conclusion結論）。追加後の id を返すので、続けて research_connect でつなげる。',
  inputSchema: {
    boardId: z.string().optional(),
    notes: z.array(z.object({
      text: z.string().min(1),
      kind: z.enum(['note', 'link', 'quote', 'source']).optional(), // 既定 note
      color: z.enum(['yellow', 'blue', 'pink', 'green']).optional(),
      role: z.enum(['evidence', 'interpretation', 'conclusion']).optional(),
      url: z.string().optional(), // link/source の遷移先
    })).min(1),
  },
}, async ({ boardId, notes }) => {
  const { items } = await loadBoard(boardId);
  const pos = autoPositions(items, notes.length);
  const now = new Date().toISOString();
  const created = notes.map((n, i) => compact({
    id: rNewId(), kind: n.kind || 'note', x: pos[i].x, y: pos[i].y,
    text: n.text, color: n.color, role: n.role, url: n.url,
    createdAt: now, updatedAt: now,
  }));
  await saveBoard(boardId, { items: [...items, ...created] });
  return ok({ added: created.map((c) => ({ id: c.id, kind: c.kind, text: c.text })) });
});

server.registerTool('research_connect', {
  title: 'ノード間をつなぐ（エッジ追加）',
  description: 'ノード間に型付きエッジを張る。source(根拠側)→target(結論側)。relation は supports/contradicts/applies/derives 等（カスタム文字列可）。label は一行の理由。存在しないノード・自己ループ・同関係の重複はスキップして理由を返す。',
  inputSchema: {
    boardId: z.string().optional(),
    edges: z.array(z.object({
      source: z.string().min(1),
      target: z.string().min(1),
      relation: z.string().min(1),
      label: z.string().optional(),
    })).min(1),
  },
}, async ({ boardId, edges: inputEdges }) => {
  const { items, edges } = await loadBoard(boardId);
  const itemIds = new Set(items.map((i) => i.id));
  const relKey = (e) => `${e.source}->${e.target}:${e.relation}`;
  const existingRels = new Set(edges.map(relKey));
  const now = new Date().toISOString();
  const created = [], skipped = [];
  for (const p of inputEdges) {
    if (!itemIds.has(p.source)) { skipped.push(`source が見つかりません: ${p.source}`); continue; }
    if (!itemIds.has(p.target)) { skipped.push(`target が見つかりません: ${p.target}`); continue; }
    if (p.source === p.target) { skipped.push(`自己ループは張れません: ${p.source}`); continue; }
    if (existingRels.has(relKey(p))) { skipped.push(`同じ関係で既に接続済み: ${relKey(p)}`); continue; }
    existingRels.add(relKey(p));
    created.push(compact({ id: rNewId(), source: p.source, target: p.target, relation: p.relation, label: p.label, createdAt: now, updatedAt: now }));
  }
  if (created.length > 0) await saveBoard(boardId, { edges: [...edges, ...created] });
  return ok({ connected: created.map(edgeSummary), skipped });
});

server.registerTool('research_update_note', {
  title: 'メモ（ノード）を更新',
  description: 'ノードの本文・色・役割を更新する。id は research_get_board で取得したノードの id。',
  inputSchema: {
    boardId: z.string().optional(),
    id: z.string().min(1),
    text: z.string().min(1).optional(),
    color: z.enum(['yellow', 'blue', 'pink', 'green']).optional(),
    role: z.enum(['evidence', 'interpretation', 'conclusion']).optional(),
  },
}, async ({ boardId, id, text, color, role }) => {
  const { items } = await loadBoard(boardId);
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return fail(`ノードが見つかりません: ${id}`);
  items[idx] = compact({
    ...items[idx],
    ...(text !== undefined ? { text } : {}),
    ...(color !== undefined ? { color } : {}),
    ...(role !== undefined ? { role } : {}),
    updatedAt: new Date().toISOString(),
  });
  await saveBoard(boardId, { items });
  return ok({ updated: noteSummary(items[idx]) });
});

server.registerTool('research_remove', {
  title: 'メモ（ノード）を削除',
  description: 'ノードを削除する。削除ノードにぶら下がるエッジも一緒に掃除する（UIと同じ）。',
  inputSchema: { boardId: z.string().optional(), ids: z.array(z.string().min(1)).min(1) },
}, async ({ boardId, ids }) => {
  const { items, edges } = await loadBoard(boardId);
  const idSet = new Set(ids);
  const remain = items.filter((i) => !idSet.has(i.id));
  const removed = items.length - remain.length;
  const remainIds = new Set(remain.map((i) => i.id));
  const remainEdges = edges.filter((e) => remainIds.has(e.source) && remainIds.has(e.target));
  await saveBoard(boardId, { items: remain, edges: remainEdges });
  return ok({ removed, remainingNotes: remain.length });
});

server.registerTool('research_create_board', {
  title: 'ボードを新規作成',
  description: '新しいボードを作成して id を返す。別テーマを始めるときだけ使う（安易に増やさない）。以降の research_* は boardId を渡してこのボードを対象にできる。',
  inputSchema: { title: z.string().min(1) },
}, async ({ title }) => {
  const id = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  await (await researchDocRef(id)).set({
    title: title.trim(), items: [], edges: [],
    createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
  });
  return ok({ created: { id, title: title.trim() } });
});

server.registerTool('research_delete_board', {
  title: 'ボードを削除',
  description: 'ボードを削除する。メインボード(canvas)は削除不可（中身を空にするには research_remove を使う）。',
  inputSchema: { boardId: z.string().min(1) },
}, async ({ boardId }) => {
  if (boardId === RESEARCH_DEFAULT_BOARD) return fail('メインボードは削除できません（中身を空にするには research_remove を使ってください）');
  await (await researchDocRef(boardId)).delete();
  return ok({ deleted: { id: boardId } });
});

// ── 公式記事（officialArticles）ツール ─────────────────────────────
// Web (src/shared/api/blog/officialArticles.js) と同じ正規化・規約を再現する:
//   - slug 自動生成 / tagsLower / category={slug,name} / contentFormat:'html'
//   - publishedAt は「初めて公開状態になった時」のみ付与（以後の更新で変えない）
//   - author は公式アカウント（hello@sekkeiya.com / displayName 'SEKKEIYA'）
// カテゴリは Firestore /categories（ハブ+サブの2階層・slug 参照）。
const articlesCol = () => db.collection('officialArticles');
const categoriesCol = () => db.collection('categories');

const aStr = (v) => (typeof v === 'string' ? v.trim() : '');
const aSlug = (v) => aStr(v).toLowerCase()
  .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
  .replace(/(^-|-$)/g, '');
const aTags = (arr) => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set(); const out = [];
  for (const raw of arr) {
    const t = aStr(raw);
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase()); out.push(t);
  }
  return out;
};
const aIso = (t) => (t?.toDate?.() ? t.toDate().toISOString() : null);

async function loadCategories() {
  const snap = await categoriesCol().get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}
/** slug から {slug,name} を解決。sub は指定カテゴリの子であることも確認する。 */
async function resolveCategoryPair(categorySlug, subCategorySlug) {
  if (!categorySlug && !subCategorySlug) return { category: null, subCategory: null };
  const cats = await loadCategories();
  const valid = () => cats.filter((c) => !c.parent).map((c) => c.slug).join(', ');
  let category = null, subCategory = null;
  if (categorySlug) {
    const hit = cats.find((c) => c.slug === aSlug(categorySlug) && !c.parent);
    if (!hit) throw new Error(`未知のカテゴリ: ${categorySlug}（有効: ${valid()}）`);
    category = { slug: hit.slug, name: hit.name };
  }
  if (subCategorySlug) {
    if (!category) throw new Error('subCategorySlug には categorySlug の指定が必要です');
    const hit = cats.find((c) => c.slug === aSlug(subCategorySlug) && c.parent === category.slug);
    if (!hit) {
      const children = cats.filter((c) => c.parent === category.slug).map((c) => c.slug);
      throw new Error(`カテゴリ ${category.slug} のサブカテゴリに ${subCategorySlug} はありません` +
        (children.length ? `（有効: ${children.join(', ')}）` : '（サブカテゴリ未定義）'));
    }
    subCategory = { slug: hit.slug, name: hit.name };
  }
  return { category, subCategory };
}
/** slug の重複チェック（記事詳細ページは slug で1件引くため一意必須）。 */
async function assertSlugFree(slug, excludeId) {
  const snap = await articlesCol().where('slug', '==', slug).get();
  const dup = snap.docs.find((d) => d.id !== excludeId);
  if (dup) throw new Error(`slug "${slug}" は既存記事（${dup.id}: ${dup.data().title}）と重複しています`);
}
async function getArticle(id) {
  const d = await articlesCol().doc(id).get();
  if (!d.exists) throw new Error(`article not found: ${id}`);
  return { id: d.id, ...d.data() };
}
const articleSummary = (a) => ({
  id: a.id, title: a.title, slug: a.slug, status: a.status,
  category: a.category?.slug || null, subCategory: a.subCategory?.slug || null,
  tags: a.tags || [], featured: !!a.featured, coverUrl: a.coverUrl || '',
  excerpt: a.excerpt || '',
  publishedAt: aIso(a.publishedAt), updatedAt: aIso(a.updatedAt),
  url: a.status === 'published' ? `https://sekkeiya.com/articles/${a.slug}` : null,
});

server.registerTool('article_list', {
  title: '公式記事の一覧',
  description: '公式記事（officialArticles）を下書き含め全件、更新日の新しい順で返す（本文は含まない。本文は article_get で取得）。status で絞り込み可。review/interview はAI記者パイプライン（トレンド下書き/取材中）の中間状態。',
  inputSchema: { status: z.enum(['draft', 'published', 'review', 'interview']).optional() },
}, async ({ status }) => {
  const snap = await articlesCol().get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (status) list = list.filter((a) => a.status === status);
  list.sort((a, b) => (aIso(b.updatedAt) || '').localeCompare(aIso(a.updatedAt) || ''));
  return ok({ count: list.length, articles: list.map(articleSummary) });
});

server.registerTool('article_get', {
  title: '公式記事を取得（本文込み）',
  description: '記事1件を本文(HTML)・SEO情報込みで返す。',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => {
  const a = await getArticle(id);
  return ok({
    ...articleSummary(a),
    body: a.body || '', contentFormat: a.contentFormat || 'html',
    seoTitle: a.seoTitle || '', seoDescription: a.seoDescription || '',
    categoryName: a.category?.name || null, subCategoryName: a.subCategory?.name || null,
    author: a.author || null, createdAt: aIso(a.createdAt),
  });
});

server.registerTool('article_categories', {
  title: '記事カテゴリの一覧',
  description: '記事に指定できるカテゴリ（ハブ→サブの2階層）を slug 付きで返す。article_create / article_update の categorySlug / subCategorySlug にはここの slug を使う。',
  inputSchema: {},
}, async () => {
  const cats = await loadCategories();
  const tops = cats.filter((c) => !c.parent);
  return ok({
    categories: tops.map((t) => ({
      slug: t.slug, name: t.name, description: t.description || '',
      subCategories: cats.filter((c) => c.parent === t.slug)
        .map((c) => ({ slug: c.slug, name: c.name, description: c.description || '' })),
    })),
  });
});

// 本文HTMLの規約（既存記事と同じ書式に揃えるためツール説明に明記する）
const BODY_CONVENTIONS = '本文はHTMLフラグメント（<html>や<body>は不要）。見出しは<h2>/<h3>、段落<p>、リスト<ul>/<ol>、強調<strong>、コードは<code>。' +
  '画像は article_upload_image でアップロードしたURLを <p><img src="..." alt="説明" loading="lazy"></p> の形で挿入する。';

server.registerTool('article_create', {
  title: '公式記事を作成',
  description: `公式記事を作成する（既定は下書き draft。status:'published' で即公開も可）。著者は自動で公式アカウント(SEKKEIYA)。slug 省略時はタイトルから自動生成し、重複時はエラー。${BODY_CONVENTIONS} 公開記事のSEO反映（サイトマップ/プリレンダー）はWebデプロイ時に行われる点に注意。`,
  inputSchema: {
    title: z.string().min(1),
    body: z.string().min(1),
    slug: z.string().optional(),          // 省略時はタイトルから生成（日本語タイトルなら英語slug指定を推奨）
    excerpt: z.string().optional(),       // 一覧カード・SEO説明の既定に使われる要約（80〜120字目安）
    categorySlug: z.string().optional(),  // article_categories の slug
    subCategorySlug: z.string().optional(),
    tags: z.array(z.string()).optional(),
    coverUrl: z.string().optional(),      // article_upload_image (purpose:'cover') のURL
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    featured: z.boolean().optional(),
    status: z.enum(['draft', 'published']).optional(), // 既定 draft
  },
}, async (p) => {
  const status = p.status === 'published' ? 'published' : 'draft';
  const slug = aSlug(p.slug || p.title);
  if (!slug) return fail('slug を生成できません（英数字を含む slug かタイトルを指定してください）');
  await assertSlugFree(slug, null);
  const { category, subCategory } = await resolveCategoryPair(p.categorySlug, p.subCategorySlug);
  const tags = aTags(p.tags);
  const uid = await researchUid(); // 公式アカウント(hello@sekkeiya.com)の uid
  const now = FieldValue.serverTimestamp();
  const ref = await articlesCol().add({
    title: aStr(p.title), slug,
    excerpt: aStr(p.excerpt || ''), coverUrl: aStr(p.coverUrl || ''),
    body: aStr(p.body), contentFormat: 'html',
    featured: !!p.featured,
    seoTitle: aStr(p.seoTitle || ''), seoDescription: aStr(p.seoDescription || ''),
    tags, tagsLower: tags.map((t) => t.toLowerCase()),
    status, category, subCategory,
    createdAt: now, updatedAt: now,
    publishedAt: status === 'published' ? now : null,
    author: { uid, displayName: 'SEKKEIYA' },
  });
  return ok({
    created: { id: ref.id, title: aStr(p.title), slug, status },
    url: status === 'published' ? `https://sekkeiya.com/articles/${slug}` : null,
    note: status === 'published' ? 'アプリ上では即公開済み。Google向けのサイトマップ/プリレンダー反映にはWebデプロイが必要。' : '下書きとして保存。公開は article_publish で。',
  });
});

server.registerTool('article_update', {
  title: '公式記事を更新',
  description: `記事を部分更新する（指定したフィールドのみ変更・他は保持）。categorySlug に null を渡すとカテゴリ解除。${BODY_CONVENTIONS}`,
  inputSchema: {
    id: z.string().min(1),
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    slug: z.string().optional(),
    excerpt: z.string().optional(),
    categorySlug: z.string().nullable().optional(),
    subCategorySlug: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    coverUrl: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    featured: z.boolean().optional(),
  },
}, async (p) => {
  const current = await getArticle(p.id);
  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (p.title !== undefined) patch.title = aStr(p.title);
  if (p.body !== undefined) patch.body = aStr(p.body);
  if (p.slug !== undefined) {
    const slug = aSlug(p.slug);
    if (!slug) return fail('無効な slug です');
    if (slug !== current.slug) {
      await assertSlugFree(slug, p.id);
      patch.slug = slug; // 公開済みならURLが変わる（戻り値の warning で通知）
    }
  }
  if (p.excerpt !== undefined) patch.excerpt = aStr(p.excerpt);
  if (p.coverUrl !== undefined) patch.coverUrl = aStr(p.coverUrl);
  if (p.seoTitle !== undefined) patch.seoTitle = aStr(p.seoTitle);
  if (p.seoDescription !== undefined) patch.seoDescription = aStr(p.seoDescription);
  if (p.featured !== undefined) patch.featured = !!p.featured;
  if (p.tags !== undefined) {
    const tags = aTags(p.tags);
    patch.tags = tags; patch.tagsLower = tags.map((t) => t.toLowerCase());
  }
  if (p.categorySlug !== undefined) {
    if (p.categorySlug === null) { patch.category = null; patch.subCategory = null; }
    else {
      const { category, subCategory } = await resolveCategoryPair(p.categorySlug, p.subCategorySlug || undefined);
      patch.category = category;
      if (p.subCategorySlug !== undefined) {
        patch.subCategory = p.subCategorySlug === null ? null : subCategory;
      } else if (current.category?.slug !== category.slug) {
        patch.subCategory = null; // カテゴリが変わったら旧サブカテゴリは無効
      }
    }
  } else if (p.subCategorySlug !== undefined) {
    if (p.subCategorySlug === null) patch.subCategory = null;
    else {
      if (!current.category?.slug) return fail('カテゴリ未設定の記事にサブカテゴリだけは設定できません');
      const { subCategory } = await resolveCategoryPair(current.category.slug, p.subCategorySlug);
      patch.subCategory = subCategory;
    }
  }
  await articlesCol().doc(p.id).update(patch);
  const after = await getArticle(p.id);
  const slugChanged = patch.slug && patch.slug !== current.slug && current.status === 'published';
  return ok({
    updated: articleSummary(after),
    ...(slugChanged ? { warning: `公開記事のURLが変わりました（旧: /articles/${current.slug} は404になります）` } : {}),
  });
});

server.registerTool('article_publish', {
  title: '公式記事を公開',
  description: '下書き記事を公開する。publishedAt は初回公開時のみ付与（再公開では変えない）。公開前チェック（タイトル/本文/カテゴリ/抜粋の有無）を行い、不足があれば警告付きで公開する。',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => {
  const a = await getArticle(id);
  if (a.status === 'published') return fail(`「${a.title}」は既に公開済みです`);
  const warnings = [];
  if (!aStr(a.title)) return fail('タイトルが空のため公開できません');
  if (!aStr(a.body)) return fail('本文が空のため公開できません');
  if (!a.category?.slug) warnings.push('カテゴリ未設定（一覧のフィルタに載りません）');
  if (!aStr(a.excerpt)) warnings.push('抜粋(excerpt)未設定（一覧カード・SEO説明が本文からの自動切り出しになります）');
  if (!aStr(a.coverUrl)) warnings.push('カバー画像未設定');
  const patch = { status: 'published', updatedAt: FieldValue.serverTimestamp() };
  if (!a.publishedAt) patch.publishedAt = FieldValue.serverTimestamp();
  await articlesCol().doc(id).update(patch);
  return ok({
    published: { id, title: a.title, url: `https://sekkeiya.com/articles/${a.slug}` },
    warnings,
    note: 'アプリ上では即公開済み。Google向けのサイトマップ/プリレンダー反映にはWebデプロイ（/sekkeiya-web-deploy）が必要。',
  });
});

server.registerTool('article_unpublish', {
  title: '公式記事を非公開（下書きに戻す）',
  description: '公開中の記事を下書きに戻す。公開URLは404になる。publishedAt は保持（再公開時に順序が維持される）。',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => {
  const a = await getArticle(id);
  if (a.status !== 'published') return fail(`「${a.title}」は公開されていません`);
  await articlesCol().doc(id).update({ status: 'draft', updatedAt: FieldValue.serverTimestamp() });
  return ok({ unpublished: { id, title: a.title }, note: `https://sekkeiya.com/articles/${a.slug} は404になります` });
});

server.registerTool('article_delete', {
  title: '公式記事を削除',
  description: '記事を完全に削除する（復元不可）。公開中の記事はまず article_unpublish で影響確認してからの削除を推奨。',
  inputSchema: { id: z.string().min(1) },
}, async ({ id }) => {
  const a = await getArticle(id);
  await articlesCol().doc(id).delete();
  return ok({ deleted: { id, title: a.title, slug: a.slug, wasPublished: a.status === 'published' } });
});

// 画像アップロード: ローカルファイル → Storage（Webと同じパス規約）→ ダウンロードURL
const IMG_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};
server.registerTool('article_upload_image', {
  title: '記事用画像をアップロード',
  description: 'ローカルの画像ファイルを Firebase Storage にアップロードし、記事で使えるURLを返す。purpose:"cover"=カバー画像用（article_create/update の coverUrl へ）、"inline"=本文内画像用（<img src>へ）。対応: jpg/png/webp/gif/svg/mp4/pdf。',
  inputSchema: {
    filePath: z.string().min(1),           // ローカルの絶対パス
    purpose: z.enum(['cover', 'inline']),
    articleId: z.string().optional(),      // inline のとき整理用（省略時 'mcp'）
    alt: z.string().optional(),            // 返却するimgタグ例に使う代替テキスト
  },
}, async ({ filePath, purpose, articleId, alt }) => {
  if (!fs.existsSync(filePath)) return fail(`ファイルが見つかりません: ${filePath}`);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = IMG_TYPES[ext];
  if (!contentType) return fail(`未対応の拡張子: ${ext}（対応: ${Object.keys(IMG_TYPES).join(', ')}）`);
  const stat = fs.statSync(filePath);
  const maxMB = purpose === 'cover' ? 10 : 50; // storage.rules と同じ上限
  if (stat.size > maxMB * 1024 * 1024) return fail(`ファイルが大きすぎます（${(stat.size / 1048576).toFixed(1)}MB > 上限${maxMB}MB）`);
  const uid = await researchUid();
  const base = path.basename(filePath).replace(/[^\w.-]+/g, '_');
  const name = `${Date.now()}_${base}`;
  const dest = purpose === 'cover'
    ? `officialArticles/covers/${uid}/${name}`
    : `officialArticles/inline/${uid}/${articleId || 'mcp'}/${name}`;
  const token = crypto.randomUUID();
  const bucket = getStorage().bucket();
  await bucket.upload(filePath, {
    destination: dest,
    metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(dest)}?alt=media&token=${token}`;
  return ok({
    url,
    ...(purpose === 'inline'
      ? { imgTag: `<p><img src="${url.replace(/&/g, '&amp;')}" alt="${aStr(alt) || ''}" loading="lazy"></p>` }
      : { hint: 'このURLを article_create / article_update の coverUrl に指定する' }),
  });
});

// ── 起動 / スモークテスト ─────────────────────────────────────────
if (process.argv.includes('--smoke')) {
  const [all, sprints] = await Promise.all([loadItems(), loadSprints()]);
  const counts = { request: 0, requirement: 0 };
  for (const i of all) counts[i.type] = (counts[i.type] || 0) + 1;
  console.log(`[smoke] project=${serviceAccount.project_id} /devBacklog=${all.length}`, counts,
    `/devSprints=${sprints.length}`, sprints.map((s) => `Sprint ${s.seq}(${s.startDate}〜${s.endDate})`));
  try {
    const uid = await researchUid();
    const rsnap = await (await researchCol()).get();
    console.log(`[smoke] research account=${RESEARCH_ACCOUNT_EMAIL} uid=${uid} boards=${rsnap.size}`,
      rsnap.docs.map((d) => `${d.id}(notes:${(d.data().items || []).length},edges:${(d.data().edges || []).length})`));
  } catch (e) {
    console.log(`[smoke] research: FAILED to resolve ${RESEARCH_ACCOUNT_EMAIL}: ${e?.message || e}`);
  }
  try {
    const [arts, cats] = await Promise.all([articlesCol().get(), loadCategories()]);
    const byStatus = { draft: 0, published: 0 };
    for (const d of arts.docs) byStatus[d.data().status] = (byStatus[d.data().status] || 0) + 1;
    console.log(`[smoke] /officialArticles=${arts.size}`, byStatus,
      `/categories=${cats.length}`, cats.filter((c) => !c.parent).map((c) => c.slug));
  } catch (e) {
    console.log(`[smoke] articles: FAILED: ${e?.message || e}`);
  }
  process.exit(0);
} else {
  await server.connect(new StdioServerTransport());
  void touchHeartbeat();
  setInterval(touchHeartbeat, 60_000).unref();
  console.error('[devbacklog-mcp] v2.5 ready (stdio). /devBacklog + /devSprints + Research&Memo + officialArticles, project=' + serviceAccount.project_id);
}
