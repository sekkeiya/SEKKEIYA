import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

// CLI Arguments
const isDryRun = process.argv.includes("--dry-run");

async function deleteCollectionSubItems(collectionRef, typeLabel) {
    const snap = await collectionRef.where("isArchived_pendingDelete", "==", true).get();
    
    if (snap.empty) {
        console.log(`ℹ️ [${typeLabel}] No archived boards found.`);
        return { deletedBoards: 0, deletedModels: 0 };
    }

    let batch = db.batch();
    let batchCount = 0;
    let deletedBoards = 0;
    let deletedModels = 0;

    for (const doc of snap.docs) {
        const boardId = doc.id;
        const boardPath = doc.ref.path;
        
        // 1. First delete models subcollection
        const modelsSnap = await doc.ref.collection("models").get(); // We delete all subcollection items, regardless of their individual flags, because the parent is totally archived.
        for (const mDoc of modelsSnap.docs) {
            console.log(`[DRY RUN] Would delete model: ${mDoc.ref.path}`);
            if (!isDryRun) {
                batch.delete(mDoc.ref);
                batchCount++;
            }
            deletedModels++;

            if (batchCount >= 400 && !isDryRun) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }

        // 2. Then delete parent board
        console.log(`[DRY RUN] Would delete board: ${boardPath}`);
        if (!isDryRun) {
            batch.delete(doc.ref);
            batchCount++;
        }
        deletedBoards++;

        if (batchCount >= 400 && !isDryRun) {
            await batch.commit();
            batch = db.batch();
            batchCount = 0;
        }
    }

    if (batchCount > 0 && !isDryRun) {
        await batch.commit();
    }

    return { deletedBoards, deletedModels };
}

async function run() {
    console.log("==================================================");
    console.log(`🔥 Starting Hard Delete of Legacy Boards`);
    console.log(`   Mode: ${isDryRun ? "DRY-RUN (No data will be deleted)" : "ACTUAL DELETION"}`);
    console.log("==================================================\n");

    let totalBoards = 0;
    let totalModels = 0;

    try {
        // 1. teamBoards
        console.log("-> Processing teamBoards...");
        const teamResults = await deleteCollectionSubItems(db.collection("teamBoards"), "teamBoards");
        totalBoards += teamResults.deletedBoards;
        totalModels += teamResults.deletedModels;

        // 2. users/{uid}/myBoards
        // We cannot use collectionGroup to query and then delete the parent, because collectionGroup("myBoards") returns the boards themselves.
        console.log("-> Processing users/{uid}/myBoards...");
        
        // Fetch all myBoards and filter in memory to avoid composite index requirements on a retiring collection
        const allMyBoardsSnap = await db.collectionGroup("myBoards").get();
        const myArchivedDocs = allMyBoardsSnap.docs.filter(doc => doc.data().isArchived_pendingDelete === true);

        if (myArchivedDocs.length === 0) {
            console.log("ℹ️ [myBoards] No archived boards found.");
        } else {
            let myBatch = db.batch();
            let myBatchCount = 0;

            for (const doc of myArchivedDocs) {
                const boardPath = doc.ref.path;
                
                // Models first
                const modelsSnap = await doc.ref.collection("models").get();
                for (const mDoc of modelsSnap.docs) {
                    console.log(`[DRY RUN] Would delete model: ${mDoc.ref.path}`);
                    if (!isDryRun) {
                        myBatch.delete(mDoc.ref);
                        myBatchCount++;
                    }
                    totalModels++;
        
                    if (myBatchCount >= 400 && !isDryRun) {
                        await myBatch.commit();
                        myBatch = db.batch();
                        myBatchCount = 0;
                    }
                }

                // Parent board
                console.log(`[DRY RUN] Would delete board: ${boardPath}`);
                if (!isDryRun) {
                    myBatch.delete(doc.ref);
                    myBatchCount++;
                }
                totalBoards++;

                if (myBatchCount >= 400 && !isDryRun) {
                    await myBatch.commit();
                    myBatch = db.batch();
                    myBatchCount = 0;
                }
            }

            if (myBatchCount > 0 && !isDryRun) {
                await myBatch.commit();
            }
        }

        console.log("\n==================================================");
        console.log("🎉 Run Complete!");
        console.log(`📊 Summary:`);
        console.log(`   - Boards deleted: ${totalBoards}`);
        console.log(`   - Models deleted: ${totalModels}`);
        console.log("==================================================");

        process.exit(0);
    } catch (err) {
        console.error("❌ Exception during deletion:", err);
        process.exit(1);
    }
}

run();
