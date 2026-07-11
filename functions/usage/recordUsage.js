/**
 * usage/recordUsage.js — AI呼び出し1回分のトークン使用量・概算コストを記録する。
 *
 * 方式A（自前トラッキング）の心臓部。管理者APIモニターの表示元になる。
 *   - 生ログ  : usageLogs/{autoId}   … 1呼び出し=1ドキュメント
 *   - 日次集計: usageDaily/{YYYY-MM-DD} … 機能別/モデル別カウンタ（表示を軽く速く）
 *
 * 重要: これは fire-and-forget。記録の失敗でチャット/生成本体を絶対に巻き込まない
 *       （呼び出し側は `void recordUsage(...)` で待たずに使う）。
 */
const admin = require("firebase-admin");
const { estimateCostUsd } = require("./pricing");

/** プロバイダ間で異なる usage キーを正規化する。 */
function normalizeUsage(u) {
  if (!u) return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  const inputTokens =
    u.inputTokens ?? u.input_tokens ?? u.promptTokens ?? u.prompt_tokens ?? 0;
  const outputTokens =
    u.outputTokens ?? u.output_tokens ?? u.completionTokens ?? u.completion_tokens ?? 0;
  const cacheReadTokens = u.cacheReadTokens ?? u.cache_read_input_tokens ?? 0;
  const cacheCreationTokens = u.cacheCreationTokens ?? u.cache_creation_input_tokens ?? 0;
  return {
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
    cacheReadTokens: Number(cacheReadTokens) || 0,
    cacheCreationTokens: Number(cacheCreationTokens) || 0,
  };
}

/** JST の { day:'YYYY-MM-DD', month:'YYYY-MM' } を返す。 */
function jstDateParts(d = new Date()) {
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const day = jst.toISOString().slice(0, 10);
  return { day, month: day.slice(0, 7) };
}

/** Firestore のマップキーに使えない文字を除去する。 */
function safeKey(s) {
  return String(s || "unknown").replace(/[.#$/\[\]]/g, "_");
}

/**
 * 使用量を記録する。
 * @param {object} p
 * @param {string|null} p.uid
 * @param {string|null} p.email
 * @param {string} p.feature   例: 'chat' | 'chat-suggest' | 'site-narration' | 'image-render' | '3d-model'
 * @param {string|null} p.provider  'anthropic' | 'gemini' | 'openai' | 'fal' | 'tripo'
 * @param {string|null} p.model
 * @param {object} [p.usage]   生 usage（snake/camel どちらでも可）。画像/3Dなどトークンの無い呼び出しは省略可
 * @param {number|null} [p.costUsd] 固定原価（USD）の直接指定。指定時はトークン単価表を使わない
 */
async function recordUsage({ uid = null, email = null, feature, provider = null, model = null, usage = null, costUsd: fixedCostUsd = null }) {
  try {
    const db = admin.firestore();
    const FieldValue = admin.firestore.FieldValue;
    const n = normalizeUsage(usage);
    const totalTokens = n.inputTokens + n.outputTokens + n.cacheReadTokens + n.cacheCreationTokens;
    const costUsd = fixedCostUsd != null ? (Number(fixedCostUsd) || 0) : estimateCostUsd(model, n);
    if (totalTokens === 0 && costUsd === 0) return; // 記録に値するトークンもコストも無ければスキップ
    const { day, month } = jstDateParts();
    const feat = safeKey(feature || "unknown");
    const modelKey = safeKey(model || "unknown");

    // ① 生ログ
    const logP = db.collection("usageLogs").doc().set({
      uid, email,
      feature: feature || "unknown",
      provider, model,
      promptTokens: n.inputTokens,
      completionTokens: n.outputTokens,
      cacheReadTokens: n.cacheReadTokens,
      cacheCreationTokens: n.cacheCreationTokens,
      totalTokens,
      costUsd,
      day, month,
      createdAt: FieldValue.serverTimestamp(),
    });

    // ② 日次ロールアップ（機能別・モデル別に increment）
    // キャッシュ読取比率を出すため cacheRead/cacheCreation も積む。
    const bucket = () => ({
      calls: FieldValue.increment(1),
      totalTokens: FieldValue.increment(totalTokens),
      costUsd: FieldValue.increment(costUsd),
      cacheReadTokens: FieldValue.increment(n.cacheReadTokens),
      cacheCreationTokens: FieldValue.increment(n.cacheCreationTokens),
    });
    const rollP = db.collection("usageDaily").doc(day).set({
      day, month,
      updatedAt: FieldValue.serverTimestamp(),
      ...bucket(),
      byFeature: { [feat]: bucket() },
      byModel: { [modelKey]: bucket() },
    }, { merge: true });

    await Promise.all([logP, rollP]);
  } catch (e) {
    console.warn("[recordUsage] skipped:", e && e.message);
  }
}

module.exports = { recordUsage, normalizeUsage, jstDateParts };
