/**
 * 自動ゾーニング（ルールベース v1）
 *
 * 全体フロー: 自動ラベル → 【自動ゾーニング】 → 自動家具選定 → 自動レイアウト。
 *
 * 自動ラベル（structureAutoLabel）が確定させた躯体面ラベル
 *   - floor          : 屋内床
 *   - inner_wall     : 内壁（＝部屋の仕切り）
 *   - outer_wall     : 外壁（＝建物外周）
 * を入力に、床のフットプリントを「内壁の通り芯」で矩形セルに分割し、
 * 壁で仕切られていない隣接セルを同じ部屋(roomId)にまとめて ZoneNode[] を生成する。
 *
 * 出力 ZoneNode は rect(中心 x,z + width,depth, mm) と category を持ち、
 * そのまま furnitureSelectionService.generateSlots / Auto Layout に渡せる契約
 * （[[project_slayout_auto_layout_arch]]）。永続化は ZoneDrawController と同じ
 * "LayoutShell:UpdateZonesArray" イベントに委ねる。
 *
 * 制約(v1): フットプリントは矩形バウンディングで近似する。L字など非矩形の部屋は
 * 「同じ roomId を持つ複数の矩形ゾーン」として表現する（家具選定の room スコープで束ねられる）。
 */
import * as THREE from "three";
import { layoutSceneRef } from "./layoutSceneRef";
import { useStructureLabelStore } from "../store/useStructureLabelStore";
import { useLayoutTaskStore, type ZoneNode, type ZoneRect } from "../store/useLayoutTaskStore";
import { useAutoLayoutStore } from "../store/useAutoLayoutStore";
import { getRoomCategories, type RoomCategory } from "../constants/roomCategories";
import { ZONE_COLORS } from "../canvas/scene/ZoneDrawController";

export interface AutoZoningResult {
  ok: boolean;
  reason?: string;
  /** 生成したゾーン数 */
  zoneCount: number;
  /** 束ねた部屋数（roomId 数） */
  roomCount: number;
}

interface Footprint { minX: number; maxX: number; minZ: number; maxZ: number; }

/** 壁の XZ 投影。run 方向に沿って [a,b] の幅を持つ線分。pos は run と直交する位置。 */
interface VCutWall { x: number; zMin: number; zMax: number; } // Z方向に走る壁 → X を仕切る
interface HCutWall { z: number; xMin: number; xMax: number; } // X方向に走る壁 → Z を仕切る

// 最小ゾーン辺長(mm)。これ未満の分割幅は通り芯のノイズ（壁厚由来の重複）として吸収する。
const MIN_CELL = 600;
// 開口（仕切り無し）と判定する被覆率しきい値。共有辺の半分以上が壁なら「仕切られている」。
const COVER_THRESH = 0.5;

/** 床面ラベルの XZ バウンディングを合算してフットプリントを得る。 */
function footprintFromFloors(): Footprint | null {
  const labels = useStructureLabelStore.getState().labels;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let found = false;
  for (const key of Object.keys(labels)) {
    const lab = labels[key];
    if (lab.semantic !== "floor") continue;
    const s: any = lab.surface;
    // tris があれば実頂点から、無ければ center±(u,v) の四隅から XZ 範囲を取る。
    const pts: number[][] = [];
    if (Array.isArray(s.tris) && s.tris.length >= 9) {
      for (let i = 0; i + 2 < s.tris.length; i += 3) pts.push([s.tris[i], s.tris[i + 2]]);
    } else {
      const c = s.center, u = s.uAxis, v = s.vAxis, w = (s.width || 0) / 2, h = (s.height || 0) / 2;
      for (const su of [-1, 1]) for (const sv of [-1, 1]) {
        pts.push([c[0] + u[0] * w * su + v[0] * h * sv, c[2] + u[2] * w * su + v[2] * h * sv]);
      }
    }
    for (const [px, pz] of pts) {
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
      found = true;
    }
  }
  if (!found || !isFinite(minX)) return null;
  return { minX, maxX, minZ, maxZ };
}

