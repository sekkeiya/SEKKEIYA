const { DriveSearchService } = require("./driveSearchService");

/**
 * Helper to build the context object injected into the orchestrator.
 * 
 * Includes automatically fetched AI Drive assets based on user intent.
 */
exports.buildChatContext = async ({ uid, threadId, agentMode, passedContext = {}, history = [] }) => {
  let relevantAssets = [];

  try {
    // Basic intent extraction: take the last user message to search for relevant context
    const lastUserMessage = history.filter(m => m.role === "user").pop();
    if (lastUserMessage && lastUserMessage.content) {
      const searchService = new DriveSearchService(uid);
      relevantAssets = await searchService.semanticSearch(lastUserMessage.content, 5);
    }
  } catch (error) {
    console.error("Context build error (DriveSearch):", error);
  }

  return {
    ...passedContext,
    userUid: uid,
    activeThreadId: threadId,
    mode: agentMode,
    timestamp: new Date().toISOString(),
    relevantDriveAssets: relevantAssets
  };
};
