# devbacklog MCP マインドマップ対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** devbacklog MCP からマインドマップ（`users/{uid}/research/{boardId}` の `mindmap` / `mindmapRelations`）を読み書きできるようにする。

**Architecture:** 木の操作という壊れやすいロジックは Firestore に触れない純粋関数として `mindmap.mjs` に切り出し、Node 標準テストランナーで検証する。`server.mjs` 側は薄いツール登録に徹し、`loadBoard` / `saveBoard` を拡張して `mindmap` / `mindmapRelations` を読み書きする。意味論は `sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts` の5つの verb の写しとする。

**Tech Stack:** Node (ESM `.mjs`) / `@modelcontextprotocol/sdk` / `firebase-admin` / `zod` / `node:test`（Node 組み込み。新規依存なし）

仕様書: [../specs/2026-07-29-devbacklog-mcp-mindmap-design.md](../specs/2026-07-29-devbacklog-mcp-mindmap-design.md)

## Global Constraints

- 作業ディレクトリは `C:\Users\sekkeiya\02-WebApp\040-sekkeiya\sekkeiya`（web リポジトリ）。git ブランチは `main`。
- **新規 npm 依存を追加しない。** テストは Node 組み込みの `node:test` / `node:assert` を使う。
- ファイルは ESM（`package.json` に `"type": "module"`）。`import` / `export` を使い、`require` は使わない。
- コード内のコメントと、MCP ツールの `title` / `description` / エラーメッセージは**日本語**で書く。既存 `server.mjs` の語調に合わせる。
- **MCP ツールの description は Claude が読む唯一の使い方の説明**である。既存の `research_*` と同じ密度で、いつ使うか・引数の意味・戻り値を書く。
- 既存の `research_*` ツールの**返り値から既存フィールドを削除・改名しない**。追加のみ。
- 失敗は例外で全体を落とさず、**スキップして理由を返す**（既存 `research_connect` と同じ方針）。
- **本番 Firestore に直接書き込む。** `--smoke` は読み取りのみ。書き込みを伴う確認は、指示がある手順でのみ、指定されたボードに対して行う。
- **`firebase deploy` を実行しない。** MCP はローカル実行のツールでありデプロイ対象ではない。
- 確定している意味論（仕様書4章より。これが verb 実装との契約）:
  - `MindMapNode` = `{ id, parentId, rank, text, collapsed?, color?, icons?, image?, imageW?, imageH?, link?, note?, refType?, refId?, refTitle?, childBoardId?, originBoardId?, createdAt, updatedAt }`
  - `parentId: null` が中心トピック。1ボードに1つ。無ければ `{ parentId: null, rank: 0, text: '中心トピック' }` を自動生成する。
  - `rank` は親ごとの並び順。**既存の兄弟の最大 rank + 1、兄弟が無ければ 0**。
  - `MindMapRelation` = `{ id, source, target, text?, createdAt, updatedAt }`
  - 削除は**部分木ごと**。
  - `image` に `data:` URL は不可（https の実 URL のみ）。
- コミットメッセージの末尾に `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` を付ける。
- **MCP サーバーの変更は Claude Code を再起動するまで反映されない。** 実装中に MCP ツールとして呼び出して確認することはできない。検証は `node --test` と `node server.mjs --smoke` で行う。

---

## File Structure

| ファイル | 責務 | 新規/変更 |
|---|---|---|
| `tools/devbacklog-mcp/mindmap.mjs` | 木の操作の純粋関数。Firestore・MCP に依存しない | 新規 |
| `tools/devbacklog-mcp/mindmap.test.mjs` | 上記の単体テスト（`node --test`） | 新規 |
| `tools/devbacklog-mcp/server.mjs` | `loadBoard` / `saveBoard` の拡張、既存2ツールの拡張、新規5ツールの登録 | 変更（953行） |
| `tools/devbacklog-mcp/package.json` | `test` スクリプトの追加 | 変更 |
| `tools/devbacklog-mcp/README.md` | 新ツールの説明 | 変更 |
| `../sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts` | MCP に写しがある旨の相互参照コメント | 変更（1箇所） |

---

## Task 1: 木の操作の純粋関数とテスト

**Files:**
- Create: `tools/devbacklog-mcp/mindmap.mjs`
- Create: `tools/devbacklog-mcp/mindmap.test.mjs`
- Modify: `tools/devbacklog-mcp/package.json`

**Interfaces:**
- Consumes: なし（このタスクは自己完結。Firestore にも MCP SDK にも触れない）
- Produces:
  - `CENTER_TEXT: string`
  - `ensureCenter(nodes, now, newId) -> { nodes, center }`
  - `nextRankOf(nodes) -> (parentId) => number` — 呼ぶたびに採番が進むクロージャ
  - `collectSubtree(nodes, ids) -> Set<string>`
  - `addTopics({ nodes, topics, now, newId }) -> { nodes, created, errors, batchIds }` — `batchIds` は `"#N"` から実 id への `Map`。`mindmap_add_topics` が同じ呼び出し内の `relations` を解決するのに使う
  - `addRelations({ relations, inputs, resolve, now, newId }) -> { relations, created, skipped }`
  - `updateTopic({ nodes, id, patch, now }) -> { nodes, updated, error }`
  - `removeTopics({ nodes, relations, ids }) -> { nodes, relations, removed, errors }`
  - `topicSummary(n) -> object`, `relationSummary(r) -> object`

- [ ] **Step 1: `package.json` に test スクリプトを足す**

