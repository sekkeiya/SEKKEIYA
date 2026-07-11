const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { aiPricing, ai3dUsageMeta } = require("./pricing");
const { CREDIT_COST, consume } = require("../payments/creditLedger");
const { recordUsage } = require("../usage/recordUsage");
const { runMockProvider } = require("./providers/mockProvider");
const { defineSecret } = require("firebase-functions/params");
const tripoApiKey = defineSecret("TRIPO_API_KEY");

// timeoutSeconds: startJob（画像DL→Tripoアップロード→タスク作成）を await するため、
// デフォルト60秒では大きい画像で不足する可能性がある。
exports.requestAiGeneration = onCall({ secrets: [tripoApiKey], timeoutSeconds: 180 }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const uid = request.auth.uid;
  const { provider = "mock", inputImageUrl, inputImageStoragePath, imageHash, projectId, workspaceId } = request.data;

  if (aiPricing.imageTo3D[provider] === undefined) {
    throw new HttpsError("invalid-argument", `Unsupported provider: ${provider}`);
  }

  const tokenCost = aiPricing.imageTo3D[provider];
  const db = admin.firestore();

  let jobId;
  try {
    // Transaction to safely check limits, deduct tokens, and create the job
    jobId = await db.runTransaction(async (transaction) => {
      // 1. Fetch User Document (for plan, aiUsage, customAiLimits)
      const userRef = db.collection("users").doc(uid);
      const userDoc = await transaction.get(userRef);
      
      const userData = userDoc.exists ? userDoc.data() : {};
      const plan = userData.plan || "free";
      
      // クレジット消費（統合プール）。docs/17 / docs/18。
      // customAiLimits を持つ特別アカウントは従量枠をバイパス（コンプ扱い）。
      const cost = CREDIT_COST.model3d;
      const bypass = !!userData.customAiLimits?.[provider];
      let creditsResult = null;
      if (!bypass) {
        creditsResult = consume(plan, userData.credits, cost); // 不足なら INSUFFICIENT_CREDITS を throw
      }

      // aiUsage は分析・ジョブ記録用に加算（enforcement はクレジット側）。
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentDayStr = `${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
      let aiUsage = userData.aiUsage || {};
      let providerUsage = aiUsage[provider] || {
        dailyCount: 0, monthlyCount: 0, lastDailyResetAt: null, lastMonthlyResetAt: null
      };
      if (providerUsage.lastDailyResetAt !== currentDayStr) {
        providerUsage.dailyCount = 0;
        providerUsage.lastDailyResetAt = currentDayStr;
      }
      if (providerUsage.lastMonthlyResetAt !== currentMonthStr) {
        providerUsage.monthlyCount = 0;
        providerUsage.lastMonthlyResetAt = currentMonthStr;
      }
      providerUsage.dailyCount += 1;
      providerUsage.monthlyCount += 1;
      aiUsage[provider] = providerUsage;

      const userPatch = { aiUsage };
      if (creditsResult) {
        userPatch.credits = { ...creditsResult.storable, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
      }
      transaction.set(userRef, userPatch, { merge: true });

      // 4. Create Job
      const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc();
      transaction.set(jobRef, {
        type: "image_to_3d",
        provider,
        selectedModel: provider,
        planAtGeneration: plan,
        usageCountAfterGeneration: {
          dailyCount: providerUsage.dailyCount,
          monthlyCount: providerUsage.monthlyCount
        },
        costTokens: tokenCost,
        costCredits: bypass ? 0 : cost,
        creditFromAllotment: creditsResult ? creditsResult.fromAllotment : 0,
        creditFromTopup: creditsResult ? creditsResult.fromTopup : 0,
        providerJobId: null,
        status: "pending",
        projectId: request.data.projectId || null,
        workspaceId: request.data.workspaceId || null,
        autoPlace: request.data.autoPlace || false,
        cost: tokenCost, // legacy compatibility
        inputImageUrl: inputImageUrl || null,
        inputImageStoragePath: inputImageStoragePath || null,
        imageHash: imageHash || null,
        errorMessage: null,
        pollCount: 0,
        maxPollCount: 60,
        retryCount: 0,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return jobRef.id;
    });
  } catch (err) {
    if (err.message === "INSUFFICIENT_CREDITS") {
      throw new HttpsError("resource-exhausted", "クレジットが不足しています。追加購入またはプランのアップグレードをご検討ください。");
    }
    throw new HttpsError("internal", err.message);
  }

  // 管理者APIモニターへ記録。クレジット消費と同じくリクエスト時に固定原価で計上する
  // （Tripo/Meshy のレスポンスに課金メタが無いため概算）。recordUsage は内部で
  // 例外を握るので await しても本体を巻き込まない。
  const usageMeta = ai3dUsageMeta[provider] || { costUsd: 0, provider, model: provider };
  await recordUsage({
    uid,
    email: request.auth.token?.email || null,
    feature: "3d-model",
    provider: usageMeta.provider,
    model: usageMeta.model,
    costUsd: usageMeta.costUsd,
  });

  // Start the provider job BEFORE returning. Cloud Functions v2 throttles CPU to
  // near-zero after the response is sent, so fire-and-forget work (image download →
  // Tripo upload → task creation) silently dies, leaving the job stuck in
  // "pending"/"processing" with no providerJobId. Awaiting keeps the instance alive.
  // startJob handles its own errors by marking the job "failed", so we don't rethrow.
  const { providerFactory } = require("./providers/providerFactory");
  await providerFactory.startJob(jobId, uid, request.data).catch(console.error);

  return { success: true, jobId, message: "Job created and processing started." };
});
