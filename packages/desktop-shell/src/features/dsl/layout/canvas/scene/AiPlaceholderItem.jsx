import React, { useRef, useMemo } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useSelectionScopeStore, canSelectItem } from "../../store/useSelectionScopeStore";

const PLACEHOLDER_COLOR = "#7c3aed";
const PLACEHOLDER_COLOR_SELECTED = "#a78bfa";
// Approximate footprint for a typical furniture set in millimeters
const BOX_W = 1600;
const BOX_H = 80;
const BOX_D = 1200;

export default function AiPlaceholderItem({ item, selected, onSelect }) {
  const groupRef = useRef();
  const register = useSceneObjectRegistryStore((s) => s.register);

  const pos = item?.transform?.position ?? [0, 0, 0];
  const rot = item?.transform?.rotation ?? [0, 0, 0];
  const scale = item?.transform?.scale ?? [1, 1, 1];

  const color = selected ? PLACEHOLDER_COLOR_SELECTED : PLACEHOLDER_COLOR;

  // Register in the scene object registry so the gizmo / raycaster can find it
  const refCallback = (node) => {
    groupRef.current = node;
    register(item.id, node);
  };

  const edgeMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    [color]
  );

  const handleClick = (e) => {
    e.stopPropagation();
    if (!canSelectItem(useSelectionScopeStore.getState().scope)) return;
    onSelect?.(item.id, e);
  };

  const title = item?.title || item?.snapshot?.title || "AI Item";

  return (
    <group
      ref={refCallback}
      position={pos}
      rotation={rot}
      scale={scale}
      onClick={handleClick}
    >
      {/* Translucent fill */}
      <mesh>
        <boxGeometry args={[BOX_W, BOX_H, BOX_D]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.45 : 0.22}
          depthWrite={false}
        />
      </mesh>

      {/* Outline edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D)]} />
        <primitive object={edgeMat} />
      </lineSegments>

      {/* Label */}
      <Html
        position={[0, BOX_H / 2 + 180, 0]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div
          style={{
            background: selected ? "rgba(124,58,237,0.85)" : "rgba(124,58,237,0.55)",
            color: "#ede9fe",
            padding: "2px 7px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            fontFamily: "Inter, sans-serif",
            border: "1px solid rgba(167,139,250,0.5)",
            backdropFilter: "blur(4px)",
          }}
        >
          🤖 {title}
        </div>
      </Html>
    </group>
  );
}
