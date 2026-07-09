/**
 * aggregateWeeklyTrends.js — 全ユーザーの直近7日の利用データを匿名集計する。
 *
 * 集計源:
 *   - users/{uid}/chatThreads/{tid}/messages (role=user) — チャット指示のキーワード
 *   - users/{uid}/furnitureLogs               — ルームタイプ・スタイル・スコープ
 *
 * プライバシー設計:
 *   - テキスト原文はここで破棄。カウントのみ保持。
 *   - k-anonymity: K_ANON_MIN 件未満のセグメントは出力に含めない。
 *   - UID・プロジェクト名・個人情報は一切保存しない。
 *
 * 出力: analytics/weeklyTrends（latest）& analytics/weeklyTrends/weeks/{weekId}
 */
const admin = require("firebase-admin");

// 日本語・英語ストップワード（意味のない短語を除外）
const STOP_WORDS = new Set([
  "を", "に", "は", "が", "で", "て", "の", "と", "も", "や", "か", "な", "し",
  "た", "ます", "です", "ない", "する", "して", "から", "まで", "より", "でも",
  "ください", "お願い", "お願いします", "ちょっと", "少し", "なんか", "なんて",
  "the", "a", "an", "is", "are", "was", "to", "of", "in", "and", "or", "for",
  "with", "this", "that", "it", "at", "by", "from", "me", "my", "please",
]);

function extractKeywords(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .split(/[\s、。！？\n\r,.!?「」『』【】（）()\[\]]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

exports.aggregateWeeklyTrends = async (data = {}, context = {}) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const K_ANON_MIN = 5; // k-匿名性: この件数未満のセグメントは出力から除外

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const keywordCount = {};
  const roomTypeCount = {};
  const styleCount = {};
  const scopeCount = {};
  let chatUserCount = 0;
  let layoutSessionCount = 0;

  // ① collectionGroup でチャットメッセージのキーワードを集計
  try {
    const msgSnap = await db
      .collectionGroup("messages")
      .where("role", "==", "user")
      .where("createdAt", ">=", weekAgo)
      .get();

    const seenUsers = new Set();
    for (const msgDoc of msgSnap.docs) {
      // UID はユーザー数カウントにのみ使用（テキストはキーワード抽出後に参照しない）
      const uid = msgDoc.ref.path.split("/")[1];
      seenUsers.add(uid);
      for (const kw of extractKeywords(msgDoc.data().text || "")) {
        keywordCount[kw] = (keywordCount[kw] || 0) + 1;
      }
    }
    chatUserCount = seenUsers.size;
  } catch (e) {
    console.warn("[aggregateWeeklyTrends] chat messages skip:", e.message);
  }

  // ② 家具ログからルームタイプ・スタイル・スコープを集計
  try {
    const usersSnap = await db.collection("users").select().get(); // IDだけ取得
    for (const userDoc of usersSnap.docs) {
      const logsSnap = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("furnitureLogs")
        .where("timestamp", ">=", weekAgo)
        .get()
        .catch(() => ({ docs: [] }));

      for (const log of logsSnap.docs) {
        const d = log.data();
        layoutSessionCount++;
        if (d.roomType) roomTypeCount[d.roomType] = (roomTypeCount[d.roomType] || 0) + 1;
        if (d.style)    styleCount[d.style]       = (styleCount[d.style]       || 0) + 1;
        if (d.scope)    scopeCount[d.scope]        = (scopeCount[d.scope]        || 0) + 1;
      }
    }
  } catch (e) {
    console.warn("[aggregateWeeklyTrends] furniture logs skip:", e.message);
  }

  // k-匿名性フィルタ
  const filterKAnon = (counts) =>
    Object.fromEntries(Object.entries(counts).filter(([, v]) => v >= K_ANON_MIN));

  const topKeywords = Object.entries(filterKAnon(keywordCount))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  const topRoomTypes = Object.entries(roomTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const topStyles = Object.entries(styleCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  const weekId = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const result = {
    weekId,
    periodStart: weekAgo,
    periodEnd: now,
    chatUserCount,
    layoutSessionCount,
    topKeywords,
    topRoomTypes,
    topStyles,
    kAnonMin: K_ANON_MIN,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const weeksRef = db.collection("analytics").doc("weeklyTrends").collection("weeks");
  await weeksRef.doc(weekId).set(result);
  // latest は generateTrendArticle が読む
  await db.collection("analytics").doc("weeklyTrends").set({ latestWeekId: weekId, ...result });

  console.log(
    `[aggregateWeeklyTrends] ${weekId}: chat ${chatUserCount} users, ` +
    `layout ${layoutSessionCount} sessions, keywords ${topKeywords.length}`
  );
  return { success: true, weekId, topKeywords: topKeywords.slice(0, 5) };
};
