/**
 * usage/getAdminUsageSummary.js — 管理者APIモニターの集計を返す（方式A / Phase 2）。
 *
 * usageDaily（日次ロールアップ）を範囲分読み、機能別・モデル別・日別に集計する。
 * ★ 管理者判定は呼び出し側 index.js の onCall ラッパーで再検証すること（真の防御）。
 */
const admin = require("firebase-admin");

/** 範囲に含む JST 日付（YYYY-MM-DD）配列を返す。 */
function daysForRange(range) {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const days = [];
  if (range === "mtd") {
    const y = jst.getUTCFullYear();
    const m = jst.getUTCMonth();
    const today = jst.getUTCDate();
    for (let d = 1; d <= today; d++) {
      days.push(new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10));
    }
  } else {
    const n = range === "30d" ? 30 : 7;
    for (let i = n - 1; i >= 0; i--) {
      days.push(new Date(jst.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    }
  }
  return days;
}

function cacheReadRatio(read, write) {
  const denom = (read || 0) + (write || 0);
  return denom > 0 ? read / denom : 0;
}

/** ロールアップのバケット v を集計オブジェクト t に加算。 */
function addBucket(t, v) {
  t.calls += v.calls || 0;
  t.totalTokens += v.totalTokens || 0;
  t.costUsd += v.costUsd || 0;
  t.cacheReadTokens += v.cacheReadTokens || 0;
  t.cacheCreationTokens += v.cacheCreationTokens || 0;
}

function emptyBucket() {
  return { calls: 0, totalTokens: 0, costUsd: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
}

function mapToSortedArray(map) {
  return Object.entries(map)
    .map(([key, v]) => ({ key, ...v, cacheReadRatio: cacheReadRatio(v.cacheReadTokens, v.cacheCreationTokens) }))
    .sort((a, b) => b.costUsd - a.costUsd);
}

// ユーザー別集計の暴走防止（1回のパネル表示で読む生ログ上限）。
const USER_SCAN_LIMIT = 10000;

/**
 * ユーザー別内訳を生ログ(usageLogs)から集計する。day 文字列の辞書順=日付順を利用。
 * usageDaily はユーザーを分けて持たないため、こちらは生ログを直接読む（方式A）。
 */
async function aggregateByUser(db, days) {
  const first = days[0];
  const last = days[days.length - 1];
  const snap = await db.collection("usageLogs")
    .where("day", ">=", first)
    .where("day", "<=", last)
    .limit(USER_SCAN_LIMIT)
    .get();

  const userMap = {};
  snap.forEach((doc) => {
    const x = doc.data() || {};
    const key = x.email || x.uid || "(unknown)";
    if (!userMap[key]) userMap[key] = emptyBucket();
    addBucket(userMap[key], {
      calls: 1,
      totalTokens: x.totalTokens || 0,
      costUsd: x.costUsd || 0,
      cacheReadTokens: x.cacheReadTokens || 0,
      cacheCreationTokens: x.cacheCreationTokens || 0,
    });
  });
  return { byUser: mapToSortedArray(userMap), userTruncated: snap.size >= USER_SCAN_LIMIT };
}

/**
 * @param {object} p
 * @param {"7d"|"30d"|"mtd"} p.range
 */
async function getAdminUsageSummary({ range = "7d" } = {}) {
  const db = admin.firestore();
  const days = daysForRange(range);
  const refs = days.map((d) => db.collection("usageDaily").doc(d));

  const [snaps, userAgg] = await Promise.all([
    db.getAll(...refs),
    aggregateByUser(db, days),
  ]);

  const totals = emptyBucket();
  const featureMap = {};
  const modelMap = {};
  const daily = [];

  for (const snap of snaps) {
    const day = snap.id;
    if (!snap.exists) {
      daily.push({ day, calls: 0, totalTokens: 0, costUsd: 0 });
      continue;
    }
    const x = snap.data() || {};
    addBucket(totals, x);
    daily.push({ day, calls: x.calls || 0, totalTokens: x.totalTokens || 0, costUsd: x.costUsd || 0 });
    for (const [k, v] of Object.entries(x.byFeature || {})) {
      if (!featureMap[k]) featureMap[k] = emptyBucket();
      addBucket(featureMap[k], v);
    }
    for (const [k, v] of Object.entries(x.byModel || {})) {
      if (!modelMap[k]) modelMap[k] = emptyBucket();
      addBucket(modelMap[k], v);
    }
  }

  return {
    range,
    days,
    totals: { ...totals, cacheReadRatio: cacheReadRatio(totals.cacheReadTokens, totals.cacheCreationTokens) },
    byFeature: mapToSortedArray(featureMap),
    byModel: mapToSortedArray(modelMap),
    byUser: userAgg.byUser,
    userTruncated: userAgg.userTruncated,
    daily,
  };
}

module.exports = { getAdminUsageSummary };
