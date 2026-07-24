// FacePickController — Material モードで躯体（床/壁/天井）の面をクリック選択する。
//
// MaterialPickController と違い、対象は baseColliders のみ。クリックとドラッグ（オービット）を
// pointerdown→pointerup の移動量で区別し、クリックのみ raycast して面を選択する
// （pointerdown を止めないので OrbitControls の回転は阻害しない）。

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { firstVisibleHit } from "../../../utils/sectionClipPick";
import {
  useMaterialFaceStore,
  classifySurface,
} from "../../../store/useMaterialFaceStore";
import { useBuildingSpecStore } from "../../../store/useBuildingSpecStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { measureBaseInterior } from "../../../utils/baseFootprint";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";

const CLICK_MOVE_THRESHOLD = 5; // px。これ以上動いたらドラッグ（=オービット）とみなす

/**
 * 内側を向いた壁面の縦範囲を「床上端〜天井下端」に切り詰めた SurfaceRect を返す。
 * 躯体の壁メッシュは床スラブ下端から天井上まで立っているため、そのままだと展開図
 * サイドバーの高さ・面積・貼り付け範囲が室内の見え（下は床厚に被り、上は天井際が抜ける）
 * と食い違う。
 * 上下端は壁ぎわの室内点から上下レイキャストで「実際の床上端／天井下端」を実測する
 * （CL 設定値と躯体がずれていても見た目に一致する）。測れないときだけ buildingSpec の
 * 階レベル（fl0Mm + floors[].flMm）と ceilingHeightMm にフォールバック。
 * 外側を向いた面（外壁の外側）は外装として全高が正しいので触らない。
 * 床/天井・鉛直でない面・クランプ不要の面はそのまま返す。
 * ※中心は v 軸に沿って移動するだけなので平面オフセット n·c は不変＝surfaceKeyOf は変わらない。
 */
export function clampWallSurfaceToCeiling(surface) {
  if (!surface) return surface;
  const [nx, ny, nz] = surface.normal;
  if (Math.abs(ny) > 0.5) return surface; // 壁のみ対象
  const vy = surface.vAxis?.[1] ?? 0;
  if (Math.abs(vy) < 0.9) return surface; // v軸が鉛直でない特殊面は対象外

  const isMm = ((useEditorModeStore.getState().sceneMaxY) || 0) > 100;
  const toWorld = (mm) => (isMm ? mm : mm / 1000);
  const bs = useBuildingSpecStore.getState();
  const clHeight = toWorld(bs.ceilingHeightMm || 2400);
  const tol = toWorld(10);

  const half = surface.height / 2;
  const topY = surface.center[1] + half * Math.abs(vy);
  const botY = surface.center[1] - half * Math.abs(vy);

  // 法線の先が内法（実測の部屋範囲）に入る面＝内装面のみクランプ。
  // 外壁の外側面は法線先が内法の外に出るので全高のまま。内法が測れない場合も安全側で触らない。
  const interior = measureBaseInterior();
  if (!interior) return surface;
  const step = toWorld(200);
  const px = surface.center[0] + nx * step;
  const pz = surface.center[2] + nz * step;
  const facesInside =
    px >= interior.minX - tol && px <= interior.maxX + tol &&
    pz >= interior.minZ - tol && pz <= interior.maxZ + tol;
  if (!facesInside) return surface;

  // ── 上下端を実測: 壁ぎわ室内点(px, midY, pz)から上下へレイ ─────────────
  // 下向き＝上を向いた面（床上端）/ 上向き＝下を向いた面（天井下端）。
  // baseColliders は躯体のみなので家具には当たらない。
  const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
  const midY = (topY + botY) / 2;
  const rayHitY = (dirY, wantUpFace) => {
    if (!colliders.length) return null;
    const ray = new THREE.Raycaster(new THREE.Vector3(px, midY, pz), new THREE.Vector3(0, dirY, 0));
    for (const h of ray.intersectObjects(colliders, true)) {
      const nyW = h.face?.normal ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y : 0;
      if (wantUpFace ? nyW > 0.5 : nyW < -0.5) return h.point.y;
    }
    return null;
  };

  // FL（下端）: 実測の床上端。妥当範囲（壁下端-10mm〜+1.5m）を外れたら spec の階レベルへ。
  let flY = rayHitY(-1, true);
  if (flY == null || flY < botY - tol || flY > botY + toWorld(1500)) {
    const flCandidates = [toWorld(bs.fl0Mm || 0)];
    (bs.floors || []).forEach((f) => flCandidates.push(toWorld((bs.fl0Mm || 0) + (f.flMm || 0))));
    flY = Infinity;
    for (const fl of flCandidates) {
      if (fl >= botY - tol && fl <= botY + toWorld(1500) && fl < flY) flY = fl;
    }
    if (!isFinite(flY)) flY = botY;
  }

  // 天井（上端）: 実測の天井下端。無い/低すぎる（FL+1.5m未満）ときは FL+CL。
  let ceilY = rayHitY(1, false);
  if (ceilY == null || ceilY < flY + toWorld(1500)) ceilY = flY + clHeight;

  const newBotY = Math.max(botY, flY);
  const newTopY = Math.min(topY, ceilY);
  if (newBotY <= botY + tol && topY <= newTopY + tol) return surface; // クランプ不要
  if (newTopY - newBotY < toWorld(100)) return surface; // 退化する場合は触らない

  // 中心を v 軸に沿って新しい中点へ移動（|vy|≈1 なので t ≈ Y差分）
  const t = ((newTopY + newBotY) / 2 - (topY + botY) / 2) / vy;
  return {
    ...surface,
    center: [
      surface.center[0] + surface.vAxis[0] * t,
      surface.center[1] + surface.vAxis[1] * t,
      surface.center[2] + surface.vAxis[2] * t,
    ],
    height: newTopY - newBotY,
  };
}

