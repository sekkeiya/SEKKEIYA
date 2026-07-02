/**
 * SEKKEIYA AIクレジット台帳（サーバ正本）。docs/17 / docs/18。
 *
 * すべてのクラウドAIコスト操作は、この単一の月次クレジット残高から消費する。
 *   - users/{uid}.credits = { planId, period, monthlyAllotment, monthlyused, topupBalance }
 *   - 月次配布分は period が変わるとリセット。top-up 残高は繰越。
 *   - 消費順は「配布分 → top-up」（配布分は月末に失効するため先に使う）。
 *
 * ⚠️ CREDIT_COST / PLAN_MONTHLY_CREDITS はクライアント src/features/billing/creditModel.ts と同値に保つ。
 */

const CREDIT_COST = {
  model3d: 10, // 画像→3D化 (Tripo, $0.30/個 が原価基準)
  imageRender: 2, // クラウド画像レンダ (nanobanana / Gemini)
  image: 1, // 汎用AI画像生成
  chatTurn: 1, // Chat オーケストレーター
};

// 月次付与クレジット。null = カスタム/無制限（enterprise）。
const PLAN_MONTHLY_CREDITS = { free: 30, standard: 120, premium: 200, pro: 400, enterprise: null };

/** JST の 'YYYY-MM'（月次リフィルの境界）。 */
function currentPeriodJst(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 既存 credits を当期に正規化（月次リフィル＋プラン追従）。純関数。
 * monthlyAllotment は無制限を Infinity で返す（内部計算用。保存時は toStorable で null 化）。
 */
function normalize(plan, credits, now = new Date()) {
  const period = currentPeriodJst(now);
  const allot = PLAN_MONTHLY_CREDITS[plan];
  const monthlyAllotment = allot == null ? Infinity : allot;
  const prev = credits || {};
  const samePeriod = prev.period === period;
  return {
    planId: plan,
    period,
    monthlyAllotment,
    monthlyUsed: samePeriod ? prev.monthlyUsed || 0 : 0, // 期が変われば配布分リセット
    topupBalance: prev.topupBalance || 0, // top-up は常に繰越
  };
}

/** 利用可能残高（無制限は Infinity）。 */
function remaining(c) {
  if (c.monthlyAllotment === Infinity) return Infinity;
  return Math.max(0, c.monthlyAllotment - c.monthlyUsed) + c.topupBalance;
}

/** Firestore 保存用（Infinity は保存不可 → null）。 */
function toStorable(c) {
  return {
    planId: c.planId,
    period: c.period,
    monthlyAllotment: c.monthlyAllotment === Infinity ? null : c.monthlyAllotment,
    monthlyUsed: c.monthlyUsed,
    topupBalance: c.topupBalance,
  };
}

/**
 * cost クレジットを消費した後の残高を計算する（純関数・トランザクション内で使う）。
 * 足りなければ Error('INSUFFICIENT_CREDITS') を throw（e.remaining に残高）。
 * @returns {{ storable, fromAllotment, fromTopup }}
 */
function consume(plan, credits, cost, now = new Date()) {
  const c = normalize(plan, credits, now);
  const unlimited = c.monthlyAllotment === Infinity;
  if (!unlimited && remaining(c) < cost) {
    const e = new Error("INSUFFICIENT_CREDITS");
    e.remaining = remaining(c);
    throw e;
  }
  // 配布分を先に使い切る → 不足分を top-up から。
  const fromAllotment = unlimited
    ? cost
    : Math.min(cost, Math.max(0, c.monthlyAllotment - c.monthlyUsed));
  const fromTopup = cost - fromAllotment;
  const after = {
    ...c,
    monthlyUsed: c.monthlyUsed + fromAllotment,
    topupBalance: c.topupBalance - fromTopup,
  };
  return { storable: toStorable(after), fromAllotment, fromTopup };
}

/**
 * cost クレジットを払い戻した後の残高（失敗時の返金・純関数）。
 * 同一期なら配布分を戻す。期跨ぎは配布分失効済のため top-up 分のみ戻す。
 */
function refund(plan, credits, fromAllotment, fromTopup, now = new Date()) {
  const c = normalize(plan, credits, now);
  const monthlyUsed = Math.max(0, c.monthlyUsed - (fromAllotment || 0));
  const topupBalance = c.topupBalance + (fromTopup || 0);
  return toStorable({ ...c, monthlyUsed, topupBalance });
}

module.exports = {
  CREDIT_COST,
  PLAN_MONTHLY_CREDITS,
  currentPeriodJst,
  normalize,
  remaining,
  toStorable,
  consume,
  refund,
};
