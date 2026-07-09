import React, { useRef, useCallback } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useZoningStore, rectToBounds } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";

// removed static FLOOR_Y
const MIN_SIZE = 0.3;

export const ZONE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function pickZoneColor(existingCount) {
  return ZONE_COLORS[existingCount % ZONE_COLORS.length];
}

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export default function ZoneDrawController() {
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

  const handlePointerDown = useCallback((e) => {
    if (!isZoningMode || zoningSubMode !== 'zone' || isZoningActionSelect) return;
    if (e.button !== 0) return; // Only process left click
    
    e.stopPropagation();
    const pt = { x: e.point.x, z: e.point.z };

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
        
        const newZone = {
          id: newZoneId,
          roomId: null,
          name: "New Zone",
          targetSeats: 0,
          category: "Work",
          color: newZoneColor,
          rect: bounds,
          createdBy: "system",
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
  }, [isZoningMode, zoningSubMode, isZoningActionSelect, getFloorPoint, setDrawingRect]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawing.current || !startRef.current) return;
    
    e.stopPropagation();
    const pt = { x: e.point.x, z: e.point.z };
    
    setDrawingRect({
      startX: startRef.current.x,
      startZ: startRef.current.z,
      endX: pt.x,
      endZ: pt.z
    });
  }, []);

  // Remove pointer up handler logic as we now use 2-click with pointer down
  const handlePointerUp = useCallback((e) => {}, []);

  const preview = drawingRect ? rectToBounds(drawingRect) : null;
  const pending = pendingZoneRect;
  const pendingColor = pickZoneColor(existingZoneCount);

  return (
    <>
      {/* 透明フロアプレーン */}
      {isZoningMode && zoningSubMode === 'zone' && (
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
      {preview && preview.width > 0.05 && preview.depth > 0.05 && (
        <group position={[preview.x, gridHeightMm + 0.1, preview.z]}>
          <mesh>
            <boxGeometry args={[preview.width, 0.015, preview.depth]} />
            <meshBasicMaterial color="#7c3aed" transparent opacity={0.25} depthWrite={false} />
          </mesh>
          {/* Edges removed as per user feedback */}
          <Html position={[0, 0.35, 0]} center style={{ pointerEvents: "none" }}>
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
              {preview.width.toFixed(1)}m × {preview.depth.toFixed(1)}m
            </div>
          </Html>
        </group>
      )}

      {/* ダイアログ待ち（確定済み・未命名）プレビュー */}
      {pending && !preview && (
        <group position={[pending.x, gridHeightMm + 0.1, pending.z]}>
          <mesh>
            <boxGeometry args={[pending.width, 0.015, pending.depth]} />
            <meshBasicMaterial color={pendingColor} transparent opacity={0.3} depthWrite={false} />
          </mesh>
          {/* Edges removed as per user feedback */}
          <Html position={[0, 0.5, 0]} center style={{ pointerEvents: "none" }}>
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
