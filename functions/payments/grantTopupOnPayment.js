const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Stripe 拡張機能が customers/{uid}/payments/{paymentId} に成功決済(PaymentIntent)を書いたら、
 * metadata.kind === "topup" の場合に users/{uid}.credits.topupBalance へクレジットを付与する。
 *
 * - top-up（追加クレジット購入）は都度払い(mode:"payment")。クライアントは metadata に
 *   { kind:"topup", credits:"<数>" } を載せて checkout_session を作る（寄付と同じ経路）。
 * - 冪等: creditLedger/topup:{paymentId} をマーカー兼監査に使い、二重付与を防ぐ
 *   （processing→succeeded の再発火や Webhook 再送に耐える）。
 */
exports.grantTopupOnPayment = onDocumentWritten(
  { document: "customers/{uid}/payments/{paymentId}", region: "asia-northeast1" },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after || after.status !== "succeeded") return;

    const md = after.metadata || {};
    if (md.kind !== "topup") return;

    const credits = parseInt(md.credits, 10);
    if (!Number.isFinite(credits) || credits <= 0) return;

    const { uid, paymentId } = event.params;
    const db = admin.firestore();
    const userRef = db.doc(`users/${uid}`);
    const ledgerRef = userRef.collection("creditLedger").doc(`topup:${paymentId}`);

    await db.runTransaction(async (tx) => {
      const [userSnap, ledgerSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(ledgerRef),
      ]);
      if (ledgerSnap.exists) return; // 冪等：付与済み

      const c = userSnap.exists ? userSnap.data().credits || {} : {};
      const topupBalance = (c.topupBalance || 0) + credits;

      tx.set(
        userRef,
        { credits: { ...c, topupBalance, updatedAt: FieldValue.serverTimestamp() } },
        { merge: true }
      );
      tx.set(ledgerRef, {
        type: "topup",
        credits,
        paymentId,
        amount: typeof after.amount === "number" ? after.amount : null,
        currency: after.currency || "jpy",
        balanceAfter: { topupBalance },
        ts: FieldValue.serverTimestamp(),
      });
    });

    console.log(`[grantTopupOnPayment] ${uid}: +${credits} credits (payment ${paymentId})`);
  }
);
