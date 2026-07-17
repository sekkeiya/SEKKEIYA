import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneObjectRegistryStore } from '../../store/sceneObjectRegistryStore';
import { useLayoutTaskStore } from '../../store/useLayoutTaskStore';
import { useEditorModeStore } from '../../store/useEditorModeStore';
import { useZoningStore } from '../../store/useZoningStore';
import { useAutoLayoutStore } from '../../store/useAutoLayoutStore';
import { useSelectionScopeStore, canSelectZone } from '../../store/useSelectionScopeStore';
import { zoneCategoryLabel, zoneAreaLabel, getRoomCategoryMeta } from '../../constants/roomCategories';

export const BOX_H = 10; // mm thickness for the zone box
const SNAP_DIST = 300; // snapping threshold in mm
const MIN_ZONE_SIZE = 300; // mm
const EDGE_TOL_PX = 10;   // 枠の掴み判定幅（スクリーンpx基準）
const MARKER_PX = 8;      // 可視ハンドルの一辺（スクリーンpx基準）

const REGION_CURSOR = {
  edge_n: 'ns-resize', edge_s: 'ns-resize',
  edge_e: 'ew-resize', edge_w: 'ew-resize',
  corner_nw: 'nwse-resize', corner_se: 'nwse-resize',
  corner_ne: 'nesw-resize', corner_sw: 'nesw-resize',
  center: 'move', // 手（grab）は使わない
};

/**
 * ゾーンの選択・移動・リサイズギズモ。
 * - editable=true（Topビュー）でのみ移動/リサイズ/削除可能
 * - 枠の掴み判定・可視ハンドルはスクリーンpx基準（ズームに依らず一定の操作感）
 * - 枠（辺/コーナー）ドラッグ=リサイズ、内側ドラッグ=移動
 * - 移動/リサイズは roomBounds（部屋内側境界）にクランプ + 壁コライダーにスナップ
 * - Delete / Backspace で選択中ゾーンを削除
 */
