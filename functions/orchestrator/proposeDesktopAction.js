const { generateChatResponse } = require("./provider");

const desktopSystemPromptBase = `You are the SEKKEIYA AI Core Orchestrator.
Your goal is to parse the user's intent and return a JSON payload matching the OrchestratorResponse contract.

# Allowed Action Types:
You are strictly limited to predicting ONE of the following action types:
1. "CREATE_PROJECT" - Create a new project. 
   - Payload must contain: { "projectName": "name of the project" }
2. "OPEN_WORKSPACE" - Open a specific workspace based on user intent.
   - Payload must contain: { "target": "3dss" | "3dsl" | "3dsp" | "canvas" }
   - "3dss": "家具を探したい" / "3D Model / Item Search"
   - "3dsl": "レイアウトを作りたい" / "Room Layout"
   - "3dsp": "提案資料を作りたい" / "Presentation Board"
   - "canvas": "キャンバスを開いて" / "AI Canvas Generation"
3. "RESPOND_CHAT" - Direct response or standard chat reply.
   - Payload is not required.
   - Use this if the user asks about something in the workspace they are currently in (e.g., asking to search models while already in 3DSS). Do NOT use OPEN_WORKSPACE for the workspace they are already in.
4. "SEARCH_DSS" - Execute a search for 3D models/items within the 3DSS workspace.
   - Payload must contain: { "query": "search term", "category": "optional category", "subCategory": "optional subcategory", "tags": "optional comma-separated tags" }
   - Use this if the user asks to find, search for, or locate similar items, furniture, or models.

If you don't know what to do, default to "RESPOND_CHAT".
Do NOT output "OPEN_CHAT_PANEL" or "TRIGGER_CANVAS" at this time.

# Output JSON Contract:
You must return a raw JSON object string with NO markdown formatting, strictly matching this interface:
{
  "intent": string,             // Short internal desc of the intent, e.g. "OPEN_WORKSPACE", "CREATE_PROJECT"
  "actionType": string,         // "CREATE_PROJECT" | "OPEN_WORKSPACE" | "RESPOND_CHAT" | "SEARCH_DSS"
  "assistantMessage": string,   // What the assistant should display to the user in the desktop chat panel
  "payload": object,            // Required fields for the specific actionType
  "requiresConfirmation": boolean, // Make this true if CREATE_PROJECT
  "riskLevel": "low" | "medium" | "high" // "low" for OPEN_WORKSPACE/RESPOND_CHAT, "medium" for CREATE_PROJECT
}

Make sure to ALWAYS format your output as a valid JSON object.
`;

exports.proposeDesktopAction = async ({ uid, systemPromptContext, userMessage }) => {
  // Combine the dynamic context from desktop with the strict backend instruction
  const finalSystemPrompt = `${systemPromptContext}\n\n${desktopSystemPromptBase}`;

  const messages = [
    { role: "user", content: userMessage }
  ];

  try {
    const providerName = "gemini";
    const startTime = Date.now();
    
    // Observability Logging (for development)
    console.log(`[Orchestrator Backend] Starting action proposal...`);
    console.log(`- Provider: ${providerName}`);
    console.log(`- UserMessage: ${userMessage.slice(0, 50)}...`);
    console.log(`- SystemPrompt Length: ${finalSystemPrompt.length} chars`);

    console.log("[Orchestrator Backend] Debugging API Keys:");
    const geminiKey = process.env.GEMINI_API_KEY || "";
    console.log("- GEMINI_API_KEY exists:", !!geminiKey, "length:", geminiKey.length, "starts with:", geminiKey.substring(0, 4));
    
    const result = await generateChatResponse({
      provider: providerName,
      model: "gemini-flash-latest", // Updated to generic latest alias as 1.5 is removed
      systemPrompt: finalSystemPrompt,
      messages: messages,
      metadata: { expectJson: true }
    });

    const rawText = result.text.trim();
    console.log(`[Orchestrator Backend] Raw LLM Response:`, rawText);
    console.log(`- Duration: ${Date.now() - startTime}ms`);

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      // Basic fallback if LLM wraps in markdown
      const jsonMatch = rawText.match(/```json\n([\s\S]*)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        console.warn(`[Orchestrator Backend] Invalid JSON fallback triggered. Raw Output: ${rawText}`);
        parsed = {
           intent: "ERROR",
           actionType: "RESPOND_CHAT",
           assistantMessage: "すみません、システムエラーにより応答を解釈できませんでした。",
           payload: {}
        };
      }
    }

    // Default normalization safety net
    let normalizedActionType = parsed.actionType && ["CREATE_PROJECT", "OPEN_WORKSPACE", "RESPOND_CHAT", "SEARCH_DSS"].includes(parsed.actionType) ? parsed.actionType : "RESPOND_CHAT";
    let normalizedPayload = parsed.payload || {};
    let assistantMessage = parsed.assistantMessage || parsed.message || "処理を完了しました。";

    // Validation: CREATE_PROJECT payload
    if (normalizedActionType === "CREATE_PROJECT") {
       const pName = normalizedPayload.projectName;
       if (typeof pName !== "string" || pName.trim() === "" || pName.length > 100) {
          console.warn(`[Orchestrator Backend] Invalid CREATE_PROJECT payload. Falling back to RESPOND_CHAT. Payload:`, normalizedPayload);
          normalizedActionType = "RESPOND_CHAT";
          assistantMessage = "プロジェクト名が無効です。100文字以内で明確な名前をもう一度教えていただけますか？";
          normalizedPayload = {};
       }
    }
    
    // Validation: OPEN_WORKSPACE payload
    if (normalizedActionType === "OPEN_WORKSPACE") {
       const target = normalizedPayload.target;
       if (!["3dss", "3dsl", "3dsp", "canvas"].includes(target)) {
          console.warn(`[Orchestrator Backend] Invalid OPEN_WORKSPACE payload. Falling back to RESPOND_CHAT. Payload:`, normalizedPayload);
          normalizedActionType = "RESPOND_CHAT";
          assistantMessage = "開きたい機能が見つかりませんでした。別の言い方で教えていただけますか？";
          normalizedPayload = {};
       }
    }

    const finalResponse = {
      intent: parsed.intent || "GENERAL_CHAT",
      actionType: normalizedActionType,
      assistantMessage: assistantMessage,
      payload: normalizedPayload,
      requiresConfirmation: parsed.requiresConfirmation || false,
      riskLevel: parsed.riskLevel || "low"
    };

    console.log(`[Orchestrator Backend] Final Normalized Response:`, JSON.stringify(finalResponse, null, 2));
    return finalResponse;

  } catch (error) {
    console.error(`[Orchestrator Backend] Error:`, error);
    // Safe generic fallback so UI doesn't crash
    return {
      intent: "ERROR_FALLBACK",
      actionType: "RESPOND_CHAT",
      assistantMessage: "バックエンドでエラーが発生しました。時間をおいて再試行してください。",
      payload: {},
      requiresConfirmation: false,
      riskLevel: "low"
    };
  }
};
