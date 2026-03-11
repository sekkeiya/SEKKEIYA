// delete_unified_boards.mjs
// ============================================================================
// [Utility] Unified Schema Board Deletion Script
// 
// CAUTION: This script performs hard deletions on the Unified Schema (`boards`
// and its `items` subcollections). This is irreversible.
//
// Usage: 
//   node delete_unified_boards.mjs --execute --board=BOARDID
//
// Prerequisites:
// - Set GOOGLE_APPLICATION_CREDENTIALS environment variable
//   OR provide the path to serviceAccountKey.json in the script.
// ============================================================================

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env.local") });

const args = process.argv.slice(2);
const isExecute = args.includes("--execute");

if (!isExecute) {
  console.error("❌ Please specify --execute to run this script safely.");
  process.exit(1);
}

const targetBoardId = args.find(arg => arg.startsWith("--board="))?.split("=")[1];
if (!targetBoardId) {
  console.error("❌ You must explicitly pass --board=BOARDID to run this script.");
  process.exit(1);
}

// ---------------------------------------------------------
// 1. Firebase Admin Initialization
// ---------------------------------------------------------
let app;
try {
  const accountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!accountPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set.");
  }
  const serviceAccount = JSON.parse(fs.readFileSync(accountPath, "utf-8"));
  
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log(`✅ Firebase Admin initialized for project: ${serviceAccount.project_id}`);
} catch (e) {
  console.error("❌ Failed to initialize Firebase Admin.", e.message);
  process.exit(1);
}

const db = getFirestore(app);
const BATCH_SIZE = 500;

// ---------------------------------------------------------
// 2. Main Traversal Logic
// ---------------------------------------------------------
async function deleteCollection(db, collectionRef, batchSize) {
  while (true) {
    const query = collectionRef.limit(batchSize);
    const snapshot = await query.get();
    
    if (snapshot.size === 0) {
      break; 
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }
}

async function runCleanup() {
  console.log(`\n=== Deleting Unified Board: ${targetBoardId} ===\n`);

  try {
    const boardRef = db.collection("boards").doc(targetBoardId);
    const boardDoc = await boardRef.get();

    if (!boardDoc.exists) {
      console.log(`❌ Board ${targetBoardId} does not exist in the Unified Schema.`);
      // We might still want to clean up orphaned items just in case,
      // but usually if the board is gone, you can't easily query items via the console easily anyway.
      // We will attempt to delete items just in case it's orphaned.
    }

    // 1. Delete items subcollection
    const itemsRef = boardRef.collection("items");
    await deleteCollection(db, itemsRef, BATCH_SIZE);
    
    console.log(`✅ Deleted 'items' subcollection for board ${targetBoardId}.`);

    if (boardDoc.exists) {
      // 2. Delete board document
      await boardRef.delete();
      console.log(`✅ Deleted 'boards/${targetBoardId}' document.`);
    }

    console.log(`\n🎉 Unified cleanup complete for board: ${targetBoardId}\n`);

  } catch (error) {
    console.error("❌ Critical Error during unified cleanup:", error);
  }
}

// Start execution
runCleanup().catch(err => {
  console.error("Unhandled promise rejection:", err);
  process.exit(1);
});
