/**
 * llm.js — テキスト生成のプロバイダ抽象（Gemini / Claude）
 *
 * config/aiModels（管理画面の Content Strategy で設定）で選ばれたモデルに応じて
 * Gemini か Claude を呼び分ける。いずれも「JSONのみ出力」を前提に整形して返す。
 *
 * 必要な Secret（onCall の secrets に付与すること）:
 *   - GEMINI_API_KEY（gemini時）
 *   - ANTHROPIC_API_KEY（claude時）
 */
const Anthropic = require("@anthropic-ai/sdk");

async function callGemini(apiKey, prompt, { model = "gemini-2.5-flash", maxTokens = 8192, temperature = 0.7 } = {}) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const um = data.usageMetadata || {};
  return {
    text,
    usage: {
      inputTokens: um.promptTokenCount || 0,
      outputTokens: um.candidatesTokenCount || 0,
      cacheReadTokens: um.cachedContentTokenCount || 0,
      cacheCreationTokens: 0,
    },
  };
}

async function callClaude(apiKey, prompt, { model = "claude-sonnet-4-6", maxTokens = 8192, temperature = 0.7 } = {}) {
  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: "あなたはSEKKEIYAの編集アシスタントです。プロンプトがJSON形式の出力を求める場合は、前後に一切の説明やコードブロックを付けず、有効なJSONのみを返してください。",
    messages: [{ role: "user", content: prompt }],
  });
  const text = (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  return {
    text,
    usage: {
      inputTokens: resp.usage?.input_tokens || 0,
      outputTokens: resp.usage?.output_tokens || 0,
      cacheReadTokens: resp.usage?.cache_read_input_tokens || 0,
      cacheCreationTokens: resp.usage?.cache_creation_input_tokens || 0,
    },
  };
}

/** config/aiModels からテキストモデル設定を解決（未設定なら Gemini 2.5 Flash） */
async function getTextModelConfig(db) {
  try {
    const cfg = (await db.doc("config/aiModels").get()).data() || {};
    const provider = cfg.textProvider === "claude" ? "claude" : "gemini";
    const model = String(cfg.textModel || "").trim()
      || (provider === "claude" ? "claude-sonnet-4-6" : "gemini-2.5-flash");
    return { provider, model };
  } catch (e) {
    return { provider: "gemini", model: "gemini-2.5-flash" };
  }
}

/**
 * プロバイダに応じてテキスト生成し、text と usage を返す（使用量トラッキング用）。
 * @returns {Promise<{text:string, usage:object, provider:string, model:string}>}
 */
async function callLLMDetailed(prompt, { provider = "gemini", model, maxTokens, temperature } = {}) {
  if (provider === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    const r = await callClaude(key, prompt, { model, maxTokens, temperature });
    return { ...r, provider: "claude", model: model || "claude-sonnet-4-6" };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const r = await callGemini(key, prompt, { model, maxTokens, temperature });
  return { ...r, provider: "gemini", model: model || "gemini-2.5-flash" };
}

/** プロバイダに応じてテキスト生成。text（多くはJSON文字列）を返す。既存呼び出し互換。 */
async function callLLM(prompt, opts = {}) {
  const { text } = await callLLMDetailed(prompt, opts);
  return text;
}

module.exports = { callLLM, callLLMDetailed, getTextModelConfig };
