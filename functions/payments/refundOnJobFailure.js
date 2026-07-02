const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { refund } = require("./creditLedger");

/**
 * aiJobs が "failed" に遷移したら、消費したクレジットを返金する。
 *
 * - 全ての失敗経路（provider startJob の即時失敗 / pollJobs の後追い失敗）を
 *   1か所で捕捉できるよう、ジョブ doc の書込トリガで実装する。
 * - 返金額はジョブ生成時に記録した creditFromAllotment / creditFromTopup を使う。
 * - 冪等: creditLedger/refund:{jobId} をマーカー兼監査にし、多重返金を防ぐ。
 * - 期跨ぎの配布分は失効済のため creditLedger.refund が top-up 分のみ戻す。
 */
exports.refundCreditsOnJobFailure = onDocumentWritten(
  { document: "users/{uid}/aiJobs/{jobId}", region: "asia-northeast1" },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || after.status !== "failed") return;
    if (before && before.status === "failed") return; // 既に failed（多重発火）

    const fromAllotment = after.creditFromAllotment || 0;
    const fromTopup = after.creditFromTopup || 0;
    if (fromAllotment <= 0 && fromTopup <= 0) return; // 消費なし（bypass 等）

    const { uid, jobId } = event.params;
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const ledgerRef = userRef.collection("creditLedger").doc(`refund:${jobId}`);

    await db.runTransaction(async (tx) => {
      const [userSnap, ledgerSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(ledgerRef),
      ]);
      if (ledgerSnap.exists) return; // 冪等：返金済み

      const plan = userSnap.exists ? userSnap.data().plan || "free" : "free";
      const credits = userSnap.exists ? userSnap.data().credits || {} : {};
      const storable = refund(plan, credits, fromAllotment, fromTopup);

      tx.set(
        userRef,
        { credits: { ...storable, updatedAt: FieldValue.serverTimestamp() } },
        { merge: true }
      );
      tx.set(ledgerRef, {
        type: "refund",
        jobId,
        fromAllotment,
        fromTopup,
        amount: fromAllotment + fromTopup,
        balanceAfter: {
          monthlyUsed: storable.monthlyUsed,
          topupBalance: storable.topupBalance,
        },
        ts: FieldValue.serverTimestamp(),
      });
    });

    console.log(
      `[refundCreditsOnJobFailure] ${uid}: refunded ${fromAllotment + fromTopup} credits (job ${jobId})`
    );
  }
);
