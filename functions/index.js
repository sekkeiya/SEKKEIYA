/**
 * SEKKEIYA AI Orchestrator Main Entrypoint
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { routeChatRequest } = require("./orchestrator/route");
const { onUserModelsWritten } = require("./models/sync");
const { analyzeDriveAsset } = require("./drive/analyze");
const { onDriveAssetWritten } = require("./drive/analyzeAsset");
const { generateAssetEmbedding } = require("./drive/embedding");
const { searchDriveAssets } = require("./drive/search");
const admin = require("firebase-admin");

admin.initializeApp();

const geminiApiKey = defineSecret("GEMINI_API_KEY");

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

exports.onUserModelsWritten = onUserModelsWritten;
exports.onDriveAssetWritten = onDriveAssetWritten;

exports.analyzeDriveAsset = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await analyzeDriveAsset(request.auth.uid, request.data.assetId);
});

exports.generateAssetEmbedding = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in.");
  return await generateAssetEmbedding(request.auth.uid, request.data.assetId);
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
