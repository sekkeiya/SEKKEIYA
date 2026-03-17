const { HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

/**
 * Helper to compute cosine similarity between two vectors.
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches driveAssets by generating an embedding for the query and
 * computing cosine similarity against stored embeddings (MVP full scan within requested scope).
 */
exports.searchDriveAssets = async (uid, query, options, apiKey) => {
  if (!uid || !query) {
    throw new HttpsError("invalid-argument", "Missing uid or query");
  }

  if (!apiKey) {
    throw new HttpsError("internal", "GEMINI_API_KEY is not configured.");
  }

  console.log(`[searchAssets] Started for uid=${uid}, query="${query}"`);

  const genAI = new GoogleGenerativeAI(apiKey);
  let queryEmbedding;

  // 1. Generate query embedding
  try {
    const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await embeddingModel.embedContent(query);
    queryEmbedding = result.embedding.values;
    console.log(`[searchAssets] Query embedding generated, length: ${queryEmbedding.length}`);
  } catch (error) {
    console.error("[searchAssets] Failed to generate query embedding:", error);
    throw new HttpsError("internal", "Failed to generate search embedding");
  }

  const { scope = "own", sourceAppFilter } = options;
  console.log(`[searchAssets] scope=${scope}, sourceAppFilter=${sourceAppFilter || "none"}`);

  // 2. Fetch candidate assets from Firestore
  const db = admin.firestore();
  
  let assetsSnapshot;

  if (scope === "public") {
    let queryRef = db.collectionGroup("driveAssets")
      .where("embeddingStatus", "==", "ready")
      .where("visibility", "==", "public");
      
    if (sourceAppFilter) {
      queryRef = queryRef.where("sourceApp", "==", sourceAppFilter);
    }
    assetsSnapshot = await queryRef.get();
  } else {
    // Default: own
    let queryRef = db.collection("users").doc(uid).collection("driveAssets")
      .where("embeddingStatus", "==", "ready");
      
    if (sourceAppFilter) {
      // Though not strictly necessary if they only have 3DSS mostly, adding for correctness
      queryRef = queryRef.where("sourceApp", "==", sourceAppFilter);
    }
    assetsSnapshot = await queryRef.get();
  }

  console.log(`[searchAssets] Fetched ${assetsSnapshot.size} ready assets for similarity check.`);

  const results = [];

  // 3. Compute cosine similarity
  assetsSnapshot.forEach((doc) => {
    const data = doc.data();
    
    // Safety checks
    if (data.isDeleted === true) return;
    if (!data.embedding || !Array.isArray(data.embedding)) return;
    if (data.embedding.length !== queryEmbedding.length) return;

    const score = cosineSimilarity(queryEmbedding, data.embedding);

    results.push({
      id: doc.id,
      name: data.name,
      type: data.type,
      category: data.category,
      imageUrl: data.imageUrl || data.thumbnailPath || null,
      folderId: data.folderId,
      source: data.source,
      sourceAssetId: data.sourceAssetId || null,
      ownerId: data.ownerId || null,
      tags: data.tags || [],
      score: score
    });
  });

  // 4. Sort and return top 10
  results.sort((a, b) => b.score - a.score);
  const top10 = results.slice(0, 10);

  console.log(`[searchAssets] Returning ${top10.length} matches.`);

  return { success: true, results: top10 };
};
