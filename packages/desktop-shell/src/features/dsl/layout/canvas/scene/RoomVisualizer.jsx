// RoomVisualizer — 平面図に「室（Room）の範囲」を表示・選択・編集するオーバーレイ（Phase B）。
//   ゾーンを持たない部屋（Room.rect のみ）を対象に、輪郭＋淡い塗り＋名前ラベルを描く。
//   Top ビュー＋レイアウト/ゾーニング中は移動・辺/コーナーのリサイズができる（UpdateRooms で永続化）。
//   ゾーンを持つ部屋は ZoneVisualizer 側で見えるので、ここでは描かない。
//   ※ Zone はいずれ「バブル（グラデ円）」になる予定（Phase C）。Room の範囲＝矩形はここ。
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useBuildingSpecStore } from "../../store/useBuildingSpecStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { snapZoneRectMove, snapZoneCoordX, snapZoneCoordZ } from "../../utils/drawSnap";

const H = 8; // 塗り箱の薄さ（mm スケールで見える程度）
const MIN_SIZE = 300; // mm
const EDGE_TOL_PX = 10; // 枠の掴み判定幅（スクリーンpx）
const MARKER_PX = 8; // 可視ハンドルの一辺（スクリーンpx）
const SNAP_DIST = 300; // 壁マグネットの吸着距離(mm)

const REGION_CURSOR = {
  edge_n: "ns-resize", edge_s: "ns-resize",
  edge_e: "ew-resize", edge_w: "ew-resize",
  corner_nw: "nwse-resize", corner_se: "nwse-resize",
  corner_ne: "nesw-resize", corner_sw: "nesw-resize",
  center: "move",
};

/** 部屋の rect を rooms 配列へ反映（永続化）。 */
function commitRoomRect(id, rect) {
  const st = useLayoutTaskStore.getState();
  const rooms = (st.rooms || []).map((r) => (r.id === id ? { ...r, rect } : r));
  window.dispatchEvent(new CustomEvent("LayoutShell:UpdateRooms", { detail: { rooms } }));
}

