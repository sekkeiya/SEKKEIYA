import React, { useEffect, useMemo, useRef, useCallback } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useUnderlayStore } from "../../store/useUnderlayStore";

/**
 * 画面上で常に一定サイズ（px）に見えるハンドル。
 * カメラ距離（透視）/ ズーム（平行）からワールド半径を毎フレーム補正する。
 */
function Handle({ position, pxRadius, color }) {
  const ref = useRef();
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const cam = state.camera;
    const vpH = state.size.height || 1;
    let visibleWorldH;
    if (cam.isOrthographicCamera) {
      visibleWorldH = (cam.top - cam.bottom) / (cam.zoom || 1);
    } else {
      const d = cam.position.distanceTo(m.position);
      visibleWorldH = 2 * d * Math.tan(((cam.fov || 50) * Math.PI) / 180 / 2);
    }
    const worldR = (pxRadius * visibleWorldH) / vpH;
    m.scale.setScalar(Math.max(worldR, 1e-4));
  });
  return (
    <mesh ref={ref} position={position} renderOrder={20}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshBasicMaterial color={color} toneMapped={false} depthTest={false} transparent />
    </mesh>
  );
}

/**
 * UnderlayDrawController
 * 下絵の縮尺合わせ：drawMode==="line" のとき、左クリックで基準線の2点を打つ。
 * 打った線の実寸をパネルで入力すると widthMm が逆算される。
 * Enter/Escape で終了。線・点は画面上で一定サイズ。
 */
export default function UnderlayDrawController() {
  const drawMode = useUnderlayStore((s) => s.drawMode);
  const linePoints = useUnderlayStore((s) => s.linePoints);
  const yMm = useUnderlayStore((s) => s.yMm);
  const addLinePoint = useUnderlayStore((s) => s.addLinePoint);
  const setDrawMode = useUnderlayStore((s) => s.setDrawMode);

  const { gl } = useThree();
  const drawing = drawMode !== "none";
  const yLift = yMm + 12;

  // 作図中はカーソルを十字に。
  useEffect(() => {
    const el = gl?.domElement;
    if (!el || !drawing) return;
    const prev = el.style.cursor;
    el.style.cursor = "crosshair";
    return () => {
      el.style.cursor = prev;
    };
  }, [drawing, gl]);

  // Enter/Escape で終了。
  useEffect(() => {
    if (!drawing) return;
    const onKey = (e) => {
      if (e.key === "Enter" || e.key === "Escape") setDrawMode("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, setDrawMode]);

  const handleAddClick = useCallback(
    (e) => {
      if (!drawing) return;
      e.stopPropagation();
      const p = e.point;
      if (p) addLinePoint(p.x, p.z);
    },
    [drawing, addLinePoint]
  );

  const linePath = useMemo(() => {
    if (linePoints.length < 2) return null;
    return linePoints.map(([x, z]) => [x, yLift, z]);
  }, [linePoints, yLift]);

  if (!drawing && linePoints.length === 0) return null;

  return (
    <group>
      {/* 作図中のクリック取得用の大きな不可視平面 */}
      {drawing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yMm + 1, 0]} onClick={handleAddClick}>
          <planeGeometry args={[4_000_000, 4_000_000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}

      {/* 基準線 */}
      {linePath && <Line points={linePath} color="#fbbf24" lineWidth={1.8} />}
      {linePoints.map(([x, z], i) => (
        <Handle key={`ulv${i}`} position={[x, yLift, z]} pxRadius={5} color="#fbbf24" />
      ))}
    </group>
  );
}
