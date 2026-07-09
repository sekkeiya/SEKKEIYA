const { HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

/**
 * Knowledge / RAG ingestion & retrieval
 * ------------------------------------------------------------------
 * AI Studio「ナレッジ (RAG)」用。PDF等から抽出したテキストをチャンク化し、
 * gemini-embedding-001 で埋め込み、Firestore に保存する。
 *
 *   users/{uid}/knowledgeSources/{sourceId}  ... 1資料のメタ(title/summary/chunkCount/status)
 *   users/{uid}/knowledgeChunks/{chunkId}    ... チャンク本文 + embedding (検索対象)
 *
 * retrieveKnowledge はクエリを埋め込み、コサイン類似で上位チャンクを返す
 * (SEKKEIYA Chat / 評価AI から将来利用)。
 */

const MAX_CHUNKS = 120;         // 1資料あたりの上限(コスト/時間制御)
const CHUNK_SIZE = 900;         // 文字 (細かめにして検索精度/チャンク数を確保)
const CHUNK_OVERLAP = 120;      // 文字
const MAX_OCR_PAGES = 20;       // OCR フォールバックの上限ページ

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not defined in the environment.");
  return new GoogleGenerativeAI(apiKey);
};

const cosineSimilarity = (a, b) => {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/** テキストを重なり付きでチャンク分割 (段落境界をなるべく尊重) */
const chunkText = (text) => {
  const clean = String(text || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const chunks = [];
  let i = 0;
  while (i < clean.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      // 近くの改行/句点で切る
      const slice = clean.slice(i, end);
      const lastBreak = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf("。"), slice.lastIndexOf(". "));
      if (lastBreak > CHUNK_SIZE * 0.5) end = i + lastBreak + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = end - CHUNK_OVERLAP;
    if (i < 0) i = 0;
  }
  return chunks;
};

/** 図面/スキャンPDFのページ画像を vision でOCRしてテキスト化 */
const ocrImages = async (genAI, images) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const texts = [];
  const n = Math.min(images.length, MAX_OCR_PAGES);
  for (let i = 0; i < n; i++) {
    const img = images[i] || {};
    const dataB64 = img.data || (typeof img === "string" ? img : "");
    if (!dataB64) continue;
    try {
      const r = await model.generateContent([
        { text: "この画像（図面/資料の1ページ）に含まれる文字・表・寸法・注記・部材名を、すべてプレーンテキストで書き出してください。レイアウトは保持しなくてよい。日本語はそのまま。読み取れない装飾は省略可。" },
        { inlineData: { data: dataB64, mimeType: img.mimeType || "image/jpeg" } },
      ]);
      const t = (r.response.text() || "").trim();
      if (t) texts.push(t);
    } catch (e) {
      console.warn(`[ingestKnowledge] OCR page ${i} failed:`, e.message);
    }
  }
  return texts.join("\n\n");
};

/**
 * exports.ingestKnowledge
 * @param {object} data { title, text, sourceFile, images }
 * @param {string} uid
 */
