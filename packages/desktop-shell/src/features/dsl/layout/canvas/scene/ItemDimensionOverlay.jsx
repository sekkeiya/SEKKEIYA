import { useState, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useToolsStore } from "../../store/toolsStore/useToolsStore";
import { useUiSelectionStore } from "../../store/uiSelectionStore";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useViewportUiStore } from "../../store/viewportUiStore";

const DIM_COLORS = {
  W: "#4fc3f7",
  D: "#a5d6a7",
  H: "#facc15",
};

const _box = new THREE.Box3();

// 選択中アイテムの AABB から W/D/H の寸法線セグメントを組み立てる
function buildSegments(min, max) {
  const sizeX = max.x - min.x;
  const sizeY = max.y - min.y;
  const sizeZ = max.z - min.z;
  const off = (Math.max(sizeX, sizeY, sizeZ) || 1) * 0.12;

  return [
    {
      key: "W",
      mm: sizeX,
      start: new THREE.Vector3(min.x, min.y, max.z + off),
      end: new THREE.Vector3(max.x, min.y, max.z + off),
      ext: [
        [new THREE.Vector3(min.x, min.y, max.z), new THREE.Vector3(min.x, min.y, max.z + off)],
        [new THREE.Vector3(max.x, min.y, max.z), new THREE.Vector3(max.x, min.y, max.z + off)],
      ],
    },
    {
      key: "D",
      mm: sizeZ,
      start: new THREE.Vector3(max.x + off, min.y, min.z),
      end: new THREE.Vector3(max.x + off, min.y, max.z),
      ext: [
        [new THREE.Vector3(max.x, min.y, min.z), new THREE.Vector3(max.x + off, min.y, min.z)],
        [new THREE.Vector3(max.x, min.y, max.z), new THREE.Vector3(max.x + off, min.y, max.z)],
      ],
    },
    {
      key: "H",
      mm: sizeY,
      start: new THREE.Vector3(max.x + off, min.y, max.z + off),
      end: new THREE.Vector3(max.x + off, max.y, max.z + off),
      ext: [
        [new THREE.Vector3(max.x, min.y, max.z), new THREE.Vector3(max.x + off, min.y, max.z + off)],
        [new THREE.Vector3(max.x, max.y, max.z), new THREE.Vector3(max.x + off, max.y, max.z + off)],
      ],
    },
  ];
}

function measureSelected(selectedIds) {
  const reg = useSceneObjectRegistryStore.getState();
  const objectsById = reg.map;
  if (!objectsById || objectsById.size === 0) return [];

  const out = [];
  for (const id of selectedIds || []) {
    const obj = objectsById.get(id);
    if (!obj || obj.visible === false) continue;
    obj.updateWorldMatrix(true, true);
    _box.setFromObject(obj);
    if (_box.isEmpty()) continue;
    out.push({ id, segs: buildSegments(_box.min.clone(), _box.max.clone()) });
  }
  return out;
}

/**
 * ItemDimensionOverlay（選択アイテムの W/D/H 寸法）
 *
 * - toolsStore.showItemDimensions が ON のときのみ表示。
 * - 選択中のアイテムのみ、バウンディングボックスに沿って
 *   W(幅/X)・D(奥行/Z)・H(高さ/Y) の寸法線とラベル (mm) を描画する。
 */
export default function ItemDimensionOverlay() {
  const show = useToolsStore((s) => s.showItemDimensions);
  const selectedIds = useUiSelectionStore((s) => s.selectedItemIds);
  const gizmoDragging = useViewportUiStore((s) => s.gizmoDragging);

  const invalidate = useThree((s) => s.invalidate);
  const [items, setItems] = useState([]);
  const recomputeRef = useRef(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!show || !selectedIds?.length) {
      setItems((prev) => (prev.length ? [] : prev));
      recomputeRef.current = null;
      return;
    }

    const recompute = () => {
      setItems(measureSelected(selectedIds));
      invalidate();
    };

    recomputeRef.current = recompute;
    recompute();
    // ドラッグ中は下の useFrame が実時間更新するため、ここはドラッグ外の変化を拾う
    // アイドルポーリング。150ms は過剰だったので 500ms に緩めて CPU を削減。
    const timer = setInterval(recompute, 500);
    return () => { clearInterval(timer); recomputeRef.current = null; };
  }, [show, selectedIds, invalidate]);

  // ドラッグ中はリアルタイム更新 (4フレームに1回 ≈ 15fps)
  useFrame(() => {
    if (!show || !gizmoDragging || !recomputeRef.current) return;
    frameCountRef.current += 1;
    if (frameCountRef.current % 4 !== 0) return;
    recomputeRef.current();
  });

  if (!show || items.length === 0) return null;

  return (
    <group>
      {items.map(({ id, segs }) => (
        <group key={id}>
          {segs.map((s) => {
            const color = DIM_COLORS[s.key];
            const mid = s.start.clone().add(s.end).multiplyScalar(0.5);
            return (
              <group key={`${id}-${s.key}`}>
                <Line
                  points={[s.start, s.end]}
                  color={color}
                  lineWidth={1.8}
                  depthTest={false}
                  renderOrder={9999}
                />
                {s.ext.map((e, i) => (
                  <Line
                    key={i}
                    points={e}
                    color={color}
                    lineWidth={1}
                    transparent
                    opacity={0.4}
                    depthTest={false}
                    renderOrder={9999}
                  />
                ))}
                <Html
                  position={[mid.x, mid.y, mid.z]}
                  center
                  zIndexRange={[100, 0]}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  <div
                    style={{
                      background: "rgba(20,24,31,0.88)",
                      color,
                      font: "700 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
                      padding: "2px 5px",
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      border: `1px solid ${color}`,
                    }}
                  >
                    {s.key} {Math.round(s.mm).toLocaleString()}
                  </div>
                </Html>
              </group>
            );
          })}
        </group>
      ))}
    </group>
  );
}