`tools/devbacklog-mcp/package.json` の `scripts` を次にする（既存2行はそのまま、1行追加）。

```json
  "scripts": {
    "start": "node server.mjs",
    "smoke": "node server.mjs --smoke",
    "test": "node --test"
  },
```

- [ ] **Step 2: 失敗するテストを書く**

`tools/devbacklog-mcp/mindmap.test.mjs` を作成する。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTER_TEXT, ensureCenter, nextRankOf, collectSubtree,
  addTopics, addRelations, updateTopic, removeTopics,
} from './mindmap.mjs';

const NOW = '2026-07-29T00:00:00.000Z';
// テストでは決定的な id を使う（本番は rNewId）
const idGen = () => { let n = 0; return () => `n${++n}`; };

test('ensureCenter: 空なら中心トピックを作る', () => {
  const { nodes, center } = ensureCenter([], NOW, idGen());
  assert.equal(nodes.length, 1);
  assert.equal(center.parentId, null);
  assert.equal(center.rank, 0);
  assert.equal(center.text, CENTER_TEXT);
});

test('ensureCenter: 既に中心があれば作らない', () => {
  const existing = [{ id: 'c', parentId: null, rank: 0, text: '既存', createdAt: NOW, updatedAt: NOW }];
  const { nodes, center } = ensureCenter(existing, NOW, idGen());
  assert.equal(nodes.length, 1);
  assert.equal(center.id, 'c');
});

test('nextRankOf: 親ごとに 兄弟の最大+1、兄弟なしは0', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
    { id: 'b', parentId: 'c', rank: 4, text: 'b', createdAt: NOW, updatedAt: NOW },
  ];
  const take = nextRankOf(nodes);
  assert.equal(take('c'), 5);
  assert.equal(take('c'), 6);
  assert.equal(take('a'), 0);
});

test('addTopics: "#N" で1回の呼び出しで部分木が組める', () => {
  const { nodes: base } = ensureCenter([], NOW, idGen());
  const { nodes, created, errors } = addTopics({
    nodes: base,
    topics: [
      { text: '親' },
      { text: '子', parent: '#0' },
      { text: '孫', parent: '#1' },
    ],
    now: NOW,
    newId: idGen(),
  });
  assert.deepEqual(errors, []);
  assert.equal(created.length, 3);
  assert.equal(created[1].parentId, created[0].id);
  assert.equal(created[2].parentId, created[1].id);
  assert.equal(nodes.length, 4); // 中心 + 3
});

test('addTopics: parent 省略は中心トピック直下', () => {
  const { nodes: base, center } = ensureCenter([], NOW, idGen());
  const { created } = addTopics({ nodes: base, topics: [{ text: 'x' }], now: NOW, newId: idGen() });
  assert.equal(created[0].parentId, center.id);
});

test('addTopics: text が空、data: URL、存在しない parent は理由つきで弾く', () => {
  const { nodes: base } = ensureCenter([], NOW, idGen());
  const { created, errors } = addTopics({
    nodes: base,
    topics: [
      { text: '   ' },
      { text: 'ok', image: 'data:image/png;base64,AAA' },
      { text: 'ok2', parent: 'nope' },
    ],
    now: NOW,
    newId: idGen(),
  });
  assert.equal(created.length, 0);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /text/);
  assert.match(errors[1], /data:/);
  assert.match(errors[2], /parent/);
});

test('addTopics: note/link/refType は保存され、undefined は落ちる', () => {
  const { nodes: base } = ensureCenter([], NOW, idGen());
  const { created } = addTopics({
    nodes: base,
    topics: [{ text: 't', note: 'n', link: 'https://e.com', refType: 'article', refId: 'a1', refTitle: 'T' }],
    now: NOW,
    newId: idGen(),
  });
  assert.equal(created[0].note, 'n');
  assert.equal(created[0].refType, 'article');
  assert.ok(!('image' in created[0]));
});

test('collectSubtree: 部分木を集める', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
    { id: 'b', parentId: 'a', rank: 0, text: 'b', createdAt: NOW, updatedAt: NOW },
    { id: 'd', parentId: 'c', rank: 1, text: 'd', createdAt: NOW, updatedAt: NOW },
  ];
  assert.deepEqual([...collectSubtree(nodes, ['a'])].sort(), ['a', 'b']);
});

test('removeTopics: 部分木ごと消え、関わる関係線も消える', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
    { id: 'b', parentId: 'a', rank: 0, text: 'b', createdAt: NOW, updatedAt: NOW },
  ];
  const rels = [{ id: 'r1', source: 'b', target: 'c', createdAt: NOW, updatedAt: NOW }];
  const res = removeTopics({ nodes, relations: rels, ids: ['a'] });
  assert.deepEqual(res.removed.sort(), ['a', 'b']);
  assert.equal(res.nodes.length, 1);
  assert.equal(res.relations.length, 0);
});

test('removeTopics: 中心トピックは消せない', () => {
  const nodes = [{ id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW }];
  const res = removeTopics({ nodes, relations: [], ids: ['c'] });
  assert.deepEqual(res.removed, []);
  assert.equal(res.nodes.length, 1);
  assert.match(res.errors[0], /中心トピック/);
});

test('updateTopic: 本文と note を更新し、空文字の note は削除', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', note: 'old', createdAt: NOW, updatedAt: NOW },
  ];
  const r1 = updateTopic({ nodes, id: 'a', patch: { text: 'new' }, now: NOW });
  assert.equal(r1.updated.text, 'new');
  const r2 = updateTopic({ nodes: r1.nodes, id: 'a', patch: { note: '' }, now: NOW });
  assert.ok(!('note' in r2.updated));
});

