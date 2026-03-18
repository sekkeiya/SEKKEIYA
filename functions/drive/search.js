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
 * Helper to compute metadata fallback score if no embeddings
 */
function computeMetadataScore(refData, targetData) {
  let score = 0;
  
  if (refData.category && targetData.category && refData.category.slug === targetData.category.slug) {
     score += 0.5;
  } else if (refData.category === targetData.category && typeof refData.category === 'string') {
     score += 0.4;
  }
  
  const rTags = Array.isArray(refData.tags) ? refData.tags : [];
  const tTags = Array.isArray(targetData.tags) ? targetData.tags : [];
  if (rTags.length > 0 && tTags.length > 0) {
     const rT = rTags.map(t => typeof t === 'string' ? t.toLowerCase() : (t?.name || '').toLowerCase());
     const tT = tTags.map(t => typeof t === 'string' ? t.toLowerCase() : (t?.name || '').toLowerCase());
     let overlap = 0;
     rT.forEach(rt => { if (rt && tT.includes(rt)) overlap++; });
     if (overlap > 0) {
        score += (overlap / Math.max(rT.length, tT.length)) * 0.4;
     }
  }
  return score + 0.1; // Base score
}

/**
 * Searches driveAssets by generating an embedding for the query and
 * computing cosine similarity against stored embeddings (MVP full scan within requested scope).
 * Or relies on metadata similarity if `referenceAssetId` is requested but has no embeddings.
 */
