import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTER_TEXT, ensureCenter, nextRankOf, collectSubtree,
  addTopics, addRelations, updateTopic, removeTopics,
} from './mindmap.mjs';

const NOW = '2026-07-29T00:00:00.000Z';
// テストでは決定的な id を使う（本番は rNewId）。
// ⚠ 1つのテスト内では必ず同じ生成器を使い回すこと。テストごとに作り直すと
//    中心トピックと追加トピックが同じ id になり、木が壊れたまま assert が通ってしまう。
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
  const newId = idGen();
  const { nodes: base } = ensureCenter([], NOW, newId);
  const { nodes, created, errors } = addTopics({
    nodes: base,
    topics: [
      { text: '親' },
      { text: '子', parent: '#0' },
      { text: '孫', parent: '#1' },
    ],
    now: NOW,
    newId,
  });
  assert.deepEqual(errors, []);
  assert.equal(created.length, 3);
  assert.equal(created[1].parentId, created[0].id);
  assert.equal(created[2].parentId, created[1].id);
  assert.equal(nodes.length, 4); // 中心 + 3
  // id が重複していないこと（生成器を使い回している証明でもある）
  assert.equal(new Set(nodes.map((n) => n.id)).size, 4);
});

test('addTopics: parent 省略は中心トピック直下', () => {
  const newId = idGen();
  const { nodes: base, center } = ensureCenter([], NOW, newId);
  const { created } = addTopics({ nodes: base, topics: [{ text: 'x' }], now: NOW, newId });
  assert.equal(created[0].parentId, center.id);
  assert.notEqual(created[0].id, center.id);
});

test('addTopics: text が空、data: URL、存在しない parent は理由つきで弾く', () => {
  const newId = idGen();
  const { nodes: base } = ensureCenter([], NOW, newId);
  const { created, errors } = addTopics({
    nodes: base,
    topics: [
      { text: '   ' },
      { text: 'ok', image: 'data:image/png;base64,AAA' },
      { text: 'ok2', parent: 'nope' },
    ],
    now: NOW,
    newId,
  });
  assert.equal(created.length, 0);
  assert.equal(errors.length, 3);
  assert.match(errors[0], /text/);
  assert.match(errors[1], /data:/);
  assert.match(errors[2], /parent/);
});

test('addTopics: 弾かれたトピックの "#N" は後続から参照できない', () => {
  const newId = idGen();
  const { nodes: base } = ensureCenter([], NOW, newId);
  const { created, errors } = addTopics({
    nodes: base,
    topics: [
      { text: '' },              // #0 は作られない
      { text: '子', parent: '#0' }, // よって解決できない
    ],
    now: NOW,
    newId,
  });
  assert.equal(created.length, 0);
  assert.equal(errors.length, 2);
  assert.match(errors[1], /#0/);
});

test('addTopics: note/link/refType は保存され、undefined は落ちる', () => {
  const newId = idGen();
  const { nodes: base } = ensureCenter([], NOW, newId);
  const { created } = addTopics({
    nodes: base,
    topics: [{ text: 't', note: 'n', link: 'https://e.com', refType: 'article', refId: 'a1', refTitle: 'T' }],
    now: NOW,
    newId,
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

test('updateTopic: 更新内容が無い patch は拒否する', () => {
  const nodes = [
    { id: 'c', parentId: null, rank: 0, text: 'c', createdAt: NOW, updatedAt: NOW },
    { id: 'a', parentId: 'c', rank: 0, text: 'a', createdAt: NOW, updatedAt: NOW },
  ];
  const res = updateTopic({ nodes, id: 'a', patch: {}, now: NOW });
  assert.equal(res.updated, null);
  assert.equal(res.error, '更新内容（text/note/link/parent/collapsed）が必要です');
  // nodes はそのまま返す（書き込みが起きないことの保証）
  assert.equal(res.nodes, nodes);
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
