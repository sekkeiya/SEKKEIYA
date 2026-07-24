// drawSnap — 壁・床を作図するときの吸着（スナップ）を1か所にまとめる。
//   壁ツールと床ツールで挙動が食い違わないよう、両方からこれを呼ぶ。
//
//   優先順位（CAD の作法どおり「点 → 線 → グリッド」）:
//     1. 点   … 既存の壁の端点 / 床の頂点 / 通り芯の交点
//     2. 直交 … 始点からの水平・垂直へ寄せる（Alt で解除）
//     3. 線   … 壁芯・床の辺の上／通り芯の線（X・Z を別々に吸着）
//     4. 素   … 50mm グリッド丸め
//   点は「そこを狙ってクリックしている」ので直交より優先する。
import { useWallStore } from "../store/useWallStore";
import { useSlabStore } from "../store/useSlabStore";
import { useGridAxisStore } from "../store/useGridAxisStore";
import { useEditorModeStore } from "../store/useEditorModeStore";

/** グリッド刻み(mm)の下限フォールバック（設定が無い/0 のとき）。 */
export const DRAW_GRID_MM = 50;

/**
 * Shift スナップ時のグリッド刻み。表示中の床グリッド（gridCellSizeMm=910/1000 など）に合わせて
 * 丸める。SceneGrid はワールド原点中心・セル整数枚で敷くので、原点基準の丸めで格子線に一致する。
 * 設定が無い/不正なときだけ従来の 50mm へフォールバック。壁・床・ゾーンなど全スナップで共通。
 */
export const gridSnap = (v: number): number => {
  const g = useEditorModeStore.getState().gridCellSizeMm;
  const step = g && g > 0 ? g : DRAW_GRID_MM;
  return Math.round(v / step) * step;
};
/** 点（端点・交点）への吸着距離(mm)。 */
const PT_TOL_MM = 250;
/** 線（通り芯・壁芯・床の辺）への吸着距離(mm)。 */
const LINE_TOL_MM = 200;
/** 直交とみなす角度の許容（rad ≒ 16°）。 */
const ORTHO_TOL = 0.28;

export interface Pt { x: number; z: number }

/** 何に吸着したか。作図中のヒント表示に使う。 */
export type SnapKind = null | "point" | "axisCross" | "axis" | "wall" | "slabEdge";

export interface DrawSnapResult extends Pt {
  kind: SnapKind;
  /** 「通り芯 X1」などの短いラベル。null = グリッドのみ。 */
  label: string | null;
}

// 通常の吸着フォールバック＝表示中の床グリッド（gridCellSizeMm）へ丸める。
const grid = (v: number) => gridSnap(v);
// Alt（吸着解除）時の微調整用の細かい丸め。粗い床グリッドに乗せず、ほぼ自由に置ける。
const gridFine = (v: number) => Math.round(v / DRAW_GRID_MM) * DRAW_GRID_MM;

/** 始点からの直交スナップ（水平／垂直へ寄せる）。 */
export function applyOrtho(anchor: Pt, p: Pt): Pt {
  const dx = p.x - anchor.x;
  const dz = p.z - anchor.z;
  if (dx === 0 && dz === 0) return p;
  const ang = Math.atan2(Math.abs(dz), Math.abs(dx));
  if (ang < ORTHO_TOL) return { x: p.x, z: anchor.z };               // 水平
  if (ang > Math.PI / 2 - ORTHO_TOL) return { x: anchor.x, z: p.z };  // 垂直
  return p;
}

/** 線分 a→b 上で p にいちばん近い点（端点でクランプ）。 */
function closestOnSegment(p: Pt, a: Pt, b: Pt): { pt: Pt; d: number } | null {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const len2 = ex * ex + ez * ez;
  if (len2 < 1) return null;
  let t = ((p.x - a.x) * ex + (p.z - a.z) * ez) / len2;
  t = Math.max(0, Math.min(1, t));
  const pt = { x: a.x + ex * t, z: a.z + ez * t };
  return { pt, d: Math.hypot(pt.x - p.x, pt.z - p.z) };
}

