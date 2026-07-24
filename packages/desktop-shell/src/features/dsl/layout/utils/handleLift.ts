// handleLift — 平面図の編集ハンドル（床の頂点・壁の端点など）を浮かせる高さ。
//   真上から見る平面図では、レイキャストは「カメラに近い＝Y が高い」方が先に当たる。
//   depthTest=false は描画順を変えるだけで交差判定には効かないため、ハンドルを壁より
//   低い位置に置くと、壁と重なった頂点をクリックしたときに壁が先に拾われて掴めない。
//   → 必ず「いちばん高い壁の頭」より上に逃がす。
import { floorHeightOf, ceilingHeightOf } from "../store/useBuildingSpecStore";

/**
 * すべての壁の「頭」の world 高さ(mm)の最大値 + margin を返す。
 * ⚠️ 壁の高さだけを見てはいけない。壁は各階の FL（fl0Mm + floors[i].flMm）に建ち、
 *    さらに上下オフセットが載る。GL がマイナス（FL が原点より上）の物件だと、
 *    高さだけで計算したハンドルは壁の頭より下に潜り込む。
 * @param walls  useWallStore の walls
 * @param spec   useBuildingSpecStore の state（fl0Mm / floors / 既定の階高・CL）
 * @param marginMm 壁の頭からさらに上へ逃がす余裕
 */
export function wallTopLiftMm(
  walls: any[] | null | undefined,
  spec: any,
  marginMm = 200,
): number {
  const floors = spec?.floors || [];
  const n = Math.max(1, floors.length || 1);
  const flOf = (i: number) =>
    (spec?.fl0Mm || 0) + (floors[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);

  let top = 0;
  for (const w of walls || []) {
    if (!w) continue;
    const i = w.floorIndex || 0;
    const h = w.heightMm ?? (w.kind === "exterior" ? floorHeightOf(spec, i) : ceilingHeightOf(spec, i));
    const t = flOf(i) + (w.offsetYMm || 0) + (h || 0);
    if (t > top) top = t;
  }
  return top + marginMm;
}
