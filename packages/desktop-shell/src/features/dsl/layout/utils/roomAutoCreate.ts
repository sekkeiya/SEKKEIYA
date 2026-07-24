// roomAutoCreate — 「自動部屋作成」ツールの本体。
//   平面図でクリックした点から、壁で囲われた範囲をフラッドフィルで検出し、
//   その範囲から部屋（Room＋Zone）を作る。部屋ができると既存の仕組み
//   （ensureRoomDefaults）で展開A〜Dの記号が自動生成される。
//
//   壁の検出は2系統:
//     ・作図した壁 … 芯＋厚みの帯でセルを塞ぐ（開口は無視＝ドアがあっても部屋は分かれる）
//     ・GLB 躯体（Rhino 等からのインポート）… 隣接セル中心を結ぶ短い水平レイを
//       2つの高さ（FL+400 / FL+1500）で飛ばし、壁面に当たったらその境界を塞ぐ。
//       面に当てる方式なので壁の厚みに依存しない。2高さにするのは、腰窓（FL+400で
//       下壁に当たる）とドア上の垂れ壁だけのような開口の取りこぼしを減らすため。
//
//   検出した範囲が図面の外周（探索グリッドの縁）まで漏れたら「囲われていない」として
//   何も作らない（クリックが屋外や開けっ放しの範囲だったケース）。
//
//   ZoneRect は「中心座標＋幅/奥行」（OptionDetailPanel の＋ゾーンと同じ規約）。
//   永続化は LayoutShell のイベント（UpdateRooms / AddZone）経由で Base に載る。
import * as THREE from "three";
import { useLayoutTaskStore } from "../store/useLayoutTaskStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useWallStore } from "../store/useWallStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";
import { useSceneObjectRegistryStore } from "../store/sceneObjectRegistryStore";
import { layoutSceneRef } from "../services/layoutSceneRef";
import { measureXZBounds } from "./planBounds";

/** 探索グリッドのセル寸法(mm)。壁厚100mmでも帯判定（下記）で必ず塞がる大きさに保つこと。 */
const CELL_MM = 150;
/** 建物範囲の外側に足す探索マージン（セル数）。ここまで漏れたら「囲われていない」。 */
const MARGIN_CELLS = 3;
/** セル数の上限（巨大シーンでの暴走防止）。 */
const MAX_CELLS = 80000;
/** GLB 壁面テストの高さ（FL からの相対 mm）。 */
const GLB_TEST_HEIGHTS_MM = [400, 1500];

interface Pt { x: number; z: number }

/** 既存部屋と名前が被らない「部屋N」を返す。 */
function nextRoomName(existing: { name?: string }[]): string {
  const used = new Set((existing || []).map((r) => String(r?.name || "")));
  for (let n = 1; n < 1000; n++) {
    const name = `部屋${n}`;
    if (!used.has(name)) return name;
  }
  return `部屋${Date.now() % 1000}`;
}

/** 点から線分への距離(mm)。作図壁の帯判定に使う。 */
function distToSegment(p: Pt, a: Pt, b: Pt): number {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const len2 = ex * ex + ez * ez;
  if (len2 < 1) return Math.hypot(p.x - a.x, p.z - a.z);
  let t = ((p.x - a.x) * ex + (p.z - a.z) * ez) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + ex * t - p.x, a.z + ez * t - p.z);
}

export interface RoomCreateResult {
  ok: boolean;
  name?: string;
  /** ok=false の理由（ユーザー向けメッセージ）。 */
  message?: string;
}

/**
 * クリック地点（world mm / XZ）から壁で囲われた範囲を検出して部屋を作る。
 */
