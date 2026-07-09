const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

const tripoApiKey = defineSecret("TRIPO_API_KEY");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tripo API call with retry. Concurrent batch generation makes transient errors
// (429 rate limit, 5xx, network resets) much more likely; a single hiccup must not
// fail the whole job. Retries up to 3 times with backoff, returns parsed JSON.
async function tripoFetchJson(label, url, options, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(2000 * i);
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`${label} returned non-JSON (${res.status}): ${text.slice(0, 150)}`);
      }
      if (res.ok && json.code === 0) return json;
      const err = new Error(`${label} Error: ${res.status} - ${json.message || JSON.stringify(json)}`);
      // 4xx (except 429) are permanent — retrying won't help.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw Object.assign(err, { permanent: true });
      lastErr = err;
    } catch (e) {
      if (e.permanent) throw e;
      lastErr = e;
    }
    console.warn(`[${label}] attempt ${i + 1}/${attempts} failed:`, lastErr.message);
  }
  throw lastErr;
}

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

    // 1.5 Download the image and upload to Tripo first to avoid URL validation errors
    console.log("Downloading image from storage...");
    const imageRes = await fetch(data.inputImageUrl);
    if (!imageRes.ok) throw new Error("Failed to download input image from storage: " + imageRes.statusText);
    const imageBlob = await imageRes.blob();

    console.log("Uploading image to Tripo API...");
    // FormData は再送のたびに作り直す（同一 body の再利用はストリーム消費済みになるため）
    const uploadResult = await tripoFetchJson("Tripo Upload", "https://api.tripo3d.ai/v2/openapi/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      },
      get body() {
        const formData = new FormData();
        formData.append('file', imageBlob, 'image.png');
        return formData;
      }
    });

    const file_token = uploadResult.data.image_token;
    console.log("Tripo image uploaded, token:", file_token);

    const payload = {
      type: "image_to_model",
      file: {
        type: "png",
        file_token: file_token
      },
      model_version: "v2.5-20250123"
    };

    console.log("Tripo API Request Payload:", JSON.stringify(payload));

    // 2. Call Tripo API to create task
    const result = await tripoFetchJson("Tripo Task Create", "https://api.tripo3d.ai/v2/openapi/task", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "SEKKEIYA/1.0"
      },
      body: JSON.stringify(payload)
    });
    console.log("Tripo API Response:", JSON.stringify(result));

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
    const msg = error.message || "";
    const isCreditsExhausted = /not enough credit/i.test(msg);
    // 429 / "exceeded the limit of generation" = Tripo の同時実行タスク数の上限。
    // 課金されないため、クライアントが枠の空くのを待って再試行できるよう専用コードを付ける。
    const isRateLimited = !isCreditsExhausted && /\b429\b|exceeded the limit of generation|rate limit/i.test(msg);
    let errorCode = null;
    let errorMessage = msg || "Failed to start Tripo job";
    if (isCreditsExhausted) {
      errorCode = "TRIPO_CREDITS_EXHAUSTED";
      errorMessage = "Tripoのクレジット残高が不足しています。Tripoアカウントでチャージしてください。";
    } else if (isRateLimited) {
      errorCode = "TRIPO_RATE_LIMITED";
      errorMessage = "Tripoの同時生成数の上限に達しました。順番待ち中です。";
    }
    await jobRef.update({
      status: "failed",
      errorMessage,
      errorCode,
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

    // 1. Poll Tripo API (1回のみ。失敗時のリトライは catch 側の checkErrorCount で
    //    次回ポーリングに委ねる — onSchedule の実行時間内で粘る必要はない)
    const result = await tripoFetchJson(
      "Tripo Check",
      `https://api.tripo3d.ai/v2/openapi/task/${jobData.providerJobId}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "SEKKEIYA/1.0"
        }
      },
      1
    );

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
        throw Object.assign(new Error(`No model URL found in output. Keys: ${Object.keys(output || {}).join(", ")}`), { permanent: true });
      }
      
      // 2. Download and Upload to Firebase Storage
      const storagePath = `users/${uid}/generated_models/${jobId}.glb`;
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      
      const modelResponse = await fetch(modelUrl);
      if (!modelResponse.ok) throw new Error(`Failed to download model from Tripo: ${modelResponse.status}`);
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
      throw Object.assign(new Error(`Tripo job failed with status: ${status}. Message: ${result.message || 'Unknown error'}`), { permanent: true });
    } else {
      // Still queued or running. Increment pollCount.
      const currentPollCount = (jobData.pollCount || 0) + 1;
      const maxPollCount = jobData.maxPollCount || 60;

      if (currentPollCount > maxPollCount) {
        throw Object.assign(new Error("Job timed out (exceeded maxPollCount)"), { permanent: true });
      } else {
        await jobRef.update({
          pollCount: currentPollCount,
          checkErrorCount: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

  } catch (error) {
    console.error("Tripo Provider Check Error:", error);
    // 一時的なエラー（ネットワーク・429・5xx）で即 failed にしない。
    // permanent なエラーか、連続3回失敗した場合のみ failed に確定する。
    const checkErrorCount = (jobData.checkErrorCount || 0) + 1;
    if (error.permanent || checkErrorCount >= 3) {
      await jobRef.update({
        status: "failed",
        errorMessage: error.message || "Failed to check or save Tripo job",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.warn(`[Job ${jobId}] transient check error ${checkErrorCount}/3 — will retry on next poll.`);
      await jobRef.update({
        checkErrorCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  }
}

module.exports = { runTripoProvider, checkTripoProvider };
