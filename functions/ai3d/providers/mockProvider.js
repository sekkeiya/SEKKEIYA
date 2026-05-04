const admin = require("firebase-admin");

async function runMockProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    // 1. Update status to processing
    await jobRef.update({
      status: "processing",
      providerJobId: "mock_job_" + Date.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mock processing time: 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Mock result GLB (the Duck model)
    const mockGlbUrl = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb";
    const mockImageHash = data.imageHash || "mock_hash_" + Date.now();

    // 2. Create Asset in root assets collection
    const assetRef = db.collection("assets").doc();
    const assetData = {
      type: "3d_model",
      storageUrl: mockGlbUrl, // Treat as storageUrl for mock
      ownerId: uid,
      metadata: {
        source: "ai_generated",
        provider: "mock",
        generationJobId: jobId,
        originalImageUrl: data.inputImageUrl || "",
        imageHash: mockImageHash,
        projectId: data.projectId || null,
        workspaceId: data.workspaceId || null
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await assetRef.set(assetData);

    // 3. Map to Project Item if autoPlace is true and projectId/workspaceId exist
    if (data.autoPlace && data.projectId && data.workspaceId) {
      const itemRef = db.collection("projects").doc(data.projectId).collection("workspaces").doc(data.workspaceId).collection("items").doc();
      await itemRef.set({
        type: "3d_model",
        assetId: assetRef.id,
        workspaceId: data.workspaceId,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        transform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }
      });
    }

    // 4. Mark job as completed
    await jobRef.update({
      status: "completed",
      resultAssetId: assetRef.id,
      glbStoragePath: mockGlbUrl,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("Mock Provider Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to save mock asset",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function checkMockProvider(jobId, uid, jobData) {
  // Normally mock completes on its own in runMockProvider.
  // But if it's stuck in processing, we can fail it.
  console.log(`checkMockProvider called for job ${jobId}. Usually not needed.`);
}

module.exports = { runMockProvider, checkMockProvider };
