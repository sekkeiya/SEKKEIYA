const admin = require("firebase-admin");
const { buildChatContext } = require("./context");
const { buildSystemPrompt } = require("./agent");
const { generateChatResponse } = require("./provider");

/**
 * Route Chat Request (The main Orchestrator logic)
 */
exports.routeChatRequest = async ({
  uid,
  threadId,
  agentMode,
  provider,
  model,
  context,
}) => {
  const db = admin.firestore();
  const threadRef = db.collection("users").doc(uid).collection("chatThreads").doc(threadId);
  const messagesRef = threadRef.collection("messages");

  // 1. Load History
  const snapshot = await messagesRef.orderBy("createdAt", "asc").get();
  const history = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Exclude system prompts or intermediate tools from actual visible history if needed,
    // but for now we send what's there.
    if (data.role === "user" || data.role === "assistant") {
      history.push({ role: data.role, content: data.text });
    }
  });

  // 2. Build Context
  const orchestratorContext = await buildChatContext({ uid, threadId, agentMode, passedContext: context });

  // 3. Build System Prompt based on agentMode
  const systemPrompt = buildSystemPrompt(agentMode, orchestratorContext);

  // 4. Update Assistant Message to 'streaming' (initially empty) state
  const assistantMsgRef = messagesRef.doc();
  await assistantMsgRef.set({
    id: assistantMsgRef.id,
    role: "assistant",
    text: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    status: "streaming",
    source: provider,
    model: model
  });

  // Track partial text for streaming and error recovery
  let currentText = "";

  try {
    let lastUpdateTime = Date.now();
    const THROTTLE_MS = 1000;

    // 5. Call LLM with stream handler
    const result = await generateChatResponse({
      provider,
      model,
      systemPrompt,
      messages: history,
      metadata: orchestratorContext,
      onChunk: (chunkText) => {
        currentText += chunkText;
        const now = Date.now();
        // Throttle Firestore writes
        if (now - lastUpdateTime >= THROTTLE_MS) {
          lastUpdateTime = now;
          // Fire-and-forget update to avoid blocking stream consumption
          assistantMsgRef.update({
            text: currentText,
            status: "streaming"
          }).catch(err => console.error("Stream update error:", err));
        }
      }
    });

    // 6. Save LLM result to Firestore
    await assistantMsgRef.update({
      text: result.text,
      status: "done",
      tokenUsage: result.tokenUsage || null
    });

    // Update Thread metadata
    await threadRef.update({
      lastMessageText: result.text,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { responseId: assistantMsgRef.id };

  } catch (error) {
    // Save Error State
    await assistantMsgRef.update({
      status: "error",
      text: currentText, // Preserve partial text if it failed mid-stream
      errorMessage: error.message || "Failed to generate AI response",
    });
    throw error;
  }
};
