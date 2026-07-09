// src/features/layout/components/MainArea/components/scene/Lights.jsx
// useLightingStore の設定に基づいて照明を動的にレンダリングする
import React, { useMemo, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { Html, PivotControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { useLightingStore } from "@desktop/features/dsl/layout/store/useLightingStore";
import { useUiPropertiesSelectionStore } from "@desktop/features/dsl/layout/store/uiPropertiesSelectionStore";
import { useUiRightSidebarStore } from "@desktop/features/dsl/layout/store/uiRightSidebarStore";
import { useUiVisibilityStore } from "@desktop/features/dsl/layout/store/uiVisibilityStore";
import { useSelectionScopeStore, canSelectLight } from "@desktop/features/dsl/layout/store/useSelectionScopeStore";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useViewportEnvStore, shadowMapSizeForQuality, applyWhiteBalanceToColor } from "@desktop/features/dsl/layout/store/useViewportEnvStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

// ─── RectAreaLight 用 LTC テクスチャ初期化 ────────────────────────────────────
// Three.js の RectAreaLight は LTC (Linearly Transformed Cosines) 近似で
// 面光源のフォームファクタを計算する。LTC ルックアップテクスチャを
// UniformsLib に登録しないとシェーダーの寄与がゼロになる。
// モジュール読み込み時に一度だけ実行すれば全シーンで有効。
RectAreaLightUniformsLib.init();

// ライトのギズモ（視覚表示）を表示するスコープ
const GIZMO_VISIBLE_SCOPES = new Set(["all", "lighting"]);

// ─── Utils ────────────────────────────────────────────────────────────────────

function degToRad(d) {
  return (d * Math.PI) / 180;
}

// UI スライダー値 → 実際にライトへ渡す intensity の縮小係数。
// Spot / Rect Area / Neon すべて共通: 新スライダー max (10) の明るさが
// 旧スライダー値 5 の明るさに相当するよう 0.5 倍する。
const SLIDER_INTENSITY_FACTOR = 0.5;

/** Ambience > Camera タブの White balance を取得して、light.color (hex) に乗算した
 *  THREE.Color を返すフック。各ライト renderer の color prop に直接渡せる。 */
function useTintedLightColor(hexColor) {
  const whiteBalance = useViewportEnvStore((s) => s.whiteBalance);
  return useMemo(
    () => applyWhiteBalanceToColor(hexColor ?? "#ffffff", whiteBalance),
    [hexColor, whiteBalance]
  );
}

function dirLightPos(azimuth = 45, elevation = 50, distance = 13) {
  const az = degToRad(azimuth);
  const el = degToRad(elevation);
  return [
    distance * Math.cos(el) * Math.sin(az),
    distance * Math.sin(el),
    distance * Math.cos(el) * Math.cos(az),
  ];
}

// ─── Light type SVG icons ─────────────────────────────────────────────────────

function IconSun({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} fill="none"
      strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill={color} fillOpacity="0.28" />
      <line x1="12" y1="2"    x2="12" y2="5" />
      <line x1="12" y1="19"   x2="12" y2="22" />
      <line x1="4.93" y1="4.93"   x2="7.05" y2="7.05" />
      <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07"  x2="7.05" y2="16.95" />
      <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93" />
    </svg>
  );
}

function IconSpot({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} fill="none"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.5" fill={color} fillOpacity="0.35" />
      <path d="M7.5 20 L12 7.5 L16.5 20Z" fill={color} fillOpacity="0.18" />
      <line x1="7.5" y1="20" x2="16.5" y2="20" />
    </svg>
  );
}

function IconRectArea({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} fill="none"
      strokeWidth="2.2" strokeLinecap="round">
      <rect x="2" y="4" width="20" height="5" rx="1" fill={color} fillOpacity="0.25" />
      <line x1="6"  y1="11" x2="4.5"  y2="21" />
      <line x1="12" y1="11" x2="12"   y2="21" />
      <line x1="18" y1="11" x2="19.5" y2="21" />
    </svg>
  );
}

function IconNeon({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} fill="none"
      strokeWidth="2.2" strokeLinecap="round">
      {/* 細長いストリップ */}
      <rect x="2" y="6" width="20" height="3" rx="1.5" fill={color} fillOpacity="0.35" />
      {/* 下向き拡散ライン */}
      <line x1="5"  y1="12" x2="4"  y2="20" />
      <line x1="12" y1="12" x2="12" y2="20" />
      <line x1="19" y1="12" x2="20" y2="20" />
    </svg>
  );
}

// ─── Clickable icon badge (Html overlay) ──────────────────────────────────────
// <Html> の内側の div のみ pointerEvents: "auto" にすることで
// バッジ部分だけクリック可能にし、周囲は Three.js のレイキャストに通過させる。

function LightIconBadge({ lightId, name, accentColor, selected, icon }) {
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!canSelectLight(useSelectionScopeStore.getState().scope)) return;
      useUiPropertiesSelectionStore.getState().selectLight(lightId);
      useUiRightSidebarStore.getState().setRightPanel("properties", true);
    },
    [lightId]
  );

  return (
    <Html center style={{ pointerEvents: "none", userSelect: "none" }}>
      <div
        onClick={handleClick}
        style={{
          pointerEvents: "auto",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: selected ? `${accentColor}28` : "rgba(8,12,22,0.88)",
          color: accentColor,
          border: `1px solid ${selected ? `${accentColor}cc` : `${accentColor}77`}`,
          borderRadius: "4px",
          padding: "2px 8px 2px 5px",
          fontSize: "9.5px",
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          whiteSpace: "nowrap",
          letterSpacing: "0.3px",
          lineHeight: "18px",
          boxShadow: `0 1px 8px rgba(0,0,0,0.6), 0 0 0 1px ${accentColor}33`,
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          transition: "border-color 0.12s, background 0.12s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = `${accentColor}22`;
          e.currentTarget.style.borderColor = `${accentColor}bb`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = selected ? `${accentColor}28` : "rgba(8,12,22,0.88)";
          e.currentTarget.style.borderColor = selected ? `${accentColor}cc` : `${accentColor}77`;
        }}
      >
        <span style={{ display: "flex", alignItems: "center", opacity: 0.92 }}>
          {icon}
        </span>
        <span>{name}</span>
      </div>
    </Html>
  );
}

// ─── Shared click / hover hook ────────────────────────────────────────────────

