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
exports.generateKeywordArticle = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    const apiKey = geminiApiKey.value();
    return await generateKeywordArticle(request.data, { auth: request.auth }, apiKey);
  } catch (e) {
    console.error("generateKeywordArticle Error:", e);
    throw new HttpsError("internal", e.message || "Keyword article generation failed");
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

