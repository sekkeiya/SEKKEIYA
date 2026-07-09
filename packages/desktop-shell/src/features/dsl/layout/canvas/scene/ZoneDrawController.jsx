import React, { useRef, useCallback, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useZoningStore, rectToBounds } from "../../store/useZoningStore";
import { useLayoutTaskStore } from "../../store/useLayoutTaskStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useAutoLayoutStore } from "../../store/useAutoLayoutStore";
import { getRoomCategories } from "../../constants/roomCategories";

// ワールド座標 = mm
const MIN_SIZE = 300; // 最小ゾーンサイズ (mm)

export const ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function pickZoneColor(existingCount) {
  return ZONE_COLORS[existingCount % ZONE_COLORS.length];
}

/**
 * roomSpec { widthMm, depthMm, wallThicknessMm } から部屋内側の境界を返す（mm）。
 * ParametricRoom は原点中心・壁外面が床端に揃う構成のため、内側 = ±(W/2 - T)。
 */
export function roomInnerBounds(roomSpec) {
  if (!roomSpec?.widthMm || !roomSpec?.depthMm) return null;
  const W = Number(roomSpec.widthMm);
  const D = Number(roomSpec.depthMm);
  const T = Number(roomSpec.wallThicknessMm ?? 100);
  return {
    minX: -(W / 2 - T),
    maxX: W / 2 - T,
    minZ: -(D / 2 - T),
    maxZ: D / 2 - T,
  };
}

/** 点を境界内にクランプ */
function clampPoint(pt, b) {
  if (!b) return pt;
  return {
    x: Math.max(b.minX, Math.min(b.maxX, pt.x)),
    z: Math.max(b.minZ, Math.min(b.maxZ, pt.z)),
  };
}

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * ゾーン描画コントローラ。
 * - enabled（Topビュー）でのみ作成可能
 * - 壁の外でクリック/ドラッグしても部屋内側にクランプされる
 * - Escape で描画キャンセル
 */