function useGizmoHandlers(lightId) {
  const selectLight = useUiPropertiesSelectionStore((s) => s.selectLight);
  const setRightPanel = useUiRightSidebarStore((s) => s.setRightPanel);
  const selection = useUiPropertiesSelectionStore((s) => s.selection);
  const isSelected = selection?.kind === "light" && selection.lightId === lightId;

  const onClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (!canSelectLight(useSelectionScopeStore.getState().scope)) return;
      selectLight(lightId);
      setRightPanel("properties", true);
    },
    [lightId, selectLight, setRightPanel]
  );
  const onPointerOver = useCallback((e) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  }, []);
  const onPointerOut = useCallback((e) => {
    e.stopPropagation();
    document.body.style.cursor = "default";
  }, []);

  return { isSelected, onClick, onPointerOver, onPointerOut };
}

// ─── Top-level transform gizmo for the currently selected light ───────────────
// TransformGizmo（家具用）と同じ pattern を使用:
//   matrix prop で PivotControls の行列を外部制御し、useFrame で毎フレーム
//   ライト位置に同期させる。これにより autoTransform がドラッグ終了後に
//   内部オフセットを累積させる問題（矢印方向と移動方向のズレ）を解消する。
//
// 旧実装の問題:
//   <group position={pos}> 内に matrix prop なしで PivotControls を置いていたため、
//   ドラッグ後も PivotControls が内部に累積オフセットを保持し続け、次フレームで
//   ギズモ表示位置 = new_pos + 前回ドラッグ量 となってしまっていた。

function LightTransformGizmo({ selectedLight, onCommit }) {
  const draggingRef = useRef(false);
  // ドラッグ中の累積ワールド行列（位置 + 回転を両方保持）
  const draggedWorldMatrix = useRef(null);
  // ドラッグ開始時点の四元数（平行移動 vs 回転を区別するための比較基準）
  const dragInitialQuatRef = useRef(new THREE.Quaternion());

  const pos = useMemo(() => {
    if (selectedLight.type === "spot") return selectedLight.position ?? [0, 5, 0];
    if (selectedLight.type === "rect") return selectedLight.rectPosition ?? [0, 3200, 0];
    if (selectedLight.type === "neon") return selectedLight.neonPosition ?? [0, 3000, 0];
    if (selectedLight.type === "directional") {
      return dirLightPos(
        selectedLight.azimuth,
        selectedLight.elevation,
        selectedLight.distance ?? 13
      );
    }
    return [0, 1, 0];
  }, [selectedLight]);

  // スポットライトの現在の照射方向（pos → target）を四元数に変換する。
  // ギズモの「真下方向 (0,-1,0)」をこの向きに合わせることで、
  // 回転ハンドルがライトの現在向きを基準に動くようになる。
  const spotQuat = useMemo(() => {
    if (selectedLight.type !== "spot") return null;
    const p = selectedLight.position ?? [0, 5, 0];
    const t = selectedLight.targetPosition ?? [0, 0, 0];
    const dir = new THREE.Vector3(t[0] - p[0], t[1] - p[1], t[2] - p[2]);
    const len = dir.length();
    if (len < 0.001) return new THREE.Quaternion(); // identity（真下向き）
    dir.divideScalar(len);
    const q = new THREE.Quaternion();
    try { q.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); } catch (_) {}
    return q;
  }, [selectedLight]);

  // レンダーごとに最新の spotQuat を ref に保持（callback 内で stale closure を避けるため）
  const spotQuatRef = useRef(new THREE.Quaternion());
  if (spotQuat) spotQuatRef.current.copy(spotQuat);

  // pivotMatrixRef: スポットライトは位置 + 回転、他は位置のみで初期化
  const pivotMatrixRef = useRef(null);
  if (!pivotMatrixRef.current) {
    pivotMatrixRef.current = new THREE.Matrix4();
    if (selectedLight.type === "spot" && spotQuat) {
      pivotMatrixRef.current.compose(
        new THREE.Vector3(pos[0], pos[1], pos[2]),
        spotQuat,
        new THREE.Vector3(1, 1, 1)
      );
    } else {
      pivotMatrixRef.current.makeTranslation(pos[0], pos[1], pos[2]);
    }
  }

  // ドラッグ中以外は毎フレーム matrix をライトの現在位置/向きに同期する。
  // PivotControls の useFrame が `ref.current.matrix = matrix` を毎フレーム実行するため、
  // pivotMatrixRef.current を書き換えると即座にギズモ表示へ反映される。
  useFrame(() => {
    if (draggingRef.current) return;
    if (selectedLight.type === "spot" && spotQuat) {
      pivotMatrixRef.current.compose(
        new THREE.Vector3(pos[0], pos[1], pos[2]),
        spotQuat,
        new THREE.Vector3(1, 1, 1)
      );
    } else {
      pivotMatrixRef.current.makeTranslation(pos[0], pos[1], pos[2]);
    }
  });

  const handleDragStart = useCallback(() => {
    draggingRef.current = true;
    draggedWorldMatrix.current = null;
    // ドラッグ開始時の回転を記録（後で平行移動 vs 回転を判定するために使う）
    dragInitialQuatRef.current.copy(spotQuatRef.current);
    // 範囲選択（マーキー）を抑制するため家具ギズモと同じフラグを立てる
    try {
      useViewportUiStore.getState().setGizmoInteracting?.(true);
      useViewportUiStore.getState().setGizmoDragging?.(true);
    } catch {}
  }, []);

  // onDrag(localMatrix, deltaLocal, worldMatrix, deltaWorld)
  // matrix prop を使うことで parentRef は identity なので
  // worldMatrix = pivot の絶対ワールド変換（位置 + 回転）
  const handleDrag = useCallback((_l, _dl, worldMatrix) => {
    if (!draggedWorldMatrix.current) draggedWorldMatrix.current = new THREE.Matrix4();
    draggedWorldMatrix.current.copy(worldMatrix);
  }, []);

  const handleDragEnd = useCallback(() => {
    // 範囲選択フラグを解除（家具ギズモと同じパターン）
    try {
      useViewportUiStore.getState().setGizmoInteracting?.(false);
      useViewportUiStore.getState().setGizmoDragging?.(false);
    } catch {}

    if (!draggedWorldMatrix.current) {
      draggingRef.current = false;
      return;
    }

    const worldMat = draggedWorldMatrix.current;
    draggedWorldMatrix.current = null;

    // useFrame が古い pos/spotQuat でスナップバックする前に matrix を最終状態にセット
    pivotMatrixRef.current.copy(worldMat);
    draggingRef.current = false;

    // 行列を TRS に分解して位置と回転を取り出す
    const finalPos = new THREE.Vector3();
    const finalQuat = new THREE.Quaternion();
    const tmpScale = new THREE.Vector3();
    worldMat.decompose(finalPos, finalQuat, tmpScale);
    const { x, y, z } = finalPos;

    if (selectedLight.type === "spot") {
      // ドラッグ開始時の四元数との差分を調べて平行移動 vs 回転を判定する。
      // |q_final · q_initial| ≈ 1  → 回転なし（平行移動のみ）
      // |q_final · q_initial| < 1  → 回転あり
      const dotAbs = Math.abs(finalQuat.dot(dragInitialQuatRef.current));
      const hasRotation = 1 - dotAbs > 0.001; // 約 2.6° 以上の回転で検出

      if (hasRotation) {
        // ギズモの「真下方向 (0,-1,0)」に最終回転を適用して新しい照射方向を求める
        const lightDir = new THREE.Vector3(0, -1, 0).applyQuaternion(finalQuat);
        // 照射距離は現在の pos → target 間の距離を維持する
        const curPos = new THREE.Vector3(...(selectedLight.position ?? [0, 5, 0]));
        const curTgt = new THREE.Vector3(...(selectedLight.targetPosition ?? [0, 0, 0]));
        const dist = Math.max(curPos.distanceTo(curTgt), 0.5);
        const newTarget = finalPos.clone().addScaledVector(lightDir, dist);
        onCommit(x, y, z, [newTarget.x, newTarget.y, newTarget.z]);
      } else {
        // 平行移動のみ：新しい位置の真下に照射（targetXYZ = null で handleGizmoCommit が [x,0,z] に決定）
        onCommit(x, y, z, null);
      }
    } else {
      onCommit(x, y, z);
    }
  }, [onCommit, selectedLight]);

  // PivotControls 内部メッシュに ignoreClipping を付与して断面カットの影響を受けないようにする。
  // SectionClipManager が 250ms 毎に traverse するより前に useEffect で先行タグ付けする。
  const gizmoGroupRef = useRef(null);
  useEffect(() => {
    const group = gizmoGroupRef.current;
    if (!group) return;
    group.traverse((child) => {
      if (child.isMesh) {
        child.userData.ignoreClipping = true;
      }
    });
  }, []); // マウント時に一度だけ実行（PivotControls 内部メッシュは同一レンダリングパスで生成済み）

  return (
    // matrix prop で位置制御するため outer group に position は不要
    <group ref={gizmoGroupRef} userData={{ isGizmo: true }}>
      <PivotControls
        matrix={pivotMatrixRef.current}
        autoTransform
        scale={100}
        fixed
        depthTest={false}
        disableRotations={selectedLight.type !== "spot"}
        disableScaling
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
      />
    </group>
  );
}

