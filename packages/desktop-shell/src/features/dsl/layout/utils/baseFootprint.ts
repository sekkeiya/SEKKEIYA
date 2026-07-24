// baseFootprint — 実躯体（baseColliders）から建物の「内法」フットプリントを実測する。
//   - 壁らしい薄い箱（片方向が壁厚以下・もう片方向が長い）だけを集めて外形を出し、
//     各辺の内側の面（左壁なら max.x）を内法とする。
//   - 地面板・床スラブ・スキャン板は「薄い壁」ではないので自然に除外される。
// 展開図の寸法（ElevationDimensionsOverlay）と「ゾーンを躯体にフィット」の両方で使い、
// 平面図と展開図の寸法が同じ実測値を指すようにする。
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useBuildingSpecStore, ceilingHeightOf } from "../store/useBuildingSpecStore";
import { useWallStore, WALL_DEFAULT_THICKNESS, type Wall } from "../store/useWallStore";
import { useSlabStore, slabIsFloor } from "../store/useSlabStore";
import { layoutSceneRef } from "../services/layoutSceneRef";

/** 実メッシュか（three の Fat-Line=LineSegments2/Line2 は Mesh を継承していて
 *  isMesh=true だが、raycast にカメラが要り null 参照でクラッシュするので除外）。 */
function isRaycastableMesh(o: any): boolean {
  return !!o?.isMesh && !o.isLineSegments2 && !o.isLine2 && !o.isLine && !!o.geometry?.attributes?.position;
}

/** グループ配下の実メッシュを平坦化して push（Fat-Line と非表示は除外）。 */
function pushMeshes(root: any, out: any[], seen: Set<any>) {
  if (!root) return;
  if (typeof root.traverse === "function") {
    root.traverse((o: any) => {
      if (o?.visible === false) return;
      if (isRaycastableMesh(o) && !seen.has(o)) { seen.add(o); out.push(o); }
    });
  } else if (isRaycastableMesh(root) && !seen.has(root)) {
    seen.add(root); out.push(root);
  }
}

/** レイキャストの対象になる「構造メッシュ」を、実際に描画中のシーンから集める（平坦なMesh配列）。
 *  この躯体は GLB インポートと S.Layout 作図（壁/床/天井）が混在するので、
 *  片方のデータソースだけ見ると壁を取りこぼす。シーンには両方が描かれているので、
 *  シーンから壁（isWall / 躯体GLB）と水平面（床/天井/isFloorSlab）をまとめて拾う。
 *  家具（objectsRef 側）は含めない＝壁の実測が家具で誤って手前に止まらない。
 *  戻り値は recursive=false でレイキャストできるよう、すべて実 Mesh に平坦化済み。 */
function collectStructureMeshes(): { walls: any[]; all: any[] } {
  const walls: any[] = [];
  const all: any[] = [];
  const seenAll = new Set<any>();
  const seenWall = new Set<any>();
  // 1) GLB 躯体（レジストリ＝壁/床/屋根のシェル）。グループなら実メッシュへ平坦化。
  const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
  colliders.forEach((o: any) => {
    pushMeshes(o, all, seenAll);
    pushMeshes(o, walls, seenWall); // GLB は壁も床も含むが、法線フィルタで方向別に選ぶので全部入れてよい
  });
  // 2) S.Layout 作図の壁・床・天井（シーンを走査）。userData の印で判別する。
  const scene = layoutSceneRef.scene;
  if (scene?.traverse) {
    scene.traverse((o: any) => {
      if (!isRaycastableMesh(o) || o.visible === false) return;
      // 祖先まで見て「作図構造 or 壁 or 床スラブ」か判定
      let isWall = false, isStruct = false, isGhost = false, isSlab = false;
      let n: any = o;
      for (let d = 0; d < 6 && n; d++, n = n.parent) {
        const u = n.userData || {};
        if (u.isWall) isWall = true;
        if (u.isFloorSlab) isSlab = true;
        if (u.isWall || u.isFloorSlab || u.isDrawnStructure) isStruct = true;
        if (u.isGhostFloor) isGhost = true;
      }
      if (!isStruct || isGhost) return;
      if (!seenAll.has(o)) { seenAll.add(o); all.push(o); }
      // 壁ターゲット: 明示的な壁、または床スラブでない作図構造（壁本体）
      if ((isWall || !isSlab) && !seenWall.has(o)) { seenWall.add(o); walls.push(o); }
    });
  }
  return { walls, all };
}

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