test('updateTopic: 自分の子孫へは移動できない（循環防止）', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
    { id: 'b', parentId: 'a', rank: 0, text: 'b', createdAt: NOW, updatedAt: NOW },
  ];
  const res = updateTopic({ nodes, id: 'a', patch: { parent: 'b' }, now: NOW });
  assert.equal(res.updated, null);
  assert.match(res.error, /子孫/);
});

test('updateTopic: 中心トピックは親を変えられない', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
  ];
  const res = updateTopic({ nodes, id: 'c', patch: { parent: 'a' }, now: NOW });
  assert.equal(res.updated, null);
  assert.match(res.error, /中心トピック/);
});

test('addRelations: 自己ループ・重複・不明な端点はスキップ', () => {
  const resolve = (ref) => (['a', 'b'].includes(ref) ? ref : null);
  const existing = [{ id: 'r0', source: 'a', target: 'b', createdAt: NOW, updatedAt: NOW }];
  const res = addRelations({
    relations: existing,
    inputs: [
      { source: 'a', target: 'a' },
      { source: 'a', target: 'b' },
      { source: 'a', target: 'zzz' },
      { source: 'b', target: 'a', text: '逆' },
    ],
    resolve, now: NOW, newId: idGen(),
  });
  assert.equal(res.created.length, 1);
  assert.equal(res.created[0].text, '逆');
  assert.equal(res.skipped.length, 3);
});
```

- [ ] **Step 3: テストが失敗することを確認する**

```bash
cd tools/devbacklog-mcp && node --test
```

期待: `Cannot find module ... mindmap.mjs` で全テストが失敗する。

- [ ] **Step 4: `mindmap.mjs` を実装する**

`tools/devbacklog-mcp/mindmap.mjs` を作成する。

```js
// マインドマップの木の操作（Firestore・MCP に非依存の純粋関数）。
//
// ⚠ 意味論の写し元: sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts と
//    sekkeiya-desktop/src/features/projects/chat/mindmapBridge.ts。
//    rank の採番規則・中心トピックの扱い・削除が部分木ごとである点を変えるときは、
//    両方を揃えて直すこと（ランタイムが違うためコードは共有できない）。

export const CENTER_TEXT = '中心トピック';

const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const trimOrUndef = (v) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** 中心トピック（parentId===null）を返す。無ければ作って nodes に足したものを返す。 */
export function ensureCenter(nodes, now, newId) {
  const found = nodes.find((n) => n.parentId === null || n.parentId === undefined);
  if (found) return { nodes, center: found };
  const center = { id: newId(), parentId: null, rank: 0, text: CENTER_TEXT, createdAt: now, updatedAt: now };
  return { nodes: [...nodes, center], center };
}

/** 親ごとの rank 採番。呼ぶたびに進む。既存の兄弟の最大+1、兄弟が無ければ 0。 */
export function nextRankOf(nodes) {
  const next = new Map();
  return (parentId) => {
    if (!next.has(parentId)) {
      const sib = nodes.filter((n) => n.parentId === parentId);
      next.set(parentId, sib.length ? Math.max(...sib.map((s) => s.rank ?? 0)) + 1 : 0);
    }
    const r = next.get(parentId);
    next.set(parentId, r + 1);
    return r;
  };
}

/** 指定 id とその全子孫の id を集める。 */
export function collectSubtree(nodes, ids) {
  const byParent = new Map();
  for (const n of nodes) {
    const list = byParent.get(n.parentId) || [];
    list.push(n.id);
    byParent.set(n.parentId, list);
  }
  const out = new Set();
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    for (const child of byParent.get(id) || []) stack.push(child);
  }
  return out;
}

/**
 * トピックを追加する。parent には既存 id か "#N"（topics 配列の添字）を使える。
 * text が空・image が data: URL・parent が解決できないものは追加せず errors に理由を積む。
 */
export function addTopics({ nodes, topics, now, newId }) {
  const seeded = ensureCenter(nodes, now, newId);
  let working = seeded.nodes;
  const center = seeded.center;
  const takeRank = nextRankOf(working);
  const existingIds = new Set(working.map((n) => n.id));
  const batchIds = new Map(); // "#N" -> 実 id
  const created = [];
  const errors = [];

  topics.forEach((t, idx) => {
    const text = trimOrUndef(t?.text);
    if (!text) { errors.push(`topics[${idx}]: text が必要です`); return; }
    if (typeof t.image === 'string' && /^data:/i.test(t.image)) {
      errors.push(`topics[${idx}]: data: URL は使えません。https の実URLを使ってください`);
      return;
    }
    let parentId = center.id;
    if (typeof t.parent === 'string' && t.parent) {
      if (t.parent.startsWith('#')) {
        const resolved = batchIds.get(t.parent);
        if (!resolved) { errors.push(`topics[${idx}]: parent ${t.parent} は未作成です（自分より前の添字のみ指せます）`); return; }
        parentId = resolved;
      } else if (existingIds.has(t.parent)) {
        parentId = t.parent;
      } else {
        errors.push(`topics[${idx}]: parent が見つかりません: ${t.parent}`);
        return;
      }
    }
    const node = compact({
      id: newId(), parentId, rank: takeRank(parentId), text,
      note: trimOrUndef(t.note), link: trimOrUndef(t.link), image: trimOrUndef(t.image),
      refType: t.refType === 'library' || t.refType === 'article' ? t.refType : undefined,
      refId: trimOrUndef(t.refId), refTitle: trimOrUndef(t.refTitle),
      createdAt: now, updatedAt: now,
    });
    working = [...working, node];
    existingIds.add(node.id);
    batchIds.set(`#${idx}`, node.id);
    created.push(node);
  });

  return { nodes: working, created, errors, batchIds };
}

