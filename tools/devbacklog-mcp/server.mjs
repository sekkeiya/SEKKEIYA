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
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
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
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const items = () => db.collection('devBacklog');
const sprintsCol = () => db.collection('devSprints');

// 接続状態の可視化: コネクタ画面（管理者向け「Claude Code」カード）が読むハートビート。
// サーバー稼働中は60秒ごとに lastSeenAt を更新 → UI 側は「3分以内なら接続中」と表示する。
const touchHeartbeat = () => db.collection('devMeta').doc('claudeMcp')
  .set({ lastSeenAt: FieldValue.serverTimestamp(), version: '2.4.0' }, { merge: true })
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
const server = new McpServer({ name: 'sekkeiya-devbacklog', version: '2.4.0' });

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
  process.exit(0);
} else {
  await server.connect(new StdioServerTransport());
  void touchHeartbeat();
  setInterval(touchHeartbeat, 60_000).unref();
  console.error('[devbacklog-mcp] v2.4 ready (stdio). /devBacklog + /devSprints + Research&Memo, project=' + serviceAccount.project_id);
}
