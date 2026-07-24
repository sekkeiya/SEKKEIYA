/**
 * ttsSynthesize.js — AI音声（ニューラルTTS）合成。**有料プラン限定**。
 *
 * Gemini TTS でテキストを音声化する。OSの標準音声（Web Speech）と違い
 * 読み間違いが少なく、トーン（アナウンサー/朗読/ナチュラル）を指示できる。
 *
 * 録音キャッシュ: 合成結果は WAV にして Storage `ttsCache/{hash}.wav` に保存する。
 * 同じテキスト×声×トーンの2回目以降は**合成せず音声ファイルを直接返す**（無料・高速）。
 * キャッシュは全ユーザー共有（同じフィード記事を聴く人が多いほど効く）。
 *
 * 返り値: { success, audioUrl } または初回 { success, audio(base64 PCM), mime, sampleRate, audioUrl? }
 */

const crypto = require("crypto");
const admin = require("firebase-admin");
const { recordUsage } = require("../usage/recordUsage");

// TTSモデル候補（先頭から順に試す。preview→GAの改名に耐える）
const TTS_MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-flash-tts", "gemini-2.5-pro-preview-tts"];

// 管理者APIモニター（機能別/モデル別）への概算原価計上レート。
// Gemini TTS: 音声出力 $10/100万トークン × 約25トークン/秒 ≒ $0.00025/秒（テキスト入力分は誤差として無視）
const TTS_AUDIO_USD_PER_SEC = (10 / 1_000_000) * 25;

// トーン → 読み上げスタイル指示（TTSモデルはインライン指示でスタイル制御できる）
const STYLE_PROMPTS = {
  anchor:
    "あなたはプロのニュースアナウンサーです。次の文章を、明瞭で落ち着いた、信頼感のあるニュース原稿のトーンで読み上げてください。固有名詞や数字は正確に、聞き取りやすい速さで:",
  audiobook:
    "あなたはオーディオブックの朗読者です。次の文章を、本の朗読のように豊かな抑揚と情感を込めて、聞き手が情景を思い浮かべられるように読み上げてください:",
  natural:
    "次の文章を、自然で聞き取りやすい話し方で読み上げてください:",
};

/** 有料プラン判定（requestGeneration.js と同基準: plan!=='free' or customAiLimits コンプ）。 */
async function isPaidUser(db, uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    const u = snap.exists ? snap.data() : {};
    return (u.plan || "free") !== "free" || !!u.customAiLimits;
  } catch {
    return false;
  }
}

/** 16bit mono PCM を WAV バッファに包む。 */
function pcmToWav(pcm, sampleRate) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);  // PCM
  header.writeUInt16LE(1, 22);  // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** Gemini TTS を叩いて { pcm(Buffer), sampleRate } を返す（内部用・他モジュールからも利用）。 */
