/**
 * Nanobanana (Gemini 2.5 Flash Image) Provider for AI Render
 *
 * Calls the Gemini 2.5 Flash Image API to generate / edit an image based on a
 * text prompt and (optionally) a base image. Saves the resulting PNG to
 * Cloud Storage and writes a completed aiJobs document.
 */

const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

const geminiApiKey = defineSecret("GEMINI_API_KEY");

const MODEL_ID = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent`;
// Approximate p90 wall-time for nanobanana image generation. Surfaced to clients
// so they can render an estimated progress bar (real % is not available — Gemini
// returns a single response). Bumped to 60s based on observed real timings;
// will tune further after gathering more samples via the [nanobanana-timing] logs.
const ESTIMATED_DURATION_MS = 60000;

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch input image (${res.status})`);
  }
  const contentType = res.headers.get("content-type") || "image/png";
  const buf = await res.arrayBuffer();
  return {
    mimeType: contentType.split(";")[0].trim(),
    data: Buffer.from(buf).toString("base64"),
  };
}

async function runNanobananaProvider(jobId, uid, data) {
  const db = admin.firestore();
  const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc(jobId);
  const t0 = Date.now();
  const ms = (since) => `${Date.now() - since}ms`;

  try {
    const apiKey = geminiApiKey.value() || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const prompt = (data.prompt || "").trim();
    if (!prompt && !data.inputImageUrl) {
      throw new Error("Either prompt or inputImageUrl is required");
    }

    await jobRef.update({
      status: "processing",
      providerJobId: `nanobanana_${Date.now()}`,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      estimatedDurationMs: ESTIMATED_DURATION_MS,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`[nanobanana-timing] job=${jobId} status_update=${ms(t0)}`);

    // Build request parts: text + optional inline base image
    const parts = [];
    if (prompt) parts.push({ text: prompt });
    let inputBytes = 0;
    if (data.inputImageUrl) {
      const tDl = Date.now();
      const img = await fetchImageAsBase64(data.inputImageUrl);
      inputBytes = Math.floor((img.data.length * 3) / 4);
      console.log(
        `[nanobanana-timing] job=${jobId} input_image_download=${ms(tDl)} bytes=${inputBytes}`
      );
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    };

    const tGen = Date.now();
    const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(
      `[nanobanana-timing] job=${jobId} gemini_call=${ms(tGen)} http=${response.status}`
    );

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      throw new Error(
        `Gemini API returned non-JSON (${response.status}): ${text.slice(0, 200)}`
      );
    }

    if (!response.ok) {
      const msg = result?.error?.message || text.slice(0, 200);
      throw new Error(`Gemini API Error (${response.status}): ${msg}`);
    }

    const candidateParts =
      result?.candidates?.[0]?.content?.parts ||
      result?.candidates?.[0]?.content?.[0]?.parts ||
      [];
    const imagePart = candidateParts.find((p) => p.inlineData || p.inline_data);
    if (!imagePart) {
      const textOut = candidateParts
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n")
        .slice(0, 200);
      throw new Error(
        `No image returned by Gemini.${textOut ? " Text: " + textOut : ""}`
      );
    }

    const inline = imagePart.inlineData || imagePart.inline_data;
    const mimeType = inline.mimeType || inline.mime_type || "image/png";
    const imageBuffer = Buffer.from(inline.data, "base64");

    // Upload to Firebase Storage
    const tUp = Date.now();
    const ext = mimeType.split("/")[1] || "png";
    const storagePath = `users/${uid}/ai_render/${jobId}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(imageBuffer, { metadata: { contentType: mimeType } });
    await file.makePublic();
    const resultStorageUrl = file.publicUrl();
    console.log(
      `[nanobanana-timing] job=${jobId} storage_upload=${ms(tUp)} out_bytes=${imageBuffer.length}`
    );

    // Create asset record
    const assetRef = db.collection("assets").doc();
    await assetRef.set({
      type: "image",
      storageUrl: resultStorageUrl,
      thumbnailUrl: resultStorageUrl,
      imageUrl: resultStorageUrl,
      ownerId: uid,
      name: `AI Render ${new Date().toISOString().slice(0, 10)}`,
      generation: {
        provider: "nanobanana",
        prompt,
        inputImageUrl: data.inputImageUrl || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        jobId,
      },
      metadata: {
        source: "ai_generated",
        provider: "nanobanana",
        generationJobId: jobId,
        originalImageUrl: data.inputImageUrl || "",
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
    console.log(`[nanobanana-timing] job=${jobId} total=${ms(t0)}`);
  } catch (error) {
    console.error("Nanobanana Provider Error:", error);
    await jobRef.update({
      status: "failed",
      errorMessage: error.message || "Failed to run nanobanana job",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

module.exports = { runNanobananaProvider, geminiApiKey };
