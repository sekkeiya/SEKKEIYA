"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  toMillis,
  resolveStatus,
  hasContentChange,
  hasDimensionsChange,
  buildLedgerPatch,
} = require("./statusLedgerRules");

test("toMillis: Timestamp / ISO / 数値 / 空を ms に正規化する", () => {
  assert.equal(toMillis(null), 0);
  assert.equal(toMillis(undefined), 0);
  assert.equal(toMillis(1754200000000), 1754200000000);
  assert.equal(toMillis({ toMillis: () => 1754200000000 }), 1754200000000);
  assert.equal(toMillis({ _seconds: 1754200000, _nanoseconds: 0 }), 1754200000000);
  assert.equal(toMillis("2026-08-03T00:00:00.000Z"), Date.parse("2026-08-03T00:00:00.000Z"));
});

test("resolveStatus: 削除は deleted / 非公開は withdrawn / 公開は active", () => {
  assert.equal(resolveStatus(null), "deleted");
  assert.equal(resolveStatus({ visibility: "public" }), "active");
  assert.equal(resolveStatus({ visibility: "private" }), "withdrawn");
  // visibility 未設定は「公開していない」とみなす（誤って公開扱いにしない）
  assert.equal(resolveStatus({}), "withdrawn");
});

test("hasContentChange: 記帳フィールドだけの変化では真にならない", () => {
  const base = { title: "机", dimensions: { width: 1000 } };
  assert.equal(hasContentChange(base, { ...base }), false);
  // publishRequest は公開操作の記録であって中身の変更ではない
  assert.equal(
    hasContentChange(base, { ...base, publishRequest: { note: "初版", at: 1 } }),
    false,
  );
  assert.equal(hasContentChange(base, { ...base, updatedAt: 12345 }), false);
});

test("hasContentChange: タイムスタンプ系は表現形式が違っても同じ時刻なら変更とみなさない", () => {
  // トリガが読む prev（Firestore Timestamp / {_seconds,_nanoseconds}）と
  // クライアントが書く値の型が実運用で揃わない可能性への保険。
  const seconds = { publishedAt: { _seconds: 100, _nanoseconds: 0 } };
  const ms = { publishedAt: 100000 };
  const timestampLike = { publishedAt: { toMillis: () => 100000 } };
  assert.equal(hasContentChange(seconds, ms), false);
  assert.equal(hasContentChange(seconds, timestampLike), false);
  assert.equal(hasContentChange(ms, timestampLike), false);
  // 表現形式が違うだけでなく実際に時刻が異なれば、引き続き変更とみなす
  assert.equal(hasContentChange(seconds, { publishedAt: 999999 }), true);
});

test("hasContentChange: 中身が変われば真", () => {
  const base = { title: "机", dimensions: { width: 1000 } };
  assert.equal(hasContentChange(base, { ...base, title: "机（改）" }), true);
  assert.equal(hasContentChange(base, { ...base, dimensions: { width: 1200 } }), true);
  // フィールドが増えた / 消えた場合も変更
  assert.equal(hasContentChange(base, { ...base, price: 100 }), true);
  assert.equal(hasContentChange({ ...base, price: 100 }, base), true);
});

test("hasContentChange: キーの順序が違うだけでは変更とみなさない", () => {
  // Firestore のスナップショットはフィールドの追加・削除でキー順が変わりうる。
  // 順序に依存すると contentRevision が無意味に上がり「未公開の変更があります」が誤表示される。
  const before = { title: "机", dimensions: { width: 1000, depth: 600 } };
  const after = { dimensions: { depth: 600, width: 1000 }, title: "机" };
  assert.equal(hasContentChange(before, after), false);
});

test("hasContentChange: undefined と null は同じものとして扱う（Firestore は undefined を保存しない）", () => {
  assert.equal(hasContentChange({ title: "机", note: null }, { title: "机" }), false);
});

test("hasContentChange: 新規作成は真、削除は偽（削除は status で表す）", () => {
  assert.equal(hasContentChange(null, { title: "机" }), true);
  assert.equal(hasContentChange({ title: "机" }, null), false);
});

test("hasDimensionsChange: dimensions だけを見る", () => {
  assert.equal(hasDimensionsChange({ dimensions: { width: 1 } }, { dimensions: { width: 1 } }), false);
  assert.equal(hasDimensionsChange({ dimensions: { width: 1 } }, { dimensions: { width: 2 } }), true);
  assert.equal(hasDimensionsChange({ title: "a" }, { title: "b" }), false);
  assert.equal(hasDimensionsChange(null, { dimensions: { width: 1 } }), true);
  assert.equal(hasDimensionsChange({ dimensions: { width: 1 } }, null), false);
});

test("buildLedgerPatch: 新規作成で台帳を作る", () => {
  const { patch, changed } = buildLedgerPatch({
    before: null,
    after: { title: "机", thumbnailUrl: "t.jpg", visibility: "public", dimensions: { width: 1000 } },
    prev: null,
  });
  assert.equal(changed, true);
  assert.equal(patch.status, "active");
  assert.equal(patch.title, "机");
  assert.equal(patch.thumbnailUrl, "t.jpg");
  assert.equal(patch.successorModelId, null);
  assert.equal(patch.contentRevision, 1);
  assert.equal(patch.dimensionsRev, 1);
  // 公開要求が無いので未公開
  assert.equal(patch.publishedRevision, 0);
});

