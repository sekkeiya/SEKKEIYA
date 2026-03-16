/**
 * Backfill Script for AI Drive Assets
 * 
 * root の models/{modelId} をすべて走査し、
 * 対応する driveAssets (asset-3dss-{modelId}) が存在しない場合、または古い場合に作成・更新します。
 */
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function backfillDriveAssets() {
    console.log("Starting backfill for driveAssets from root models collection...");

    try {
        const modelsQuery = await db.collection("models").get();
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const modelDoc of modelsQuery.docs) {
            const modelData = modelDoc.data();
            const modelId = modelDoc.id;

            const uid = modelData.createdBy ?? modelData.ownerId ?? modelData.authorId ?? modelData.uid;

            if (!uid) {
                console.warn(`[SKIP] Missing uid in model: ${modelId}`);
                skippedCount++;
                continue;
            }

            const driveAssetId = `asset-3dss-${modelId}`;
            const driveAssetRef = db.doc(`users/${uid}/driveAssets/${driveAssetId}`);

            const driveAssetData = {
                id: driveAssetId,
                name: modelData.title || modelData.name || "Untitled",
                type: "3d_model",
                source: "3dss",
                sourceApp: "3DSS",
                sourceAssetId: modelId,
                folderId: "root-3d-models",
                storagePath: modelData.files?.glb?.path || modelData.modelFilePath || "",
                thumbnailPath: modelData.thumbnailFilePath?.path || modelData.thumbnailUrl || "",
                imageUrl: modelData.thumbnailUrl || "",
                ownerId: uid,
                isDeleted: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            const assetSnap = await driveAssetRef.get();

            if (!assetSnap.exists) {
                Object.assign(driveAssetData, {
                    createdAt: modelData.createdAt || admin.firestore.FieldValue.serverTimestamp(),
                    createdBy: uid,
                    projectId: null,
                    tags: [],
                    category: "Models",
                    aiAnalyzed: false,
                    embeddingStatus: "none"
                });
                await driveAssetRef.set(driveAssetData);
                console.log(`[CREATED] driveAsset for raw model ${modelId} (user: ${uid})`);
                createdCount++;
            } else {
                await driveAssetRef.set(driveAssetData, { merge: true });
                console.log(`[UPDATED] driveAsset for raw model ${modelId} (user: ${uid})`);
                updatedCount++;
            }
        }

        console.log("Backfill completed successfully.");
        console.log(`Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);

    } catch (error) {
        console.error("Error running backfill:", error);
    }
}

backfillDriveAssets().then(() => process.exit(0)).catch(() => process.exit(1));
