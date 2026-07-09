// soft_delete_legacy_boards.mjs
// ============================================================================
// [Phase 22] Legacy Boards Soft Deletion Script
// 
// Target Collections:
// - projects/{projectId}/boards/{boardId}
//
// Action: Adds `isDeleted: true` and `deletedAt: serverTimestamp()` to legacy boards.
//
// Usage: 
//   node scripts/soft_delete_legacy_boards.mjs --dry-run
//   node scripts/soft_delete_legacy_boards.mjs --execute
//
// Prerequisites:
// - Set GOOGLE_APPLICATION_CREDENTIALS environment variable
//   OR provide the path to serviceAccountKey.json in the script.
// ============================================================================

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isExecute = args.includes("--execute");

if (!isDryRun && !isExecute) {
  console.error("❌ Please specify either --dry-run or --execute");
  process.exit(1);
}

// ---------------------------------------------------------
// 1. Firebase Admin Initialization
// ---------------------------------------------------------
let app;
try {
  const accountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!accountPath) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local or environment.");
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

let stats = {
  projectsScanned: 0,
  boardsMarkedDeleted: 0,
};

// ---------------------------------------------------------
// 2. Main Traversal Logic
// ---------------------------------------------------------
async function runSoftDelete() {
  console.log(`\n=== Starting Legacy Boards Soft Deletion [Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}] ===\n`);

  try {
    const projectsSnap = await db.collection("projects").get();
    stats.projectsScanned = projectsSnap.size;
    console.log(`Scanning ${stats.projectsScanned} projects...\n`);

    for (const projectDoc of projectsSnap.docs) {
      const projectId = projectDoc.id;
      
      const boardsSnap = await db.collection(`projects/${projectId}/boards`).get();
      if (boardsSnap.empty) {
        continue;
      }

      console.log(`Processing Project: ${projectId}`);
      const batch = db.batch();
      let count = 0;

      for (const boardDoc of boardsSnap.docs) {
        const boardId = boardDoc.id;
        const boardData = boardDoc.data();
        
        // Skip if already soft deleted
        if (boardData.isDeleted) {
          continue;
        }

        if (!isDryRun) {
          batch.update(boardDoc.ref, {
            isDeleted: true,
            deletedAt: FieldValue.serverTimestamp()
          });
        }
        count++;
        stats.boardsMarkedDeleted++;
        console.log(`  Marked Board as Deleted: ${boardId}`);
      }

      if (count > 0 && !isDryRun) {
        await batch.commit();
        console.log(`  Committed ${count} soft deletions for project ${projectId}.`);
      }
    }

    // Output final summary
    console.log("\n=== Soft Deletion Summary ===");
    console.log(`Mode:            ${isDryRun ? "[DRY RUN - No data modified]" : "[EXECUTE - Data updated successfully]"}`);
    console.log(`Projects Scanned:${stats.projectsScanned}`);
    console.log(`Boards Marked:   ${stats.boardsMarkedDeleted}`);
    console.log("=======================\n");

  } catch (error) {
    console.error("❌ Critical Error during migration:", error);
  }
}

// Start execution
runSoftDelete().catch(err => {
  console.error("Unhandled promise rejection:", err);
  process.exit(1);
});
