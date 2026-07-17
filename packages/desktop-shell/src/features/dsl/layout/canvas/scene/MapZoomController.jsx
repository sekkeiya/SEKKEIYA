import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * MapZoomController
 * Map モード専用のズーム操作を確実に効かせるためのコントローラ。
 *   - マウスホイール: ズーム
 *   - Ctrl + 右ドラッグ: ズーム（上ドラッグで拡大）
 * OrbitControls の mouseButtons 切替に依存せず、カメラを直接 dolly する。
 * Base 中央固定のため、注視点（controls.target）に向かって寄り引きする。
 */
export default function MapZoomController({ orbitRef }) {
  const { camera, gl } = useThree();
  const dragRef = useRef(null);

  useEffect(() => {
    const el = gl?.domElement;
    if (!el) return;

    const dolly = (factor) => {
      const controls = orbitRef?.current;
      const target = controls?.target || new THREE.Vector3(0, 0, 0);
      const cam = controls?.object || camera;
      if (!cam) return;

      if (cam.isOrthographicCamera) {
        cam.zoom = THREE.MathUtils.clamp(cam.zoom * factor, 0.0005, 100000);
        cam.updateProjectionMatrix();
      } else {
        // 注視点に対して距離を縮める/伸ばす（factor>1 で寄る）。
        const dir = new THREE.Vector3().subVectors(cam.position, target);
        let dist = dir.length();
        if (dist < 1e-6) return;
        dir.normalize();
        dist = THREE.MathUtils.clamp(dist / factor, 1, 1e9);
        cam.position.copy(target).addScaledVector(dir, dist);
      }
      controls?.update?.();
    };

    const onWheel = (e) => {
      e.preventDefault();
      // deltaY<0（上スクロール）で拡大。
      dolly(Math.pow(1.0025, -e.deltaY));
    };

    const onPointerDown = (e) => {
      if (e.button === 2 && e.ctrlKey) {
        dragRef.current = { y: e.clientY };
        try { el.setPointerCapture?.(e.pointerId); } catch {}
      }
    };
    const onPointerMove = (e) => {
      if (!dragRef.current) return;
      const dy = e.clientY - dragRef.current.y;
      dragRef.current.y = e.clientY;
      // 上ドラッグ(dy<0)で拡大。
      dolly(Math.pow(1.01, -dy));
    };
    const onPointerUp = (e) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      try { el.releasePointerCapture?.(e.pointerId); } catch {}
    };
    const onContextMenu = (e) => e.preventDefault();

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, [gl, camera, orbitRef]);

  return null;
}
