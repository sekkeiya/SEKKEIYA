const admin = require("firebase-admin");

// TripoSR 推論サーバーのエンドポイント
// Option C (ローカルFastAPI) または Option A/B (RunPod, Cloud Run GPU) などを想定
const TRIPOSR_API_URL = process.env.TRIPOSR_API_URL || "http://127.0.0.1:8000";

/**
 * Phase 3-1: TripoSR 推論サーバーへジョブを送信
 */
async function runTriposrProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);

  try {
    const { inputImageUrl } = data;
    if (!inputImageUrl) {
      throw new Error("inputImageUrl is required for triposr");
    }

    // 実際のAPI仕様は Phase 3-2 の推論サーバー実装に合わせる
    // ここでは async な POST /jobs エンドポイントを想定
    const response = await fetch(`${TRIPOSR_API_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: inputImageUrl,
        jobId: jobId,
        uid: uid
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TripoSR API error: ${response.status} ${errText}`);
    }

    const result = await response.json();
    // サーバーが providerJobId を返すと想定。なければフォールバック
    const providerJobId = result.providerJobId || `triposr-local-${Date.now()}`;

    await jobRef.update({
      providerJobId: providerJobId,
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, providerJobId };
  } catch (error) {
    console.error(`[runTriposrProvider] error for job ${jobId}:`, error);
    await jobRef.update({
      status: "error",
      errorMessage: error.message || "Failed to start TripoSR job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    throw error;
  }
}

/**
 * Phase 3-1: TripoSR 推論サーバーのジョブ状態を確認
 */
async function checkTriposrProvider(jobId, uid, jobData) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);
  const providerJobId = jobData.providerJobId;

  try {
    if (!providerJobId) {
      throw new Error("No providerJobId found");
    }

    const response = await fetch(`${TRIPOSR_API_URL}/jobs/${providerJobId}`);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`TripoSR API error: ${response.status} ${errText}`);
    }

    const result = await response.json();

    if (result.status === "success" || result.status === "done") {
      const modelUrl = result.glbUrl;
      if (!modelUrl) {
        throw new Error("No glbUrl found in TripoSR success response");
      }

      // Download and Upload to Firebase Storage
      const storagePath = `users/${uid}/generated_models/${jobId}.glb`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      
      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) {
        throw new Error(`Failed to download model from ${modelUrl}`);
      }
      const buffer = await modelResponse.arrayBuffer();
      await file.save(Buffer.from(buffer), {
        metadata: { contentType: "model/gltf-binary" }
      });
      await file.makePublic(); 
      const glbStoragePath = file.publicUrl();

      // Create Asset in root assets collection
      const assetRef = db.collection("assets").doc();
      const assetData = {
        type: "3d_model",
        storageUrl: glbStoragePath,
        ownerId: uid,
        generation: {
          provider: "triposr",
          inputImageUrl: jobData.inputImageUrl || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          parameters: { texture: false },
          jobId: jobId
        },
        metadata: {
          source: "ai_generated",
          provider: "triposr",
          generationJobId: jobId,
          originalImageUrl: jobData.inputImageUrl || "",
          imageHash: jobData.imageHash || null,
          projectId: jobData.projectId || null,
          workspaceId: jobData.workspaceId || null
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await assetRef.set(assetData);

      // Map to Project Item if autoPlace is true
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

      await jobRef.update({
        status: "completed",
        resultAssetId: assetRef.id,
        glbStoragePath,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return { status: "completed", glbUrl: glbStoragePath };
    } else if (result.status === "processing" || result.status === "pending") {
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
      return { status: "processing" };
    } else if (result.status === "error" || result.status === "failed") {
      throw new Error(`TripoSR job failed: ${result.error || "Unknown error"}`);
    } else {
      throw new Error(`TripoSR job returned unknown status: ${result.status}`);
    }

  } catch (error) {
    console.error(`[checkTriposrProvider] error for job ${jobId}:`, error);
    await jobRef.update({
      status: "error",
      errorMessage: error.message || "Failed to check TripoSR job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    throw error;
  }
}

module.exports = {
  runTriposrProvider,
  checkTriposrProvider
};
