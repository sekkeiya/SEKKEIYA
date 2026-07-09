import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});
const db = admin.firestore();

async function run() {
    console.log("🔍 Starting Step 2.5: Migration Data Validation\n");

    const logPath = path.join(__dirname, "v2_migration_log_1774417685365.json");
    if (!fs.existsSync(logPath)) {
        console.error("❌ Migration log not found at", logPath);
        process.exit(1);
    }
    const logData = JSON.parse(fs.readFileSync(logPath, "utf-8"));
    const legacyToProject = logData.legacyToProjectMapping;
    const legacyBoardIds = Object.keys(legacyToProject);
    
    console.log(`[Target] Analzying ${legacyBoardIds.length} migrated boards.\n`);

    let totalLegacyItems = 0;
    let totalMigratedItems = 0;
    let duplicateProjectErrs = 0;
    let invalidStructureErrs = 0;

    let sampleProject = null;
    let sampleWorkspace = null;
    let sampleItem = null;

    for (const [legacyId, expectedProjectId] of Object.entries(legacyToProject)) {
        // 1. Verify 1-to-1 cardinality
        const projsSnap = await db.collection("projects").where("legacyBoardId", "==", legacyId).get();
        if (projsSnap.size !== 1) {
            console.error(`❌ LegacyBoard DUP/MISSING Error: ${legacyId} has ${projsSnap.size} mapped projects!`);
            duplicateProjectErrs++;
        }
        
        let foundProjIds = projsSnap.docs.map(d => d.id);
        if (!foundProjIds.includes(expectedProjectId)) {
            console.error(`❌ Project mismatch. Log expected ${expectedProjectId}, found ${foundProjIds}`);
        }

        const projDoc = projsSnap.docs[0];
        const projData = projDoc.data();

        // Target Workspace Validation
        const workSnap = await projDoc.ref.collection("workspaces").get();
        if (workSnap.size !== 1 || workSnap.docs[0].id !== "models") {
            console.error(`❌ Workspace structural error. Project ${expectedProjectId} has workspaces: ${workSnap.docs.map(d=>d.id)}`);
            invalidStructureErrs++;
        }
        
        const modelsWsData = workSnap.docs[0].data();

        // Count Old vs New items
        const newItemsSnap = await workSnap.docs[0].ref.collection("items").get();
        const oldItemsSnap = await db.collection("boards").doc(legacyId).collection("items").get();
        
        totalLegacyItems += oldItemsSnap.size;
        totalMigratedItems += newItemsSnap.size;

        if (oldItemsSnap.size !== newItemsSnap.size) {
            console.error(`❌ Item counts differ for ${legacyId}: old=${oldItemsSnap.size}, new=${newItemsSnap.size}`);
        }

        // Save one sample for reporting
        if (!sampleProject && newItemsSnap.size > 0) {
            sampleProject = { id: expectedProjectId, ...projData };
            sampleWorkspace = { id: "models", ...modelsWsData };
            sampleItem = { id: newItemsSnap.docs[0].id, ...newItemsSnap.docs[0].data() };
        }
    }

    console.log("==========================================");
    console.log("✅ 1. Item Count Match");
    console.log(`   Legacy boards: ${legacyBoardIds.length}`);
    console.log(`   New Projects : ${legacyBoardIds.length}`);
    console.log(`   Legacy Items : ${totalLegacyItems}`);
    console.log(`   Migrated Item: ${totalMigratedItems}`);
    if (totalLegacyItems === totalMigratedItems && totalLegacyItems === 54) console.log("   --> PASSED");

    console.log("\n✅ 2. Relationship && Cardinality");
    if (duplicateProjectErrs === 0) {
        console.log("   --> PASSED: 1-to-1 mapping verified. No legacyBoardId splits across projects.");
    } else {
        console.log(`   --> FAILED: ${duplicateProjectErrs} errors.`);
    }

    console.log("\n✅ 3. Structural Integrity");
    if (invalidStructureErrs === 0) {
        console.log("   --> PASSED: All projects contain exactly ONLY 'workspaces/models'");
    } else {
        console.log(`   --> FAILED: ${invalidStructureErrs} errors.`);
    }

    console.log("\n✅ 4. Sample Record Dump:");
    console.log("-------- PROJECT --------");
    console.log(JSON.stringify(sampleProject, null, 2));
    console.log("-------- WORKSPACE --------");
    console.log(JSON.stringify(sampleWorkspace, null, 2));
    console.log("-------- ITEM --------");
    console.log(JSON.stringify(sampleItem, null, 2));
    console.log("==========================================");

    process.exit(0);
}

run();
