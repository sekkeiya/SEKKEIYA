import React, { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore } from "../store/useEditorModeStore";
import { useMaterialViewStore } from "../store/useMaterialViewStore";

// 断面の切断位置を示す矩形フレーム（塗り＋外枠ライン）。
// どの軸でどこを切っているか一目で分かるように、軸色で可視化する。
function CutPlaneFrame({ w, h, color }) {
  const pts = useMemo(() => {
    const hw = w / 2, hh = h / 2;
    return [[-hw, -hh, 0], [hw, -hh, 0], [hw, hh, 0], [-hw, hh, 0], [-hw, -hh, 0]];
  }, [w, h]);
  return (
    <>
      <mesh raycast={() => null} userData={{ ignoreClipping: true }}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Line points={pts} color={color} lineWidth={1.6} transparent opacity={0.85} depthTest={false} />
    </>
  );
}

export default function SectionClipManager({ isTopView = false }) {
  const { gl, scene, invalidate } = useThree();

  const sectionClipEnabledRaw = useEditorModeStore((s) => s.isSectionClipEnabled);
  const editorMode            = useEditorModeStore((s) => s.editorMode);
  const materialFirstPerson   = useMaterialViewStore((s) => s.firstPerson);
  // 一人称（ウォークスルー＝Preview / Material 見渡し）中は断面カットを無効化する。
  // 室内に入った視点で断面が効くと壁が消えてしまうため。
  // それ以外は editorMode に依らずビューポート設定（isSectionClipEnabled）に従う＝全モード統一。
  const isSectionClipEnabled  = sectionClipEnabledRaw && editorMode !== "walkthrough" && !materialFirstPerson;
  const sectionClipHeight    = useEditorModeStore((s) => s.sectionClipHeight);
  const sectionClipYEnabled  = useEditorModeStore((s) => s.sectionClipYEnabled);
  const sectionClipXEnabled  = useEditorModeStore((s) => s.sectionClipXEnabled);
  const sectionClipX         = useEditorModeStore((s) => s.sectionClipX);
  const sectionClipZEnabled  = useEditorModeStore((s) => s.sectionClipZEnabled);
  const sectionClipZ         = useEditorModeStore((s) => s.sectionClipZ);
  const sceneMaxY            = useEditorModeStore((s) => s.sceneMaxY);
  const sceneExtentXZ        = useEditorModeStore((s) => s.sceneExtentXZ);

  // 断面フレームのサイズ（シーン範囲に合わせる。未取得時は安全な既定値）。
  const frameHalfXZ = Math.max(sceneExtentXZ || 0, sceneMaxY || 0, 3);
  const frameW      = frameHalfXZ * 2.2;
  const frameTopY   = Math.max(sceneMaxY || 0, 3) * 1.05;

  const lastUpdateRef = useRef(0);

  // Stable plane objects — constants are mutated in useEffect below
  // Y plane (height): show y ≤ sectionClipHeight  → normal=(0,-1,0), const=sectionClipHeight
  const clipPlaneY = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionClipHeight), []);
  // X plane (left-right): show x ≤ sectionClipX   → normal=(-1,0,0), const=sectionClipX
  const clipPlaneX = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionClipX), []);
  // Z plane (front-back): show z ≤ sectionClipZ   → normal=(0,0,-1),  const=sectionClipZ
  const clipPlaneZ = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionClipZ), []);

  // Active plane array — rebuilt whenever enabled flags change.
  // Top（平面）ビューでは縦の断面（X=左右 / Z=前後）は無意味なので無視し、
  // 高さ断面（clipPlaneY）だけを適用する。これにより天井が抜けて採光され、真っ黒にならない。
  const activePlanes = useMemo(() => {
    if (!isSectionClipEnabled) return [];
    const result = [];
    if (sectionClipYEnabled) result.push(clipPlaneY);
    if (!isTopView) {
      if (sectionClipXEnabled) result.push(clipPlaneX);
      if (sectionClipZEnabled) result.push(clipPlaneZ);
    }
    return result;
  }, [isSectionClipEnabled, isTopView, sectionClipYEnabled, sectionClipXEnabled, sectionClipZEnabled,
      clipPlaneY, clipPlaneX, clipPlaneZ]);

  // Sync plane constants whenever cut positions change.
  // frameloop="demand" の viewport では値変更だけでは再描画されないため、invalidate() で再描画を要求する
  // （これが無いと操作後しばらく断面が反映されない＝効いていないように見える）。
  useEffect(() => {
    clipPlaneY.constant = sectionClipHeight;
    invalidate();
  }, [sectionClipHeight, clipPlaneY, invalidate]);

  useEffect(() => {
    clipPlaneX.constant = sectionClipX;
    invalidate();
  }, [sectionClipX, clipPlaneX, invalidate]);

  useEffect(() => {
    clipPlaneZ.constant = sectionClipZ;
    invalidate();
  }, [sectionClipZ, clipPlaneZ, invalidate]);

  // 軸の ON/OFF や有効化・ビュー種別変化でも即再描画。
  // さらに lastUpdateRef をリセットして、useFrame のスロットル(0.25s)を待たずに
  // 次フレームで即クリップを反映する（ビュー/軸切替で断面が出るまでの遅延を防ぐ）。
  useEffect(() => {
    lastUpdateRef.current = -Infinity;
    invalidate();
  }, [
    isSectionClipEnabled, isTopView, sectionClipYEnabled, sectionClipXEnabled, sectionClipZEnabled, invalidate,
  ]);

  // Enable/disable local clipping on the renderer
  useEffect(() => {
    gl.localClippingEnabled = isSectionClipEnabled;

    // When disabled: immediately scrub all planes from materials
    if (!isSectionClipEnabled) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          const clearPlanes = (mat) => {
            if (mat.clippingPlanes && mat.clippingPlanes.length > 0) {
              mat.clippingPlanes = [];
              mat.needsUpdate = true;
            }
          };
          if (Array.isArray(child.material)) {
            child.material.forEach(clearPlanes);
          } else {
            clearPlanes(child.material);
          }
        }
      });
    }
  }, [gl, scene, isSectionClipEnabled]);

  // Robustly apply active planes to all (new) meshes ~4×/sec
  useFrame((state) => {
    if (!isSectionClipEnabled) return;

    const now = state.clock.elapsedTime;
    if (now - lastUpdateRef.current < 0.25) return;
    lastUpdateRef.current = now;

    scene.traverse((child) => {
      if (child.isMesh && child.material && !child.userData.ignoreClipping) {
        const applyPlanes = (mat) => {
          const current = mat.clippingPlanes;
          // Re-apply if length changed or planes differ
          if (!current || current.length !== activePlanes.length ||
              activePlanes.some((p, i) => current[i] !== p)) {
            mat.clippingPlanes = activePlanes.length > 0 ? activePlanes : [];
            // clipShadows は付けない。true にすると three.js がシャドウパス用に
            // 「クリップ版デプスマテリアル」を別途初コンパイルし、ビュー初切替時に数秒の
            // フリーズを招く（断面の立面ビューでシャドウのクリップは不要）。
            mat.clipShadows = false;
            mat.needsUpdate = true;
          }
        };
        if (Array.isArray(child.material)) {
          child.material.forEach(applyPlanes);
        } else {
          applyPlanes(child.material);
        }
      }
    });
  });

  if (!isSectionClipEnabled) return null;

  return (
    <group userData={{ isSectionRef: true }}>
      {/* Y (高さ) 断面フレーム — 水平。色は緑（スライダーと一致） */}
      {sectionClipYEnabled && (
        <group position={[0, sectionClipHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <CutPlaneFrame w={frameW} h={frameW} color="#a5d6a7" />
        </group>
      )}
      {/* X (左右) 断面フレーム — YZ 平面。色は赤。Top では非表示。 */}
      {!isTopView && sectionClipXEnabled && (
        <group position={[sectionClipX, frameTopY / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <CutPlaneFrame w={frameW} h={frameTopY} color="#ef9a9a" />
        </group>
      )}
      {/* Z (前後) 断面フレーム — XY 平面。色は青。Top では非表示。 */}
      {!isTopView && sectionClipZEnabled && (
        <group position={[0, frameTopY / 2, sectionClipZ]} rotation={[0, 0, 0]}>
          <CutPlaneFrame w={frameW} h={frameTopY} color="#90caf9" />
        </group>
      )}
    </group>
  );
}
