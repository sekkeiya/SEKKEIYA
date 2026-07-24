// 軸平行矩形の集合を「直線多角形（rectilinear polygon）」として扱うための幾何ユーティリティ。
// - unionRing: 矩形群の和集合の外周リング（角＝頂点）を求める
// - polygonToRects: 直線多角形を重なりのない矩形列へ分解する（3Dオーバーレイ/保存用）
// - dragVertex: 外周の1頂点を動かして直線性を保ったまま新しいリングを返す

import type { FinishRegion } from "../store/useSurfaceFinishStore";

export interface Pt { u: number; v: number; }

const R = (n: number) => Math.round(n * 1000) / 1000; // 量子化（突き合わせ用）
const keyOf = (p: Pt) => `${R(p.u)}|${R(p.v)}`;
const uniqSorted = (vals: number[]) => Array.from(new Set(vals.map(R))).sort((a, b) => a - b);

/** シューレース面積（符号付き）。 */
function ringArea(ring: Pt[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p.u * q.v - q.u * p.v;
  }
  return a / 2;
}

/** 連続する共線点を取り除く（直線多角形なので u か v が連続一致する中間点を削除）。 */
function simplify(ring: Pt[]): Pt[] {
  if (ring.length < 3) return ring;
  const out: Pt[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[(i - 1 + n) % n], b = ring[i], c = ring[(i + 1) % n];
    const colU = Math.abs(R(a.u) - R(b.u)) < 1e-6 && Math.abs(R(b.u) - R(c.u)) < 1e-6;
    const colV = Math.abs(R(a.v) - R(b.v)) < 1e-6 && Math.abs(R(b.v) - R(c.v)) < 1e-6;
    if (colU || colV) continue; // 中間点は不要
    out.push({ u: b.u, v: b.v });
  }
  return out;
}

/** 点 (cx,cy) がリング内部か（レイキャスト）。境界はわずかに内側判定。 */
function pointInRing(ring: Pt[], cx: number, cy: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const pi = ring[i], pj = ring[j];
    const intersect = (pi.v > cy) !== (pj.v > cy) &&
      cx < ((pj.u - pi.u) * (cy - pi.v)) / (pj.v - pi.v) + pi.u;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 矩形群の和集合の外周リング（最大面積の輪を外周として返す）。 */
export function unionRing(rects: FinishRegion[]): Pt[] {
  if (!rects.length) return [];
  if (rects.length === 1) {
    const r = rects[0];
    return [{ u: r.u0, v: r.v0 }, { u: r.u1, v: r.v0 }, { u: r.u1, v: r.v1 }, { u: r.u0, v: r.v1 }];
  }
  const xs = uniqSorted(rects.flatMap((r) => [r.u0, r.u1]));
  const ys = uniqSorted(rects.flatMap((r) => [r.v0, r.v1]));
  const nx = xs.length - 1, ny = ys.length - 1;
  const filled = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return false;
    const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
    return rects.some((r) => cx >= r.u0 && cx <= r.u1 && cy >= r.v0 && cy <= r.v1);
  };

  // 充填セルを左側にする向きの有向境界エッジを作る。
  type E = { a: Pt; b: Pt; used?: boolean };
  const edges: E[] = [];
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j < ny; j++) {
      const L = filled(i - 1, j), Rr = filled(i, j);
      if (L === Rr) continue;
      const p0 = { u: xs[i], v: ys[j] }, p1 = { u: xs[i], v: ys[j + 1] };
      if (Rr && !L) edges.push({ a: p1, b: p0 }); // 右が充填 → 下向き（左に充填）
      else edges.push({ a: p0, b: p1 });          // 左が充填 → 上向き
    }
  }
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i < nx; i++) {
      const B = filled(i, j - 1), A = filled(i, j);
      if (A === B) continue;
      const p0 = { u: xs[i], v: ys[j] }, p1 = { u: xs[i + 1], v: ys[j] };
      if (A && !B) edges.push({ a: p0, b: p1 }); // 上が充填 → +u
      else edges.push({ a: p1, b: p0 });          // 下が充填 → -u
    }
  }

  const startMap = new Map<string, E[]>();
  edges.forEach((e) => {
    const k = keyOf(e.a);
    if (!startMap.has(k)) startMap.set(k, []);
    startMap.get(k)!.push(e);
  });

  const rings: Pt[][] = [];
  for (const e0 of edges) {
    if (e0.used) continue;
    const ring: Pt[] = [];
    let e: E | undefined = e0;
    let guard = 0;
    while (e && !e.used && guard++ < edges.length + 4) {
      e.used = true;
      ring.push(e.a);
      const cand = startMap.get(keyOf(e.b)) || [];
      e = cand.find((c) => !c.used);
    }
    if (ring.length >= 4) rings.push(simplify(ring));
  }
  if (!rings.length) return [];
  rings.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)));
  return rings[0];
}

