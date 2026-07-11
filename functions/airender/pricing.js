/**
 * AI Render pricing & plan limits.
 * Mirrors functions/ai3d/pricing.js shape so the same usage tracker patterns apply.
 */

const renderPricing = {
  // tokens deducted from aiWallet per call
  imageRender: {
    nanobanana: 20,
    // fal.ai FLUX.1 [schnell]: 高速・低原価（$0.003/MP 程度）なので安価に設定
    "flux-schnell": 5,
    // fal.ai FLUX.1 [dev] + 公式LoRA: dev + LoRA で schnell より少し原価高
    "flux-lora": 8,
    mock: 0,
  },
};

// クラウド画像レンダ(nanobanana=Gemini)は原価が小さいので 3D より寛大な月次上限。
// 5層すべてに定義（standard/premium が undefined だとレンダも弾かれるため）。
const NANOBANANA_MONTHLY = { free: 30, standard: 100, premium: 200, pro: 300, enterprise: Infinity };
// flux-schnell はさらに低原価なので上限も寛大に。
const FLUX_MONTHLY = { free: 50, standard: 200, premium: 400, pro: 600, enterprise: Infinity };
// flux-lora（公式LoRA・FLUX dev）は schnell より原価が高いので上限は中間。
const FLUX_LORA_MONTHLY = { free: 20, standard: 120, premium: 300, pro: 500, enterprise: Infinity };
const renderLimits = {};
for (const plan of Object.keys(NANOBANANA_MONTHLY)) {
  renderLimits[plan] = {
    nanobanana: { daily: plan === "free" ? 5 : Infinity, monthly: NANOBANANA_MONTHLY[plan] },
    "flux-schnell": { daily: plan === "free" ? 10 : Infinity, monthly: FLUX_MONTHLY[plan] },
    "flux-lora": { daily: plan === "free" ? 5 : Infinity, monthly: FLUX_LORA_MONTHLY[plan] },
    mock: { daily: Infinity, monthly: Infinity },
  };
}

// 管理者APIモニター(usageLogs/usageDaily)用の概算原価（USD/枚）とラベル。
// nanobanana: Gemini 2.5 Flash Image 出力 1290tok × $30/1M ≈ $0.039
// flux-schnell: fal.ai $0.003/MP（1MP前提）/ flux-lora: fal.ai flux-lora $0.035/MP
const renderUsageMeta = {
  nanobanana: { costUsd: 0.039, provider: "gemini", model: "gemini-2.5-flash-image" },
  "flux-schnell": { costUsd: 0.003, provider: "fal", model: "flux-1-schnell" },
  "flux-lora": { costUsd: 0.035, provider: "fal", model: "flux-1-dev-lora" },
  mock: { costUsd: 0, provider: "mock", model: "mock" },
};

module.exports = { renderPricing, renderLimits, renderUsageMeta };