/** 吸着候補から外すもの。既存要素の「編集」で使う（自分自身に吸い付いて固まるのを防ぐ）。 */
export interface DrawSnapExclude {
  /** 壁 id。その壁の壁芯（線）を候補から外す。 */
  wallIds?: Set<string>;
  /** `${wallId}:start` / `${wallId}:end`。その端点を候補から外す。 */
  wallEnds?: Set<string>;
  /** 床 id。その床の辺と頂点を候補から外す。 */
  slabIds?: Set<string>;
}

/**
 * 作図中の点を吸着させる。
 * @param raw     カーソル位置（world mm / XZ）
 * @param anchor  直前に確定した点。null なら直交スナップは効かない。
 * @param free    true = 吸着を切る（Alt 押下中）。グリッド丸めだけ行う。
 * @param exclude 候補から外す要素。新規作図では不要。既存の頂点を動かすときに、
 *                動いている当人（と連結点）を渡す。渡さないと自分自身に吸着して動かなくなる。
 */
export function resolveDrawSnap(
  raw: Pt,
  anchor: Pt | null = null,
  free = false,
  exclude: DrawSnapExclude | null = null,
): DrawSnapResult {
  if (free) return { x: gridFine(raw.x), z: gridFine(raw.z), kind: null, label: null };

  const exWallIds = exclude?.wallIds;
  const exWallEnds = exclude?.wallEnds;
  const exSlabIds = exclude?.slabIds;
  // 壁は「線（壁芯）を外す」と「端点を外す」で粒度が違うので、ここでは絞らず各ループで判定する。
  const walls = useWallStore.getState().walls || [];
  const slabs = (useSlabStore.getState().slabs || []).filter((s) => !exSlabIds?.has(s.id));
  const axes = useGridAxisStore.getState().axes || [];
  const axesX = axes.filter((a) => a.axis === "x");
  const axesZ = axes.filter((a) => a.axis === "z");

  // ── 1) 点: 壁端点・床頂点・通り芯の交点 ─────────────────────────
  let bestPt: { pt: Pt; d: number; label: string } | null = null;
  const considerPt = (pt: Pt, label: string) => {
    const d = Math.hypot(pt.x - raw.x, pt.z - raw.z);
    if (d <= PT_TOL_MM && (!bestPt || d < bestPt.d)) bestPt = { pt, d, label };
  };
  for (const w of walls) {
    if (!exWallEnds?.has(`${w.id}:start`)) considerPt(w.start, "壁の端点");
    if (!exWallEnds?.has(`${w.id}:end`)) considerPt(w.end, "壁の端点");
  }
  for (const s of slabs) for (const p of s.points || []) considerPt(p, "床の頂点");
  // 通り芯の交点（X通り × Y通り）
  for (const ax of axesX) {
    for (const az of axesZ) considerPt({ x: ax.pos, z: az.pos }, `通り芯 ${ax.name}・${az.name}`);
  }
  if (bestPt) {
    const b = bestPt as { pt: Pt; d: number; label: string };
    const isCross = b.label.startsWith("通り芯");
    return { x: Math.round(b.pt.x), z: Math.round(b.pt.z), kind: isCross ? "axisCross" : "point", label: b.label };
  }

  // ── 2) 直交（Alt で解除済みなら free で抜けている） ────────────────
  const q = anchor ? applyOrtho(anchor, raw) : raw;

  // ── 3) 線: 壁芯・床の辺 / 通り芯 ────────────────────────────────
  let bestSeg: { pt: Pt; d: number; kind: SnapKind; label: string } | null = null;
  const considerSeg = (a: Pt, b: Pt, kind: SnapKind, label: string) => {
    const r = closestOnSegment(q, a, b);
    if (!r || r.d > LINE_TOL_MM) return;
    if (!bestSeg || r.d < bestSeg.d) bestSeg = { pt: r.pt, d: r.d, kind, label };
  };
  for (const w of walls) {
    if (exWallIds?.has(w.id)) continue; // 編集中の壁の壁芯は「今まさに動いている線」なので候補外
    considerSeg(w.start, w.end, "wall", "壁芯");
  }
  for (const s of slabs) {
    const pts = s.points || [];
    for (let i = 0; i < pts.length; i++) considerSeg(pts[i], pts[(i + 1) % pts.length], "slabEdge", "床の辺");
  }

  // 通り芯は「軸ごと」に効かせる（X だけ／Z だけの吸着ができる）。
  let ax: { pos: number; d: number; name: string } | null = null;
  for (const a of axesX) {
    const d = Math.abs(a.pos - q.x);
    if (d <= LINE_TOL_MM && (!ax || d < ax.d)) ax = { pos: a.pos, d, name: a.name };
  }
  let az: { pos: number; d: number; name: string } | null = null;
  for (const a of axesZ) {
    const d = Math.abs(a.pos - q.z);
    if (d <= LINE_TOL_MM && (!az || d < az.d)) az = { pos: a.pos, d, name: a.name };
  }
  const axisD = Math.min(ax ? ax.d : Infinity, az ? az.d : Infinity);

  // 壁芯・床の辺のほうが近ければ、その線の上に乗せる。
  if (bestSeg && (bestSeg as { d: number }).d <= axisD) {
    const b = bestSeg as { pt: Pt; kind: SnapKind; label: string };
    return { x: Math.round(b.pt.x), z: Math.round(b.pt.z), kind: b.kind, label: b.label };
  }

  if (ax || az) {
    const names = [ax?.name, az?.name].filter(Boolean).join("・");
    return {
      x: ax ? Math.round(ax.pos) : grid(q.x),
      z: az ? Math.round(az.pos) : grid(q.z),
      kind: "axis",
      label: `通り芯 ${names}`,
    };
  }

  // ── 4) グリッド ───────────────────────────────────────────────
  return { x: grid(q.x), z: grid(q.z), kind: null, label: null };
}

