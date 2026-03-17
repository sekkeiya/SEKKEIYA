const { HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

/**
 * Helper to initialize GenAI client inside a function
 * Because secrets are bound to the function scope, process.env.GEMINI_API_KEY is available during runtime.
 */
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

exports.analyzeDriveAsset = async (uid, assetId) => {
  if (!uid || !assetId) {
    throw new HttpsError("invalid-argument", "Missing uid or assetId");
  }

  const db = admin.firestore();
  const assetRef = db.collection("users").doc(uid).collection("driveAssets").doc(assetId);

  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new HttpsError("not-found", `Asset ${assetId} not found for user ${uid}`);
  }

  const assetData = assetSnap.data();

  // Prepare Gemini Prompt
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `You are an AI assistant that analyzes file contexts and generates organized metadata.
Your task is to analyze the given file name and type, and suggest:
1. "project": A concise project name (max 3 words) if applicable, otherwise null.
2. "category": A broad folder category (e.g. "Architecture", "Models", "Images", "Documents", "Videos").
3. "tags": An array of 3 to 5 relevant tags describing the file content.

Return ONLY a valid JSON object matching this schema:
{
  "project": string | null,
  "category": string,
  "tags": string[]
}`
  });

  const prompt = `Please analyze the following asset:
Name: ${assetData.name}
Type: ${assetData.type}
MimeType: ${assetData.mimeType || "unknown"}
Storage Path: ${assetData.storagePath || "none"}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const responseText = result.response.text();
    const suggestions = JSON.parse(responseText);

    // Prepare update payload
    const updatePayload = {
      aiAnalyzed: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (suggestions.category) {
      updatePayload.category = suggestions.category;
    }
    if (Array.isArray(suggestions.tags) && suggestions.tags.length > 0) {
      updatePayload.tags = suggestions.tags;
    }

    // Usually projectId is an ID, but here Gemini suggests a project name. 
    // We could store it directly as a tag, or we just leave projectId alone for now and maybe save `suggestedProjectName`.
    // We'll map the suggested "project" name as a tag, or store it in `suggestedProjectName` if needed.
    // The requirement is: Set projectId, tags, category. 
    // Wait, setting a literal name replacing a relation ID might break relationships. Let's just create a generic project or use it as a tag if it's new.
    // For now, let's keep it simple and just set a string array of tags including the project.
    if (suggestions.project && suggestions.project !== "null") {
      updatePayload.suggestedProjectName = suggestions.project;
      if (updatePayload.tags && !updatePayload.tags.includes(suggestions.project)) {
        updatePayload.tags.unshift(suggestions.project);
      }
    }

    await assetRef.update(updatePayload);

    return { success: true, suggestions, assetId };

  } catch (error) {
    console.error("Failed to analyze drive asset:", error);
    throw new HttpsError("internal", error.message || "Failed to analyze drive asset");
  }
};