/** 「壁らしい」コライダー（薄い×長い×立っている箱）を集める。
 *  地面板・床スラブ・スキャン板は薄くないか長くないので自然に外れ、
 *  柱は「長い」を満たさないので外れる（＝レイキャストで柱を壁と誤認しない）。 */
function collectWalls(): { objects: any[]; boxes: THREE.Box3[] } {
  const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);
  const objects: any[] = [];
  const boxes: THREE.Box3[] = [];
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
    objects.push(obj);
    boxes.push(tmp.clone());
  });
  return { objects, boxes };
}

/** 実躯体の内法矩形（world XZ）。壁が測れなければ null。 */
export function measureBaseInterior(): InteriorRect | null {
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);

  const walls = collectWalls().boxes;
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

/** S.Layout で作図した壁（useWallStore）から、その点が居る部屋の内壁面を求める。
 *
 *  レイキャスト（measureRoomInteriorAt）は baseColliders＝インポートした GLB 躯体しか
 *  相手にできない。躯体編集で描いた壁は別レンダラー（WallsRenderer）で描かれていて
 *  コライダーに登録されないため、レイが素通りして隣室まで展開図に入ってしまう。
 *  こちらは壁の芯線＋壁厚という確定データから幾何的に求めるので、
 *  開口（ドア/窓）で抜けることもなく確実。
 *
 *  返すのは world 座標＋当たった壁の厚み（クリップの外側パディングを
 *  「壁の外面ちょうど」で止めるのに使う）。壁が無い方向は null（＝呼び側で絞らない）。 */
export interface RoomWallHit {
  /** 内壁面（部屋側の面）の world 座標 */
  face: number;
  /** 当たった壁の厚み（world 単位）。外面 = face ± thicknessW。
   *  測れなかった場合は null（GLB のレイキャストで外面が見つからない等）。 */
  thicknessW: number | null;
}
export interface RoomWallHits {
  minX: RoomWallHit | null; maxX: RoomWallHit | null;
  minZ: RoomWallHit | null; maxZ: RoomWallHit | null;
}
export function measureRoomFromWalls(pos: { x: number; z: number }, flHintY?: number): RoomWallHits {
  const out: RoomWallHits = { minX: null, maxX: null, minZ: null, maxZ: null };
  const walls: Wall[] = (useWallStore.getState().walls || []) as Wall[];
  if (!walls.length) return out;
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001; // 壁データは mm。シーンが m ならスケールする

  // 高さで足切り（腰壁で部屋を切らない）
  const usable = walls.filter((w) => !!w.start && !!w.end && !(w.heightMm != null && w.heightMm < 1800));
  // 階の絞り込みは「その壁が建つ FL が展開図の FL と一致するか」で見る。
  // activeFloorIndex（UI で選択中の階）で絞ると、2F を選んだまま 1F の部屋の
  // 展開を開いたときに壁が全滅し、隣室が映り込んだままになる。
  const spec: any = useBuildingSpecStore.getState();
  const floors = spec.floors || [];
  const n = Math.max(1, floors.length || 1);
  const flOfW = (i: number) =>
    ((spec.fl0Mm || 0) + (floors[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0)) * k;
  const tolY = 600 * k;
  const sameFloor = flHintY == null
    ? usable
    : usable.filter((w) => Math.abs(flOfW(w.floorIndex || 0) - flHintY) < tolY);
  // 階が一致する壁が1本も無いときは階を問わず全部使う（何も絞れないより良い）
  const targets = sameFloor.length ? sameFloor : usable;
  if (!targets.length) return out;

  // 光線（軸平行）と壁矩形の交差 → いちばん手前の距離＋その壁の厚み
  const nearest = (dx: number, dz: number): { t: number; thicknessW: number } | null => {
    let best: { t: number; thicknessW: number } | null = null;
    targets.forEach((w) => {
      const ax = w.start.x * k, az = w.start.z * k;
      const bx = w.end.x * k, bz = w.end.z * k;
      const ex = bx - ax, ez = bz - az;
      const len = Math.hypot(ex, ez);
      if (len < 1e-9) return;
      const thicknessW = (w.thicknessMm || WALL_DEFAULT_THICKNESS[w.kind] || 100) * k;
      const half = thicknessW / 2;
      // 壁厚ぶん膨らませた矩形の4隅（芯線に直交する法線方向へ half）
      const nx = (-ez / len) * half, nz = (ex / len) * half;
      const c = [
        [ax + nx, az + nz], [bx + nx, bz + nz],
        [bx - nx, bz - nz], [ax - nx, az - nz],
      ];
      for (let i = 0; i < 4; i++) {
        const [c1x, c1z] = c[i];
        const [c2x, c2z] = c[(i + 1) % 4];
        const sx = c2x - c1x, sz = c2z - c1z;
        // P + t*D = C1 + s*S  を解く（D は軸平行の単位ベクトル）
        const det = sx * dz - dx * sz;
        if (Math.abs(det) < 1e-12) continue; // 平行
        const fx = c1x - pos.x, fz = c1z - pos.z;
        const t = (sx * fz - fx * sz) / det; // 光線上の距離
        const s = (dx * fz - fx * dz) / det; // 辺上の位置（0〜1 が線分内）
        if (!(t > 1e-6) || s < 0 || s > 1) continue;
        if (best == null || t < best.t) best = { t, thicknessW };
      }
    });
    return best;
  };

  const px = nearest(1, 0);
  if (px) out.maxX = { face: pos.x + px.t, thicknessW: px.thicknessW };
  const nx = nearest(-1, 0);
  if (nx) out.minX = { face: pos.x - nx.t, thicknessW: nx.thicknessW };
  const pz = nearest(0, 1);
  if (pz) out.maxZ = { face: pos.z + pz.t, thicknessW: pz.thicknessW };
  const nz = nearest(0, -1);
  if (nz) out.minZ = { face: pos.z - nz.t, thicknessW: nz.thicknessW };
  return out;
}

/** 軸平行の光線と線分の交差距離（t>0 かつ線分内なら距離、それ以外 null）。
 *  P + t*(dx,dz) = C1 + s*(C2-C1) を Cramer で解く。 */
function rayHitSegment(
  px: number, pz: number, dx: number, dz: number,
  c1x: number, c1z: number, c2x: number, c2z: number,
): number | null {
  const sx = c2x - c1x, sz = c2z - c1z;
  const det = sx * dz - dx * sz;
  if (Math.abs(det) < 1e-12) return null; // 平行
  const fx = c1x - px, fz = c1z - pz;
  const t = (sx * fz - fx * sz) / det;
  const s = (dx * fz - fx * dz) / det;
  if (!(t > 1e-6) || s < 0 || s > 1) return null;
  return t;
}

/** 点を含む多角形か（レイ交差法） */
function pointInPolygon(pts: { x: number; z: number }[], px: number, pz: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
    if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
  }
  return hit;
}