/** 床ラベルが無いときの保険: 躯体メッシュの XZ バウンディング。 */
function footprintFromScene(): Footprint | null {
  const root = layoutSceneRef.baseRoot as THREE.Object3D | null;
  if (!root) return null;
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return null;
  return { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
}

/** 内壁ラベルを XZ の仕切り線分に投影して分類する。 */
function collectWalls(): { vCuts: VCutWall[]; hCuts: HCutWall[] } {
  const labels = useStructureLabelStore.getState().labels;
  const vCuts: VCutWall[] = [];
  const hCuts: HCutWall[] = [];
  for (const key of Object.keys(labels)) {
    const lab = labels[key];
    if (lab.semantic !== "inner_wall") continue; // 仕切りは内壁のみ（外壁は外周＝フットプリント端）
    const s: any = lab.surface;
    const u = new THREE.Vector3(s.uAxis[0], s.uAxis[1], s.uAxis[2]);
    const v = new THREE.Vector3(s.vAxis[0], s.vAxis[1], s.vAxis[2]);
    const uXZ = Math.hypot(u.x, u.z), vXZ = Math.hypot(v.x, v.z);
    // 水平に寝ている方の面内軸が壁の走る向き。その軸長が壁の XZ 上の長さ。
    let dirX: number, dirZ: number, runLen: number;
    if (uXZ >= vXZ) { dirX = u.x; dirZ = u.z; runLen = s.width || 0; }
    else { dirX = v.x; dirZ = v.z; runLen = s.height || 0; }
    const m = Math.hypot(dirX, dirZ) || 1;
    dirX /= m; dirZ /= m;
    const cx = s.center[0], cz = s.center[2];
    const half = runLen / 2;
    if (Math.abs(dirX) >= Math.abs(dirZ)) {
      // X方向に走る壁 → Z を南北に仕切る
      hCuts.push({ z: cz, xMin: cx - half * Math.abs(dirX), xMax: cx + half * Math.abs(dirX) });
    } else {
      // Z方向に走る壁 → X を東西に仕切る
      vCuts.push({ x: cx, zMin: cz - half * Math.abs(dirZ), zMax: cz + half * Math.abs(dirZ) });
    }
  }
  return { vCuts, hCuts };
}

/** 通り芯候補（壁位置）を、フットプリント端・近接重複を除いて昇順に並べた内部分割位置にする。 */
function buildAxis(min: number, max: number, cutPositions: number[]): number[] {
  const tol = Math.max(MIN_CELL, (max - min) * 0.02);
  const interior = cutPositions
    .filter((p) => p > min + tol && p < max - tol)
    .sort((a, b) => a - b);
  const snapped: number[] = [];
  for (const p of interior) {
    if (snapped.length && Math.abs(p - snapped[snapped.length - 1]) < tol) continue; // 近接（壁厚由来）は1本に
    snapped.push(p);
  }
  return [min, ...snapped, max];
}

/** [a,b] 区間に対する線分群の被覆率（0〜1）。共有辺が壁で塞がれているかの判定に使う。 */
function coverage(a: number, b: number, segs: { lo: number; hi: number }[]): number {
  const span = b - a;
  if (span <= 0) return 0;
  const tol = MIN_CELL * 0.5;
  const ranges = segs
    .map((s) => ({ lo: Math.max(a, s.lo - tol), hi: Math.min(b, s.hi + tol) }))
    .filter((r) => r.hi > r.lo)
    .sort((p, q) => p.lo - q.lo);
  let covered = 0, cur = -Infinity;
  for (const r of ranges) {
    const lo = Math.max(r.lo, cur);
    if (r.hi > lo) { covered += r.hi - lo; cur = r.hi; }
  }
  return covered / span;
}

/** 建物タイプ × 面積ランクから既定カテゴリを選ぶ（ユーザーが後で直す前提の出発点）。 */
function pickCategory(buildingType: string, rank: number, areaSqm: number): RoomCategory {
  const cats = getRoomCategories(buildingType);
  const byKey = (k: string) => cats.find((c) => c.key === k);
  const general = byKey("general") || cats[cats.length - 1];
  if (buildingType === "office") {
    if (rank === 0) return byKey("workspace") || general;
    if (areaSqm >= 12) return byKey("meeting") || general;
    return general;
  }
  if (buildingType === "cafe") return byKey("seating") || general;
  if (buildingType === "hotel") return rank === 0 ? (byKey("guestroom") || general) : general;
  // residential（既定）
  if (rank === 0) return byKey("ldk") || byKey("living") || general;
  if (areaSqm >= 8) return byKey("bedroom") || general;
  return general;
}

/**
 * 自動ゾーニングを実行し、生成ゾーンを ZoneDrawController と同じイベントで反映する。
 * 既存ゾーンは置き換える（自動アクションのため）。
 */
export function autoZoning(): AutoZoningResult {
  const footprint = footprintFromFloors() || footprintFromScene();
  if (!footprint) {
    return { ok: false, reason: "床ラベルが見つかりません。先に「自動ラベル」を実行してください", zoneCount: 0, roomCount: 0 };
  }
  const { minX, maxX, minZ, maxZ } = footprint;
  if (maxX - minX < MIN_CELL || maxZ - minZ < MIN_CELL) {
    return { ok: false, reason: "フットプリントが小さすぎます", zoneCount: 0, roomCount: 0 };
  }

  const { vCuts, hCuts } = collectWalls();
  const xs = buildAxis(minX, maxX, vCuts.map((w) => w.x));
  const zs = buildAxis(minZ, maxZ, hCuts.map((w) => w.z));

  const nI = xs.length - 1; // X方向セル数
  const nJ = zs.length - 1; // Z方向セル数

  // セル (i,j) → 部屋グループの Union-Find。壁で仕切られていない隣接は同部屋。
  const parent = new Array(nI * nJ).fill(0).map((_, k) => k);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const idx = (i: number, j: number) => j * nI + i;
  const tol = Math.max(MIN_CELL, (maxX - minX + maxZ - minZ) * 0.01);

  for (let j = 0; j < nJ; j++) {
    for (let i = 0; i < nI; i++) {
      // 東隣 (i+1,j): 共有辺は x=xs[i+1], z∈[zs[j],zs[j+1]]。その x 付近の縦壁が辺を塞ぐか。
      if (i + 1 < nI) {
        const lineX = xs[i + 1];
        const segs = vCuts.filter((w) => Math.abs(w.x - lineX) < tol).map((w) => ({ lo: w.zMin, hi: w.zMax }));
        if (coverage(zs[j], zs[j + 1], segs) < COVER_THRESH) union(idx(i, j), idx(i + 1, j));
      }
      // 北隣 (i,j+1): 共有辺は z=zs[j+1], x∈[xs[i],xs[i+1]]。その z 付近の横壁が辺を塞ぐか。
      if (j + 1 < nJ) {
        const lineZ = zs[j + 1];
        const segs = hCuts.filter((w) => Math.abs(w.z - lineZ) < tol).map((w) => ({ lo: w.xMin, hi: w.xMax }));
        if (coverage(xs[i], xs[i + 1], segs) < COVER_THRESH) union(idx(i, j), idx(i, j + 1));
      }
    }
  }

  // グループ集計（面積でランク付けしてカテゴリを割り当てる）。
  interface Cell { i: number; j: number; rect: ZoneRect; area: number; }
  const groups = new Map<number, Cell[]>();
  for (let j = 0; j < nJ; j++) {
    for (let i = 0; i < nI; i++) {
      const w = xs[i + 1] - xs[i];
      const d = zs[j + 1] - zs[j];
      if (w < MIN_CELL || d < MIN_CELL) continue; // 壁厚由来の極小セルは除外
      const rect: ZoneRect = { x: (xs[i] + xs[i + 1]) / 2, z: (zs[j] + zs[j + 1]) / 2, width: w, depth: d };
      const root = find(idx(i, j));
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push({ i, j, rect, area: (w * d) / 1_000_000 });
    }
  }
  if (groups.size === 0) {
    return { ok: false, reason: "ゾーンを生成できませんでした", zoneCount: 0, roomCount: 0 };
  }

  const buildingType = useAutoLayoutStore.getState().buildingType ?? "residential";
  // 部屋（グループ）を面積降順に並べてランク付け。
  const ranked = [...groups.values()]
    .map((cells) => ({ cells, area: cells.reduce((s, c) => s + c.area, 0) }))
    .sort((a, b) => b.area - a.area);

  const now = Date.now();
  const zones: ZoneNode[] = [];
  ranked.forEach((room, rank) => {
    const cat = pickCategory(buildingType, rank, room.area);
    const color = ZONE_COLORS[rank % ZONE_COLORS.length];
    const roomId = `room-${now}-${rank}`;
    const multi = room.cells.length > 1;
    room.cells.forEach((cell, ci) => {
      zones.push({
        id: `zone-${now}-${rank}-${ci}-${Math.random().toString(16).slice(2, 6)}`,
        roomId,
        name: multi ? `${cat.label}${ci + 1}` : cat.label,
        targetSeats: 0,
        category: cat.key,
        color,
        rect: cell.rect,
        createdBy: "ai",
        createdAtMs: now,
      });
    });
  });

  window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", { detail: { zones } }));
  // 永続層（baseRef）が無い環境でもストアには即反映しておく。
  useLayoutTaskStore.getState().setZones(zones);
  useLayoutTaskStore.getState().setActiveZoneId(null);

  return { ok: true, zoneCount: zones.length, roomCount: ranked.length };
}
