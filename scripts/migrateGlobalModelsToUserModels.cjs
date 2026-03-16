const admin = require("firebase-admin");
const path = require("path");

// Firebase Admin 初期化 (環境変数 GOOGLE_APPLICATION_CREDENTIALS にサービスアカウントの JSON パスを設定して実行することを想定)
if (!admin.apps.length) {
  // もし GOOGLE_APPLICATION_CREDENTIALS が無い場合はエラーで終了
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("Error: GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.");
    console.error("Usage: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json && node migrateGlobalModelsToUserModels.js [--apply]");
    process.exit(1);
  }
  admin.initializeApp();
}

const db = admin.firestore();

const isDryRun = !process.argv.includes("--apply");

async function migrateModels() {
  console.log(`Starting migration... Mode: ${isDryRun ? "DRY-RUN" : "APPLY"}`);
  
  const modelsRef = db.collection("models");
  let totalDocs = 0;
  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    const querySnapshot = await modelsRef.get();
    totalDocs = querySnapshot.size;
    console.log(`Found ${totalDocs} documents in global 'models' collection.`);

    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const modelId = doc.id;

      // uid 取得 ("createdBy", "ownerId", "uid", "authorId" など)
      const uid = data.createdBy || data.ownerId || data.authorId || data.uid;

      if (!uid) {
        console.warn(`[WARNING] Skipping model '${modelId}': Unable to resolve uid.`);
        skippedCount++;
        continue;
      }

      // 移行先リファレンス
      const targetRef = db.doc(`users/${uid}/models/${modelId}`);

      try {
        if (isDryRun) {
          console.log(`[DRY-RUN] Would migrate/merge model '${modelId}' to 'users/${uid}/models/${modelId}'`);
          migratedCount++;
        } else {
          // すでに存在するか確認の上、マージ。かつ isCanonical = true を保証
          await targetRef.set(
            { ...data, isCanonical: true },
            { merge: true } // 既存の情報があれば残し、足りないフィールドのみ補充
          );
          console.log(`[APPLY] Migrated/merged model '${modelId}' to 'users/${uid}/models/${modelId}'`);
          migratedCount++;
        }
      } catch (e) {
        console.error(`[ERROR] Failed to migrate model '${modelId}':`, e);
        errorCount++;
      }
    }

    console.log("\n=== Migration Summary ===");
    console.log(`Mode: ${isDryRun ? "DRY-RUN" : "APPLY"}`);
    console.log(`Total Documents Scanned: ${totalDocs}`);
    console.log(`Successfully Migrated (or intended): ${migratedCount}`);
    console.log(`Skipped (No UID): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);
    
    if (isDryRun) {
      console.log("\nThis was a DRY RUN. Run with '--apply' to actually migrate data.");
    }
    
  } catch (error) {
    console.error("Migration fatal error:", error);
  }
}

migrateModels().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
