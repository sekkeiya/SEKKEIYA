const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { renderPricing } = require("./pricing");
const { CREDIT_COST, consume } = require("../payments/creditLedger");
const { geminiApiKey } = require("./providers/nanobananaProvider");

exports.requestAiRender = onCall(
  {
    secrets: [geminiApiKey],
    // Image generation can legitimately take 30–90s; default 60s timeout is too tight.
    timeoutSeconds: 180,
    // Loading + base64-encoding a multi-MB image needs headroom over the 256Mi default.
    memory: "512MiB",
  },
  async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in");
  }

  const uid = request.auth.uid;
  const {
    provider = "nanobanana",
    prompt = "",
    inputImageUrl = null,
    inputImageStoragePath = null,
    projectId = null,
    workspaceId = null,
  } = request.data || {};

  if (renderPricing.imageRender[provider] === undefined) {
    throw new HttpsError("invalid-argument", `Unsupported provider: ${provider}`);
  }
  if (!String(prompt).trim() && !inputImageUrl) {
    throw new HttpsError("invalid-argument", "prompt or inputImageUrl is required");
  }

  const tokenCost = renderPricing.imageRender[provider];
  const db = admin.firestore();

  let jobId;
  try {
    jobId = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await transaction.get(userRef);

      const userData = userDoc.exists ? userDoc.data() : {};
      const plan = userData.plan || "free";

      // クレジット消費（統合プール）。docs/17 / docs/18。
      const cost = CREDIT_COST.imageRender;
      const bypass = !!userData.customAiLimits?.[provider];
      let creditsResult = null;
      if (!bypass) {
        creditsResult = consume(plan, userData.credits, cost); // 不足なら INSUFFICIENT_CREDITS
      }

      // aiUsage は分析・ジョブ記録用に加算（enforcement はクレジット側）。
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const currentDayStr = `${currentMonthStr}-${String(now.getDate()).padStart(2, "0")}`;
      const aiUsage = userData.aiUsage || {};
      const providerUsage = aiUsage[provider] || {
        dailyCount: 0, monthlyCount: 0, lastDailyResetAt: null, lastMonthlyResetAt: null,
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

      const jobRef = db
        .collection("users")
        .doc(uid)
        .collection("aiJobs")
        .doc();
      transaction.set(jobRef, {
        type: "image_render",
        provider,
        selectedModel: provider,
        planAtGeneration: plan,
        usageCountAfterGeneration: {
          dailyCount: providerUsage.dailyCount,
          monthlyCount: providerUsage.monthlyCount,
        },
        costTokens: tokenCost,
        costCredits: bypass ? 0 : cost,
        creditFromAllotment: creditsResult ? creditsResult.fromAllotment : 0,
        creditFromTopup: creditsResult ? creditsResult.fromTopup : 0,
        providerJobId: null,
        status: "pending",
        projectId,
        workspaceId,
        prompt: String(prompt),
        inputImageUrl: inputImageUrl || null,
        inputImageStoragePath: inputImageStoragePath || null,
        errorMessage: null,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return jobRef.id;
    });
  } catch (err) {
    if (err.message === "INSUFFICIENT_CREDITS") {
      throw new HttpsError("resource-exhausted", "クレジットが不足しています。追加購入またはプランのアップグレードをご検討ください。");
    }
    throw new HttpsError("internal", err.message);
  }

  // Kick off provider asynchronously
  const { renderProviderFactory } = require("./providers/providerFactory");
  renderProviderFactory
    .startJob(jobId, uid, {
      provider,
      prompt,
      inputImageUrl,
      inputImageStoragePath,
      projectId,
      workspaceId,
    })
    .catch(console.error);

  return { success: true, jobId, message: "Render job created and processing started." };
  }
);
