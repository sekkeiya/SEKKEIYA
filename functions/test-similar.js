const admin = require("firebase-admin");
// Initialize using application default credentials, or just initializeApp if emulator/env is set
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const calculateSimilarityScore = (model, referenceModel) => {
  let score = 0;
  if (!model || !referenceModel) return 0;
  if (model.type && referenceModel.type && model.type === referenceModel.type) score += 40;
  if (model.mainCategory && referenceModel.mainCategory && model.mainCategory === referenceModel.mainCategory) score += 30;
  if (model.subCategory && referenceModel.subCategory && model.subCategory === referenceModel.subCategory) score += 15;
  const extractTags = (m) => Array.isArray(m.tags) ? m.tags.map(t => typeof t === 'string' ? t : t?.slug || t?.name || "") : [];
  const refTags = extractTags(referenceModel);
  const mTags = extractTags(model);
  const matchCount = refTags.filter(t => t && mTags.includes(t)).length;
  score += matchCount * 5;
  const getDim = (m, dim) => Number(m?.dimensions?.[dim] ?? m?.size?.[dim]);
  const checkDim = (rVal, mVal) => {
     if (rVal > 0 && mVal > 0) {
        const diff = Math.abs(rVal - mVal)/rVal;
        if (diff <= 0.1) return 10;
        if (diff <= 0.2) return 5;
     }
     return 0;
  };
  let sizeScore = checkDim(getDim(referenceModel, 'width'), getDim(model, 'width'))
                + checkDim(getDim(referenceModel, 'depth'), getDim(model, 'depth'))
                + checkDim(getDim(referenceModel, 'height'), getDim(model, 'height'));
  score += Math.min(10, sizeScore);
  return Math.min(score, 100);
};

async function runTest() {
  const snap = await db.collection("models").where("visibility", "==", "public").limit(100).get();
  const sourceModels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  console.log(`[SimilarModels Pipeline] sourceModels.length: ${sourceModels.length}`);
  console.log(`[SimilarModels Pipeline] sourceModels top 3:`, JSON.stringify(sourceModels.slice(0,3).map(m => ({ id: m.id, title: m.title, type: m.type, mainCategory: m.mainCategory, subCategory: m.subCategory })), null, 2));

  // Find a sofa
  let refModel = sourceModels.find(m => m.title?.toLowerCase().includes("sofa") || m.mainCategory === "Sofa" || m.subCategory === "sofa" || m.type === "sofa");
  if (!refModel && sourceModels.length > 0) refModel = sourceModels[0];
  
  if (!refModel) {
    console.log("No reference model found.");
    return;
  }

  console.log(`[SimilarModels Pipeline] selectedModel:`, JSON.stringify({ id: refModel.id, type: refModel.type, mainCategory: refModel.mainCategory, subCategory: refModel.subCategory }, null, 2));

  let finalCandidates = [];
  
  // Simulating 0 Semantic hits
  // 2. Score based fallback
  const scored = sourceModels.map(m => {
    return { ...m, similarityScore: calculateSimilarityScore(m, refModel) };
  }).filter(m => m.id !== refModel.id);
  
  scored.sort((a,b) => b.similarityScore - a.similarityScore);
  
  const scoreBased = scored.filter(m => m.similarityScore >= 15);
  finalCandidates = [...scoreBased];
  console.log(`[SimilarModels Pipeline] Step 2: Score Based Fallback hits = ${finalCandidates.length}`);
  
  if (finalCandidates.length < 5) {
     const sameCat = scored.filter(m => m.mainCategory === refModel.mainCategory && m.similarityScore < 15);
     for(const m of sameCat) {
        if (finalCandidates.length >= 5) break;
        if (!finalCandidates.find(x => x.id === m.id)) finalCandidates.push(m);
     }
     console.log(`[SimilarModels Pipeline] Step 3: Padded with sameMainCategory = ${finalCandidates.length}`);
  }
  
  if (finalCandidates.length < 5) {
     for(const m of scored) {
        if (finalCandidates.length >= 5) break;
        if (!finalCandidates.find(x => x.id === m.id)) finalCandidates.push(m);
     }
     console.log(`[SimilarModels Pipeline] Step 4: Padded with sourceModels top 5 = ${finalCandidates.length}`);
  }

  const candidateMap = new Map();
  finalCandidates.forEach(m => {
    if (m.id !== refModel.id) {
       if (!candidateMap.has(m.id)) {
          candidateMap.set(m.id, m);
       }
    }
  });
  
  let finalResults = Array.from(candidateMap.values());
  finalResults.sort((a,b) => b.similarityScore - a.similarityScore);

  console.log(`[SimilarModels Pipeline] finalResults.length: ${finalResults.length}`);
  console.log(`[SimilarModels Pipeline] finalResults top 5:`, JSON.stringify(finalResults.slice(0,5).map(x => ({ id: x.id, similarityScore: x.similarityScore })), null, 2));
}

runTest().catch(console.error);
