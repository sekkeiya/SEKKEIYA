// cleanup_legacy_boards.mjs
// ============================================================================
// [Phase 6] Legacy Data Deletion Script
// 
// CAUTION: This script performs hard deletions on legacy schemas.
// Target Collections:
// - users/{uid}/myBoards (and its subcollections)
// - teamBoards (and its subcollections)
// - users/{uid}/teamBoards (link references)
//
// Usage: 
//   node cleanup_legacy_boards.mjs --dry-run
//   node cleanup_legacy_boards.mjs --execute
//   node cleanup_legacy_boards.mjs --execute --user=UID
//   node cleanup_legacy_boards.mjs --execute --board=BOARDID
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
const isDryRun = args.includes("--dry-run");
const isExecute = args.includes("--execute");

if (!isDryRun && !isExecute) {
  console.error("❌ Please specify either --dry-run or --execute");
  process.exit(1);
}

const targetUserId = args.find(arg => arg.startsWith("--user="))?.split("=")[1];
const targetBoardId = args.find(arg => arg.startsWith("--board="))?.split("=")[1];

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
const BATCH_SIZE = 500;

let stats = {
  usersScanned: 0,
  myBoardsDeleted: 0,
  myBoardModelsDeleted: 0,
  teamBoardLinksDeleted: 0,
  teamBoardsScanned: 0,
  teamBoardsDeleted: 0,
  teamBoardModelsDeleted: 0,
};

// ---------------------------------------------------------
// 2. Collection Deletion Logic (Pagination fixed)
// ---------------------------------------------------------
async function deleteCollection(db, collectionRef, batchSize, collectionName) {
  let lastVisible = null;

  while (true) {
    let q = collectionRef.limit(batchSize);
    
    // In dry-run we don't delete docs, so must manually advance cursor over results.
    if (isDryRun && lastVisible) {
      q = q.startAfter(lastVisible);
    }

    const snapshot = await q.get();
    const currentBatchSize = snapshot.size;

    if (currentBatchSize === 0) {
      break; 
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      if (!isDryRun) {
        batch.delete(doc.ref);
      }
    });

    if (!isDryRun) {
      await batch.commit();
    }

    if (stats[collectionName] !== undefined) {
      stats[collectionName] += currentBatchSize;
    }

    if (isDryRun) {
      lastVisible = snapshot.docs[snapshot.docs.length - 1];
    }
  }
}

