import { v1 } from "@google-cloud/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const client = new v1.FirestoreAdminClient();

async function exportData() {
    const projectId = "shapeshare3d";
    const databaseName = client.databasePath(projectId, "(default)");
    const bucketName = "gs://shapeshare3d.appspot.com/firestore_backup_pre_cleanup";

    try {
        console.log(`📦 Exporting legacy collections to ${bucketName}...`);
        const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix: bucketName,
            collectionIds: ["teamBoards", "myBoards", "models"]
        });

        console.log("⏳ Export operation submitted. Waiting for completion on GCP...");
        const [response] = await operation.promise();
        console.log("✅ Export completed successfully!");
        console.log(JSON.stringify(response, null, 2));
    } catch (err) {
        console.error("❌ Export failed:", err);
        process.exit(1);
    }
}

exportData();