/** 関係線を張る。resolve は参照文字列を実 id か null に解決する関数。 */
export function addRelations({ relations, inputs, resolve, now, newId }) {
  const key = (r) => `${r.source}->${r.target}`;
  const seen = new Set(relations.map(key));
  const created = [];
  const skipped = [];
  for (const r of inputs) {
    const source = resolve(r.source);
    const target = resolve(r.target);
    if (!source) { skipped.push(`source が見つかりません: ${r.source}`); continue; }
    if (!target) { skipped.push(`target が見つかりません: ${r.target}`); continue; }
    if (source === target) { skipped.push(`自己ループは張れません: ${source}`); continue; }
    if (seen.has(`${source}->${target}`)) { skipped.push(`既に接続済み: ${source}->${target}`); continue; }
    seen.add(`${source}->${target}`);
    created.push(compact({ id: newId(), source, target, text: trimOrUndef(r.text), createdAt: now, updatedAt: now }));
  }
  return { relations: [...relations, ...created], created, skipped };
}

/**
 * トピックを1件更新する。patch は { text, note, link, parent, collapsed }。
 * note / link は空文字を渡すと削除。parent は自分の子孫へは移せない（循環防止）。
 */
export function updateTopic({ nodes, id, patch, now }) {
  const target = nodes.find((n) => n.id === id);
  if (!target) return { nodes, updated: null, error: `トピックが見つかりません: ${id}` };

  const next = { ...target, updatedAt: now };

  if (patch.text !== undefined) {
    const text = trimOrUndef(patch.text);
    if (!text) return { nodes, updated: null, error: 'text を空にはできません' };
    next.text = text;
  }
  for (const field of ['note', 'link']) {
    if (patch[field] === undefined) continue;
    const v = trimOrUndef(patch[field]);
    if (v) next[field] = v; else delete next[field];
  }
  if (patch.collapsed !== undefined) {
    if (patch.collapsed) next.collapsed = true; else delete next.collapsed;
  }
  let moved = false;
  if (patch.parent !== undefined) {
    if (target.parentId === null || target.parentId === undefined) {
      return { nodes, updated: null, error: '中心トピックの親は変えられません' };
    }
    if (!nodes.some((n) => n.id === patch.parent)) {
      return { nodes, updated: null, error: `移動先の親が見つかりません: ${patch.parent}` };
    }
    if (collectSubtree(nodes, [id]).has(patch.parent)) {
      return { nodes, updated: null, error: '自分の子孫へは移動できません' };
    }
    next.parentId = patch.parent;
    moved = true;
  }

  let working = nodes.map((n) => (n.id === id ? next : n));
  if (moved) {
    // 移動先の末尾に付ける
    next.rank = nextRankOf(working.filter((n) => n.id !== id))(next.parentId);
    working = working.map((n) => (n.id === id ? next : n));
  }
  return { nodes: working, updated: next, error: null };
}

/** 指定 id を部分木ごと削除する。中心トピックは削除できない。関わる関係線も消える。 */
export function removeTopics({ nodes, relations, ids }) {
  const errors = [];
  const targets = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    if (!n) { errors.push(`トピックが見つかりません: ${id}`); continue; }
    if (n.parentId === null || n.parentId === undefined) { errors.push('中心トピックは削除できません'); continue; }
    targets.push(id);
  }
  if (targets.length === 0) return { nodes, relations, removed: [], errors };

  const doomed = collectSubtree(nodes, targets);
  return {
    nodes: nodes.filter((n) => !doomed.has(n.id)),
    relations: relations.filter((r) => !doomed.has(r.source) && !doomed.has(r.target)),
    removed: [...doomed],
    errors,
  };
}

export const topicSummary = (n) => compact({
  id: n.id, parentId: n.parentId, rank: n.rank, text: n.text,
  note: n.note, link: n.link, icons: n.icons, collapsed: n.collapsed,
  refTitle: n.refTitle, childBoardId: n.childBoardId,
});

export const relationSummary = (r) => compact({ id: r.id, source: r.source, target: r.target, text: r.text });
```

- [ ] **Step 5: テストが通ることを確認する**

```bash
cd tools/devbacklog-mcp && node --test
```

期待: 全テスト pass。失敗が0件で、出力に警告が無いこと。

- [ ] **Step 6: コミット**

```bash
git add tools/devbacklog-mcp/mindmap.mjs tools/devbacklog-mcp/mindmap.test.mjs tools/devbacklog-mcp/package.json
git commit -m "feat(mcp): マインドマップの木操作を純粋関数として追加

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: 読み書きの土台と既存2ツールの拡張

`loadBoard` / `saveBoard` が `mindmap` / `mindmapRelations` を扱えるようにし、「ノードビューが空＝ボードが空」という誤読ができないようにする。

**Files:**
- Modify: `tools/devbacklog-mcp/server.mjs`（`loadBoard` は 139-144 行付近、`saveBoard` は 145-151 行付近、`research_list_boards` は 447 行付近、`research_get_board` は 468 行付近）

