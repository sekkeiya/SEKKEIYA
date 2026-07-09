// Test script to verify the proposeDesktopAction logic
const { proposeDesktopAction } = require("./proposeDesktopAction");
const provider = require("./provider");

// Mock generateChatResponse
const originalGen = provider.generateChatResponse;

async function runTests() {
  console.log("=== Scenario 1: CREATE_PROJECT Success ===");
  provider.generateChatResponse = async () => ({
    text: JSON.stringify({
      intent: "CREATE_PROJECT",
      actionType: "CREATE_PROJECT",
      assistantMessage: "「テスト」プロジェクトを作成します。",
      payload: { projectName: "テスト" }
    })
  });
  const res1 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "テストのプロジェクトを作って" });
  console.log("Result 1:", res1);
  console.log("\n");

  console.log("=== Scenario 2: RESPOND_CHAT Success ===");
  provider.generateChatResponse = async () => ({
    text: JSON.stringify({
      intent: "GENERAL_CHAT",
      actionType: "RESPOND_CHAT",
      assistantMessage: "こんにちは！何をお作りしましょうか？",
      payload: {}
    })
  });
  const res2 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "こんにちは" });
  console.log("Result 2:", res2);
  console.log("\n");

  console.log("=== Scenario 3: Error / Fallback (Invalid JSON / Invalid Payload) ===");
  provider.generateChatResponse = async () => ({
    // LLM outputs markdown instead of raw JSON
    text: "```json\n{ \"intent\": \"ERROR\", \"actionType\": \"CREATE_PROJECT\", \"payload\": { \"projectName\": \"\" } }\n```"
  });
  const res3 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "空のプロジェクトを作って" });
  console.log("Result 3:", res3);
  console.log("\n");

  console.log("=== Scenario 4: Complete Failure (LLM Hallucination) ===");
  provider.generateChatResponse = async () => {
    throw new Error("OpenAI API Timeout");
  };
  const res4 = await proposeDesktopAction({ uid: "user1", systemPromptContext: "sys", userMessage: "タイムアウト起こして" });
  console.log("Result 4:", res4);
}

runTests().catch(console.error);
