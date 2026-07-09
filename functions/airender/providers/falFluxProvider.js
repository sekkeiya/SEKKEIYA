/**
 * fal.ai FLUX.1 [schnell] Provider for AI Render
 *
 * 高速画像生成（数秒/枚）。fal.run の同期エンドポイントを呼び、
 * 生成画像を Cloud Storage に保存して aiJobs を completed にする。
 *
 * ⚠️ 有効化手順（現在は足場のみ・APIキー未設定）:
 *   1. https://fal.ai でアカウント作成 → API Key を取得
 *   2. `firebase functions:secrets:set FAL_KEY`
 *   3. requestAiRender.js の secrets 配列に falKey を追加
 *      （コメントアウト済みの行を有効化するだけ）
 *   4. `firebase deploy --only functions:requestAiRender`
 *   5. デスクトップ側 useAiSettingsStore の 'flux-schnell' を available: true に変更
 */

const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

const falKey = defineSecret("FAL_KEY");

const ENDPOINT = "https://fal.run/fal-ai/flux/schnell";
// schnell は数秒で返る。プログレスバー用の見積もり。
const ESTIMATED_DURATION_MS = 8000;

async function runFalFluxProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);
  const t0 = Date.now();
  const ms = (since) => `${Date.now() - since}ms`;

  try {
    // secrets 配列に falKey を追加してデプロイするまで value() は使えないため env を先に見る
    let apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      try { apiKey = falKey.value(); } catch { /* 未バインド */ }
    }
    if (!apiKey) {
      throw new Error(
        "FAL_KEY が未設定です。firebase functions:secrets:set FAL_KEY で設定し、" +
        "index.js の requestAiRender secrets に falKey を追加してデプロイしてください。"
      );
    }

    const prompt = (data.prompt || "").trim();
    if (!prompt) throw new Error("prompt is required for flux-schnell");

    await jobRef.update({
      status: "processing",
      providerJobId: `flux_schnell_${Date.now()}`,
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
        image_size: "landscape_4_3",
        num_images: 1,
        enable_safety_checker: true,
      }),
    });
    console.log(`[flux-timing] job=${jobId} fal_call=${ms(tGen)} http=${response.status}`);

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

    // fal の一時URLから取得して自前の Storage に保存（URL失効対策）
    const tDl = Date.now();
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Failed to download generated image (${imgRes.status})`);
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    console.log(`[flux-timing] job=${jobId} download=${ms(tDl)} bytes=${imageBuffer.length}`);

    const tUp = Date.now();
    const ext = mimeType.split("/")[1] || "jpg";
    const storagePath = `users/${uid}/ai_render/${jobId}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const resultStorageUrl = file.publicUrl();
    console.log(`[flux-timing] job=${jobId} storage_upload=${ms(tUp)}`);

    const assetRef = db.collection("assets").doc();
    await assetRef.set({
      type: "image",
      storageUrl: resultStorageUrl,
      thumbnailUrl: resultStorageUrl,
      imageUrl: resultStorageUrl,
      ownerId: uid,
      name: `AI Render ${new Date().toISOString().slice(0, 10)}`,
      generation: {
        provider: "flux-schnell",
        prompt,
        inputImageUrl: "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        jobId,
      },
      metadata: {
        source: "ai_generated",
        provider: "flux-schnell",
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
    console.log(`[flux-timing] job=${jobId} total=${ms(t0)}`);
  } catch (error) {
    console.error("FalFlux Provider Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to run flux-schnell job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = { runFalFluxProvider, falKey };
