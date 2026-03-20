const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const getGeminiClient = () => {
  const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

exports.processModelUpload = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in to upload models.");
  }

  const uid = request.auth.uid;
  const { modelId, isOverwrite, modelData } = request.data;

  if (!modelId || !modelData) {
    throw new HttpsError("invalid-argument", "Missing modelId or modelData.");
  }

  const db = getFirestore();
  const batch = db.batch();

  const modelRef = db.collection("users").doc(uid).collection("models").doc(modelId);
  const driveAssetId = `asset-3dss-${modelId}`;
  const driveAssetRef = db.collection("users").doc(uid).collection("driveAssets").doc(driveAssetId);

  const serverTimestamp = FieldValue.serverTimestamp();

  // 1. Prepare Model Data
  const finalModelData = { ...modelData };
  finalModelData.updatedAt = serverTimestamp;
  if (!isOverwrite) {
    finalModelData.createdAt = serverTimestamp;
  }
  // Sanitize any Date objects or undefined values that might have come through if needed,
  // but Firebase client SDK usually sends them properly or we just rely on standard JSON behavior.

  // 2. Prepare DriveAsset Data
  const driveAssetData = {
    id: driveAssetId,
    name: finalModelData.title || finalModelData.name || "Untitled",
    type: "3d_model",
    source: "3dss",
    sourceApp: "3DSS",
    sourceAssetId: modelId,
    folderId: "root-3d-models",
    storagePath: finalModelData.files?.glb?.path || finalModelData.originalFilePath || finalModelData.modelFilePath || "",
    thumbnailPath: finalModelData.thumbnailFilePath?.path || finalModelData.thumbnailUrl || "",
    imageUrl: finalModelData.thumbnailUrl || "",
    ownerId: uid,
    visibility: finalModelData.visibility || "private",
    isDeleted: false,
    updatedAt: serverTimestamp,
    tags: finalModelData.tags || [],
  };

  if (finalModelData.dimensions !== undefined) {
    driveAssetData.dimensions = finalModelData.dimensions;
  }

  // Fetch existing asset if overwriting, to preserve aiAnalyzed state if we don't want to re-run
  let existingAsset = null;
  if (isOverwrite) {
    const snap = await driveAssetRef.get();
    if (snap.exists) existingAsset = snap.data();
  }

  if (!isOverwrite && !existingAsset) {
    driveAssetData.createdAt = serverTimestamp;
    driveAssetData.createdBy = uid;
    driveAssetData.projectId = null;
    driveAssetData.category = "Models";
    driveAssetData.aiAnalyzed = false;
    driveAssetData.embeddingStatus = "none";
  }

  // 3. AI Processing (Metadata & Embeddings)
  // Run AI if it's new, OR if we want to force re-analysis. Usually done on first upload.
  let aiTags = driveAssetData.tags;
  let aiCategory = driveAssetData.category || "Models";
  let aiProjectType = "";
  let embedding = null;
  let embeddingStatus = existingAsset ? (existingAsset.embeddingStatus || "none") : "none";
  let aiAnalyzed = existingAsset ? (existingAsset.aiAnalyzed || false) : false;
  let searchDocument = existingAsset ? (existingAsset.searchDocument || "") : "";

  // Only run Gemini if not already analyzed. 
  // Wait, if it's an overwrite and name/type changed, we might want to re-analyze? 
  // Let's stick to simple logic: run if not analyzed.
  if (!aiAnalyzed) {
    try {
      console.log(`Starting AI metadata generation for ${driveAssetId}`);
      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: `AI Drive Asset Metadata Generator\n\nGiven an asset name and type, generate metadata.\n\nReturn JSON only:\n\n{\n"category": "",\n"tags": [],\n"projectType": ""\n}`
      });

      const prompt = `Name: ${driveAssetData.name}\nType: ${driveAssetData.type}\nSource: ${driveAssetData.source}\nStorage Path: ${driveAssetData.storagePath}`;
      
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const responseText = result.response.text();
      const generated = JSON.parse(responseText);

      if (Array.isArray(generated.tags)) aiTags = Array.from(new Set([...aiTags, ...generated.tags]));
      if (typeof generated.category === "string" && generated.category) aiCategory = generated.category;
      if (typeof generated.projectType === "string") aiProjectType = generated.projectType;

      aiAnalyzed = true;
      searchDocument = `name: ${driveAssetData.name} | type: ${driveAssetData.type} | category: ${aiCategory} | tags: ${aiTags.join(", ")} | projectType: ${aiProjectType}`;

      console.log(`Starting Vector Embedding generation for ${driveAssetId}`);
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const embeddingResult = await embeddingModel.embedContent(searchDocument);
      embedding = embeddingResult.embedding.values;
      
      if (Array.isArray(embedding) && embedding.length > 0) {
        embeddingStatus = "ready";
      } else {
        embeddingStatus = "error";
      }

    } catch (err) {
      console.error("AI Analysis/Embedding failed:", err);
      // We don't throw, we just proceed without AI enhancements
      aiAnalyzed = false;
      embeddingStatus = "error";
    }
  }

  // Update driveAsset with AI results
  driveAssetData.tags = aiTags;
  driveAssetData.category = aiCategory;
  driveAssetData.aiAnalyzed = aiAnalyzed;
  driveAssetData.analysisStatus = aiAnalyzed ? "done" : "error";
  driveAssetData.embeddingStatus = embeddingStatus;
  if (aiProjectType) driveAssetData.projectType = aiProjectType;
  if (searchDocument) driveAssetData.searchDocument = searchDocument;
  if (embedding && embeddingStatus === "ready") driveAssetData.embedding = embedding;

  // 4. Execute Batch Write
  batch.set(modelRef, finalModelData, { merge: true });
  batch.set(driveAssetRef, driveAssetData, { merge: true });

  await batch.commit();
  console.log(`Successfully processed model upload for ${modelId} (User: ${uid})`);

  return { success: true, modelId, driveAssetId, aiAnalyzed, embeddingStatus };
});