/** 矩形群を「重なりのない列ストリップ矩形」へ正規化（外形は保ったまま重複を解消）。 */
export function normalizeRects(rects: FinishRegion[]): FinishRegion[] {
  return polygonToRects(unionRing(rects));
}

/** 直線多角形（リング）を重なりのない矩形へ分解する。 */
export function polygonToRects(ring: Pt[]): FinishRegion[] {
  if (ring.length < 4) return [];
  const xs = uniqSorted(ring.map((p) => p.u));
  const ys = uniqSorted(ring.map((p) => p.v));
  const nx = xs.length - 1, ny = ys.length - 1;
  // 列ごとに充填セルの連続 run を矩形化
  const out: FinishRegion[] = [];
  for (let i = 0; i < nx; i++) {
    let j = 0;
    while (j < ny) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (!pointInRing(ring, cx, cy)) { j++; continue; }
      let j2 = j;
      while (j2 < ny && pointInRing(ring, cx, (ys[j2] + ys[j2 + 1]) / 2)) j2++;
      out.push({ u0: xs[i], u1: xs[i + 1], v0: ys[j], v1: ys[j2] });
      j = j2;
    }
  }
  // 隣接列で v 範囲が一致するものを横方向に結合して矩形数を減らす
  return mergeHoriz(out);
}

function mergeHoriz(rects: FinishRegion[]): FinishRegion[] {
  const res = rects.map((r) => ({ ...r }));
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < res.length; i++) {
      for (let k = i + 1; k < res.length; k++) {
        const a = res[i], b = res[k];
        if (Math.abs(R(a.v0) - R(b.v0)) < 1e-6 && Math.abs(R(a.v1) - R(b.v1)) < 1e-6) {
          if (Math.abs(R(a.u1) - R(b.u0)) < 1e-6) { a.u1 = b.u1; res.splice(k, 1); changed = true; break outer; }
          if (Math.abs(R(b.u1) - R(a.u0)) < 1e-6) { a.u0 = b.u0; res.splice(k, 1); changed = true; break outer; }
        }
      }
    }
  }
  return res;
}

/** 辺 i（頂点 i と i+1 を結ぶ）を平行移動した新しいリングを返す。
 *  水平辺なら v を、垂直辺なら u を両端点とも揃える。 */
export function dragEdge(ring: Pt[], i: number, u: number, v: number): Pt[] {
  const n = ring.length;
  if (n < 4) return ring;
  const out = ring.map((p) => ({ ...p }));
  const a = i, b = (i + 1) % n;
  const horizontal = Math.abs(R(ring[a].v) - R(ring[b].v)) < Math.abs(R(ring[a].u) - R(ring[b].u));
  if (horizontal) { out[a].v = v; out[b].v = v; }
  else { out[a].u = u; out[b].u = u; }
  return out;
}

/** 辺 i が水平か（中点ハンドルのカーソル・スナップ軸の判定用）。 */
export function edgeIsHorizontal(ring: Pt[], i: number): boolean {
  const a = ring[i], b = ring[(i + 1) % ring.length];
  return Math.abs(R(a.v) - R(b.v)) < Math.abs(R(a.u) - R(b.u));
}

/** リングの頂点 i を (u,v) へ動かし、直線性を保った新しいリングを返す。 */
export function dragVertex(ring: Pt[], i: number, u: number, v: number): Pt[] {
  const n = ring.length;
  if (n < 4) return ring;
  const out = ring.map((p) => ({ ...p }));
  const prev = (i - 1 + n) % n, next = (i + 1) % n;
  const oPrev = ring[prev], o = ring[i];
  out[i].u = u; out[i].v = v;
  // prev–i 辺が垂直（u共有）か水平（v共有）かで、隣接頂点の共有座標を更新する
  if (Math.abs(R(oPrev.u) - R(o.u)) < Math.abs(R(oPrev.v) - R(o.v))) {
    out[prev].u = u;  // prev–i 垂直 → prev は u を共有
    out[next].v = v;  // i–next 水平 → next は v を共有
  } else {
    out[prev].v = v;
    out[next].u = u;
  }
  return out;
}
