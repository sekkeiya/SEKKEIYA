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
    console.log("🔍 Verifying Soft Delete Execution...");

    const teamBoardsSnap = await db.collection("teamBoards")
        .where("isArchived_pendingDelete", "==", true).get();
    console.log(`✅ [teamBoards] Archived boards found: ${teamBoardsSnap.size}`);

    const teamModelsSnap = await db.collectionGroup("models")
        .where("isArchived_pendingDelete", "==", true).get();
        
    // collectionGroup("models") gets myBoards/models and teamBoards/models
    
    const myBoardsSnap = await db.collectionGroup("myBoards")
        .where("isArchived_pendingDelete", "==", true).get();
    console.log(`✅ [myBoards] Archived boards found: ${myBoardsSnap.size}`);

    console.log(`✅ [models (subcollections)] Archived models found: ${teamModelsSnap.size}`);

    console.log("🎉 Post-execution QA verification complete.");
    process.exit(0);
}

run();
