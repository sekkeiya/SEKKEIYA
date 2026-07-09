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

async function run() {
    console.log("🔍 Running Preflight Audit: Legacy -> Unified Schema completeness");
    let missingBoards = 0;
    let missingItemsCount = 0;
    let totalLegacyBoards = 0;
    let totalLegacyItems = 0;

    console.log("\n--- Checking teamBoards ---");
    const teamBoardsSnap = await db.collection("teamBoards").get();
    for (const doc of teamBoardsSnap.docs) {
        totalLegacyBoards++;
        const boardId = doc.id;
        const unifiedDoc = await db.collection("boards").doc(boardId).get();
        if (!unifiedDoc.exists) {
            console.log(`❌ MISSING TEAM BOARD: ${boardId} not found in unified 'boards' collection.`);
            missingBoards++;
        }
        
        const modelsSnap = await doc.ref.collection("models").get();
        totalLegacyItems += modelsSnap.size;

        if (unifiedDoc.exists) {
            const unifiedItemsSnap = await unifiedDoc.ref.collection("items").get();
            if (unifiedItemsSnap.size < modelsSnap.size) {
                 console.log(`⚠️ ITEM MISMATCH in TeamBoard ${boardId}: Legacy has ${modelsSnap.size}, Unified has ${unifiedItemsSnap.size}`);
                 missingItemsCount += (modelsSnap.size - unifiedItemsSnap.size);
            }
        }
    }

    console.log("\n--- Checking users/{uid}/myBoards ---");
    const myBoardsGroupSnap = await db.collectionGroup("myBoards").get();
    for (const doc of myBoardsGroupSnap.docs) {
        totalLegacyBoards++;
        const boardId = doc.id;
        const uid = doc.ref.parent.parent.id;

        const unifiedDoc = await db.collection("boards").doc(boardId).get();
        if (!unifiedDoc.exists) {
            console.log(`❌ MISSING MY BOARD: ${boardId} (owner: ${uid}) not found in unified 'boards' collection.`);
            missingBoards++;
        }

        const modelsSnap = await doc.ref.collection("models").get();
        totalLegacyItems += modelsSnap.size;

        if (unifiedDoc.exists) {
            const unifiedItemsSnap = await unifiedDoc.ref.collection("items").get();
            if (unifiedItemsSnap.size < modelsSnap.size) {
                 console.log(`⚠️ ITEM MISMATCH in MyBoard ${boardId}: Legacy has ${modelsSnap.size}, Unified has ${unifiedItemsSnap.size}`);
                 missingItemsCount += (modelsSnap.size - unifiedItemsSnap.size);
            }
        }
    }

    console.log("\n=================================");
    console.log("📊 Audit Results");
    console.log("=================================");
    console.log(`Total Legacy Boards Checked : ${totalLegacyBoards}`);
    console.log(`Total Legacy Items Checked  : ${totalLegacyItems}`);
    console.log(`Missing Boards in Unified   : ${missingBoards}`);
    console.log(`Missing Items in Unified    : ${missingItemsCount}`);
    
    if (missingBoards === 0 && missingItemsCount === 0) {
        console.log("\n✅ SUCCESS: All legacy boards and items are present in the new schema!");
        console.log("✅ You are safe to proceed to Soft Delete (Phase 8 Step 4).");
    } else {
        console.log("\n❌ FAILED: Missing data detected. Do not proceed to deletion until backfilled.");
    }
    process.exit(0);
}

run();
