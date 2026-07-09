import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import { useMapGroundStore } from "../../store/useMapGroundStore";

/**
 * 画面上で常に一定サイズ（px）に見えるハンドル。
 * カメラ距離（透視）/ ズーム（平行）からワールド半径を毎フレーム補正する。
 */
function Handle({ position, pxRadius, color, depthTest = false, ...handlers }) {
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
    <mesh ref={ref} position={position} renderOrder={20} {...handlers}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshBasicMaterial color={color} toneMapped={false} depthTest={depthTest} transparent />
    </mesh>
  );
}

/**
 * MapDrawController
 * Map モードの作図/編集：
 *   - drawMode==="site": 左クリックで敷地多角形の頂点を追加。ダブルクリック/Enter で確定。
 *   - drawMode==="line": 左クリックで基準線の2点を打つ。
 *   - 頂点：クリック選択 → 左ドラッグで移動 / Delete で削除（drawMode 問わず）。
 * 操作点・線は画面上で一定サイズ（縮尺やズームに依存しない）。
 */
export default function MapDrawController() {
  const drawMode = useMapGroundStore((s) => s.drawMode);
  const sitePoints = useMapGroundStore((s) => s.sitePoints);
  const linePoints = useMapGroundStore((s) => s.linePoints);
  const yMm = useMapGroundStore((s) => s.yMm);
  const addSitePoint = useMapGroundStore((s) => s.addSitePoint);
  const updateSitePoint = useMapGroundStore((s) => s.updateSitePoint);
  const removeSitePoint = useMapGroundStore((s) => s.removeSitePoint);
  const addLinePoint = useMapGroundStore((s) => s.addLinePoint);
  const setDrawMode = useMapGroundStore((s) => s.setDrawMode);

  const { gl } = useThree();
  const drawing = drawMode !== "none";
  const yLift = yMm + 12;

  const [selectedVertex, setSelectedVertex] = useState(null);
  const dragRef = useRef(null);

  const setCursor = useCallback(
    (c) => {
      if (gl?.domElement) gl.domElement.style.cursor = c;
    },
    [gl]
  );

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

  // Enter/Escape で確定、Delete/Backspace で選択頂点を削除。
  useEffect(() => {
    const onKey = (e) => {
      if (drawing && (e.key === "Enter" || e.key === "Escape")) {
        setDrawMode("none");
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedVertex != null) {
        removeSitePoint(selectedVertex);
        setSelectedVertex(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawing, selectedVertex, setDrawMode, removeSitePoint]);

  const pickPlanePoint = useCallback(
    (e) => {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -yMm);
      const out = new THREE.Vector3();
      return e?.ray?.intersectPlane(plane, out) ? out : null;
    },
    [yMm]
  );

  const handleAddClick = (e) => {
    if (!drawing || dragRef.current != null) return;
    e.stopPropagation();
    const p = e.point;
    if (!p) return;
    if (drawMode === "site") addSitePoint(p.x, p.z);
    else if (drawMode === "line") addLinePoint(p.x, p.z);
  };

  const handleDoubleClick = (e) => {
    if (drawMode !== "site") return;
    e.stopPropagation();
    setDrawMode("none");
  };

  const vertexHandlers = (i) => ({
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      setSelectedVertex(i);
      dragRef.current = i;
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
      setCursor("grabbing");
    },
    onPointerMove: (e) => {
      if (dragRef.current == null) return;
      e.stopPropagation();
      const p = pickPlanePoint(e);
      if (p) updateSitePoint(dragRef.current, p.x, p.z);
    },
    onPointerUp: (e) => {
      if (dragRef.current == null) return;
      dragRef.current = null;
      e.stopPropagation();
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {}
      setCursor("grab");
    },
    onPointerOver: () => {
      if (dragRef.current == null) setCursor("grab");
    },
    onPointerOut: () => {
      if (dragRef.current == null) setCursor(drawing ? "crosshair" : "auto");
    },
  });

  const sitePath = useMemo(() => {
    if (sitePoints.length < 2) return null;
    const pts = sitePoints.map(([x, z]) => [x, yLift, z]);
    if (sitePoints.length >= 3) pts.push([sitePoints[0][0], yLift, sitePoints[0][1]]);
    return pts;
  }, [sitePoints, yLift]);

  const linePath = useMemo(() => {
    if (linePoints.length < 2) return null;
    return linePoints.map(([x, z]) => [x, yLift, z]);
  }, [linePoints, yLift]);

  return (
    <group>
      {/* 作図中のクリック取得用の大きな不可視平面 */}
      {drawing && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, yMm + 1, 0]}
          onClick={handleAddClick}
          onDoubleClick={handleDoubleClick}
        >
          <planeGeometry args={[4_000_000, 4_000_000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}

      {/* 敷地多角形（細い線） */}
      {sitePath && <Line points={sitePath} color="#38bdf8" lineWidth={1.6} />}
      {/* 敷地頂点（画面一定サイズ・選択/ドラッグ/削除可） */}
      {sitePoints.map(([x, z], i) => (
        <Handle
          key={`sv${i}`}
          position={[x, yLift, z]}
          pxRadius={selectedVertex === i ? 6.5 : 5}
          color={selectedVertex === i ? "#f97316" : "#38bdf8"}
          {...vertexHandlers(i)}
        />
      ))}

      {/* 基準線（細い線） */}
      {linePath && <Line points={linePath} color="#fbbf24" lineWidth={1.8} />}
      {linePoints.map(([x, z], i) => (
        <Handle key={`lv${i}`} position={[x, yLift, z]} pxRadius={5} color="#fbbf24" />
      ))}
    </group>
  );
}
