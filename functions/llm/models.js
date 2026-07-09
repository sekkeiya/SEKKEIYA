/**
 * llm/models.js — 機能別モデルルーティング（Phase 0 基盤）。
 *
 * config/aiModels.featureModels（管理者が設定）を読み、機能ごとに使うモデルを解決する。
 * 未設定ならコードの既定にフォールバック。＝コード変更なし・設定だけでモデルを差し替え可能。
 *
 * 効率の指針（品質バーをギリギリ超える最安モデルに各タスクを流す）:
 *   S(対話/仕上げ)=Sonnet / M(大量生成)=Gemini or Batch / L(分類・提案)=Haiku・Gemini Flash
 */

// feature → { provider, model } の既定。usage/recordUsage の feature ラベルと揃える。
const DEFAULTS = {
  "chat":           { provider: "anthropic", model: "claude-sonnet-4-6" },
  "chat-suggest":   { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  "site-narration": { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
  "blog-draft":     { provider: "gemini",    model: "gemini-2.5-flash" },
  "blog-polish":    { provider: "anthropic", model: "claude-sonnet-4-6" },
  "blog-dialogue":  { provider: "gemini",    model: "gemini-2.5-flash" },
  "classify":       { provider: "gemini",    model: "gemini-2.5-flash" },
  "default":        { provider: "anthropic", model: "claude-sonnet-4-6" },
};

/**
 * 機能に対応する { provider, model } を解決する。
 * @param {string} feature
 * @param {FirebaseFirestore.Firestore} [db]  未指定なら既定のみで解決
 */
async function resolveModel(feature, db) {
  const fallback = DEFAULTS[feature] || DEFAULTS.default;
  try {
    if (!db) return fallback;
    const snap = await db.doc("config/aiModels").get();
    const cfg = snap.exists ? (snap.data() || {}) : {};
    const entry = (cfg.featureModels || {})[feature];
    if (entry && entry.model) {
      return { provider: entry.provider || fallback.provider, model: entry.model };
    }
  } catch (e) {
    console.warn("[resolveModel] fallback for", feature, ":", e && e.message);
  }
  return fallback;
}

module.exports = { resolveModel, DEFAULTS };