/**
 * クリックしたメッシュのうち、ヒット面と同一平面（法線+オフセット一致）の頂点を集めて
 * 面ローカルの矩形（中心/u軸/v軸/幅/高さ）を求める。壁/床1面の外形を得る。
 */
export function extractSurfaceRect(obj, nWorld, pWorld) {
  const geom = obj?.geometry;
  const posAttr = geom?.attributes?.position;
  if (!posAttr) return null;

  const d = nWorld.dot(pWorld); // 平面オフセット n·x = d
  // 平面上の 2D 基底（u=横, v=縦）。垂直面は v が鉛直になるよう up を選ぶ。
  const up = Math.abs(nWorld.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const uAxis = new THREE.Vector3().crossVectors(up, nWorld).normalize();
  const vAxis = new THREE.Vector3().crossVectors(nWorld, uAxis).normalize();

  // シーンスケール（mm想定が多い）に応じた平面許容差
  const sceneScale = Math.max(1, geom.boundingSphere?.radius || 1);
  const eps = Math.max(sceneScale * 0.002, 1e-4);

  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  let count = 0;
  const v = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    v.fromBufferAttribute(posAttr, i).applyMatrix4(obj.matrixWorld);
    if (Math.abs(nWorld.dot(v) - d) > eps) continue; // この平面上にない頂点は除外
    const u = v.dot(uAxis);
    const w = v.dot(vAxis);
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (w < minV) minV = w; if (w > maxV) maxV = w;
    count++;
  }
  if (count < 3 || !isFinite(minU)) return null;

  const cu = (minU + maxU) / 2;
  const cv = (minV + maxV) / 2;
  // 平面上の点: x = d*n + u*uAxis + v*vAxis（u/v 軸は n と直交）
  const center = new THREE.Vector3()
    .addScaledVector(nWorld, d)
    .addScaledVector(uAxis, cu)
    .addScaledVector(vAxis, cv);

  return {
    center: [center.x, center.y, center.z],
    normal: [nWorld.x, nWorld.y, nWorld.z],
    uAxis: [uAxis.x, uAxis.y, uAxis.z],
    vAxis: [vAxis.x, vAxis.y, vAxis.z],
    width: maxU - minU,
    height: maxV - minV,
  };
}

