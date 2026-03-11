import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

// Ensure GOOGLE_APPLICATION_CREDENTIALS is set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS is not set in .env.local");
    console.error("Please set it to the path of your Firebase Admin SDK service account key JSON file.");
    process.exit(1);
}

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

// CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isExecute = args.includes("--execute");

if (!isDryRun && !isExecute) {
    console.error("❌ Please specify either --dry-run or --execute");
    process.exit(1);
}

const targetUserId = args.find(arg => arg.startsWith("--user="))?.split("=")[1];
const targetBoardId = args.find(arg => arg.startsWith("--board="))?.split("=")[1];

console.log(`\n🚀 Starting Backfill to Unified Schema (Phase 4)`);
console.log(`===============================================`);
if (isDryRun) {
    console.log(`⚠️  MODE: DRY RUN (No data will be written)`);
} else if (isExecute) {
    console.log(`🔥 MODE: EXECUTION (Writes will be committed)`);
}
if (targetUserId) console.log(`🎯 TARGET: User -> ${targetUserId}`);
if (targetBoardId) console.log(`🎯 TARGET: Board -> ${targetBoardId}`);
console.log(`===============================================\n`);

/**
 * Normalizes Legacy "Team Board" data to UnifiedBoard schema format.
 */
function normalizeTeamBoard(docData, boardId) {
    const ownerId = docData.ownerId || docData.owner || docData.createdBy;
    const isPublic = docData.isPublic === true || ["public", "all"].includes(docData.publicMode) || ["public", "all"].includes(docData.visibility);
    const memberIds = Array.isArray(docData.members)
        ? docData.members
        : (docData.members && typeof docData.members === 'object')
            ? Object.keys(docData.members).filter(k => docData.members[k])
            : [];

    return {
        boardType: "teamBoards",
        ownerId,
        memberIds,
        name: docData.name || "Untitled Team Board",
        description: docData.description || "",
        visibility: docData.visibility || (isPublic ? "public" : "private"),
        createdAt: docData.createdAt || null,      // keep original FieldValue if possible
        updatedAt: docData.updatedAt || docData.createdAt || null,
        schemaVersion: 2,
        sourceApp: "3dss", // Origin
    };
}

/**
 * Normalizes Legacy "My Board" data to UnifiedBoard schema format.
 */
function normalizeMyBoard(docData, boardId, ownerUid) {
    const isPublic = docData.isPublic === true || docData.visibility === "public";
    
    return {
        boardType: "myBoards",
        ownerId: ownerUid,
        memberIds: [],
        name: docData.name || "Untitled Board",
        description: docData.description || "",
        visibility: docData.visibility || (docData.isPrivate ? "private" : (isPublic ? "public" : "private")),
        createdAt: docData.createdAt || null,
        updatedAt: docData.updatedAt || docData.createdAt || null,
        schemaVersion: 2,
        sourceApp: "3dss", // Origin
    };
}

/**
 * Normalizes Legacy Item data to UnifiedBoardItem schema
 */
function normalizeItem(modelDocData, boardId, modelId, boardOwnerId) {
    const preview = modelDocData.preview || {};
    return {
        boardId,
        itemType: "model",
        entityId: modelId,
        itemRef: modelDocData.modelRef?.path || `models/${modelId}`,
        addedBy: modelDocData.ownerUid || preview.createdBy || preview.userId || boardOwnerId || null,
        sortOrder: 0,
        schemaVersion: 2,
        snapshot: {
            title: preview.title || preview.name || null,
            thumbnailUrl: preview.thumbnailUrl || preview.thumbUrl || null,
            previewType: "3d",
        },
        createdAt: modelDocData.savedAt || modelDocData.updatedAt || null,
        updatedAt: modelDocData.updatedAt || modelDocData.savedAt || null,
    };
}

