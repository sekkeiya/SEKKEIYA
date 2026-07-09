// Layer 3: 全ユーザーの家具選定ログを集計し insights/furniturePatterns に書き込む。
// onCall（管理者が手動実行）または Cloud Scheduler から定期実行する。
// 公式チームが使い倒した結果が全ユーザーの初期値・提案精度向上に反映される。

const admin = require('firebase-admin');

exports.aggregateFurnitureLogs = async (data, context) => {
  if (!admin.apps.length) admin.initializeApp();
  const db = admin.firestore();

  const scopeCount = {};
  const styleCount = {};
  const roomTypeCount = {};
  const catCount = {};
  const selectionModeCount = {};
  let totalSessions = 0;
  let totalAdded = 0;

  // 全ユーザーを走査（本番では limit を設けるか、subcollection group query を使う）
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    let logsSnap;
    try {
      logsSnap = await db
        .collection('users').doc(userDoc.id)
        .collection('furnitureLogs')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get();
    } catch (e) {
      continue; // subcollection が存在しないユーザーはスキップ
    }

    for (const log of logsSnap.docs) {
      const d = log.data();
      totalSessions++;
      totalAdded += d.addedCount || 0;
      if (d.scope) scopeCount[d.scope] = (scopeCount[d.scope] || 0) + 1;
      if (d.style) styleCount[d.style] = (styleCount[d.style] || 0) + 1;
      if (d.roomType) roomTypeCount[d.roomType] = (roomTypeCount[d.roomType] || 0) + 1;
      if (d.selectionMode) selectionModeCount[d.selectionMode] = (selectionModeCount[d.selectionMode] || 0) + 1;
      for (const cat of d.selectedCategories || []) {
        catCount[cat] = (catCount[cat] || 0) + 1;
      }
    }
  }

  const topOf = (counts) =>
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const topCategories = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k]) => k);

  const avgAddedCount = totalSessions > 0
    ? Math.round((totalAdded / totalSessions) * 10) / 10
    : 0;

  const result = {
    topScope: topOf(scopeCount),
    topStyle: topOf(styleCount),
    topRoomType: topOf(roomTypeCount),
    topCategories,
    avgAddedCount,
    totalSessions,
    scopeBreakdown: scopeCount,
    styleBreakdown: styleCount,
    roomTypeBreakdown: roomTypeCount,
    selectionModeBreakdown: selectionModeCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('insights').doc('furniturePatterns').set(result);

  console.log(`[aggregateFurnitureLogs] Done. ${totalSessions} sessions, ${totalAdded} models added.`);
  return { success: true, totalSessions, totalAdded, topCategories };
};