**Interfaces:**
- Consumes: `topicSummary`, `relationSummary`（Task 1）
- Produces:
  - `loadBoard(boardId)` が `{ items, edges, title, mindmap, mindmapRelations }` を返す
  - `saveBoard(boardId, data)` が `data.mindmap` / `data.mindmapRelations` を受け付ける

- [ ] **Step 1: `mindmap.mjs` を import する**

`server.mjs` の既存 import 群（`firebase-admin` の import の直後）に次を足す。

```js
import {
  ensureCenter, addTopics, addRelations, updateTopic, removeTopics,
  topicSummary, relationSummary,
} from './mindmap.mjs';
```

- [ ] **Step 2: `loadBoard` を拡張する**

既存の `loadBoard` を次に置き換える。

```js
async function loadBoard(boardId) {
  const snap = await (await researchDocRef(boardId)).get();
  if (!snap.exists) return { items: [], edges: [], title: null, mindmap: [], mindmapRelations: [] };
  const d = snap.data();
  return {
    items: Array.isArray(d.items) ? d.items : [],
    edges: Array.isArray(d.edges) ? d.edges : [],
    title: d.title || null,
    mindmap: Array.isArray(d.mindmap) ? d.mindmap : [],
    mindmapRelations: Array.isArray(d.mindmapRelations) ? d.mindmapRelations : [],
  };
}
```

- [ ] **Step 3: `saveBoard` を拡張する**

既存の `saveBoard` を次に置き換える。

```js
async function saveBoard(boardId, data) {
  const payload = { updatedAt: FieldValue.serverTimestamp() };
  if (data.items) payload.items = data.items.map(compact);
  if (data.edges) payload.edges = data.edges.map(compact);
  if (data.mindmap) payload.mindmap = data.mindmap.map(compact);
  if (data.mindmapRelations) payload.mindmapRelations = data.mindmapRelations.map(compact);
  if (data.title !== undefined) payload.title = data.title;
  await (await researchDocRef(boardId)).set(payload, { merge: true });
}
```

- [ ] **Step 4: `research_list_boards` に件数を足す**

`metas` を作る `map` の返り値に2行足し、末尾の `unshift` も揃える。

```js
    return {
      id: d.id,
      title: (typeof x.title === 'string' && x.title.trim()) ? x.title : (d.id === RESEARCH_DEFAULT_BOARD ? 'メインボード' : '無題のボード'),
      notes: Array.isArray(x.items) ? x.items.length : 0,
      edges: Array.isArray(x.edges) ? x.edges.length : 0,
      topics: Array.isArray(x.mindmap) ? x.mindmap.length : 0,
      relations: Array.isArray(x.mindmapRelations) ? x.mindmapRelations.length : 0,
    };
```

```js
    metas.unshift({ id: RESEARCH_DEFAULT_BOARD, title: 'メインボード', notes: 0, edges: 0, topics: 0, relations: 0 });
```

同ツールの `description` も実態に合わせる。

```js
  description: `${RESEARCH_ACCOUNT_EMAIL} のアカウントサイト Research & Memo のボード一覧（メインボード＋追加ボード）を返す。notes/edges はノードビュー、topics/relations はマインドマップの件数。マインドマップが既定のビューなので、topics が 0 でなければ中身は mindmap_get で読むこと。`,
```

- [ ] **Step 5: `research_get_board` にマインドマップを足す**

```js
}, async ({ boardId }) => {
  const { items, edges, title, mindmap, mindmapRelations } = await loadBoard(boardId);
  return ok({
    boardId: boardId || RESEARCH_DEFAULT_BOARD,
    title: title || (boardId && boardId !== RESEARCH_DEFAULT_BOARD ? '無題のボード' : 'メインボード'),
    notes: items.map(noteSummary),
    edges: edges.map(edgeSummary),
    mindmap: mindmap.map(topicSummary),
    mindmapRelations: mindmapRelations.map(relationSummary),
  });
});
```

同ツールの `description` も更新する。

```js
  description: '指定ボードのノードビュー（メモ・エッジ）とマインドマップ（トピック・関係線）を返す。boardId 省略時はメインボード(canvas)。マインドマップだけが欲しいときは mindmap_get のほうが軽い。',
```

- [ ] **Step 6: 構文チェック**

```bash
cd tools/devbacklog-mcp && node --check server.mjs
```

期待: 出力なし（成功）。

- [ ] **Step 7: smoke で実データを読めることを確認する**

```bash
cd tools/devbacklog-mcp && node server.mjs --smoke
```

期待: エラーなく終了し、research のボード数が表示される。

- [ ] **Step 8: 既存テストが壊れていないことを確認する**

```bash
cd tools/devbacklog-mcp && node --test
```

期待: Task 1 の全テストが引き続き pass。

- [ ] **Step 9: コミット**

```bash
git add tools/devbacklog-mcp/server.mjs
git commit -m "feat(mcp): ボードの読み書きでマインドマップも扱う

research_list_boards に topics/relations の件数を、research_get_board に
mindmap/mindmapRelations を追加。ノードビューが空でもマインドマップに中身が
あることが分かるようにする。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `mindmap_get` と `mindmap_add_topics`

**Files:**
- Modify: `tools/devbacklog-mcp/server.mjs`（`research_delete_board` の登録の直後に追記）

**Interfaces:**
- Consumes: `loadBoard` / `saveBoard`（Task 2）、`ensureCenter` / `addTopics` / `addRelations` / `topicSummary` / `relationSummary`（Task 1）、既存の `rNewId` / `ok` / `fail` / `z`
- Produces: MCP ツール `mindmap_get`, `mindmap_add_topics`

- [ ] **Step 1: `mindmap_get` を登録する**

`server.mjs` の `research_delete_board` の `registerTool` ブロックの直後に足す。

```js
// ── マインドマップ（Research & Memo の既定ビュー） ───────────────────────
// ⚠ 意味論の写し元: sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts
//    片方を変えたらもう片方も揃えること。木の操作の実体は ./mindmap.mjs。