// ---------------------------------------------------------
// 3. Main Traversal Logic
// ---------------------------------------------------------
async function runCleanup() {
  console.log(`\n=== Starting Legacy Boards Cleanup [Mode: ${isDryRun ? "DRY RUN" : "EXECUTE"}] ===`);
  if (targetUserId) console.log(`🎯 TARGET USER: ${targetUserId}`);
  if (targetBoardId) console.log(`🎯 TARGET BOARD: ${targetBoardId}`);
  console.log("");

  try {
    // Phase 1: Scan users/{uid} for myBoards and teamBoard links
    let usersQuery = db.collection("users");
    if (targetUserId) {
      // https://firebase.google.com/docs/firestore/query-data/queries
      const FieldPath = (await import("firebase-admin/firestore")).FieldPath;
      usersQuery = usersQuery.where(FieldPath.documentId(), "==", targetUserId);
    }
    
    const usersSnap = await usersQuery.get();
    stats.usersScanned = usersSnap.size;
    console.log(`[1/2] Scanning ${stats.usersScanned} users for myBoards and teamBoard links...`);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;

      // --- A: myBoards & their models subcollections ---
      let myBoardsQuery = db.collection(`users/${uid}/myBoards`);
      if (targetBoardId) {
        const FieldPath = (await import("firebase-admin/firestore")).FieldPath;
        myBoardsQuery = myBoardsQuery.where(FieldPath.documentId(), "==", targetBoardId);
      }
      const myBoardsSnap = await myBoardsQuery.get();
      
      for (const boardDoc of myBoardsSnap.docs) {
        const boardId = boardDoc.id;
        const modelsRef = db.collection(`users/${uid}/myBoards/${boardId}/models`);
        await deleteCollection(db, modelsRef, BATCH_SIZE, "myBoardModelsDeleted");
      }
      
      // If we filtered by a specific board, we only delete THAT board doc specifically, 
      // instead of deleting the whole myBoards collection iteratively.
      if (targetBoardId) {
        for (const boardDoc of myBoardsSnap.docs) {
          if (!isDryRun) await boardDoc.ref.delete();
          stats.myBoardsDeleted++;
        }
      } else {
        await deleteCollection(db, db.collection(`users/${uid}/myBoards`), BATCH_SIZE, "myBoardsDeleted");
      }

      // --- B: teamBoards (links) ---
      // We only delete teamBoard links if no specific targetBoardId is passed.
      // (Or we could filter it, but it's just link documents referencing boards.)
      if (!targetBoardId) {
        const teamBoardsLinksRef = db.collection(`users/${uid}/teamBoards`);
        await deleteCollection(db, teamBoardsLinksRef, BATCH_SIZE, "teamBoardLinksDeleted");
      } else {
        // If a target board IS specified, only delete the link for that specific board
        const specificLinkRef = db.doc(`users/${uid}/teamBoards/${targetBoardId}`);
        const snap = await specificLinkRef.get();
        if (snap.exists) {
          if (!isDryRun) await specificLinkRef.delete();
          stats.teamBoardLinksDeleted++;
        }
      }
    }

    // Phase 2: Scan global teamBoards and their models subcollections
    // Skip if user targeted ONLY a user and not a specific board. 
    // Because global teamBoards do not belong to just one user's hierarchy.
    if (!targetUserId) {
      let teamBoardsQuery = db.collection("teamBoards");
      if (targetBoardId) {
        const FieldPath = (await import("firebase-admin/firestore")).FieldPath;
        teamBoardsQuery = teamBoardsQuery.where(FieldPath.documentId(), "==", targetBoardId);
      }

      const teamBoardsSnap = await teamBoardsQuery.get();
      stats.teamBoardsScanned = teamBoardsSnap.size;
      console.log(`[2/2] Scanning ${stats.teamBoardsScanned} global teamBoards...`);

      for (const boardDoc of teamBoardsSnap.docs) {
        const boardId = boardDoc.id;
        const modelsRef = db.collection(`teamBoards/${boardId}/models`);
        await deleteCollection(db, modelsRef, BATCH_SIZE, "teamBoardModelsDeleted");
      }
      
      // If filtered by specific team board, just delete that specific doc
      if (targetBoardId) {
        for (const boardDoc of teamBoardsSnap.docs) {
          if (!isDryRun) await boardDoc.ref.delete();
          stats.teamBoardsDeleted++;
        }
      } else {
        await deleteCollection(db, db.collection("teamBoards"), BATCH_SIZE, "teamBoardsDeleted");
      }
    } else {
      console.log(`[2/2] Skipping global teamBoards scan because --user was explicitly targeted.`);
    }

    // Output final summary
    console.log("\n=== Cleanup Summary ===");
    console.log(`Mode:                  ${isDryRun ? "[DRY RUN - No data modified]" : "[EXECUTE - Data DELETED!]"}`);
    console.log(`Users Scanned:         ${stats.usersScanned}`);
    console.log(`MyBoards (Docs):       ${stats.myBoardsDeleted}`);
    console.log(`MyBoard Models (Docs): ${stats.myBoardModelsDeleted}`);
    console.log(`TeamBoard Links (Docs):${stats.teamBoardLinksDeleted}`);
    console.log(`TeamBoards Scanned:    ${stats.teamBoardsScanned}`);
    console.log(`TeamBoards (Docs):     ${stats.teamBoardsDeleted}`);
    console.log(`TeamBoard Models(Docs):${stats.teamBoardModelsDeleted}`);
    console.log("=======================\n");

  } catch (error) {
    console.error("❌ Critical Error during cleanup:", error);
  }
}

// Start execution
runCleanup().catch(err => {
  console.error("Unhandled promise rejection:", err);
  process.exit(1);
});