export function createRoomAtPoint(ptMm: Pt): RoomCreateResult {
  const em = useEditorModeStore.getState();
  const isMm = (em.sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001; // mm → world
  const walls = useWallStore.getState().walls || [];
  // GLB 躯体の当たり判定。レジストリ（baseColliders）が基本だが、躯体編集ビューでは
  // 登録レースで空のことがある（既知の課題）ため、シーンの躯体ルートへフォールバックする。
  //   baseRoot ごとレイキャストしても、床/屋根は水平面（水平レイと平行）なので誤ヒットしない。
  const registry = useSceneObjectRegistryStore.getState().baseColliders || [];
  const baseColliders = registry.length
    ? registry
    : (layoutSceneRef.baseRoot ? [layoutSceneRef.baseRoot] : []);

  // 建物範囲（world）→ mm。寸法列と同じ計測（壁＋GLB）。
  const b = measureXZBounds(baseColliders, walls, (mm) => mm * k);
  if (!b) return { ok: false, message: "建物が見つかりません（壁か躯体が必要です）" };
  const minXmm = b.minX / k - CELL_MM * MARGIN_CELLS;
  const minZmm = b.minZ / k - CELL_MM * MARGIN_CELLS;
  const nx = Math.ceil((b.maxX / k - minXmm) / CELL_MM) + MARGIN_CELLS;
  const nz = Math.ceil((b.maxZ / k - minZmm) / CELL_MM) + MARGIN_CELLS;
  if (nx * nz > MAX_CELLS) return { ok: false, message: "範囲が広すぎて検出できません" };

  const cellCenter = (i: number, j: number): Pt => ({
    x: minXmm + (i + 0.5) * CELL_MM,
    z: minZmm + (j + 0.5) * CELL_MM,
  });

  // ── 作図壁: セル中心が「芯±(厚/2 + セル半分強)」の帯に入ったら塞ぐ ──
  //   +80mm はグリッドの粗さの吸収。セル間隔150mmに対して帯の半幅が
  //   (t/2 + 80) ≥ 130mm あれば、帯をまたぐ隣接セル列のどちらかが必ず帯内に入る。
  const wallBand = (p: Pt): boolean => {
    for (const w of walls) {
      const half = ((w.thicknessMm || 100) / 2) + 80;
      if (distToSegment(p, w.start, w.end) <= half) return true;
    }
    return false;
  };
  const bandCache = new Map<number, boolean>();
  const isBanded = (i: number, j: number): boolean => {
    const key = j * nx + i;
    let v = bandCache.get(key);
    if (v === undefined) {
      v = wallBand(cellCenter(i, j));
      bandCache.set(key, v);
    }
    return v;
  };

  // ── GLB 躯体: 隣接セル間の水平レイで壁面を探す ──
  const spec = useBuildingSpecStore.getState();
  const fi = spec.activeFloorIndex || 0;
  const flMm = (spec.fl0Mm || 0) + (spec.floors?.[fi]?.flMm || 0);
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const glbEdgeBlocked = (a: Pt, c: Pt): boolean => {
    if (!baseColliders.length) return false;
    const dist = Math.hypot(c.x - a.x, c.z - a.z) * k;
    for (const hMm of GLB_TEST_HEIGHTS_MM) {
      origin.set(a.x * k, (flMm + hMm) * k, a.z * k);
      dir.set((c.x - a.x) * k, 0, (c.z - a.z) * k).normalize();
      ray.set(origin, dir);
      ray.far = dist;
      if (ray.intersectObjects(baseColliders, true).length > 0) return true;
    }
    return false;
  };

  // ── フラッドフィル（4近傍）──
  const sx = Math.floor((ptMm.x - minXmm) / CELL_MM);
  const sz = Math.floor((ptMm.z - minZmm) / CELL_MM);
  if (sx < 0 || sz < 0 || sx >= nx || sz >= nz) {
    return { ok: false, message: "建物の範囲外です" };
  }
  // クリックが壁の上だったら周囲の空きセルから始める
  let start: [number, number] | null = null;
  if (!isBanded(sx, sz)) start = [sx, sz];
  else {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const i = sx + di, j = sz + dj;
      if (i >= 0 && j >= 0 && i < nx && j < nz && !isBanded(i, j)) { start = [i, j]; break; }
    }
  }
  if (!start) return { ok: false, message: "壁の上です。部屋の内側をクリックしてください" };

  const visited = new Set<number>();
  const queue: [number, number][] = [start];
  visited.add(start[1] * nx + start[0]);
  let minI = start[0], maxI = start[0], minJ = start[1], maxJ = start[1];

  while (queue.length) {
    const [i, j] = queue.pop() as [number, number];
    // 探索グリッドの縁に到達 ＝ 囲われていない（屋外へ漏れた）
    if (i === 0 || j === 0 || i === nx - 1 || j === nz - 1) {
      return { ok: false, message: "壁で囲われていない範囲です（外に漏れました）" };
    }
    if (i < minI) minI = i;
    if (i > maxI) maxI = i;
    if (j < minJ) minJ = j;
    if (j > maxJ) maxJ = j;
    const here = cellCenter(i, j);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
      const key = nj * nx + ni;
      if (visited.has(key)) continue;
      if (isBanded(ni, nj)) continue;                    // 作図壁の帯
      if (glbEdgeBlocked(here, cellCenter(ni, nj))) continue; // GLB 壁面
      visited.add(key);
      queue.push([ni, nj]);
    }
  }

  // ── 検出範囲に「内接する最大の軸平行矩形」→ Room＋Zone ──
  //   bbox にすると、対角壁や L 字で区切られた部屋のゾーンが隣の部屋まで覆ってしまい、
  //   隣をクリックしても「すでに部屋がある」扱いで分けられなくなる。ゾーンは矩形しか
  //   持てないので、領域からはみ出さない範囲でいちばん大きい矩形を採る
  //   （矩形の部屋なら bbox と一致する）。ヒストグラム法 O(W×H)。
  const W = maxI - minI + 1;
  const heights = new Int32Array(W);
  let best = { area: 0, i0: start[0], i1: start[0], j0: start[1], j1: start[1] };
  for (let j = minJ; j <= maxJ; j++) {
    for (let i = 0; i < W; i++) {
      heights[i] = visited.has(j * nx + (minI + i)) ? heights[i] + 1 : 0;
    }
    // 各行を底辺とみなし、ヒストグラム最大長方形をスタックで求める（i=W は高さ0の番兵）
    const stack: number[] = [];
    for (let i = 0; i <= W; i++) {
      const h = i < W ? heights[i] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= h) {
        const top = stack.pop() as number;
        const height = heights[top];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const width = i - left;
        if (height * width > best.area) {
          best = {
            area: height * width,
            i0: minI + left, i1: minI + i - 1,
            j0: j - height + 1, j1: j,
          };
        }
      }
      stack.push(i);
    }
  }
  if (!best.area) return { ok: false, message: "範囲を検出できませんでした" };

  return createRoomFromRectMm({
    minX: minXmm + best.i0 * CELL_MM,
    maxX: minXmm + (best.i1 + 1) * CELL_MM,
    minZ: minZmm + best.j0 * CELL_MM,
    maxZ: minZmm + (best.j1 + 1) * CELL_MM,
  });
}

