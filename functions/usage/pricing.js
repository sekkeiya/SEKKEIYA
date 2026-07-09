/**
 * usage/pricing.js — AIトークンのUSD概算単価（100万トークンあたり）。
 *
 * ここで出す costUsd は「概算」。正確な請求額は Anthropic コンソール（将来の方式B）で確認する前提。
 * 値はいつでも編集可。config/aiModels の featureModels で選ぶモデルと対応させること。
 * モデル名は前方一致で解決する（例: "claude-haiku-4-5-20251001" → "claude-haiku-4-5"）。
 */

// 単価は 1,000,000 トークンあたりの USD。
const PRICING = {
  // ── Claude ──
  "claude-opus-4":     { input: 15.0, output: 75.0, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-sonnet-4":   { input: 3.0,  output: 15.0, cacheWrite: 3.75,  cacheRead: 0.30 },
  "claude-haiku-4-5":  { input: 1.0,  output: 5.0,  cacheWrite: 1.25,  cacheRead: 0.10 },
  "claude-3-5-haiku":  { input: 0.80, output: 4.0,  cacheWrite: 1.0,   cacheRead: 0.08 },
  // ── Gemini（キャッシュ書き込み課金は無し扱い）──
  "gemini-2.5-pro":    { input: 1.25, output: 10.0, cacheWrite: 0, cacheRead: 0.31 },
  "gemini-2.5-flash":  { input: 0.30, output: 2.50, cacheWrite: 0, cacheRead: 0.075 },
  "gemini-2.0-flash":  { input: 0.15, output: 0.60, cacheWrite: 0, cacheRead: 0.0375 },
  "gemini-1.5-flash":  { input: 0.15, output: 0.60, cacheWrite: 0, cacheRead: 0.0375 },
  // ── OpenAI ──
  "gpt-4o-mini":       { input: 0.15, output: 0.60, cacheWrite: 0, cacheRead: 0.075 },
  "gpt-4o":            { input: 2.5,  output: 10.0, cacheWrite: 0, cacheRead: 1.25 },
};

// 未知モデルは Sonnet 相当で概算（過小評価を避け、上振れ側に倒す）。
const DEFAULT_RATE = { input: 3.0, output: 15.0, cacheWrite: 3.75, cacheRead: 0.30 };

/** モデル名から単価を前方一致で解決（最長一致優先）。 */
function rateForModel(model) {
  const key = String(model || "").toLowerCase();
  let best = null;
  for (const prefix of Object.keys(PRICING)) {
    if (key.startsWith(prefix) && (!best || prefix.length > best.length)) best = prefix;
  }
  return best ? PRICING[best] : DEFAULT_RATE;
}

/**
 * 正規化済み usage（inputTokens/outputTokens/cacheReadTokens/cacheCreationTokens）から
 * USD 概算コストを算出する。Anthropic では input_tokens はキャッシュ分を含まないため、
 * cacheRead / cacheWrite を別レートで加算する。
 */
function estimateCostUsd(model, n) {
  const r = rateForModel(model);
  const M = 1_000_000;
  const input = n.inputTokens || 0;
  const output = n.outputTokens || 0;
  const cacheRead = n.cacheReadTokens || 0;
  const cacheWrite = n.cacheCreationTokens || 0;
  return (
    input * r.input +
    output * r.output +
    cacheRead * r.cacheRead +
    cacheWrite * r.cacheWrite
  ) / M;
}

module.exports = { PRICING, DEFAULT_RATE, rateForModel, estimateCostUsd };