/** その点が乗っている「床スラブの輪郭」から、部屋の広がりを求める（world 座標）。
 *
 *  展開図は「その部屋の各面を見た断面図」なので、範囲は部屋の輪郭そのものであるべき。
 *  ゾーン矩形は計画上の区画で、実際の部屋より大きい/小さいことがあり当てにならない
 *  （実機で部屋のゾーンが建物の全奥行きに広がっており、隣室が映り込んでいた）。
 *  床スラブは部屋ごとに描かれた多角形なので、これが最も確かな「部屋の輪郭」。
 *
 *  記号位置から±X/±Zへ輪郭の辺までの距離を測るので、L字の部屋でも
 *  その位置での実際の広がり（凹みの手前まで）が取れる。 */
export function measureRoomFromSlab(pos: { x: number; z: number }): {
  minX: number; maxX: number; minZ: number; maxZ: number;
} | null {
  const slabs: any[] = (useSlabStore.getState() as any).slabs || [];
  if (!slabs.length) return null;
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  const activeFloor = (useBuildingSpecStore.getState() as any).activeFloorIndex || 0;
  const px = pos.x / k, pz = pos.z / k; // スラブ頂点は mm

  // 床として描かれる面（role: floor / both）。階は一致 or 未設定(=1F)を許容。
  const cands = slabs.filter(
    (s) =>
      s?.points?.length >= 3 &&
      slabIsFloor(s) &&
      ((s.floorIndex || 0) === activeFloor || (s.floorIndex || 0) === 0),
  );
  const holding = cands.filter((s) => pointInPolygon(s.points, px, pz));
  if (!holding.length) return null;
  // 複数に含まれるなら面積が最小のもの＝いちばん具体的な部屋
  const areaOf = (s: any) => {
    let a = 0;
    const p = s.points;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[j].z - p[i].z);
    return Math.abs(a / 2);
  };
  const slab = holding.reduce((best, s) => (areaOf(s) < areaOf(best) ? s : best), holding[0]);

  // 輪郭の辺までの距離（4方向）
  const dist = (dx: number, dz: number): number | null => {
    const p = slab.points;
    let best: number | null = null;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const t = rayHitSegment(px, pz, dx, dz, p[j].x, p[j].z, p[i].x, p[i].z);
      if (t != null && (best == null || t < best)) best = t;
    }
    return best;
  };
  const dPx = dist(1, 0), dNx = dist(-1, 0), dPz = dist(0, 1), dNz = dist(0, -1);
  if (dPx == null || dNx == null || dPz == null || dNz == null) return null;
  return {
    minX: (px - dNx) * k,
    maxX: (px + dPx) * k,
    minZ: (pz - dNz) * k,
    maxZ: (pz + dPz) * k,
  };
}