server.registerTool('mindmap_get', {
  title: 'マインドマップを読む',
  description: 'ボードのマインドマップ（トピックの木と関係線）を返す。boardId 省略時はメインボード(canvas)。parentId が null のものが中心トピック。rank は兄弟内の並び順。ここで得た id を mindmap_add_topics の parent や mindmap_update_topic の id に使う。',
  inputSchema: { boardId: z.string().optional() },
}, async ({ boardId }) => {
  const { mindmap, mindmapRelations, title } = await loadBoard(boardId);
  return ok({
    boardId: boardId || RESEARCH_DEFAULT_BOARD,
    title: title || (boardId && boardId !== RESEARCH_DEFAULT_BOARD ? '無題のボード' : 'メインボード'),
    topics: mindmap.map(topicSummary),
    relations: mindmapRelations.map(relationSummary),
  });
});
```

- [ ] **Step 2: `mindmap_add_topics` を登録する**

続けて足す。

```js
server.registerTool('mindmap_add_topics', {
  title: 'マインドマップにトピックを追加',
  description: 'トピックを複数まとめて生やす（関係線も同時に張れる）。parent に既存トピックの id を渡すとその子に、"#0" 形式（topics 配列の添字）で今回追加分の子にでき、1回の呼び出しで部分木を組める。parent 省略は中心トピック直下。中心トピックが無いボードでは自動で作る。長い補足は text に詰めず note に入れる（トピックは短い見出し、note が本文）。image は https の実URLのみ（data: URL は不可）。追加した id を返すので、続けて mindmap_connect_topics でつなげる。',
  inputSchema: {
    boardId: z.string().optional(),
    topics: z.array(z.object({
      text: z.string().min(1),
      parent: z.string().optional(),
      note: z.string().optional(),
      link: z.string().optional(),
      image: z.string().optional(),
      refType: z.enum(['library', 'article']).optional(),
      refId: z.string().optional(),
      refTitle: z.string().optional(),
    })).min(1),
    relations: z.array(z.object({
      source: z.string().min(1),
      target: z.string().min(1),
      text: z.string().optional(),
    })).optional(),
  },
}, async ({ boardId, topics, relations: relInputs }) => {
  const board = await loadBoard(boardId);
  const now = new Date().toISOString();
  const res = addTopics({ nodes: board.mindmap, topics, now, newId: rNewId });

  const patch = { mindmap: res.nodes };
  let relResult = { created: [], skipped: [] };
  if (Array.isArray(relInputs) && relInputs.length > 0) {
    const ids = new Set(res.nodes.map((n) => n.id));
    const resolve = (ref) => {
      if (typeof ref !== 'string') return null;
      if (ref.startsWith('#')) return res.batchIds.get(ref) || null;
      return ids.has(ref) ? ref : null;
    };
    relResult = addRelations({ relations: board.mindmapRelations, inputs: relInputs, resolve, now, newId: rNewId });
    patch.mindmapRelations = relResult.relations;
  }

  await saveBoard(boardId, patch);
  return ok({
    added: res.created.map((c) => ({ id: c.id, parentId: c.parentId, text: c.text })),
    errors: res.errors,
    relationsAdded: relResult.created.map(relationSummary),
    relationsSkipped: relResult.skipped,
  });
});
```

- [ ] **Step 3: 構文チェック**

```bash
cd tools/devbacklog-mcp && node --check server.mjs
```

期待: 出力なし。

- [ ] **Step 4: テストが引き続き通ることを確認する**

```bash
cd tools/devbacklog-mcp && node --test
```

期待: 全 pass。

- [ ] **Step 5: このタスクでは実データ確認を行わないことを確認する**

MCP ツールはサーバープロセスの起動時に読み込まれるため、Claude Code を再起動するまで呼び出せない。**このタスクの検証は Step 3（構文）と Step 4（単体テスト）までとし、実データに対する書き込み確認は Task 5 でまとめて行う。**

`node server.mjs` を直接実行して確認しようとしないこと。MCP サーバーとして stdio を待ち受けたままハングする。読み取りだけを確かめたい場合は `node server.mjs --smoke` を使う。

報告に「実データ確認は Task 5 へ送った」と明記すること。

- [ ] **Step 6: コミット**

```bash
git add tools/devbacklog-mcp/server.mjs
git commit -m "feat(mcp): mindmap_get と mindmap_add_topics を追加

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `mindmap_update_topic` / `mindmap_remove_topics` / `mindmap_connect_topics`

**Files:**
- Modify: `tools/devbacklog-mcp/server.mjs`（Task 3 で足した `mindmap_add_topics` の直後に追記）
- Modify: `tools/devbacklog-mcp/README.md`
- Modify: `../sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts`（ファイル冒頭に相互参照コメント。**このファイルは別リポジトリなので別途コミットする**）

