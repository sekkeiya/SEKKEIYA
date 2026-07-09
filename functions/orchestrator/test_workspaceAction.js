// Test script to verify the proposeDesktopAction logic for OPEN_WORKSPACE
const { proposeDesktopAction } = require("./proposeDesktopAction");
const provider = require("./provider");

// Mock generateChatResponse
const originalGen = provider.generateChatResponse;

async function runTests() {
  console.log("=== Scenario 1: OPEN_WORKSPACE (3DSL) ===");
  provider.generateChatResponse = async () => ({
    text: JSON.stringify({
      intent: "OPEN_WORKSPACE",
      actionType: "OPEN_WORKSPACE",
      assistantMessage: "レイアウト作成画面(3DSL)を開きます。",
      payload: { target: "3dsl" }
    })
  });
  const res1 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "レイアウトを作りたい" });
  console.log("Result 1:", res1);
  console.log("\n");

  console.log("=== Scenario 2: OPEN_WORKSPACE (3DSS) ===");
  provider.generateChatResponse = async () => ({
    text: JSON.stringify({
      intent: "OPEN_WORKSPACE",
      actionType: "OPEN_WORKSPACE",
      assistantMessage: "家具検索システム(3DSS)を起動します。",
      payload: { target: "3dss" }
    })
  });
  const res2 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "家具を探したい" });
  console.log("Result 2:", res2);
  console.log("\n");

  console.log("=== Scenario 3: OPEN_WORKSPACE (Fallback) ===");
  provider.generateChatResponse = async () => ({
    text: JSON.stringify({
      intent: "OPEN_WORKSPACE",
      actionType: "OPEN_WORKSPACE",
      assistantMessage: "開きます。",
      payload: { target: "invalid_target" }
    })
  });
  const res3 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "なんか開いて" });
  console.log("Result 3:", res3);
  console.log("\n");
}

runTests().catch(console.error);