/**
 * クリックした三角形から「地続き（連結）かつ同一平面」の三角形だけを辿って、その連結面の矩形を返す。
 * extractSurfaceRect は同一平面の頂点を全部拾うため、離れた同一平面（別の壁・床のL字）まで1枚に
 * まとめてしまい、選択枠が壁の中まで伸びる。本関数はクリック面に地続きの領域だけに限定する。
 * @param obj      ヒットしたメッシュ
 * @param faceIndex レイキャストの三角形 index（seed）
 * @param nHint    ヒット面のワールド法線（符号を合わせる用。床/天井/壁の判定に効く）
 */
export function extractConnectedFaceRect(obj, faceIndex, nHint) {
  const geom = obj?.geometry;
  const posAttr = geom?.attributes?.position;
  if (!posAttr || faceIndex == null || faceIndex < 0) return null;
  const idx = geom.index;
  const triCount = idx ? idx.count / 3 : posAttr.count / 3;
  if (faceIndex >= triCount) return null;

  const mw = obj.matrixWorld;
  const triIdx = (t) => (idx
    ? [idx.getX(t * 3), idx.getX(t * 3 + 1), idx.getX(t * 3 + 2)]
    : [t * 3, t * 3 + 1, t * 3 + 2]);
  const wpos = (vi) => new THREE.Vector3().fromBufferAttribute(posAttr, vi).applyMatrix4(mw);

  // seed の法線（nHint があれば符号を合わせる）と平面オフセット
  const [sa, sb, sc] = triIdx(faceIndex);
  const A = wpos(sa), B = wpos(sb), C = wpos(sc);
  let nWorld = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
  if (nWorld.lengthSq() < 0.5) return null;
  if (nHint && nHint.lengthSq() > 0.5 && nWorld.dot(nHint) < 0) nWorld.negate();
  if (nHint && nHint.lengthSq() > 0.5) nWorld = nHint.clone().normalize();
  const centroidSeed = new THREE.Vector3().add(A).add(B).add(C).multiplyScalar(1 / 3);
  const d = nWorld.dot(centroidSeed);

  if (!geom.boundingSphere) { try { geom.computeBoundingSphere(); } catch { /* noop */ } }
  const sceneScale = Math.max(1, geom.boundingSphere?.radius || 1);
  const planeEps = Math.max(sceneScale * 0.004, 1e-3);
  const weldEps = Math.max(sceneScale * 0.003, 1e-3);

  // 1) 同一平面の三角形を集める
  const triVerts = new Map(); // t -> [V,V,V]
  const a2 = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const [ia, ib, ic] = triIdx(t);
    a2.fromBufferAttribute(posAttr, ia).applyMatrix4(mw);
    b2.fromBufferAttribute(posAttr, ib).applyMatrix4(mw);
    c2.fromBufferAttribute(posAttr, ic).applyMatrix4(mw);
    if (Math.abs(nWorld.dot(a2) - d) > planeEps) continue;
    if (Math.abs(nWorld.dot(b2) - d) > planeEps) continue;
    if (Math.abs(nWorld.dot(c2) - d) > planeEps) continue;
    triVerts.set(t, [a2.clone(), b2.clone(), c2.clone()]);
  }
  if (!triVerts.has(faceIndex)) triVerts.set(faceIndex, [A, B, C]);

  // 2) 溶接頂点キーで隣接を作り、seed から連結成分を BFS
  const vkey = (v) => `${Math.round(v.x / weldEps)}_${Math.round(v.y / weldEps)}_${Math.round(v.z / weldEps)}`;
  const vToTris = new Map();
  for (const [t, verts] of triVerts) {
    for (const v of verts) {
      const k = vkey(v);
      let arr = vToTris.get(k); if (!arr) { arr = []; vToTris.set(k, arr); } arr.push(t);
    }
  }
  const visited = new Set([faceIndex]);
  const stack = [faceIndex];
  while (stack.length) {
    const t = stack.pop();
    const verts = triVerts.get(t);
    if (!verts) continue;
    for (const v of verts) {
      const neigh = vToTris.get(vkey(v));
      if (!neigh) continue;
      for (const nt of neigh) if (!visited.has(nt)) { visited.add(nt); stack.push(nt); }
    }
  }

  // 3) 連結領域の頂点から矩形
  const up = Math.abs(nWorld.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const uAxis = new THREE.Vector3().crossVectors(up, nWorld).normalize();
  const vAxis = new THREE.Vector3().crossVectors(nWorld, uAxis).normalize();
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  for (const t of visited) {
    const verts = triVerts.get(t);
    if (!verts) continue;
    for (const v of verts) {
      const u = v.dot(uAxis), w = v.dot(vAxis);
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (w < minV) minV = w; if (w > maxV) maxV = w;
    }
  }
  if (!isFinite(minU)) return null;
  const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
  const center = new THREE.Vector3().addScaledVector(nWorld, d).addScaledVector(uAxis, cu).addScaledVector(vAxis, cv);

  // 連結領域の実三角形（ワールド座標）。矩形では面からはみ出すため、ハイライトはこの実ポリゴンで描く。
  const tris = [];
  for (const t of visited) {
    const verts = triVerts.get(t);
    if (!verts) continue;
    for (const v of verts) tris.push(v.x, v.y, v.z);
  }

  return {
    center: [center.x, center.y, center.z],
    normal: [nWorld.x, nWorld.y, nWorld.z],
    uAxis: [uAxis.x, uAxis.y, uAxis.z],
    vAxis: [vAxis.x, vAxis.y, vAxis.z],
    width: maxU - minU,
    height: maxV - minV,
    tris,
    // この連結成分に含まれる三角形 index（自動ラベルで「処理済み」管理に使う。任意）。
    triIndices: Array.from(visited),
  };
}

