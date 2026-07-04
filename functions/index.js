/**
 * SEKKEIYA AI Orchestrator Main Entrypoint
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { routeChatRequest } = require("./orchestrator/route");
const { onUserModelsWritten } = require("./models/sync");
const { generateModelMetadata } = require("./models/generateMetadata");
const { analyzeDriveAsset } = require("./drive/analyze");
const { onDriveAssetWritten } = require("./drive/analyzeAsset");
const { generateAssetEmbedding } = require("./drive/embedding");
const { searchDriveAssets } = require("./drive/search");
const admin = require("firebase-admin");

admin.initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");
const { proposeDesktopAction } = require("./orchestrator/proposeDesktopAction");
const { agentTurn } = require("./orchestrator/agentTurn");
const { aggregateFurnitureLogs } = require("./insights/aggregateFurnitureLogs");
const { aggregateWeeklyTrends } = require("./insights/aggregateWeeklyTrends");
const { generateTrendArticle } = require("./reporter/generateTrendArticle");
const { generateKeywordArticle } = require("./reporter/generateKeywordArticle");
const { synthesizeInterviewArticle } = require("./reporter/synthesizeInterviewArticle");
const { suggestTopics } = require("./reporter/suggestTopics");
const { insertArticleVisuals, designBlogArticle } = require("./reporter/articleVisuals");
const { blogDialogue } = require("./reporter/blogDialogue");

// SEKKEIYA Chat: クライアント主導の tool-calling ループの「1 ターン」エンドポイント。
// docs/10_sekkeiya_chat_spec.md §7
exports.agentTurn = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can use SEKKEIYA Chat.");
  }
  try {
    const { messages, model } = request.data || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "Missing messages");
    }
    const result = await agentTurn({ messages, model });
    return { success: true, result };
  } catch (error) {
    console.error("agentTurn Error:", error);
    throw new HttpsError("internal", error.message || "agentTurn failed");
  }
});

// SEKKEIYA Chat: 空チャットを開いたときの「先回り提案」（挨拶1行+提案チップ）。
// ダイジェストはクライアントが構築して渡す。Haiku固定・ツールなしの軽量呼び出し。
const { suggestNextActions } = require("./orchestrator/suggestNextActions");
exports.suggestNextActions = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can use SEKKEIYA Chat.");
  }
  try {
    const { projectName, digest } = request.data || {};
    const result = await suggestNextActions({ projectName, digest });
    return { success: true, result };
  } catch (error) {
    console.error("suggestNextActions Error:", error);
    throw new HttpsError("internal", error.message || "suggestNextActions failed");
  }
});

// プロジェクトサイトの「プレゼンモード」: セクションごとのナレーション原稿を生成。
// Haiku固定・ツールなしの軽量呼び出し。クライアントがサイト内容ハッシュでキャッシュする。
const { generateSiteNarration } = require("./orchestrator/generateSiteNarration");
exports.generateSiteNarration = onCall({ secrets: [anthropicApiKey], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can use presentation mode.");
  }
  try {
    const { projectName, sections } = request.data || {};
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new HttpsError("invalid-argument", "Missing sections");
    }
    const result = await generateSiteNarration({ projectName, sections });
    return { success: true, result };
  } catch (error) {
    console.error("generateSiteNarration Error:", error);
    throw new HttpsError("internal", error.message || "generateSiteNarration failed");
  }
});

exports.proposeDesktopAction = onCall({ secrets: [geminiApiKey, openAiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can trigger the orchestrator.");
  }

  try {
    const { systemPromptContext, userMessage } = request.data;
    if (!userMessage) throw new HttpsError("invalid-argument", "Missing userMessage");

    const result = await proposeDesktopAction({
      uid: request.auth.uid,
      systemPromptContext: systemPromptContext || "",
      userMessage
    });
    
    return { success: true, result };
  } catch (error) {
    console.error("proposeDesktopAction Error:", error);
    throw new HttpsError("internal", error.message || "Failed to propose desktop action");
  }
});

exports.runChatOrchestrator = onCall({ secrets: [geminiApiKey] }, async (request) => {
  // 1. Authenticate user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Only authenticated users can trigger the orchestrator."
    );
  }

  const uid = request.auth.uid;
  const {
    threadId,
    agentMode = "assistant",
    provider = "gemini",
    model = "gemini-2.5-flash",
    context = {}
  } = request.data;

  if (!threadId) {
    throw new HttpsError("invalid-argument", "Missing threadId");
  }

  try {
    // 2. Pass request to the routing layer
    const result = await routeChatRequest({
      uid,
      threadId,
      agentMode,
      provider,
      model,
      context,
    });

    return { success: true, result };

  } catch (error) {
    console.error("Orchestrator Error:", error);
    throw new HttpsError("internal", error.message || "Failed to orchestrate chat");
  }
});

const { processModelUpload } = require("./models/processUpload");
exports.processModelUpload = processModelUpload;

exports.generateModelMetadata = generateModelMetadata;

const { followUser, unfollowUser } = require("./social/follow");
exports.followUser = followUser;
exports.unfollowUser = unfollowUser;

// Layer 3: 家具選定ログ集計（管理者が手動実行 or Cloud Scheduler から呼ぶ）
// 実行: firebase functions:call aggregateFurnitureLogs
exports.aggregateFurnitureLogs = onCall({ secrets: [] }, async (request) => {
  // 管理者のみ許可（本番では admin claim チェックを追加推奨）
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in.");
  }
  try {
    const result = await aggregateFurnitureLogs(request.data, { auth: request.auth });
    return result;
  } catch (error) {
    console.error("aggregateFurnitureLogs Error:", error);
    throw new HttpsError("internal", error.message || "Aggregation failed");
  }
});

exports.analyzeDriveAsset = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await analyzeDriveAsset(request.auth.uid, request.data.assetId);
});

const { categorizeModelImage } = require("./models/categorizeModelImage");
exports.categorizeModelImage = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await categorizeModelImage(request.data, request.auth.uid);
});

// --- Knowledge / RAG (AI Studio ナレッジ) ---
const { ingestKnowledge, retrieveKnowledge, deleteKnowledgeSource } = require("./knowledge/ingest");
exports.ingestKnowledge = onCall({ secrets: [geminiApiKey], timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await ingestKnowledge(request.data, request.auth.uid);
});
exports.retrieveKnowledge = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await retrieveKnowledge(request.data, request.auth.uid);
});
exports.deleteKnowledgeSource = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await deleteKnowledgeSource(request.data, request.auth.uid);
});

exports.generateAssetEmbedding = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await generateAssetEmbedding(request.auth.uid, request.data.assetId);
});

// ── AI記者 (Reporter Mode ①) ────────────────────────────────────────
// 週次トレンド集計: 匿名データを analytics/weeklyTrends に書き込む
// 実行: firebase functions:call aggregateWeeklyTrends  または Cloud Scheduler から週次呼び出し
exports.aggregateWeeklyTrends = onCall({ secrets: [] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await aggregateWeeklyTrends(request.data, { auth: request.auth });
  } catch (e) {
    console.error("aggregateWeeklyTrends Error:", e);
    throw new HttpsError("internal", e.message || "Aggregation failed");
  }
});

// トレンド記事生成: 集計を読んでGeminiで下書き → officialArticles status:"review"
// 実行: aggregateWeeklyTrends の後に呼ぶ
exports.generateTrendArticle = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    const apiKey = geminiApiKey.value();
    return await generateTrendArticle(request.data, { auth: request.auth }, apiKey);
  } catch (e) {
    console.error("generateTrendArticle Error:", e);
    throw new HttpsError("internal", e.message || "Article generation failed");
  }
});

// AI記者 モード②: トピックキューの検索キーワードを狙ったSEO記事を生成
// 実行: /admin/strategy の各トピックの「記事を生成」ボタンから呼ぶ
exports.generateKeywordArticle = onCall({ secrets: [geminiApiKey, anthropicApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    const apiKey = geminiApiKey.value();
    return await generateKeywordArticle(request.data, { auth: request.auth }, apiKey);
  } catch (e) {
    console.error("generateKeywordArticle Error:", e);
    throw new HttpsError("internal", e.message || "Keyword article generation failed");
  }
});

// S.Blog「✨デザイン」: ブログのスタイル設定に沿って記事全体を整形＋統一デザインの図解/画像を挿入
exports.designBlogArticle = onCall(
  { secrets: [geminiApiKey, anthropicApiKey, openAiApiKey], timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    try {
      return await designBlogArticle(request.data, { auth: request.auth });
    } catch (e) {
      console.error("designBlogArticle Error:", e);
      throw new HttpsError("internal", e.message || "Blog design failed");
    }
  }
);

// AI音声（ニューラルTTS）合成: S.Blog リーダー等の「AI音声」エンジンから段落単位で呼ばれる
// 有料プラン限定・Storage録音キャッシュつき（同一テキストの再合成なし）
const { ttsSynthesize, getTtsUsage } = require("./reporter/ttsSynthesize");
exports.ttsSynthesize = onCall({ secrets: [geminiApiKey], timeoutSeconds: 120, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await ttsSynthesize(request.data, { auth: request.auth });
  } catch (e) {
    console.error("ttsSynthesize Error:", e);
    throw new HttpsError("internal", e.message || "TTS synth failed");
  }
});

// AI音声の利用枠（Claude式・時間窓リセット）の残量取得（設定画面のメーター用）
exports.getTtsUsage = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await getTtsUsage(request.data, { auth: request.auth });
  } catch (e) {
    console.error("getTtsUsage Error:", e);
    throw new HttpsError("internal", e.message || "usage read failed");
  }
});

// 記事の音声版（Podcast）生成: 記事全文をAI音声で合成しMP3にして記事へ添付（有料プラン限定）
const { generateArticleAudio } = require("./reporter/articleAudio");
exports.generateArticleAudio = onCall({ secrets: [geminiApiKey], timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await generateArticleAudio(request.data, { auth: request.auth });
  } catch (e) {
    console.error("generateArticleAudio Error:", e);
    throw new HttpsError("internal", e.message || "Article audio failed");
  }
});

// S.Blog「AIと対話して書く」: 下書き生成 / 議論の1ターン / 議論を記事へ反映
// 実行: Desktop/Web の S.Blog エディタから（一般ユーザー可・自分のブログ用）
// timeoutSeconds: read(本文抽出+翻訳)/synthesize は60秒を超えることがあるため延長
exports.blogDialogue = onCall({ secrets: [geminiApiKey, anthropicApiKey], timeoutSeconds: 180, memory: "512MiB" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await blogDialogue(request.data, { auth: request.auth });
  } catch (e) {
    console.error("blogDialogue Error:", e);
    throw new HttpsError("internal", e.message || "Blog dialogue failed");
  }
});

// 記事にビジュアル（図解スライドSVG or AI画像）を差し込む
// 実行: /admin/articles/{id}/edit の「図解を挿入 / AI画像を挿入」から
exports.insertArticleVisuals = onCall(
  { secrets: [geminiApiKey, anthropicApiKey, openAiApiKey], timeoutSeconds: 300, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
    try {
      return await insertArticleVisuals(request.data, { auth: request.auth });
    } catch (e) {
      console.error("insertArticleVisuals Error:", e);
      throw new HttpsError("internal", e.message || "Visual insertion failed");
    }
  }
);

// AI記者「ネタ出し」: 検索需要を狙ったトピックを topicQueue に自動提案
// 実行: /admin/strategy の「AIでネタ提案」から呼ぶ
exports.suggestTopics = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    const apiKey = geminiApiKey.value();
    return await suggestTopics(request.data, { auth: request.auth }, apiKey);
  } catch (e) {
    console.error("suggestTopics Error:", e);
    throw new HttpsError("internal", e.message || "Topic suggestion failed");
  }
});

// 取材（インタビュー）回答を記事本文に織り込む → status:"review"
// 実行: /admin/articles/{id}/edit の「回答を反映して仕上げる」から呼ぶ
exports.synthesizeInterviewArticle = onCall({ secrets: [geminiApiKey, anthropicApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    const apiKey = geminiApiKey.value();
    return await synthesizeInterviewArticle(request.data, { auth: request.auth }, apiKey);
  } catch (e) {
    console.error("synthesizeInterviewArticle Error:", e);
    throw new HttpsError("internal", e.message || "Interview synthesis failed");
  }
});

exports.searchAssets = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can trigger asset search.");
  }

  const { query, options = {} } = request.data;
  if (!query && !options.referenceAssetId) {
    throw new HttpsError("invalid-argument", "Missing query or referenceAssetId");
  }

  const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
  return await searchDriveAssets(request.auth.uid, query, options, apiKey);
});

// Layout AI Endpoints
const { recommendFurniture } = require("./layout/recommendFurniture");
const { fetchLayout } = require("./layout/fetchLayout");

exports.recommendFurniture = onCall({ secrets: [geminiApiKey] }, async (request) => {
  return await recommendFurniture(request.data, request);
});

exports.fetchLayout = onCall({ secrets: [geminiApiKey] }, async (request) => {
  return await fetchLayout(request.data, request);
});

// AI 3D Generation Endpoints
const { requestAiGeneration } = require("./ai3d/requestGeneration");
const { pollAiJobs } = require("./ai3d/pollJobs");
exports.requestAiGeneration = requestAiGeneration;
exports.pollAiJobs = pollAiJobs;

// AI Render (image generation) Endpoints
const { requestAiRender } = require("./airender/requestAiRender");
exports.requestAiRender = requestAiRender;

// Payments: 寄付コメントを公開用コレクションへ転記（Stripe拡張機能の決済記録トリガ）
const { onPaymentWrittenMirrorDonation } = require("./payments/donationComment");
exports.onPaymentWrittenMirrorDonation = onPaymentWrittenMirrorDonation;

// Payments: Stripe サブスク → users/{uid}.plan を同期（課金→プラン付与の要）
const { syncSubscriptionPlan } = require("./payments/syncSubscriptionPlan");
exports.syncSubscriptionPlan = syncSubscriptionPlan;

// Payments: 追加クレジット購入(top-up)の成功決済 → credits.topupBalance に付与
const { grantTopupOnPayment } = require("./payments/grantTopupOnPayment");
exports.grantTopupOnPayment = grantTopupOnPayment;

// Payments: aiJobs が failed に遷移したら消費クレジットを返金
const { refundCreditsOnJobFailure } = require("./payments/refundOnJobFailure");
exports.refundCreditsOnJobFailure = refundCreditsOnJobFailure;