exports.searchDriveAssets = async (uid, query, options, apiKey) => {
  const { scope = "own", sourceAppFilter, referenceAssetId } = options || {};

  if (!uid || (!query && !referenceAssetId)) {
    throw new HttpsError("invalid-argument", "Missing uid, query, or referenceAssetId");
  }

  if (!apiKey) {
    throw new HttpsError("internal", "GEMINI_API_KEY is not configured.");
  }

  console.log(`[searchAssets] Started for uid=${uid}, query="${query}", referenceAssetId="${referenceAssetId || "none"}"`);

  const genAI = new GoogleGenerativeAI(apiKey);
  console.log(`[searchAssets] scope=${scope}, sourceAppFilter=${sourceAppFilter || "none"}`);

  const db = admin.firestore();
  let queryEmbedding;
  let referenceData = null;

  // 1. Resolve reference model if similar search
  if (referenceAssetId) {
    console.log(`[searchAssets] Resolving referenceAssetId: ${referenceAssetId}`);
    try {
      // Reference ID might be the driveAsset ID (e.g. 'asset-3dss-xxx') or the canonical model ID ('xxx')
      const cleanRefId = referenceAssetId.replace(/^asset-(3dss|3dsl)-/, "");
      
      const refSnapshot = await db.collectionGroup("driveAssets")
        .where("sourceAssetId", "==", cleanRefId)
        .limit(1)
        .get();
        
      console.log(`[searchAssets] referenceAssetId: ${referenceAssetId}, cleanRefId: ${cleanRefId}`);
      console.log(`[searchAssets] refSnapshot empty: ${refSnapshot.empty}`);
        
      if (!refSnapshot.empty) {
        referenceData = refSnapshot.docs[0].data();
        console.log(`[searchAssets] [similar] reference asset found: true`, {
           title: referenceData.name,
           category: typeof referenceData.category === 'object' ? referenceData.category.slug : referenceData.category,
           tags: referenceData.tags?.length || 0,
           colors: referenceData.colors?.length || 0
        });
        
        if (referenceData.embedding && Array.isArray(referenceData.embedding)) {
          queryEmbedding = referenceData.embedding;
          console.log(`[searchAssets] [similar] embedding exists: true, length: ${queryEmbedding.length}`);
        } else {
          console.log(`[searchAssets] [similar] embedding exists: false. Fallback mode: metadata`);
        }
      } else {
        console.log(`[searchAssets] [similar] reference asset found: false (no matching driveAsset found for sourceAssetId: ${cleanRefId})`);
      }
    } catch (e) {
      console.error(`[searchAssets] Error resolving referenceAssetId:`, e.stack);
      if (e.code === 9 || e.message?.includes("FAILED_PRECONDITION") || e.message?.includes("index")) {
        throw new HttpsError("failed-precondition", `A Firestore index is missing for collectionGroup('driveAssets').where('sourceAssetId', '==', '${referenceAssetId}'). Details: ${e.message}`);
      }
      throw new HttpsError("internal", `Error resolving referenceAssetId: ${e.message}`);
    }
  }

  // 1.5 Generate query embedding if needed
  if (!queryEmbedding && query && query.trim() !== "") {
    try {
      const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
      const result = await embeddingModel.embedContent(query);
      queryEmbedding = result.embedding.values;
      console.log(`[searchAssets] Query embedding generated, length: ${queryEmbedding.length}`);
    } catch (error) {
      console.error("[searchAssets] Failed to generate query embedding:", error);
      throw new HttpsError("internal", "Failed to generate search embedding");
    }
  }

  let assetsSnapshot;

  try {
    if (scope === "public") {
      let queryRef = db.collectionGroup("driveAssets")
        .where("visibility", "==", "public");
        
      if (sourceAppFilter) queryRef = queryRef.where("sourceApp", "==", sourceAppFilter);

      if (queryEmbedding) {
        queryRef = queryRef.where("embeddingStatus", "==", "ready");
        assetsSnapshot = await queryRef.get();
      } else if (referenceData) {
        // Metadata Fallback
        if (referenceData.category && referenceData.category.slug) {
           queryRef = queryRef.where("category.slug", "==", referenceData.category.slug);
        } else if (typeof referenceData.category === 'string') {
           queryRef = queryRef.where("category", "==", referenceData.category);
        }
        queryRef = queryRef.limit(500);
        assetsSnapshot = await queryRef.get();
      } else {
        throw new HttpsError("invalid-argument", "Need valid query or referenceAssetId");
      }
    } else {
      // Default: own
      let queryRef = db.collection("users").doc(uid).collection("driveAssets");
        
      if (sourceAppFilter) queryRef = queryRef.where("sourceApp", "==", sourceAppFilter);

      if (queryEmbedding) {
        queryRef = queryRef.where("embeddingStatus", "==", "ready");
        assetsSnapshot = await queryRef.get();
      } else if (referenceData) {
        // Metadata Fallback
        if (referenceData.category && referenceData.category.slug) queryRef = queryRef.where("category.slug", "==", referenceData.category.slug);
        queryRef = queryRef.limit(500);
        assetsSnapshot = await queryRef.get();
      } else {
        throw new HttpsError("invalid-argument", "Need valid query or referenceAssetId");
      }
    }
  } catch (error) {
    console.error("[searchAssets] Query Error:", error.stack);
    if (error.code === 9 || error.message?.includes("FAILED_PRECONDITION") || error.message?.includes("index")) {
      console.error("[searchAssets] Firestore Index missing. Details:", error.message);
      throw new HttpsError("failed-precondition", "A necessary Firestore index is missing. Please create it in the Firebase Console.");
    }
    throw new HttpsError("internal", `Internal error computing similarities: ${error.message}`);
  }

  console.log(`[searchAssets] [similar] candidate count before scoring: ${assetsSnapshot.size}`);

  const results = [];

  // 3. Compute similarity
  assetsSnapshot.forEach((doc) => {
    const data = doc.data();
    
    if (data.isDeleted === true) return;
    
    // Skip self if reference
    if (referenceAssetId && data.sourceAssetId === referenceAssetId) return;

    let score = 0;
    if (queryEmbedding) {
      if (!data.embedding || !Array.isArray(data.embedding)) return;
      if (data.embedding.length !== queryEmbedding.length) return;
      score = cosineSimilarity(queryEmbedding, data.embedding);
    } else if (referenceData) {
      score = computeMetadataScore(referenceData, data);
      if (score < 0.2) return; // Drop weak matches in fallback
    }

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

  console.log(`[searchAssets] [similar] results count after filtering (matched): ${results.length}. Returning top: ${top10.length}`);

  return { success: true, results: top10 };
};
