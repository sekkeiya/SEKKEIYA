// StructureTagController — 躯体（床/壁/天井）の面を左クリックで選択し、
// 右サイドバーの Properties に「面ラベル / コリジョン」設定を開く。
//
// - 通常クリック=単独選択 / Shift+クリック=複数選択（トグル）
// - 家具アイテムが面より手前にある場合は、アイテム選択を優先して面選択しない
//   （家具クリック時は面パネルを出さない）。
// - クリック/ドラッグ(オービット)は移動量で判別（pointerdown を止めないので回転を阻害しない）。

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { extractSurfaceRect, extractConnectedFaceRect } from "../../viewports/controllers/FacePickController";
import { structureFaceKeyOf, classifySurface } from "../../../store/useMaterialFaceStore";
import { useStructureLabelStore, defaultSemantic } from "../../../store/useStructureLabelStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { enumerateConnectedFaces } from "./enumerateStructureFaces";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useUiRightSidebarStore } from "../../../store/uiRightSidebarStore";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { firstVisibleHit } from "../../../utils/sectionClipPick";

const CLICK_MOVE_THRESHOLD = 5;

function triSign(px, py, ax, ay, bx, by) {
  return (px - bx) * (ay - by) - (ax - bx) * (py - by);
}
function pointInTri2D(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = triSign(px, py, ax, ay, bx, by);
  const d2 = triSign(px, py, bx, by, cx, cy);
  const d3 = triSign(px, py, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/** クリック点 p（ワールド）が、ラベル面 surface の実形状に含まれるか。
 *  三角形ごとに「その三角形の平面・法線で内包判定」するので、結合面が非同一平面
 *  （別々の壁を結合）でも、どれかの三角形に当たれば面全体を1枚として拾える。 */
function pointInSurface(surface, p, n, eps) {
  if (!surface) return false;
  const tris = surface.tris;
  if (Array.isArray(tris) && tris.length >= 9) {
    for (let i = 0; i + 8 < tris.length; i += 9) {
      const ax = tris[i], ay = tris[i + 1], az = tris[i + 2];
      const bx = tris[i + 3], by = tris[i + 4], bz = tris[i + 5];
      const cx = tris[i + 6], cy = tris[i + 7], cz = tris[i + 8];
      // 三角形の法線
      const ux = bx - ax, uy = by - ay, uz = bz - az;
      const vx = cx - ax, vy = cy - ay, vz = cz - az;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz);
      if (nl < 1e-9) continue;
      nx /= nl; ny /= nl; nz /= nl;
      if (nx * n.x + ny * n.y + nz * n.z < 0.7) continue; // クリック法線と合わない三角形は無視
      // この三角形の平面と一致するか
      if (Math.abs((p.x - ax) * nx + (p.y - ay) * ny + (p.z - az) * nz) > eps) continue;
      // 三角形ローカル 2D へ射影して内包判定
      const tl = Math.hypot(ux, uy, uz);
      if (tl < 1e-9) continue;
      const tux = ux / tl, tuy = uy / tl, tuz = uz / tl;
      const tvx = ny * tuz - nz * tuy, tvy = nz * tux - nx * tuz, tvz = nx * tuy - ny * tux;
      const proU = (x, y, z) => x * tux + y * tuy + z * tuz;
      const proV = (x, y, z) => x * tvx + y * tvy + z * tvz;
      if (pointInTri2D(
        proU(p.x, p.y, p.z), proV(p.x, p.y, p.z),
        proU(ax, ay, az), proV(ax, ay, az),
        proU(bx, by, bz), proV(bx, by, bz),
        proU(cx, cy, cz), proV(cx, cy, cz),
      )) return true;
    }
    return false;
  }
  // tris 無し: 矩形範囲で判定（法線一致＋平面一致＋u/v 範囲内）
  const ln = new THREE.Vector3(surface.normal[0], surface.normal[1], surface.normal[2]);
  if (ln.lengthSq() < 1e-9) return false;
  ln.normalize();
  if (ln.dot(n) < 0.7) return false;
  const d = ln.dot(new THREE.Vector3(surface.center[0], surface.center[1], surface.center[2]));
  if (Math.abs(ln.dot(p) - d) > eps) return false;
  const u = new THREE.Vector3(surface.uAxis[0], surface.uAxis[1], surface.uAxis[2]);
  const v = new THREE.Vector3(surface.vAxis[0], surface.vAxis[1], surface.vAxis[2]);
  const cu = surface.center[0] * u.x + surface.center[1] * u.y + surface.center[2] * u.z;
  const cv = surface.center[0] * v.x + surface.center[1] * v.y + surface.center[2] * v.z;
  return Math.abs(p.dot(u) - cu) <= (surface.width || 0) / 2 + 1e-6 && Math.abs(p.dot(v) - cv) <= (surface.height || 0) / 2 + 1e-6;
}

/** start の面から、同じ向きクラス（縦=壁 / 横=床天井屋根）かつ頂点を共有して地続きの面を
 *  たどり、つながっている面を一周ぶんすべて返す（ダブルクリックの「一周まとめて選択」用）。 */
function collectFaceLoop(faces, startIdx, upm) {
  if (startIdx < 0 || !faces[startIdx]) return [];
  const g = Math.max(1, 0.02 * upm); // 頂点一致グリッド（共有コーナーは同一座標なので確実に一致）
  const vk = (x, y, z) => `${Math.round(x / g)}_${Math.round(y / g)}_${Math.round(z / g)}`;
  const vsets = faces.map((f) => {
    const set = new Set();
    const t = f.surface?.tris || [];
    for (let i = 0; i + 2 < t.length; i += 3) set.add(vk(t[i], t[i + 1], t[i + 2]));
    return set;
  });
  const isVert = (i) => Math.abs(faces[i].surface?.normal?.[1] ?? 0) < 0.5;
  const cls = isVert(startIdx);
  const share = (i, j) => {
    const a = vsets[i], b = vsets[j];
    for (const k of a) if (b.has(k)) return true;
    return false;
  };
  const visited = new Set([startIdx]);
  const stack = [startIdx];
  while (stack.length) {
    const c = stack.pop();
    for (let j = 0; j < faces.length; j++) {
      if (visited.has(j) || isVert(j) !== cls) continue;
      if (share(c, j)) { visited.add(j); stack.push(j); }
    }
  }
  return [...visited].map((i) => faces[i]);
}

export default function StructureTagController({ active, baseCollidersRef, ignoreItemOcclusion = false, multiSelect = false, isTopView = false }) {
  const { gl, camera, raycaster } = useThree();
  const downRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const el = gl?.domElement;
    if (!el) return;

    // Shift の押下状態を window でも追跡（pointer イベントの shiftKey が取れない環境への保険）。
    const shiftHeld = { v: false };
    const onKey = (e) => { if (e.key === "Shift") shiftHeld.v = e.type === "keydown"; };
    const onBlur = () => { shiftHeld.v = false; };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);

    const getNdc = (cx, cy) => {
      const r = el.getBoundingClientRect();
      return { x: ((cx - r.left) / r.width) * 2 - 1, y: -(((cy - r.top) / r.height) * 2 - 1) };
    };

    // pointerdown 時点の shift を記録（up と down で状態が変わるケースに備える）。
    const onDown = (ev) => { if (ev.button === 0) downRef.current = { x: ev.clientX, y: ev.clientY, shift: ev.shiftKey || shiftHeld.v }; };

    const onUp = (ev) => {
      if (ev.button !== 0) return;
      const d = downRef.current;
      downRef.current = null;
      if (!d) return;
      if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > CLICK_MOVE_THRESHOLD) return; // ドラッグ

      const { x, y } = getNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;

      raycaster.setFromCamera({ x, y }, camera);
      const all = Array.isArray(baseCollidersRef?.current) ? baseCollidersRef.current : [];
      const targets = all.filter((o) => !o?.userData?.isScannedFloor && !o?.userData?.isLabelCollider);

      // Shift（down時・up時・window追跡のいずれか）で追加選択（トグル）。multiSelect=true なら常に追加。
      const additive = !!d.shift || ev.shiftKey || shiftHeld.v || multiSelect;
      const store = useStructureLabelStore.getState();
      const baseHits = targets.length ? raycaster.intersectObjects(targets, true) : [];
      // 断面クリップで隠れている面はクリックさせない（表示されている最前面だけ選択）。
      const baseHit = firstVisibleHit(baseHits, isTopView);
      if (!baseHit) {
        // 何も（見えている面が）無い所をクリック → 面選択を解除（追加選択中は維持）
        if (!additive) store.clearSelection();
        return;
      }

      // 家具アイテムが面より手前なら、アイテム選択を優先（面は選ばない）。
      // 躯体モード(ignoreItemOcclusion)では家具を不可視化しているので、手前の家具を無視して
      // 常に床/壁/天井の面を選べるようにする。
      if (!ignoreItemOcclusion) {
        const itemObjs = useSceneObjectRegistryStore.getState().getAllObjects?.() || [];
        const itemHits = itemObjs.length ? raycaster.intersectObjects(itemObjs, true) : [];
        // 家具も断面クリップで隠れている分は無視（見えている最前面の家具だけ手前判定に使う）。
        const itemHit = firstVisibleHit(itemHits, isTopView);
        if (itemHit && itemHit.distance < baseHit.distance) {
          if (!additive) store.clearSelection();
          return;
        }
      }

      const n = baseHit.face?.normal ? baseHit.face.normal.clone() : null;
      if (n && baseHit.object?.matrixWorld) n.transformDirection(baseHit.object.matrixWorld);
      if (!n) return;
      n.normalize();

      // クリック面に地続きの連結領域だけを選択（壁の中まで伸びるのを防ぐ）
      const surface = extractConnectedFaceRect(baseHit.object, baseHit.faceIndex, n)
        || extractSurfaceRect(baseHit.object, n, baseHit.point.clone());
      if (!surface) return;
      const upm = (useEditorModeStore.getState().sceneMaxY || 0) > 100 ? 1000 : 1;
      const eps = 0.05 * upm;

      // クリック点を内包する既存ラベル面（結合済み含む）があれば、その面を「1面」として選択する。
      // これにより結合面の上をクリックしても、サブ面ではなく結合面全体が選ばれる。
      let picked = null;
      const labelsMap = store.labels || {};
      for (const lk in labelsMap) {
        const lab = labelsMap[lk];
        if (lab?.surface && pointInSurface(lab.surface, baseHit.point, n, eps)) {
          picked = { key: lk, surface: lab.surface, normalY: lab.surface?.normal?.[1] ?? n.y, autoSemantic: lab.semantic };
          break;
        }
      }
      if (!picked) {
        const key = structureFaceKeyOf(surface.normal, surface.center, upm);
        picked = { key, surface, normalY: n.y, autoSemantic: defaultSemantic(classifySurface(n.y)) };
      }

      // 面を選んだら、アイテム選択を解除して Properties を面ラベル設定に切り替える
      useUiSelectionStore.getState().setSelectedItemId?.(null);
      useUiRightSidebarStore.getState().setRightPanel("properties", true);

      if (additive) store.toggleSelect(picked);
      else store.selectOnly(picked);
    };

    // ダブルクリック：その面に地続きの「同じ向きの面（壁の輪 / 床天井のつながり）」を一周まとめて選択。
    const onDbl = (ev) => {
      if (ev.button !== 0) return;
      const { x, y } = getNdc(ev.clientX, ev.clientY);
      if (x < -1 || x > 1 || y < -1 || y > 1) return;
      raycaster.setFromCamera({ x, y }, camera);
      const all = Array.isArray(baseCollidersRef?.current) ? baseCollidersRef.current : [];
      const targets = all.filter((o) => !o?.userData?.isScannedFloor && !o?.userData?.isLabelCollider);
      const baseHits = targets.length ? raycaster.intersectObjects(targets, true) : [];
      const baseHit = firstVisibleHit(baseHits, isTopView);
      if (!baseHit) return;
      const n = baseHit.face?.normal ? baseHit.face.normal.clone() : null;
      if (n && baseHit.object?.matrixWorld) n.transformDirection(baseHit.object.matrixWorld);
      if (!n) return;
      n.normalize();
      const surface = extractConnectedFaceRect(baseHit.object, baseHit.faceIndex, n)
        || extractSurfaceRect(baseHit.object, n, baseHit.point.clone());
      if (!surface) return;
      const upm = (useEditorModeStore.getState().sceneMaxY || 0) > 100 ? 1000 : 1;
      const clickedKey = structureFaceKeyOf(surface.normal, surface.center, upm);
      const faces = enumerateConnectedFaces(targets, upm);
      let startIdx = faces.findIndex((f) => f.key === clickedKey);
      if (startIdx < 0) {
        // キー不一致時は重心が最も近い面を採用
        let best = Infinity;
        for (let i = 0; i < faces.length; i++) {
          const c = faces[i].surface.center;
          const dd = (c[0] - surface.center[0]) ** 2 + (c[1] - surface.center[1]) ** 2 + (c[2] - surface.center[2]) ** 2;
          if (dd < best) { best = dd; startIdx = i; }
        }
      }
      const loop = collectFaceLoop(faces, startIdx, upm);
      if (!loop.length) return;
      useUiSelectionStore.getState().setSelectedItemId?.(null);
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
      useStructureLabelStore.getState().selectMany(loop);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("dblclick", onDbl);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("dblclick", onDbl);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
    };
  }, [active, gl, camera, raycaster, baseCollidersRef, ignoreItemOcclusion, multiSelect, isTopView]);

  return null;
}
