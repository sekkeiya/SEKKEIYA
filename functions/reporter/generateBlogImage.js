/**
 * generateBlogImage.js — S.Blog 記事のセクション画像を生成する専用エンドポイント。
 *
 * 共有の requestAiRender は「都度クレジット消費」だが、S.Blog の画像は
 * **クレジット制にせず、AI音声と同じ『利用枠（時間窓リセット）』でカバー**する方針。
 * そこで本関数は:
 *  - クレジットを一切消費しない（costCredits:0, source:'blog'）
 *  - 有料プラン限定（無料プランは記事だけ生成し画像は付けない）
 *  - ローリング7日窓のソフト上限（新規生成のみ計上）で青天井を防ぐ
 * を満たす。画像生成の実処理（Gemini nanobanana）は既存 provider を流用する。
 *
 * 返り値: { success, jobId } / { success:false, code:'PLAN_REQUIRED'|'BLOG_IMAGE_LIMITED', resetAt }
 * クライアントは requestAiRender と同様に users/{uid}/aiJobs/{jobId} を購読して結果URLを得る。
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { geminiApiKey } = require("../airender/providers/nanobananaProvider");
const { renderProviderFactory } = require("../airender/providers/providerFactory");

const WEEK_MS = 7 * 24 * 3600e3;
const WEEKLY_CAP = 60; // 記事画像/7日（実測後に調整）。1記事セクション数×数本を想定

/** 有料プラン判定（ttsSynthesize と同基準）。 */
async function isPaidUser(db, uid) {
  try {
    const snap = await db.collection("users").doc(uid).get();
    const u = snap.exists ? snap.data() : {};
    return (u.plan || "free") !== "free" || !!u.customAiLimits;
  } catch {
    return false;
  }
}

exports.generateBlogImage = onCall(
  { secrets: [geminiApiKey], timeoutSeconds: 180, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in");
    const uid = request.auth.uid;
    const prompt = String(request.data?.prompt || "").trim();
    if (!prompt) throw new HttpsError("invalid-argument", "prompt is required");

    const db = admin.firestore();

    // 有料プラン限定（無料は画像なしで degrade）
    if (!(await isPaidUser(db, uid))) {
      return { success: false, code: "PLAN_REQUIRED", reason: "記事画像は有料プランでご利用いただけます" };
    }

    // 🎯 利用枠（ローリング7日・新規生成のみ計上）。予約を1件確保できなければ上限。
    const usageRef = db.collection("blogImageUsage").doc(uid);
    let resetAt = null;
    try {
      const ok = await db.runTransaction(async (tx) => {
        const snap = await tx.get(usageRef);
        const now = Date.now();
        const log = (snap.exists ? snap.data().log || [] : []).filter((t) => now - t < WEEK_MS);
        if (log.length >= WEEKLY_CAP) {
          resetAt = Math.min(...log) + WEEK_MS;
          return false;
        }
        log.push(now);
        tx.set(usageRef, { log, updatedAt: new Date().toISOString() }, { merge: true });
        return true;
      });
      if (!ok) {
        return { success: false, code: "BLOG_IMAGE_LIMITED", resetAt, reason: "記事画像の利用枠に達しました（時間経過で回復します）" };
      }
    } catch (e) {
      console.warn(`[generateBlogImage] usage check failed (fail-open): ${e.message}`);
    }

    // クレジットを消費せずジョブを作成（requestAiRender と同じ aiJobs スキーマ）
    const jobRef = db.collection("users").doc(uid).collection("aiJobs").doc();
    await jobRef.set({
      type: "image_render",
      provider: "nanobanana",
      selectedModel: "nanobanana",
      source: "blog",          // 由来（分析・課金対象外の識別）
      costTokens: 0,
      costCredits: 0,          // ★クレジット非消費（利用枠でカバー）
      providerJobId: null,
      status: "pending",
      projectId: request.data?.projectId || null,
      workspaceId: null,
      prompt,
      inputImageUrl: null,
      inputImageStoragePath: null,
      errorMessage: null,
      createdBy: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    renderProviderFactory
      .startJob(jobRef.id, uid, { provider: "nanobanana", prompt, inputImageUrl: null, inputImageStoragePath: null, projectId: request.data?.projectId || null, workspaceId: null })
      .catch(console.error);

    return { success: true, jobId: jobRef.id };
  },
);