async function synthesizePcm(text, voiceName, style) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.natural;

  let json = null;
  let lastStatus = 0;
  let usedModel = TTS_MODELS[0];
  for (const model of TTS_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${stylePrompt}\n\n${text}` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          },
        }),
      },
    );
    if (res.ok) { json = await res.json(); usedModel = model; break; }
    lastStatus = res.status;
    const body = await res.text().catch(() => "");
    console.warn(`[ttsSynthesize] ${model} HTTP ${res.status}: ${body.slice(0, 200)}`);
    if (res.status !== 404 && res.status !== 400) break; // モデル不在系のみ次候補へ
  }
  if (!json) throw new Error(`TTS API error (HTTP ${lastStatus})`);

  const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part) throw new Error("音声を生成できませんでした");
  const mime = part.inlineData.mimeType || "audio/L16;codec=pcm;rate=24000";
  const rateMatch = /rate=(\d+)/.exec(mime);
  return {
    pcm: Buffer.from(part.inlineData.data, "base64"),
    sampleRate: rateMatch ? Number(rateMatch[1]) : 24000,
    model: usedModel,
  };
}

// ── 利用枠（Claude式・時間窓リセット）─────────────────────────────
// キャッシュミス時の**新規合成秒数だけ**を ttsUsage/{uid} の時間バケットに記録し、
// ローリング5時間/7日間の二段窓で上限判定する。キャッシュ再生・保存済み音声は無制限（カウント外）。
// 上限到達時は {code:'TTS_LIMITED', resetAt} を返し、クライアントは標準音声へフォールバックする。
const LIMIT_5H_SEC = 30 * 60;   // 有料プラン既定: 5時間窓 30分（実測を見て調整）
const LIMIT_7D_SEC = 300 * 60;  // 有料プラン既定: 7日窓 300分
const HOUR_MS = 3600e3;

const bucketKey = (ms) => new Date(ms).toISOString().slice(0, 13); // "YYYY-MM-DDTHH"
const bucketMs = (key) => Date.parse(`${key}:00:00Z`);

/** 窓内の使用秒数と、窓が空き始める時刻（resetAt）を計算する。 */
function windowUsage(buckets, nowMs) {
  let s5 = 0, s7 = 0, oldest5 = null, oldest7 = null;
  for (const [k, sec] of Object.entries(buckets || {})) {
    const t = bucketMs(k);
    if (!(sec > 0) || Number.isNaN(t)) continue;
    const age = nowMs - t;
    if (age < 7 * 24 * HOUR_MS) { s7 += sec; if (oldest7 === null || t < oldest7) oldest7 = t; }
    if (age < 5 * HOUR_MS) { s5 += sec; if (oldest5 === null || t < oldest5) oldest5 = t; }
  }
  return {
    s5, s7,
    reset5At: oldest5 !== null ? oldest5 + 5 * HOUR_MS + HOUR_MS : null,   // バケット時間分の余裕込み
    reset7At: oldest7 !== null ? oldest7 + 7 * 24 * HOUR_MS + HOUR_MS : null,
  };
}

/** 利用状況を読む（ドキュメント無し=未使用）。 */
async function readTtsUsage(db, uid) {
  const snap = await db.collection("ttsUsage").doc(uid).get();
  return snap.exists ? (snap.data().buckets || {}) : {};
}

/** 合成した秒数を現在時刻のバケットへ加算し、7日より古いバケットを掃除する。 */
async function recordTtsUsage(db, uid, seconds) {
  const nowMs = Date.now();
  const key = bucketKey(nowMs);
  const ref = db.collection("ttsUsage").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const buckets = snap.exists ? (snap.data().buckets || {}) : {};
    buckets[key] = (buckets[key] || 0) + seconds;
    for (const k of Object.keys(buckets)) {
      if (nowMs - bucketMs(k) > 7 * 24 * HOUR_MS) delete buckets[k];
    }
    tx.set(ref, { buckets, updatedAt: new Date().toISOString() });
  });
}

/** 利用状況の取得（残量メーターUI用）。exports 用の callable 本体。 */
exports.getTtsUsage = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const uid = context.auth?.uid;
  if (!uid) return { success: false, reason: "unauthenticated" };
  const u = windowUsage(await readTtsUsage(db, uid), Date.now());
  return {
    success: true,
    used5hSec: Math.round(u.s5), limit5hSec: LIMIT_5H_SEC,
    used7dSec: Math.round(u.s7), limit7dSec: LIMIT_7D_SEC,
    reset5At: u.reset5At, reset7At: u.reset7At,
  };
};

exports.synthesizePcm = synthesizePcm;
exports.pcmToWav = pcmToWav;
exports.isPaidUser = isPaidUser;
exports.recordTtsUsage = recordTtsUsage;
exports.TTS_AUDIO_USD_PER_SEC = TTS_AUDIO_USD_PER_SEC;

exports.ttsSynthesize = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();
  const uid = context.auth?.uid;
  if (!uid) return { success: false, reason: "unauthenticated" };

  // 有料プラン限定（AI音声はAPIコストが発生するため）
  if (!(await isPaidUser(db, uid))) {
    return { success: false, code: "PLAN_REQUIRED", reason: "AI音声は有料プランでご利用いただけます（標準音声は無料です）" };
  }

  const text = String(data.text || "").trim().slice(0, 1800);
  if (!text) return { success: false, reason: "text is required" };
  const voiceName = String(data.voice || "Kore").replace(/[^A-Za-z]/g, "") || "Kore";
  const style = STYLE_PROMPTS[data.style] ? data.style : "natural";

  // 録音キャッシュ: 同一テキスト×声×トーンは Storage の音声ファイルを直接返す（合成なし）
  const hash = crypto.createHash("sha1").update(`${voiceName}|${style}|${text}`).digest("hex");
  const bucket = admin.storage().bucket();
  const file = bucket.file(`ttsCache/${hash}.wav`);
  try {
    const [exists] = await file.exists();
    if (exists) {
      return { success: true, cached: true, audioUrl: `https://storage.googleapis.com/${bucket.name}/${file.name}` };
    }
  } catch { /* キャッシュ確認失敗は合成にフォールバック */ }

  // 利用枠チェック（新規合成のみ。キャッシュヒットは上で返済済み＝無制限）
  try {
    const u = windowUsage(await readTtsUsage(db, uid), Date.now());
    if (u.s5 >= LIMIT_5H_SEC || u.s7 >= LIMIT_7D_SEC) {
      const resetAt = u.s5 >= LIMIT_5H_SEC ? u.reset5At : u.reset7At;
      return {
        success: false,
        code: "TTS_LIMITED",
        resetAt,
        reason: "AI音声の利用枠を使い切りました。しばらくすると回復します（標準音声は引き続き無料でご利用いただけます）",
      };
    }
  } catch (e) {
    console.warn(`[ttsSynthesize] usage check failed (fail-open): ${e.message}`);
  }

  let pcm, sampleRate, ttsModel;
  try {
    ({ pcm, sampleRate, model: ttsModel } = await synthesizePcm(text, voiceName, style));
  } catch (e) {
    return { success: false, reason: e.message };
  }

  // 合成秒数を利用枠に記録（PCM長から正確に算出。best-effort）
  const seconds = Math.max(1, Math.round(pcm.length / (sampleRate * 2)));
  try {
    await recordTtsUsage(db, uid, seconds);
  } catch (e) {
    console.warn(`[ttsSynthesize] usage record failed: ${e.message}`);
  }

  // 管理者APIモニター（機能別/モデル別/ユーザー別）へ概算原価を計上。
  // await 必須: CF v2 はレスポンス後にCPUがスロットリングされ fire-and-forget 書込が落ちる
  // （recordUsage は内部で例外を握るため await しても本体を巻き込まない）
  await recordUsage({
    uid,
    email: context.auth?.token?.email || null,
    feature: "tts-read",
    provider: "gemini",
    model: ttsModel,
    costUsd: seconds * TTS_AUDIO_USD_PER_SEC,
  });

  // 録音保存（ベストエフォート。失敗しても今回の再生は base64 で成立）
  let audioUrl = "";
  try {
    await file.save(pcmToWav(pcm, sampleRate), {
      metadata: { contentType: "audio/wav", cacheControl: "public,max-age=31536000" },
    });
    await file.makePublic();
    audioUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
  } catch (e) {
    console.warn(`[ttsSynthesize] cache save failed: ${e.message}`);
  }

  return {
    success: true,
    audio: pcm.toString("base64"),
    mime: `audio/L16;codec=pcm;rate=${sampleRate}`,
    sampleRate,
    audioUrl,
  };
};
