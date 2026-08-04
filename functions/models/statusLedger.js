"use strict";
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { buildLedgerPatch } = require("./statusLedgerRules");

/**
 * assets/{assetId} の変更を監視し、公開ステータス台帳 modelStatus/{assetId} を保守する。
 *
 * 台帳は「非公開化・削除・改訂を利用側（プロジェクトへ複製したユーザー）へ伝える」ための
 * 公開情報だけを持つ。仕様は sekkeiya-desktop/docs/superpowers/specs/
 * 2026-08-03-model-ownership-propagation-design.md を参照。
 *
 * ⚠ このトリガは **assets へ書き戻さないこと**。自分が監視しているコレクションへ書くと
 * 自己再帰し、無限ループと課金事故になる。書いてよいのは modelStatus だけ。
 */
exports.onAssetWrittenSyncStatus = onDocumentWritten("assets/{assetId}", async (event) => {
  const assetId = event.params.assetId;
  const beforeSnap = event.data && event.data.before;
  const afterSnap = event.data && event.data.after;
  const before = beforeSnap && beforeSnap.exists ? beforeSnap.data() : null;
  const after = afterSnap && afterSnap.exists ? afterSnap.data() : null;
  if (!before && !after) return;

  const ledgerRef = admin.firestore().doc(`modelStatus/${assetId}`);

  try {
    // ⚠ この read → set はトランザクションではない。Firestore トリガは at-least-once なので、
    // 同一イベントの重複配信や並行更新（例: 同じ assetId への立て続けの書き込み）が起きると
    // contentRevision / dimensionsRev がずれうる。影響はオーナー向けの「未公開の変更が
    // あります」表示が誤るだけに留まるため許容している。厳密にするなら runTransaction にする。
    const prevSnap = await ledgerRef.get();
    const prev = prevSnap.exists ? prevSnap.data() : null;

    const { patch, changed } = buildLedgerPatch({ before, after, prev });
    if (!changed) return;

    await ledgerRef.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log(`[statusLedger] ${assetId} -> ${patch.status} (content=${patch.contentRevision}, published=${patch.publishedRevision})`);
  } catch (err) {
    // 台帳は表示用の補助情報なので、失敗してもマスター側の保存は成立している。
    // 握りつぶさずログには残す。firebase-functions v2 の Firestore トリガは既定で
    // retry: false なので、throw してもこのイベントは再試行されない。retry: true にすると
    // 同じイベントで contentRevision が二重に加算される（+1 のみで冪等ではないため）ので
    // 有効にしないこと。
    console.error(`[statusLedger] ${assetId} の台帳更新に失敗`, err);
    throw err;
  }
});
