/**
 * fal.ai FLUX.1 [dev] + 公式LoRA Provider for AI Render
 *
 * SEKKEIYA製の公式LoRA（内観パース等）を載せた画像生成。fal.run の同期エンドポイント
 * fal-ai/flux-lora を呼び、生成画像を Cloud Storage に保存して aiJobs を completed にする。
 * どのLoRAを使うかは data.loraId で選択（既定: interior-perspective）。
 *
 * FAL_KEY は flux-schnell と共用（requestAiRender の secrets に falKey 登録済み）。
 */

const admin = require("firebase-admin");
const { falKey } = require("./falFluxProvider");
const { getOfficialLora } = require("./officialLoras");

const ENDPOINT = "https://fal.run/fal-ai/flux-lora";
const ESTIMATED_DURATION_MS = 12000;

async function runFluxLoraProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);
  const t0 = Date.now();
  const ms = (since) => `${Date.now() - since}ms`;

  try {
    let apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      try { apiKey = falKey.value(); } catch { /* 未バインド */ }
    }
    if (!apiKey) {
      throw new Error("FAL_KEY が未設定です（flux-schnell と共用のキー）。");
    }

    const lora = getOfficialLora(data.loraId);
    if (!lora.url) {
      throw new Error(`未登録の公式LoRAです: loraId="${data.loraId}"（officialLoras.js に登録してください）`);
    }

    let prompt = (data.prompt || "").trim();
    if (!prompt) throw new Error("prompt is required for flux-lora");
    // トリガー語をプロンプト先頭に付与（未含有時のみ）
    if (lora.triggerWord && !prompt.toLowerCase().includes(lora.triggerWord.toLowerCase())) {
      prompt = `${lora.triggerWord}, ${prompt}`;
    }

    await jobRef.update({
      status: "processing",
      providerJobId: `flux_lora_${lora.id}_${Date.now()}`,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      estimatedDurationMs: ESTIMATED_DURATION_MS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const tGen = Date.now();
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        loras: [{ path: lora.url, scale: lora.scale ?? 1.0 }],
        image_size: "landscape_4_3",
        num_images: 1,
        num_inference_steps: 28,
        enable_safety_checker: true,
      }),
    });
    console.log(`[flux-lora-timing] job=${jobId} lora=${lora.id} fal_call=${ms(tGen)} http=${response.status}`);

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`fal.ai returned non-JSON (${response.status}): ${text.slice(0, 200)}`);
    }
    if (!response.ok) {
      const msg = result?.detail || result?.error || text.slice(0, 200);
      throw new Error(`fal.ai API Error (${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg).slice(0, 200)}`);
    }

    const imageUrl = result?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image returned by fal.ai");
    const mimeType = result?.images?.[0]?.content_type || "image/jpeg";

    const tDl = Date.now();
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`);
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    console.log(`[flux-lora-timing] job=${jobId} download=${ms(tDl)} bytes=${imageBuffer.length}`);

    const tUp = Date.now();
    const ext = mimeType.split("/")[1] || "jpg";
    const storagePath = `users/${uid}/ai_render/${jobId}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const resultStorageUrl = file.publicUrl();
    console.log(`[flux-lora-timing] job=${jobId} storage_upload=${ms(tUp)}`);

    const assetRef = db.collection("assets").doc();
    await assetRef.set({
      type: "image",
      storageUrl: resultStorageUrl,
      thumbnailUrl: resultStorageUrl,
      imageUrl: resultStorageUrl,
      ownerId: uid,
      name: `AI Render ${new Date().toISOString().slice(0, 10)}`,
      generation: {
        provider: "flux-lora",
        loraId: lora.id,
        prompt,
        inputImageUrl: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        jobId,
      },
      metadata: {
        source: "ai_generated",
        provider: "flux-lora",
        loraId: lora.id,
        generationJobId: jobId,
        originalImageUrl: "",
        prompt,
        projectId: data.projectId || null,
        workspaceId: data.workspaceId || null,
      },
      sourceCollection: "global_assets",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await jobRef.update({
      status: "completed",
      resultAssetId: assetRef.id,
      resultStorageUrl,
      resultMimeType: mimeType,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[flux-lora-timing] job=${jobId} total=${ms(t0)}`);
  } catch (error) {
    console.error("FluxLora Provider Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to run flux-lora job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = { runFluxLoraProvider };
