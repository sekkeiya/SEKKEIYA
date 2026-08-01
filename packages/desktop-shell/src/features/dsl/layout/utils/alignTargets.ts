// alignTargets — 整列（Align）の対象を「種類に依らない最小の口」へ包むアダプタ。
//
//   もともと整列は Object3D 前提（sceneObjectRegistryStore の Map<string, Object3D>）で組まれていて、
//   家具しか動かせなかった。壁は start/end(mm)、床は points[](mm) という座標データで transform を
//   持たないので、同じ土俵に乗らない。そこで追従エンジン（SmoothAlignFollower）が必要とする
//   「位置を読む / 位置を書く / 外接矩形を取る / 確定する」だけを AlignTarget として切り出し、
//   家具・壁・床の 3 種類のアダプタで埋める。
//
//   単位について:
//     ・壁/床のデータは mm。3D シーンは mm のことも m のこともある（BaseGlb 次第）。
//       換算係数 k は各レンダラーと同じ規約（sceneMaxY > 100 なら mm シーン ⇒ k=1、そうでなければ k=0.001）。
//     ・AlignTarget の getPos / setPos / getBounds2D は **world 単位**（＝追従エンジンの座標系）で扱う。
//       mm ⇄ world の換算はアダプタの内側に閉じる。
//
//   丸めについて:
//     壁/床は「掴んだ時点の座標（orig）＋ 丸めた差分」で動かす。既存のドラッグ
//     （WallEditController / SlabEditController）と同じ規則で、毎フレーム現在値に足し込む方式に
//     ありがちな累積誤差も出ない。取消は開始時の位置へ setPos し直せば差分 0 で厳密に戻る。
import * as THREE from "three";
import { useWallStore } from "../store/useWallStore";
import type { Wall } from "../store/useWallStore";
import { useSlabStore } from "../store/useSlabStore";
import type { FloorSlab, SlabPoint } from "../store/useSlabStore";

export interface Bounds2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface AlignVec3 {
  x: number;
  y: number;
  z: number;
}