export default function FacePickController({ active, baseCollidersRef, isTopView = false }) {
  const { gl, camera, raycaster } = useThree();
  const downRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const el = gl?.domElement;
    if (!el) return;

    const getNdc = (cx, cy) => {
      const r = el.getBoundingClientRect();
      return {
        x: ((cx - r.left) / r.width) * 2 - 1,
        y: -(((cy - r.top) / r.height) * 2 - 1),
      };
    };

    const onDown = (ev) => {
      if (ev.button !== 0) return;
      downRef.current = { x: ev.clientX, y: ev.clientY };
    };

    const onUp = (ev) => {
      if (ev.button !== 0) return;
      const d = downRef.current;
      downRef.current = null;
      if (!d) return;
      const moved = Math.hypot(ev.clientX - d.x, ev.clientY - d.y);
      if (moved > CLICK_MOVE_THRESHOLD) return; // ドラッグ → 選択しない

      const { x, y } = getNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;

      raycaster.setFromCamera({ x, y }, camera);
      const targets = Array.isArray(baseCollidersRef?.current) ? baseCollidersRef.current : [];
      if (!targets.length) return;

      const hits = raycaster.intersectObjects(targets, true);
      // 断面クリップで隠れている面はクリックさせない（表示されている最前面だけ選択）。
      const hit = firstVisibleHit(hits, isTopView);
      if (!hit) {
        useMaterialFaceStore.getState().setSelectedFace(null);
        return;
      }
      const n = hit.face?.normal ? hit.face.normal.clone() : null;
      if (n && hit.object?.matrixWorld) n.transformDirection(hit.object.matrixWorld);
      if (n) n.normalize();

      // クリック面に地続きの連結領域だけを選択（壁の中まで伸びるのを防ぐ）。faceIndex が無ければ従来法。
      // 内装壁は FL〜CL に切り詰めて展開図（サイドバー/貼り付け範囲）と高さを一致させる。
      const surface = n
        ? clampWallSurfaceToCeiling(
            extractConnectedFaceRect(hit.object, hit.faceIndex, n) || extractSurfaceRect(hit.object, n, hit.point.clone())
          )
        : null;

      const surfaceType = n ? classifySurface(n.y) : "floor";
      useMaterialFaceStore.getState().setSelectedFace({
        objectUuid: hit.object.uuid,
        point: [hit.point.x, hit.point.y, hit.point.z],
        normal: n ? [n.x, n.y, n.z] : [0, 1, 0],
        surfaceType,
        faceIndex: Number.isFinite(hit.faceIndex) ? hit.faceIndex : null,
        surface,
      });
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [active, gl, camera, raycaster, baseCollidersRef]);

  return null;
}
