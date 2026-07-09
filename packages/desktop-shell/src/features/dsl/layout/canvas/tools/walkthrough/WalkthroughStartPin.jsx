// WalkthroughStartPin.jsx
//
// ウォークスルー開始位置ピン（Html バッジ + PivotControls ギズモ）
//
// 操作:
//   - バッジをクリック → 選択/解除。選択中は XZ 移動ギズモを表示。
//   - 方向矢印をドラッグ → yaw（向き）変更
//
// ギズモ方式:
//   autoTransform={true} でドラッグ中もビジュアルがカーソルに追従する。
//   dragEnd 後に key をインクリメントしてリマウント（累積オフセットをリセット）。
//   onDrag 中は setStartPin を呼ばず、dragEnd で一括確定（二重移動防止）。

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { Html, PivotControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { useEditorModeStore } from "../../../store/useEditorModeStore";
import { useSceneObjectRegistryStore } from "../../../store/sceneObjectRegistryStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";

const ACCENT = "#4f8cff";
const FLOOR_NORMAL_MIN = 0.5;
const ARROW_LEN_M = 0.65;
const ARROW_W_M   = 0.18;

function castFloorY(x, z, colliders) {
  if (!colliders.length) return 0;
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, 1e6, z),
    new THREE.Vector3(0, -1, 0)
  );
  const hits = ray.intersectObjects(colliders, true);
  const floor = hits.find((h) => {
    const n = h.face?.normal.clone().transformDirection(h.object.matrixWorld);
    return n && Math.abs(n.y) > FLOOR_NORMAL_MIN;
  }) || hits[0];
  return floor ? floor.point.y : 0;
}

function PersonIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={ACCENT} stroke="none">
      <circle cx="12" cy="4.5" r="3" />
      <path d="M8.5 9.5C7 9.5 6 11 6.5 12.5L8 18h3l1-4 1 4h3l1.5-5.5C18 11 17 9.5 15.5 9.5z" opacity="0.85"/>
      <path d="M9.5 18.5l-1.2 4.5h3l.7-3 .7 3h3l-1.2-4.5z" opacity="0.65"/>
    </svg>
  );
}

function ArrowIcon({ size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={ACCENT} stroke="none">
      <path d="M12 3l6 14H6z"/>
    </svg>
  );
}

