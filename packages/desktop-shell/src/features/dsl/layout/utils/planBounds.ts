// planBounds — 図面まわりの注記（寸法列・断面線など）が共通で使う「建物の範囲」と、
//   その外側に並ぶ寸法列の位置。
//   寸法列と断面線がそれぞれ別の基準で長さを決めていると、断面線が寸法列を突き抜けたり
//   建物からはみ出したりする。基準をここ1か所に集約する。
import * as THREE from "three";

/**
 * 図面から1列目の寸法線までの距離(mm)。DimensionChainsOverlay の off0 と一致させること。
 * 建物のすぐ外は断面記号（A / A'）の場所なので、そのぶん外へ逃がしてある。
 * 外側は通り芯の記号（GridAxisOverlay の AXIS_EXTEND_MM + BADGE_GAP_MM）が上限。
 */
export const DIM_COL_OFFSET_MM = 1000;
/** 寸法列どうしの間隔(mm)。DimensionChainsOverlay の gap と一致させること。 */
export const DIM_COL_GAP_MM = 420;

/** 余白として妥当な数値だけを通す。未設定・NaN・負値・数値でないものは既定へ。 */
function validOffsetMm(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DIM_COL_OFFSET_MM;
}

/**
 * その辺の余白(mm)＝建物外形から1列目の寸法線までの距離。
 * @param offsets ViewChains.offsets（辺 → mm）。ストアへ依存させないため生の連想配列で受ける。
 */
export function sideOffsetMm(
  offsets: Record<string, number> | null | undefined,
  side: string,
): number {
  return validOffsetMm(offsets?.[side]);
}

/**
 * 通り芯の記号（X0/Y0…）を寸法列のさらに外へ出すための、1列目の寸法線から先の余裕(mm)。
 * 内訳は 列間隔 420×2（最大3列ぶん）+ ラベル 150 + 余裕 410 = 1400。
 */
export const AXIS_EXTEND_MARGIN_MM = DIM_COL_GAP_MM * 2 + 150 + 410;

/**
 * 通り芯をその辺の方向へどれだけ伸ばすか(mm)。記号は寸法列より外に置きたいので、
 * その辺の余白に AXIS_EXTEND_MARGIN_MM を足す。
 * 既定の余白 1000 では 2400 になり、可変化する前の固定値と一致する（見た目が変わらない）。
 */
export function axisExtendMm(offsetMm: number): number {
  return validOffsetMm(offsetMm) + AXIS_EXTEND_MARGIN_MM;
}

export interface XZBounds {
  minX: number; maxX: number; minZ: number; maxZ: number;
  /** 高さ。躯体の実体から測った値（壁は XZ にしか寄与しないので Y には入れない）。 */
  minY: number; maxY: number;
}

/**
 * 躯体(GLB)＋作図した壁から範囲を測る。
 * ⚠️ Box3.setFromObject は GLB のシーングラフを丸ごと走査するので重い。
 *    XZ と Y を別々に測ろうとして 2 回走査すると体感で分かるほど遅くなるため、
 *    1 回で 3 軸ぶん返し、呼び手が必要な軸だけ使うこと。
 * @param baseColliders 躯体の Object3D 配列
 * @param walls         useWallStore の壁（start/end は mm）
 * @param w             mm → world 変換（mm スケールのシーンなら恒等）
 * @returns 何も無ければ null（呼び手はシーン範囲でフォールバックする）
 */
export function measureXZBounds(
  baseColliders: any[] | null | undefined,
  walls: any[] | null | undefined,
  w: (mm: number) => number,
): XZBounds | null {
  const box = new THREE.Box3();
  let has = false;
  (baseColliders || []).forEach((o) => {
    if (!o) return;
    const b = new THREE.Box3();
    try { b.setFromObject(o); } catch { return; }
    if (b.isEmpty()) return;
    if (!has) { box.copy(b); has = true; } else box.union(b);
  });
  const minY = has ? box.min.y : 0;
  const maxY = has ? box.max.y : 0;
  (walls || []).forEach((wl) => {
    [wl.start, wl.end].forEach((pt) => {
      if (!pt) return;
      const v = new THREE.Vector3(w(pt.x), 0, w(pt.z));
      if (!has) { box.setFromPoints([v]); has = true; } else box.expandByPoint(v);
    });
  });
  if (!has) return null;
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z, minY, maxY };
}

