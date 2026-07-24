/**
 * articleAudio.js — 記事の音声版（Podcast）生成。**有料プラン限定**。
 *
 * S.Blog 記事の本文（Markdown）をAI音声（Gemini TTS）で全文合成し、
 * MP3（64kbps mono）にして Storage へ保存 → 記事の audioUrl に添付する。
 * 公開記事なら communityArticles ミラーにも反映され、公開ページで誰でも聴ける。
 *
 * 入力: { articleId, voice?, style? }（voice/style はユーザーの読み上げ設定を引き継ぐ）
 * 返り値: { success, audioUrl, durationSec }
 */

const admin = require("firebase-admin");
const { synthesizePcm, isPaidUser, TTS_AUDIO_USD_PER_SEC } = require("./ttsSynthesize");
const { recordUsage } = require("../usage/recordUsage");

/** Markdown → 読み上げ用プレーンテキスト（画像・リンクURL・末尾の参考記事リストを除去）。 */
function markdownToSpeechText(md) {
  let t = String(md || "");
  t = t.split(/\n#{2,3}\s*参考記事[\s\S]*$/)[0]; // 出典リンク集は読み上げない
  return t
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")   // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // リンク → テキストのみ
    .replace(/^#{1,6}\s*/gm, "")             // 見出し記号
    .replace(/[*_`>#|]/g, " ")               // 装飾
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** 文境界を優先しつつ最大 max 字のチャンクに分割（TTSの1回あたり上限対策）。 */
function chunkText(text, max = 700) {
  const sentences = String(text).split(/(?<=[。！？!?\n])/);
  const chunks = [];
  let cur = "";
  for (const s of sentences) {
    if ((cur + s).length > max && cur.trim()) { chunks.push(cur.trim()); cur = s; }
    else cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

exports.generateArticleAudio = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const uid = context.auth?.uid;
  if (!uid) return { success: false, reason: "unauthenticated" };
  if (!(await isPaidUser(db, uid))) {
    return { success: false, code: "PLAN_REQUIRED", reason: "音声版の生成は有料プランでご利用いただけます" };
  }

  const articleId = String(data.articleId || "");
  if (!articleId) return { success: false, reason: "articleId is required" };
  const voice = String(data.voice || "Kore").replace(/[^A-Za-z]/g, "") || "Kore";
  const style = ["anchor", "audiobook", "natural"].includes(data.style) ? data.style : "anchor";

  const ref = db.collection("users").doc(uid).collection("blogArticles").doc(articleId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, reason: "article not found" };
  const a = snap.data();
  const body = markdownToSpeechText(a.bodyMarkdown);
  if (!body) return { success: false, reason: "本文がまだありません" };

  // 全文（タイトル+本文）。長すぎる記事は約10分ぶんで打ち切り（コスト保護）
  const fullText = `${a.title || ""}。\n${body}`.slice(0, 12000);
  const chunks = chunkText(fullText);
  console.log(`[articleAudio] ${articleId} chunks=${chunks.length} chars=${fullText.length}`);

  // 2並列で順に合成（速度と レート制限のバランス）
  const pcms = new Array(chunks.length);
  let sampleRate = 24000;
  let ttsModel = null;
  for (let i = 0; i < chunks.length; i += 2) {
    const batch = chunks.slice(i, i + 2).map(async (text, j) => {
      const r = await synthesizePcm(text, voice, style);
      sampleRate = r.sampleRate;
      ttsModel = r.model || ttsModel;
      pcms[i + j] = r.pcm;
    });
    await Promise.all(batch);
  }
  const pcmAll = Buffer.concat(pcms.filter(Boolean));
  if (!pcmAll.length) return { success: false, reason: "音声を生成できませんでした" };
  const durationSec = Math.round(pcmAll.length / 2 / sampleRate);

  // 管理者APIモニターへ概算原価を計上（記事1本ぶんまとめて）。
  // await 必須: CF v2 のレスポンス後CPUスロットリングで fire-and-forget 書込が落ちるため
  await recordUsage({
    uid,
    email: context.auth?.token?.email || null,
    feature: "article-audio",
    provider: "gemini",
    model: ttsModel || "gemini-2.5-flash-preview-tts",
    costUsd: durationSec * TTS_AUDIO_USD_PER_SEC,
  });

  // MP3 エンコード（64kbps mono — 5分で約2.4MB）
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const enc = new Mp3Encoder(1, sampleRate, 64);
  const samples = new Int16Array(pcmAll.buffer, pcmAll.byteOffset, Math.floor(pcmAll.length / 2));
  const mp3Parts = [];
  const BLOCK = 1152 * 32;
  for (let i = 0; i < samples.length; i += BLOCK) {
    const out = enc.encodeBuffer(samples.subarray(i, Math.min(i + BLOCK, samples.length)));
    if (out.length) mp3Parts.push(Buffer.from(out));
  }
  const tail = enc.flush();
  if (tail.length) mp3Parts.push(Buffer.from(tail));
  const mp3 = Buffer.concat(mp3Parts);

  // Storage へ保存して記事に添付
  const bucket = admin.storage().bucket();
  const file = bucket.file(`users/${uid}/blog_audio/${articleId}.mp3`);
  await file.save(mp3, { metadata: { contentType: "audio/mpeg", cacheControl: "public,max-age=3600" } });
  await file.makePublic();
  const audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

  await ref.update({ audioUrl, audioDurationSec: durationSec, updatedAt: new Date().toISOString() });
  // 公開中なら「みんなの記事」ミラーにも反映（無ければ何もしない）
  try {
    const mirror = db.collection("communityArticles").doc(articleId);
    if ((await mirror.get()).exists) await mirror.set({ audioUrl, audioDurationSec: durationSec }, { merge: true });
  } catch (e) {
    console.warn(`[articleAudio] mirror update failed: ${e.message}`);
  }

  console.log(`[articleAudio] ${articleId} done ${durationSec}s ${(mp3.length / 1024 / 1024).toFixed(2)}MB`);
  return { success: true, audioUrl, durationSec };
};
