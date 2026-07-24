// LineEndHandle — 平面図の基準線（断面線・通り芯）の端部ハンドル。
//   線の伸びる方向にドラッグして、線そのものの長さを伸ばす／縮める。
//   普段は透明で、ホバー中とドラッグ中だけ●が出る（図面を丸マークで汚さない）。
//   DOM でヒットを取るので、線の上に他のオブジェクトが重なっていても確実に掴める。
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

const ACCENT = "#0369a1";
const SNAP_MM = 50;

/**
 * position : ハンドルの world 位置 [x, y, z]
 * dirAxis  : ドラッグで動かす world 軸（"x" | "z"）= 線が伸びている向き
 * planeY   : レイキャストする水平面の高さ（線を描いている y）
 * onChange : (v:number) => void  ドラッグ中（ライブ更新・永続化しない）
 * onCommit : () => void          離したとき（永続化）
 */
export default function LineEndHandle({ position, dirAxis, planeY, onChange, onCommit, title }) {
  const { camera, gl } = useThree();
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const cbRef = useRef({ onChange, onCommit });
  cbRef.current = { onChange, onCommit };

  useEffect(() => {
    if (!dragging) return;
    const el = gl.domElement;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const v2 = new THREE.Vector2();
    const onMove = (ev) => {
      const rect = el.getBoundingClientRect();
      v2.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      v2.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(v2, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return;
      const raw = dirAxis === "x" ? hit.x : hit.z;
      cbRef.current.onChange?.(Math.round(raw / SNAP_MM) * SNAP_MM);
    };
    const onUp = () => { setDragging(false); cbRef.current.onCommit?.(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, camera, gl, dirAxis, planeY]);

  const visible = hover || dragging;
  return (
    <Html position={position} center zIndexRange={[19, 0]}>
      <div
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setDragging(true); }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={title || "ドラッグで線の長さを調整"}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: dirAxis === "x" ? "ew-resize" : "ns-resize",
          pointerEvents: "auto", background: "transparent", touchAction: "none",
        }}
      >
        <div
          style={{
            width: visible ? 10 : 0, height: visible ? 10 : 0, borderRadius: "50%",
            background: dragging ? ACCENT : "rgba(255,255,255,0.95)",
            border: visible ? `1.5px solid ${ACCENT}` : "none",
            boxShadow: visible ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
            transition: "width 80ms, height 80ms",
          }}
        />
      </div>
    </Html>
  );
}
