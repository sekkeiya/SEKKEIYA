// MaterialPins — Material モードの「展開図ピン」を複数配置・移動・削除する。
// 各ピン：床に吸着、XZ 移動ギズモ＋向き矢印（yaw）、バッジクリックで一人称ルックに入る。
// 複数の部屋に1つずつ置けるよう、ピンは配列で管理（useMaterialViewStore）。

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Html, PivotControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";
import { useMaterialViewStore } from "../../../store/useMaterialViewStore";

const ACCENT = "#ec407a";
const FLOOR_NORMAL_MIN = 0.5;
const ARROW_LEN_M = 0.65;
const ARROW_W_M = 0.18;

function castFloorY(x, z, colliders) {
  if (!colliders.length) return 0;
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 1e6, z), new THREE.Vector3(0, -1, 0));
  const hits = ray.intersectObjects(colliders, true);
  const floor = hits.find((h) => {
    const n = h.face?.normal.clone().transformDirection(h.object.matrixWorld);
    return n && Math.abs(n.y) > FLOOR_NORMAL_MIN;
  }) || hits[0];
  return floor ? floor.point.y : 0;
}

function PersonIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" stroke="none">
      <circle cx="12" cy="4.5" r="3" />
      <path d="M8.5 9.5C7 9.5 6 11 6.5 12.5L8 18h3l1-4 1 4h3l1.5-5.5C18 11 17 9.5 15.5 9.5z" opacity="0.85" />
      <path d="M9.5 18.5l-1.2 4.5h3l.7-3 .7 3h3l-1.2-4.5z" opacity="0.65" />
    </svg>
  );
}

function MaterialPin({ pin, index }) {
  const { gl, camera, raycaster } = useThree();
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const u = sceneMaxY > 100 ? 1000 : 1;

  const updatePin = useMaterialViewStore((s) => s.updatePin);
  const removePin = useMaterialViewStore((s) => s.removePin);
  const enter = useMaterialViewStore((s) => s.enterFirstPerson);

  const [selected, setSelected] = useState(false);
  const [gizmoKey, setGizmoKey] = useState(0);
  const [liveYawDeg, setLiveYawDeg] = useState(null);

  const floorY = useRef(0);
  const draggingPos = useRef(false);
  const dragTarget = useRef({ x: pin.x, z: pin.z, yawDeg: pin.yawDeg });
  const draggingYaw = useRef(false);
  const dragPlane = useMemo(() => new THREE.Plane(), []);

  useFrame(() => {
    if (draggingPos.current) return;
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    floorY.current = castFloorY(pin.x, pin.z, colliders);
  });

  // yaw ドラッグ（向き矢印）
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingYaw.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      };
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
      const dx = hit.x - pin.x, dz = hit.z - pin.z;
      if (Math.hypot(dx, dz) < 0.01 * u) return;
      updatePin(pin.id, { yawDeg: Math.atan2(dx, dz) * (180 / Math.PI) });
    };
    const onUp = () => {
      if (draggingYaw.current) {
        draggingYaw.current = false;
        useViewportUiStore.getState().setGizmoDragging(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl.domElement, raycaster, dragPlane, pin.id, pin.x, pin.z, u, updatePin]);

  const arrLen = ARROW_LEN_M * u;
  const arrW = ARROW_W_M * u;
  const arrowShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, arrLen);
    s.lineTo(-arrW / 2, arrLen * 0.25);
    s.lineTo(-arrW * 0.2, arrLen * 0.25);
    s.lineTo(-arrW * 0.2, 0);
    s.lineTo(arrW * 0.2, 0);
    s.lineTo(arrW * 0.2, arrLen * 0.25);
    s.lineTo(arrW / 2, arrLen * 0.25);
    s.closePath();
    return s;
  }, [arrLen, arrW]);
  const arrowGeo = useMemo(() => new THREE.ShapeGeometry(arrowShape), [arrowShape]);

  const y = floorY.current;
  const yawRad = (liveYawDeg ?? pin.yawDeg ?? 0) * (Math.PI / 180);

  const startYawDrag = (e) => {
    e.stopPropagation();
    draggingYaw.current = true;
    dragPlane.set(new THREE.Vector3(0, 1, 0), -y);
    useViewportUiStore.getState().setGizmoDragging(true);
  };

  return (
    <>
      {selected && (
        <group position={[pin.x, y, pin.z]}>
          <PivotControls
            key={gizmoKey}
            autoTransform
            activeAxes={[true, false, true]}
            disableScaling
            depthTest={false}
            fixed
            scale={72}
            onDragStart={() => {
              draggingPos.current = true;
              dragTarget.current = { x: pin.x, z: pin.z, yawDeg: pin.yawDeg ?? 0 };
              useViewportUiStore.getState().setGizmoDragging(true);
            }}
            onDrag={(_l, _d, world) => {
              const pos = new THREE.Vector3().setFromMatrixPosition(world);
              dragTarget.current = { x: pos.x, z: pos.z, yawDeg: pin.yawDeg ?? 0 };
            }}
            onDragEnd={() => {
              draggingPos.current = false;
              useViewportUiStore.getState().setGizmoDragging(false);
              updatePin(pin.id, { x: dragTarget.current.x, z: dragTarget.current.z });
              setGizmoKey((k) => k + 1);
            }}
          />
        </group>
      )}

      <group position={[pin.x, y, pin.z]}>
        <Html center style={{ pointerEvents: "none", userSelect: "none" }}>
          <div
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: ACCENT,
              color: "#fff",
              border: `1px solid ${selected ? "#fff" : "rgba(255,255,255,0.5)"}`,
              borderRadius: "5px",
              padding: "3px 8px 3px 6px",
              fontSize: "10px",
              fontWeight: 700,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
              lineHeight: "16px",
              boxShadow: "0 1px 8px rgba(0,0,0,0.6)",
              cursor: "pointer",
            }}
          >
            <span
              onClick={(e) => { e.stopPropagation(); enter(pin.id); }}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
              title="ここから一人称で見渡す"
            >
              <PersonIcon />
              ピン{index + 1}・見渡す
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); setSelected((v) => !v); }}
              style={{ opacity: 0.85, paddingLeft: 4, cursor: "pointer" }}
              title="移動"
            >
              ✥
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); removePin(pin.id); }}
              style={{ opacity: 0.85, cursor: "pointer" }}
              title="削除"
            >
              ×
            </span>
          </div>
        </Html>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005 * u, 0]}>
          <ringGeometry args={[arrLen * 0.82, arrLen * 0.82 + arrW * 0.25, 48]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>

        <group rotation={[0, yawRad, 0]}>
          <mesh
            geometry={arrowGeo}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.008 * u, 0]}
            onPointerDown={startYawDrag}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "crosshair"; }}
            onPointerOut={() => { document.body.style.cursor = ""; }}
          >
            <meshBasicMaterial color={ACCENT} transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {selected && (
        <mesh
          position={[0, y - 0.001 * u, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          onPointerDown={(e) => { e.stopPropagation(); setSelected(false); }}
        >
          <planeGeometry args={[1e6, 1e6]} />
          <meshBasicMaterial />
        </mesh>
      )}
    </>
  );
}

export default function MaterialPins() {
  const pins = useMaterialViewStore((s) => s.pins);
  return (
    <>
      {pins.map((p, i) => (
        <MaterialPin key={p.id} pin={p} index={i} />
      ))}
    </>
  );
}
