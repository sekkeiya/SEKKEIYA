require("dotenv").config({ path: "./.env.local" }); // Load from sekkeiya/.env.local if present
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Set up Firebase Admin
const serviceAccount = require("./service-account-key.json"); // Assuming the user has one or can authenticate via default credentials
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY);

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

async function testSearch(query) {
  console.log(`\n================================`);
  console.log(`Testing Query: "${query}"`);
  console.log(`================================`);
  
  // 1. User ID - find a user that has ready embeddings
  const usersRef = db.collection("users");
  const usersSnap = await usersRef.limit(10).get();
  
  let targetUid = null;
  let allReadyAssets = [];

  for (const userDoc of usersSnap.docs) {
    const assetsSnap = await db.collection("users").doc(userDoc.id).collection("driveAssets")
        .where("embeddingStatus", "==", "ready")
        .get();
    
    if (assetsSnap.size > 0) {
        targetUid = userDoc.id;
        assetsSnap.forEach(doc => allReadyAssets.push({ id: doc.id, ...doc.data() }));
        break; // Found a user with indexed assets
    }
  }

  if (!targetUid) {
      console.log("No users with ready embeddings found.");
      return;
  }

  console.log(`Found user ${targetUid} with ${allReadyAssets.length} indexed assets.`);
  
  // 2. Embed Query
  const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
  const result = await embeddingModel.embedContent(query);
  const queryEmbedding = result.embedding.values;

  // 3. Search
  const results = [];
  allReadyAssets.forEach(data => {
    if (data.isDeleted === true) return;
    if (!data.embedding || !Array.isArray(data.embedding)) return;
    if (data.embedding.length !== queryEmbedding.length) return;

    const score = cosineSimilarity(queryEmbedding, data.embedding);
    results.push({
      id: data.id,
      name: data.name,
      category: data.category,
      tags: data.tags || [],
      score: score
    });
  });

  results.sort((a, b) => b.score - a.score);
  const topMatches = results.slice(0, 3);

  topMatches.forEach((match, idx) => {
      console.log(`${idx + 1}. [Score: ${match.score.toFixed(3)}] ${match.name}`);
      console.log(`   Category: ${match.category}`);
      console.log(`   Tags: ${match.tags.join(", ")}`);
  });
}

async function runAllTests() {
  if (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY) {
    console.error("Please set GEMINI_API_KEY in the environment or .env.local");
    process.exit(1);
  }
  
  try {
      await testSearch("木の机");
      await testSearch("チェア");
      await testSearch("動物");
  } catch (err) {
      console.error(err);
  } finally {
      process.exit(0);
  }
}

runAllTests();
