// planBounds — 図面まわりの注記（寸法列・断面線など）が共通で使う「建物の範囲」と、
//   その外側に並ぶ寸法列の位置。
//   寸法列と断面線がそれぞれ別の基準で長さを決めていると、断面線が寸法列を突き抜けたり
//   建物からはみ出したりする。基準をここ1か所に集約する。
import * as THREE from "three";

/**
 * 最外の通り芯から1列目の寸法線までの距離(mm)の既定値。辺ごとに寸法列パネルで変更できる。
 * 建物と寸法線の間は断面記号（A / A'）の場所なので、そのぶん外へ逃がしてある。
 * 通り芯の記号（X0/Y0…）は axisExtendMm でこの値の外に出る。
 */
export const DIM_COL_OFFSET_MM = 2000;
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
 * ⚠️ 歩行モードの自動床スキャンが作る不可視の床板(userData.isScannedFloor)は「建物」ではない。
 *    建物より大きかったり片側に寄っていたりするので、注記の基準に混ぜると寸法線・断面記号・
 *    通り芯の端が遠くへ飛ぶ。呼び手ごとに除外し忘れないよう、ここ（発生源）で落とす。
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
    if (o.userData?.isScannedFloor) return;   // 自動床スキャンの板は建物ではない
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
 * 断面線の既定位置＝その軸方向の建物中心（world）。
 * axis="x"（平面で縦線）は X 座標、axis="z"（横線）は Z 座標で位置を持つ。
 * 線を作るとき（EditorAngleBar のシード）と「初期位置に戻す」で同じ規則を使う。
 * 建物が測れないときは 0（原点）。
 */
export function defaultSectionPos(bounds: XZBounds | null | undefined, axis: "x" | "z"): number {
  if (!bounds) return 0;
  return axis === "x"
    ? (bounds.minX + bounds.maxX) / 2
    : (bounds.minZ + bounds.maxZ) / 2;
}

/**
 * 断面記号（A / A' のラベル）を1列目の寸法線からどれだけ内側に置くか(mm)。
 * 記号は「寸法線から一定の距離」に置く。基準が通り芯になり余白も辺ごとに変えられる今、
 * 建物基準にすると庇の出や余白の設定しだいで記号の位置が図面ごとにばらついて読みにくい。
 * （2026-07-29 に建物基準から変更。以前は SECTION_MARK_OUT_MM=200 で建物の外形から測っていた。）
 */
export const SECTION_LABEL_CLEARANCE_MM = 460;
/** 断面線が建物の輪郭より内側へ引っ込んでよい上限(mm)。引っ込みすぎると図から浮いて読めない。 */
const SECTION_MAX_INSET_MM = 700;

/**
 * 断面線の既定の長さ（その軸方向の [from, to]）。
 * 「線をどこまで伸ばすか」ではなく「A / A' のラベルをどこに置くか」から逆算する。
 *   ラベルは線端から labelOffset だけ外側に出るので、
 *     ラベル位置 = 建物の端 + out + labelOffset
 *   これが「1列目の寸法線から SECTION_LABEL_CLEARANCE_MM だけ内側」になるよう out を決める。
 *   矢印の長さはシーンの大きさで変わるため、線の長さを固定値で決めると
 *   縮尺によってラベルの位置がばらつく。
 *   引っ込みすぎ（寸法列を建物に寄せすぎた場合）だけ SECTION_MAX_INSET_MM で止める。
 * @param labelOffset 線端からラベル中心までの距離(world)
 * @param firstColOut 建物の外形から1列目の寸法線までの実距離(world)を端ごとに。
 *   lo = 座標の小さい側（左 / 上）、hi = 大きい側（右 / 下）。
 *   ⚠️ 両端に同じ値を使ってはいけない。寸法列の基準は通り芯で、建物のバウンディング
 *      ボックスは通り芯に対して偏りうる（Rhino 躯体が片側だけはみ出す等）。片方の値を
 *      両端に使うと、狭い側でしか「寸法線から一定の距離」を満たせない。
 *   ⚠️ 余白(mm)ではなく実距離で受けること。通り芯が建物の内側にあると「建物からの距離」は
 *      余白の値より小さくなる。mm で渡すと過大評価して断面記号が寸法線に被る。
 *   省略時は両端とも既定の余白ぶん離れているものとみなす。
 */
export function defaultSectionSpan(
  bounds: XZBounds | null,
  axisDir: "x" | "z",
  w: (mm: number) => number,
  fallbackHalf: number,
  labelOffset = 0,
  firstColOut?: { lo: number; hi: number },
): { from: number; to: number } {
  if (!bounds) return { from: -fallbackHalf, to: fallbackHalf };
  const lo = axisDir === "x" ? bounds.minX : bounds.minZ;
  const hi = axisDir === "x" ? bounds.maxX : bounds.maxZ;
  const fallback = w(DIM_COL_OFFSET_MM);
  const colOut = (v: number | undefined) =>
    (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  // ラベルを1列目の寸法線から一定の距離だけ内側に置く。端ごとに独立して求める。
  const outFor = (v: number | undefined) =>
    Math.max(colOut(v) - w(SECTION_LABEL_CLEARANCE_MM) - labelOffset, -w(SECTION_MAX_INSET_MM));
  return { from: lo - outFor(firstColOut?.lo), to: hi + outFor(firstColOut?.hi) };
}
