import React, { useState, useEffect } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useSelectionScopeStore, canSelectCirculation } from "@desktop/features/dsl/layout/store/useSelectionScopeStore";

export default function CirculationVisualizer({ circulations, isActive = false, onSelect, selectedCirculationId }) {
  const storeCirculations = useLayoutTaskStore(s => s.circulations) || [];
  const globalCirculations = circulations || storeCirculations;
  const [localCirculations, setLocalCirculations] = useState(globalCirculations);

  useEffect(() => {
    setLocalCirculations(globalCirculations);
  }, [globalCirculations]);

  useEffect(() => {
    const onDrag = (e) => {
      const { circId, nodeIndex, pt, delta } = e.detail;
      setLocalCirculations(prev => prev.map(c => {
        if (c.id === circId) {
          const newPoints = [...c.points];
          if (nodeIndex === 'all') {
            for (let i = 0; i < newPoints.length; i++) {
              newPoints[i] = { x: newPoints[i].x + delta.dx, z: newPoints[i].z + delta.dz };
            }
          } else {
            newPoints[nodeIndex] = { x: pt.x, z: pt.z };
          }
          return { ...c, points: newPoints };
        }
        return c;
      }));
    };
    
    const onDragEnd = (e) => {
      const { circId } = e.detail;
      setLocalCirculations(prev => {
        const nextCircs = [...prev];
        window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
        return nextCircs;
      });
    };

    window.addEventListener("CirculationNodeDrag", onDrag);
    window.addEventListener("CirculationDragEnd", onDragEnd);
    return () => {
      window.removeEventListener("CirculationNodeDrag", onDrag);
      window.removeEventListener("CirculationDragEnd", onDragEnd);
    };
  }, []);

  const selectedNodeIndex = useZoningStore(s => s.selectedCirculationNodeIndex);
  const setSelectedNodeIndex = useZoningStore(s => s.setSelectedCirculationNodeIndex);
  const setDraggingNodeIndex = useZoningStore(s => s.setDraggingCirculationNodeIndex);
  const editMode = useZoningStore(s => s.circulationEditMode);

  if (!localCirculations || localCirculations.length === 0) return null;

  return (
    <group position={[0, -5 + 0.1, 0]}> {/* Adjust for parent group being at BOX_H/2 (5) */}
      {localCirculations.map((circ, index) => {
        const isSelected = isActive && selectedCirculationId === circ.id;
        const color = circ.type === "main" ? "#7F77DD" : "#1D9E75";
        const widthM = circ.width || 600;
        const points = circ.points.map(p => new THREE.Vector3(p.x, 0, p.z));
        
        if (points.length < 2) return null;

        return (
          <group key={circ.id || index} onClick={(e) => {
            if (isActive && onSelect) {
              if (!canSelectCirculation(useSelectionScopeStore.getState().scope)) return;
              e.stopPropagation();
              onSelect(circ.id);
            }
          }}>
            {/* Thick transparent path */}
            <Line
              points={points}
              color={color}
              lineWidth={widthM}
              worldUnits={true}
              dashed={false}
              depthTest={false}
              transparent
              opacity={isSelected ? 0.55 : 0.35}
              onPointerOver={(e) => {
                if (isSelected && isActive && editMode === 'move') {
                  e.stopPropagation();
                  document.body.style.cursor = "move";
                }
              }}
              onPointerOut={(e) => {
                document.body.style.cursor = "auto";
              }}
              onPointerDown={(e) => {
                if (!isSelected || !isActive || editMode !== 'move') return;
                e.stopPropagation();
                setSelectedNodeIndex('all');
                setDraggingNodeIndex('all');
              }}
            />
            {/* Centerline */}
            <Line
              points={points}
              color={color}
              lineWidth={isSelected ? 4 : 2} // screen pixels
              worldUnits={false}
              dashed={circ.type === "sub" && !isSelected}
              dashSize={0.2}
              gapSize={0.1}
              depthTest={false}
              transparent
              opacity={isSelected ? 1.0 : 0.9}
            />
            {/* Vertex dots */}
            {points.map((pt, i) => {
              const isNodeSelected = isSelected && selectedNodeIndex === i;
              return (
                <mesh 
                  key={i} 
                  position={[pt.x, pt.y + 0.1, pt.z]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  onPointerOver={(e) => {
                    if (isSelected && isActive && editMode === 'move') {
                      e.stopPropagation();
                      document.body.style.cursor = "crosshair";
                    } else if (isSelected && isActive && editMode === 'delete') {
                      e.stopPropagation();
                      document.body.style.cursor = "pointer";
                    }
                  }}
                  onPointerOut={(e) => {
                    document.body.style.cursor = "auto";
                  }}
                  onPointerDown={(e) => {
                    if (!isSelected || !isActive) return;
                    e.stopPropagation();
                    if (editMode === 'delete') {
                      const nextCircs = localCirculations.map(c => {
                        if (c.id === circ.id) {
                          const newPoints = [...c.points];
                          newPoints.splice(i, 1);
                          return { ...c, points: newPoints };
                        }
                        return c;
                      }).filter(c => c.points.length >= 2);
                      window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
                      setSelectedNodeIndex(null);
                      if (!nextCircs.find(c => c.id === circ.id)) {
                        useZoningStore.getState().setSelectedCirculationId(null);
                      }
                      return;
                    }
                    if (editMode === 'move') {
                      setSelectedNodeIndex(i);
                      setDraggingNodeIndex(i);
                    }
                  }}
                >
                  <circleGeometry args={[widthM / 2, 32]} />
                  <meshBasicMaterial 
                    color={isNodeSelected ? "#ffffff" : color} 
                    depthTest={false} 
                    transparent 
                    opacity={isSelected ? (isNodeSelected ? 0.9 : 0.5) : 0.4} 
                  />
                  {isNodeSelected && (
                    <mesh position={[0, 0, 0.1]}>
                      <ringGeometry args={[widthM / 2 + 100, widthM / 2 + 200, 32]} />
                      <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthTest={false} />
                    </mesh>
                  )}
                </mesh>
              );
            })}

            {/* Invisible hit tubes for segment insertion */}
            {isSelected && isActive && points.slice(0, -1).map((p1, i) => {
              const p2 = points[i + 1];
              const length = p1.distanceTo(p2);
              const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
              const direction = new THREE.Vector3().subVectors(p2, p1).normalize();
              const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
              
              return (
                <mesh
                  key={`seg-${i}`}
                  position={midPoint}
                  quaternion={quaternion}
                  onPointerOver={(e) => {
                    if (editMode === 'add') {
                      e.stopPropagation();
                      document.body.style.cursor = "crosshair";
                    }
                  }}
                  onPointerOut={(e) => {
                    document.body.style.cursor = "auto";
                  }}
                  onPointerDown={(e) => {
                    if (editMode !== 'add') return;
                    e.stopPropagation();
                    const newPoint = { x: e.point.x, z: e.point.z };
                    const nextCircs = localCirculations.map(c => {
                      if (c.id === circ.id) {
                        const newPoints = [...c.points];
                        newPoints.splice(i + 1, 0, newPoint);
                        return { ...c, points: newPoints };
                      }
                      return c;
                    });
                    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateCirculations", { detail: { circulations: nextCircs } }));
                    setSelectedNodeIndex(i + 1);
                    // Do not drag automatically if in add mode, or maybe they expect it to just add?
                    // User requested explicit add/delete/move buttons. We just select the newly added node.
                  }}
                >
                  <cylinderGeometry args={[widthM / 2, widthM / 2, length, 8]} />
                  <meshBasicMaterial visible={false} />
                </mesh>
              );
            })}
            {/* Label at the last point (or start point) */}
            {points.length > 0 && (
              <Html position={[points[points.length - 1].x, 0, points[points.length - 1].z]} center style={{ pointerEvents: 'none' }}>
                <div style={{
                  color: isSelected ? "#fff" : color,
                  backgroundColor: isSelected ? color : "transparent",
                  padding: isSelected ? "4px 8px" : "2px 4px",
                  borderRadius: "4px",
                  fontSize: isSelected ? 12 : 10,
                  fontWeight: isSelected ? 700 : 600,
                  whiteSpace: "nowrap",
                  fontFamily: "Inter, sans-serif",
                  textShadow: isSelected ? "none" : "0px 1px 2px rgba(0,0,0,0.8)",
                  boxShadow: isSelected ? "0px 2px 6px rgba(0,0,0,0.4)" : "none",
                  pointerEvents: "none",
                  marginLeft: "12px",
                  marginBottom: "12px",
                }}>
                  {circ.name || (circ.type === 'main' ? 'メイン' : 'サブ')} {Math.round(circ.width)}mm
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
