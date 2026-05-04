const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { aiPricing, aiLimits } = require("./pricing");
const { runMockProvider } = require("./providers/mockProvider");
const { defineSecret } = require("firebase-functions/params");
const tripoApiKey = defineSecret("TRIPO_API_KEY");

exports.requestAiGeneration = onCall({ secrets: [tripoApiKey] }, async (request) => {
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
      
      // Get limits
      const limits = userData.customAiLimits?.[provider] || aiLimits[plan]?.[provider];
      if (!limits) {
        throw new Error("UNSUPPORTED_PLAN_OR_PROVIDER");
      }

      // 2. Check and Update aiUsage
      const now = new Date();
      const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentDayStr = `${currentMonthStr}-${String(now.getDate()).padStart(2, '0')}`;
      
      let aiUsage = userData.aiUsage || {};
      let providerUsage = aiUsage[provider] || {
        dailyCount: 0,
        monthlyCount: 0,
        lastDailyResetAt: null,
        lastMonthlyResetAt: null
      };

      // Reset logic
      if (providerUsage.lastDailyResetAt !== currentDayStr) {
        providerUsage.dailyCount = 0;
        providerUsage.lastDailyResetAt = currentDayStr;
      }
      if (providerUsage.lastMonthlyResetAt !== currentMonthStr) {
        providerUsage.monthlyCount = 0;
        providerUsage.lastMonthlyResetAt = currentMonthStr;
      }

      // Check limits
      if (providerUsage.dailyCount >= limits.daily) {
        throw new Error("DAILY_LIMIT_EXCEEDED");
      }
      if (providerUsage.monthlyCount >= limits.monthly) {
        throw new Error("MONTHLY_LIMIT_EXCEEDED");
      }

      // 3. Deduct tokens from wallet
      const walletRef = db.collection("users").doc(uid).collection("aiWallet").doc("default");
      const walletDoc = await transaction.get(walletRef);

      let currentBalance = 0;
      if (!walletDoc.exists) {
        currentBalance = 10000;
        transaction.set(walletRef, {
          balance: currentBalance,
          lastRefilledAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        currentBalance = walletDoc.data().balance || 0;
      }

      if (currentBalance < tokenCost) {
        throw new Error("INSUFFICIENT_TOKENS");
      }

      // Apply deductions and usage increments
      providerUsage.dailyCount += 1;
      providerUsage.monthlyCount += 1;
      aiUsage[provider] = providerUsage;
      
      transaction.update(userRef, { aiUsage });
      transaction.update(walletRef, { balance: currentBalance - tokenCost });

      // 4. Create Job
      const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc();
      transaction.set(jobRef, {
        type: "image_to_3d",
        provider,
        selectedModel: provider,
        planAtGeneration: plan,
        usageLimitAtGeneration: limits,
        usageCountAfterGeneration: {
          dailyCount: providerUsage.dailyCount,
          monthlyCount: providerUsage.monthlyCount
        },
        costTokens: tokenCost,
        costCredits: 0,
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
    if (err.message === "INSUFFICIENT_TOKENS") {
      throw new HttpsError("resource-exhausted", "Insufficient tokens in aiWallet");
    }
    if (err.message === "DAILY_LIMIT_EXCEEDED") {
      throw new HttpsError("resource-exhausted", "本日の利用上限に達しました");
    }
    if (err.message === "MONTHLY_LIMIT_EXCEEDED") {
      throw new HttpsError("resource-exhausted", "今月の利用上限に達しました");
    }
    if (err.message === "UNSUPPORTED_PLAN_OR_PROVIDER") {
      throw new HttpsError("permission-denied", "現在のプランではこのモデルは利用できません");
    }
    throw new HttpsError("internal", err.message);
  }

  // Kick off the provider asynchronously without awaiting
  // We use providerFactory to abstract the API calls
  const { providerFactory } = require("./providers/providerFactory");
  providerFactory.startJob(jobId, uid, request.data).catch(console.error);

  return { success: true, jobId, message: "Job created and processing started." };
});