async function processBoard(boardRef, legacyData, sourceCol, ownerUid = null) {
    const boardId = boardRef.id;
    const unifiedBoardRef = db.collection("boards").doc(boardId);

    // 1. We no longer skip the board entirely even if it exists.
    // Dual-Write may have created the board, but older items still need backfilling.
    const existingUnifiedMatch = await unifiedBoardRef.get();
    let unifiedPayload;
    if (sourceCol === "teamBoards") {
        unifiedPayload = normalizeTeamBoard(legacyData, boardId);
        ownerUid = unifiedPayload.ownerId;
    } else {
        unifiedPayload = normalizeMyBoard(legacyData, boardId, ownerUid);
    }

    // 2. Fetch existing Unified Items for Deduplication
    const existingUnifiedItemsSnap = await unifiedBoardRef.collection("items").get();
    const existingEntityIds = new Set();
    existingUnifiedItemsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.entityId) existingEntityIds.add(data.entityId);
    });

    // 3. Process items to compute aggregates and backfill missing items
    let itemsCollectionRef;
    if (sourceCol === "teamBoards") {
        itemsCollectionRef = db.collection("teamBoards").doc(boardId).collection("models");
    } else {
        itemsCollectionRef = db.collection("users").doc(ownerUid).collection("myBoards").doc(boardId).collection("models");
    }
    const itemsSnap = await itemsCollectionRef.get();
    
    // We compute aggregates across ALL items (existing unified + legacy)
    let itemCount = existingEntityIds.size; // start with items already in unified schema
    let coverThumbnailUrl = null;
    let coverItemId = null;
    let latestActivityTimestamp = unifiedPayload.updatedAt || unifiedPayload.createdAt;
    
    // Fallback: Check existing unified items for cover image if available
    existingUnifiedItemsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!coverThumbnailUrl && data.snapshot?.thumbnailUrl) {
            coverThumbnailUrl = data.snapshot.thumbnailUrl;
            coverItemId = data.entityId;
        }
        if (data.updatedAt && latestActivityTimestamp) {
             const dtTs = data.updatedAt.toMillis ? data.updatedAt.toMillis() : 0;
             const lTs = latestActivityTimestamp.toMillis ? latestActivityTimestamp.toMillis() : 0;
             if (dtTs > lTs) latestActivityTimestamp = data.updatedAt;
        }
    });

    const unifiedItemsPayloads = [];
    let newlyMigratedCount = 0;

    itemsSnap.docs.forEach(itemDoc => {
        const itemData = itemDoc.data();
        const itemId = itemDoc.id; // legacy modelId
        const unifiedItem = normalizeItem(itemData, boardId, itemId, ownerUid);
        
        // Deduplication: Check if this legacy item is already in the Unified Items subcollection
        if (!existingEntityIds.has(unifiedItem.entityId)) {
            // Auto-generate a new ID for the unified item
            const newUnifiedItemRef = unifiedBoardRef.collection("items").doc();
            unifiedItemsPayloads.push({ ref: newUnifiedItemRef, data: unifiedItem });
            itemCount++; // increment aggregate
            newlyMigratedCount++;
        }
        
        // Aggregate checks (even for skipped items, ensure aggregates are correct)
        // Pick the first one with a thumbnail as cover
        if (!coverThumbnailUrl && unifiedItem.snapshot.thumbnailUrl) {
            coverThumbnailUrl = unifiedItem.snapshot.thumbnailUrl;
            coverItemId = unifiedItem.entityId;
        }

        // Determine latest activity
        if (unifiedItem.updatedAt && latestActivityTimestamp) {
            const itemTs = unifiedItem.updatedAt.toMillis ? unifiedItem.updatedAt.toMillis() : 0;
            const boardTs = latestActivityTimestamp.toMillis ? latestActivityTimestamp.toMillis() : 0;
            if (itemTs > boardTs) {
                latestActivityTimestamp = unifiedItem.updatedAt;
            }
        } else if (unifiedItem.updatedAt && !latestActivityTimestamp) {
            latestActivityTimestamp = unifiedItem.updatedAt;
        }
    });

    // Merge aggregates into board payload
    unifiedPayload.itemCount = itemCount;
    unifiedPayload.coverThumbnailUrl = coverThumbnailUrl;
    unifiedPayload.coverItemId = coverItemId;
    unifiedPayload.lastActivityAt = latestActivityTimestamp;

    // 4. Commit or Log
    if (!isExecute) {
        console.log(`[DRY-RUN] Would write/merge Board: boards/${boardId}`);
        console.log(`  Included New Items: ${newlyMigratedCount} (Total Aggregate: ${itemCount})`);
        return { status: "dry-run", itemsCount: newlyMigratedCount };
    } else {
        const batch = db.batch();
        // Since board might exist via Dual-Write, we must use { merge: true }
        batch.set(unifiedBoardRef, unifiedPayload, { merge: true });
        
        unifiedItemsPayloads.forEach(({ ref, data }) => {
            batch.set(ref, data, { merge: true });
        });

        await batch.commit();
        console.log(`✅ Migrated: boards/${boardId} (New Items: ${newlyMigratedCount})`);
        return { status: "migrated", itemsCount: newlyMigratedCount };
    }
}

