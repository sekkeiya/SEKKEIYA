const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const getGeminiClient = () => {
  const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

exports.onDriveAssetWritten = onDocumentWritten(
  { document: "users/{uid}/driveAssets/{assetId}", secrets: [geminiApiKey] }, 
  async (event) => {
  const beforeSnapshot = event.data.before;
  const afterSnapshot = event.data.after;

  if (!afterSnapshot.exists) {
    // Deleted
    return;
  }

  const asset = afterSnapshot.data();
  const assetRef = afterSnapshot.ref;

  // 1. Guard against soft deleted assets
  if (asset.isDeleted === true) {
    return;
  }

  // 2. Guard against already successfully analyzed assets
  if (asset.aiAnalyzed === true) {
    return;
  }

  // 3. Guard against assets not explicitly pending (or undefined for initial)
  // Valid pending states: undefined, null, or "pending"
  if (asset.analysisStatus && asset.analysisStatus !== "pending") {
    // Ignore updates changing status to "processing", "done", or "error"
    return;
  }

  // 4. Compare before/after to prevent self-trigger loop on the exact same status
  if (beforeSnapshot.exists) {
    const beforeAsset = beforeSnapshot.data();
    if (
      beforeAsset.analysisStatus === asset.analysisStatus &&
      beforeAsset.aiAnalyzed === asset.aiAnalyzed
    ) {
      // Nothing relevant changed
      return;
    }
  }

  try {
    console.log("analyzeAsset start", { assetId: event.params.assetId, uid: event.params.uid });
    console.log("asset data", asset);

    // Mark as processing (using valid transition: pending -> processing)
    // Only proceed if it was actually changed to processing inside this execution
    await assetRef.update({ analysisStatus: "processing" });

    console.log("before Gemini call");
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `AI Drive Asset Metadata Generator\n\nGiven an asset name and type, generate metadata.\n\nReturn JSON only:\n\n{\n"category": "",\n"tags": [],\n"projectType": ""\n}`
    });

    const prompt = `Name: ${asset.name || "Unknown"}
Type: ${asset.type || "unknown"}
Source: ${asset.source || "unknown"}
Storage Path: ${asset.storagePath || "none"}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const responseText = result.response.text();
    console.log("Gemini raw response", responseText);

    let generated;
    try {
      generated = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Gemini returned invalid JSON: ${parseError.message}`);
    }

    console.log("parsed result", generated);

    // Strict validation
    if (generated.tags && !Array.isArray(generated.tags)) {
      throw new Error("tags must be an array");
    }
    if (generated.category && typeof generated.category !== "string") {
      throw new Error("category must be a string");
    }

    const tags = Array.isArray(generated.tags) ? generated.tags : [];
    const category = generated.category || "Uncategorized";
    const projectType = generated.projectType || "";

    // 2. Build searchDocument and generate embedding
    const searchDocument = `name: ${asset.name || "Unknown"} | type: ${asset.type || "unknown"} | category: ${category} | tags: ${tags.join(", ")} | projectType: ${projectType}`;
    console.log("searchDocument built:", searchDocument);

    let embedding = null;
    let finalEmbeddingStatus = "error";

    try {
      console.log("Generating embedding using gemini-embedding-001...");
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const embeddingResult = await embeddingModel.embedContent(searchDocument);
      embedding = embeddingResult.embedding.values;
      
      if (Array.isArray(embedding) && embedding.length > 0) {
        finalEmbeddingStatus = "ready";
        console.log("Embedding generated successfully, length:", embedding.length);
      } else {
        console.error("Embedding generation returned empty or invalid format.");
      }
    } catch (embeddingError) {
      console.error("Error generating embedding:", embeddingError);
      finalEmbeddingStatus = "error";
    }

    console.log("before Firestore success update");

    const updatePayload = {
      tags,
      category,
      projectType,
      aiAnalyzed: true,
      analysisStatus: "done",
      searchDocument,
      embeddingStatus: finalEmbeddingStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (embedding && finalEmbeddingStatus === "ready") {
      updatePayload.embedding = embedding;
    }

    await assetRef.update(updatePayload);

    console.log(`Asset ${event.params.assetId} analyzed successfully.`);
  } catch (error) {
    console.error("analyzeAsset error", error);
    // Mark as error
    // Explicit transition: processing -> error. 
    // This will not re-trigger because of guard #3 (analysisStatus !== "pending")
    // Wait for manual intervention or a retry system to set it back to "pending"
    await assetRef.update({
      aiAnalyzed: false,
      analysisStatus: "error",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
});
