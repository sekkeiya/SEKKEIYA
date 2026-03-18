const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

exports.generateModelMetadata = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    try {
      console.log("========== generateModelMetadata start ==========");
      console.log("auth uid:", request.auth?.uid);
      
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "Must be logged in.");
      }

      const uid = request.auth.uid;
      const data = request.data;
      console.log("filename:", data?.filename);

      const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing");
        throw new HttpsError("internal", "GEMINI_API_KEY is not configured");
      }

      const { filename, ext, dimensions, tags } = data;

      if (!filename) {
        throw new HttpsError("invalid-argument", "Missing filename");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `あなたはインテリア・建築用途の3Dモデル分類エキスパートAIです。
入力情報から推測し、以下のJSONスキーマに従って結果のみを出力してください。
余計なマークダウン（\`\`\`json など）は含めず、純粋なJSONオブジェクトのみを出力してください。
{
  "title": string, // 拡張子や不要なサフィックス(V1, finalなど)を除去した綺麗な日本語の名前
  "type": string, // "家具", "建築", "その他" のいずれか
  "mainCategory": string, // "収納家具", "ソファ", "チェア", "テーブル・机", "ベッド", "インテリア小物", "照明", "住宅設備", "建具", "外構・エクステリア", "マテリアル", "構造・躯体", "設備機器", "その他" のいずれか
  "tags": string[], // 特徴を表す短い日本語タグを3〜5個
  "confidence": number // 0.0 〜 1.0
}`
      });

      const dimStr = dimensions ? `${dimensions.width}W x ${dimensions.depth}D x ${dimensions.height}H` : "不明";
      const tagsStr = Array.isArray(tags) ? tags.join(", ") : "なし";

      const prompt = `以下の入力情報からメタデータを推論し、JSONで出力してください。

【入力情報】
- ファイル名: ${filename}
- 拡張子: ${ext || "不明"}
- 寸法: ${dimStr}
- 既存タグ: ${tagsStr}
`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      let responseText = result.response.text();
      // 余計なマークダウン記法が含まれていれば除去
      responseText = responseText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim();

      let suggestions;
      try {
         suggestions = JSON.parse(responseText);
      } catch (parseError) {
         console.error("Failed to parse Gemini JSON:", responseText);
         throw new HttpsError("internal", "Invalid JSON returned from AI");
      }

      console.log("generateModelMetadata completed:", suggestions.title);
      return suggestions;

    } catch (error) {
      console.error("generateMetadata error:", error);
      throw new HttpsError("internal", error.message || "Failed to generate model metadata");
    }
  }
);