test("buildLedgerPatch: 中身の変更で contentRevision が上がるが publishedRevision は据え置き", () => {
  const prev = { status: "active", contentRevision: 3, publishedRevision: 3, dimensionsRev: 2 };
  const { patch, changed } = buildLedgerPatch({
    before: { title: "机", visibility: "public" },
    after: { title: "机（改）", visibility: "public" },
    prev,
  });
  assert.equal(changed, true);
  assert.equal(patch.contentRevision, 4);
  assert.equal(patch.publishedRevision, 3);
  assert.equal(patch.dimensionsRev, 2);
});

test("buildLedgerPatch: 公開要求を処理すると publishedRevision が contentRevision に追いつく", () => {
  const prev = { status: "active", contentRevision: 4, publishedRevision: 3, dimensionsRev: 2, lastPublishRequestAt: null };
  const { patch, changed } = buildLedgerPatch({
    before: { title: "机（改）", visibility: "public" },
    after: { title: "机（改）", visibility: "public", publishRequest: { note: "座面高を修正", at: 1754200000000 } },
    prev,
  });
  assert.equal(changed, true);
  // publishRequest だけの変化なので contentRevision は据え置き
  assert.equal(patch.contentRevision, 4);
  assert.equal(patch.publishedRevision, 4);
  assert.equal(patch.publishedNote, "座面高を修正");
  assert.equal(toMillis(patch.publishedAt), 1754200000000);
  assert.equal(toMillis(patch.lastPublishRequestAt), 1754200000000);
});

test("buildLedgerPatch: 処理済みの公開要求は二度処理しない（冪等）", () => {
  const after = { title: "机", visibility: "public", publishRequest: { note: "初版", at: 1754200000000 } };
  // 実際の台帳は全フィールドが揃っている。揃っていないと差分が出て changed が真になるため、
  // 冪等性を見るテストでは完全な台帳を渡す。
  const prev = {
    status: "active",
    title: "机",
    thumbnailUrl: null,
    successorModelId: null,
    contentRevision: 4,
    publishedRevision: 4,
    publishedNote: "初版",
    publishedAt: 1754200000000,
    lastPublishRequestAt: 1754200000000,
    dimensionsRev: 2,
  };
  const { changed } = buildLedgerPatch({ before: after, after, prev });
  // 中身も変わらず公開要求も処理済み → 書くことが無い
  assert.equal(changed, false);
});

test("buildLedgerPatch: 削除は status を deleted にし、表示用の値は直前のもので残す", () => {
  const prev = { status: "active", title: "机", contentRevision: 4, publishedRevision: 4, dimensionsRev: 2 };
  const { patch, changed } = buildLedgerPatch({
    before: { title: "机", thumbnailUrl: "t.jpg", visibility: "public" },
    after: null,
    prev,
  });
  assert.equal(changed, true);
  assert.equal(patch.status, "deleted");
  assert.equal(patch.title, "机");
  assert.equal(patch.thumbnailUrl, "t.jpg");
  // 削除でカウンタは動かさない
  assert.equal(patch.contentRevision, 4);
  assert.equal(patch.publishedRevision, 4);
});

test("buildLedgerPatch: 非公開化は withdrawn になり、カウンタは動かない", () => {
  const prev = { status: "active", contentRevision: 4, publishedRevision: 4, dimensionsRev: 2 };
  const { patch, changed } = buildLedgerPatch({
    before: { title: "机", visibility: "public" },
    after: { title: "机", visibility: "private" },
    prev,
  });
  assert.equal(changed, true);
  assert.equal(patch.status, "withdrawn");
  assert.equal(patch.contentRevision, 4);
});

test("buildLedgerPatch: 台帳に載せてよい値だけを返す（価格や購入先を含めない）", () => {
  const { patch } = buildLedgerPatch({
    before: null,
    after: {
      title: "机", visibility: "public", price: 98000,
      catalogLinks: [{ url: "https://example.com" }],
      relatedLinks: [{ url: "https://example.com" }],
      materials: ["木材"], extendedMetadata: { secret: 1 },
    },
    prev: null,
  });
  const allowed = [
    "status", "title", "thumbnailUrl", "successorModelId",
    "contentRevision", "publishedRevision", "publishedNote", "publishedAt",
    "lastPublishRequestAt", "dimensionsRev",
  ];
  assert.deepEqual(Object.keys(patch).sort(), [...allowed].sort());
});

test("buildLedgerPatch: successorModelId は assets 側の値をそのまま映す", () => {
  const { patch } = buildLedgerPatch({
    before: { title: "机", visibility: "private" },
    after: { title: "机", visibility: "private", successorModelId: "master2" },
    prev: { status: "withdrawn", contentRevision: 1, publishedRevision: 1, dimensionsRev: 1 },
  });
  assert.equal(patch.successorModelId, "master2");
});