/** bbox(mm) から Room＋Zone を作る。既にその中心を含むゾーンがあれば作らない。 */
export function createRoomFromRectMm(r: { minX: number; maxX: number; minZ: number; maxZ: number }): RoomCreateResult {
  const isMm = (useEditorModeStore.getState().sceneMaxY || 0) > 100;
  const k = isMm ? 1 : 0.001;
  const cx = ((r.minX + r.maxX) / 2) * k;
  const cz = ((r.minZ + r.maxZ) / 2) * k;
  const width = (r.maxX - r.minX) * k;
  const depth = (r.maxZ - r.minZ) * k;
  if (!(width > 0) || !(depth > 0)) return { ok: false, message: "範囲を検出できませんでした" };

  const st = useLayoutTaskStore.getState();
  // 作成した部屋・ゾーンは「今アクティブな階」に属す（壁・床と同じ規約）。
  const floorIndex = useBuildingSpecStore.getState().activeFloorIndex || 0;
  // 二重作成の判定は同じ階のゾーンだけを見る（別の階なら同じ位置でも作ってよい）。
  const covered = (st.zones || []).some((z: any) => {
    if ((z.floorIndex || 0) !== floorIndex) return false;
    const zr = z?.rect;
    if (!zr) return false;
    return (
      Math.abs(cx - zr.x) <= (zr.width || 0) / 2 &&
      Math.abs(cz - zr.z) <= (zr.depth || 0) / 2
    );
  });
  if (covered) return { ok: false, message: "この階のここには、すでに部屋（ゾーン）があります" };

  const name = nextRoomName(st.rooms || []);
  const roomId = `room-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

  const rooms = [...(st.rooms || []), { id: roomId, name, floorIndex, createdAtMs: Date.now() }];
  window.dispatchEvent(new CustomEvent("LayoutShell:UpdateRooms", { detail: { rooms } }));

  window.dispatchEvent(new CustomEvent("LayoutShell:AddZone", {
    detail: {
      id: `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      roomId,
      name,
      targetSeats: 0,
      category: null,
      color: "rgb(var(--brand-fg-rgb) / 0.65)",
      rect: { x: cx, z: cz, width, depth },
      floorIndex,
      createdBy: "user",
      createdAtMs: Date.now(),
    },
  }));

  return { ok: true, name };
}
