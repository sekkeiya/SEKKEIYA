/**
 * SEKKEIYA AI Orchestrator Main Entrypoint
 */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
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
const { recordUsage } = require("./usage/recordUsage");
const { pickChatModel, loadChatRouting } = require("./llm/routeChat");
const { computeExcludedSilos, loadSiloConfig } = require("./llm/siloTools");
const { getAdminUsageSummary } = require("./usage/getAdminUsageSummary");

// 管理者メール（クライアントの blogAdmin.ts / firestore.rules と揃える）
const ADMIN_EMAILS = ["hello@sekkeiya.com"];

// 📊 管理者APIモニターの集計（方式A / Phase 2）。管理者のみ。
exports.getAdminUsageSummary = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const email = String(request.auth.token?.email || "").trim().toLowerCase();
  if (!ADMIN_EMAILS.some((e) => e.toLowerCase() === email)) {
    throw new HttpsError("permission-denied", "Admins only.");
  }
  try {
    const range = ["7d", "30d", "mtd"].includes((request.data || {}).range)
      ? request.data.range
      : "7d";
    const result = await getAdminUsageSummary({ range });
    return { success: true, result };
  } catch (error) {
    console.error("getAdminUsageSummary Error:", error);
    throw new HttpsError("internal", error.message || "getAdminUsageSummary failed");
  }
});
const { aggregateFurnitureLogs } = require("./insights/aggregateFurnitureLogs");
const { aggregateWeeklyTrends } = require("./insights/aggregateWeeklyTrends");
const { aggregateReactions } = require("./insights/aggregateReactions");
const { generateTrendArticle } = require("./reporter/generateTrendArticle");
const { generateKeywordArticle } = require("./reporter/generateKeywordArticle");
const { synthesizeInterviewArticle } = require("./reporter/synthesizeInterviewArticle");
const { suggestTopics } = require("./reporter/suggestTopics");
const { insertArticleVisuals, designBlogArticle } = require("./reporter/articleVisuals");
const { blogDialogue } = require("./reporter/blogDialogue");
const { generateBlogImage } = require("./reporter/generateBlogImage");
exports.generateBlogImage = generateBlogImage;

// 🗺 みんなの記事の動的サイトマップ（hosting rewrite: /sitemap-community.xml → この関数）。
// S.Blog で公開された記事が再デプロイなしで Google に発見されるようにする。
const { sitemapCommunity } = require("./reporter/sitemapCommunity");
exports.sitemapCommunity = onRequest({ memory: "256MiB", timeoutSeconds: 60 }, sitemapCommunity);

// 🗺 公式記事の動的サイトマップ（hosting rewrite: /sitemap-official.xml → この関数）。
// MCP/管理画面から公開した公式記事が再デプロイなしで Google に発見されるようにする。
const { sitemapOfficial } = require("./reporter/sitemapOfficial");
exports.sitemapOfficial = onRequest({ memory: "256MiB", timeoutSeconds: 60 }, sitemapOfficial);

// 🤖 ブログ記事の動的レンダリング（hosting rewrite: /{handle}/blog/{slug} → この関数）。
// ボットには完全なHTML（SEO/OGP/JSON-LD）、人間にはSPAを返す。手動運用ゼロでインデックス確実化。
const { renderBlogArticle } = require("./reporter/renderBlogArticle");
exports.renderBlogArticle = onRequest({ memory: "256MiB", timeoutSeconds: 30 }, renderBlogArticle);