/** 部屋1つぶんの表示＋編集ギズモ。 */
function RoomRectItem({ id, name, rect, color, selected, editable, orbitRef, onSelect, gridHeightMm }) {
  const { camera, gl } = useThree();
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders) || [];
  const [dr, setDr] = useState(null); // ドラッグ中のローカル rect
  const [hovered, setHovered] = useState(false);
  const dragInfo = useRef({ type: null, startX: 0, startZ: 0, initial: null });

  // 壁マグネット: リサイズ中のエッジ座標を、近くの壁面へ吸着（ZoneActiveGizmo と同じ流儀）。
  const getSnappedWallPos = useCallback((rayOrigin, rayDir, fallback) => {
    if (!baseColliders.length) return fallback;
    rayOrigin.y = 500;
    const rc = new THREE.Raycaster(rayOrigin, rayDir);
    const fwd = rc.intersectObjects(baseColliders, true)[0];
    rc.ray.direction.negate();
    const back = rc.intersectObjects(baseColliders, true)[0];
    let best = fallback;
    let minDiff = SNAP_DIST;
    if (fwd && fwd.distance < minDiff) { best = fwd.point; minDiff = fwd.distance; }
    if (back && back.distance < minDiff) { best = back.point; }
    return best;
  }, [baseColliders]);

  // スクリーンpx → world mm（直交カメラの zoom から追従）
  const pxWorldRef = useRef(4);
  const [pxWorld, setPxWorld] = useState(4);
  useFrame(({ camera: cam }) => {
    const pw = cam.isOrthographicCamera ? 1 / Math.max(cam.zoom, 1e-6) : 4;
    if (Math.abs(pw - pxWorldRef.current) > pxWorldRef.current * 0.08) {
      pxWorldRef.current = pw;
      setPxWorld(pw);
    }
  });

  const getPointerPos = useCallback((e) => {
    const r = gl.domElement.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(gridHeightMm || 0));
    const rc = new THREE.Raycaster();
    rc.setFromCamera({ x: nx, y: ny }, camera);
    const target = new THREE.Vector3();
    rc.ray.intersectPlane(plane, target);
    return target;
  }, [camera, gl, gridHeightMm]);

  const cur = dr || rect;

  const regionFromPoint = useCallback((wx, wz) => {
    const r = dr || rect;
    if (!r) return null;
    const tol = EDGE_TOL_PX * pxWorldRef.current;
    const minX = r.x - r.width / 2, maxX = r.x + r.width / 2;
    const minZ = r.z - r.depth / 2, maxZ = r.z + r.depth / 2;
    if (wx < minX - tol || wx > maxX + tol || wz < minZ - tol || wz > maxZ + tol) return null;
    const nearW = Math.abs(wx - minX) <= tol;
    const nearE = Math.abs(wx - maxX) <= tol;
    const nearN = Math.abs(wz - minZ) <= tol;
    const nearS = Math.abs(wz - maxZ) <= tol;
    if (nearN && nearW) return "corner_nw";
    if (nearN && nearE) return "corner_ne";
    if (nearS && nearW) return "corner_sw";
    if (nearS && nearE) return "corner_se";
    if (nearN) return "edge_n";
    if (nearS) return "edge_s";
    if (nearE) return "edge_e";
    if (nearW) return "edge_w";
    if (wx > minX && wx < maxX && wz > minZ && wz < maxZ) return "center";
    return null;
  }, [dr, rect]);

  const onDown = useCallback((e, type) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    if (!selected) onSelect(id);
    if (orbitRef?.current) orbitRef.current.enabled = false;
    gl.domElement.style.cursor = REGION_CURSOR[type] ?? "move";
    const p = getPointerPos(e);
    dragInfo.current = { type, startX: p.x, startZ: p.z, initial: { ...rect } };
    setDr({ ...rect });
  }, [editable, selected, onSelect, id, orbitRef, gl, getPointerPos, rect]);

  const onMove = useCallback((e) => {
    if (!dragInfo.current.type) return;
    const p = getPointerPos(e);
    const info = dragInfo.current;
    const dx = p.x - info.startX;
    const dz = p.z - info.startZ;
    const init = info.initial;
    const next = { ...init };
    const t = info.type;
    // Shift 押下中だけ通り芯/壁芯/端点/床辺/グリッドへスナップ（ゾーンと同じ）。
    const snap = !!e.shiftKey;
    if (t === "center") {
      next.x += dx;
      next.z += dz;
      if (snap) {
        const { dx: sdx, dz: sdz } = snapZoneRectMove(next);
        next.x += sdx;
        next.z += sdz;
      }
    } else {
      const rE = t === "edge_e" || t === "corner_ne" || t === "corner_se";
      const rW = t === "edge_w" || t === "corner_nw" || t === "corner_sw";
      const rS = t === "edge_s" || t === "corner_se" || t === "corner_sw";
      const rN = t === "edge_n" || t === "corner_ne" || t === "corner_nw";
      const ro = new THREE.Vector3(next.x, 0, next.z);
      if (rE) {
        const edge = init.x + init.width / 2 + dx;
        ro.setX(edge);
        const sx = snap ? snapZoneCoordX(edge, init.z)
          : getSnappedWallPos(ro.clone(), new THREE.Vector3(1, 0, 0), ro.clone()).x;
        const minX = init.x - init.width / 2;
        next.width = Math.max(MIN_SIZE, sx - minX);
        next.x = minX + next.width / 2;
      }
      if (rW) {
        const edge = init.x - init.width / 2 + dx;
        ro.setX(edge);
        const sx = snap ? snapZoneCoordX(edge, init.z)
          : getSnappedWallPos(ro.clone(), new THREE.Vector3(-1, 0, 0), ro.clone()).x;
        const maxX = init.x + init.width / 2;
        next.width = Math.max(MIN_SIZE, maxX - sx);
        next.x = maxX - next.width / 2;
      }
      if (rS) {
        const edge = init.z + init.depth / 2 + dz;
        ro.setZ(edge);
        const sz = snap ? snapZoneCoordZ(edge, init.x)
          : getSnappedWallPos(ro.clone(), new THREE.Vector3(0, 0, 1), ro.clone()).z;
        const minZ = init.z - init.depth / 2;
        next.depth = Math.max(MIN_SIZE, sz - minZ);
        next.z = minZ + next.depth / 2;
      }
      if (rN) {
        const edge = init.z - init.depth / 2 + dz;
        ro.setZ(edge);
        const sz = snap ? snapZoneCoordZ(edge, init.x)
          : getSnappedWallPos(ro.clone(), new THREE.Vector3(0, 0, -1), ro.clone()).z;
        const maxZ = init.z + init.depth / 2;
        next.depth = Math.max(MIN_SIZE, maxZ - sz);
        next.z = maxZ - next.depth / 2;
      }
    }
    setDr(next);
  }, [getPointerPos, getSnappedWallPos]);

  const onUp = useCallback(() => {
    if (!dragInfo.current.type) return;
    if (orbitRef?.current) orbitRef.current.enabled = true;
    gl.domElement.style.cursor = "";
    const finalRect = dr;
    dragInfo.current.type = null;
    setDr(null);
    if (finalRect) commitRoomRect(id, finalRect);
  }, [orbitRef, gl, dr, id]);

  useEffect(() => {
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onMove, onUp]);

  const w = cur.width || 0;
  const d = cur.depth || 0;
  const c = color || "#38bdf8";
  const y = gridHeightMm || 0;
  const showHandles = editable && selected;
  const mk = MARKER_PX * pxWorld;
  const tolWorld = EDGE_TOL_PX * pxWorld;
  const markers = [
    [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2],
    [0, d / 2], [0, -d / 2], [w / 2, 0], [-w / 2, 0],
  ];
  const outline = useMemo(
    () => new Float32Array([-w / 2, 0, -d / 2, w / 2, 0, -d / 2, w / 2, 0, d / 2, -w / 2, 0, d / 2]),
    [w, d],
  );

  return (
    <group position={[cur.x, 0, cur.z]}>
      {/* 淡い塗り（非選択時のみクリック/ドラッグ受け。選択中はピックプレーンが担当） */}
      <mesh
        position={[0, H / 2 + y, 0]}
        renderOrder={9985}
        onPointerDown={editable && !selected ? (e) => onDown(e, "center") : undefined}
        onClick={!selected ? (e) => { e.stopPropagation(); if (!dragInfo.current.type) onSelect(id); } : undefined}
        onPointerOver={editable && !selected ? () => { setHovered(true); gl.domElement.style.cursor = "move"; } : undefined}
        onPointerOut={editable && !selected ? () => { setHovered(false); if (!dragInfo.current.type) gl.domElement.style.cursor = ""; } : undefined}
      >
        <boxGeometry args={[w, H, d]} />
        <meshBasicMaterial color={c} transparent opacity={selected ? 0.18 : hovered ? 0.1 : 0.05} depthTest={false} depthWrite={false} />
      </mesh>

      {/* 輪郭 */}
      <lineLoop position={[0, H + y, 0]} renderOrder={9986}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[outline, 3]} count={4} />
        </bufferGeometry>
        <lineBasicMaterial color={c} transparent opacity={selected ? 0.95 : 0.4} depthTest={false} />
      </lineLoop>

      {showHandles && (
        <>
          {/* ピックプレーン: 枠±tol を覆い、領域（辺/コーナー/内側）を判定 */}
          <mesh
            position={[0, H + 2 + y, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerMove={(e) => {
              if (dragInfo.current.type) return;
              const reg = regionFromPoint(e.point.x, e.point.z);
              if (reg) { e.stopPropagation(); gl.domElement.style.cursor = REGION_CURSOR[reg]; }
            }}
            onPointerDown={(e) => {
              const reg = regionFromPoint(e.point.x, e.point.z);
              if (!reg) return;
              onDown(e, reg);
            }}
            onPointerOut={() => { if (!dragInfo.current.type) gl.domElement.style.cursor = ""; }}
          >
            <planeGeometry args={[w + tolWorld * 2, d + tolWorld * 2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>

          {/* 可視ハンドル */}
          {markers.map(([mx, mz], i) => (
            <mesh key={`h${i}`} position={[mx, H + 3 + y, mz]}>
              <boxGeometry args={[mk, 2, mk]} />
              <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
            </mesh>
          ))}
          {markers.map(([mx, mz], i) => (
            <mesh key={`hb${i}`} position={[mx, H + 2.5 + y, mz]}>
              <boxGeometry args={[mk * 1.5, 2, mk * 1.5]} />
              <meshBasicMaterial color={c} depthTest={false} depthWrite={false} />
            </mesh>
          ))}
        </>
      )}

      {/* 名前ラベル（クリックで選択） */}
      <Html position={[0, 200 + y, 0]} center style={{ pointerEvents: "auto" }}>
        <div
          onClick={(e) => { e.stopPropagation(); onSelect(id); }}
          title={`${name || "部屋"}（クリックで選択 / 枠をドラッグで移動・リサイズ）`}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(255,255,255,0.94)", color: "#1e293b",
            padding: "3px 9px", borderRadius: 8, fontSize: 12, fontWeight: 700,
            whiteSpace: "nowrap", border: `1.5px solid ${c}`,
            boxShadow: selected ? "0 2px 8px rgba(0,0,0,0.28)" : "0 1px 3px rgba(0,0,0,0.2)",
            fontFamily: "Inter, sans-serif", cursor: "pointer",
            opacity: selected ? (dragInfo.current.type ? 0.6 : 1) : 0.85, transition: "opacity 0.2s",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 2, background: c, flexShrink: 0 }} />
          {name || "部屋"}
          {selected && (
            <span style={{ color: "#94a3b8", fontWeight: 600, fontSize: 9.5 }}>
              {(w / 1000).toFixed(2)}×{(d / 1000).toFixed(2)}m
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}

export default function RoomVisualizer({ orbitRef = null, isTopView = false }) {
  const rooms = useLayoutTaskStore((s) => s.rooms);
  const selectedRoomId = useLayoutTaskStore((s) => s.selectedRoomId);
  const setSelectedRoomId = useLayoutTaskStore((s) => s.setSelectedRoomId);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm) || 0;
  const activeFloorIndex = useBuildingSpecStore((s) => s.activeFloorIndex) || 0;

  const isVisibleMode = editorMode === "layout" || editorMode === "zoning";
  // 編集は Top ビュー＋レイアウト/ゾーニング中のみ（他ビューは表示だけ）。
  const editable = isTopView && isVisibleMode;

  const items = useMemo(() => {
    // 室＝範囲（矩形）。ゾーン（＝室内の機能バブル）の有無に関わらず、Room.rect を持つ
    // 部屋は常に矩形の枠で描く。ゾーンはこの上にバブルで重なる（表現が別なので二重にならない）。
    return (rooms || [])
      .filter((r) => r?.rect && (r.floorIndex || 0) === activeFloorIndex)
      .map((r) => ({ id: r.id, name: r.name, rect: r.rect, color: r.color || null }));
  }, [rooms, activeFloorIndex]);

  if (!isVisibleMode || !items.length) return null;

  return (
    <group userData={{ isEditorOverlay: true }}>
      {items.map((it) => (
        <RoomRectItem
          key={it.id}
          {...it}
          selected={selectedRoomId === it.id}
          editable={editable}
          orbitRef={orbitRef}
          onSelect={setSelectedRoomId}
          gridHeightMm={gridHeightMm}
        />
      ))}
    </group>
  );
}
