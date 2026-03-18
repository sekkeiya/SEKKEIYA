const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

/**
 * users/{uid}/models/{modelId} に対する変更を監視し、
 * users/{uid}/driveAssets/asset-3dss-{modelId} に同期する
 */
exports.onUserModelsWritten = onDocumentWritten("users/{uid}/models/{modelId}", async (event) => {
  const { uid, modelId } = event.params;
  const driveAssetId = `asset-3dss-${modelId}`;

  // ドキュメントが削除された場合
  if (!event.data.after.exists) {
    const oldData = event.data.before.data();
    if (!oldData) return;
    
    const resolvedUid = uid ?? oldData.createdBy ?? oldData.ownerId ?? oldData.authorId ?? oldData.uid;
    if (!resolvedUid) {
      console.warn(`Cannot resolve uid for deleted model: ${modelId}`);
      return;
    }

    // Defensive check: Ensure the canonical model is actually gone.
    // If it exists (e.g. race condition or old trigger), abort soft-deletion.
    const canonicalModelSnap = await admin.firestore().doc(`users/${resolvedUid}/models/${modelId}`).get();
    const canonicalData = canonicalModelSnap.data();
    if (canonicalModelSnap.exists && canonicalData && canonicalData.isDeleted !== true) {
      console.warn(`Skipping soft-delete for driveAsset ${driveAssetId}: Canonical source model is still active.`);
      return;
    }

    const driveAssetRef = admin.firestore().doc(`users/${resolvedUid}/driveAssets/${driveAssetId}`);
    console.log(`Model deleted. Soft-deleting driveAsset: ${driveAssetId}`);
    try {
      await driveAssetRef.update({
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        deletedSource: "3dss"
      });
    } catch (error) {
      if (error.code === 5) { // NOT_FOUND
        console.warn(`driveAsset not found for soft deletion: ${driveAssetId}`);
      } else {
        console.error(`Failed to soft delete driveAsset: ${driveAssetId}`, error);
      }
    }
    return;
  }

  // 作成 or 更新された場合
  const modelData = event.data.after.data();
  const resolvedUid = uid ?? modelData.createdBy ?? modelData.ownerId ?? modelData.authorId ?? modelData.uid;

  if (!resolvedUid) {
    console.warn(`Cannot resolve uid for model: ${modelId}. Skipping sync.`);
    return;
  }

  const driveAssetRef = admin.firestore().doc(`users/${resolvedUid}/driveAssets/${driveAssetId}`);
  
  const driveAssetData = {
    id: driveAssetId,
    name: modelData.title || modelData.name || "Untitled",
    type: "3d_model",
    source: "3dss",
    sourceApp: "3DSS", // 必須項目
    sourceAssetId: modelId, // 必須項目
    folderId: "root-3d-models",
    storagePath: modelData.files?.glb?.path || modelData.modelFilePath || "",
    thumbnailPath: modelData.thumbnailFilePath?.path || modelData.thumbnailUrl || "",
    imageUrl: modelData.thumbnailUrl || "",
    ownerId: resolvedUid,
    visibility: modelData.visibility || "private",
    isDeleted: false,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (modelData.tags !== undefined) {
    driveAssetData.tags = modelData.tags;
  }
  if (modelData.dimensions !== undefined) {
    driveAssetData.dimensions = modelData.dimensions;
  }

  try {
    const assetSnap = await driveAssetRef.get();
    if (!assetSnap.exists) {
      // 新規作成時
      Object.assign(driveAssetData, {
        createdAt: modelData.createdAt || FieldValue.serverTimestamp(),
        createdBy: resolvedUid,
        projectId: null,
        category: "Models",
        aiAnalyzed: false,
        embeddingStatus: "none"
      });
      if (driveAssetData.tags === undefined) {
        driveAssetData.tags = [];
      }
      await driveAssetRef.set(driveAssetData);
      console.log(`Created new driveAsset: ${driveAssetId} for user ${resolvedUid}`);
    } else {
      // 更新時 (AIメタデータなどは保持するために merge: true)
      await driveAssetRef.set(driveAssetData, { merge: true });
      console.log(`Updated driveAsset: ${driveAssetId} for user ${resolvedUid}`);
    }
  } catch (error) {
    console.error(`Failed to sync driveAsset: ${driveAssetId}`, error);
  }
});
