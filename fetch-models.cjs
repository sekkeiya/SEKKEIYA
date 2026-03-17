require("dotenv").config({ path: "./.env.local" });

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
      const response = await fetch(url);
      const data = await response.json();
      console.log("AVAILABLE MODELS:");
      if (data.models) {
          data.models.forEach(m => {
              if (m.name.includes("embed") || m.supportedGenerationMethods.includes("embedContent")) {
                  console.log(m.name, m.supportedGenerationMethods);
              }
          });
      } else {
          console.log(data);
      }
  } catch(e) {
      console.error(e);
  }
}
listModels();
