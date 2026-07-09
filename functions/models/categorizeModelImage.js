const { HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

/**
 * categorizeModelImage core logic  (RAG: 自分のライブラリで件数学習)
 * ------------------------------------------------------------------
 * 3Dモデルのサムネイル画像を Gemini(vision) で分類し、構造化カテゴリ
 * (macro/main/sub) + マテリアル + タグ + 確信度 を返す。
 *
 * RAG: 呼び出しユーザーが過去に分類した「似たモデル」を items から取得し、
 *      その確定カテゴリ(macro/main/sub) を few-shot としてプロンプトに注入する。
 *      → ライブラリが育つほどユーザーの分類傾向に沿った精度になる(自分のデータのみ)。
 *
 * クライアント: sekkeiya-desktop / src/features/dss/upload/utils/visionCategorize.ts
 * 呼び出し元: index.js exports.categorizeModelImage (onCall, secrets:[GEMINI_API_KEY])
 */

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

const tokensOf = (str) =>
  String(str || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && t.length > 1);

/** taxonomy { macro: { main: [sub...] } } を読みやすい階層テキストへ */
const taxonomyToPrompt = (tax) => {
  const lines = [];
  for (const [macro, mains] of Object.entries(tax || {})) {
    lines.push(`- ${macro}`);
    for (const [main, subs] of Object.entries(mains || {})) {
      const subList = Array.isArray(subs) && subs.length ? ` (${subs.join(" / ")})` : "";
      lines.push(`    - ${main}${subList}`);
    }
  }
  return lines.join("\n");
};

/** LLM 出力を taxonomy に照らして検証・矯正 */
const validateAgainstTaxonomy = (tax, macro, main, sub) => {
  const macros = Object.keys(tax || {});
  let macroCategory = macros.includes(macro) ? macro : "";
  let mainCategory = "";
  let subCategory = "";

  if (macroCategory) {
    const mains = Object.keys(tax[macroCategory] || {});
    if (mains.includes(main)) {
      mainCategory = main;
      const subs = tax[macroCategory][mainCategory] || [];
      if (subs.includes(sub)) subCategory = sub;
    }
  } else {
    for (const [mc, mains] of Object.entries(tax || {})) {
      if (Object.keys(mains || {}).includes(main)) {
        macroCategory = mc;
        mainCategory = main;
        const subs = mains[main] || [];
        if (subs.includes(sub)) subCategory = sub;
        break;
      }
    }
  }
  return { macroCategory, mainCategory, subCategory };
};

/** 新モデルと既存モデルの類似度: 名前/タグのトークン重なり + 寸法近接 */
const similarityScore = (queryTokens, queryDims, ex) => {
  const exTokens = new Set([...tokensOf(ex.name || ex.title), ...tokensOf((ex.tags || []).join(" "))]);
  let overlap = 0;
  for (const t of queryTokens) if (exTokens.has(t)) overlap++;
  let s = queryTokens.length ? overlap / queryTokens.length : 0;

  // 寸法近接 (両方あれば最大 +0.3)
  const qd = queryDims;
  const ed = ex.dimensions;
  if (qd && ed) {
    const dims = ["width", "depth", "height"];
    let close = 0;
    let counted = 0;
    for (const d of dims) {
      const a = Number(qd[d]);
      const b = Number(ed[d]);
      if (a > 0 && b > 0) {
        counted++;
        const rel = Math.abs(a - b) / Math.max(a, b);
        if (rel < 0.25) close++;
      }
    }
    if (counted > 0) s += 0.3 * (close / counted);
  }
  return s;
};

/**
 * ユーザー自身の過去モデル(items: type==model, ownerId==uid)から類似上位を取得。
 * macro/main/sub が確定しているものだけを few-shot 候補にする。
 * index 不足等で失敗しても [] を返し、分類自体は続行する。
 */
const fetchFewShotExamples = async (uid, queryTokens, queryDims) => {
  if (!uid) return [];
  try {
    const db = admin.firestore();
    const snap = await db
      .collectionGroup("items")
      .where("ownerId", "==", uid)
      .where("type", "==", "model")
      .limit(300)
      .get();

    const scored = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.isDeleted === true) return;
      const macro = d.macroCategory || d.extendedMetadata?.macroCategory || "";
      const main = d.mainCategory || d.extendedMetadata?.mainCategory || "";
      if (!macro || !main) return; // 確定カテゴリのみ参考にする
      const score = similarityScore(queryTokens, queryDims, d);
      if (score <= 0) return;
      scored.push({
        name: d.title || d.name || "",
        macro,
        main,
        sub: d.subCategory || d.extendedMetadata?.subCategory || "",
        tags: Array.isArray(d.tags) ? d.tags.slice(0, 4) : [],
        score,
      });
    });

    scored.sort((a, b) => b.score - a.score);
    // 同一カテゴリの重複を軽く除去しつつ上位5件
    const seen = new Set();
    const top = [];
    for (const e of scored) {
      const key = `${e.macro}>${e.main}>${e.sub}`;
      if (seen.has(key)) continue;
      seen.add(key);
      top.push(e);
      if (top.length >= 5) break;
    }
    return top;
  } catch (err) {
    console.warn("[categorizeModelImage] few-shot fetch skipped:", err.message);
    return [];
  }
};

