// MaterialLookController — Material モードの「展開図ピン視点（一人称で見渡す）」。
// ピン位置に固定し、左ドラッグで首振り（yaw/pitch）。画面中央クロスヘアが狙う面を
// ハイライト（aimFace）し、クリック（ドラッグでない）で選択して展開図に表示する。

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useMaterialFaceStore, classifySurface } from "../../../store/useMaterialFaceStore";
import { useMaterialViewStore } from "../../../store/useMaterialViewStore";
import { extractSurfaceRect } from "../../viewports/controllers/FacePickController.jsx";
import { layoutSceneRef } from "../../../services/layoutSceneRef";

const FLOOR_NORMAL_MIN = 0.5;
const EYE_M = 1.5;
const YAW_SENS = 0.005;
const PITCH_SENS = 0.005;
const PITCH_MAX = 1.45; // ~83°
const CLICK_MOVE_THRESHOLD = 5;

function worldNormalY(hit) {
  if (!hit?.face) return 1;
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y;
}

function castFloorY(x, z, colliders) {
  if (!colliders.length) return 0;
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 1e6, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects(colliders, true);
  const floor = hits.find((h) => Math.abs(worldNormalY(h)) > FLOOR_NORMAL_MIN) || hits[0];
  return floor ? floor.point.y : 0;
}

function faceFromHit(hit) {
  const n = hit.face?.normal ? hit.face.normal.clone() : null;
  if (n && hit.object?.matrixWorld) n.transformDirection(hit.object.matrixWorld);
  if (n) n.normalize();
  const surface = n ? extractSurfaceRect(hit.object, n, hit.point.clone()) : null;
  const surfaceType = n ? classifySurface(n.y) : "floor";
  return {
    objectUuid: hit.object.uuid,
    point: [hit.point.x, hit.point.y, hit.point.z],
    normal: n ? [n.x, n.y, n.z] : [0, 1, 0],
    surfaceType,
    faceIndex: Number.isFinite(hit.faceIndex) ? hit.faceIndex : null,
    surface,
  };
}

const aimKey = (f) =>
  !f ? "" : `${f.surfaceType}|${f.surface ? f.surface.center.map((n) => Math.round(n)).join(",") : f.objectUuid}`;

export default function MaterialLookController({ active }) {
  const { camera, gl, raycaster } = useThree();
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const u = sceneMaxY > 100 ? 1000 : 1;

  const yawRef = useRef(0);
  const targetYawRef = useRef(null); // 矢印キーの90度回転アニメ目標（null=非アニメ）
  const pitchRef = useRef(0);
  const posRef = useRef(new THREE.Vector3());
  const savedPose = useRef(null);
  const aimRef = useRef(null);
  const lastAimKey = useRef("");
  const lookRef = useRef(null);
  const clickRef = useRef(null);

  // ── 入場/退場：俯瞰カメラ姿勢を退避し、退場時に復元 ──
  useEffect(() => {
    if (!active) return;
    try { savedPose.current = layoutSceneRef.getCameraState?.() ?? null; } catch { savedPose.current = null; }
    camera.up.set(0, 1, 0);
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    const mv = useMaterialViewStore.getState();
    const pin = mv.pins.find((p) => p.id === mv.activePinId) || null;
    let sx = camera.position.x, sz = camera.position.z, initYaw = 0;
    if (pin) {
      sx = pin.x; sz = pin.z; initYaw = (pin.yawDeg ?? 0) * (Math.PI / 180);
    } else if (colliders.length) {
      const box = new THREE.Box3();
      colliders.forEach((c) => box.expandByObject(c));
      if (!box.isEmpty()) { const c = box.getCenter(new THREE.Vector3()); sx = c.x; sz = c.z; }
    }
    const floorY = castFloorY(sx, sz, colliders);
    posRef.current.set(sx, floorY + EYE_M * u, sz);
    yawRef.current = initYaw;
    pitchRef.current = 0;
    return () => {
      const pose = savedPose.current;
      if (pose) requestAnimationFrame(() => { try { layoutSceneRef.setCameraPose?.(pose); } catch { /* noop */ } });
      useMaterialViewStore.getState().setAimFace(null);
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 右ドラッグで首振り／左クリックで中央の面を選択 ──
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const onDown = (e) => {
      if (e.button === 2) {
        // 右ドラッグ＝見回す
        lookRef.current = { lx: e.clientX, ly: e.clientY };
      } else if (e.button === 0) {
        // 左クリック（小移動）＝選択
        clickRef.current = { lx: e.clientX, ly: e.clientY, moved: 0 };
      }
    };
    const onMove = (e) => {
      const l = lookRef.current;
      if (l) {
        const dx = e.clientX - l.lx, dy = e.clientY - l.ly;
        l.lx = e.clientX; l.ly = e.clientY;
        targetYawRef.current = null; // 手動で見回したら90度回転アニメは中断
        yawRef.current -= dx * YAW_SENS;
        pitchRef.current = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitchRef.current - dy * PITCH_SENS));
      }
      const c = clickRef.current;
      if (c) {
        c.moved += Math.hypot(e.clientX - c.lx, e.clientY - c.ly);
        c.lx = e.clientX; c.ly = e.clientY;
      }
    };
    const onUp = (e) => {
      if (e.button === 2) { lookRef.current = null; return; }
      if (e.button === 0) {
        const c = clickRef.current;
        clickRef.current = null;
        if (c && c.moved <= CLICK_MOVE_THRESHOLD && aimRef.current) {
          useMaterialFaceStore.getState().setSelectedFace(aimRef.current);
        }
      }
    };
    const onContext = (e) => e.preventDefault(); // 右クリックメニュー抑止
    // 矢印キー ← / → で見ている向きを 90 度回転（上下キーは無効）
    const onKey = (e) => {
      if (e.key === "ArrowLeft") {
        targetYawRef.current = (targetYawRef.current ?? yawRef.current) + Math.PI / 2; // 左へ90°
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        targetYawRef.current = (targetYawRef.current ?? yawRef.current) - Math.PI / 2; // 右へ90°
        e.preventDefault();
      }
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [active, gl.domElement]);

  // ── 毎フレーム：固定位置で yaw/pitch を反映＋中央レイキャスト ──
  useFrame((_, dt) => {
    if (!active) return;
    // 矢印キーの90度回転をなめらかに補間
    if (targetYawRef.current != null) {
      const k = 1 - Math.exp(-14 * Math.min(dt, 0.05));
      yawRef.current += (targetYawRef.current - yawRef.current) * k;
      if (Math.abs(targetYawRef.current - yawRef.current) < 0.001) {
        yawRef.current = targetYawRef.current;
        targetYawRef.current = null;
      }
    }
    camera.up.set(0, 1, 0);
    camera.position.copy(posRef.current);
    const cp = Math.cos(pitchRef.current);
    camera.lookAt(
      posRef.current.x + Math.sin(yawRef.current) * cp,
      posRef.current.y + Math.sin(pitchRef.current),
      posRef.current.z + Math.cos(yawRef.current) * cp
    );

    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    if (!colliders.length) { aimRef.current = null; return; }
    raycaster.setFromCamera({ x: 0, y: 0 }, camera); // 画面中央
    const hits = raycaster.intersectObjects(colliders, true);
    const face = hits.length ? faceFromHit(hits[0]) : null;
    aimRef.current = face;
    const k = aimKey(face);
    if (k !== lastAimKey.current) {
      lastAimKey.current = k;
      useMaterialViewStore.getState().setAimFace(face);
    }
  });

  return null;
}