/** その点を覆う「天井スラブの下面」の world Y。無ければ null。
 *
 *  天井として描かれるスラブ（role="ceiling"）は FloorSlabsRenderer が
 *  「上面＝その階の CL・厚みは下向き」に置く（= CL−厚 から CL を占める）。
 *  つまり天井は室内へ張り出しているので、CL でクリップすると厚みぶんが
 *  展開図の上端に黒い帯として残る。天井の下面で切るためにここで実測する。 */
export function measureCeilingUndersideAt(pos: { x: number; z: number }): number | null {
  const slabs: any[] = (useSlabStore.getState() as any).slabs || [];
  if (!slabs.length) return null;
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  const spec: any = useBuildingSpecStore.getState();
  const activeFloor = spec.activeFloorIndex || 0;
  const floors = spec.floors || [];
  const n = Math.max(1, floors.length || 1);
  const flOf = (i: number) =>
    (spec.fl0Mm || 0) + (floors[Math.max(0, Math.min(i || 0, n - 1))]?.flMm || 0);

  // 多角形の内外判定（レイ交差法。頂点は mm なので pos を mm 側へ合わせる）
  const px = pos.x / k, pz = pos.z / k;
  const inside = (pts: any[]) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, zi = pts[i].z, xj = pts[j].x, zj = pts[j].z;
      if ((zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi) hit = !hit;
    }
    return hit;
  };

  let best: number | null = null;
  slabs.forEach((s) => {
    // 立面/断面/展開で「天井として CL に描かれる」のは role==="ceiling" のみ
    // （both は床として FL に1回だけ描かれる）。FloorSlabsRenderer と同じ条件。
    if (s?.role !== "ceiling") return;
    // 階違いは対象外。ただし floorIndex 未設定（＝1F 扱い）は活かす。
    if ((s.floorIndex || 0) !== activeFloor && (s.floorIndex || 0) !== 0) return;
    if (!(s.points?.length >= 3)) return;
    if (!inside(s.points)) return;
    const topMm = flOf(s.floorIndex || 0) + ceilingHeightOf(spec, s.floorIndex || 0) + (s.offsetYMm || 0);
    const underMm = topMm - (s.thicknessMm || 0);
    const w = underMm * k;
    best = best == null ? w : Math.min(best, w);
  });
  return best;
}

/** 部屋内の1点からのレイキャスト実測。取れなかった方向は null。 */
export interface RoomProbe {
  minX: number | null; maxX: number | null;
  minZ: number | null; maxZ: number | null;
  /** 床の上端 / 天井の下端（world Y） */
  floorY: number | null; ceilY: number | null;
}

/** 記号位置（部屋の中の点）から±X/±Z/上下へレイキャストして、その部屋自身の
 *  内壁面・床上端・天井下端を実測する（flHintY = FL の目安。レイ高さの基準）。
 *  measureBaseInterior が建物全体の内法なのに対し、こちらは「その点が居る部屋」。
 *  展開図のクリップ範囲をゾーン矩形でなく実部屋に合わせるために使う。
 *
 *  壁の判定は「ほぼ鉛直な面に最初に当たった点」。面の法線の向き（表裏）は見ない
 *  ——GLB の壁は片面ポリゴンや反転法線があり、「こちらを向いている面」に限定すると
 *  手前の間仕切りをすり抜けて奥の外壁まで測ってしまい、隣室が展開図に映り込む。
 *  ドア開口をレイが抜けるのを避けるため、腰高(FL+1200)と天井際の2高さで撃ち、
 *  近い方を採る（天井際は下り壁があるので開口を跨げる）。
 *  それでも開口を抜けた方向は遠い壁が返るので、呼び側は縮める方向にだけ使うこと。 */