async function run() {
    let stats = {
        boardsScanned: 0,
        boardsSkipped: 0,
        boardsMigrated: 0,
        itemsMigrated: 0,
    };

    try {
        // --- 1. Process MyBoards ---
        console.log("--> Scanning users/{uid}/myBoards...");
        let usersQuery = db.collection("users");
        if (targetUserId) {
            usersQuery = usersQuery.where(admin.firestore.FieldPath.documentId(), "==", targetUserId);
        }
        
        const usersSnap = await usersQuery.get();
        for (const userDoc of usersSnap.docs) {
            const uid = userDoc.id;
            let myBoardsQuery = userDoc.ref.collection("myBoards");
            if (targetBoardId) {
                myBoardsQuery = myBoardsQuery.where(admin.firestore.FieldPath.documentId(), "==", targetBoardId);
            }
            const myBoardsSnap = await myBoardsQuery.get();
            
            for (const boardDoc of myBoardsSnap.docs) {
                stats.boardsScanned++;
                const result = await processBoard(boardDoc, boardDoc.data(), "myBoards", uid);
                if (result.status === "skipped") stats.boardsSkipped++;
                if (result.status === "migrated" || result.status === "dry-run") {
                    stats.boardsMigrated++;
                    stats.itemsMigrated += result.itemsCount;
                }
            }
        }

        // --- 2. Process TeamBoards ---
        console.log("--> Scanning teamBoards...");
        let teamBoardsQuery = db.collection("teamBoards");
        if (targetBoardId) {
            teamBoardsQuery = teamBoardsQuery.where(admin.firestore.FieldPath.documentId(), "==", targetBoardId);
        }
        
        const teamBoardsSnap = await teamBoardsQuery.get();
        for (const boardDoc of teamBoardsSnap.docs) {
            stats.boardsScanned++;
            const result = await processBoard(boardDoc, boardDoc.data(), "teamBoards");
            if (result.status === "skipped") stats.boardsSkipped++;
            if (result.status === "migrated" || result.status === "dry-run") {
                stats.boardsMigrated++;
                stats.itemsMigrated += result.itemsCount;
            }
        }

        console.log(`\n🎉 Backfill Complete!`);
        console.log(`===============================================`);
        console.log(`Boards Scanned  : ${stats.boardsScanned}`);
        console.log(`Boards Skipped  : ${stats.boardsSkipped}`);
        console.log(`Boards Migrated : ${stats.boardsMigrated}`);
        console.log(`Items Migrated  : ${stats.itemsMigrated}`);
        console.log(`===============================================\n`);

    } catch (e) {
        console.error("❌ Fatal error during backfill:", e);
    } finally {
        process.exit(0);
    }
}

run();
