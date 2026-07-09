import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneObjectRegistryStore } from '@desktop/features/dsl/layout/store/sceneObjectRegistryStore';
import { useLayoutTaskStore } from '@desktop/features/dsl/layout/store/useLayoutTaskStore';
import { useEditorModeStore } from '@desktop/features/dsl/layout/store/useEditorModeStore';
import { useZoningStore } from '@desktop/features/dsl/layout/store/useZoningStore';

export const BOX_H = 10; // mm thickness for the zone box
const SNAP_DIST = 300; // snapping threshold in mm

export default function ZoneActiveGizmo({ zone, orbitRef, versionLabel = "" }) {
  const { camera, gl } = useThree();
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders) || [];
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isReadOnly = editorMode === "layout";

  // Local drag state for immediate visual feedback
  const [dr, setDr] = useState(null);
  
  // Dragging meta refs
  const dragInfo = useRef({
    type: null, // "center", "edge_n", "edge_s", "edge_e", "edge_w"
    startX: 0,
    startZ: 0,
    initialRect: null,
    yPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
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
    
    // Test both directions along the axis? No, test ONE direction towards the wall.
    // Wait, if I am moving the East edge (right), it could snap to a wall further right OR a wall slightly left of my mouse.
    // So actually we should cast bidirectional rays, or simply cast 2 rays.
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

  const handlePointerDown = useCallback((e, type) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const store = useZoningStore.getState();
    const modeStore = useEditorModeStore.getState();
    
    if (modeStore.editorMode === 'layout') return; // Read-only in layout mode
    if (modeStore.editorMode === 'zoning' && store.zoningSubMode !== 'zone') return; // Let events pass to CirculationController
    if (modeStore.editorMode === 'zoning' && store.zoningSubMode === 'zone' && !store.isZoningActionSelect) return; // Let events pass to ZoneDrawController

    if (e.button !== 0) return; // Only process left click
    e.stopPropagation();
    if (orbitRef && orbitRef.current) orbitRef.current.enabled = false;
    gl.domElement.style.cursor = 'grabbing';

    const p = getPointerPos(e);
    dragInfo.current = {
      type,
      startX: p.x,
      startZ: p.z,
      initialRect: { ...zone.rect },
      yPlane: dragInfo.current.yPlane,
    };
    
    setDr({ ...zone.rect });
  }, [zone.rect, getPointerPos, orbitRef, gl]);

  const handlePointerMove = useCallback((e) => {
    if (!dragInfo.current.type) return;
    e.stopPropagation();

    const p = getPointerPos(e);
    const info = dragInfo.current;
    const dx = p.x - info.startX;
    const dz = p.z - info.startZ;
    const initial = info.initialRect;

    let newRect = { ...initial };

    if (info.type === 'center') {
      newRect.x += dx;
      newRect.z += dz;
    } else {
      // Logic for snapping edge:
      const rayOrigin = new THREE.Vector3(newRect.x, 0, newRect.z);
      
      if (info.type === 'edge_e') { // East edge is +X
         let targetEdgeX = (initial.x + initial.width / 2) + dx;
         rayOrigin.setX(targetEdgeX);
         const snappedEdge = getSnappedWallPos(rayOrigin, new THREE.Vector3(1, 0, 0), rayOrigin);
         const newMaxX = snappedEdge.x;
         const minX = initial.x - initial.width / 2;
         newRect.width = Math.max(10, newMaxX - minX);
         newRect.x = minX + newRect.width / 2;
      }
      if (info.type === 'edge_w') { // West edge is -X
         let targetEdgeX = (initial.x - initial.width / 2) + dx;
         rayOrigin.setX(targetEdgeX);
         const snappedEdge = getSnappedWallPos(rayOrigin, new THREE.Vector3(-1, 0, 0), rayOrigin);
         const newMinX = snappedEdge.x;
         const maxX = initial.x + initial.width / 2;
         newRect.width = Math.max(10, maxX - newMinX);
         newRect.x = maxX - newRect.width / 2;
      }
      if (info.type === 'edge_s') { // South edge is +Z
         let targetEdgeZ = (initial.z + initial.depth / 2) + dz;
         rayOrigin.setZ(targetEdgeZ);
         const snappedEdge = getSnappedWallPos(rayOrigin, new THREE.Vector3(0, 0, 1), rayOrigin);
         const newMaxZ = snappedEdge.z;
         const minZ = initial.z - initial.depth / 2;
         newRect.depth = Math.max(10, newMaxZ - minZ);
         newRect.z = minZ + newRect.depth / 2;
      }
      if (info.type === 'edge_n') { // North edge is -Z
         let targetEdgeZ = (initial.z - initial.depth / 2) + dz;
         rayOrigin.setZ(targetEdgeZ);
         const snappedEdge = getSnappedWallPos(rayOrigin, new THREE.Vector3(0, 0, -1), rayOrigin);
         const newMinZ = snappedEdge.z;
         const maxZ = initial.z + initial.depth / 2;
         newRect.depth = Math.max(10, maxZ - newMinZ);
         newRect.z = maxZ - newRect.depth / 2;
      }
    }

    setDr(newRect);
  }, [getPointerPos, getSnappedWallPos]);

  const handlePointerUp = useCallback((e) => {
    if (!dragInfo.current.type) return;
    e.stopPropagation();
    
    if (orbitRef && orbitRef.current) orbitRef.current.enabled = true;
    gl.domElement.style.cursor = 'default';

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
  React.useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  const renderRect = dr || zone.rect;
  const { width, depth, x = 0, z = 0 } = renderRect;

  // Handle sizes (invisible hitboxes for grabbing edges)
  const hs = 300; // handle size thickness in mm
  const handleColor = "#f59e0b"; // yellow orange

  const handleMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: handleColor, opacity: 0.0, transparent: true, depthWrite: false }), []);

  return (
    <group position={[x, BOX_H / 2 + gridHeightMm, z]}>
      {/* 1) Center Area (Move) */}
      <mesh
        onPointerDown={!isReadOnly ? (e) => handlePointerDown(e, 'center') : undefined}
        onClick={(e) => e.stopPropagation()}
        onPointerOver={!isReadOnly ? () => {
          const store = useZoningStore.getState();
          const modeStore = useEditorModeStore.getState();
          if (modeStore.editorMode === 'layout') return;
          if (modeStore.editorMode === 'zoning' && (store.zoningSubMode !== 'zone' || !store.isZoningActionSelect)) return;
          gl.domElement.style.cursor = 'grab';
        } : undefined}
        onPointerOut={!isReadOnly ? () => { if(!dragInfo.current.type) gl.domElement.style.cursor = 'default' } : undefined}
      >
        <boxGeometry args={[width, BOX_H, depth]} />
        <meshBasicMaterial color={zone.color} transparent opacity={0.4} depthTest={false} depthWrite={false} />
      </mesh>
      
      {/* Edges removed as per user feedback (they looked like thick double frames when raised above the floor) */}

      {!isReadOnly && (
        <>
          {/* 2) North Handle (-Z) */}
      <mesh 
        position={[0, 0, -depth / 2]} 
        material={handleMaterial}
        onPointerDown={(e) => handlePointerDown(e, 'edge_n')}
        onPointerOver={(e) => { 
          const store = useZoningStore.getState();
          const modeStore = useEditorModeStore.getState();
          if (modeStore.editorMode === 'zoning' && (store.zoningSubMode !== 'zone' || !store.isZoningActionSelect)) return;
          e.stopPropagation(); gl.domElement.style.cursor = 'ns-resize';
        }}
        onPointerOut={(e) => { if(!dragInfo.current.type) gl.domElement.style.cursor = 'default' }}
      >
        <boxGeometry args={[width, BOX_H * 2 + 10, hs]} />
      </mesh>

      {/* 3) South Handle (+Z) */}
      <mesh 
        position={[0, 0, depth / 2]} 
        material={handleMaterial}
        onPointerDown={(e) => handlePointerDown(e, 'edge_s')}
        onPointerOver={(e) => { 
          const store = useZoningStore.getState();
          const modeStore = useEditorModeStore.getState();
          if (modeStore.editorMode === 'zoning' && (store.zoningSubMode !== 'zone' || !store.isZoningActionSelect)) return;
          e.stopPropagation(); gl.domElement.style.cursor = 'ns-resize';
        }}
        onPointerOut={(e) => { if(!dragInfo.current.type) gl.domElement.style.cursor = 'default' }}
      >
        <boxGeometry args={[width, BOX_H * 2 + 10, hs]} />
      </mesh>

      {/* 4) East Handle (+X) */}
      <mesh 
        position={[width / 2, 0, 0]} 
        material={handleMaterial}
        onPointerDown={(e) => handlePointerDown(e, 'edge_e')}
        onPointerOver={(e) => { 
          const store = useZoningStore.getState();
          const modeStore = useEditorModeStore.getState();
          if (modeStore.editorMode === 'zoning' && (store.zoningSubMode !== 'zone' || !store.isZoningActionSelect)) return;
          e.stopPropagation(); gl.domElement.style.cursor = 'ew-resize';
        }}
        onPointerOut={(e) => { if(!dragInfo.current.type) gl.domElement.style.cursor = 'default' }}
      >
        <boxGeometry args={[hs, BOX_H * 2 + 10, depth]} />
      </mesh>

      {/* 5) West Handle (-X) */}
      <mesh 
        position={[-width / 2, 0, 0]} 
        material={handleMaterial}
        onPointerDown={(e) => handlePointerDown(e, 'edge_w')}
        onPointerOver={(e) => { 
          const store = useZoningStore.getState();
          const modeStore = useEditorModeStore.getState();
          if (modeStore.editorMode === 'zoning' && (store.zoningSubMode !== 'zone' || !store.isZoningActionSelect)) return;
          e.stopPropagation(); gl.domElement.style.cursor = 'ew-resize';
        }}
            onPointerOut={(e) => { if(!dragInfo.current.type) gl.domElement.style.cursor = 'default' }}
          >
            <boxGeometry args={[hs, BOX_H * 2 + 10, depth]} />
          </mesh>
        </>
      )}

      {/* Center Label */}
      <Html
        position={[0, BOX_H + 5, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div style={{
          background: zone.color || "#cccccc",
          color: "#fff",
          padding: "3px 9px",
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          whiteSpace: "nowrap",
          boxShadow: `0 0 10px ${zone.color || "#cccccc"}`,
          fontFamily: "Inter, sans-serif",
          opacity: dragInfo.current.type ? 0.6 : 1,
          transition: "opacity 0.2s"
        }}>
          {zone.name || "Unnamed Zone"}{versionLabel}
          <span style={{ opacity: 0.75, marginLeft: 5, fontSize: 10 }}>
            {Math.round(width)}×{Math.round(depth)}mm
          </span>
        </div>
      </Html>
    </group>
  );
}
