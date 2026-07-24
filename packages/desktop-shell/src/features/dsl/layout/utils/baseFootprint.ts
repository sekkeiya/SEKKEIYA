// baseFootprint — 実躯体（baseColliders）から建物の「内法」フットプリントを実測する。
//   - 壁らしい薄い箱（片方向が壁厚以下・もう片方向が長い）だけを集めて外形を出し、
//     各辺の内側の面（左壁なら max.x）を内法とする。
//   - 地面板・床スラブ・スキャン板は「薄い壁」ではないので自然に除外される。
// 展開図の寸法（ElevationDimensionsOverlay）と「ゾーンを躯体にフィット」の両方で使い、
// 平面図と展開図の寸法が同じ実測値を指すようにする。
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../store/useEditorModeStore";

export interface InteriorRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const WALL_MAX_THICK_MM = 700;  // これ以下の薄さなら「壁」とみなす
const WALL_MIN_LEN_MM = 900;    // 壁として最低限の長さ（家具サイズの箱を弾く）
const NEAR_EDGE_MM = 800;       // 外形の辺からこの距離以内の壁を、その辺の壁とみなす
const FALLBACK_INSET_MM = 200;  // 壁が検出できない辺は外形から壁厚ぶん内側へ

/** 実躯体の内法矩形（world XZ）。壁が測れなければ null。 */
export function measureBaseInterior(): InteriorRect | null {
  const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
  if (!colliders.length) return null;
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);

  // 壁らしい箱だけを収集
  const walls: THREE.Box3[] = [];
  const tmp = new THREE.Box3();
  colliders.forEach((obj: any) => {
    if (!obj) return;
    try { tmp.setFromObject(obj); } catch { return; }
    if (tmp.isEmpty()) return;
    const sx = tmp.max.x - tmp.min.x;
    const sz = tmp.max.z - tmp.min.z;
    const sy = tmp.max.y - tmp.min.y;
    const thin = Math.min(sx, sz);
    const long = Math.max(sx, sz);
    // 薄い＋長い＋ある程度の高さ（=立っている）を壁とみなす
    if (thin > toWorld(WALL_MAX_THICK_MM)) return;
    if (long < toWorld(WALL_MIN_LEN_MM)) return;
    if (sy < toWorld(800)) return;
    walls.push(tmp.clone());
  });
  if (!walls.length) return null;

  // 壁群の外形
  const u = walls.reduce((acc, b) => acc.union(b), walls[0].clone());
  const near = toWorld(NEAR_EDGE_MM);
  const inset = toWorld(FALLBACK_INSET_MM);

  // 各辺: その辺に張り付いている壁（その軸に薄い壁）の内側の面を採用
  const face = (
    side: "minX" | "maxX" | "minZ" | "maxZ",
  ): number => {
    const axis = side === "minX" || side === "maxX" ? "x" : "z";
    const isMin = side === "minX" || side === "minZ";
    const edgeVal = axis === "x" ? (isMin ? u.min.x : u.max.x) : (isMin ? u.min.z : u.max.z);
    let best: number | null = null;
    walls.forEach((b) => {
      const thinSpan = axis === "x" ? b.max.x - b.min.x : b.max.z - b.min.z;
      if (thinSpan > toWorld(WALL_MAX_THICK_MM)) return; // この軸方向に薄い壁だけ
      const lo = axis === "x" ? b.min.x : b.min.z;
      const hi = axis === "x" ? b.max.x : b.max.z;
      const dist = isMin ? Math.abs(lo - edgeVal) : Math.abs(hi - edgeVal);
      if (dist > near) return;
      const inner = isMin ? hi : lo; // 内側の面
      best = best == null ? inner : isMin ? Math.max(best, inner) : Math.min(best, inner);
    });
    return best ?? (isMin ? edgeVal + inset : edgeVal - inset);
  };

  const rect: InteriorRect = {
    minX: face("minX"),
    maxX: face("maxX"),
    minZ: face("minZ"),
    maxZ: face("maxZ"),
  };
  if (rect.maxX - rect.minX < toWorld(500) || rect.maxZ - rect.minZ < toWorld(500)) return null;
  return rect;
}