// SEKKEIYA Chat: クライアント主導の tool-calling ループの「1 ターン」エンドポイント。
// docs/10_sekkeiya_chat_spec.md §7
exports.agentTurn = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Only authenticated users can use SEKKEIYA Chat.");
  }
  try {
    const { messages, model, projectId, clientContext, excludeSilos } = request.data || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "Missing messages");
    }
    // 🧠 AIメモリー注入（docs/21 Phase A）: user=常時 / project=プロジェクト文脈のときだけ。
    // digest 各1read。取得失敗は注入なしで続行（チャット本体を巻き込まない）
    let memorySection = "";
    try {
      const { getDigestLines, buildMemorySection } = require("./reporter/aiMemory");
      const db = admin.firestore();
      const [u, p] = await Promise.all([
        getDigestLines(db, "user", request.auth.uid),
        projectId ? getDigestLines(db, "project", String(projectId)) : Promise.resolve([]),
      ]);
      memorySection = buildMemorySection(u, p);
    } catch (e) {
      console.warn("agentTurn memory inject failed:", e.message);
    }
    // 🗂 クライアント文脈（開いているタブのプレイブック・編集対象スナップショット等）。
    // 暴走ペイロード対策で上限を切る（通常は数千〜1万文字程度）。
    const safeClientContext =
      typeof clientContext === "string" ? clientContext.slice(0, 60000) : "";
    // 💰 前置き削減①: Google Calendar 接続状態を確認し、未接続なら gcal_* ツールを外す。
    // コネクタは users/{uid}/connectors/google_calendar に保存（存在=接続）。読み取り失敗は未接続扱い。
    let gcalConnected = false;
    try {
      const snap = await admin.firestore()
        .doc(`users/${request.auth.uid}/connectors/google_calendar`).get();
      gcalConnected = snap.exists;
    } catch (e) {
      console.warn("gcal connector check failed:", e.message);
    }
    // 💰 モデル自動振り分け（Phase 1）: 軽い会話=Haiku / 実務・重要=Sonnet。
    // クライアントが model を明示していれば尊重。設定は config/aiModels.chatRouting で調整可能。
    let routedModel = model;
    try {
      const routing = await loadChatRouting(admin.firestore());
      const picked = pickChatModel({ messages, clientModel: model, routing });
      routedModel = picked.model;
      console.log(`[agentTurn] route tier=${picked.tier} reason=${picked.reason} model=${picked.model}`);
    } catch (e) {
      console.warn("agentTurn model routing failed, using client/default:", e.message);
    }
    // 💰 前置き削減②B（Phase B）: 会話で触れていないドメインのツール群(silo)をサーバー側で除外。
    // クライアント指定の excludeSilos と自動判定をマージ（重複は除く）。設定は config/aiModels.toolSilos。
    let mergedExcludeSilos = Array.isArray(excludeSilos) ? excludeSilos.slice() : [];
    try {
      const siloCfg = await loadSiloConfig(admin.firestore());
      const auto = computeExcludedSilos({ messages, config: siloCfg });
      mergedExcludeSilos = Array.from(new Set([...mergedExcludeSilos, ...auto]));
      if (auto.length) console.log(`[agentTurn] silo exclude=[${mergedExcludeSilos.join(",")}]`);
    } catch (e) {
      console.warn("agentTurn tool silo failed, keeping all tools:", e.message);
    }
    const result = await agentTurn({
      messages, model: routedModel, memorySection, clientContext: safeClientContext, gcalConnected,
      excludeSilos: mergedExcludeSilos,
    });
    // 📊 使用量トラッキング（方式A）。fire-and-forget: 記録失敗でチャットを巻き込まない。
    // model は実際に使われた結果のモデル（振り分け後）を記録 → モニターの「モデル別」に内訳が出る。
    void recordUsage({
      uid: request.auth.uid,
      email: request.auth.token?.email || null,
      feature: "chat",
      provider: "anthropic",
      model: result.model || routedModel || null,
      usage: result.usage,
    });
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
    void recordUsage({
      uid: request.auth.uid,
      email: request.auth.token?.email || null,
      feature: "chat-suggest",
      provider: "anthropic",
      model: result.model || null,
      usage: result.usage,
    });
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
    void recordUsage({
      uid: request.auth.uid,
      email: request.auth.token?.email || null,
      feature: "site-narration",
      provider: "anthropic",
      model: result.model || null,
      usage: result.usage,
    });
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

// 反応ログ日次集計: reactionLogs を insights/reactionPatterns に集計（学習サイクル Phase 1）
// 管理者のみ（全ユーザー横断の集計を返すため。学習モニターUI自体も管理者専用）。
// 実行: firebase functions:call aggregateReactions --data '{"day":"YYYY-MM-DD"}'（省略時は今日JST）
exports.aggregateReactions = onCall({ secrets: [] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  const email = String(request.auth.token?.email || "").trim().toLowerCase();
  const isAdmin = request.auth.token?.admin === true ||
    ADMIN_EMAILS.some((e) => e.toLowerCase() === email);
  if (!isAdmin) throw new HttpsError("permission-denied", "Admins only.");
  try {
    return await aggregateReactions(request.data, { auth: request.auth });
  } catch (e) {
    console.error("aggregateReactions Error:", e);
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

// AI記者 モード③: SEKKEIYA の開発内容（gitコミット/変更点メモ）から「新機能/使い方/お知らせ」記事を生成
const { generateDevUpdateArticle } = require("./reporter/generateDevUpdateArticle");
exports.generateDevUpdateArticle = onCall({ secrets: [geminiApiKey, anthropicApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await generateDevUpdateArticle(request.data, { auth: request.auth });
  } catch (e) {
    console.error("generateDevUpdateArticle Error:", e);
    throw new HttpsError("internal", e.message || "Dev update article generation failed");
  }
});

// AI投稿計画（編集長）: SEKKEIYA/ユーザー自身の状況を分析し「次に書くべき記事」を提案（執筆はしない）
const { planBlogContent } = require("./reporter/planBlogContent");
exports.planBlogContent = onCall({ secrets: [geminiApiKey, anthropicApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await planBlogContent(request.data, { auth: request.auth });
  } catch (e) {
    console.error("planBlogContent Error:", e);
    throw new HttpsError("internal", e.message || "Content planning failed");
  }
});

// AIとブログ運営戦略・目標を議論して決める（planBlogContent が最優先材料として使う）
const { blogStrategy } = require("./reporter/blogStrategy");
exports.blogStrategy = onCall({ secrets: [geminiApiKey, anthropicApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  try {
    return await blogStrategy(request.data, { auth: request.auth });
  } catch (e) {
    console.error("blogStrategy Error:", e);
    throw new HttpsError("internal", e.message || "Strategy chat failed");
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

