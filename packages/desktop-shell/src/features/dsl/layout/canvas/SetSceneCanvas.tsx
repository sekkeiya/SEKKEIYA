/**
 * SetSceneCanvas.tsx
 * セット家具エディター用の軽量3Dキャンバス。
 * S.Layout のパースビューと同じ外観（暗背景 / グリッド / パースカメラ）を再現する。
 * S.Layout の重いストア群に依存せず単独で動作する。
 */

import React, { Suspense, useCallback, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import type { FurnitureSetItem } from '../types/furnitureSet';

// ─── 型 ─────────────────────────────────────────────────────────────────────

export interface SetSceneCanvasProps {
  items: FurnitureSetItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onTransformChange: (id: string, dx: number, dz: number, rotDeg?: number) => void;
}

// ─── モデルレンダラー ─────────────────────────────────────────────────────────

function ModelMesh({ url, isSelected }: { url: string; isSelected: boolean }) {
  const { scene } = useGLTF(url);
  const cloned = React.useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (isSelected) {
          const setEmissive = (mat: any) => {
            if (mat?.emissive !== undefined) {
              mat.emissiveIntensity = 0.4;
              mat.emissive = new THREE.Color('#a78bfa');
            }
          };
          if (Array.isArray(child.material)) child.material.forEach(setEmissive);
          else setEmissive(child.material);
        }
      }
    });
    return c;
  }, [scene, isSelected]);

  return <primitive object={cloned} />;
}

function ModelFallback() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#4c1d95" opacity={0.6} transparent />
    </mesh>
  );
}

// ─── 家具アイテム（ドラッグ対応） ─────────────────────────────────────────────

interface SetItemProps {
  item: FurnitureSetItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDrag: (id: string, dx: number, dz: number) => void;
}

function SetItem({ item, isSelected, onSelect, onDrag }: SetItemProps) {
  const isDragging = useRef(false);
  const dragStart = useRef<{ x: number; z: number } | null>(null);
  const { camera, gl } = useThree();

  const getFloorPoint = useCallback((event: any): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target;
  }, [camera, gl]);

  const rotRad = (item.transform.rotationDeg * Math.PI) / 180;

  return (
    <group
      position={[item.transform.x, 0, item.transform.z]}
      rotation={[0, rotRad, 0]}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(item.id);
        isDragging.current = true;
        const pt = getFloorPoint(e.nativeEvent);
        if (pt) dragStart.current = { x: pt.x - item.transform.x, z: pt.z - item.transform.z };
        gl.domElement.setPointerCapture((e.nativeEvent as PointerEvent).pointerId);
      }}
      onPointerMove={(e) => {
        if (!isDragging.current || !dragStart.current) return;
        e.stopPropagation();
        const pt = getFloorPoint(e.nativeEvent);
        if (!pt) return;
        onDrag(item.id, pt.x - dragStart.current.x, pt.z - dragStart.current.z);
      }}
      onPointerUp={(e) => {
        isDragging.current = false;
        dragStart.current = null;
        gl.domElement.releasePointerCapture((e.nativeEvent as PointerEvent).pointerId);
      }}
    >
      {/* 選択リング */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.6, 0.75, 32]} />
          <meshBasicMaterial color="#a78bfa" transparent opacity={0.7} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* モデル or フォールバック */}
      {item.glbUrl ? (
        <Suspense fallback={<ModelFallback />}>
          <ModelMesh url={item.glbUrl} isSelected={isSelected} />
        </Suspense>
      ) : (
        <ModelFallback />
      )}
    </group>
  );
}

// ─── シーン（ライト / グリッド / フロア） ─────────────────────────────────────

function SetScene({ items, selectedId, onSelect, onTransformChange }: SetSceneCanvasProps) {
  const handleDrag = (id: string, x: number, z: number) => {
    onTransformChange(id, x, z);
  };

  return (
    <>
      {/* ライティング */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} />

      {/* フロアプレーン（影受け） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#1a1a26" roughness={1} />
      </mesh>

      {/* グリッド（S.Layout と同スタイル） */}
      <Grid
        args={[20, 20]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#2d2d42"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#3d3d5a"
        fadeDistance={18}
        fadeStrength={1}
        position={[0, 0.001, 0]}
      />

      {/* 家具アイテム */}
      {items.map(item => (
        <SetItem
          key={item.id}
          item={item}
          isSelected={selectedId === item.id}
          onSelect={onSelect}
          onDrag={handleDrag}
        />
      ))}

      {/* 背景をクリックで選択解除 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onPointerDown={() => onSelect(null)}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}

// ─── メインキャンバス ─────────────────────────────────────────────────────────

export function SetSceneCanvas(props: SetSceneCanvasProps) {
  return (
    <Canvas
      // 静止プレビュー。OrbitControls 操作/プロップ変化時だけ描画すれば十分なので
      // demand にして常時レンダリングを止める（操作中は drei が invalidate する）。
      frameloop="demand"
      shadows
      camera={{ position: [4, 4, 5], fov: 45, near: 0.01, far: 100 }}
      gl={{ antialias: true, alpha: false }}
      style={{ background: '#0f0f1a', borderRadius: 8 }}
    >
      <SetScene {...props} />
      <OrbitControls
        makeDefault
        minDistance={1}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2 - 0.05}
        enableDamping
        dampingFactor={0.08}
      />
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport axisColors={['#f87171', '#4ade80', '#60a5fa']} labelColor="white" />
      </GizmoHelper>
    </Canvas>
  );
}
