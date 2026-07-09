// migrate_boards_to_sections.mjs
// ============================================================================
// [Phase 22] Legacy Data Copy Script (boards -> sections)
// 
// Target Collections:
// - projects/{projectId}/boards/{boardId} -> projects/{projectId}/sections/{boardId}
// - projects/{projectId}/boards/{boardId}/items/{itemId} -> projects/{projectId}/sections/{boardId}/items/{itemId}
//
// Usage: 
//   node scripts/migrate_boards_to_sections.mjs --dry-run
//   node scripts/migrate_boards_to_sections.mjs --execute
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
  boardsCopied: 0,
  itemsCopied: 0,
};

// ---------------------------------------------------------
// 2. Main Traversal Logic
// ---------------------------------------------------------
async function runMigration() {
  console.log(`\n=== Starting Boards to Sections Migration [Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}] ===\n`);

  try {
    const projectsSnap = await db.collection("projects").get();
    stats.projectsScanned = projectsSnap.size;
    console.log(`Scanning ${stats.projectsScanned} projects...\n`);

    for (const projectDoc of projectsSnap.docs) {
      const projectId = projectDoc.id;
      console.log(`Processing Project: ${projectId}`);
      
      const boardsSnap = await db.collection(`projects/${projectId}/boards`).get();
      if (boardsSnap.empty) {
        console.log(`  No legacy boards found.`);
        continue;
      }

      for (const boardDoc of boardsSnap.docs) {
        const boardId = boardDoc.id;
        const boardData = boardDoc.data();
        
        // Copy to sections
        const sectionRef = db.doc(`projects/${projectId}/sections/${boardId}`);
        
        if (!isDryRun) {
          await sectionRef.set(boardData, { merge: true });
        }
        stats.boardsCopied++;
        console.log(`  Copied Board: ${boardId} -> Section: ${boardId}`);

        // Copy items collection inside the board
        const itemsSnap = await db.collection(`projects/${projectId}/boards/${boardId}/items`).get();
        if (!itemsSnap.empty) {
          const batch = db.batch();
          let count = 0;
          
          itemsSnap.docs.forEach((itemDoc) => {
            const itemId = itemDoc.id;
            const itemData = itemDoc.data();
            const newItemRef = db.doc(`projects/${projectId}/sections/${boardId}/items/${itemId}`);
            
            if (!isDryRun) {
              batch.set(newItemRef, itemData, { merge: true });
            }
            count++;
            stats.itemsCopied++;
          });
          
          if (!isDryRun) {
            await batch.commit();
          }
          console.log(`    Copied ${count} items from ${boardId}/items.`);
        }
      }
    }

    // Output final summary
    console.log("\n=== Migration Summary ===");
    console.log(`Mode:            ${isDryRun ? "[DRY RUN - No data modified]" : "[EXECUTE - Data copied successfully]"}`);
    console.log(`Projects Scanned:${stats.projectsScanned}`);
    console.log(`Boards Copied:   ${stats.boardsCopied}`);
    console.log(`Items Copied:    ${stats.itemsCopied}`);
    console.log("=======================\n");

  } catch (error) {
    console.error("❌ Critical Error during migration:", error);
  }
}

// Start execution
runMigration().catch(err => {
  console.error("Unhandled promise rejection:", err);
  process.exit(1);
});
