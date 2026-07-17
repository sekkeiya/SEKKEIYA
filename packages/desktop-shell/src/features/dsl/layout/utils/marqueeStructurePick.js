// marqueeStructurePick — 範囲選択（マーキー）で作図した壁・床（スラブ）を拾う
// スクリーン空間ヒットテスト。
//
// 家具マーキー（useMarqueeSelection）はオブジェクト中心点の内包判定だが、
// 壁は細長く床は大きいため中心点だけでは取りこぼす。そこで
//   - 壁   : 壁芯線分（下端・上端）と矩形の交差
//   - スラブ: 多角形の頂点内包／辺交差／矩形中心の多角形内包（矩形がスラブ内側に収まるケース）
// で判定する。座標は store 上は world mm / XZ 平面。レンダラー
// （WallsRenderer / FloorSlabsRenderer）と同じ規約で world へ変換する:
//   k = sceneMaxY > 100 ? 1 : 0.001（mm ベース GLB なら 1、m ベースなら 0.001）
//   y = アクティブ階の FL（fl0Mm + floors[i].flMm）
import * as THREE from "three";
import { useWallStore } from "../store/useWallStore";
import { useSlabStore } from "../store/useSlabStore";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useBuildingSpecStore } from "../store/useBuildingSpecStore";

const _v = new THREE.Vector3();

/** world 座標 → スクリーン px。視錐台の奥行き外（背面等）は null。 */
function projectToScreen(x, y, z, camera, width, height) {
  _v.set(x, y, z).project(camera);
  if (_v.z < -1 || _v.z > 1) return null;
  return { x: ((_v.x + 1) / 2) * width, y: ((1 - _v.y) / 2) * height };
}

function pointInRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** 2D 線分 ab × cd の交差（端点接触含む）。 */
function segmentsIntersect(a, b, c, d) {
  const orient = (p, q, s) => {
    const v = (q.y - p.y) * (s.x - q.x) - (q.x - p.x) * (s.y - q.y);
    if (v > 0) return 1;
    if (v < 0) return -1;
    return 0;
  };
  const onSeg = (p, q, s) =>
    Math.min(p.x, q.x) <= s.x && s.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= s.y && s.y <= Math.max(p.y, q.y);

  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSeg(a, b, c)) return true;
  if (o2 === 0 && onSeg(a, b, d)) return true;
  if (o3 === 0 && onSeg(c, d, a)) return true;
  if (o4 === 0 && onSeg(c, d, b)) return true;
  return false;
}

/** 線分 ab が矩形と交差（端点内包含む）するか。 */
function segmentIntersectsRect(a, b, r) {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const tl = { x: r.x, y: r.y };
  const tr = { x: r.x + r.w, y: r.y };
  const br = { x: r.x + r.w, y: r.y + r.h };
  const bl = { x: r.x, y: r.y + r.h };
  return (
    segmentsIntersect(a, b, tl, tr) ||
    segmentsIntersect(a, b, tr, br) ||
    segmentsIntersect(a, b, br, bl) ||
    segmentsIntersect(a, b, bl, tl)
  );
}

/** 点の多角形内包（ray casting）。 */
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y)) {
      const x = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
      if (p.x < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * マーキー矩形に掛かる壁・スラブの id を返す。
 * @param {{rect:{x,y,w,h}, camera:THREE.Camera, width:number, height:number}} ctx
 * @returns {{wallIds:string[], slabIds:string[]}}
 */
export function pickStructureInRect(ctx) {
  const { rect, camera, width, height } = ctx || {};
  if (!rect || !camera || !width || !height) return { wallIds: [], slabIds: [] };

  const k = (useEditorModeStore.getState().sceneMaxY || 0) > 100 ? 1 : 0.001;
  const spec = useBuildingSpecStore.getState();
  const fi = Math.max(0, Math.min(spec.activeFloorIndex || 0, (spec.floors?.length || 1) - 1));
  const y0 = ((spec.fl0Mm || 0) + (spec.floors?.[fi]?.flMm || 0)) * k;

  const wallIds = [];
  for (const w of useWallStore.getState().walls) {
    const hMm = w.heightMm ?? spec.floorHeightMm ?? 2400;
    const yTop = y0 + hMm * k;
    // 壁芯の下端・上端の 2 線分で判定（Top ビューでは同一線に潰れる）
    let hit = false;
    for (const y of [y0, yTop]) {
      const a = projectToScreen(w.start.x * k, y, w.start.z * k, camera, width, height);
      const b = projectToScreen(w.end.x * k, y, w.end.z * k, camera, width, height);
      if (a && b && segmentIntersectsRect(a, b, rect)) { hit = true; break; }
    }
    if (hit) wallIds.push(w.id);
  }

  const slabIds = [];
  const rectCenter = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  for (const s of useSlabStore.getState().slabs) {
    if (!s.points || s.points.length < 3) continue;
    const poly = [];
    for (const p of s.points) {
      const sp = projectToScreen(p.x * k, y0, p.z * k, camera, width, height);
      if (sp) poly.push(sp);
    }
    if (poly.length < 3) continue;
    let hit = false;
    for (let i = 0; i < poly.length && !hit; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (segmentIntersectsRect(a, b, rect)) hit = true;
    }
    // 矩形がスラブ内側に完全に収まっている（辺と交差しない）ケース
    if (!hit && pointInPolygon(rectCenter, poly)) hit = true;
    if (hit) slabIds.push(s.id);
  }

  return { wallIds, slabIds };
}