exports.ingestKnowledge = async (data, uid) => {
  if (!uid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  const { title = "Untitled", text = "", sourceFile = "", images = null } = data || {};

  const genAI = getGeminiClient();

  // テキスト層が乏しい(図面/スキャン)場合は画像をOCRして補う
  let fullText = String(text || "").trim();
  let usedOcr = false;
  if (fullText.length < 300 && Array.isArray(images) && images.length > 0) {
    const ocr = await ocrImages(genAI, images);
    if (ocr.length > fullText.length) { fullText = ocr; usedOcr = true; }
  }

  if (fullText.length < 20) {
    throw new HttpsError("invalid-argument", "テキストを抽出できませんでした（画像のみのPDFの可能性）。");
  }

  const chunks = chunkText(fullText);
  if (chunks.length === 0) throw new HttpsError("invalid-argument", "チャンク化できませんでした。");

  const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

  const db = admin.firestore();
  const sourceRef = db.collection("users").doc(uid).collection("knowledgeSources").doc();
  const sourceId = sourceRef.id;
  const now = admin.firestore.FieldValue.serverTimestamp();

  // 1. 埋め込み生成
  const embeddedChunks = [];
  for (let idx = 0; idx < chunks.length; idx++) {
    try {
      const res = await embeddingModel.embedContent(chunks[idx]);
      const vec = res.embedding && res.embedding.values;
      if (Array.isArray(vec) && vec.length > 0) {
        embeddedChunks.push({ index: idx, text: chunks[idx], embedding: vec });
      }
    } catch (e) {
      console.warn(`[ingestKnowledge] embed failed for chunk ${idx}:`, e.message);
    }
  }
  if (embeddedChunks.length === 0) {
    throw new HttpsError("internal", "埋め込み生成に失敗しました。");
  }

  // 2. 要約 (任意・失敗しても続行)
  let summary = "";
  try {
    const sumModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const head = chunks.slice(0, 6).join("\n").slice(0, 6000);
    const r = await sumModel.generateContent(
      `次の資料の要点を、日本語で2〜3文に要約してください。設計・建築の実務知識として何に使えるかが分かるように。\n\n---\n${head}`,
    );
    summary = (r.response.text() || "").trim().slice(0, 600);
  } catch (e) {
    console.warn("[ingestKnowledge] summary failed:", e.message);
  }

  // 3. Firestore 書き込み (チャンク + ソースメタ)
  // チャンクは 3072 次元の embedding を持ち、配列は既定で全要素が索引化される
  // (1 チャンク = 3072 索引エントリ)。全チャンクを 1 バッチで commit すると
  // 大きめの資料 (法令など数十チャンク) で「Transaction too big」になり失敗する。
  // → チャンクを小さいバッチに分割して commit する (deleteKnowledgeSource と同じ流儀)。
  // ソースメタはチャンクを全て書き終えた後に最後に書く
  // (途中失敗時にソースだけ "ready" で残る不整合を防ぐ)。
  const CHUNK_WRITE_BATCH = 10; // 10 × 3072 索引 = 3万エントリ/commit。上限に対し十分小さい
  try {
    for (let i = 0; i < embeddedChunks.length; i += CHUNK_WRITE_BATCH) {
      const batch = db.batch();
      for (const c of embeddedChunks.slice(i, i + CHUNK_WRITE_BATCH)) {
        const chunkRef = db.collection("users").doc(uid).collection("knowledgeChunks").doc();
        batch.set(chunkRef, {
          sourceId,
          index: c.index,
          text: c.text,
          embedding: c.embedding,
          embeddingStatus: "ready",
          createdAt: now,
        });
      }
      await batch.commit();
    }
    await sourceRef.set({
      id: sourceId,
      type: "document",
      title,
      sourceFile,
      summary,
      chunkCount: embeddedChunks.length,
      textLength: fullText.length,
      usedOcr,
      status: "ready",
      ownerId: uid,
      createdAt: now,
      updatedAt: now,
    });
  } catch (e) {
    // 真因をクライアントに伝える (従来は bare "INTERNAL" で握り潰されていた)。
    console.error("[ingestKnowledge] Firestore write failed:", e);
    throw new HttpsError("internal", `ナレッジの保存に失敗しました: ${e.message || e}`);
  }

  return { id: sourceId, chunkCount: embeddedChunks.length, summary, usedOcr, textLength: fullText.length, truncated: chunks.length >= MAX_CHUNKS };
};

/**
 * exports.retrieveKnowledge
 * @param {object} data { query, topK, sourceIds }
 * @param {string} uid
 */
exports.retrieveKnowledge = async (data, uid) => {
  if (!uid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  const { query = "", topK = 5, sourceIds = null } = data || {};
  if (!query || query.trim() === "") return { results: [] };

  const genAI = getGeminiClient();
  const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  let qvec;
  try {
    const r = await embeddingModel.embedContent(query);
    qvec = r.embedding.values;
  } catch (e) {
    throw new HttpsError("internal", "クエリ埋め込みに失敗しました。");
  }

  const db = admin.firestore();
  const snap = await db.collection("users").doc(uid).collection("knowledgeChunks")
    .where("embeddingStatus", "==", "ready").limit(2000).get();

  const scored = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (sourceIds && Array.isArray(sourceIds) && !sourceIds.includes(d.sourceId)) return;
    if (!Array.isArray(d.embedding)) return;
    const score = cosineSimilarity(qvec, d.embedding);
    scored.push({ text: d.text, sourceId: d.sourceId, index: d.index, score });
  });
  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, Math.max(1, Math.min(20, topK))) };
};

/**
 * exports.deleteKnowledgeSource
 * @param {object} data { sourceId }
 * @param {string} uid
 */
exports.deleteKnowledgeSource = async (data, uid) => {
  if (!uid) throw new HttpsError("unauthenticated", "ログインが必要です。");
  const { sourceId } = data || {};
  if (!sourceId) throw new HttpsError("invalid-argument", "sourceId が必要です。");

  const db = admin.firestore();
  // チャンク削除 (バッチ分割)
  const chunkQ = db.collection("users").doc(uid).collection("knowledgeChunks").where("sourceId", "==", sourceId);
  const chunkSnap = await chunkQ.get();
  const docs = chunkSnap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    docs.slice(i, i + 450).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  await db.collection("users").doc(uid).collection("knowledgeSources").doc(sourceId).delete();
  return { success: true, deletedChunks: docs.length };
};
