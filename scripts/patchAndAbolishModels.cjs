const admin = require("firebase-admin");

// Firebase Admin 初期化
if (!admin.apps.length) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
    console.error("Usage: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json && node patchAndAbolishModels.cjs [--apply]");
    process.exit(1);
  }
  admin.initializeApp();
}

const db = admin.firestore();
const isDryRun = !process.argv.includes("--apply");

async function run() {
  console.log(`\n=== Phase 10.8: Abolish Root /models & Patch Taxonomy ===`);
  console.log(`Mode: ${isDryRun ? "DRY-RUN (No changes)" : "APPLY (Writing changes)"}\n`);

  // 1. Migrate & Delete root /models
  const rootModelsRef = db.collection("models");
  const rootModelsSnap = await rootModelsRef.get();
  
  let migratedCount = 0;
  let deletedCount = 0;
  let skippedCount = 0;

  console.log(`[Step 1] Found ${rootModelsSnap.size} documents in root '/models'.`);

  for (const doc of rootModelsSnap.docs) {
    const data = doc.data();
    const modelId = doc.id;
    const uid = data.createdBy || data.ownerId || data.authorId || data.uid;

    if (!uid) {
      console.warn(`  [WARNING] Root model '${modelId}' has no UID. Cannot migrate. Will still delete if APPLY.`);
      skippedCount++;
    } else {
      const targetRef = db.doc(`users/${uid}/models/${modelId}`);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        if (!isDryRun) {
          await targetRef.set({ ...data, isCanonical: true }, { merge: true });
        }
        console.log(`  Moved model '${modelId}' to users/${uid}/models/ (was missing)`);
        migratedCount++;
      }
    }

    if (!isDryRun) {
      await doc.ref.delete();
    }
    deletedCount++;
  }

  // 2. Patch Users' Models (`users/{uid}/models/{modelId}`)
  const modelsGroupSnap = await db.collectionGroup("models").get();
  
  let patchedCount = 0;
  let scannedUserModels = 0;

  console.log(`\n[Step 2] Scanning all models across the database for missing taxonomy...`);

  for (const doc of modelsGroupSnap.docs) {
    // collectionGroup("models") catches users/{uid}/models, teamBoards/{id}/models, etc.
    // We only want to patch canonical models in users/{uid}/models.
    const pathSegments = doc.ref.path.split("/");
    if (pathSegments.length !== 4 || pathSegments[0] !== "users" || pathSegments[2] !== "models") {
      continue; // Skip board items or nested models
    }

    scannedUserModels++;
    const data = doc.data();
    const updates = {};
    let needsPatch = false;

    if (!data.type) { updates.type = "furniture"; needsPatch = true; }
    if (!data.mainCategory) { updates.mainCategory = ["未分類"]; needsPatch = true; }
    if (!data.subCategory) { updates.subCategory = ["未分類"]; needsPatch = true; }
    if (data.price === undefined) { updates.price = 0; needsPatch = true; }
    if (!data.visibility) { updates.visibility = "public"; needsPatch = true; }
    if (data.isCanonical === undefined) { updates.isCanonical = true; needsPatch = true; }

    if (needsPatch) {
      if (!isDryRun) {
        await doc.ref.update(updates);
      }
      console.log(`  Patched model '${doc.id}' (Missing fields: ${Object.keys(updates).join(", ")})`);
      patchedCount++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Root Models Migrated: ${migratedCount}`);
  console.log(`Root Models Deleted : ${deletedCount} ${isDryRun ? "(simulated)" : "(Actual Deleted)"}`);
  console.log(`User Models Scanned : ${scannedUserModels}`);
  console.log(`User Models Patched : ${patchedCount} ${isDryRun ? "(simulated)" : "(Actual Patched)"}`);
  if (isDryRun) console.log(`\nRun with \`--apply\` to execute changes.`);
}

run().then(() => process.exit(0)).catch(e => {
  console.error("Fatal Error:", e);
  process.exit(1);
});
