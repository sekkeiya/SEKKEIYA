require("dotenv").config({ path: "./.env.local" });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testEmbedding() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  try {
      const model = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });
      const result = await model.embedContent("test");
      console.log("Without config length:", result.embedding.values.length);
      
      const model2 = genAI.getGenerativeModel({ model: "gemini-embedding-2-preview" });
      const result2 = await model2.embedContent({content: {parts: [{text:"test"}]}, config: { outputDimensionality: 768 }});
      console.log("With config length:", result2.embedding.values.length);
  } catch (e) {
      console.error("FAILED:", e.message);
  }
}

testEmbedding();