// ─── Directional Light Gizmo — sun-sphere (visual only, no inline drag) ──────

function DirectionalLightGizmo({ lightId, position, name }) {
  const { isSelected } = useGizmoHandlers(lightId);
  const accentColor = "#ffd580";

  return (
    <group position={position}>
      {/* 球体なし — バッジアイコン（Html）が視覚・クリック両方を担う */}
      <LightIconBadge
        lightId={lightId}
        name={name}
        accentColor={accentColor}
        selected={isSelected}
        icon={<IconSun color={isSelected ? "#38bdf8" : accentColor} />}
      />
    </group>
  );
}

// ─── Spot Light Gizmo — visual only (cone + source sphere + ground pool) ──────

function buildConeGeometry(halfAngle, coneLen, nLines = 8, nRing = 24) {
  const r = Math.tan(halfAngle) * coneLen;
  const pts = [];
  for (let i = 0; i < nLines; i++) {
    const theta = (i / nLines) * Math.PI * 2;
    pts.push(0, 0, 0);
    pts.push(r * Math.cos(theta), coneLen, r * Math.sin(theta));
  }
  for (let i = 0; i < nRing; i++) {
    const t0 = (i / nRing) * Math.PI * 2;
    const t1 = ((i + 1) / nRing) * Math.PI * 2;
    pts.push(r * Math.cos(t0), coneLen, r * Math.sin(t0));
    pts.push(r * Math.cos(t1), coneLen, r * Math.sin(t1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

function SpotLightGizmo({ lightId, name, position, angle, spotDistance, targetPosition }) {
  const { isSelected, onClick, onPointerOver, onPointerOut } = useGizmoHandlers(lightId);

  const accentColor = "#80d4ff";
  const color = isSelected ? "#38bdf8" : accentColor;

  const pos = position ?? [0, 5, 0];
  const tgt = targetPosition ?? [0, 0, 0];
  const halfAngle = angle ?? Math.PI / 6;
  const coneLen = Math.min((spotDistance ?? 20) * 250, 4500);

  const quaternion = useMemo(() => {
    const dx = tgt[0] - pos[0];
    const dy = tgt[1] - pos[1];
    const dz = tgt[2] - pos[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 0.001) return new THREE.Quaternion();
    const to = new THREE.Vector3(dx / len, dy / len, dz / len);
    const q = new THREE.Quaternion();
    try { q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to); } catch (_) {}
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2]]);

  const coneGeo = useMemo(() => buildConeGeometry(halfAngle, coneLen), [halfAngle, coneLen]);
  useEffect(() => () => coneGeo.dispose(), [coneGeo]);

  const pool = useMemo(() => {
    const dx = tgt[0] - pos[0];
    const dy = tgt[1] - pos[1];
    const dz = tgt[2] - pos[2];
    if (dy >= 0 || pos[1] <= 0.01) return null;
    const t = -pos[1] / dy;
    if (t < 0 || t > 60) return null;
    const cx = pos[0] + dx * t;
    const cz = pos[2] + dz * t;
    const dist = Math.sqrt((cx - pos[0]) ** 2 + pos[1] ** 2 + (cz - pos[2]) ** 2);
    return { center: [cx, 15, cz], radius: Math.max(Math.tan(halfAngle) * dist, 200) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos[0], pos[1], pos[2], tgt[0], tgt[1], tgt[2], halfAngle]);

  return (
    <>
      <group position={pos}>
        {/* コーン: 選択中のみ表示 */}
        {isSelected && (
          <group quaternion={quaternion}>
            {/* ワイヤーコーン: raycast 無効にして背後のオブジェクトへのクリックを通過させる */}
            <lineSegments geometry={coneGeo} userData={{ isGizmo: true, lightId }} renderOrder={100}
              raycast={() => {}}>
              <lineBasicMaterial
                color={color}
                transparent
                opacity={0.95}
                depthTest={false}
                depthWrite={false}
              />
            </lineSegments>
            {/* 塗りつぶしコーン: raycast 無効 → コーン内の他ライト・家具をクリック可能に保つ */}
            <mesh
              position={[0, coneLen / 2, 0]}
              rotation={[Math.PI, 0, 0]}
              userData={{ isGizmo: true, lightId, ignoreClipping: true }}
              renderOrder={99}
              raycast={() => {}}
            >
              <coneGeometry args={[Math.tan(halfAngle) * coneLen, coneLen, 16, 1, true]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.15}
                side={THREE.DoubleSide}
                depthTest={false}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        {/* バッジアイコン: 常時表示（クリックで選択） */}
        <LightIconBadge
          lightId={lightId}
          name={name}
          accentColor={accentColor}
          selected={isSelected}
          icon={<IconSpot color={isSelected ? "#38bdf8" : accentColor} />}
        />
      </group>

      {/* Ground illumination pool: 選択中のみ表示 */}
      {isSelected && pool && (
        <mesh
          position={pool.center}
          rotation={[-Math.PI / 2, 0, 0]}
          userData={{ isGizmo: true, lightId, ignoreClipping: true }}
          onClick={onClick}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          renderOrder={98}
        >
          <circleGeometry args={[pool.radius, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
            side={THREE.DoubleSide}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}

// ─── Rect Area Gizmo — visual only (panel outline) ───────────────────────────

function buildRectGeometry(hw, hh) {
  const arrowLen = Math.min(hw, hh) * 0.55;
  const ah = Math.min(hw, hh) * 0.08;
  const pts = [
    -hw, -hh, 0,   hw, -hh, 0,
     hw, -hh, 0,   hw,  hh, 0,
     hw,  hh, 0,  -hw,  hh, 0,
    -hw,  hh, 0,  -hw, -hh, 0,
    -hw + ah, -hh, 0,   -hw, -hh + ah, 0,
     hw - ah, -hh, 0,    hw, -hh + ah, 0,
     hw - ah,  hh, 0,    hw,  hh - ah, 0,
    -hw + ah,  hh, 0,   -hw,  hh - ah, 0,
    -hw * 0.18, 0, 0,   hw * 0.18, 0, 0,
     0, -hh * 0.18, 0,   0,  hh * 0.18, 0,
    0, 0, 0,          0, 0, -arrowLen,
    0, 0, -arrowLen,   ah, 0, -arrowLen + ah * 1.4,
    0, 0, -arrowLen,  -ah, 0, -arrowLen + ah * 1.4,
    0, 0, -arrowLen,   0,  ah, -arrowLen + ah * 1.4,
    0, 0, -arrowLen,   0, -ah, -arrowLen + ah * 1.4,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

function RectAreaGizmo({ lightId, name, position, rotationX = -90, width = 4, height = 4 }) {
  const { isSelected, onClick, onPointerOver, onPointerOut } = useGizmoHandlers(lightId);

  const accentColor = "#b4a0ff";
  const color = isSelected ? "#38bdf8" : accentColor;

  const pos = position ?? [0, 3, 0];
  const hw = ((width ?? 4) / 2) * 1000;
  const hh = ((height ?? 4) / 2) * 1000;

  const outlineGeo = useMemo(() => buildRectGeometry(hw, hh), [hw, hh]);
  useEffect(() => () => outlineGeo.dispose(), [outlineGeo]);

  return (
    <group position={pos}>
      {/* アウトライン＋ヒットメッシュ: 選択中のみ表示 */}
      {isSelected && (
        <group rotation={[degToRad(rotationX ?? -90), 0, 0]}>
          <lineSegments geometry={outlineGeo} userData={{ isGizmo: true, lightId }} renderOrder={100}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.95}
              depthTest={false}
              depthWrite={false}
            />
          </lineSegments>
          <mesh
            userData={{ isGizmo: true, lightId, ignoreClipping: true }}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            renderOrder={99}
          >
            <planeGeometry args={[hw * 2 * 0.7, hh * 2 * 0.7]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* バッジアイコン: 常時表示（クリックで選択） */}
      <group position={[0, 350, 0]}>
        <LightIconBadge
          lightId={lightId}
          name={name}
          accentColor={accentColor}
          selected={isSelected}
          icon={<IconRectArea color={isSelected ? "#38bdf8" : accentColor} />}
        />
      </group>
    </group>
  );
}

// ─── Spot Light renderer with proper target wiring ───────────────────────────
// Three.js の SpotLight は `spotLight.target`（Object3D）の向きで照射方向を決める。
// R3F では <spotLight> に直接ターゲット位置を渡す方法がないため、
// 専用の <group> を target としてシーンに配置し ref で紐付ける。

function SpotLightRenderer({ light }) {
  const lightRef = useRef();
  const targetRef = useRef();
  // Ambience > Render タブで設定された Shadow Quality
  const shadowMapPx = useViewportEnvStore((s) => shadowMapSizeForQuality(s.shadowQuality));
  // Ambience > Camera タブの White balance を適用したカラー
  const tintedColor = useTintedLightColor(light.color);

  const pos = light.position ?? [0, 3000, 0];
  // デフォルト target: 位置の真下（XZ は同じ, Y = 0）
  const targetPos = light.targetPosition ?? [pos[0], 0, pos[2]];

  // ─── mm シーン用 intensity 補正 ──────────────────────────────────────
  // 重要: シーン単位は mm。Three.js r155+ は常に物理光源で、減衰式は:
  //   distanceFalloff = 1 / max(distance^decay, 0.01)   (× spotDistance cutoff)
  // mm スケールでは distance が数千になり、decay=2 だと distanceFalloff ≈ 1e-7
  // となって完全に消える。UI スライダー (max=20) も物理単位を想定していない。
  //
  // 対策: ターゲットまでの距離を「参照距離」とし、その距離での照度が
  // ユーザーのスライダー値と一致するよう intensity を事前スケーリングする。
  //   scaled = intensity_slider * pow(targetDistance, decay)
  // → ターゲット位置で illuminance ≈ intensity_slider * cutoff(～0.85)
  // 物理的に正しい逆二乗 (近いと明るく、遠いと暗く) はそのまま機能する。
  const decayExp = light.decay ?? 2;
  const dxT = targetPos[0] - pos[0];
  const dyT = targetPos[1] - pos[1];
  const dzT = targetPos[2] - pos[2];
  const targetDist = Math.max(Math.sqrt(dxT * dxT + dyT * dyT + dzT * dzT), 1);
  const intensityScale = decayExp > 0 ? Math.pow(targetDist, decayExp) : 1;
  const scaledIntensity = (light.intensity ?? 2.0) * SLIDER_INTENSITY_FACTOR * intensityScale;

  // ライト位置とターゲットの距離から適切なシャドウカメラ far を計算
  // ライト高さの 2.5 倍を上限にして far クリッピングの無駄を防ぐ
  const shadowFar = Math.max((light.spotDistance ?? 8000) * 1.1, pos[1] * 2.5 + 100);

  // マウント後に spotLight.target を <group> に紐付ける（一度だけ）
  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
    }
  }, []);

  return (
    <>
      <spotLight
        ref={lightRef}
        color={tintedColor}
        intensity={scaledIntensity}
        position={pos}
        angle={light.angle ?? Math.PI / 6}
        penumbra={light.penumbra ?? 0.25}
        decay={decayExp}
        distance={light.spotDistance ?? 8000}
        castShadow={true}
        shadow-mapSize={[shadowMapPx, shadowMapPx]}
        shadow-camera-near={1}
        shadow-camera-far={shadowFar}
        shadow-bias={-0.0001}
        shadow-normalBias={1.5}
      />
      {/* ターゲット用の不可視 Object3D。R3F がフレームごとに matrixWorld を更新するため
          SpotLight は常に最新の targetPosition を向く。 */}
      <group ref={targetRef} position={targetPos} visible={false} />
    </>
  );
}

// ─── Spot Light Floor Footprint ──────────────────────────────────────────────
// スポットライトが床面(Y=0)に落とす照射エリアを常時表示する。
// ギズモ・選択状態・レンダリングモードに依存せず、全モードで確認可能。
// 3層グラデーション（外周ハロー → 照射エリア → 中心ホットスポット）で表現。

function SpotLightFootprint({ light }) {
  const px = light.position?.[0] ?? 0;
  const py = light.position?.[1] ?? 5;
  const pz = light.position?.[2] ?? 0;
  const tx = light.targetPosition?.[0] ?? px;
  const ty = light.targetPosition?.[1] ?? 0;
  const tz = light.targetPosition?.[2] ?? pz;
  const halfAngle = light.angle ?? Math.PI / 6;

  // gl.shadowMap.enabled は ViewportDisplayController が rendered/shaded モードで
  // 有効化する。シャドウが描画されるモードでは床のプール塗りつぶしを止めて、
  // 実際の影 (家具→床) が見えるようにする。
  const { gl } = useThree();
  const [shadowsEnabled, setShadowsEnabled] = React.useState(
    !!gl?.shadowMap?.enabled
  );
  useFrame(() => {
    const enabled = !!gl?.shadowMap?.enabled;
    if (enabled !== shadowsEnabled) setShadowsEnabled(enabled);
  });

  const footprint = useMemo(() => {
    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;

    // 下方向かつ床より上にある場合のみ計算
    if (dy >= 0 || py <= 0.05) return null;

    // Y=0 平面との交差
    const t = -py / dy;
    if (t < 0 || t > 200) return null;

    const cx = px + dx * t;
    const cz = pz + dz * t;
    const dist3D = Math.sqrt((cx - px) ** 2 + py ** 2 + (cz - pz) ** 2);
    const radius = Math.tan(halfAngle) * dist3D;

    if (radius < 0.01) return null;
    return { cx, cz, radius };
  }, [px, py, pz, tx, ty, tz, halfAngle]);

  if (!footprint) return null;

  const color = light.color ?? '#ffffff';
  const { cx, cz, radius } = footprint;

  // レンダリングモード時 (shadowsEnabled = true) は実際の影と照度の計算で
  // 床への光のプールが自然に描画されるため、ここでは「照射エリアの外周リング」
  // だけを薄く描いてアイコン的な位置指示に留める。これによって家具の影が
  // footprint メッシュに覆われず可視化される。
  if (shadowsEnabled) {
    return (
      <group position={[cx, 5, cz]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={95} userData={{ ignoreClipping: true }}>
          <ringGeometry args={[radius * 0.985, radius * 1.0, 96]} />
          <meshBasicMaterial
            color={color} transparent opacity={0.45}
            side={THREE.FrontSide} depthTest={true} depthWrite={false}
            polygonOffset={true} polygonOffsetFactor={-4} polygonOffsetUnits={-4}
          />
        </mesh>
      </group>
    );
  }

  return (
    // シーン単位 = mm。床上 5mm に配置して z-fighting を回避。
    // wireframe / ghosted / outline モード等、実際の照度計算が走らないモード用。
    <group position={[cx, 5, cz]}>
      {/* 外周ソフトハロー — FrontSide: 床面の上（Y+ 方向）からのみ表示 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={95} userData={{ ignoreClipping: true }}>
        <circleGeometry args={[radius * 1.3, 56]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.06}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-4} polygonOffsetUnits={-4}
        />
      </mesh>
      {/* 照射エリア本体 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={96} userData={{ ignoreClipping: true }}>
        <circleGeometry args={[radius, 56]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.18}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
      {/* 中間グラデーション */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={97} userData={{ ignoreClipping: true }}>
        <circleGeometry args={[radius * 0.55, 40]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.26}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
      {/* 中心ホットスポット */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={98} userData={{ ignoreClipping: true }}>
        <circleGeometry args={[radius * 0.22, 32]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.42}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-1} polygonOffsetUnits={-1}
        />
      </mesh>
    </group>
  );
}

// ─── Rect Area Light renderer (mm-scale intensity 補正付き) ───────────────────
// RectAreaLight は LTC 法による面光源で、shadow を持たず、形状は scale-invariant。
// ただし Three.js r155+ では物理単位で動くため、mm シーンでは UI スライダー値
// (max=30 想定) と実際の見え方が乖離する。
// → SpotLight と同様にライト中心〜直下床までの距離² を乗じて補正し、
// 「スライダー値 ≒ 直下床面での明るさ」となるようにする。
function RectAreaLightRenderer({ light }) {
  const pos = light.rectPosition ?? [0, 3200, 0];
  const rotX = degToRad(light.rectRotationX ?? -90);
  // width / height はユーザー側がメートル単位。Three.js (mm シーン) に渡すには × 1000。
  const widthMm = (light.width ?? 3) * 1000;
  const heightMm = (light.height ?? 3) * 1000;
  // White balance tint
  const tintedColor = useTintedLightColor(light.color);

  // ─── intensity スケーリングは不要 ─────────────────────────────────────
  // Three.js の RectAreaLight は LTC (Linearly Transformed Cosines) で
  // フォームファクタを評価する。シェーダー内で:
  //   coords[i] = normalize( rectCoords[i] - P )
  // と単位球に射影してから積分するため、結果は scale-invariant。
  // SpotLight (1/d^decay 減衰で mm スケールでは消滅) と違い、mm シーンでも
  // メートルシーンでも同じ寄与が得られる。よって intensity はそのまま渡す。
  return (
    <rectAreaLight
      color={tintedColor}
      intensity={(light.intensity ?? 5.0) * SLIDER_INTENSITY_FACTOR}
      position={pos}
      rotation={[rotX, 0, 0]}
      width={widthMm}
      height={heightMm}
    />
  );
}

// ─── Rect Area Floor Footprint ───────────────────────────────────────────────
// RectAreaLight が床面 (Y=0) に落とす照射エリアを常時表示する。
// 矩形パネルを下向きに投影した相似矩形 (奥行き保存) を 3層グラデーションで描画。
function RectAreaFootprint({ light }) {
  const px = light.rectPosition?.[0] ?? 0;
  const py = light.rectPosition?.[1] ?? 3200;
  const pz = light.rectPosition?.[2] ?? 0;
  const rotX = light.rectRotationX ?? -90; // -90 = 床向き
  // width / height はメートル単位 → mm 換算して床面投影に使う
  const w = (light.width ?? 3) * 1000;
  const h = (light.height ?? 3) * 1000;

  // 真下 (-Y) を向いていない場合は省略 (簡易判定)
  if (py <= 5 || Math.abs(rotX + 90) > 30) return null;

  // 床面の投影位置 (光が落ちる中心点) — 真下なら XZ そのまま
  const cx = px;
  const cz = pz;

  // 床への落とし込み広がり: パネル幅にライト距離分の拡散を足す
  // (近似: 物理的には逆二乗だが、視覚インジケータなのでざっくり)
  const spread = 1.0 + py / Math.max(py + 1000, 1) * 0.6;
  const fpW = w * spread;
  const fpH = h * spread;
  const color = light.color ?? "#ffffff";

  return (
    <group position={[cx, 5, cz]}>
      {/* 外周ソフトハロー */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={95} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpW * 1.4, fpH * 1.4]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.05}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-4} polygonOffsetUnits={-4}
        />
      </mesh>
      {/* 照射エリア本体 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={96} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpW, fpH]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.14}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
      {/* 中心ホットスポット */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={97} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpW * 0.55, fpH * 0.55]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.24}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

// ─── Neon Light (linear LED strip, BIDIRECTIONAL) ────────────────────────────
// 細長い rectAreaLight として実装。間接照明用途を想定して **両面発光** にする。
// RectAreaLight は片面 (-Z 方向) のみに発光するため、180°反転した 2 つ目を
// 同位置に重ねて配置することで上下両方向を照射する。
// length × thickness のメートル単位を mm に換算。LTC は scale-invariant なので
// intensity 補正は不要。

function NeonLightRenderer({ light }) {
  const pos = light.neonPosition ?? [0, 3000, 0];
  const rotX = degToRad(light.neonRotationX ?? -90);
  const rotY = degToRad(light.neonRotationY ?? 0);
  // length / thickness: m → mm
  const widthMm = (light.length ?? 2) * 1000;
  const heightMm = (light.thickness ?? 0.1) * 1000;
  const intensity = (light.intensity ?? 8.0) * SLIDER_INTENSITY_FACTOR;
  // White balance tint
  const tintedColor = useTintedLightColor(light.color);

  return (
    <>
      {/* 前面発光 (ユーザー指定方向 — デフォルトは下向き = 直接照明) */}
      <rectAreaLight
        color={tintedColor}
        intensity={intensity}
        position={pos}
        rotation={[rotX, rotY, 0]}
        width={widthMm}
        height={heightMm}
      />
      {/* 背面発光 (180° 反転 — デフォルトは上向き = 天井・壁を照らす間接光) */}
      <rectAreaLight
        color={tintedColor}
        intensity={intensity}
        position={pos}
        rotation={[rotX + Math.PI, rotY, 0]}
        width={widthMm}
        height={heightMm}
      />
    </>
  );
}

function NeonLightFootprint({ light }) {
  const px = light.neonPosition?.[0] ?? 0;
  const py = light.neonPosition?.[1] ?? 3000;
  const pz = light.neonPosition?.[2] ?? 0;
  const rotX = light.neonRotationX ?? -90;
  const rotY = light.neonRotationY ?? 0;
  const lenM = light.length ?? 2;
  const thkM = light.thickness ?? 0.1;

  // Bidirectional Neon: 前面/背面のいずれかが床方向を向いていれば描画。
  // rotX = -90° (front down) でも +90° (back down) でも床にスポットが出る。
  // 真横向き (rotX = 0° または 180°) のときだけ床に光がほぼ届かない。
  const yEmissionAbs = Math.abs(Math.sin(degToRad(rotX)));
  if (py <= 5 || yEmissionAbs < 0.5) return null;

  // 床への落とし込み: 距離に応じて少し広がる
  const spread = 1.0 + py / Math.max(py + 1000, 1) * 0.6;
  const fpLen = lenM * 1000 * spread;
  const fpThk = thkM * 1000 * spread;
  const color = light.color ?? "#ffffff";

  // ストリップ向き: Y 軸周りの回転 (neonRotationY)
  // 床平面 (XZ) で描画 — group の Y 回転で向きを揃える
  const yRotRad = degToRad(rotY);

  return (
    <group position={[px, 5, pz]} rotation={[0, yRotRad, 0]}>
      {/* 外周ソフトハロー */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={95} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpLen * 1.25, fpThk * 6]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.05}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-4} polygonOffsetUnits={-4}
        />
      </mesh>
      {/* 照射エリア本体 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={96} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpLen, fpThk * 3.5]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.16}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
      {/* 中心ホットスポット (ストリップ直下) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={97} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[fpLen * 0.9, fpThk * 1.6]} />
        <meshBasicMaterial
          color={color} transparent opacity={0.28}
          side={THREE.FrontSide} depthTest={true} depthWrite={false}
          polygonOffset={true} polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}

function buildNeonGeometry(hLen, hThk) {
  // ストリップの輪郭 (XY 平面、Z 方向は emission direction)
  // Neon は両面発光なので emission 矢印を Z- と Z+ 両方向に描画
  const arrowLen = Math.max(hLen, hThk) * 0.4;
  const arrowHead = Math.min(hLen, hThk) * 0.25;
  const pts = [
    // 輪郭
    -hLen, -hThk, 0,   hLen, -hThk, 0,
     hLen, -hThk, 0,   hLen,  hThk, 0,
     hLen,  hThk, 0,  -hLen,  hThk, 0,
    -hLen,  hThk, 0,  -hLen, -hThk, 0,
    // 中央分割線 (ストリップらしさ)
    -hLen * 0.5, 0, 0,   hLen * 0.5, 0, 0,
    // emission 矢印 — 前面 (Z-)
     0, 0, 0,           0, 0, -arrowLen,
     0, 0, -arrowLen,   arrowHead, 0, -arrowLen + arrowHead,
     0, 0, -arrowLen,  -arrowHead, 0, -arrowLen + arrowHead,
    // emission 矢印 — 背面 (Z+) — 間接光 (上向き) を可視化
     0, 0, 0,           0, 0,  arrowLen,
     0, 0,  arrowLen,   arrowHead, 0,  arrowLen - arrowHead,
     0, 0,  arrowLen,  -arrowHead, 0,  arrowLen - arrowHead,
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts), 3));
  return geo;
}

function NeonLightGizmo({ lightId, name, position, rotationX = -90, rotationY = 0, length = 2, thickness = 0.1 }) {
  const { isSelected, onClick, onPointerOver, onPointerOut } = useGizmoHandlers(lightId);

  const accentColor = "#ff80c0";  // Neon ピンク系
  const color = isSelected ? "#38bdf8" : accentColor;

  const pos = position ?? [0, 3000, 0];
  const hLen = ((length ?? 2) / 2) * 1000;   // m → mm
  const hThk = ((thickness ?? 0.1) / 2) * 1000;

  const outlineGeo = useMemo(() => buildNeonGeometry(hLen, hThk), [hLen, hThk]);
  useEffect(() => () => outlineGeo.dispose(), [outlineGeo]);

  return (
    <group position={pos}>
      {/* アウトライン + ヒットメッシュ: 選択中のみ表示 */}
      {isSelected && (
        <group rotation={[degToRad(rotationX ?? -90), degToRad(rotationY ?? 0), 0]}>
          <lineSegments geometry={outlineGeo} userData={{ isGizmo: true, lightId }} renderOrder={100}>
            <lineBasicMaterial
              color={color}
              transparent
              opacity={0.95}
              depthTest={false}
              depthWrite={false}
            />
          </lineSegments>
          <mesh
            userData={{ isGizmo: true, lightId, ignoreClipping: true }}
            onClick={onClick}
            onPointerOver={onPointerOver}
            onPointerOut={onPointerOut}
            renderOrder={99}
          >
            <planeGeometry args={[hLen * 2 * 0.95, hThk * 2 * 0.95]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* バッジアイコン: 常時表示（クリックで選択） */}
      <group position={[0, 250, 0]}>
        <LightIconBadge
          lightId={lightId}
          name={name}
          accentColor={accentColor}
          selected={isSelected}
          icon={<IconNeon color={isSelected ? "#38bdf8" : accentColor} />}
        />
      </group>
    </group>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function Lights({ hasBase = true }) {
  const lights = useLightingStore((s) => s.lights);
  const updateLight = useLightingStore((s) => s.updateLight);
  const hiddenNodeIds = useUiVisibilityStore((s) => s.hiddenNodeIds);
  const selection = useUiPropertiesSelectionStore((s) => s.selection);

  // スコープに応じてライトのギズモ（視覚）の表示を切り替える。
  // 物理ライトオブジェクト（hemisphereLight 等）は全スコープで維持する。
  const scope = useSelectionScopeStore((s) => s.scope);
  // ベースモデル未設定（empty guide 画面）ではギズモ（太陽アイコン等）を出さない。
  const showGizmos = GIZMO_VISIBLE_SCOPES.has(scope) && hasBase;

  // Ambience > Render タブで設定された Shadow Quality (directional / inline 用)
  const shadowMapPx = useViewportEnvStore((s) => shadowMapSizeForQuality(s.shadowQuality));
  // Ambience > Camera > White balance (K)。inline の hemisphere / directional に適用するために購読。
  const envWhiteBalance = useViewportEnvStore((s) => s.whiteBalance);

  // ── Directional Light 用シャドウカメラ frustum をシーン bbox から自動算出 ────
  // シーン単位は mm。BaseGlb が load 時に sceneExtentXZ / sceneMaxY を更新する。
  // - 物理ライトはこの値から逆算した「十分遠い位置」に配置し、shadow camera
  //   ortho frustum がシーン全体を覆えるようにする。
  // - gizmo の表示位置は light.distance ベースの近距離のままにしておくことで
  //   太陽アイコンが画面上で見やすい位置に保たれる。
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const directionalShadow = useMemo(() => {
    // BaseGlb 未ロード時の極小デフォルト (10) を避けるためのフロア値。
    // 一般的な室内 (5–10 m) を確実に覆えるよう最低 5000 mm を確保する。
    const halfExtent = Math.max(sceneExtentXZ ?? 0, 5000);
    const height = Math.max(sceneMaxY ?? 0, 3000);
    // 影が落ちる対象の半径。家具がベースより外にはみ出すケースを想定して 1.5x。
    const sceneRadius = Math.sqrt(halfExtent * halfExtent + height * height) * 1.5;
    // 物理ライトを置く距離。シーン半径の 2 倍だけ離せば shadow camera は
    // 反対側まで余裕を持って届く。
    const lightDistanceMm = sceneRadius * 2;
    // shadow-acne 対策: shadow map の 1 texel が世界座標で覆う長さに比例して
    // normalBias を設定する。texel が大きいほど深度量子化誤差が増えるため
    // 多めに法線方向にオフセットする必要がある。
    // bias: 浅い角度の自己シャドウを抑えるための深度方向の押し下げ。
    //       cameraFar に比例させ、量子化ノイズを跨ぐ程度の大きさにする。
    const texelSizeMm = (sceneRadius * 2) / Math.max(shadowMapPx, 256);
    return {
      lightDistanceMm,
      cameraSize: sceneRadius, // shadow-camera-left/right/top/bottom の絶対値
      cameraNear: 1,
      cameraFar: lightDistanceMm + sceneRadius * 2,
      // 法線方向の押し出し: texel ~2 倍を目安にすると、傾斜のある床/壁での
      // 縞模様 (shadow acne) が消え、ピーターパン現象も最小限。
      normalBias: Math.max(texelSizeMm * 2.5, 8),
      // 正規化深度バイアス。固定的な NDC 値ではなく、cameraFar に対する
      // 相対比で見ると ~2 texel 相当になるよう設定。
      bias: -Math.max(texelSizeMm / (lightDistanceMm + sceneRadius * 2), 0.00005) * 2,
    };
  }, [sceneExtentXZ, sceneMaxY, shadowMapPx]);

  // Determine which (non-hemisphere, visible) light is selected for the gizmo
  const selectedLight = useMemo(() => {
    if (selection?.kind !== "light") return null;
    const l = lights.find((l) => l.id === selection.lightId) ?? null;
    if (!l || l.type === "hemisphere") return null;
    const nodeId = `light:${l.id}`;
    if (hiddenNodeIds[nodeId]) return null;
    return l;
  }, [selection, lights, hiddenNodeIds]);

  // Commit drag-end position (and optional target) to the correct store field per light type.
  // targetXYZ: スポットライトの照射ターゲット座標。
  //   - 回転ドラッグ後は onCommit から計算済みの座標が渡される
  //   - 平行移動ドラッグ後は null が渡され、ここで [x, 0, z]（真下）に決定する
  const handleGizmoCommit = useCallback(
    (x, y, z, targetXYZ) => {
      if (!selectedLight) return;
      if (selectedLight.type === "spot") {
        updateLight(selectedLight.id, {
          position: [x, y, z],
          targetPosition: targetXYZ ?? [x, 0, z],
        });
      } else if (selectedLight.type === "rect") {
        updateLight(selectedLight.id, { rectPosition: [x, y, z] });
      } else if (selectedLight.type === "neon") {
        updateLight(selectedLight.id, { neonPosition: [x, y, z] });
      } else if (selectedLight.type === "directional") {
        const dist = Math.sqrt(x * x + y * y + z * z);
        if (dist < 0.1) return;
        const el = Math.asin(Math.max(-1, Math.min(1, y / dist))) * (180 / Math.PI);
        const az = ((Math.atan2(x, z) * (180 / Math.PI)) + 360) % 360;
        updateLight(selectedLight.id, {
          azimuth: az,
          elevation: Math.max(2, Math.min(88, el)),
          distance: dist,
        });
      }
    },
    [selectedLight, updateLight]
  );

  return (
    <>
      {/* トランスフォームギズモ（PivotControls）— Lighting スコープのみ表示 */}
      {showGizmos && selectedLight && (
        <LightTransformGizmo
          key={selectedLight.id}
          selectedLight={selectedLight}
          onCommit={handleGizmoCommit}
        />
      )}

      {lights.map((light) => {
        const nodeId =
          light.type === "hemisphere" ? "scene:ambience" : `light:${light.id}`;
        if (hiddenNodeIds[nodeId]) return null;

        // ── Hemisphere (Ambience) — 物理ライトのみ、ギズモなし ───────────
        if (light.type === "hemisphere") {
          return (
            <hemisphereLight
              key={light.id}
              color={applyWhiteBalanceToColor(light.color, envWhiteBalance)}
              groundColor={applyWhiteBalanceToColor(light.groundColor ?? "#7a6a58", envWhiteBalance)}
              intensity={light.intensity}
            />
          );
        }

        // ── Directional ───────────────────────────────────────────────────
        if (light.type === "directional") {
          const pos = dirLightPos(light.azimuth, light.elevation, light.distance);
          // 物理ライトは shadow camera frustum がシーン全体を覆える距離まで離す。
          // gizmo は pos (ユーザー設定距離) のまま、UI 上で太陽アイコンが
          // 視認しやすい近距離に保つ。
          const shadowPos = dirLightPos(
            light.azimuth,
            light.elevation,
            directionalShadow.lightDistanceMm
          );
          const camSize = directionalShadow.cameraSize;
          return (
            <React.Fragment key={light.id}>
              {/* 物理ライト: 全スコープで維持（照明効果） */}
              <directionalLight
                color={applyWhiteBalanceToColor(light.color, envWhiteBalance)}
                intensity={light.intensity}
                position={shadowPos}
                castShadow={light.castShadow ?? false}
                shadow-mapSize={[shadowMapPx, shadowMapPx]}
                shadow-camera-near={directionalShadow.cameraNear}
                shadow-camera-far={directionalShadow.cameraFar}
                shadow-camera-left={-camSize}
                shadow-camera-right={camSize}
                shadow-camera-top={camSize}
                shadow-camera-bottom={-camSize}
                shadow-bias={directionalShadow.bias}
                shadow-normalBias={directionalShadow.normalBias}
              />
              {/* ギズモ: ALL / Lighting のみ */}
              {showGizmos && (
                <DirectionalLightGizmo
                  lightId={light.id}
                  position={pos}
                  name={light.name}
                />
              )}
            </React.Fragment>
          );
        }

        // ── Spot ──────────────────────────────────────────────────────────
        if (light.type === "spot") {
          const pos = light.position ?? [0, 5, 0];
          return (
            <React.Fragment key={light.id}>
              {/* 物理ライト: 全スコープで維持 */}
              <SpotLightRenderer light={light} />
              {/* 床への照射エリア: 常時表示（モード・選択状態に非依存） */}
              <SpotLightFootprint light={light} />
              {/* ギズモ: ALL / Lighting のみ・選択時のみコーン表示 */}
              {showGizmos && (
                <SpotLightGizmo
                  lightId={light.id}
                  name={light.name}
                  position={pos}
                  angle={light.angle}
                  spotDistance={light.spotDistance}
                  targetPosition={light.targetPosition}
                />
              )}
            </React.Fragment>
          );
        }

        // ── Rect Area ─────────────────────────────────────────────────────
        if (light.type === "rect") {
          // rectPosition フォールバックは mm（シーン単位）
          const pos = light.rectPosition ?? [0, 3200, 0];
          // width / height はメートル単位で保存される
          return (
            <React.Fragment key={light.id}>
              {/* 物理ライト: 全スコープで維持 */}
              <RectAreaLightRenderer light={light} />
              {/* 床への照射エリア: 常時表示（モード・選択状態に非依存） */}
              <RectAreaFootprint light={light} />
              {/* ギズモ: ALL / Lighting のみ */}
              {showGizmos && (
                <RectAreaGizmo
                  lightId={light.id}
                  name={light.name}
                  position={pos}
                  rotationX={light.rectRotationX}
                  width={light.width}
                  height={light.height}
                />
              )}
            </React.Fragment>
          );
        }

        // ── Neon (linear LED strip) ───────────────────────────────────────
        if (light.type === "neon") {
          const pos = light.neonPosition ?? [0, 3000, 0];
          return (
            <React.Fragment key={light.id}>
              {/* 物理ライト: 全スコープで維持 */}
              <NeonLightRenderer light={light} />
              {/* 床への照射エリア: 常時表示 */}
              <NeonLightFootprint light={light} />
              {/* ギズモ: ALL / Lighting のみ */}
              {showGizmos && (
                <NeonLightGizmo
                  lightId={light.id}
                  name={light.name}
                  position={pos}
                  rotationX={light.neonRotationX}
                  rotationY={light.neonRotationY}
                  length={light.length}
                  thickness={light.thickness}
                />
              )}
            </React.Fragment>
          );
        }

        return null;
      })}
    </>
  );
}
