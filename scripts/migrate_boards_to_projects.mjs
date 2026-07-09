import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local");
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// CLI Args
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isExecute = args.includes("--execute");

if (!isDryRun && !isExecute) {
    console.error("❌ Please specify either --dry-run or --execute");
    process.exit(1);
}

const targetBoardId = args.find(arg => arg.startsWith("--board="))?.split("=")[1];

let stats = {
    boardsScanned: 0,
    projectsCreated: 0,
    itemsMigrated: 0,
    subcollectionsMigrated: 0
};

console.log(`\n🚀 Starting SSOT Migration: boards -> projects`);
console.log(`=============================================================`);
if (isDryRun) {
    console.log(`⚠️  MODE: DRY RUN (No data will be written)`);
} else if (isExecute) {
    console.log(`🔥 MODE: EXECUTION (Writes will be committed)`);
}
if (targetBoardId) console.log(`🎯 TARGET: Board -> ${targetBoardId}`);
console.log(`=============================================================\n`);

let currentBatch = db.batch();
let mutationCount = 0;
const batchArray = [currentBatch];

function getSafeBatch() {
    if (mutationCount >= 450) {
        currentBatch = db.batch();
        batchArray.push(currentBatch);
        mutationCount = 0;
    }
    mutationCount++;
    return currentBatch;
}

async function copyCollection(srcColRef, targetColRef) {
    const snap = await srcColRef.get();
    for (const doc of snap.docs) {
        getSafeBatch().set(targetColRef.doc(doc.id), doc.data(), { merge: true });
        stats.itemsMigrated++;
    }
}

async function processBoard(boardSnap) {
    const boardId = boardSnap.id;
    const boardData = boardSnap.data();

    // The Project uses the SAME ID as the old board for SSOT
    const projectRef = db.collection("projects").doc(boardId);
    
    // Project Payload
    const projectPayload = {
        name: boardData.name || "Untitled Project",
        description: boardData.description || "",
        ownerId: boardData.ownerId || boardData.owner || null,
        memberIds: boardData.memberIds || [],
        visibility: boardData.visibility || "private",
        createdAt: boardData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: boardData.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
        
        // Copy remaining legacy attributes to root for safety
        ...boardData,
        migratedToSSOT: true,
        schemaVersion: "v3-ssot",
    };

    // Workspace main Payload
    const workspaceRef = projectRef.collection("workspaces").doc("main");
    const workspacePayload = {
        workspaceType: "main",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    getSafeBatch().set(projectRef, projectPayload, { merge: true });
    getSafeBatch().set(workspaceRef, workspacePayload, { merge: true });

    // Dynamic Subcollection Copying
    // We copy ALL subcollections found under boards/{boardId} to projects/{projectId}/workspaces/main/{subcollectionName}
    const subcollections = await boardSnap.ref.listCollections();
    
    for (const subcol of subcollections) {
        if (!isDryRun) {
            await copyCollection(subcol, workspaceRef.collection(subcol.id));
        } else {
            const snap = await subcol.get();
            stats.itemsMigrated += snap.size;
        }
        stats.subcollectionsMigrated++;
    }

    if (!isExecute) {
        console.log(`[DRY-RUN] Migrated boards/${boardId} -> projects/${boardId} (incl ${subcollections.length} subcols)`);
        stats.projectsCreated++;
    } else {
        stats.projectsCreated++;
    }
}

async function run() {
    try {
        console.log("--> Fetching legacy boards...");
        
        let boardsQuery = db.collection("boards");
        if (targetBoardId) {
            boardsQuery = db.collection("boards").where(admin.firestore.FieldPath.documentId(), "==", targetBoardId);
        }

        const boardsSnap = await boardsQuery.get();
        console.log(`Found ${boardsSnap.size} boards to process.`);

        for (const boardDoc of boardsSnap.docs) {
            stats.boardsScanned++;
            await processBoard(boardDoc);
        }
        
        if (isExecute) {
            console.log(`\n⏳ Committing ${batchArray.length} batches to Firestore...`);
            let count = 0;
            for (const batch of batchArray) {
                await batch.commit();
                count++;
            }
            console.log(`✅ ${count} batches committed successfully.`);
        }

        console.log(`\n🎉 SSOT Data Migration Validated!`);
        console.log(`===============================================`);
        console.log(`Legacy Boards Scanned  : ${stats.boardsScanned}`);
        console.log(`Projects Migrated      : ${stats.projectsCreated}`);
        console.log(`Subcollections Scanned : ${stats.subcollectionsMigrated}`);
        console.log(`Items/Docs Migrated    : ${stats.itemsMigrated}`);
        console.log(`===============================================\n`);

    } catch (e) {
        console.error("❌ Fatal error during migration:", e);
    } finally {
        process.exit(0);
    }
}

run();
