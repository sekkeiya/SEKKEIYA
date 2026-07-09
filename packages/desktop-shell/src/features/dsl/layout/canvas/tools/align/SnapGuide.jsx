// src/features/layout/components/MainArea/align/SnapGuide.jsx
import React, { useMemo, useRef, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * SnapGuide (runtime)
 * - axis: "x" | "y" | "z"
 * - valueRef: { current: number|null }  // ガイド線のanchor値
 * - pointRef: { current: {x,y,z}|THREE.Vector3|null } // ドット位置
 * - length: ガイド線の長さ（片側）
 */
export default function SnapGuide({
  axis,
  value,
  point,

  // ✅ refで渡したい場合
  valueRef = null,
  pointRef = null,

  length = 2000,
  color = "#00e5ff",
  dotSize = 8,
  opacity = 0.9,
}) {
  const lineGeomRef = useRef(null);
  const dotGeomRef = useRef(null);

  const linePos = useMemo(() => new Float32Array(6), []);
  const dotPos = useMemo(() => new Float32Array(3), []);

  // ✅ 毎フレームnewしない
  const tmpPointRef = useRef(new THREE.Vector3());

  const isAxisOk = axis === "x" || axis === "y" || axis === "z";

  const readValue = useCallback(() => {
    const v = valueRef ? valueRef.current : value;
    return Number.isFinite(v) ? v : null;
  }, [valueRef, value]);

  const readPoint = useCallback(() => {
    const p = pointRef ? pointRef.current : point;
    if (!p) return null;

    // THREE.Vector3 が来た場合
    if (p instanceof THREE.Vector3) {
      tmpPointRef.current.copy(p);
      return tmpPointRef.current;
    }

    // plain object が来た場合
    if (typeof p.x === "number" && typeof p.y === "number" && typeof p.z === "number") {
      tmpPointRef.current.set(p.x, p.y, p.z);
      return tmpPointRef.current;
    }

    return null;
  }, [pointRef, point]);

  // 初期化：attribute を一度だけ作って差し込む
  useEffect(() => {
    if (!lineGeomRef.current) return;

    const g = lineGeomRef.current;
    const lineAttr = new THREE.BufferAttribute(linePos, 3);
    lineAttr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("position", lineAttr);

    // 初期は非表示（drawRange=0）
    g.setDrawRange(0, 0);

    if (dotGeomRef.current) {
      const dg = dotGeomRef.current;
      const dotAttr = new THREE.BufferAttribute(dotPos, 3);
      dotAttr.setUsage(THREE.DynamicDrawUsage);
      dg.setAttribute("position", dotAttr);

      dg.setDrawRange(0, 0);
    }
  }, [linePos, dotPos]);

  useFrame(() => {
    if (!isAxisOk) return;

    const v = readValue();
    const p = readPoint();

    // line
    if (lineGeomRef.current) {
      const g = lineGeomRef.current;

      if (v == null) {
        // ✅ 完全に描画しない
        g.setDrawRange(0, 0);
      } else {
        const L = length;

        if (axis === "x") {
          linePos[0] = v; linePos[1] = 0; linePos[2] = -L;
          linePos[3] = v; linePos[4] = 0; linePos[5] =  L;
        } else if (axis === "z") {
          linePos[0] = -L; linePos[1] = 0; linePos[2] = v;
          linePos[3] =  L; linePos[4] = 0; linePos[5] = v;
        } else {
          linePos[0] = -L; linePos[1] = v; linePos[2] = 0;
          linePos[3] =  L; linePos[4] = v; linePos[5] = 0;
        }

        const attr = g.getAttribute("position");
        if (attr) attr.needsUpdate = true;

        // ✅ 2頂点ぶん描画
        g.setDrawRange(0, 2);
      }
    }

    // dot
    if (dotGeomRef.current) {
      const dg = dotGeomRef.current;

      if (v != null && p) {
        dotPos[0] = p.x;
        dotPos[1] = p.y;
        dotPos[2] = p.z;

        const attr = dg.getAttribute("position");
        if (attr) attr.needsUpdate = true;

        // ✅ 1頂点ぶん描画
        dg.setDrawRange(0, 1);
      } else {
        // ✅ 完全に描画しない（原点に点が出るのを防ぐ）
        dg.setDrawRange(0, 0);
      }
    }
  });

  if (!isAxisOk) return null;

  return (
    <group renderOrder={9999} frustumCulled={false}>
      {/* guide line */}
      <line frustumCulled={false}>
        <bufferGeometry ref={lineGeomRef} />
        <lineBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthTest={false}
          depthWrite={false}
        />
      </line>

      {/* snap dot */}
      <points renderOrder={10000} frustumCulled={false}>
        <bufferGeometry ref={dotGeomRef} />
        <pointsMaterial
          color={color}
          size={dotSize}
          sizeAttenuation={false}
          depthTest={false}
          depthWrite={false}
          transparent
          opacity={1}
        />
      </points>
    </group>
  );
}