export interface AlignTransform {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export type AlignTargetKind = "furniture" | "wall" | "slab";

export interface AlignTarget {
  id: string;
  kind: AlignTargetKind;
  /** 現在位置（world）。 */
  getPos(): AlignVec3;
  /** 位置を設定（world）。追従中に毎フレーム呼ばれる。 */
  setPos(x: number, y: number, z: number): void;
  /** 整列の基準に使う平面上の外接矩形（world）。 */
  getBounds2D(): Bounds2D;
  /**
   * 上下（Y）方向の外接（world）。立面／断面ビューの Y 軸整列に使う。
   * 壁・床は null（高さは階・厚み・上下オフセットで決まる別プロパティなので Y 整列の対象外）。
   */
  getBoundsY(): { minY: number; maxY: number } | null;
  /**
   * スナップ中のプレビュー配信用（家具のみ）。
   * 壁・床は追従中すでにストアを直接更新しているので null。
   */
  getTransform(): AlignTransform | null;
  /** 確定時の永続化。 */
  commit(): void;
}

// ============================================================
// 純粋関数（すべて mm 座標系）
// ============================================================

/** シーンの単位換算係数。mm シーンなら 1、m シーンなら 0.001。各レンダラーと同じ規約。 */
export function worldScaleK(sceneMaxY: number | null | undefined): number {
  return (sceneMaxY || 0) > 100 ? 1 : 0.001;
}

/** 壁芯の中点(mm)。壁を「1つの位置」として扱うときの代表点。 */
export function wallMidpointMm(w: Pick<Wall, "start" | "end">): { x: number; z: number } {
  return {
    x: (w.start.x + w.end.x) / 2,
    z: (w.start.z + w.end.z) / 2,
  };
}

/** 壁を dx/dz(mm) だけ平行移動した start/end を返す（元の壁は変えない）。 */
export function wallMovedMm(
  w: Pick<Wall, "start" | "end">,
  dxMm: number,
  dzMm: number,
): { start: { x: number; z: number }; end: { x: number; z: number } } {
  return {
    start: { x: w.start.x + dxMm, z: w.start.z + dzMm },
    end: { x: w.end.x + dxMm, z: w.end.z + dzMm },
  };
}

/** 壁の外接矩形(mm)。壁芯だけでなく壁厚を含む（＝平面図で見える帯の外形）。 */
export function wallBounds2DMm(w: Pick<Wall, "start" | "end" | "thicknessMm">): Bounds2D {
  const dx = w.end.x - w.start.x;
  const dz = w.end.z - w.start.z;
  const len = Math.hypot(dx, dz) || 1;
  // 壁芯に直交する向き（左法線）へ厚みの半分だけ振った 4 隅
  const nx = (-dz / len) * ((w.thicknessMm || 0) / 2);
  const nz = (dx / len) * ((w.thicknessMm || 0) / 2);
  const xs = [w.start.x + nx, w.end.x + nx, w.end.x - nx, w.start.x - nx];
  const zs = [w.start.z + nz, w.end.z + nz, w.end.z - nz, w.start.z - nz];
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

/** 床（多角形）の重心(mm)＝頂点の平均。床を「1つの位置」として扱うときの代表点。 */
export function slabCentroidMm(points: SlabPoint[]): { x: number; z: number } {
  if (!points?.length) return { x: 0, z: 0 };
  let sx = 0;
  let sz = 0;
  for (const p of points) {
    sx += p.x;
    sz += p.z;
  }
  return { x: sx / points.length, z: sz / points.length };
}

/** 床の全頂点を dx/dz(mm) だけ動かす（形は変わらない）。 */
export function slabMovedPointsMm(points: SlabPoint[], dxMm: number, dzMm: number): SlabPoint[] {
  return (points || []).map((p) => ({ x: p.x + dxMm, z: p.z + dzMm }));
}

/** 床の外接矩形(mm)。 */
export function slabBounds2DMm(points: SlabPoint[]): Bounds2D {
  if (!points?.length) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { minX, maxX, minZ, maxZ };
}

/**
 * 移動量(mm)の丸め。既存のドラッグ（WallEditController / SlabEditController）と同じ 1mm 丸め。
 * 壁・床の座標は整数 mm で持つ約束なので、差分側を丸めれば結果も整数のままになる。
 */
export function roundDeltaMm(deltaMm: number): number {
  return Math.round(deltaMm);
}

// ============================================================
// アダプタ
// ============================================================

/** 家具（Object3D）。従来の整列と等価な経路。確定は呼び出し側（onCommitTransform(s)）が担う。 */
export function makeFurnitureAlignTarget(itemId: string, object: THREE.Object3D): AlignTarget {
  const box = new THREE.Box3();
  const measure = () => {
    object.updateMatrixWorld?.(true);
    return box.setFromObject(object);
  };
  return {
    id: itemId,
    kind: "furniture",
    getPos: () => ({ x: object.position.x, y: object.position.y, z: object.position.z }),
    setPos: (x, y, z) => {
      object.position.set(x, y, z);
      object.updateMatrixWorld?.(true);
    },
    getBounds2D: () => {
      const b = measure();
      return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
    },
    getBoundsY: () => {
      const b = measure();
      return { minY: b.min.y, maxY: b.max.y };
    },
    getTransform: () => ({
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    }),
    commit: () => {
      /* 家具の永続化は SingleViewportCanvas の既存経路（onCommitTransform(s)）が担当する */
    },
  };
}

/** 壁。中点を位置とし、差分を start / end の両方へ同じだけ乗せる。 */
export function makeWallAlignTarget(wall: Wall, k: number): AlignTarget {
  // 掴んだ時点の座標を控える。以後は「orig ＋ 丸めた差分」で動かす（累積誤差なし・取消も厳密）。
  const orig = { start: { ...wall.start }, end: { ...wall.end } };
  const origMid = wallMidpointMm(orig);
  const live = () => useWallStore.getState().walls.find((w) => w.id === wall.id) || wall;

  return {
    id: wall.id,
    kind: "wall",
    getPos: () => {
      const mid = wallMidpointMm(live());
      return { x: mid.x * k, y: 0, z: mid.z * k };
    },
    setPos: (x, _y, z) => {
      const dx = roundDeltaMm(x / k - origMid.x);
      const dz = roundDeltaMm(z / k - origMid.z);
      useWallStore.getState().updateWallLocal(wall.id, wallMovedMm(orig, dx, dz));
    },
    getBounds2D: () => {
      const b = wallBounds2DMm(live());
      return { minX: b.minX * k, maxX: b.maxX * k, minZ: b.minZ * k, maxZ: b.maxZ * k };
    },
    getBoundsY: () => null,
    getTransform: () => null,
    commit: () => useWallStore.getState().persistWalls(),
  };
}

/** 床・天井（role==="ceiling" のスラブも同じ）。重心を位置とし、差分を全頂点へ乗せる。 */
export function makeSlabAlignTarget(slab: FloorSlab, k: number): AlignTarget {
  const origPoints = (slab.points || []).map((p) => ({ ...p }));
  const origCenter = slabCentroidMm(origPoints);
  const live = () => useSlabStore.getState().slabs.find((s) => s.id === slab.id) || slab;

  return {
    id: slab.id,
    kind: "slab",
    getPos: () => {
      const c = slabCentroidMm(live().points || []);
      return { x: c.x * k, y: 0, z: c.z * k };
    },
    setPos: (x, _y, z) => {
      const dx = roundDeltaMm(x / k - origCenter.x);
      const dz = roundDeltaMm(z / k - origCenter.z);
      useSlabStore.getState().updateSlabLocal(slab.id, { points: slabMovedPointsMm(origPoints, dx, dz) });
    },
    getBounds2D: () => {
      const b = slabBounds2DMm(live().points || []);
      return { minX: b.minX * k, maxX: b.maxX * k, minZ: b.minZ * k, maxZ: b.maxZ * k };
    },
    getBoundsY: () => null,
    getTransform: () => null,
    commit: () => useSlabStore.getState().persistSlabs(),
  };
}

/**
 * Base（躯体）で選択中の壁・床から整列対象を集める。
 * 主選択（selectedWallId / selectedSlabId）を先頭に置く＝追従の primary になる。
 */
export function collectBaseAlignTargets(k: number): AlignTarget[] {
  const ws = useWallStore.getState();
  const ss = useSlabStore.getState();

  const orderIds = (ids: string[], primary: string | null) => {
    const uniq = Array.from(new Set(ids.filter(Boolean)));
    if (!primary || !uniq.includes(primary)) return uniq;
    return [primary, ...uniq.filter((id) => id !== primary)];
  };

  const out: AlignTarget[] = [];
  for (const id of orderIds(ws.selectedWallIds, ws.selectedWallId)) {
    const w = ws.walls.find((x) => x.id === id);
    if (w) out.push(makeWallAlignTarget(w, k));
  }
  for (const id of orderIds(ss.selectedSlabIds, ss.selectedSlabId)) {
    const s = ss.slabs.find((x) => x.id === id);
    if (s) out.push(makeSlabAlignTarget(s, k));
  }
  return out;
}

/**
 * 確定（永続化）。同じ種類は 1 回にまとめる。
 * persistWalls / persistSlabs は配列まるごとを Base へ流すので、対象ごとに呼ぶと同じ内容を
 * 何度も Firestore へ往復させることになる。
 */
export function commitAlignTargets(targets: AlignTarget[]): void {
  const done = new Set<AlignTargetKind>();
  for (const t of targets) {
    if (!t || done.has(t.kind)) continue;
    done.add(t.kind);
    t.commit();
  }
}
