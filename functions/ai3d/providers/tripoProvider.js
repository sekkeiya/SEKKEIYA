const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

const tripoApiKey = defineSecret("TRIPO_API_KEY");

async function runTripoProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    const apiKey = tripoApiKey.value();
    if (!apiKey) throw new Error("TRIPO_API_KEY is not set or accessible");

    // 1. Update status to processing
    await jobRef.update({
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const payload = {
      type: "image_to_model",
      file: {
        type: "png",
        url: data.inputImageUrl
      },
      texture: true,
      pbr: true
    };

    console.log("Tripo API Request Payload:", JSON.stringify(payload));

    // 2. Call Tripo API to create task
    const response = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Tripo API Response:", JSON.stringify(result));

    if (!response.ok || result.code !== 0) {
      throw new Error(`Tripo API Error: ${response.status} - ${result.message || JSON.stringify(result)}`);
    }

    const providerJobId = result.data.task_id;

    if (!providerJobId) {
       throw new Error("Tripo API returned no task_id");
    }

    // 3. Update job with providerJobId
    await jobRef.update({
      providerJobId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  } catch (error) {
    console.error("Tripo Provider Start Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to start Tripo job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function checkTripoProvider(jobId, uid, jobData) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    const apiKey = tripoApiKey.value();
    if (!apiKey) throw new Error("TRIPO_API_KEY is not set or accessible");
    if (!jobData.providerJobId) {
      console.log(`[Job ${jobId}] No providerJobId yet. Waiting for runTripoProvider to complete.`);
      return;
    }

    // 1. Poll Tripo API
    const response = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${jobData.providerJobId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    const result = await response.json();

    if (!response.ok || result.code !== 0) {
      throw new Error(`Tripo Check Error: ${response.status} - ${result.message || JSON.stringify(result)}`);
    }

    const status = result.data.status; // 'queued', 'running', 'success', 'failed', 'banned', 'expired', 'cancelled'

    if (status === "success") {
      const output = result.data.output;
      console.log(`[Job ${jobId}] Tripo API Output:`, JSON.stringify(output));
      
      let modelUrl = null;
      let selectedField = null;

      // Prioritize textured models
      if (output.pbr_model) {
        modelUrl = output.pbr_model;
        selectedField = "pbr_model";
      } else if (output.textured_model) {
        modelUrl = output.textured_model;
        selectedField = "textured_model";
      } else if (output.model) {
        modelUrl = output.model;
        selectedField = "model";
      } else if (output.base_model) {
        modelUrl = output.base_model;
        selectedField = "base_model";
      }
      
      if (!modelUrl) {
        throw new Error(`No model URL found in output. Keys: ${Object.keys(output || {}).join(", ")}`);
      }
      
      // 2. Download and Upload to Firebase Storage
      const storagePath = `users/${uid}/generated_models/${jobId}.glb`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      
      const modelResponse = await fetch(modelUrl);
      const buffer = await modelResponse.arrayBuffer();
      await file.save(Buffer.from(buffer), {
        metadata: { contentType: "model/gltf-binary" }
      });
      await file.makePublic(); // Optional, makes the URL public for direct usage
      const glbStoragePath = file.publicUrl();

      // 3. Create Asset in root assets collection
      const assetRef = db.collection("assets").doc();
      const assetData = {
        type: "3d_model",
        storageUrl: glbStoragePath,
        ownerId: uid,
        generation: {
          provider: "tripo",
          inputImageUrl: jobData.inputImageUrl || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          parameters: { texture: true },
          jobId: jobId
        },
        metadata: {
          source: "ai_generated",
          provider: "tripo",
          generationJobId: jobId,
          originalImageUrl: jobData.inputImageUrl || "",
          imageHash: jobData.imageHash,
          projectId: jobData.projectId || null,
          workspaceId: jobData.workspaceId || null,
          tripoOutput: {
            selectedModelUrlField: selectedField,
            availableOutputKeys: Object.keys(output || {})
          }
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await assetRef.set(assetData);

      // 4. Map to Project Item if autoPlace is true and projectId/workspaceId exist
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

      // 5. Mark job as completed
      await jobRef.update({
        status: "completed",
        resultAssetId: assetRef.id,
        glbStoragePath,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    } else if (status === "failed" || status === "banned" || status === "expired" || status === "cancelled") {
      throw new Error(`Tripo job failed with status: ${status}. Message: ${result.message || 'Unknown error'}`);
    } else {
      // Still queued or running. Increment pollCount.
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
    console.error("Tripo Provider Check Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to check or save Tripo job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

module.exports = { runTripoProvider, checkTripoProvider };
