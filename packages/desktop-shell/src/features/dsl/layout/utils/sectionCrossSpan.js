// sectionCrossSpan — 断面カット面が多角形フットプリントを横切る「横方向の範囲」を求める。
//   断面ビューで黒く塗られた切り口(ポシェ)にぴったり重なる透明クリック面を置くために使う
//   （SectionSlabPicker / SectionWallPicker 共通）。
//
//   points   : {x,z}[]（mm）の閉多角形フットプリント
//   depthAxis: 視線＝カット軸（"x" or "z"）。この軸の値が cutPos の平面で切る。
//   horizAxis: 画面の横方向に当たる軸（depthAxis の反対）。
//   cutPos   : カット位置（mm、depthAxis 上）。
//   → 交差する horizAxis の範囲 [lo, hi]（mm）。横切っていなければ null。

/** 壁芯 start→end ＋ 厚みから、フットプリント矩形（{x,z}[] mm）を作る。 */
export function wallRect(w) {
  const dx = (w.end?.x ?? 0) - (w.start?.x ?? 0);
  const dz = (w.end?.z ?? 0) - (w.start?.z ?? 0);
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  const nx = -uz, nz = ux; // 左法線
  const h = (w.thicknessMm || 0) / 2;
  return [
    { x: w.start.x + nx * h, z: w.start.z + nz * h },
    { x: w.end.x + nx * h, z: w.end.z + nz * h },
    { x: w.end.x - nx * h, z: w.end.z - nz * h },
    { x: w.start.x - nx * h, z: w.start.z - nz * h },
  ];
}

/**
 * @returns {[number, number] | null}
 */
export function crossSpan(points, depthAxis, horizAxis, cutPos) {
  let lo = Infinity, hi = -Infinity;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    const da = a[depthAxis], db = b[depthAxis];
    const straddles = (da <= cutPos && db >= cutPos) || (db <= cutPos && da >= cutPos);
    if (!straddles) continue;
    if (da === db) {
      // 辺がカット面と平行に乗っている → その辺全体で覆う
      lo = Math.min(lo, a[horizAxis], b[horizAxis]);
      hi = Math.max(hi, a[horizAxis], b[horizAxis]);
    } else {
      const t = (cutPos - da) / (db - da);
      const h = a[horizAxis] + (b[horizAxis] - a[horizAxis]) * t;
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
  }
  if (!Number.isFinite(lo) || hi <= lo) return null;
  return [lo, hi];
}
