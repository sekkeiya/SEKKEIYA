/**
 * generateTrendArticle.js — analytics/weeklyTrends の集計データを読み、
 * Gemini で日本語トレンド記事を生成して officialArticles に status:"review" で投入する。
 *
 * フロー:
 *   aggregateWeeklyTrends 実行 → analytics/weeklyTrends に集計が書かれる
 *   → generateTrendArticle 実行 → Gemini で下書き → officialArticles status:"review"
 *   → 管理者が /admin/articles でレビュー → status を "published" に変更 → 公開
 *
 * 設計方針:
 *   - ユーザー数0 or キーワード0 は k-anonymity 保護としてスキップ
 *   - 同じ weekId の記事が既にある場合は上書き（冪等）
 *   - 全自動公開はしない（status:"review" で止める）
 */
const admin = require("firebase-admin");
const { buildBrandBlock, sanitizeInternalLinksMd } = require("./officialBrandContext");

async function callGemini(apiKey, prompt) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.72,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

exports.generateTrendArticle = async (data = {}, context = {}, apiKey) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  // 最新集計を読む
  const trendsDoc = await db.collection("analytics").doc("weeklyTrends").get();
  if (!trendsDoc.exists) {
    return { success: false, reason: "No weekly trends data. Run aggregateWeeklyTrends first." };
  }
  const trends = trendsDoc.data();
  const weekId = trends.weekId || new Date().toISOString().slice(0, 10);

  // k-anonymity 保護: データが全く無い場合は生成しない
  if ((trends.chatUserCount || 0) === 0 && (trends.layoutSessionCount || 0) === 0) {
    return { success: false, reason: "Insufficient data (k-anonymity protection). Try again after more usage." };
  }

  const kwList   = (trends.topKeywords  || []).slice(0, 10).map((k) => k.word).join("・");
  const roomList = (trends.topRoomTypes || []).slice(0,  3).map((r) => r.name).join("・");
  const styleList= (trends.topStyles    || []).slice(0,  3).map((s) => s.name).join("・");

  const prompt = `
あなたはSEKKEIYA（AI空間設計OS）の公式ブログ記者です。
以下はSEKKEIYAユーザーの今週の利用傾向データ（個人が特定できない匿名集計）です。

【今週のトレンドデータ（${weekId}）】
- AIへの指示で多かったキーワード: ${kwList || "（集計中）"}
- 人気のルームタイプ: ${roomList || "（集計中）"}
- 人気のインテリアスタイル: ${styleList || "（集計中）"}
- 利用チャットユーザー数（匿名・概数）: 約${trends.chatUserCount || 0}名
- レイアウト生成セッション数: ${trends.layoutSessionCount || 0}件

このデータをもとに、**読者（インテリアデザイナー・工務店・設計者）にとって参考になる**週次トレンド記事を日本語で書いてください。

${buildBrandBlock({ mode: "trend", format: "markdown" })}

【記事の要件】
- タイトル: キャッチーかつSEOを意識（「インテリア」「AI」「トレンド」「レイアウト」等のキーワードを自然に含む）
- 本文: 800〜1200文字のMarkdown形式（## 見出しを使ってよい）
- 構成: 導入（今週の注目ポイント）→ キーワードトレンド分析 → ルーム・スタイルトレンド → まとめと活用ヒント → CTA（## SEKKEIYA で試す）
- トーン: プロフェッショナルかつ読みやすい。業界人が読む媒体想定。
- 禁止: 個人・個別プロジェクトへの言及、数値の誇張、根拠のない断言

【出力形式（JSONのみ。コードブロック不要）】
{"title":"記事タイトル","excerpt":"記事の要約（100字以内）","body":"Markdown本文","tags":["タグ1","タグ2","タグ3"],"seoTitle":"SEOタイトル（60字以内）","seoDescription":"メタdescription（120字以内）"}
`.trim();

  let articleData;
  try {
    const raw = await callGemini(apiKey, prompt);
    // ```json ... ``` ブロックを除去してパース
    const jsonStr = raw
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    articleData = JSON.parse(jsonStr);
  } catch (e) {
    return { success: false, reason: `Generation/parse failed: ${e.message}` };
  }

  const slug = `weekly-trend-${weekId}`;
  const tags = Array.isArray(articleData.tags) ? articleData.tags : ["トレンド", "SEKKEIYA"];

  const docData = {
    title:         articleData.title        || `${weekId} SEKKEIYAトレンドレポート`,
    slug,
    excerpt:       articleData.excerpt      || "",
    body:          sanitizeInternalLinksMd(articleData.body || ""),
    contentFormat: "markdown",
    tags,
    tagsLower:     tags.map((t) => t.toLowerCase()),
    status:        "review",      // 管理者レビュー待ち（自動公開しない）
    source:        "reporter-mode1",
    featured:      false,
    seoTitle:      articleData.seoTitle      || articleData.title || "",
    seoDescription:articleData.seoDescription|| "",
    category:      { slug: "trend", name: "トレンド" },
    author:        { uid: "system", displayName: "SEKKEIYA Reporter" },
    coverUrl:      "",
    trendsSnapshot: {
      weekId,
      topKeywords:       (trends.topKeywords  || []).slice(0, 5),
      chatUserCount:      trends.chatUserCount      || 0,
      layoutSessionCount: trends.layoutSessionCount || 0,
    },
    createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:   admin.firestore.FieldValue.serverTimestamp(),
    publishedAt: null,
  };

  // 冪等: 同じ slug が既にあれば上書き
  const col = db.collection("officialArticles");
  const existing = await col.where("slug", "==", slug).limit(1).get();
  if (!existing.empty) {
    await existing.docs[0].ref.update({
      ...docData,
      createdAt: existing.docs[0].data().createdAt, // 作成日は保持
    });
    console.log(`[generateTrendArticle] updated: ${slug}`);
    return { success: true, action: "updated", slug };
  }

  await col.add(docData);
  console.log(`[generateTrendArticle] created: ${slug}`);
  return { success: true, action: "created", slug };
};
