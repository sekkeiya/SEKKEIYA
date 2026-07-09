const admin = require('firebase-admin');

require("dotenv").config({ path: "./.env.local" });

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "shapeshare3d"
  });
}

const db = admin.firestore();

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runMigration() {
  console.log("🚀 Starting migration: users/{uid}/models (public) -> publicModelIndex");

  let totalScanned = 0;
  let copiedCount = 0;
  let skippedCount = 0;
  
  let batch = db.batch();
  let batchCount = 0;
  let commitCount = 0;

  try {
    // We can use a collectionGroup query to find all true canon models in users/{uid}/models
    const snapshot = await db.collectionGroup("models").get();
    
    console.log(`Found ${snapshot.docs.length} total raw models in collectionGroup.`);

    for (const doc of snapshot.docs) {
      const path = doc.ref.path;
      // ONLY process exactly users/{uid}/models/{modelId}
      if (!path.startsWith("users/") || path.split("/").length !== 4) {
        skippedCount++;
        continue;
      }
      
      const data = doc.data();
      
      // We only care about public models
      if (data.visibility !== "public") {
          skippedCount++;
          continue;
      }

      totalScanned++;

      // Construct a lean payload for the index
      const indexPayload = {
        modelId: doc.id,
        ownerId: data.ownerId || path.split("/")[1], // fallback to uid from path
        handle: data.handle || null,
        title: data.title || null,
        description: data.description || null,
        type: data.type || "unknown",
        mainCategory: data.mainCategory || null,
        subCategory: data.subCategory || null,
        detailCategory: data.detailCategory || null,
        tags: data.tags || [],
        price: data.price !== undefined ? data.price : null,
        size: data.size || null,
        dimensions: data.dimensions || null,
        thumbnailUrl: data.files?.thumbnail?.url || data.thumbnailUrl || null,
        files: data.files || null,
        visibility: "public",
        
        createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: doc.updateTime || admin.firestore.FieldValue.serverTimestamp()
      };

      const indexRef = db.collection("publicModelIndex").doc(doc.id);
      batch.set(indexRef, indexPayload, { merge: true });
      batchCount++;
      copiedCount++;

      if (batchCount === 400) {
        await batch.commit();
        commitCount++;
        console.log(`  Committed batch ${commitCount} (${batchCount} operations)`);
        batchCount = 0;
        batch = db.batch();
        await delay(500); // polite pause
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      commitCount++;
      console.log(`  Committed final batch ${commitCount} (${batchCount} operations)`);
    }

    console.log("✅ Migration complete.");
    console.log(`  - Total Canon Public Models: ${totalScanned}`);
    console.log(`  - Copied to publicModelIndex: ${copiedCount}`);
    console.log(`  - Skipped (Private/Board Refs): ${skippedCount}`);

  } catch (err) {
    console.error("❌ Migration failed:", err);
  }
}

runMigration();
