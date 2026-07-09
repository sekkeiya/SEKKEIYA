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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
  return (resp.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
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

/** プロバイダに応じてテキスト生成。text（多くはJSON文字列）を返す。 */
async function callLLM(prompt, { provider = "gemini", model, maxTokens, temperature } = {}) {
  if (provider === "claude") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
    return await callClaude(key, prompt, { model, maxTokens, temperature });
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return await callGemini(key, prompt, { model, maxTokens, temperature });
}

module.exports = { callLLM, getTextModelConfig };
