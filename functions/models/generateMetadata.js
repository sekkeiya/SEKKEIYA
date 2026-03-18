const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.generateModelMetadata = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    try {
      console.log("========== generateModelMetadata start ==========");
      
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in.");
      }

      const data = request.data;
      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        throw new HttpsError("internal", "GEMINI_API_KEY is not configured");
      }

      const { filename, ext, dimensions, tags, similarityCandidates = {} } = data;

      if (!filename) {
        throw new HttpsError("invalid-argument", "Missing filename");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `あなたはインテリア・建築用途の3Dモデル分類を洗練させる専門AIです。
ゼロから推測するのではなく、ユーザーの過去の類似モデルからの推論候補（similarityCandidates）を主な判断基準として、最終的な分類とタグを決定してください。
入力内容と類似モデルの分類が一致する場合は類似モデルの分類を重んじ、明らかに異なる場合のみ独自の判断で修正してください。

【重要な制約】
1. Always prioritize "家具" or "建築".
2. Only select "その他" if it is absolutely impossible to classify as either.
3. If similarityCandidates has strong type signal, follow it.
4. If uncertain, choose the closest between furniture or building. Do NOT default to "その他".

以下の形式に従って純粋なJSONオブジェクトのみを出力してください。余計なマークダウン（\`\`\`json など）は含めないでください。
{
  "title": string, // 拡張子や不要な文字列を除去した表示名
  "type": string, // "家具", "建築", "その他" のいずれか（"家具"または"建築"を強く推奨）
  "mainCategory": string, // 類似候補から選択を優先
  "subCategory": string | null, // 類似候補から選択を優先
  "detailCategory": string | null, // 類似候補から選択を優先
  "tags": string[], // 特徴を表すタグ（類似候補のタグを優先しつつ、ファイル名からの特徴も追加）。最大10個程度。
  "confidence": number // 推論の自信度 (0.0 〜 1.0)
}`
      });

      const dimStr = dimensions ? `${dimensions.width}W x ${dimensions.depth}D x ${dimensions.height}H` : "不明";
      const tagsStr = Array.isArray(tags) ? tags.join(", ") : "なし";
      
      const similarity = similarityCandidates || {};
      const categoryCandidates = similarity.categoryCandidates || [];
      const tagCandidates = similarity.tagCandidates || [];
      const models = similarity.models || [];
      const catStr = categoryCandidates.length > 0 ? categoryCandidates.map(c => c.mainCategory).join(", ") : "なし";
      const topTagsStr = tagCandidates.length > 0 ? tagCandidates.join(", ") : "なし";
      const modelsContext = models.length > 0 ? models.map(m => `- ${m.title} (type:${m.type}, cat:${m.mainCategory}, score:${m.score})`).join("\\n") : "なし";

      const prompt = `以下の入力情報と類似モデルのコンテキストから、最適なメタデータをJSONで出力してください。

【入力情報】
- ファイル名: ${filename}
- 拡張子: ${ext || "不明"}
- 寸法: ${dimStr}
- 既存割り当てタグ: ${tagsStr}

【類似モデルからの推測候補（最優先コンテキスト）】
- 有力なカテゴリ候補: ${catStr}
- 有力なタグ候補: ${topTagsStr}
- 具体的な類似モデル上位:
${modelsContext}
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2 // Lower temp for more deterministic refinement
        }
      });

      let responseText = result.response.text();
      responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

      let suggestions;
      try {
         suggestions = JSON.parse(responseText);
      } catch (parseError) {
         console.error("Failed to parse Gemini JSON:", responseText);
         throw new HttpsError("internal", "Invalid JSON returned from AI");
      }

      // 簡単なタグのサニタイズと重複排除
      if (Array.isArray(suggestions.tags)) {
        suggestions.tags = Array.from(new Set(
          suggestions.tags
            .map(t => typeof t === "string" ? t.trim().toLowerCase() : "")
            .filter(t => t.length > 0)
        ));
      }

      console.log("generateModelMetadata completed:", suggestions.title);
      return suggestions;

    } catch (error) {
      console.error("generateMetadata error:", error);
      throw new HttpsError("internal", error.message || "Failed to generate model metadata");
    }
  }
);
