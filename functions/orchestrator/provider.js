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
      return await callOpenAI(model, systemPrompt, messages, metadata, onChunk);
    case "anthropic":
      throw new Error("Anthropic provider not yet implemented. Please implement `callAnthropic`.");
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
};

async function callOpenAI(modelName, systemPrompt, messages, metadata, onChunk) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not defined in the environment.");
  }

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }))
  ];

  try {
    const isJsonRequested = systemPrompt.includes("json") || (metadata && metadata.expectJson);
    const body = {
      model: modelName || "gpt-4o",
      messages: formattedMessages,
      response_format: isJsonRequested ? { type: "json_object" } : undefined,
      stream: !!onChunk,
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`OpenAI Error: ${response.status} - ${errorData}`);
    }

    if (onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunkStr = decoder.decode(value, { stream: true });
        
        // Very basic naive parsing of SSE. For a robust implementation you'd use a proper event stream parser.
        const lines = chunkStr.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
              const data = JSON.parse(line.slice(6));
              const delta = data.choices[0]?.delta?.content || "";
              fullText += delta;
              onChunk(delta);
            } catch (e) {
              // ignore parse errors for partial chunks
            }
          }
        }
      }
      return { text: fullText }; 
    } else {
      const data = await response.json();
      const text = data.choices[0]?.message?.content || "";
      return {
        text,
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        }
      };
    }
  } catch (err) {
    console.error("OpenAI Error:", err);
    throw err;
  }
}

async function callGemini(modelName, systemPrompt, messages, metadata, onChunk) {
  const genAI = getGeminiClient();
  
  const modelConfig = { model: modelName, systemInstruction: systemPrompt };
  if (metadata && metadata.expectJson) {
    modelConfig.generationConfig = { responseMimeType: "application/json" };
  }
  const model = genAI.getGenerativeModel(modelConfig);

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
