// extractGridAxes — 描いた壁の芯線から通り芯の候補位置を拾う。
//   壁は「芯」で保持されている（useWallStore の start/end は壁芯）ので、軸に平行な壁の
//   芯座標がそのまま通り芯の候補になる。近い候補はひとつに束ね、50mm に丸めて返す。
//   短い間仕切りや斜め壁はノイズになるので落とす。
import * as THREE from "three";
import type { Wall } from "../store/useWallStore";
import type { GridAxisDir } from "../store/useGridAxisStore";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../store/useEditorModeStore";

/** これ未満の長さの壁は通り芯の根拠にしない(mm)。小さな間仕切りを拾わないため。 */
const MIN_WALL_LEN_MM = 900;
/** 軸平行とみなすズレ(mm)。これを超える傾きの壁は斜め壁として無視する。 */
const AXIS_TOL_MM = 60;
/** この距離以内の候補は同じ通りとして束ねる(mm)。壁厚のばらつきを吸収する。 */
const CLUSTER_TOL_MM = 200;

const SNAP = 50;

/** ソート済み数値列を近接クラスタにまとめ、各クラスタの平均を 50mm 丸めで返す。 */
function cluster(values: number[]): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  let bucket: number[] = [sorted[0]];
  const flush = () => {
    const avg = bucket.reduce((s, v) => s + v, 0) / bucket.length;
    out.push(Math.round(avg / SNAP) * SNAP);
  };
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - bucket[bucket.length - 1] <= CLUSTER_TOL_MM) bucket.push(sorted[i]);
    else { flush(); bucket = [sorted[i]]; }
  }
  flush();
  return out;
}

/**
 * 壁一覧から通り芯の候補を作る。
 * 平面で縦に走る壁（X が一定）→ X通り(axis="x") / 横に走る壁（Z が一定）→ Y通り(axis="z")。
 */
export function extractGridAxesFromWalls(walls: Wall[]): Array<{ axis: GridAxisDir; pos: number }> {
  const xs: number[] = [];
  const zs: number[] = [];
  for (const w of walls || []) {
    if (!w?.start || !w?.end) continue;
    const dx = w.end.x - w.start.x;
    const dz = w.end.z - w.start.z;
    if (Math.hypot(dx, dz) < MIN_WALL_LEN_MM) continue;
    if (Math.abs(dx) <= AXIS_TOL_MM && Math.abs(dz) > AXIS_TOL_MM) {
      xs.push((w.start.x + w.end.x) / 2);        // 縦壁 → X通り
    } else if (Math.abs(dz) <= AXIS_TOL_MM && Math.abs(dx) > AXIS_TOL_MM) {
      zs.push((w.start.z + w.end.z) / 2);        // 横壁 → Y通り
    }
  }
  return [
    ...cluster(xs).map((pos) => ({ axis: "x" as GridAxisDir, pos })),
    ...cluster(zs).map((pos) => ({ axis: "z" as GridAxisDir, pos })),
  ];
}

// ── インポートした躯体（Base GLB）から芯を推定する ─────────────────────────
//   GLB には「壁芯」の情報が無いので、baseFootprint と同じ考え方で
//   「薄い・長い・立っている」箱＝壁とみなし、その薄い方向の中心を芯として拾う。
//   すべての壁に通り芯が要るわけではないので、主要構造だけに絞る:
//     - 長さ minLenMm 以上（既定 1800mm）＝間仕切りや家具まわりの短い壁は拾わない
//     - 同じ位置に集まる候補は1本に統合する

/** 壁とみなす最大厚(mm)。これより厚い箱は床・地面・ボリュームとして無視。 */
const BASE_WALL_MAX_THICK_MM = 700;
/** 壁とみなす最低の高さ(mm)。立っていないもの（床・天井板）を弾く。 */
const BASE_WALL_MIN_HEIGHT_MM = 800;

/**
 * Base GLB の躯体から通り芯の候補を推定する。
 * @param minLenMm これ未満の長さの壁面は拾わない（主要構造だけに絞るしきい値）
 */
export function extractGridAxesFromBase(minLenMm = 1800): Array<{ axis: GridAxisDir; pos: number }> {
  const colliders = (useSceneObjectRegistryStore.getState() as any).baseColliders || [];
  if (!colliders.length) return [];
  // シーンが m スケールなら mm しきい値を m に落とす（他のユーティリティと同じ判定）。
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const w = (mm: number) => (isMm ? mm : mm / 1000);
  const toMm = (v: number) => (isMm ? v : v * 1000);

  const xs: number[] = [];
  const zs: number[] = [];
  const box = new THREE.Box3();
  colliders.forEach((obj: any) => {
    if (!obj) return;
    try { box.setFromObject(obj); } catch { return; }
    if (box.isEmpty()) return;
    const sx = box.max.x - box.min.x;
    const sy = box.max.y - box.min.y;
    const sz = box.max.z - box.min.z;
    if (sy < w(BASE_WALL_MIN_HEIGHT_MM)) return;            // 立っていない = 床/天井
    const thin = Math.min(sx, sz);
    const long = Math.max(sx, sz);
    if (thin > w(BASE_WALL_MAX_THICK_MM)) return;           // 厚い = 壁ではない
    if (long < w(minLenMm)) return;                          // 短い = 主要構造ではない
    if (sx <= sz) xs.push(toMm((box.min.x + box.max.x) / 2)); // X に薄い＝縦壁 → X通り
    else zs.push(toMm((box.min.z + box.max.z) / 2));          // Z に薄い＝横壁 → Y通り
  });

  return [
    ...cluster(xs).map((pos) => ({ axis: "x" as GridAxisDir, pos })),
    ...cluster(zs).map((pos) => ({ axis: "z" as GridAxisDir, pos })),
  ];
}

/**
 * 描いた壁と Base GLB の両方から候補を集めて統合する（同じ位置は1本に）。
 * 描いた壁の芯のほうが正確なので先に入れ、GLB 側は近接していれば捨てる。
 */
export function extractGridAxesAll(walls: Wall[], minLenMm = 1800): Array<{ axis: GridAxisDir; pos: number }> {
  const drawn = extractGridAxesFromWalls(walls);
  const base = extractGridAxesFromBase(minLenMm);
  const out = [...drawn];
  for (const c of base) {
    const dup = out.some((o) => o.axis === c.axis && Math.abs(o.pos - c.pos) <= CLUSTER_TOL_MM);
    if (!dup) out.push(c);
  }
  return out.sort((a, b) => (a.axis === b.axis ? a.pos - b.pos : a.axis < b.axis ? -1 : 1));
}