// ── ゾーン(部屋)ドラッグ用スナップ ───────────────────────────────
//   部屋(ゾーン)の移動/リサイズで Shift 押下中だけ効かせる吸着。作図と同じ
//   resolveDrawSnap（端点・通り芯・壁芯・床辺・グリッド）を土台にする。

export interface ZoneRect { x: number; z: number; width: number; depth: number }

/** 1座標(X)を通り芯/壁/端点/グリッドへ吸着（リサイズの辺スナップ用）。 */
export function snapZoneCoordX(x: number, zRef: number): number {
  return resolveDrawSnap({ x, z: zRef }).x;
}
/** 1座標(Z)を通り芯/壁/端点/グリッドへ吸着（リサイズの辺スナップ用）。 */
export function snapZoneCoordZ(z: number, xRef: number): number {
  return resolveDrawSnap({ x: xRef, z }).z;
}

/**
 * ゾーン矩形の移動スナップ。サイズは変えず、矩形の左右/上下の辺を通り芯・壁・
 * 端点・グリッドへ寄せるための平行移動量 (dx, dz) を返す。
 *   軸ごと（X と Z を独立に）に「実ガイド(通り芯/壁/端点) > グリッド」の優先で
 *   いちばん近い辺を選んで寄せる。どの辺も実ガイドに届かなければグリッド丸め。
 */
export function snapZoneRectMove(rect: ZoneRect): { dx: number; dz: number } {
  const leftX = rect.x - rect.width / 2;
  const rightX = rect.x + rect.width / 2;
  const topZ = rect.z - rect.depth / 2;
  const botZ = rect.z + rect.depth / 2;

  // coord 軸について、候補となる各辺 v を吸着し、いちばん良い寄せ量を返す。
  const pick = (cands: number[], axis: "x" | "z", ref: number): number => {
    let best: { off: number; prio: number; mag: number } | null = null;
    for (const v of cands) {
      const s = axis === "x" ? resolveDrawSnap({ x: v, z: ref }) : resolveDrawSnap({ x: ref, z: v });
      const sv = axis === "x" ? s.x : s.z;
      const off = sv - v;
      const real = s.kind !== null;      // 通り芯/壁/端点/床辺に吸着した
      const prio = real ? 2 : 1;         // 実ガイド優先、無ければグリッド
      const mag = Math.abs(off);
      // すでにグリッドに乗っている辺（寄せ量ゼロ）は、反対の辺の実スナップを潰さないよう捨てる
      if (!real && mag < 0.5) continue;
      if (!best || prio > best.prio || (prio === best.prio && mag < best.mag)) best = { off, prio, mag };
    }
    return best ? best.off : 0;
  };

  return {
    dx: pick([leftX, rightX], "x", rect.z),
    dz: pick([topZ, botZ], "z", rect.x),
  };
}
