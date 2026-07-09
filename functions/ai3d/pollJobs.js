const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { providerFactory } = require("./providers/providerFactory");

const tripoApiKey = defineSecret("TRIPO_API_KEY");

// 開始処理（画像DL→Tripoアップロード→タスク作成）が途中で死んだジョブを
// 再起動するまでの猶予。これより新しいジョブは requestAiGeneration がまだ
// 処理中の可能性があるため触らない。
const STALE_START_MS = 2 * 60 * 1000;
const MAX_START_RETRIES = 2;

// 1回のポーリングで同時にチェック/保存するジョブ数。完了ジョブは GLB(数〜数十MB)を
// メモリに載せて Storage へ保存するため、全件並列だと OOM する(256MiB を超えてクラッシュ
// → ジョブが completed にならずクライアントがタイムアウト失敗)。少数ずつ逐次処理する。
const CHECK_CONCURRENCY = 2;

// memory: 完了ジョブの GLB をメモリ展開してアップロードするため、既定 256MiB では不足。
// timeoutSeconds: 1チャンクずつ逐次処理するので余裕を持たせる。
exports.pollAiJobs = onSchedule(
  { schedule: "every 1 minutes", secrets: [tripoApiKey], memory: "1GiB", timeoutSeconds: 300 },
  async (event) => {
  const db = admin.firestore();

  try {
    // Query all active jobs across all users.
    // Ensure you have a collectionGroup index for "aiJobs" on "status" field.
    // "pending" も対象: 開始処理がインスタンス停止で死ぬと pending のまま残るため。
    const snapshot = await db.collectionGroup("aiJobs")
      .where("status", "in", ["pending", "processing"])
      .get();

    if (snapshot.empty) {
      console.log("No processing jobs found.");
      return;
    }

    // Filter for tripo (and mock if any, though mock usually finishes inline)
    // Meshy is currently out of scope for Phase 2-1
    const targetDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      if (data.archived === true || data.status === "cancelled" || data.status === "archived") return false;
      const p = data.provider;
      return p === "tripo3d" || p === "triposr" || p === "mock";
    });

    if (targetDocs.length === 0) {
      console.log("No processing Tripo jobs found.");
      return;
    }

    console.log(`Found ${targetDocs.length} Tripo jobs to poll.`);

    const processDoc = async (doc) => {
      const jobData = doc.data();
      const jobId = doc.id;
      // We need the uid. It's the parent of the parent.
      // Doc ref is: users/{uid}/aiJobs/{jobId}
      const uid = doc.ref.parent.parent.id;

      try {
        if (jobData.providerJobId) {
          await providerFactory.checkJob(jobId, uid, jobData);
          return;
        }
        // providerJobId がまだ無い = 開始処理が未完了。リクエスト直後なら待つが、
        // 一定時間経過していたら開始処理がインスタンス停止で死んだとみなし再起動する。
        const lastTouch = jobData.updatedAt?.toMillis?.() ?? jobData.createdAt?.toMillis?.() ?? 0;
        if (Date.now() - lastTouch < STALE_START_MS) return;

        const startRetryCount = jobData.startRetryCount || 0;
        if (startRetryCount >= MAX_START_RETRIES) {
          await doc.ref.update({
            status: "failed",
            errorMessage: "生成の開始に失敗しました（再試行上限）",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return;
        }
        console.log(`[Job ${jobId}] stale start detected — restarting provider (retry ${startRetryCount + 1}/${MAX_START_RETRIES}).`);
        await doc.ref.update({
          startRetryCount: startRetryCount + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // ジョブドキュメントに inputImageUrl 等が保存されているのでそのまま再開できる。
        await providerFactory.startJob(jobId, uid, jobData);
      } catch (err) {
        console.error(`Error checking job ${jobId}:`, err);
      }
    };

    // 少数ずつ逐次処理してメモリピークを抑える（GLB の同時展開を CHECK_CONCURRENCY 件に制限）。
    for (let i = 0; i < targetDocs.length; i += CHECK_CONCURRENCY) {
      const chunk = targetDocs.slice(i, i + CHECK_CONCURRENCY);
      await Promise.all(chunk.map(processDoc));
    }
    console.log("Finished polling all jobs.");

  } catch (error) {
    console.error("Error in pollAiJobs:", error);
  }
});