**Interfaces:**
- Consumes: `updateTopic` / `removeTopics` / `addRelations` / `topicSummary` / `relationSummary`（Task 1）、`loadBoard` / `saveBoard`（Task 2）
- Produces: MCP ツール `mindmap_update_topic`, `mindmap_remove_topics`, `mindmap_connect_topics`

- [ ] **Step 1: 3つのツールを登録する**

`mindmap_add_topics` の直後に足す。

```js
server.registerTool('mindmap_update_topic', {
  title: 'トピックを更新',
  description: 'トピック1件の本文・補足メモ・リンク・親・折りたたみを更新する。id は mindmap_get で得たもの。note と link は空文字を渡すと削除。parent を渡すと移動する（移動先の末尾に付く）。中心トピックの親は変えられず、自分の子孫へも移動できない。',
  inputSchema: {
    boardId: z.string().optional(),
    id: z.string().min(1),
    text: z.string().optional(),
    note: z.string().optional(),
    link: z.string().optional(),
    parent: z.string().optional(),
    collapsed: z.boolean().optional(),
  },
}, async ({ boardId, id, text, note, link, parent, collapsed }) => {
  const board = await loadBoard(boardId);
  const now = new Date().toISOString();
  const res = updateTopic({
    nodes: board.mindmap, id, now,
    patch: compact({ text, note, link, parent, collapsed }),
  });
  if (res.error) return fail(res.error);
  await saveBoard(boardId, { mindmap: res.nodes });
  return ok({ updated: topicSummary(res.updated) });
});

server.registerTool('mindmap_remove_topics', {
  title: 'トピックを削除',
  description: 'トピックを削除する。指定した id の配下は部分木ごと消え、消えたトピックに繋がっていた関係線も一緒に消える。中心トピックは削除できない（ボードを空にしたいときはその子を全部消す）。見つからない id はスキップして理由を返す。',
  inputSchema: {
    boardId: z.string().optional(),
    ids: z.array(z.string().min(1)).min(1),
  },
}, async ({ boardId, ids }) => {
  const board = await loadBoard(boardId);
  const res = removeTopics({ nodes: board.mindmap, relations: board.mindmapRelations, ids });
  if (res.removed.length > 0) {
    await saveBoard(boardId, { mindmap: res.nodes, mindmapRelations: res.relations });
  }
  return ok({ removed: res.removed, errors: res.errors });
});

server.registerTool('mindmap_connect_topics', {
  title: 'トピック間に関係線を張る',
  description: '木の親子とは別に、離れたトピック同士を線でつなぐ。source/target には mindmap_get で得た id を使う。text は線の上に出る一言（例: トレードオフ / 同じ根拠）。自己ループ・重複・不明な id はスキップして理由を返す。',
  inputSchema: {
    boardId: z.string().optional(),
    relations: z.array(z.object({
      source: z.string().min(1),
      target: z.string().min(1),
      text: z.string().optional(),
    })).min(1),
  },
}, async ({ boardId, relations: inputs }) => {
  const board = await loadBoard(boardId);
  const ids = new Set(board.mindmap.map((n) => n.id));
  const resolve = (ref) => (ids.has(ref) ? ref : null);
  const res = addRelations({
    relations: board.mindmapRelations, inputs, resolve,
    now: new Date().toISOString(), newId: rNewId,
  });
  if (res.created.length > 0) await saveBoard(boardId, { mindmapRelations: res.relations });
  return ok({ connected: res.created.map(relationSummary), skipped: res.skipped });
});
```

- [ ] **Step 2: 構文チェックとテスト**

```bash
cd tools/devbacklog-mcp && node --check server.mjs && node --test
```

期待: 構文エラーなし、全テスト pass。

- [ ] **Step 3: README にマインドマップの節を足す**

`tools/devbacklog-mcp/README.md` の末尾に足す。

```markdown
## マインドマップ（Research & Memo の既定ビュー）

Research & Memo の1ボードは、ノードビュー（`items` / `edges`）とマインドマップ
（`mindmap` / `mindmapRelations`）の両方を同じドキュメントに持つ。既定で表示されるのは
マインドマップのほう。

| ツール | 用途 |
|---|---|
| `mindmap_get` | トピックの木と関係線を読む |
| `mindmap_add_topics` | トピックを追加。`parent` に `"#0"` 形式で同じ呼び出し内の添字を指せるので、1回で部分木を組める |
| `mindmap_update_topic` | 本文・補足メモ・リンク・親・折りたたみを更新 |
| `mindmap_remove_topics` | 部分木ごと削除（中心トピックは不可） |
| `mindmap_connect_topics` | 木の親子とは別の横断的な関係線を張る |

木の操作の実体は `mindmap.mjs`（Firestore に依存しない純粋関数）にあり、`node --test`
で検証できる。

意味論はデスクトップアプリの
`src/features/projects/chat/mindmapVerbs.ts`（SEKKEIYA Chat の AI 用 verb）の写しである。
ランタイムが違うためコードは共有していない。**片方を変えたらもう片方も揃えること。**
```

- [ ] **Step 4: verb 側に相互参照コメントを入れる**

`../sekkeiya-desktop/src/features/projects/chat/mindmapVerbs.ts` の冒頭（既存の import 群の直前）に足す。

```ts
// ⚠ ここで定義する意味論には、devbacklog MCP 側に写しがある:
//    sekkeiya/tools/devbacklog-mcp/mindmap.mjs（木の操作）と server.mjs（ツール登録）。
//    rank の採番規則・中心トピックの扱い・削除が部分木ごとである点を変えるときは、
//    両方を揃えて直すこと（ランタイムが違うためコードは共有できない）。
```