export default function WalkthroughStartPin() {
  const { gl, camera, raycaster } = useThree();

  const sceneMaxY     = useEditorModeStore((s) => s.sceneMaxY);
  const u             = sceneMaxY > 100 ? 1000 : 1;
  const startPin      = useEditorModeStore((s) => s.walkthroughStartPin);
  const setStartPin   = useEditorModeStore((s) => s.setWalkthroughStartPin);
  const setIsDragging = useEditorModeStore((s) => s.setIsWalkthroughPinDragging);

  const [pinSelected, setPinSelected] = useState(false);
  const [gizmoKey, setGizmoKey]       = useState(0);
  // ドラッグ中のリアルタイム yaw プレビュー（null = 非ドラッグ時は startPin.yawDeg を使う）
  const [liveYawDeg, setLiveYawDeg]   = useState(null);

  const pinFloorY    = useRef(0);
  const draggingPos  = useRef(false);
  const dragTarget   = useRef({ x: 0, z: 0, yawDeg: 0 });
  const draggingYaw  = useRef(false);
  const dragPlane    = useMemo(() => new THREE.Plane(), []);

  // ── 初期配置 ─────────────────────────────────────────────────
  const placePin = useCallback((colliders) => {
    if (colliders.length) {
      const box = new THREE.Box3();
      colliders.forEach((c) => box.expandByObject(c));
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        setStartPin({ x: center.x, z: center.z, yawDeg: 0 });
        return;
      }
    }
    setStartPin({ x: 0, z: 0, yawDeg: 0 });
  }, [setStartPin]);

  useEffect(() => {
    if (startPin !== null) return;
    placePin(useSceneObjectRegistryStore.getState().baseColliders || []);
  }, [startPin, placePin]);

  const collidersLen = useSceneObjectRegistryStore((s) => s.baseColliders.length);
  useEffect(() => {
    if (startPin !== null) return;
    placePin(useSceneObjectRegistryStore.getState().baseColliders || []);
  }, [collidersLen, placePin]);

  // ── 床 Y を毎フレーム更新（ドラッグ中は固定） ────────────
  useFrame(() => {
    if (!startPin || draggingPos.current) return;
    const colliders = useSceneObjectRegistryStore.getState().baseColliders || [];
    pinFloorY.current = castFloorY(startPin.x, startPin.z, colliders);
  });

  // ── yaw ドラッグ（方向矢印） ──────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingYaw.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = {
        x:  ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        y: -((e.clientY - rect.top)  / rect.height) * 2 + 1,
      };
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) return;
      const pin = useEditorModeStore.getState().walkthroughStartPin;
      if (!pin) return;
      const dx = hit.x - pin.x, dz = hit.z - pin.z;
      if (Math.hypot(dx, dz) < 0.01 * u) return;
      setStartPin({ ...pin, yawDeg: Math.atan2(dx, dz) * (180 / Math.PI) });
    };
    const onUp = () => {
      if (draggingYaw.current) {
        draggingYaw.current = false;
        setIsDragging(false);
        useViewportUiStore.getState().setGizmoDragging(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
    };
  }, [camera, gl.domElement, raycaster, dragPlane, setStartPin, setIsDragging, u]);

  // ── 形状データ ────────────────────────────────────────────
  const arrLen = ARROW_LEN_M * u;
  const arrW   = ARROW_W_M   * u;

  const arrowShape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, arrLen);
    s.lineTo(-arrW / 2, arrLen * 0.25);
    s.lineTo(-arrW * 0.2, arrLen * 0.25);
    s.lineTo(-arrW * 0.2, 0);
    s.lineTo( arrW * 0.2, 0);
    s.lineTo( arrW * 0.2, arrLen * 0.25);
    s.lineTo( arrW / 2, arrLen * 0.25);
    s.closePath();
    return s;
  }, [arrLen, arrW]);

  const arrowGeo = useMemo(() => new THREE.ShapeGeometry(arrowShape), [arrowShape]);

  if (!startPin) return null;

  const floorY = pinFloorY.current;
  // ドラッグ中は liveYawDeg でリアルタイム追従、非ドラッグ時は store 値
  const yawRad = (liveYawDeg ?? startPin.yawDeg ?? 0) * (Math.PI / 180);

  const startYawDrag = (e) => {
    e.stopPropagation();
    draggingYaw.current = true;
    dragPlane.set(new THREE.Vector3(0, 1, 0), -floorY);
    setIsDragging(true);
    useViewportUiStore.getState().setGizmoDragging(true);
  };

  return (
    <>
      {/* ── XZ 移動ギズモ（選択中のみ）── */}
      {pinSelected && (
        <group position={[startPin.x, floorY, startPin.z]}>
          <PivotControls
            key={gizmoKey}
            autoTransform={true}
            activeAxes={[true, false, true]}
            disableScaling
            depthTest={false}
            fixed
            scale={72}
            onDragStart={() => {
              draggingPos.current = true;
              dragTarget.current = { x: startPin.x, z: startPin.z, yawDeg: startPin.yawDeg ?? 0 };
              setIsDragging(true);
              useViewportUiStore.getState().setGizmoDragging(true);
            }}
            onDrag={(_local, _deltaL, world) => {
              // world = ギズモのワールド行列。XZ 位置と Y 回転（yaw）を一時保管
              const pos = new THREE.Vector3().setFromMatrixPosition(world);
              const q = new THREE.Quaternion().setFromRotationMatrix(world);
              const euler = new THREE.Euler().setFromQuaternion(q, "YXZ");
              const yawDeg = euler.y * (180 / Math.PI);
              dragTarget.current = { x: pos.x, z: pos.z, yawDeg };
              // 方向矢印をリアルタイム追従させる
              setLiveYawDeg(yawDeg);
            }}
            onDragEnd={() => {
              draggingPos.current = false;
              setIsDragging(false);
              useViewportUiStore.getState().setGizmoDragging(false);
              setLiveYawDeg(null);
              // dragEnd で一括 state 更新 → group が新位置に移動
              const pin = useEditorModeStore.getState().walkthroughStartPin;
              if (pin) setStartPin({ ...pin, x: dragTarget.current.x, z: dragTarget.current.z, yawDeg: dragTarget.current.yawDeg });
              // リマウントで累積オフセットをリセット
              setGizmoKey((k) => k + 1);
            }}
          />
        </group>
      )}

      {/* ── ピンビジュアル（バッジ＋方向矢印） ── */}
      <group position={[startPin.x, floorY, startPin.z]}>
        {/* Html バッジ */}
        <Html center style={{ pointerEvents: "none", userSelect: "none" }}>
          <div
            onClick={(e) => { e.stopPropagation(); setPinSelected((s) => !s); }}
            style={{
              pointerEvents: "auto",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: pinSelected ? `${ACCENT}30` : "rgba(8,12,22,0.88)",
              color: ACCENT,
              border: `1px solid ${pinSelected ? `${ACCENT}dd` : `${ACCENT}66`}`,
              borderRadius: "4px",
              padding: "2px 8px 2px 5px",
              fontSize: "9.5px",
              fontWeight: 700,
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: "nowrap",
              lineHeight: "18px",
              boxShadow: `0 1px 8px rgba(0,0,0,0.6), 0 0 0 1px ${ACCENT}22`,
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
              transition: "border-color 0.12s, background 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${ACCENT}22`;
              e.currentTarget.style.borderColor = `${ACCENT}bb`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = pinSelected ? `${ACCENT}30` : "rgba(8,12,22,0.88)";
              e.currentTarget.style.borderColor = pinSelected ? `${ACCENT}dd` : `${ACCENT}66`;
            }}
          >
            <span style={{ display: "flex", alignItems: "center", opacity: 0.9 }}>
              <PersonIcon />
            </span>
            <span>スタートピン</span>
            <span style={{ opacity: 0.55, marginLeft: 4, display: "flex", alignItems: "center" }}>
              <ArrowIcon />
            </span>
          </div>
        </Html>

        {/* 地面リング */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005 * u, 0]}>
          <ringGeometry args={[arrLen * 0.82, arrLen * 0.82 + arrW * 0.25, 48]} />
          <meshBasicMaterial color={ACCENT} transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>

        {/* 方向矢印（ドラッグで yaw 変更） */}
        <group rotation={[0, yawRad, 0]}>
          <mesh
            geometry={arrowGeo}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.008 * u, 0]}
            onPointerDown={startYawDrag}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "crosshair"; }}
            onPointerOut={() => { document.body.style.cursor = ""; }}
          >
            <meshBasicMaterial color={ACCENT} transparent opacity={0.82} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>

      {/* 選択解除：背景クリック用の不可視平面 */}
      {pinSelected && (
        <mesh
          position={[0, floorY - 0.001 * u, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          onPointerDown={(e) => { e.stopPropagation(); setPinSelected(false); }}
        >
          <planeGeometry args={[1e6, 1e6]} />
          <meshBasicMaterial />
        </mesh>
      )}
    </>
  );
}
