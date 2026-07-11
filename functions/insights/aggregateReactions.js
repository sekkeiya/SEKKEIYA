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

  // ── 件数モード（学習モニターの「資産の規模」グラフ用） ───────────────
  // {counts: true} で学習資産コレクションの現在の総件数を返す（読み取り専用）。
  // count() 集計を使うので全ドキュメントを読まない（1コレクション=1読み取り）。
  // collectionGroup はユーザー横断（users/… と projects/… の両方）を1本で数える。
  if (data.counts === true) {
    const groups = {
      reactionLogs: "reactionLogs",     // 反応ログ（生データ）
      knowledgeChunks: "knowledgeChunks", // RAG 索引の断片
      knowledgeSources: "knowledgeSources", // 取り込み元ドキュメント
      driveAssets: "driveAssets",       // Drive の分析済みファイル
      aiMemory: "aiMemory",             // 長期記憶（users + projects）
    };
    const counts = {};
    await Promise.all(Object.entries(groups).map(async ([key, cg]) => {
      try {
        const agg = await db.collectionGroup(cg).count().get();
        counts[key] = agg.data().count;
      } catch (e) {
        console.warn(`[aggregateReactions] count ${cg} failed: ${e.message}`);
        counts[key] = null; // 索引未整備などは null（UI 側で「—」表示）
      }
    }));
    return { success: true, mode: "counts", counts, day: jstDay() };
  }

  // ── 期間モード（読み取り専用・学習モニターのグラフ用） ────────────────
  // {days: N} で直近N日(JST)の日別推移を返す。insights への書き込みはしない。
  // 単一フィールド例外 (reactionLogs.day COLLECTION_GROUP_ASC) は範囲クエリもカバーする。
  if (typeof data.days === "number" && data.days > 1) {
    const n = Math.min(60, Math.max(2, Math.floor(data.days)));
    const end = jstDay();
    const start = jstDay(new Date(Date.now() - (n - 1) * 86400e3));
    const rsnap = await db.collectionGroup("reactionLogs")
      .where("day", ">=", start).where("day", "<=", end).get();

    // 日付キー（古→新）を先に確定。全体用と surface 別用で使い回す。
    const dayKeys = [];
    const byDay = {}; // day → { impressions, clicks, events }（全 surface 合算）
    for (let i = 0; i < n; i++) {
      const k = jstDay(new Date(Date.now() - (n - 1 - i) * 86400e3));
      dayKeys.push(k);
      byDay[k] = { impressions: 0, clicks: 0, events: 0 };
    }
    const rUsers = new Set();
    const surfaceTotals = {};  // surface → { impressions, clicks }
    const bySurfaceDay = {};   // surface → { day → { impressions, clicks, events } }
    const surfDayBucket = (surface) => {
      if (!bySurfaceDay[surface]) {
        bySurfaceDay[surface] = {};
        for (const k of dayKeys) bySurfaceDay[surface][k] = { impressions: 0, clicks: 0, events: 0 };
      }
      return bySurfaceDay[surface];
    };
    for (const doc of rsnap.docs) {
      const d = doc.data();
      if (!d.day || !byDay[d.day]) continue;
      rUsers.add(doc.ref.path.split("/")[1]);
      byDay[d.day].events++;
      const surface = d.surface || "(unknown)";
      const sd = surfDayBucket(surface)[d.day];
      sd.events++;
      const st = surfaceTotals[surface] = surfaceTotals[surface] || { impressions: 0, clicks: 0 };
      if (d.action === "impression") { byDay[d.day].impressions++; st.impressions++; sd.impressions++; }
      else if (d.action === "clicked") { byDay[d.day].clicks++; st.clicks++; sd.clicks++; }
    }
    // day バケツ → daily 配列（古→新・CTR 付き）
    const mkDaily = (obj) => dayKeys.map((dy) => {
      const v = obj[dy];
      return { day: dy, ...v, ctr: v.impressions > 0 ? Math.round((v.clicks / v.impressions) * 1000) / 1000 : null };
    });
    const daily = mkDaily(byDay);
    const dailyBySurface = {}; // surface → daily配列（台帳の資産別グラフ用）
    for (const [sName, obj] of Object.entries(bySurfaceDay)) dailyBySurface[sName] = mkDaily(obj);
    const surfaces = {};
    for (const [sName, v] of Object.entries(surfaceTotals)) {
      surfaces[sName] = { ...v, ctr: v.impressions > 0 ? Math.round((v.clicks / v.impressions) * 1000) / 1000 : null };
    }
    return { success: true, mode: "range", start, end, daily, dailyBySurface, surfaces, eventCount: rsnap.size, userCount: rUsers.size };
  }

  // ── 単日モード（従来どおり集計して insights に保存） ──────────────────
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
