// src/features/layout/components/MainArea/components/controls/ViewportFramingController.jsx
import React, { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { VIEW_TYPES } from "@desktop/features/dsl/layout/utils/viewportUtils.js";

/**
 * ✅ フォーカス/フレーム制御（Canvas内）
 * - focusTick が更新されたら「選択物」にフォーカス
 * - frameAllTick が更新されたら「全体」にフレーム
 *
 * ✅ 重要：
 * - ユーザー操作中（Gizmo/入力UI/Marquee/Align等）に自動フレームが走ると
 *   カメラが勝手に動いたように見えるため、isUserInteracting でガードする
 *
 * ✅ 前提：Y-up（Three.js標準）
 * - 床：XZ（Y=高さ）
 * - Top : +Y から見下ろす（XZを見る）
 * - Front: +Z から見る（XYを見る）
 * - Right: +X から見る（YZを見る）
 */
export default function ViewportFramingController({
  active,
  type,
  orbitRef,
  selectedObject,
  objectsRef,
  baseRootRef,
  focusTick,
  frameAllTick,
  isUserInteracting = false,
}) {
  const { camera } = useThree();

  const lastFocusRef = useRef(focusTick);
  const lastFrameAllRef = useRef(frameAllTick);

  const buildBoxForSelected = useCallback(() => {
    if (!selectedObject) return null;
    const box = new THREE.Box3().setFromObject(selectedObject);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return null;
    if (box.isEmpty()) return null;
    return box;
  }, [selectedObject]);

  const buildBoxForAll = useCallback(() => {
    const box = new THREE.Box3();
    let hasAny = false;

    const map = objectsRef?.current;
    if (map && typeof map.forEach === "function") {
      map.forEach((obj) => {
        if (!obj) return;
        const b = new THREE.Box3().setFromObject(obj);
        if (!b.isEmpty() && Number.isFinite(b.min.x) && Number.isFinite(b.max.x)) {
          box.union(b);
          hasAny = true;
        }
      });
    }

    const base = baseRootRef?.current;
    if (base) {
      const b = new THREE.Box3().setFromObject(base);
      if (!b.isEmpty() && Number.isFinite(b.min.x) && Number.isFinite(b.max.x)) {
        box.union(b);
        hasAny = true;
      }
    }

    if (!hasAny || box.isEmpty()) return null;
    return box;
  }, [objectsRef, baseRootRef]);

  const frameBox = useCallback(
    (box) => {
      if (!box) return;

      const controls = orbitRef?.current;
      if (!controls) return;

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      const pad = 1.15;
      const reqW = Math.max(0.001, size.x * pad);
      const reqH = Math.max(0.001, size.y * pad);
      const reqD = Math.max(0.001, size.z * pad);

      controls.target.copy(center);

      const isOrtho = type !== VIEW_TYPES.PERSPECTIVE;

      // ===== Perspective: 距離を調整して収める =====
      if (!isOrtho) {
        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const r = Math.max(0.001, sphere.radius);

        const cam = camera;
        const fov = THREE.MathUtils.degToRad(cam.fov || 50);
        const dist = (r / Math.sin(fov / 2)) * 1.05;

        const dir = new THREE.Vector3().subVectors(cam.position, controls.target);
        if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
        dir.normalize();

        cam.position.copy(controls.target).add(dir.multiplyScalar(dist));
        cam.near = Math.max(0.01, dist / 200);
        cam.far = Math.max(cam.far, dist * 200);
        cam.updateProjectionMatrix();

        controls.update();
        return;
      }

      // ===== Ortho: zoom を調整して収める（Y-up）=====
      const cam = camera;

      // frustum サイズ（zoom=1 の見かけサイズ）
      const frustumW = Math.abs(cam.right - cam.left);
      const frustumH = Math.abs(cam.top - cam.bottom);

      // ✅ 各ビューが見ている平面に合わせて必要幅/高さを決める（Y-up）
      // TOP   : XZ（横=X / 縦=Z）
      // FRONT : XY（横=X / 縦=Y）
      // RIGHT : YZ（横=Z / 縦=Y） ※「横」をZにする方が直感的（右面図）
      let needW = reqW;
      let needH = reqH;

      if (type === VIEW_TYPES.TOP) {
        needW = reqW; // X
        needH = reqD; // Z
      } else if (type === VIEW_TYPES.FRONT) {
        needW = reqW; // X
        needH = reqH; // Y
      } else if (type === VIEW_TYPES.RIGHT) {
        needW = reqD; // Z
        needH = reqH; // Y
      }

      const zoomW = frustumW / Math.max(0.001, needW);
      const zoomH = frustumH / Math.max(0.001, needH);
      const nextZoom = Math.max(0.01, Math.min(zoomW, zoomH) * 0.95);

      // ✅ 距離は現状維持
      const dist = cam.position.clone().sub(controls.target).length() || 30;

      // ✅ 向きを固定（ロール防止のため毎回 up + lookAt をやる）
      if (type === VIEW_TYPES.TOP) {
        cam.position.set(center.x, center.y + dist, center.z);
        cam.up.set(0, 0, -1); // Rhinoっぽく「上= -Z」
      } else if (type === VIEW_TYPES.FRONT) {
        cam.position.set(center.x, center.y, center.z + dist);
        cam.up.set(0, 1, 0);
      } else if (type === VIEW_TYPES.RIGHT) {
        cam.position.set(center.x + dist, center.y, center.z);
        cam.up.set(0, 1, 0);
      }

      cam.rotation.set(0, 0, 0); // ✅ 余計なロールを消す
      cam.lookAt(center);

      cam.zoom = nextZoom;
      cam.updateProjectionMatrix();
      controls.update();
    },
    [camera, orbitRef, type]
  );

  useEffect(() => {
    if (!active) return;
    if (isUserInteracting) return;

    if (focusTick !== lastFocusRef.current) {
      lastFocusRef.current = focusTick;
      const box = buildBoxForSelected();
      if (box) frameBox(box);
    }
  }, [active, focusTick, buildBoxForSelected, frameBox, isUserInteracting]);

  useEffect(() => {
    if (!active) return;
    if (isUserInteracting) return;

    if (frameAllTick !== lastFrameAllRef.current) {
      lastFrameAllRef.current = frameAllTick;
      const box = buildBoxForAll();
      if (box) frameBox(box);
    }
  }, [active, frameAllTick, buildBoxForAll, frameBox, isUserInteracting]);

  return null;
}