- [ ] **Step 5: コミット（2リポジトリに分けて）**

```bash
git add tools/devbacklog-mcp/server.mjs tools/devbacklog-mcp/README.md
git commit -m "feat(mcp): マインドマップの更新・削除・関係線ツールを追加

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

```bash
git -C ../sekkeiya-desktop add src/features/projects/chat/mindmapVerbs.ts
git -C ../sekkeiya-desktop commit -m "docs: mindmapVerbs に devbacklog MCP 側の写しへの相互参照を追加

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**注意**: `sekkeiya-desktop` は別セッションが並行作業している。`git -C ../sekkeiya-desktop status` で現在のブランチを確認し、`main` でなければコミットせずに報告すること。

---

## Task 5: 再起動後の実データ確認

**Files:** なし（検証のみ）

このタスクは **Claude Code を再起動してから**行う。再起動するまで新しい MCP ツールは呼び出せない。

- [ ] **Step 1: ユーザーに Claude Code の再起動を依頼する**

再起動が必要な理由（MCP サーバーはプロセス起動時に読み込まれる）を伝えて待つ。

- [ ] **Step 2: 一覧にマインドマップの件数が出ることを確認する**

`research_list_boards` を呼ぶ。期待: S.Model ボード（`b_ms0xhv90kdt80`）が `topics` に0より大きい値を返す。

- [ ] **Step 3: 木を読めることを確認する**

`mindmap_get` を `boardId: "b_ms0xhv90kdt80"` で呼ぶ。期待: アプリの画面で見えているトピック（S.Model / 要求定義 / 詳細画面 / 全幅ヘッダー / 概要 / 素材 / 置き換え / セット家具 / アニメ / 実在商品 / 同じ作者）と一致する木が返る。`parentId: null` のトピックがちょうど1つあること。

- [ ] **Step 4: 部分木を1回で組めることを確認する**

`mindmap_add_topics` を次の入力で呼ぶ。

```json
{
  "boardId": "b_ms0xhv90kdt80",
  "topics": [
    { "text": "MCP接続テスト" },
    { "text": "子1", "parent": "#0" },
    { "text": "孫1", "parent": "#1" }
  ]
}
```

期待: 3件が追加され、`子1` の `parentId` が `MCP接続テスト` の id、`孫1` の `parentId` が `子1` の id になっている。ユーザーにアプリ側の画面で3階層に表示されることを確認してもらう。

- [ ] **Step 5: 更新できることを確認する**

`mindmap_update_topic` で Step 4 の `孫1` の `text` を `孫1（更新済み）` に変える。ユーザーに画面で反映を確認してもらう。

- [ ] **Step 6: 部分木ごと消えることを確認する**

`mindmap_remove_topics` で `MCP接続テスト` の id だけを渡す。期待: 3件すべてが `removed` に入る。ユーザーに画面から消えたことを確認してもらう。

- [ ] **Step 7: 中心トピックが守られることを確認する**

`mindmap_remove_topics` で `parentId: null` のトピックの id を渡す。期待: `removed` が空で、`errors` に「中心トピックは削除できません」が入る。木が壊れていないことを `mindmap_get` で確認する。

- [ ] **Step 8: 結果を報告する**

各手順の生の結果を報告する。Step 4〜6 で作ったトピックが残っていないことを確認する。

---

## Self-Review

**1. Spec coverage**

| 仕様書の項 | 対応タスク |
|---|---|
| 4.1 追加するツール5つ | Task 3（get / add）、Task 4（update / remove / connect） |
| 4.2 既存2ツールの修正 | Task 2 |
| 4.3 バリデーション（空 text / data: URL / 不明な参照 / 自己ループ / 中心トピック保護） | Task 1（純粋関数とテスト） |
| 5. 実装（loadBoard / saveBoard / ヘルパー） | Task 1・Task 2 |
| 5. 相互参照コメント | Task 1（mindmap.mjs 冒頭）、Task 3（server.mjs）、Task 4（mindmapVerbs.ts） |
| 6. 割り切り（契約の明記） | Global Constraints に規則を転記済み |
| 9. 検証（7項目） | Task 5 の Step 2〜7 |

**2. 仕様書との差異（意図的なもの）**

- 仕様書は「`server.mjs` に追記する」としていたが、木の操作は `mindmap.mjs` に分離した。`server.mjs` は既に953行あり、Firestore と MCP に依存しない純粋関数を混ぜると単体テストができなくなるため。MCP は再起動しないと呼べないので、テストできる形にすることの価値が大きい。
- 仕様書は検証を手動確認としていたが、`node --test`（Node 組み込み、依存追加なし）による単体テストを Task 1 に入れた。

**3. Placeholder scan** — 「TBD」「後で実装」の類は無い。Task 3 Step 5 は「このタスクでは実データ確認を行わない」と明示し、Task 5 へ送っている。

**4. Type consistency** — `addTopics` は `{ nodes, created, errors, batchIds }` を返し、Task 3 の `mindmap_add_topics` が `res.batchIds` を使う（Task 1 の Interfaces 記載を `batchIds` を含む形に合わせてある）。`addRelations` は `{ relations, created, skipped }` を返し、Task 3・4 の両方が同じ形で使う。`updateTopic` は `{ nodes, updated, error }`、`removeTopics` は `{ nodes, relations, removed, errors }` で、いずれも呼び出し側と一致している。
