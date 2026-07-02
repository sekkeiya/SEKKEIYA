/**
 * AI Render pricing & plan limits.
 * Mirrors functions/ai3d/pricing.js shape so the same usage tracker patterns apply.
 */

const renderPricing = {
  // tokens deducted from aiWallet per call
  imageRender: {
    nanobanana: 20,
    mock: 0,
  },
};

// クラウド画像レンダ(nanobanana=Gemini)は原価が小さいので 3D より寛大な月次上限。
// 5層すべてに定義（standard/premium が undefined だとレンダも弾かれるため）。
const NANOBANANA_MONTHLY = { free: 30, standard: 100, premium: 200, pro: 300, enterprise: Infinity };
const renderLimits = {};
for (const plan of Object.keys(NANOBANANA_MONTHLY)) {
  renderLimits[plan] = {
    nanobanana: { daily: plan === "free" ? 5 : Infinity, monthly: NANOBANANA_MONTHLY[plan] },
    mock: { daily: Infinity, monthly: Infinity },
  };
}

module.exports = { renderPricing, renderLimits };