export default function ZoneActiveGizmo({
  zone, orbitRef, versionLabel = "", isActive = false,
  editable = false, roomBounds = null,
}) {
  const { camera, gl } = useThree();
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders) || [];
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const buildingType = useAutoLayoutStore((s) => s.buildingType);

  // Local drag state for immediate visual feedback
  const [dr, setDr] = useState(null);
  const [hovered, setHovered] = useState(false);

  // スクリーンpx → ワールドmm 換算（直交カメラの zoom から毎フレーム追従）
  const pxWorldRef = useRef(4);
  const [pxWorld, setPxWorld] = useState(4);
  useFrame(({ camera: cam }) => {
    const pw = cam.isOrthographicCamera ? 1 / Math.max(cam.zoom, 1e-6) : 4;
    if (Math.abs(pw - pxWorldRef.current) > pxWorldRef.current * 0.08) {
      pxWorldRef.current = pw;
      setPxWorld(pw);
    }
  });

  // Dragging meta refs
  const dragInfo = useRef({
    type: null, // "center" | "edge_n/s/e/w" | "corner_ne/nw/se/sw"
    startX: 0,
    startZ: 0,
    initialRect: null,
  });

  const getPointerPos = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const dynamicPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gridHeightMm);

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: nx, y: ny }, camera);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(dynamicPlane, target);
      return target;
    },
    [camera, gl, gridHeightMm]
  );

  const getSnappedWallPos = useCallback((rayOrigin, rayDir, fallback) => {
    if (!baseColliders || baseColliders.length === 0) return fallback;
    const raycaster = new THREE.Raycaster(rayOrigin, rayDir);
    // slightly lift the ray so it doesn't just hit the floor.
    rayOrigin.y = 500;

    const hitForward = raycaster.intersectObjects(baseColliders, true)[0];
    raycaster.ray.direction.negate();
    const hitBack = raycaster.intersectObjects(baseColliders, true)[0];

    let bestPoint = fallback;
    let minDiff = SNAP_DIST;

    if (hitForward && hitForward.distance < minDiff) {
      bestPoint = hitForward.point;
      minDiff = hitForward.distance;
    }
    if (hitBack && hitBack.distance < minDiff) {
      bestPoint = hitBack.point;
    }
    return bestPoint;
  }, [baseColliders]);

  /** rect を部屋内側境界にクランプ（サイズ優先で位置を調整） */
  const clampRect = useCallback((rect) => {
    if (!roomBounds) return rect;
    const r = { ...rect };
    const bw = roomBounds.maxX - roomBounds.minX;
    const bd = roomBounds.maxZ - roomBounds.minZ;
    r.width = Math.min(r.width, bw);
    r.depth = Math.min(r.depth, bd);
    r.x = Math.max(roomBounds.minX + r.width / 2, Math.min(roomBounds.maxX - r.width / 2, r.x));
    r.z = Math.max(roomBounds.minZ + r.depth / 2, Math.min(roomBounds.maxZ - r.depth / 2, r.z));
    return r;
  }, [roomBounds]);

  /** リサイズ時のエッジ座標を境界内にクランプ */
  const clampEdgeX = useCallback((x) => {
    if (!roomBounds) return x;
    return Math.max(roomBounds.minX, Math.min(roomBounds.maxX, x));
  }, [roomBounds]);
  const clampEdgeZ = useCallback((z) => {
    if (!roomBounds) return z;
    return Math.max(roomBounds.minZ, Math.min(roomBounds.maxZ, z));
  }, [roomBounds]);

  /** 現在の編集モードでこのゾーンを操作してよいか */
  const canInteract = useCallback(() => {
    if (!editable) return false;
    const store = useZoningStore.getState();
    const modeStore = useEditorModeStore.getState();
    if (modeStore.editorMode === 'zoning') {
      if (store.zoningSubMode !== 'zone') return false; // CirculationController に委譲
      if (!store.isZoningActionSelect) return false;     // ZoneDrawController に委譲
    }
    if (!canSelectZone(useSelectionScopeStore.getState().scope)) return false;
    return true;
  }, [editable]);

  /**
   * ワールド座標 (wx, wz) がゾーンのどの領域か判定する。
   * 枠の掴み幅はスクリーンpx基準。小さいゾーンでは内側移動領域を確保するため縮小する。
   */
  const regionFromPoint = useCallback((wx, wz) => {
    const r = dr || zone.rect;
    if (!r) return null;
    const tol = EDGE_TOL_PX * pxWorldRef.current;
    // 細いゾーンで枠判定が内部を覆い潰さないよう、軸ごとに上限を設ける
    const tolX = Math.min(tol, r.width / 4);
    const tolZ = Math.min(tol, r.depth / 4);
    const minXr = r.x - r.width / 2, maxXr = r.x + r.width / 2;
    const minZr = r.z - r.depth / 2, maxZr = r.z + r.depth / 2;
    // 枠の外側 tol まで掴める
    if (wx < minXr - tol || wx > maxXr + tol || wz < minZr - tol || wz > maxZr + tol) return null;
    const nearW = Math.abs(wx - minXr) <= Math.max(tolX, Math.min(tol, 150));
    const nearE = Math.abs(wx - maxXr) <= Math.max(tolX, Math.min(tol, 150));
    const nearN = Math.abs(wz - minZr) <= Math.max(tolZ, Math.min(tol, 150));
    const nearS = Math.abs(wz - maxZr) <= Math.max(tolZ, Math.min(tol, 150));
    if (nearN && nearW) return 'corner_nw';
    if (nearN && nearE) return 'corner_ne';
    if (nearS && nearW) return 'corner_sw';
    if (nearS && nearE) return 'corner_se';
    if (nearN) return 'edge_n';
    if (nearS) return 'edge_s';
    if (nearE) return 'edge_e';
    if (nearW) return 'edge_w';
    if (wx > minXr && wx < maxXr && wz > minZr && wz < maxZr) return 'center';
    return null;
  }, [dr, zone.rect]);

  const handlePointerDown = useCallback((e, type) => {
    if (!canInteract()) return;
    if (e.button !== 0) return; // Only process left click
    e.stopPropagation();

    // 非選択ゾーンは選択してそのままドラッグ開始（1ジェスチャで選択+移動）
    if (!isActive) {
      useLayoutTaskStore.getState().setActiveZoneId(zone.id);
    }

    if (orbitRef && orbitRef.current) orbitRef.current.enabled = false;
    // ドラッグ中もホバー時と同じカーソルを保つ（手＝grabbing は使わない）
    gl.domElement.style.cursor = REGION_CURSOR[type] ?? 'move';

    const p = getPointerPos(e);
    dragInfo.current = {
      type,
      startX: p.x,
      startZ: p.z,
      initialRect: { ...zone.rect },
    };

    setDr({ ...zone.rect });
  }, [zone.rect, zone.id, isActive, getPointerPos, orbitRef, gl, canInteract]);

  const handlePointerMove = useCallback((e) => {
    if (!dragInfo.current.type) return;
    e.stopPropagation();

    const p = getPointerPos(e);
    const info = dragInfo.current;
    const dx = p.x - info.startX;
    const dz = p.z - info.startZ;
    const initial = info.initialRect;

    let newRect = { ...initial };
    const type = info.type;

    if (type === 'center') {
      newRect.x += dx;
      newRect.z += dz;
      newRect = clampRect(newRect);
    } else {
      // エッジ/コーナーのリサイズ。コーナーは2軸同時。
      const resizeE = type === 'edge_e' || type === 'corner_ne' || type === 'corner_se';
      const resizeW = type === 'edge_w' || type === 'corner_nw' || type === 'corner_sw';
      const resizeS = type === 'edge_s' || type === 'corner_se' || type === 'corner_sw';
      const resizeN = type === 'edge_n' || type === 'corner_ne' || type === 'corner_nw';

      const rayOrigin = new THREE.Vector3(newRect.x, 0, newRect.z);

      if (resizeE) { // East edge is +X
        let targetEdgeX = (initial.x + initial.width / 2) + dx;
        rayOrigin.setX(targetEdgeX);
        const snappedEdge = getSnappedWallPos(rayOrigin.clone(), new THREE.Vector3(1, 0, 0), rayOrigin.clone());
        const newMaxX = clampEdgeX(snappedEdge.x);
        const minX = initial.x - initial.width / 2;
        newRect.width = Math.max(MIN_ZONE_SIZE, newMaxX - minX);
        newRect.x = minX + newRect.width / 2;
      }
      if (resizeW) { // West edge is -X
        let targetEdgeX = (initial.x - initial.width / 2) + dx;
        rayOrigin.setX(targetEdgeX);
        const snappedEdge = getSnappedWallPos(rayOrigin.clone(), new THREE.Vector3(-1, 0, 0), rayOrigin.clone());
        const newMinX = clampEdgeX(snappedEdge.x);
        const maxX = initial.x + initial.width / 2;
        newRect.width = Math.max(MIN_ZONE_SIZE, maxX - newMinX);
        newRect.x = maxX - newRect.width / 2;
      }
      if (resizeS) { // South edge is +Z
        let targetEdgeZ = (initial.z + initial.depth / 2) + dz;
        rayOrigin.setZ(targetEdgeZ);
        const snappedEdge = getSnappedWallPos(rayOrigin.clone(), new THREE.Vector3(0, 0, 1), rayOrigin.clone());
        const newMaxZ = clampEdgeZ(snappedEdge.z);
        const minZ = initial.z - initial.depth / 2;
        newRect.depth = Math.max(MIN_ZONE_SIZE, newMaxZ - minZ);
        newRect.z = minZ + newRect.depth / 2;
      }
      if (resizeN) { // North edge is -Z
        let targetEdgeZ = (initial.z - initial.depth / 2) + dz;
        rayOrigin.setZ(targetEdgeZ);
        const snappedEdge = getSnappedWallPos(rayOrigin.clone(), new THREE.Vector3(0, 0, -1), rayOrigin.clone());
        const newMinZ = clampEdgeZ(snappedEdge.z);
        const maxZ = initial.z + initial.depth / 2;
        newRect.depth = Math.max(MIN_ZONE_SIZE, maxZ - newMinZ);
        newRect.z = maxZ - newRect.depth / 2;
      }
    }

    setDr(newRect);
  }, [getPointerPos, getSnappedWallPos, clampRect, clampEdgeX, clampEdgeZ]);

  const handlePointerUp = useCallback((e) => {
    if (!dragInfo.current.type) return;
    e.stopPropagation();

    if (orbitRef && orbitRef.current) orbitRef.current.enabled = true;
    gl.domElement.style.cursor = ''; // 指定を外す（'default' は他のホバーカーソルを塗り潰す）

    const finalRect = dr || zone.rect;

    if (dr) {
      if (e.altKey) {
        const newZoneId = `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
        const newZone = {
           ...zone,
           id: newZoneId,
           name: `${zone.name} (Copy)`,
           rect: finalRect,
        };
        const currentZones = useLayoutTaskStore.getState().zones;
        window.dispatchEvent(new CustomEvent("LayoutShell:UpdateZonesArray", {
            detail: { zones: [...currentZones, newZone] }
        }));
        useLayoutTaskStore.getState().setActiveZoneId(newZoneId);
      } else {
        window.dispatchEvent(
          new CustomEvent("LayoutShell:UpdateZone", {
            detail: {
              id: zone.id,
              rect: finalRect,
              __merge: true
            }
          })
        );
      }
    }

    dragInfo.current.type = null;
    setDr(null);
  }, [orbitRef, gl, dr, zone]);

  // Hook global pointerup / pointermove just in case they drag outside the mesh
  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // Delete / Backspace で選択中ゾーンを削除（テキスト入力中は無視）
  useEffect(() => {
    if (!isActive || !editable) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("LayoutShell:DeleteZone", { detail: { id: zone.id } }));
      } else if (e.key === 'Escape' && !dragInfo.current.type) {
        useLayoutTaskStore.getState().setActiveZoneId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, editable, zone.id]);

  const renderRect = dr || zone.rect;
  const { width, depth, x = 0, z = 0 } = renderRect;

  const showHandles = editable && isActive;

  // ラベル: カテゴリ名 + 面積（㎡）
  const catMeta = getRoomCategoryMeta(zone.category, buildingType);
  const labelTitle = zoneCategoryLabel(zone, buildingType);
  const areaText = zoneAreaLabel(renderRect);
  const labelColor = zone.color || catMeta?.color || "#94a3b8";

  // 可視ハンドル（スクリーンpx基準サイズ）
  const mk = MARKER_PX * pxWorld;
  const tolWorld = EDGE_TOL_PX * pxWorld;
  const markers = [
    // corners
    [width / 2, depth / 2], [-width / 2, depth / 2], [width / 2, -depth / 2], [-width / 2, -depth / 2],
    // edge midpoints
    [0, depth / 2], [0, -depth / 2], [width / 2, 0], [-width / 2, 0],
  ];

  return (
    <group position={[x, BOX_H / 2 + gridHeightMm, z]}>
      {/* 1) ゾーン本体（非選択時のみクリック/ドラッグを受ける。選択中はピックプレーンが担当） */}
      <mesh
        onPointerDown={editable && !isActive ? (e) => handlePointerDown(e, 'center') : undefined}
        onClick={editable && !isActive ? (e) => {
          e.stopPropagation();
          if (!canInteract()) return;
          if (!dragInfo.current.type) {
            useLayoutTaskStore.getState().setActiveZoneId(zone.id);
          }
        } : undefined}
        onPointerOver={editable && !isActive ? () => {
          if (!canInteract()) return;
          setHovered(true);
          gl.domElement.style.cursor = 'move'; // 掴んでそのまま動かせる（手＝pointer は使わない）
        } : undefined}
        onPointerOut={editable && !isActive ? () => {
          setHovered(false);
          if (!dragInfo.current.type) gl.domElement.style.cursor = ''; // 指定を外す（'default' は他のホバーカーソルを塗り潰す）
        } : undefined}
      >
        <boxGeometry args={[width, BOX_H, depth]} />
        <meshBasicMaterial
          color={labelColor}
          transparent
          opacity={isActive ? 0.40 : hovered ? 0.26 : 0.18}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* 選択中の境界線 */}
      {isActive && (
        <lineSegments position={[0, BOX_H / 2 + 1, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(width, 0.1, depth)]} />
          <lineBasicMaterial color={labelColor} transparent opacity={0.9} depthTest={false} />
        </lineSegments>
      )}

      {showHandles && (
        <>
          {/* 統合ピックプレーン: 枠±tol を覆い、座標から領域（辺/コーナー/内側）を判定 */}
          <mesh
            position={[0, BOX_H + 2, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            onPointerMove={(e) => {
              if (dragInfo.current.type) return;
              const reg = regionFromPoint(e.point.x, e.point.z);
              if (reg) {
                e.stopPropagation();
                gl.domElement.style.cursor = REGION_CURSOR[reg];
              }
            }}
            onPointerDown={(e) => {
              const reg = regionFromPoint(e.point.x, e.point.z);
              if (!reg) return;
              handlePointerDown(e, reg);
            }}
            onPointerOut={() => {
              if (!dragInfo.current.type) gl.domElement.style.cursor = ''; // 指定を外す（'default' は他のホバーカーソルを塗り潰す）
            }}
          >
            <planeGeometry args={[width + tolWorld * 2, depth + tolWorld * 2]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>

          {/* 可視ハンドル: コーナー4 + 辺中点4 の白い角（スクリーンサイズ一定） */}
          {markers.map(([mx, mz], i) => (
            <mesh key={i} position={[mx, BOX_H + 3, mz]}>
              <boxGeometry args={[mk, 2, mk]} />
              <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
            </mesh>
          ))}
          {markers.map(([mx, mz], i) => (
            <mesh key={`b${i}`} position={[mx, BOX_H + 2.5, mz]}>
              <boxGeometry args={[mk * 1.5, 2, mk * 1.5]} />
              <meshBasicMaterial color={labelColor} depthTest={false} depthWrite={false} />
            </mesh>
          ))}
        </>
      )}

      {/* Center Label: カテゴリ名 + 面積 */}
      <Html
        position={[0, BOX_H + 5, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          background: labelColor,
          color: "#fff",
          padding: "3px 9px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap",
          boxShadow: isActive ? `0 0 10px ${labelColor}` : "none",
          fontFamily: "Inter, sans-serif",
          opacity: isActive ? (dragInfo.current.type ? 0.6 : 1) : 0.5,
          transition: "opacity 0.2s",
        }}>
          {catMeta?.icon ? `${catMeta.icon} ` : ''}{labelTitle}{versionLabel}
          <span style={{ opacity: 0.85, marginLeft: 6, fontSize: 11 }}>
            {areaText}
          </span>
          {isActive && (
            <span style={{ opacity: 0.6, marginLeft: 5, fontSize: 9.5 }}>
              {(width / 1000).toFixed(2)}×{(depth / 1000).toFixed(2)}m
            </span>
          )}
        </div>
      </Html>
    </group>
  );
}
