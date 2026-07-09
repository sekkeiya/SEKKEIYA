/**
 * aggregateReactions.js — 反応ログ（reactionLogs）の日次集計。
 *
 * 集計源:
 *   - users/{uid}/reactionLogs — collectionGroup で指定日(JST)の全ユーザー分を吸い上げ
 *
 * プライバシー設計（aggregateWeeklyTrends と同方針）:
 *   - UID・プロジェクトID・セッションIDは出力に保存しない。カウントのみ。
 *   - label はクリックされた文言の上位のみ（≤80字・元よりPIIなし）。
 *
 * 出力: insights/reactionPatterns（latest）& insights/reactionPatterns/days/{YYYY-MM-DD}
 *   - surface ごとに impressions / clicks / ctr / byModel / byRank / byPlatform / topClickedLabels
 *
 * 必要インデックス: collectionGroup('reactionLogs') の day（初回実行時の
 * エラーメッセージに作成リンクが出るので、それを踏んで作成する）。
 */
const admin = require("firebase-admin");

/** JST の 'YYYY-MM-DD' */
function jstDay(d = new Date()) {
  return new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
}

exports.aggregateReactions = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  // 対象日: 指定があればそれ、なければ今日(JST)。前日を締めるなら {day:'YYYY-MM-DD'} で呼ぶ。
  const day = typeof data.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.day)
    ? data.day
    : jstDay();

  const snap = await db.collectionGroup("reactionLogs").where("day", "==", day).get();

  // surface ごとの集計バケツ
  const bySurface = {};
  const bucket = (surface) => {
    if (!bySurface[surface]) {
      bySurface[surface] = {
        impressions: 0,
        clicks: 0,
        actions: {},        // action → count（clicked/accepted/rejected/...全語彙）
        byModel: {},        // model → { impressions, clicks }
        byRank: {},         // rank(表示順) → clicks
        byPlatform: {},     // 'web'/'desktop' → count(全action)
        labelClicks: {},    // クリックされた label → count（上位のみ出力）
        anonymous: 0,       // 匿名ユーザーのイベント数（転換分析の材料）
      };
    }
    return bySurface[surface];
  };

  const seenUsers = new Set();
  for (const doc of snap.docs) {
    const d = doc.data();
    if (!d.surface || !d.action) continue;
    seenUsers.add(doc.ref.path.split("/")[1]); // UIDはユーザー数カウントのみに使用
    const b = bucket(d.surface);

    b.actions[d.action] = (b.actions[d.action] || 0) + 1;
    if (d.platform) b.byPlatform[d.platform] = (b.byPlatform[d.platform] || 0) + 1;
    if (d.isAnonymous) b.anonymous++;

    if (d.action === "impression") {
      b.impressions++;
      if (d.model) {
        b.byModel[d.model] = b.byModel[d.model] || { impressions: 0, clicks: 0 };
        b.byModel[d.model].impressions++;
      }
    } else if (d.action === "clicked") {
      b.clicks++;
      if (d.model) {
        b.byModel[d.model] = b.byModel[d.model] || { impressions: 0, clicks: 0 };
        b.byModel[d.model].clicks++;
      }
      if (typeof d.rank === "number") b.byRank[d.rank] = (b.byRank[d.rank] || 0) + 1;
      if (d.label) b.labelClicks[d.label] = (b.labelClicks[d.label] || 0) + 1;
    }
  }

  // 出力整形: ctr 計算 + labelClicks は上位10件のみ
  const surfaces = {};
  for (const [surface, b] of Object.entries(bySurface)) {
    surfaces[surface] = {
      impressions: b.impressions,
      clicks: b.clicks,
      ctr: b.impressions > 0 ? Math.round((b.clicks / b.impressions) * 1000) / 1000 : null,
      actions: b.actions,
      byModel: b.byModel,
      byRank: b.byRank,
      byPlatform: b.byPlatform,
      anonymousEvents: b.anonymous,
      topClickedLabels: Object.entries(b.labelClicks)
        .sort((a, z) => z[1] - a[1])
        .slice(0, 10)
        .map(([label, count]) => ({ label, count })),
    };
  }

  const result = {
    day,
    eventCount: snap.size,
    userCount: seenUsers.size,
    surfaces,
  };
  const doc = { ...result, generatedAt: admin.firestore.FieldValue.serverTimestamp() };

  const rootRef = db.collection("insights").doc("reactionPatterns");
  await rootRef.collection("days").doc(day).set(doc, { merge: true });
  // latest はダッシュボード・学習ジョブが読む
  await rootRef.set({ latestDay: day, ...doc }, { merge: true });

  console.log(
    `[aggregateReactions] ${day}: ${snap.size} events, ${seenUsers.size} users, ` +
    `surfaces: ${Object.keys(surfaces).join(", ") || "(none)"}`
  );
  // 学習モニター（Learning パネル）がそのまま描画できるよう全結果を返す
  return { success: true, ...result };
};
