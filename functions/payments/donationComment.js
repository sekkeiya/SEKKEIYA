const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Stripe 拡張機能が customers/{uid}/payments/{paymentId} に決済記録(PaymentIntent)を
 * 書き込んだら、寄付(metadata.kind === "donation")かつコメント付きの成功決済のみ、
 * 公開用 donationComments/{paymentId} へ転記する（承認待ち approved:false）。
 *
 * - 決済を経由したサーバ検証済みコメントだけを公開対象にするための要。
 * - doc ID を paymentId にして冪等化（processing→succeeded の再発火や承認済みを壊さない）。
 */
exports.onPaymentWrittenMirrorDonation = onDocumentWritten(
  // DB ロケーション(asia-northeast1)と同リージョンにする必要がある
  { document: "customers/{uid}/payments/{paymentId}", region: "asia-northeast1" },
  async (event) => {
    const after = event.data?.after?.data();
    if (!after) return; // 削除時は何もしない

    if (after.status !== "succeeded") return;

    const metadata = after.metadata || {};
    if (metadata.kind !== "donation") return;

    const comment = String(metadata.donationComment || "").trim();
    if (!comment) return; // コメント無しの寄付は表示対象外

    const { uid, paymentId } = event.params;
    const db = admin.firestore();
    const ref = db.collection("donationComments").doc(paymentId);

    // 既にあれば（管理者の承認状態を壊さないため）何もしない
    const existing = await ref.get();
    if (existing.exists) return;

    await ref.set({
      uid,
      paymentId,
      name: String(metadata.donorName || "").slice(0, 60),
      comment: comment.slice(0, 500),
      amount: typeof after.amount === "number" ? after.amount : null,
      currency: after.currency || "jpy",
      showAmount: metadata.showAmount !== "false",
      approved: false, // 管理者が承認したら true（公開）
      source: "stripe",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
);
