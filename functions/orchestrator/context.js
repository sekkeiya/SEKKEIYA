/**
 * Helper to build the context object injected into the orchestrator.
 * 
 * Future-ready for:
 * - AI Drive selected assets
 * - current board
 * - selected 3DSS models
 * - selected 3DSL layouts
 * - project metadata
 */
exports.buildChatContext = async ({ uid, threadId, agentMode, passedContext = {} }) => {
  // Currently, we just return the passed context as is + metadata
  // In the future, we could query Firestore to fetch 
  // 'users/uid/driveAssets' or similar based on `passedContext.selectedAssetIds`
  return {
    ...passedContext,
    userUid: uid,
    activeThreadId: threadId,
    mode: agentMode,
    timestamp: new Date().toISOString()
  };
};