export function measureRoomInteriorAt(pos: { x: number; z: number }, flHintY: number): RoomProbe {
  const probe: RoomProbe = { minX: null, maxX: null, minZ: null, maxZ: null, floorY: null, ceilY: null };
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);

  // GLB 躯体＋S.Layout 作図（壁/床/天井）を混在で相手にする。
  // 片方のデータソースだけ見ると混在躯体では壁を取りこぼす。
  const { walls: wallHits, all: allHits } = collectStructureMeshes();
  if (!allHits.length) return probe;

  const worldNormal = (h: THREE.Intersection): THREE.Vector3 | null =>
    h.face?.normal ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null;
  const minDist = toWorld(1);
  const cast = (
    targets: any[],
    originY: number,
    dir: THREE.Vector3,
    accept: (n: THREE.Vector3) => boolean,
  ): THREE.Intersection | null => {
    const ray = new THREE.Raycaster(new THREE.Vector3(pos.x, originY, pos.z), dir);
    // recursive=false: targets は実 Mesh に平坦化済み（Fat-Line を降りて
    // Raycaster.camera 未設定でクラッシュするのを防ぐ）。
    for (const h of ray.intersectObjects(targets, false)) {
      if (h.distance < minDist) continue;
      const n = worldNormal(h);
      if (n && accept(n)) return h;
    }
    return null;
  };

  // 1) 床上端・天井下端（記号位置から上下へ。床・天井も含む全構造メッシュへ）
  const probeY = flHintY + toWorld(1200);
  probe.floorY = cast(allHits, probeY, new THREE.Vector3(0, -1, 0), (n) => n.y > 0.5)?.point.y ?? null;
  probe.ceilY = cast(allHits, probeY, new THREE.Vector3(0, 1, 0), (n) => n.y < -0.5)?.point.y ?? null;

  // 2) 壁（腰高＋天井際の最寄り）
  const fl = probe.floorY ?? flHintY;
  const heights = [fl + toWorld(1200)];
  if (probe.ceilY != null && probe.ceilY - fl > toWorld(1800)) heights.push(probe.ceilY - toWorld(150));
  const isVertical = (n: THREE.Vector3) => Math.abs(n.y) < 0.6;
  const nearestWall = (dx: number, dz: number, axis: "x" | "z"): number | null => {
    const d = new THREE.Vector3(dx, 0, dz);
    let best: number | null = null;
    heights.forEach((y) => {
      const h = cast(wallHits, y, d, isVertical);
      if (!h) return;
      const v = axis === "x" ? h.point.x : h.point.z;
      // 「最寄り」= 進行方向にいちばん手前
      if (best == null) best = v;
      else best = (dx + dz > 0) ? Math.min(best, v) : Math.max(best, v);
    });
    return best;
  };
  probe.maxX = nearestWall(1, 0, "x");
  probe.minX = nearestWall(-1, 0, "x");
  probe.maxZ = nearestWall(0, 1, "z");
  probe.minZ = nearestWall(0, -1, "z");
  return probe;
}

/** 「躯体にフィット（部屋版）」用: 点 pos が居る部屋の実範囲を rect(中心＋幅奥行) で返す。
 *  優先度: 床スラブの輪郭 > 作図壁＋GLBレイの4面 > 建物内法。測れなければ null。
 *  ゾーンの「躯体にフィット」と同じく、部屋の rect を実際の壁の内側へ合わせるのに使う。 */
export function measureRoomRectAt(pos: { x: number; z: number }): { x: number; z: number; width: number; depth: number } | null {
  const isMm = ((useEditorModeStore.getState() as any).sceneMaxY || 0) > 100;
  const toWorld = (mm: number) => (isMm ? mm : mm / 1000);
  const rectOf = (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => ({
    x: (b.minX + b.maxX) / 2,
    z: (b.minZ + b.maxZ) / 2,
    width: b.maxX - b.minX,
    depth: b.maxZ - b.minZ,
  });
  const big = (b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
    b.maxX - b.minX > toWorld(300) && b.maxZ - b.minZ > toWorld(300);

  // 1) 床スラブの輪郭（その部屋の実形状）
  const bySlab = measureRoomFromSlab(pos);
  if (bySlab && big(bySlab)) return rectOf(bySlab);

  // 2) 作図壁 ＋ GLB レイの4面（両ソースの最寄りを採用）
  const flSpec = toWorld(((useBuildingSpecStore.getState() as any).fl0Mm as number) || 0);
  const w = measureRoomFromWalls(pos, flSpec);
  const p = measureRoomInteriorAt(pos, flSpec);
  const minX = w.minX?.face ?? p.minX;
  const maxX = w.maxX?.face ?? p.maxX;
  const minZ = w.minZ?.face ?? p.minZ;
  const maxZ = w.maxZ?.face ?? p.maxZ;
  if (minX != null && maxX != null && minZ != null && maxZ != null) {
    const b = { minX, maxX, minZ, maxZ };
    if (big(b)) return rectOf(b);
  }

  // 3) 建物全体の内法
  const interior = measureBaseInterior();
  if (interior && big(interior)) return rectOf(interior);
  return null;
}
