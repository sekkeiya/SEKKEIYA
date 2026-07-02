const aiPricing = {
  imageTo3D: {
    triposr: 0,
    mock: 100,
    meshy: 100,
    tripo3d: 100
  }
};

// 月次3D生成上限は料金プランの「月次クレジット ÷ 10」から導出する（docs/17・クライアント ai-model-plans.ts と同値）。
// free 30cr→3 / standard 120→12 / premium 200→20 / pro 400→40 / enterprise ∞。
const PLAN_MONTHLY_CREDITS = { free: 30, standard: 120, premium: 200, pro: 400, enterprise: null };
const CREDIT_PER_3D = 10;
function monthly3d(plan) {
  const c = PLAN_MONTHLY_CREDITS[plan];
  return c == null ? Infinity : Math.floor(c / CREDIT_PER_3D);
}

const aiLimits = {};
for (const plan of Object.keys(PLAN_MONTHLY_CREDITS)) {
  aiLimits[plan] = {
    triposr: { daily: Infinity, monthly: Infinity }, // ローカル/廃止予定・原価なし
    tripo3d: { daily: Infinity, monthly: monthly3d(plan) },
    mock: { daily: Infinity, monthly: Infinity },
  };
}

module.exports = { aiPricing, aiLimits, PLAN_MONTHLY_CREDITS };
