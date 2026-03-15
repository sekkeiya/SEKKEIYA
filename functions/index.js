/**
 * SEKKEIYA AI Orchestrator Main Entrypoint
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { routeChatRequest } = require("./orchestrator/route");
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