export default function ZoneDrawController({ enabled = true, roomSpec = null }) {
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const existingZoneCount = useLayoutTaskStore((s) => s.zones.length);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isZoningMode = editorMode === "zoning" || editorMode === "layout";
  const zoningSubMode = useZoningStore((s) => s.zoningSubMode);
  const isZoningActionSelect = useZoningStore((s) => s.isZoningActionSelect);
  const drawingRect = useZoningStore((s) => s.drawingRect);
  const pendingZoneRect = useZoningStore((s) => s.pendingZoneRect);
  const setDrawingRect = useZoningStore((s) => s.setDrawingRect);
  const setPendingZoneRect = useZoningStore((s) => s.setPendingZoneRect);

  const { camera, raycaster, gl } = useThree();
  const startRef = useRef(null);
  const isDrawing = useRef(false);

  const innerBounds = roomInnerBounds(roomSpec);

  const getFloorPoint = useCallback((e) => {
    const rect = gl.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera({ x: nx, y: ny }, camera);
    const target = new THREE.Vector3();

    // Update plane dynamically based on gridHeightMm
    floorPlane.constant = -gridHeightMm;

    raycaster.ray.intersectPlane(floorPlane, target);
    return target ? { x: target.x, z: target.z } : null;
  }, [camera, raycaster, gl, gridHeightMm]);

  const cancelDrawing = useCallback(() => {
    isDrawing.current = false;
    startRef.current = null;
    setDrawingRect(null);
  }, [setDrawingRect]);

  // Escape で描画キャンセル
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && isDrawing.current) {
        e.stopPropagation();
        cancelDrawing();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelDrawing]);

  // Topビューから離れたら描画中断
  useEffect(() => {
    if (!enabled && isDrawing.current) cancelDrawing();
  }, [enabled, cancelDrawing]);

  const handlePointerDown = useCallback((e) => {
    if (!enabled) return; // Topビューのみ作成可
    if (!isZoningMode || zoningSubMode !== 'zone' || isZoningActionSelect) return;
    if (e.button !== 0) return; // Only process left click

    e.stopPropagation();
    // 壁の外クリックでも部屋内側にクランプ
    const pt = clampPoint({ x: e.point.x, z: e.point.z }, innerBounds);

    if (!isDrawing.current) {
      // First click: start drawing
      useLayoutTaskStore.getState().setActiveZoneId(null);
      useUiSelectionStore.getState().setSelectedItemIds([]);

      isDrawing.current = true;
      startRef.current = pt;
      setDrawingRect({ startX: pt.x, startZ: pt.z, endX: pt.x, endZ: pt.z });
    } else {
      // Second click: finish drawing
      isDrawing.current = false;
      const end = pt;
      const dr = { startX: startRef.current.x, startZ: startRef.current.z, endX: end.x, endZ: end.z };
      const bounds = rectToBounds(dr);

      setDrawingRect(null);
      startRef.current = null;

      if (bounds.width >= MIN_SIZE && bounds.depth >= MIN_SIZE) {
        // Create immediately
        const currentZones = useLayoutTaskStore.getState().zones;
        const newZoneColor = pickZoneColor(currentZones.length);
        const newZoneId = `zone-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

        // デフォルトカテゴリ: 建物タイプの「汎用」
        const buildingType = useAutoLayoutStore.getState().buildingType ?? 'residential';
        const generalCat = getRoomCategories(buildingType).find(c => c.key === 'general');

        const newZone = {
          id: newZoneId,
          roomId: null,
          name: generalCat?.label ?? "汎用",
          targetSeats: 0,
          category: generalCat?.key ?? "general",
          color: newZoneColor,
          rect: bounds,
          createdBy: "user",
          createdAtMs: Date.now(),
        };

        window.dispatchEvent(
          new CustomEvent("LayoutShell:UpdateZonesArray", {
            detail: { zones: [...currentZones, newZone] },
          })
        );

        // Automatically select the newly created zone
        useLayoutTaskStore.getState().setActiveZoneId(newZoneId);

        // Auto return to select mode
        useZoningStore.getState().setIsZoningActionSelect(true);
      }
    }
  }, [enabled, isZoningMode, zoningSubMode, isZoningActionSelect, setDrawingRect, innerBounds]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawing.current || !startRef.current) return;

    e.stopPropagation();
    const pt = clampPoint({ x: e.point.x, z: e.point.z }, innerBounds);

    setDrawingRect({
      startX: startRef.current.x,
      startZ: startRef.current.z,
      endX: pt.x,
      endZ: pt.z
    });
  }, [innerBounds, setDrawingRect]);

  // Remove pointer up handler logic as we now use 2-click with pointer down
  const handlePointerUp = useCallback((e) => {}, []);

  const preview = drawingRect ? rectToBounds(drawingRect) : null;
  const pending = pendingZoneRect;
  const pendingColor = pickZoneColor(existingZoneCount);

  return (
    <>
      {/* 透明フロアプレーン（Topビューのみ） */}
      {enabled && isZoningMode && zoningSubMode === 'zone' && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, gridHeightMm, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[100000, 100000]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>
      )}

      {/* ライブドラッグプレビュー */}
      {preview && preview.width > 50 && preview.depth > 50 && (
        <group position={[preview.x, gridHeightMm + 1, preview.z]}>
          <mesh>
            <boxGeometry args={[preview.width, 15, preview.depth]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.25} depthWrite={false} />
          </mesh>
          <Html position={[0, 350, 0]} center style={{ pointerEvents: "none" }}>
            <div style={{
              background: "rgba(124,58,237,0.75)",
              color: "#ede9fe",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap",
            }}>
              {(preview.width / 1000).toFixed(2)}m × {(preview.depth / 1000).toFixed(2)}m
              <span style={{ opacity: 0.8, marginLeft: 6 }}>
                {((preview.width * preview.depth) / 1_000_000).toFixed(1)}㎡
              </span>
            </div>
          </Html>
        </group>
      )}

      {/* ダイアログ待ち（確定済み・未命名）プレビュー */}
      {pending && !preview && (
        <group position={[pending.x, gridHeightMm + 1, pending.z]}>
          <mesh>
            <boxGeometry args={[pending.width, 15, pending.depth]} />
            <meshBasicMaterial color={pendingColor} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          <Html position={[0, 500, 0]} center style={{ pointerEvents: "none" }}>
            <div style={{
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 11,
              fontFamily: "Inter, sans-serif",
              whiteSpace: "nowrap",
              border: `1px solid ${pendingColor}`,
            }}>
              名前を入力してください...
            </div>
          </Html>
        </group>
      )}
    </>
  );
}
