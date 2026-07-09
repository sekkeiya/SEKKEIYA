import React, { useRef, useCallback, useEffect, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

// Spec colors: main = purple, sub = green
const CIRC_COLOR = { main: "#7F77DD", sub: "#1D9E75" };

const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export default function ZoneCirculationController() {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isZoningMode = editorMode === "zoning" || editorMode === "layout";
  const zoningSubMode           = useZoningStore((s) => s.zoningSubMode);
  const isZoningActionSelect    = useZoningStore((s) => s.isZoningActionSelect);
  const currentDrawingPoints    = useZoningStore((s) => s.currentDrawingPoints);
  const addDrawingPoint         = useZoningStore((s) => s.addDrawingPoint);
  const removeLastDrawingPoint  = useZoningStore((s) => s.removeLastDrawingPoint);
  const clearDrawingPoints      = useZoningStore((s) => s.clearDrawingPoints);
  const circulationType         = useZoningStore((s) => s.circulationType);
  const circulationWidths       = useZoningStore((s) => s.circulationWidths);
  const circulationUsage        = useZoningStore((s) => s.circulationUsage);
  const selectedCirculationId   = useZoningStore((s) => s.selectedCirculationId);

  const zones        = useLayoutTaskStore((s) => s.zones);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);

  const { camera, raycaster, gl, pointer } = useThree();
  const hoverPointRef = useRef(null);
  const lastClickTime = useRef(0);
  const isDrawing = currentDrawingPoints.length > 0;

  // ─── Floor-plane raycasting ───────────────────────────────────────────────
  const getFloorPoint = useCallback(
    (e) => {
      const rect = gl.domElement.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x: nx, y: ny }, camera);
      const target = new THREE.Vector3();
      floorPlane.constant = -gridHeightMm;
      raycaster.ray.intersectPlane(floorPlane, target);
      return target ? { x: target.x, z: target.z } : null;
    },
    [camera, raycaster, gl, gridHeightMm]
  );

  // ─── Reset on mode exit ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isZoningMode || zoningSubMode !== "circulation" || isZoningActionSelect) {
      clearDrawingPoints();
    }
  }, [isZoningMode, zoningSubMode, isZoningActionSelect, clearDrawingPoints]);

  // ─── Finish drawing ───────────────────────────────────────────────────────
  const finishDrawing = useCallback(() => {
    const pts = useZoningStore.getState().currentDrawingPoints;
    if (pts.length < 2) {
      clearDrawingPoints();
      return;
    }
    const w = circulationWidths[circulationType];
    const newCirc = {
      id: `circ-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      type: circulationType,
      width: w,
      usage: useZoningStore.getState().circulationUsage,
      points: pts,
    };
    const currentCirculations = useLayoutTaskStore.getState().circulations || [];
    const newCirculations = [...currentCirculations, newCirc];
    window.dispatchEvent(
      new CustomEvent("LayoutShell:UpdateCirculations", {
        detail: { circulations: newCirculations },
      })
    );
    clearDrawingPoints();
  }, [circulationType, circulationWidths, clearDrawingPoints]);

  // ─── Pointer events ───────────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e) => {
      if (!isZoningMode || zoningSubMode !== "circulation" || isZoningActionSelect) return;
      if (e.button !== 0) return; // ignore non-left clicks

      e.stopPropagation();
      const pt = { x: e.point.x, z: e.point.z };

      useUiSelectionStore.getState().setSelectedItemIds([]);
      useLayoutTaskStore.getState().setActiveZoneId(null);

      // Double-click to finish
      const now = Date.now();
      if (lastClickTime.current && now - lastClickTime.current < 300) {
        if (isDrawing) {
          finishDrawing();
        }
        return;
      }
      lastClickTime.current = now;

      // Shift + click → snap to horizontal OR vertical from the last point
      if (e.shiftKey && isDrawing) {
        const last = currentDrawingPoints[currentDrawingPoints.length - 1];
        const dx = Math.abs(pt.x - last.x);
        const dz = Math.abs(pt.z - last.z);
        const snapped = dx >= dz
          ? { x: pt.x, z: last.z }   // horizontal (same Z)
          : { x: last.x, z: pt.z };  // vertical (same X)
        addDrawingPoint(snapped);
        return;
      }

      addDrawingPoint(pt);
    },
    [
      isZoningMode, zoningSubMode, isZoningActionSelect, selectedCirculationId,
      isDrawing, currentDrawingPoints,
      addDrawingPoint, finishDrawing,
    ]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isZoningMode || zoningSubMode !== "circulation" || isZoningActionSelect) return;
      const pt = getFloorPoint(e.nativeEvent ?? e);
      if (pt) hoverPointRef.current = pt;
    },
    [isZoningMode, zoningSubMode, isZoningActionSelect, getFloorPoint]
  );

  // ─── Native Window PointerMove for Dragging ─────────────────────────────
  // ─── Native Window PointerMove for Dragging ─────────────────────────────
  const dragFinalPosRef = useRef(null);
  const dragPrevPosRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const handleGlobalPointerMove = (e) => {
      const state = useZoningStore.getState();
      if (state.draggingCirculationNodeIndex !== null && state.selectedCirculationId) {
        if (rafRef.current) return;
        
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          let pt = getFloorPoint(e);
          if (pt) {
            let dx = 0;
            let dz = 0;
            if (dragPrevPosRef.current) {
              dx = pt.x - dragPrevPosRef.current.x;
              dz = pt.z - dragPrevPosRef.current.z;
            }
            dragPrevPosRef.current = { x: pt.x, z: pt.z };

            if (e.shiftKey && state.draggingCirculationNodeIndex !== 'all') {
              const circs = useLayoutTaskStore.getState().circulations || [];
              const circ = circs.find(c => c.id === state.selectedCirculationId);
              if (circ && circ.points) {
                const nodeIdx = state.draggingCirculationNodeIndex;
                const prev = circ.points[nodeIdx - 1];
                const next = circ.points[nodeIdx + 1];
                
                let snapX = null;
                let snapZ = null;
                let minDx = Infinity;
                let minDz = Infinity;

                if (prev) {
                  const dx = Math.abs(pt.x - prev.x);
                  const dz = Math.abs(pt.z - prev.z);
                  if (dx < minDx) { minDx = dx; snapX = prev.x; }
                  if (dz < minDz) { minDz = dz; snapZ = prev.z; }
                }
                if (next) {
                  const dx = Math.abs(pt.x - next.x);
                  const dz = Math.abs(pt.z - next.z);
                  if (dx < minDx) { minDx = dx; snapX = next.x; }
                  if (dz < minDz) { minDz = dz; snapZ = next.z; }
                }

                if (minDx < minDz && snapX !== null) {
                  pt.x = snapX;
                } else if (snapZ !== null) {
                  pt.z = snapZ;
                }
              }
            }

            dragFinalPosRef.current = pt;
            window.dispatchEvent(new CustomEvent("CirculationNodeDrag", {
              detail: {
                circId: state.selectedCirculationId,
                nodeIndex: state.draggingCirculationNodeIndex,
                pt,
                delta: { dx, dz }
              }
            }));
          }
        });
      }
    };
    window.addEventListener("pointermove", handleGlobalPointerMove);
    return () => {
      window.removeEventListener("pointermove", handleGlobalPointerMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getFloorPoint]);

  // Global pointer up to commit drag
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      const state = useZoningStore.getState();
      if (state.draggingCirculationNodeIndex !== null && state.selectedCirculationId) {
        // Instead of calculating the final points here, we fire an event 
        // to let CirculationVisualizer commit its local state to the global store.
        window.dispatchEvent(new CustomEvent("CirculationDragEnd", {
          detail: { circId: state.selectedCirculationId }
        }));
        
        state.setDraggingCirculationNodeIndex(null);
        dragFinalPosRef.current = null;
        dragPrevPosRef.current = null;
      }
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    return () => window.removeEventListener("pointerup", handleGlobalPointerUp);
  }, []);

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      const state = useZoningStore.getState();
      const currentSubMode = state.zoningSubMode;
      const currentIsDrawing = state.currentDrawingPoints.length > 0;
      
      const emode = useEditorModeStore.getState().editorMode;
      if ((emode !== "zoning" && emode !== "layout") || (currentSubMode !== "circulation" && currentSubMode !== "select")) return;

      // Ignore if user is typing in an input field
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "Escape") {
        if (currentSubMode === "select" || (currentSubMode === "circulation" && !currentIsDrawing)) {
           state.setSelectedCirculationId(null);
           state.setSelectedCirculationNodeIndex(null);
        } else if (currentIsDrawing) {
           state.clearDrawingPoints();
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedCirculationId) {
        e.preventDefault();
        const currentCirculations = useLayoutTaskStore.getState().circulations || [];
        
        // If a node is selected, delete the node
        if (state.selectedCirculationNodeIndex !== null) {
          const nextCircs = currentCirculations.map(c => {
            if (c.id === state.selectedCirculationId) {
              const newPoints = [...c.points];
              newPoints.splice(state.selectedCirculationNodeIndex, 1);
              return { ...c, points: newPoints };
            }
            return c;
          }).filter(c => c.points.length >= 2); // Delete the entire circulation if it has < 2 points
          
          window.dispatchEvent(
            new CustomEvent("LayoutShell:UpdateCirculations", {
              detail: { circulations: nextCircs },
            })
          );
          state.setSelectedCirculationNodeIndex(null);
          if (!nextCircs.find(c => c.id === state.selectedCirculationId)) {
            state.setSelectedCirculationId(null);
          }
          return;
        }

        // Otherwise delete the whole circulation
        const newCirculations = currentCirculations.filter(c => c.id !== state.selectedCirculationId);
        window.dispatchEvent(
          new CustomEvent("LayoutShell:UpdateCirculations", {
            detail: { circulations: newCirculations },
          })
        );
        state.setSelectedCirculationId(null);
        return;
      }

      if (currentSubMode !== "circulation") return;

      if (e.key === "Enter" && currentIsDrawing) {
        finishDrawing();
        return;
      }

      if (e.key === "Backspace" && currentIsDrawing) {
        e.preventDefault();
        state.removeLastDrawingPoint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finishDrawing]);

  // ─── Live hover tracking (useFrame for smooth R3F updates) ───────────────
  const [mousePos, setMousePos] = useState(null);
  const [isShiftDown, setIsShiftDown] = useState(false);

  useEffect(() => {
    const handleKey = (e) => setIsShiftDown(e.shiftKey);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKey);
    };
  }, []);

  useFrame(() => {
    if (hoverPointRef.current) {
      const y = gridHeightMm + 0.05;
      setMousePos([hoverPointRef.current.x, y, hoverPointRef.current.z]);
    }
  });

  if (!isZoningMode || zoningSubMode !== "circulation" || isZoningActionSelect) return null;

  const y = gridHeightMm + 0.05;
  const color = CIRC_COLOR[circulationType] ?? CIRC_COLOR.main;
  const widthMm = circulationWidths[circulationType] ?? 600;

  const pts3D = currentDrawingPoints.map((p) => new THREE.Vector3(p.x, y, p.z));
  
  let snappedMousePos = mousePos;
  if (mousePos && isShiftDown && pts3D.length > 0) {
    const last = pts3D[pts3D.length - 1];
    const dx = Math.abs(mousePos[0] - last.x);
    const dz = Math.abs(mousePos[2] - last.z);
    snappedMousePos = dx >= dz
      ? [mousePos[0], mousePos[1], last.z]
      : [last.x, mousePos[1], mousePos[2]];
  }

  const previewPts = snappedMousePos
    ? [...pts3D, new THREE.Vector3(...snappedMousePos)]
    : pts3D;

  return (
    <>
      {/* ── Drawing preview (thick + dashed centerline + dots) ─────────── */}
      {isDrawing && previewPts.length >= 2 && (
        <group>
          <Line
            points={previewPts}
            color={color}
            lineWidth={widthMm}
            worldUnits={true}
            depthTest={false}
            transparent
            opacity={0.3}
          />
          <Line
            points={previewPts}
            color={color}
            lineWidth={2}
            worldUnits={false}
            dashed
            dashSize={0.2}
            gapSize={0.1}
            depthTest={false}
            transparent
            opacity={1.0}
          />
          {previewPts.map((pt, i) => (
            <mesh key={i} position={pt}>
              <circleGeometry args={[widthMm / 2, 32]} />
              <meshBasicMaterial color={color} depthTest={false} transparent />
            </mesh>
          ))}
        </group>
      )}

      {/* ── Invisible floor plane for pointer events ──────────────────── */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, y, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </>
  );
}

// ─── Zone highlight outline ────────────────────────────────────────────────
function ZoneHighlight({ zone, y, color }) {
  const { rect } = zone;
  const hw = rect.width / 2;
  const hd = rect.depth / 2;
  const cx = rect.x;
  const cz = rect.z;

  // Four corners of the zone rect
  const corners = [
    new THREE.Vector3(cx - hw, y, cz - hd),
    new THREE.Vector3(cx + hw, y, cz - hd),
    new THREE.Vector3(cx + hw, y, cz + hd),
    new THREE.Vector3(cx - hw, y, cz + hd),
    new THREE.Vector3(cx - hw, y, cz - hd), // close the loop
  ];

  return (
    <Line
      points={corners}
      color={color}
      lineWidth={2}
      dashed={false}
      depthTest={false}
      transparent
      opacity={0.8}
    />
  );
}
