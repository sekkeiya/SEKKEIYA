/**
 * Firestore のタイムスタンプオブジェクトを安全に ISO 文字列に変換する。
 * null や undefined の場合は null を返す。
 * 
 * @param {any} ts - Firestore の Timestamp オブジェクト、Date オブジェクト、または ISO 文字列
 * @returns {string|null} ISO 8601 形式の文字列、あるいは null
 */
export function normalizeDate(ts) {
  if (!ts) return null;
  
  // Firebase Timestamp の toDate() を持っている場合
  if (typeof ts.toDate === "function") {
    return ts.toDate().toISOString();
  }
  
  // Date オブジェクトの場合
  if (ts instanceof Date) {
    return ts.toISOString();
  }
  
  // すでに文字列で秒数などの場合
  if (typeof ts === "string" || typeof ts === "number") {
    try {
      const parsed = new Date(ts);
      // isNaN を使って妥当な日付かチェック
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    } catch (e) {
      // パース失敗時は元の値を返すよりnullの方が安全
      return null;
    }
  }

  // その他 ({ seconds, nanoseconds } 形式で toDate が欠落している場合など)
  if (ts.seconds) {
     return new Date(ts.seconds * 1000).toISOString();
  }
  
  return null;
}