const fewShotToPrompt = (examples) => {
  if (!examples.length) return "";
  const lines = examples.map((e) => {
    const tagPart = e.tags.length ? `  [tags: ${e.tags.join(", ")}]` : "";
    const path = [e.macro, e.main, e.sub].filter(Boolean).join(" > ");
    return `- 「${e.name}」 → ${path}${tagPart}`;
  });
  return `

# 参考: あなた(このユーザー)が過去に分類した類似モデル
${lines.join("\n")}
上記と明らかに同種であれば、分類の表記・粒度を揃えてください(一貫性を重視)。
ただし画像が上記と異なる物に見える場合は、画像の見た目を優先してください。`;
};

/**
 * @param {object} data { imageBase64, mimeType, title, ruleTags, dimensionsMm, taxonomy }
 * @param {string} uid  呼び出しユーザー(RAG参照スコープ)
 */
exports.categorizeModelImage = async (data, uid) => {
  const {
    imageBase64,
    mimeType = "image/webp",
    title = "",
    ruleTags = [],
    dimensionsMm = null,
    taxonomy = {},
  } = data || {};

  if (!imageBase64) {
    throw new HttpsError("invalid-argument", "imageBase64 が必要です。");
  }

  const tax = taxonomy && Object.keys(taxonomy).length ? taxonomy : {};
  const dimText = dimensionsMm ?
    `おおよその寸法(mm): 幅${dimensionsMm.width ?? "?"} x 奥${dimensionsMm.depth ?? "?"} x 高${dimensionsMm.height ?? "?"}` :
    "寸法不明";

  // RAG: 自分の過去分類から類似 few-shot を集める
  const queryTokens = Array.from(new Set([...tokensOf(title), ...(Array.isArray(ruleTags) ? ruleTags.flatMap(tokensOf) : [])]));
  const examples = await fetchFewShotExamples(uid, queryTokens, dimensionsMm);

  const prompt = `あなたは建築・インテリアの3Dアセットを分類する専門家です。
添付画像は1つの3Dモデルのサムネイルです。下記の分類体系から最も適切な1カテゴリに分類してください。

# 分類体系 (この中からのみ選ぶこと)
${taxonomyToPrompt(tax)}

# 補助情報
- ファイル名ヒント: ${title || "(なし)"}
- ${dimText}${fewShotToPrompt(examples)}

# 出力ルール
- macroCategory: 上記の「- 」項目(大分類)から1つ。体系内の表記と完全一致。
- mainCategory: その大分類配下の「    - 」項目から1つ。完全一致。
- subCategory: main の括弧内候補から1つ。該当が無ければ空文字 ""。
- materials: 見た目から推定される素材(日本語, 例: 木材, オーク, スチール, ファブリック, ガラス)。最大4個。
- tags: 検索に役立つ短い日本語タグ(色・形状・スタイル等)。最大6個。英数字IDや構造ノイズは入れない。
- confidence: 分類の確信度を0〜1の数値で。
- suggestedTitle: このモデルを端的に表す日本語の商品名風タイトル。
    ルール: 素材または特徴 + 品名 の構成を推奨(例: "ウォールナット材ダイニングテーブル" "スチール脚ソファ" "北欧風アームチェア")。
    カテゴリ語をそのまま並べない。固有名詞は使わない。8文字以内で端的に。画像から判断できる最大2つの特徴を含める。

必ず次のJSON形のみを返す:
{"macroCategory":"","mainCategory":"","subCategory":"","materials":[],"tags":[],"confidence":0,"suggestedTitle":""}`;

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  let parsed = {};
  try {
    const result = await model.generateContent({
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/webp", data: imageBase64 } },
        ],
      }],
      generationConfig: { responseMimeType: "application/json" },
    });
    parsed = JSON.parse(result.response.text());
  } catch (error) {
    console.error("[categorizeModelImage] LLM error", error);
    throw new HttpsError("internal", error.message || "AI分類に失敗しました。");
  }

  const validated = validateAgainstTaxonomy(
    tax,
    String(parsed.macroCategory || ""),
    String(parsed.mainCategory || ""),
    String(parsed.subCategory || ""),
  );

  const materials = Array.isArray(parsed.materials) ?
    parsed.materials.map((m) => String(m)).filter(Boolean).slice(0, 4) : [];
  const tags = Array.isArray(parsed.tags) ?
    parsed.tags.map((t) => String(t)).filter(Boolean).slice(0, 6) : [];
  const confidence = typeof parsed.confidence === "number" ?
    Math.max(0, Math.min(1, parsed.confidence)) : 0.6;
  const suggestedTitle = typeof parsed.suggestedTitle === "string" ? parsed.suggestedTitle.trim() : "";

  return { ...validated, materials, tags, confidence, suggestedTitle, usedExamples: examples.length };
};
