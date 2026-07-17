/**
 * youtube — YouTube URL の判定・videoId 抽出（Reader の動画ソース対応）。
 * フィードの URL（watch / youtu.be / shorts / embed / live）を videoId に正規化する。
 */

/** YouTube の動画URLなら videoId を、そうでなければ空文字を返す。 */
export function getYouTubeId(url: string): string {
  const m = /(?:youtube\.com\/(?:watch\?[^#\s]*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,20})/.exec(String(url || ''));
  return m ? m[1] : '';
}

/** タイムスタンプ付き日本語字幕（CF videoRead の segments）。 */
export interface VideoSegment { s: number; e: number; text: string }

/** 秒 → "m:ss" 表示。 */
export const fmtVideoTime = (sec: number): string => {
  const t = Math.max(0, Math.floor(sec));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
