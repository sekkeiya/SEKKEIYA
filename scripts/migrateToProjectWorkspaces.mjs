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

const targetUserId = args.find(arg => arg.startsWith("--user="))?.split("=")[1];
const targetBoardId = args.find(arg => arg.startsWith("--board="))?.split("=")[1];

// Bookkeeping Trackers
let stats = {
    boardsScanned: 0,
    projectsCreated: 0,
    projectsMerged: 0,
    itemsMigrated: 0,
};
const migrationLog = {}; // legacyBoardId -> projectId

console.log(`\n🚀 Starting Phase 19 Step 2: Unified Schema Target Migration`);
console.log(`=============================================================`);
if (isDryRun) {
    console.log(`⚠️  MODE: DRY RUN (No data will be written)`);
} else if (isExecute) {
    console.log(`🔥 MODE: EXECUTION (Writes will be committed)`);
}
if (targetUserId) console.log(`🎯 TARGET: User -> ${targetUserId}`);
if (targetBoardId) console.log(`🎯 TARGET: Board -> ${targetBoardId}`);
console.log(`=============================================================\n`);


/**
 * Maps legacy 3DSS unified item to the standard workspace item schema
 */
function normalizeItem(unifiedItemData, legacyBoardId, itemId, ownerUid) {
    return {
        entityId: unifiedItemData.entityId || itemId,
        itemType: unifiedItemData.itemType || "model",
        itemRef: unifiedItemData.itemRef,
        addedBy: unifiedItemData.addedBy || ownerUid || null,
        sortOrder: unifiedItemData.sortOrder || 0,
        schemaVersion: "v2-workspace",
        snapshot: unifiedItemData.snapshot || {},
        createdAt: unifiedItemData.createdAt || null,
        updatedAt: unifiedItemData.updatedAt || null,
    };
}

/**
 * Migration core for a single legacy board (sourced from unified boards/)
 */
async function processBoard(boardRef, legacyData) {
    const legacyBoardId = boardRef.id;
    const legacySourcePath = `boards/${legacyBoardId}`;

    // 1. Idempotency Check: Does a project already exist for this legacy board?
    const existingProjectSnap = await db.collection("projects").where("legacyBoardId", "==", legacyBoardId).limit(1).get();
    
    let projectId;
    let projectRef;
    let isMerge = false;

    if (!existingProjectSnap.empty) {
        projectRef = existingProjectSnap.docs[0].ref;
        projectId = projectRef.id;
        isMerge = true;
    } else {
        projectRef = db.collection("projects").doc(); // **New projectId generated**
        projectId = projectRef.id;
    }

    // 2. Prepare Project Payload
    const owner = legacyData.ownerId;
    
    const projectPayload = {
        name: legacyData.name || "Untitled Project",
        description: legacyData.description || "",
        ownerId: owner,
        memberIds: legacyData.memberIds || [],
        visibility: legacyData.visibility || "private",
        createdAt: legacyData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: legacyData.updatedAt || legacyData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        // Bookkeeping
        legacyBoardId: legacyBoardId,
        legacySourcePath: legacySourcePath,
        migratedFromApp: "3dss",
        schemaVersion: "v2-workspace"
    };

    // 3. Prepare Workspace Payload
    const workspaceRef = projectRef.collection("workspaces").doc("models"); // **Fixed Workspace Policy**
    const workspacePayload = {
        workspaceType: "models",
        appRole: "3dss",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        legacyBoardId: legacyBoardId // trace reference
    };

    // 4. Gather Items from Unified Boards
    let itemsCollectionRef = db.collection("boards").doc(legacyBoardId).collection("items");
    
    const itemsSnap = await itemsCollectionRef.get();
    const itemWrites = [];

    itemsSnap.docs.forEach(itemDoc => {
        const itemData = itemDoc.data();
        const itemId = itemDoc.id; 
        const unifiedItem = normalizeItem(itemData, legacyBoardId, itemId, owner);
        const unifiedItemRef = workspaceRef.collection("items").doc(itemId); // Use exact same ID to prevent duplicates inherently
        
        itemWrites.push({ ref: unifiedItemRef, data: unifiedItem });
    });

    // 5. Commit/Log
    if (!isExecute) {
        console.log(`[DRY-RUN] ${isMerge ? 'Merged with' : 'Created'} Project: projects/${projectId}`);
        console.log(`         -> workspaces/models`);
        console.log(`         -> (Includes ${itemWrites.length} items from ${legacySourcePath})`);
        migrationLog[legacyBoardId] = projectId;
        if (isMerge) stats.projectsMerged++; else stats.projectsCreated++;
        stats.itemsMigrated += itemWrites.length;
    } else {
        const batch = db.batch();
        batch.set(projectRef, projectPayload, { merge: true });
        batch.set(workspaceRef, workspacePayload, { merge: true });
        
        itemWrites.forEach(({ ref, data }) => {
            batch.set(ref, data, { merge: true });
        });

        await batch.commit();
        console.log(`✅ Migrated: ${legacySourcePath} -> projects/${projectId} (${itemWrites.length} items)`);
        
        migrationLog[legacyBoardId] = projectId;
        if (isMerge) stats.projectsMerged++; else stats.projectsCreated++;
        stats.itemsMigrated += itemWrites.length;
    }
}


async function run() {
    try {
        console.log("--> Scanning unified boards/ for sourceApp=='3dss'...");
        let boardsQuery = db.collection("boards").where("sourceApp", "==", "3dss");
        if (targetBoardId) {
            boardsQuery = db.collection("boards").where(admin.firestore.FieldPath.documentId(), "==", targetBoardId);
        }
        if (targetUserId) {
            boardsQuery = boardsQuery.where("ownerId", "==", targetUserId);
        }
        
        const boardsSnap = await boardsQuery.get();
        for (const boardDoc of boardsSnap.docs) {
            // Re-verify it's a 3dss board if we targeted directly by boardId
            if (targetBoardId && boardDoc.data().sourceApp !== '3dss') continue;
            
            stats.boardsScanned++;
            await processBoard(boardDoc, boardDoc.data());
        }

        console.log(`\n🎉 Data Migration Scan Complete!`);
        console.log(`===============================================`);
        console.log(`Legacy Boards Scanned : ${stats.boardsScanned}`);
        console.log(`Projects Created      : ${stats.projectsCreated}`);
        console.log(`Projects Merged (Idmp): ${stats.projectsMerged}`);
        console.log(`Items Migrated        : ${stats.itemsMigrated}`);
        console.log(`===============================================\n`);

        // Save Bookkeeping Log
        const logPath = path.join(__dirname, `v2_migration_log_${Date.now()}.json`);
        fs.writeFileSync(logPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            isExecution: isExecute,
            stats,
            legacyToProjectMapping: migrationLog
        }, null, 2));
        
        console.log(`📝 Migration Bookkeeping Log saved to ${logPath}`);

    } catch (e) {
        console.error("❌ Fatal error during migration:", e);
    } finally {
        process.exit(0);
    }
}

run();
