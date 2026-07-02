const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * Stripe サブスク(customers/{uid}/subscriptions)の変化を users/{uid}.plan に反映する。
 *
 * - 料金プランの正本は plans コレクション。各 plan doc の stripePriceId から plan id を逆引きする。
 * - アクティブなサブスクが複数あれば最上位プランを採用。無ければ free に戻す。
 * - これが無いと「課金してもプランが付与されない」ため、課金制の根幹（entitlement bridge）。
 *
 * 注意: 既存サブスクには遡って発火しない（トリガーは以後の書込のみ）。
 *       稼働中の契約者がいる状態で導入する場合はワンショットのバックフィルが別途必要。
 */

const PLAN_RANK = { free: 0, standard: 1, premium: 2, pro: 3, enterprise: 4 };
// active/trialing は有効。past_due は支払い遅延だが Stripe の dunning 中なので猶予として維持。
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/** サブスク doc から Stripe price id を取り出す（拡張機能のスキーマ差異に耐性）。 */
function priceIdFromSub(sub) {
  const p = sub.price;
  if (typeof p === "string") return p;
  if (p && p.id) return p.id; // DocumentReference（doc id = price id）
  const item0 = Array.isArray(sub.items) ? sub.items[0] : null;
  const ip = item0 && item0.price;
  if (typeof ip === "string") return ip;
  if (ip && ip.id) return ip.id;
  return null;
}

exports.syncSubscriptionPlan = onDocumentWritten(
  // DB ロケーション(asia-northeast1)と同リージョンにする必要がある
  { document: "customers/{uid}/subscriptions/{subId}", region: "asia-northeast1" },
  async (event) => {
    const { uid } = event.params;
    const db = admin.firestore();

    // 1) price → plan の逆引きマップ（plans コレクションが正本）
    const plansSnap = await db.collection("plans").get();
    const priceToPlan = {};
    plansSnap.forEach((d) => {
      const pid = d.data().stripePriceId;
      if (pid) priceToPlan[pid] = d.id;
    });

    // 2) このユーザーの全サブスクから、アクティブな最上位プランを決定
    const subsSnap = await db.collection(`customers/${uid}/subscriptions`).get();
    let best = "free";
    subsSnap.forEach((s) => {
      const sub = s.data() || {};
      if (!ACTIVE_STATUSES.has(sub.status)) return;
      const plan = priceToPlan[priceIdFromSub(sub)];
      if (plan && (PLAN_RANK[plan] ?? 0) > (PLAN_RANK[best] ?? 0)) best = plan;
    });

    // 3) users/{uid}.plan を更新（変化があるときだけ）
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    const current = userSnap.exists ? userSnap.data().plan || "free" : "free";
    if (current === best) return;

    await userRef.set(
      { plan: best, planUpdatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`[syncSubscriptionPlan] ${uid}: ${current} -> ${best}`);
  }
);
