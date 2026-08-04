"use strict";

/**
 * 公開ステータス台帳（modelStatus/{assetId}）に何を書くかの判断。
 *
 * ここは外部依存を持たない純粋関数だけを置く（Firestore にも firebase-admin にも触らない）。
 * トリガ本体（statusLedger.js）は読み書きだけを担当する。
 *
 * 設計上の要点:
 *  - 台帳に載せてよいのは **公開して差し支えない情報だけ**。Firestore はフィールド単位の
 *    read 制限ができないため、載せた時点で全ユーザーに公開される。価格・購入先リンク・
 *    実在商品・素材構成などは絶対に載せない。
 *  - トリガは assets を監視しているので、assets へ書き戻すと自己再帰する。よって台帳だけを
 *    書く。公開要求（assets.publishRequest）もクライアントが上書きするだけで CF は消さず、
 *    lastPublishRequestAt で処理済みかどうかを判定する。
 */

/** contentRevision を上げる対象にしないフィールド（記帳・派生値）。 */
const BOOKKEEPING_FIELDS = new Set([
  "publishRequest",
  "updatedAt",
  "createdAt",
  "lastAccessedAt",
  "viewCount",
  "likeCount",
  "downloadCount",
  // visibility は resolveStatus() を通じて patch.status に反映済み。
  // ここでも contentRevision の対象にすると、公開/非公開の切り替えだけで
  // 「未公開の変更があります」が誤表示されてしまう。
  "visibility",
]);

/** 台帳に書き出すキー（ここに無いものは絶対に台帳へ出さない）。 */
const LEDGER_FIELDS = [
  "status",
  "title",
  "thumbnailUrl",
  "successorModelId",
  "contentRevision",
  "publishedRevision",
  "publishedNote",
  "publishedAt",
  "lastPublishRequestAt",
  "dimensionsRev",
];

/** Firestore Timestamp / ISO 文字列 / 数値 / null を ms に正規化する。比較のためだけに使う。 */
function toMillis(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/**
 * 台帳の status。マスターの状態から機械的に決まる。
 * visibility が未設定なら「公開していない」とみなす（誤って公開扱いにしない）。
 */
function resolveStatus(after) {
  if (!after) return "deleted";
  return after.visibility === "public" ? "active" : "withdrawn";
}

/**
 * Firestore Timestamp「らしい」値か。生の数値・文字列は対象外（他フィールドの誤判定を防ぐため、
 * ここでは Timestamp インスタンスや `{seconds/_seconds, nanoseconds/_nanoseconds}` 形の
 * オブジェクトだけを対象にする）。
 */
function isTimestampLike(v) {
  if (v === null || typeof v !== "object") return false;
  if (typeof v.toMillis === "function") return true;
  if (typeof v._seconds === "number") return true;
  if (typeof v.seconds === "number") return true;
  return false;
}

/**
 * 深い等価比較。undefined と null は同じものとして扱う（Firestore は undefined を保存しない）。
 *
 * JSON.stringify での比較にしないこと。**キーの順序が違うだけで「変わった」と誤判定する**ため。
 * Firestore のスナップショットはフィールドを追加・削除するとキー順が変わりうるので、順序に
 * 依存すると contentRevision が無意味に上がり、「未公開の変更があります」が誤表示される。
 *
 * publishedAt / lastPublishRequestAt のようなタイムスタンプ系フィールドは、書き込み経路
 * （クライアント SDK の serverTimestamp() が解決された値 / 台帳への再書き込み / 将来の
 * 移行スクリプトなど）によって Timestamp インスタンス・`{seconds,nanoseconds}` 形・ISO 文字列・
 * ms 数値が混在しうる。どちらか一方でも Timestamp らしい形をしていれば、両辺を toMillis() で
 * 正規化してから比較する（表現形式が違うだけで「変わった」と誤判定しないため）。
 */
function sameValue(a, b) {
  const x = a === undefined ? null : a;
  const y = b === undefined ? null : b;
  if (x === y) return true;
  if (x === null || y === null) return false;
  if (isTimestampLike(x) || isTimestampLike(y)) {
    return toMillis(x) === toMillis(y);
  }
  if (typeof x !== "object" || typeof y !== "object") return false;
  if (Array.isArray(x) !== Array.isArray(y)) return false;
  if (Array.isArray(x)) {
    if (x.length !== y.length) return false;
    return x.every((v, i) => sameValue(v, y[i]));
  }
  const kx = Object.keys(x);
  const ky = Object.keys(y);
  if (kx.length !== ky.length) return false;
  return kx.every((k) => Object.prototype.hasOwnProperty.call(y, k) && sameValue(x[k], y[k]));
}

/** 記帳フィールドを除いて中身が変わったか。削除は「変更なし」（status で表すため）。 */
function hasContentChange(before, after) {
  if (!after) return false;
  if (!before) return true;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (BOOKKEEPING_FIELDS.has(key)) continue;
    if (!sameValue(before[key], after[key])) return true;
  }
  return false;
}

