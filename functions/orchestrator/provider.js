// Ensure API keys are set in Firebase environment config or use process.env for local testing
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to initialize GenAI client
const getGeminiClient = () => {
  // Use config or env var fallback
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Provider Abstraction Layer
 */
exports.generateChatResponse = async ({ provider, model, systemPrompt, messages, metadata, onChunk }) => {
  switch (provider) {
    case "gemini":
      return await callGemini(model, systemPrompt, messages, metadata, onChunk);
    case "openai":
      throw new Error("OpenAI provider not yet implemented. Please implement `callOpenAI`.");
    case "anthropic":
      throw new Error("Anthropic provider not yet implemented. Please implement `callAnthropic`.");
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

async function callGemini(modelName, systemPrompt, messages, metadata, onChunk) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });

  // Convert schema if needed (GoogleGenerativeAI handles role: 'user'/'model')
  const formattedContents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  try {
    if (onChunk) {
      const result = await model.generateContentStream({
        contents: formattedContents
      });

      let fullText = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onChunk(chunkText);
      }

      const response = await result.response;
      return {
        text: fullText,
        tokenUsage: {
          promptTokens: response.usageMetadata?.promptTokenCount,
          completionTokens: response.usageMetadata?.candidatesTokenCount,
          totalTokens: response.usageMetadata?.totalTokenCount,
        }
      };
    } else {
      const result = await model.generateContent({
        contents: formattedContents
      });

      return {
        text: result.response.text(),
        tokenUsage: {
          promptTokens: result.response.usageMetadata?.promptTokenCount,
          completionTokens: result.response.usageMetadata?.candidatesTokenCount,
          totalTokens: result.response.usageMetadata?.totalTokenCount,
        }
      };
    }
  } catch (err) {
    console.error("Gemini Error:", err);
    throw err;
  }
}