/**
 * 寸法列の両端（その列の軸上の [lo, hi]）。
 * 製図では寸法列は通り芯の総長にそろえる — 通り芯より外へはみ出してはいけない。
 * 躯体 GLB のバウンディングボックスは庇や基礎を含んで通り芯の外に出ることがあるので、
 * 建物の外形をそのまま端点にすると、その列だけが通り芯を突き抜けて描かれてしまう。
 * 通り芯が 2 本未満の向き（＝総長が決められない）だけ、建物の外形で代用する。
 * @param gridValues その向きの通り芯の位置（world・順不同で可）
 * @param lo,hi      建物の外形（フォールバック用）
 */
export function chainSpan(gridValues: number[], lo: number, hi: number): [number, number] {
  const g = (gridValues || []).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  return g.length >= 2 ? [g[0], g[g.length - 1]] : [lo, hi];
}

/**
 * 断面記号（A / A' のラベル）を建物の外形からどれだけ外に置くか(mm)。
 * ⚠️ 寸法列の位置から逆算しないこと。逆算にすると寸法列を外へ動かしたときに
 *    断面記号も一緒に外へ移動してしまい、間の余白がいつまでも広がらない。
 */
export const SECTION_MARK_OUT_MM = 200;
/** 断面記号と1列目の寸法線の間に最低限空ける距離(mm)。両者が近づきすぎたときの安全弁。 */
export const SECTION_LABEL_CLEARANCE_MM = 460;
/** 断面線が建物の輪郭より内側へ引っ込んでよい上限(mm)。引っ込みすぎると図から浮いて読めない。 */
const SECTION_MAX_INSET_MM = 700;

/**
 * 断面線の既定の長さ（その軸方向の [from, to]）。
 * 「線をどこまで伸ばすか」ではなく「A / A' のラベルをどこに置くか」から逆算する。
 *   ラベルは線端から labelOffset だけ外側に出るので、
 *     ラベル位置 = 建物の端 + out + labelOffset
 *   これが SECTION_MARK_OUT_MM になるよう out を決める（建物基準で固定）。
 *   矢印の長さはシーンの大きさで変わるため、線の長さを固定値で決めると
 *   縮尺によってラベルの位置がばらつく。
 *   併せて「1列目の寸法線から SECTION_LABEL_CLEARANCE_MM 以内に入らない」も満たす
 *   （寸法列を内側に詰めた場合の安全弁）。
 * @param labelOffset 線端からラベル中心までの距離(world)
 * @param firstColOffsetMm 1列目の寸法線までの余白(mm)。断面線の両端が向いている2辺のうち
 *   小さい方を渡す（安全弁なので狭い側に合わせる）。既定は従来どおり DIM_COL_OFFSET_MM。
 */
export function defaultSectionSpan(
  bounds: XZBounds | null,
  axisDir: "x" | "z",
  w: (mm: number) => number,
  fallbackHalf: number,
  labelOffset = 0,
  firstColOffsetMm: number = DIM_COL_OFFSET_MM,
): { from: number; to: number } {
  if (!bounds) return { from: -fallbackHalf, to: fallbackHalf };
  const lo = axisDir === "x" ? bounds.minX : bounds.minZ;
  const hi = axisDir === "x" ? bounds.maxX : bounds.maxZ;
  // 建物基準の位置と、寸法線に寄りすぎない位置の、内側（小さい方）を採る。
  const wanted = w(SECTION_MARK_OUT_MM) - labelOffset;
  const clear = w(firstColOffsetMm) - w(SECTION_LABEL_CLEARANCE_MM) - labelOffset;
  const out = Math.max(Math.min(wanted, clear), -w(SECTION_MAX_INSET_MM));
  return { from: lo - out, to: hi + out };
}
