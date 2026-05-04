const admin = require("firebase-admin");

async function runMeshyProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) throw new Error("MESHY_API_KEY is not set");

    // 1. Update status to processing to indicate we've started
    await jobRef.update({
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Call Meshy API
    const response = await fetch("https://api.meshy.ai/openapi/v1/image-to-3d", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image_url: data.inputImageUrl,
        enable_pbr: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meshy API Error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const providerJobId = result.result; // Meshy returns the task ID in 'result'

    if (!providerJobId) {
       throw new Error("Meshy API returned no task ID");
    }

    // 3. Update job with providerJobId
    await jobRef.update({
      providerJobId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("Meshy Provider Start Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to start Meshy job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function checkMeshyProvider(jobId, uid, jobData) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    const apiKey = process.env.MESHY_API_KEY;
    if (!apiKey) throw new Error("MESHY_API_KEY is not set");
    if (!jobData.providerJobId) throw new Error("No providerJobId to check");

    const response = await fetch(`https://api.meshy.ai/openapi/v1/image-to-3d/${jobData.providerJobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Meshy Check Error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const status = result.status; // 'PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'EXPIRED'

    if (status === "SUCCEEDED") {
      const modelUrl = result.model_urls.glb;
      
      // 1. Download and Upload to Firebase Storage
      const storagePath = `users/${uid}/generated_models/${jobId}.glb`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      
      const modelResponse = await fetch(modelUrl);
      const buffer = await modelResponse.arrayBuffer();
      await file.save(Buffer.from(buffer), {
        metadata: { contentType: "model/gltf-binary" }
      });
      await file.makePublic(); // Optional based on storage rules, but good for direct URL access
      const glbStoragePath = file.publicUrl();

      // 2. Create Asset in root assets collection
      const assetRef = db.collection("assets").doc();
      const assetData = {
        type: "3d_model",
        storageUrl: glbStoragePath,
        ownerId: uid,
        metadata: {
          source: "ai_generated",
          provider: "meshy",
          generationJobId: jobId,
          originalImageUrl: jobData.inputImageUrl || "",
          imageHash: jobData.imageHash,
          projectId: jobData.projectId || null,
          workspaceId: jobData.workspaceId || null
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await assetRef.set(assetData);

      // 3. Map to Project Item if autoPlace is true and projectId/workspaceId exist
      if (jobData.autoPlace && jobData.projectId && jobData.workspaceId) {
        const itemRef = db.collection("projects").doc(jobData.projectId).collection("workspaces").doc(jobData.workspaceId).collection("items").doc();
        await itemRef.set({
          type: "3d_model",
          assetId: assetRef.id,
          workspaceId: jobData.workspaceId,
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
        glbStoragePath,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } else if (status === "FAILED" || status === "EXPIRED") {
      throw new Error(`Meshy job failed with status: ${status}. Error: ${result.task_error?.message || 'Unknown'}`);
    } else {
      // Still pending or in progress. Increment pollCount.
      const currentPollCount = (jobData.pollCount || 0) + 1;
      const maxPollCount = jobData.maxPollCount || 60;
      
      if (currentPollCount > maxPollCount) {
        throw new Error("Job timed out (exceeded maxPollCount)");
      } else {
        await jobRef.update({
          pollCount: currentPollCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

  } catch (error) {
    console.error("Meshy Provider Check Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to check or save Meshy job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

module.exports = { runMeshyProvider, checkMeshyProvider };