/** dimensions だけを見る。セット家具の追従通知（dimensionsRev）に使う。 */
function hasDimensionsChange(before, after) {
  if (!after) return false;
  if (!before) return true;
  return !sameValue(before.dimensions, after.dimensions);
}

/**
 * 台帳へ書く内容を組み立てる。
 * @param {object|null} before 変更前の assets ドキュメント
 * @param {object|null} after  変更後の assets ドキュメント（削除なら null）
 * @param {object|null} prev   現在の台帳ドキュメント
 * @returns {{patch: object, changed: boolean}} changed が false なら書き込み自体を行わない
 */
function buildLedgerPatch({ before, after, prev }) {
  const base = prev || {};
  const source = after || before || {};

  const status = resolveStatus(after);
  const contentRevision = (Number(base.contentRevision) || 0) + (hasContentChange(before, after) ? 1 : 0);
  const dimensionsRev = (Number(base.dimensionsRev) || 0) + (hasDimensionsChange(before, after) ? 1 : 0);

  let publishedRevision = Number(base.publishedRevision) || 0;
  let publishedNote = base.publishedNote === undefined ? null : base.publishedNote;
  let publishedAt = base.publishedAt === undefined ? null : base.publishedAt;
  let lastPublishRequestAt = base.lastPublishRequestAt === undefined ? null : base.lastPublishRequestAt;

  // 公開要求。CF は assets を書き換えられない（自己再帰するため）ので、要求は消さずに
  // 「いつの要求まで処理したか」で冪等性を担保する。
  const requestAt = toMillis(after && after.publishRequest && after.publishRequest.at);
  if (requestAt > 0 && requestAt > toMillis(lastPublishRequestAt)) {
    publishedRevision = contentRevision;
    publishedNote = (after.publishRequest.note === undefined ? null : after.publishRequest.note);
    publishedAt = after.publishRequest.at;
    lastPublishRequestAt = after.publishRequest.at;
  }

  const patch = {
    status,
    title: source.title === undefined ? (base.title === undefined ? null : base.title) : source.title,
    thumbnailUrl:
      source.thumbnailUrl === undefined
        ? (base.thumbnailUrl === undefined ? null : base.thumbnailUrl)
        : source.thumbnailUrl,
    successorModelId:
      source.successorModelId === undefined
        ? (base.successorModelId === undefined ? null : base.successorModelId)
        : source.successorModelId,
    contentRevision,
    publishedRevision,
    publishedNote,
    publishedAt,
    lastPublishRequestAt,
    dimensionsRev,
  };

  // 既存の台帳と同じ内容なら書かない（無駄な書き込みと更新イベントを避ける）。
  const changed = LEDGER_FIELDS.some((key) => !sameValue(base[key], patch[key]));
  return { patch, changed };
}

module.exports = {
  toMillis,
  resolveStatus,
  hasContentChange,
  hasDimensionsChange,
  buildLedgerPatch,
  BOOKKEEPING_FIELDS,
  LEDGER_FIELDS,
};
