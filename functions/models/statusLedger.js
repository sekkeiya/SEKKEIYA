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
    const prevSnap = await ledgerRef.get();
    const prev = prevSnap.exists ? prevSnap.data() : null;

    const { patch, changed } = buildLedgerPatch({ before, after, prev });
    if (!changed) return;

    await ledgerRef.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.log(`[statusLedger] ${assetId} -> ${patch.status} (content=${patch.contentRevision}, published=${patch.publishedRevision})`);
  } catch (err) {
    // 台帳は表示用の補助情報なので、失敗してもマスター側の保存は成立している。
    // 握りつぶさずログには残す（再実行はトリガのリトライに任せる）。
    console.error(`[statusLedger] ${assetId} の台帳更新に失敗`, err);
    throw err;
  }
});
