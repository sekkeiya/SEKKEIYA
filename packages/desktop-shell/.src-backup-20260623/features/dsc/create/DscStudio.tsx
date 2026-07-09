// @ts-nocheck
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, PivotControls, Line, Html, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import {
  Box, Typography, Button, IconButton,
  TextField, Divider, CircularProgress, Tooltip, Modal, Slider, Popover,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SaveAltRoundedIcon from '@mui/icons-material/SaveAltRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import { useDscStore } from '../store/useDscStore';
import { FurnitureLevelEditor } from './FurnitureLevelEditor';
import SaveTemplateDialog from './dialogs/SaveTemplateDialog';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { WorkFileRepository } from '../../projects/workFileRepository';
import { useAutosaveDraft } from '../../../shared/hooks/useAutosaveDraft';
import { dscFsHelpers } from '../utils/dscFsHelpers';
import { DscEditorDock } from './DscEditorDock';
import { exportComponentsToGlb, saveGlbLocally } from '../utils/dscGlbExport';
import UploadModalContent from '../../dss/upload/modal/UploadModalContent';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { layoutItemsApi } from '../../dsl/layout/api/layoutItemsApi';

const SCALE = 1 / 1000; // mm → Three.js unit (1m)

// -------------------------------------------------------
// 3D mesh for a single furniture part
// -------------------------------------------------------
function FurnitureComponentMesh({ comp, isSelected, isMultiSelected, onSelect, dragPositionOffset }: {
  comp: any; isSelected: boolean; isMultiSelected?: boolean; onSelect: (id: string, shiftKey: boolean) => void;
  dragPositionOffset?: [number, number, number];
}) {
  const { width, height, depth } = comp.dimensions;
  const [px, py, pz] = comp.position;
  const [ox, oy, oz] = dragPositionOffset ?? [0, 0, 0];

  return (
    <mesh
      position={[(px + ox) * SCALE, ((py + oy) + height / 2) * SCALE, (pz + oz) * SCALE]}
      onClick={(e) => { e.stopPropagation(); onSelect(comp.id, e.nativeEvent.shiftKey); }}
      castShadow receiveShadow
    >
      <boxGeometry args={[width * SCALE, height * SCALE, depth * SCALE]} />
      <meshStandardMaterial
        color={comp.color || '#c8a882'}
        emissive={isSelected ? '#ffa726' : isMultiSelected ? '#4488ff' : '#000000'}
        emissiveIntensity={isSelected ? 0.3 : isMultiSelected ? 0.18 : 0}
        roughness={0.7} metalness={0.05}
      />
    </mesh>
  );
}

// -------------------------------------------------------
// ギズモ軸判定: R3F イベントの object から Three.js 軸名を返す
// PivotControls 内部オブジェクトの name / geometry / 向きで判定
// -------------------------------------------------------
function detectGizmoAxis(obj: any): 'x' | 'y' | 'z' | null {
  if (!obj) return null;
  // 1) scene 階層を上へたどって軸名を含む name を探す
  let cur = obj;
  for (let i = 0; i < 8 && cur; i++) {
    const n = (cur.name || '').toLowerCase();
    if (n === 'x' || n.startsWith('x-') || n.endsWith('-x')) return 'x';
    if (n === 'y' || n.startsWith('y-') || n.endsWith('-y')) return 'y';
    if (n === 'z' || n.startsWith('z-') || n.endsWith('-z')) return 'z';
    cur = cur.parent;
  }
  // 2) Cylinder / Cone (矢印シャフト・先端) は向きで軸を推定
  const geomType: string = obj.geometry?.type || obj.geometry?.constructor?.name || '';
  if (geomType.includes('Cylinder') || geomType.includes('Cone')) {
    const wDir = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(obj.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    const ax = Math.abs(wDir.x), ay = Math.abs(wDir.y), az = Math.abs(wDir.z);
    if (ax >= ay && ax >= az) return 'x';
    if (ay >= ax && ay >= az) return 'y';
    return 'z';
  }
  return null;
}

// -------------------------------------------------------
// PivotControls gizmo mesh for the selected part
// (3DSL と同じ PivotControls ベースのギズモ)
// -------------------------------------------------------
function GizmoMesh({ comp, onSelect, onGizmoDoubleClick, multiSelectedIds, allComponents, onMultiDrag, onDragStateChange }: {
  comp: any;
  onSelect: (id: string, shiftKey: boolean) => void;
  onGizmoDoubleClick?: (threeAxis: 'x' | 'y' | 'z' | null) => void;
  multiSelectedIds?: string[];
  allComponents?: any[];
  onMultiDrag?: (delta: [number, number, number] | null) => void;
  onDragStateChange?: (active: boolean) => void;
}) {
  const { width, height, depth } = comp.dimensions;
  const [storeX, storeYvert, storeZdepth] = comp.position;
  const { controls } = useThree();

  // Three.js 内部座標: Y=上下, X=左右, Z=前後 (store と同一マッピング)
  const threePos: [number, number, number] = [
    storeX * SCALE,
    (storeYvert + height / 2) * SCALE,
    storeZdepth * SCALE,
  ];

  // 累積変位行列（ドラッグ中の視覚更新 + 終了時の確定に使用）
  const matrixRef = useRef(new THREE.Matrix4());
  const [matrix, setMatrix] = useState(() => new THREE.Matrix4());
  // ドラッグ開始時の store 座標をスナップショット（stale closure 回避）
  const dragStartRef = useRef<[number, number, number]>([storeX, storeYvert, storeZdepth]);
  // マルチ選択中の他パーツのドラッグ開始位置スナップショット
  const multiStartsRef = useRef<Record<string, [number, number, number]>>({});

  const handleDragStart = useCallback(() => {
    if (controls) (controls as any).enabled = false;
    onDragStateChange?.(true);
    dragStartRef.current = [storeX, storeYvert, storeZdepth];
    // マルチ選択中の全パーツの開始位置をスナップショット
    const starts: Record<string, [number, number, number]> = {};
    if (allComponents && multiSelectedIds) {
      for (const c of allComponents) {
        if (multiSelectedIds.includes(c.id) && c.id !== comp.id) {
          starts[c.id] = [...c.position] as [number, number, number];
        }
      }
    }
    multiStartsRef.current = starts;
  }, [storeX, storeYvert, storeZdepth, controls, allComponents, multiSelectedIds, comp.id, onDragStateChange]);

  // ドラッグ中: 行列を state に反映 → mesh が視覚的にリアルタイム移動
  const handleDrag = useCallback((m: THREE.Matrix4) => {
    matrixRef.current = m.clone();
    setMatrix(m.clone());
    // マルチ選択中の他パーツに同じ変位を通知（視覚フィードバック）
    if (onMultiDrag) {
      const t = new THREE.Vector3();
      m.decompose(t, new THREE.Quaternion(), new THREE.Vector3());
      onMultiDrag([t.x / SCALE, t.y / SCALE, t.z / SCALE]);
    }
  }, [onMultiDrag]);

  // ドラッグ終了: 累積移動量を store に確定、行列リセット
  const handleDragEnd = useCallback(() => {
    if (controls) (controls as any).enabled = true;

    const t = new THREE.Vector3();
    matrixRef.current.decompose(t, new THREE.Quaternion(), new THREE.Vector3());

    const [ix, iy, iz] = dragStartRef.current;
    useDscStore.getState().updateComponent(comp.id, {
      position: [
        Math.round(ix + t.x / SCALE),
        Math.round(iy + t.y / SCALE),
        Math.round(iz + t.z / SCALE),
      ],
    });

    // マルチ選択中の全パーツに同じ変位を確定
    for (const [id, [sx, sy, sz]] of Object.entries(multiStartsRef.current)) {
      useDscStore.getState().updateComponent(id, {
        position: [
          Math.round(sx + t.x / SCALE),
          Math.round(sy + t.y / SCALE),
          Math.round(sz + t.z / SCALE),
        ],
      });
    }

    onMultiDrag?.(null); // ビジュアルオフセットをクリア
    onDragStateChange?.(false);

    const reset = new THREE.Matrix4();
    matrixRef.current = reset;
    setMatrix(reset);
  }, [comp.id, controls, onMultiDrag, onDragStateChange]);

  return (
    // group で PivotControls をラップ → 内部矢印への onDoubleClick をキャッチ
    <group
      onDoubleClick={(e) => {
        e.stopPropagation();
        const axis = detectGizmoAxis(e.object);
        onGizmoDoubleClick?.(axis);
      }}
    >
      <PivotControls
        matrix={matrix}
        onDrag={handleDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        anchor={[0, 0, 0]}
        depthTest={false}
        fixed
        scale={120}
        lineWidth={3}
        activeAxes={[true, true, true]}
      >
        <mesh
          position={threePos}
          onClick={(e) => { e.stopPropagation(); onSelect(comp.id, e.nativeEvent.shiftKey); }}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[width * SCALE, height * SCALE, depth * SCALE]} />
          <meshStandardMaterial
            color={comp.color || '#c8a882'}
            emissive="#ffa726"
            emissiveIntensity={0.35}
            roughness={0.7}
            metalness={0.05}
          />
        </mesh>
      </PivotControls>
    </group>
  );
}

// -------------------------------------------------------
// Wireframe mesh for ortho drawing views (line-art style)
// -------------------------------------------------------
function OrthoComponentMesh({ comp }: { comp: any }) {
  const { width, height, depth } = comp.dimensions;
  const [px, py, pz] = comp.position;
  const pos: [number, number, number] = [px * SCALE, (py + height / 2) * SCALE, pz * SCALE];

  const edgeGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(width * SCALE, height * SCALE, depth * SCALE);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [width, height, depth]);

  return (
    <group position={pos}>
      {/* Very faint fill so overlapping parts are distinguishable */}
      <mesh>
        <boxGeometry args={[width * SCALE, height * SCALE, depth * SCALE]} />
        <meshBasicMaterial color={comp.color || '#c8a882'} transparent opacity={0.10} depthWrite={false} />
      </mesh>
      {/* Clean edge lines — engineering drawing style */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color="#a0bcd0" />
      </lineSegments>
    </group>
  );
}

// -------------------------------------------------------
// Annotation layer inside Canvas — 引き出し線 (dimension lines)
// -------------------------------------------------------
function OrthoAnnotLayer({ view, annotations, annotMode, pendingStart, onClickPoint }: {
  view: 'front' | 'side' | 'top';
  annotations: any[];
  annotMode: boolean;
  pendingStart: [number, number, number] | null;
  onClickPoint: (p: [number, number, number]) => void;
}) {
  // Invisible plane oriented to face the camera for the given view
  const planeRot = useMemo((): [number, number, number] => {
    if (view === 'front') return [0, 0, 0];           // XY plane, faces +Z
    if (view === 'side')  return [0, Math.PI / 2, 0]; // YZ plane, faces +X
    return [-Math.PI / 2, 0, 0];                      // XZ plane, faces +Y (top)
  }, [view]);

  return (
    <>
      {/* Click-plane for raycasting start/end points */}
      {annotMode && (
        <mesh
          rotation={planeRot}
          onClick={(e) => {
            e.stopPropagation();
            onClickPoint([e.point.x, e.point.y, e.point.z]);
          }}
        >
          <planeGeometry args={[50, 50]} />
          <meshBasicMaterial transparent opacity={0.001} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Start-point marker while awaiting second click */}
      {pendingStart && (
        <mesh position={pendingStart}>
          <sphereGeometry args={[0.005, 8, 8]} />
          <meshBasicMaterial color="#ffa726" />
        </mesh>
      )}

      {/* Rendered dimension lines + labels */}
      {annotations.map(ann => {
        const mid: [number, number, number] = [
          (ann.start[0] + ann.end[0]) / 2,
          (ann.start[1] + ann.end[1]) / 2,
          (ann.start[2] + ann.end[2]) / 2,
        ];
        const dist = Math.round(
          new THREE.Vector3(...ann.start).distanceTo(new THREE.Vector3(...ann.end)) / SCALE
        );
        return (
          <group key={ann.id}>
            <Line points={[ann.start, ann.end]} color="#ffa726" lineWidth={1.5} />
            <Html position={mid} center>
              <div style={{
                background: 'rgba(8,12,22,0.88)',
                color: '#ffa726',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 3,
                border: '1px solid rgba(255,167,38,0.45)',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                userSelect: 'none',
                pointerEvents: 'none',
              }}>
                {ann.text || `${dist}mm`}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

// -------------------------------------------------------
// DscCameraController — 3DSC 3D ビュー カメラ操作 (3D Canvas 内専用)
// RMB ドラッグ:       軌道回転 (OrbitControls に委譲)
// Shift+RMB ドラッグ: カメラ平行移動 (パン)
// Ctrl+RMB ドラッグ:  ドリーズーム (上=ズームイン / 下=ズームアウト)
// LMB:               矩形選択 (Canvas 外 DOM ハンドラで処理)
// -------------------------------------------------------
function DscCameraController() {
  const { camera, gl, controls } = useThree();
  const stateRef = useRef({
    rmb: false, shift: false, ctrl: false,
    captured: false, // true = we own pointer / OrbitControls disabled
    lastX: 0, lastY: 0,
  });

  // 虫眼鏡カーソル (Ctrl+RMB ズーム用) — 3DSL と同一 SVG
  const zoomCursorUrl = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="rgba(255,255,255,0.8)" stroke="black" stroke-width="2"/><line x1="26" y1="26" x2="31" y2="31" stroke="black" stroke-width="4" stroke-linecap="round"/><g stroke="black" stroke-width="2"><line x1="16" y1="8" x2="16" y2="14"/><line x1="13" y1="11" x2="19" y2="11"/><line x1="13" y1="21" x2="19" y2="21"/></g></svg>') 12 12, ns-resize`;

  // Orbit ダンピングをOFFにする
  useEffect(() => {
    const oc = controls as any;
    if (oc) { oc.enableDamping = false; oc.dampingFactor = 0; }
  }, [controls]);

  // Shift+RMB パン / Ctrl+RMB ズーム
  useEffect(() => {
    const el = gl.domElement;
    const s  = stateRef.current;

    const onContextMenu = (e: Event) => e.preventDefault();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      s.rmb = true; s.lastX = e.clientX; s.lastY = e.clientY;

      if (e.ctrlKey) {
        // Ctrl+RMB: ズーム — 虫眼鏡カーソル
        el.style.cursor = zoomCursorUrl;
        s.captured = true;
        el.setPointerCapture(e.pointerId);
        const oc = controls as any; if (oc) oc.enabled = false;
        e.preventDefault();
      } else if (e.shiftKey) {
        // Shift+RMB: パン — つかむ手カーソル
        el.style.cursor = 'grabbing';
        s.captured = true;
        el.setPointerCapture(e.pointerId);
        const oc = controls as any; if (oc) oc.enabled = false;
        e.preventDefault();
      } else {
        // 修飾キーなし: OrbitControls が軌道回転を処理 — つかむ手カーソル
        el.style.cursor = 'grabbing';
        s.captured = false;
      }
    };

    const endRmb = () => {
      if (!s.rmb) return;
      s.rmb = false;
      el.style.cursor = ''; // カーソルをリセット
      if (s.captured) {
        s.captured = false;
        const oc = controls as any;
        if (oc) { oc.enabled = true; oc.update(); }
      }
    };

    const onPointerUp   = (e: PointerEvent) => { if (e.button === 2) endRmb(); };

    const onPointerMove = (e: PointerEvent) => {
      if (!s.rmb || !s.captured) return;
      const dx = e.clientX - s.lastX; s.lastX = e.clientX;
      const dy = e.clientY - s.lastY; s.lastY = e.clientY;

      if (s.ctrl) {
        // Ctrl+RMB: ドリーズーム (3DSL 互換)
        const oc  = controls as any;
        const dist = Math.max(0.1, camera.position.distanceTo(oc?.target ?? new THREE.Vector3()));
        const fwd  = new THREE.Vector3(); camera.getWorldDirection(fwd);
        camera.position.addScaledVector(fwd, -dy * 0.008 * dist);
        return;
      }

      if (s.shift) {
        // Shift+RMB: 平行移動パン (カメラ距離に比例してスピード調整)
        const oc2 = controls as any;
        const dist2 = Math.max(0.1, camera.position.distanceTo(oc2?.target ?? new THREE.Vector3()));
        const panSpeed = 0.001 * dist2; // 距離2m → 0.002、距離10m → 0.010
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up    = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        const delta = new THREE.Vector3()
          .addScaledVector(right, -dx * panSpeed)
          .addScaledVector(up,     dy * panSpeed);
        camera.position.add(delta);
        if (oc2) oc2.target.add(delta);
      }
    };

    el.addEventListener('contextmenu', onContextMenu, { passive: false });
    el.addEventListener('pointerdown',  onPointerDown,  { passive: false });
    el.addEventListener('pointermove',  onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('blur',      endRmb);

    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('pointerdown',  onPointerDown);
      el.removeEventListener('pointermove',  onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur',      endRmb);
    };
  }, [camera, gl.domElement, controls]);

  // Shift / Ctrl キー状態管理
  useEffect(() => {
    const s = stateRef.current;
    const isText = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isText()) return;
      if (e.key === 'Shift')   s.shift = true;
      if (e.key === 'Control') s.ctrl  = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift')   s.shift = false;
      if (e.key === 'Control') s.ctrl  = false;
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []);

  return null;
}

// -------------------------------------------------------
// CameraFocuser — rendered inside Canvas; exposes focus callback via ref
// Calling focusRef.current(comps) frames those components in this viewport
// -------------------------------------------------------
function CameraFocuser({ view, focusRef }: {
  view: '3d' | 'front' | 'side' | 'top';
  focusRef: React.MutableRefObject<((comps: any[]) => void) | null>;
}) {
  const { camera, controls } = useThree();

  // Assign the latest callback on every render (captures current camera/controls)
  focusRef.current = (comps: any[]) => {
    if (!comps || comps.length === 0) return;

    // Compute world-space AABB from component data
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const c of comps) {
      const { width, height, depth } = c.dimensions;
      const [px, py, pz] = c.position;
      minX = Math.min(minX, (px - width  / 2) * SCALE);
      maxX = Math.max(maxX, (px + width  / 2) * SCALE);
      minY = Math.min(minY, py              * SCALE);
      maxY = Math.max(maxY, (py + height)   * SCALE);
      minZ = Math.min(minZ, (pz - depth  / 2) * SCALE);
      maxZ = Math.max(maxZ, (pz + depth  / 2) * SCALE);
    }
    if (!isFinite(minX)) return;

    // Prevent degenerate zero-size boxes
    if (maxX - minX < 0.001) { minX -= 0.05; maxX += 0.05; }
    if (maxY - minY < 0.001) { minY -= 0.05; maxY += 0.05; }
    if (maxZ - minZ < 0.001) { minZ -= 0.05; maxZ += 0.05; }

    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const sx = maxX - minX, sy = maxY - minY, sz = maxZ - minZ;
    const center = new THREE.Vector3(cx, cy, cz);

    if (controls) (controls as any).target.copy(center);

    if (view === '3d') {
      // ── Perspective: adjust distance from bounding sphere ──
      const r = Math.max(0.01, Math.sqrt(sx * sx + sy * sy + sz * sz) / 2);
      const fov = THREE.MathUtils.degToRad((camera as any).fov ?? 50);
      const dist = (r / Math.sin(fov / 2)) * 1.35;

      const dir = new THREE.Vector3().subVectors(camera.position, center);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1);
      dir.normalize();
      camera.position.copy(center).addScaledVector(dir, dist);
    } else {
      // ── Orthographic: adjust zoom to fit bounding box in view ──
      const ortho = camera as any;
      let visW: number, visH: number;
      if      (view === 'front') { visW = sx; visH = sy; }
      else if (view === 'side')  { visW = sz; visH = sy; }
      else                       { visW = sx; visH = sz; } // top

      const totalW = ortho.right  - ortho.left;
      const totalH = ortho.top    - ortho.bottom;
      const zW = totalW / Math.max(visW * 1.4, 0.0001);
      const zH = totalH / Math.max(visH * 1.4, 0.0001);
      ortho.zoom = Math.min(zW, zH, 1000);
      ortho.updateProjectionMatrix();
    }

    if (controls) (controls as any).update();
    camera.updateProjectionMatrix();
  };

  return null;
}

// -------------------------------------------------------
// CameraExposer — rendered inside Canvas; exposes Three.js camera to parent via ref
// -------------------------------------------------------
function CameraExposer({ cameraRef }: { cameraRef: React.MutableRefObject<THREE.Camera | null> }) {
  const { camera } = useThree();
  cameraRef.current = camera;
  return null;
}

// -------------------------------------------------------
// Orthographic viewport (正面/側面/平面) — solid mesh rendering
// -------------------------------------------------------
function OrthoViewport({ view, components, focusRef, gridCellMm, gridLineColor = '#2a4a80' }: {
  view: 'front' | 'side' | 'top';
  components: any[];
  focusRef?: React.MutableRefObject<((comps: any[]) => void) | null>;
  gridCellMm?: number;
  gridLineColor?: string;
}) {
  const cellMm = gridCellMm ?? 100;
  const labels: Record<string, string> = { front: '正面', side: '側面', top: '平面' };
  const camPos: Record<string, [number, number, number]> = {
    front: [0, 2, 10], side: [10, 2, 0], top: [0, 10, 0],
  };
  const upVecs: Record<string, [number, number, number]> = {
    front: [0, 1, 0], side: [0, 1, 0], top: [0, 0, -1],
  };
  const cellSize    = cellMm * SCALE;
  const sectionSize = cellMm * SCALE * 5;

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' }}>
      <Typography variant="caption" sx={{ position: 'absolute', top: 6, left: 8, zIndex: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 11, pointerEvents: 'none' }}>
        {labels[view]}
      </Typography>
      <Typography sx={{ position: 'absolute', bottom: 6, left: 8, zIndex: 10, fontSize: 8.5, color: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }}>
        右ドラッグ: パン　ホイール: ズーム
      </Typography>
      <Canvas
        orthographic
        camera={{ position: camPos[view], zoom: 80, up: upVecs[view] }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#080c14' }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <Grid
          args={[20, 20]}
          cellSize={cellSize}
          sectionSize={sectionSize}
          cellColor={gridLineColor}
          sectionColor={gridLineColor}
          infiniteGrid
        />
        <OrbitControls
          makeDefault
          enableRotate={false}
          enableDamping={false}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        />
        {components.map(comp => (
          <FurnitureComponentMesh key={comp.id} comp={comp} isSelected={false} onSelect={() => {}} />
        ))}
        {focusRef && <CameraFocuser view={view} focusRef={focusRef} />}
      </Canvas>
    </Box>
  );
}

// -------------------------------------------------------
// Cut-plane slider control row (used in SectionViewport)
// -------------------------------------------------------
function CutControl({ label, value, min, max, enabled, color, onChange, onToggle }: {
  label: string; value: number; min: number; max: number;
  enabled: boolean; color: string;
  onChange: (v: number) => void; onToggle: (v: boolean) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
      <Box
        onClick={() => onToggle(!enabled)}
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: enabled ? color : 'rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s' }}
      />
      <Typography sx={{ color: enabled ? color : 'rgba(255,255,255,0.3)', fontSize: 9, fontWeight: 700, minWidth: 44, flexShrink: 0 }}>{label}</Typography>
      <Slider
        size="small"
        min={min} max={max} step={10}
        value={value}
        disabled={!enabled}
        onChange={(_, v) => onChange(v as number)}
        sx={{
          flex: 1,
          color: enabled ? color : 'rgba(255,255,255,0.2)',
          height: 2,
          py: '4px',
          '& .MuiSlider-thumb': { width: 10, height: 10 },
          '& .MuiSlider-rail': { opacity: 0.2 },
        }}
      />
      <Typography sx={{ color: enabled ? color : 'rgba(255,255,255,0.25)', fontSize: 9, minWidth: 52, textAlign: 'right', fontFamily: 'monospace', flexShrink: 0 }}>
        {value >= 0 ? '+' : ''}{value}mm
      </Typography>
    </Box>
  );
}

// -------------------------------------------------------
// Section mesh: solid rendering with material-level clipping planes
// + BackSide fill to visualise the cut surface
// -------------------------------------------------------
function SectionComponentMesh({ comp, planes }: { comp: any; planes: THREE.Plane[] }) {
  const { width, height, depth } = comp.dimensions;
  const [px, py, pz] = comp.position;
  const pos: [number, number, number] = [px * SCALE, (py + height / 2) * SCALE, pz * SCALE];
  const args: [number, number, number] = [width * SCALE, height * SCALE, depth * SCALE];
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={args} />
        <meshStandardMaterial
          color={comp.color || '#c8a882'}
          clippingPlanes={planes}
          clipShadows
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>
      {planes.length > 0 && (
        <mesh>
          <boxGeometry args={args} />
          <meshBasicMaterial color="#7ab8d4" side={THREE.BackSide} clippingPlanes={planes} />
        </mesh>
      )}
    </group>
  );
}

// -------------------------------------------------------
// Section viewport — 平断面 (plansec) / 立断面 (elevsec)
// plansec: top-down camera, X and Y vertical cut sliders
// elevsec: front camera, Z (height) horizontal cut slider
// -------------------------------------------------------
function SectionViewport({ type, components, focusRef, gridCellMm, gridLineColor = '#2a4a80' }: {
  type: 'plansec' | 'elevsec';
  components: any[];
  focusRef?: React.MutableRefObject<((comps: any[]) => void) | null>;
  gridCellMm?: number;
  gridLineColor?: string;
}) {
  const cellMm    = gridCellMm ?? 100;
  const isPlansec = type === 'plansec';

  // ── Cut plane state ───────────────────────────────────────────
  const [xCut, setXCut]         = useState(500);
  const [xEnabled, setXEnabled] = useState(false);
  const [yCut, setYCut]         = useState(300);
  const [yEnabled, setYEnabled] = useState(false);
  const [zCut, setZCut]         = useState(1000);
  const [zEnabled, setZEnabled] = useState(true);

  // ── THREE.Plane objects in world (scene) space ────────────────
  // Store axes: pos[0]=X(L/R)→ThreeX, pos[1]=Yvert→ThreeY, pos[2]=Zdepth→ThreeZ
  // Plane eq: dot(normal, point) + constant ≥ 0 is visible side
  //   X cut: show x ≤ xCut*SCALE  → normal=(-1,0,0), const=xCut*SCALE
  //   Y cut: show z ≤ yCut*SCALE  → normal=(0,0,-1),  const=yCut*SCALE
  //   Z cut: show y ≤ zCut*SCALE  → normal=(0,-1,0),  const=zCut*SCALE
  // All 3 axes are always available in both plansec and elevsec views
  const planes = useMemo((): THREE.Plane[] => {
    const result: THREE.Plane[] = [];
    if (xEnabled) result.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), xCut * SCALE));
    if (yEnabled) result.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), yCut * SCALE));
    if (zEnabled) result.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), zCut * SCALE));
    return result;
  }, [xCut, xEnabled, yCut, yEnabled, zCut, zEnabled]);

  // ── Slider range from bounding box ───────────────────────────
  const range = useMemo(() => {
    if (components.length === 0) return { xMin: -2000, xMax: 2000, yMin: -2000, yMax: 2000, zMax: 3000 };
    let xMin=Infinity, xMax=-Infinity, yMin=Infinity, yMax=-Infinity, zMax=-Infinity;
    for (const c of components) {
      const { width, height, depth } = c.dimensions;
      const [cpx, cpy, cpz] = c.position;
      xMin = Math.min(xMin, cpx - width/2);  xMax = Math.max(xMax, cpx + width/2);
      yMin = Math.min(yMin, cpz - depth/2);  yMax = Math.max(yMax, cpz + depth/2);
      zMax = Math.max(zMax, cpy + height);
    }
    const pad = 200;
    return { xMin: Math.floor(xMin)-pad, xMax: Math.ceil(xMax)+pad, yMin: Math.floor(yMin)-pad, yMax: Math.ceil(yMax)+pad, zMax: Math.ceil(zMax)+pad };
  }, [components]);

  const cellSize    = cellMm * SCALE;
  const sectionSize = cellMm * SCALE * 5;
  const camPos: [number, number, number] = isPlansec ? [0, 10, 0]   : [0, 2, 10];
  const upVec: [number, number, number]  = isPlansec ? [0, 0, -1]   : [0, 1, 0];
  const focusView = isPlansec ? 'top' : 'front';

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' }}>

      {/* View label */}
      <Typography variant="caption" sx={{ position: 'absolute', top: 6, left: 8, zIndex: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 11, pointerEvents: 'none' }}>
        {isPlansec ? '平断面' : '立断面'}
      </Typography>

      {/* Nav hint */}
      <Typography sx={{ position: 'absolute', top: 6, right: 8, zIndex: 10, fontSize: 8.5, color: 'rgba(255,255,255,0.18)', pointerEvents: 'none' }}>
        右ドラッグ: パン　ホイール: ズーム
      </Typography>

      {/* Cut plane controls — overlaid at bottom, all 3 axes always visible */}
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, bgcolor: 'rgba(8,12,22,0.85)', px: 1.25, py: 0.75, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <CutControl label="X 断面" value={xCut} min={range.xMin} max={range.xMax} enabled={xEnabled} color="#ef9a9a" onChange={setXCut} onToggle={setXEnabled} />
        <CutControl label="Y 断面" value={yCut} min={range.yMin} max={range.yMax} enabled={yEnabled} color="#90caf9" onChange={setYCut} onToggle={setYEnabled} />
        <CutControl label="Z (高さ)" value={zCut} min={0} max={range.zMax} enabled={zEnabled} color="#a5d6a7" onChange={setZCut} onToggle={setZEnabled} />
      </Box>

      {/* Canvas with local clipping enabled */}
      <Canvas
        orthographic
        camera={{ position: camPos, zoom: 80, up: upVec }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: '#080c14' }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <Grid
          args={[20, 20]}
          cellSize={cellSize}
          sectionSize={sectionSize}
          cellColor={gridLineColor}
          sectionColor={gridLineColor}
          infiniteGrid
        />
        <OrbitControls
          makeDefault
          enableRotate={false}
          enableDamping={false}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }}
        />
        {components.map(comp => (
          <SectionComponentMesh key={comp.id} comp={comp} planes={planes} />
        ))}
        {focusRef && <CameraFocuser view={focusView} focusRef={focusRef} />}
      </Canvas>
    </Box>
  );
}

// -------------------------------------------------------
// Right panel: property editor for selected part
// -------------------------------------------------------
function RightPanel() {
  const { components, selectedId, updateComponent, removeComponent, duplicateComponent } = useDscStore();
  const selected = components.find(c => c.id === selectedId);

  if (!selected) {
    return (
      <Box sx={{
        width: 240, height: '100%', bgcolor: 'rgba(10,15,25,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* 家具レベルエディタ */}
        <FurnitureLevelEditor />

        {/* ショートカットヒント */}
        <Box sx={{ px: 1.75, pb: 1.5, mt: 'auto' }}>
          <Divider sx={{ mb: 1.25, borderColor: 'rgba(255,255,255,0.06)' }} />
          <Box sx={{ px: 1.25, py: 1, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['Delete',  '選択パーツを削除'],
              ['F',       '選択パーツにフォーカス'],
              ['Ctrl+A',  '全選択 + 全フォーカス'],
              ['Z → A',   '全ビューにフォーカス'],
            ].map(([key, desc]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                <Box component="kbd" sx={{ px: 0.75, py: 0.1, borderRadius: 0.5, bgcolor: 'rgba(255,255,255,0.08)', fontSize: 8.5, fontFamily: 'monospace', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', flexShrink: 0 }}>{key}</Box>
                <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{desc}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    );
  }

  const update = (field: string, value: any) => {
    const v = typeof value === 'string' ? parseFloat(value) || 0 : Number(value);
    if (['width', 'height', 'depth'].includes(field)) {
      updateComponent(selected.id, { dimensions: { ...selected.dimensions, [field]: v } });
    } else if (['x', 'y', 'z'].includes(field)) {
      // UI 軸 → store 配列インデックスのマッピング
      // X(左右)→pos[0], Y(前後)→pos[2], Z(上下)→pos[1]
      const idx = field === 'x' ? 0 : field === 'y' ? 2 : 1;
      const newPos = [...selected.position] as [number, number, number];
      newPos[idx] = v;
      updateComponent(selected.id, { position: newPos });
    } else {
      updateComponent(selected.id, { [field]: value });
    }
  };

  const dim = selected.dimensions;
  const pos = selected.position;

  // ── bounding box of the selected part ──────────────────
  // UI 軸: X=左右(pos[0]), Y=前後(pos[2]), Z=上下(pos[1])
  const bbox = {
    xMin: Math.round(pos[0] - dim.width  / 2),
    xMax: Math.round(pos[0] + dim.width  / 2),
    yMin: Math.round(pos[2] - dim.depth  / 2),  // Y = 前後/depth
    yMax: Math.round(pos[2] + dim.depth  / 2),
    zMin: Math.round(pos[1]),                    // Z = 上下/vertical
    zMax: Math.round(pos[1] + dim.height),
  };

  // ── slider + number-input field ─────────────────────────
  const SLIDER_DIM_COLOR = '#66bb6a';
  const SLIDER_POS_COLOR = '#ffa726';

  const numField = (
    label: string, field: string, value: number,
    min: number, max: number, sliderStep: number,
    isPos = false, inputStep = isPos ? 10 : 1,
  ) => {
    const clampedVal = Math.min(Math.max(value, min), max);
    const sliderColor = isPos ? SLIDER_POS_COLOR : SLIDER_DIM_COLOR;
    return (
      <Box sx={{ mb: 1.25 }}>
        {/* label row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.3 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.2 }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            {isPos && (
              <Box
                onClick={() => update(field, value - 10)}
                sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 0.5, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1, userSelect: 'none',
                  '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >−</Box>
            )}
            <TextField
              type="number" size="small" value={value}
              onChange={(e) => update(field, e.target.value)}
              inputProps={{ step: inputStep }}
              sx={{
                width: 68,
                '& .MuiInputBase-input': { color: '#fff', fontSize: 11, p: '3px 6px', textAlign: 'center' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
                '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.25)' },
                '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: sliderColor },
              }}
            />
            {isPos && (
              <Box
                onClick={() => update(field, value + 10)}
                sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 0.5, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1, userSelect: 'none',
                  '&:hover': { color: '#fff', borderColor: 'rgba(255,255,255,0.35)', bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >＋</Box>
            )}
          </Box>
        </Box>
        {/* slider */}
        <Slider
          size="small"
          min={min} max={max} step={sliderStep}
          value={clampedVal}
          onChange={(_, v) => update(field, v as number)}
          sx={{
            color: sliderColor,
            height: 3,
            py: '6px',
            '& .MuiSlider-thumb': {
              width: 11, height: 11,
              '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${sliderColor}28` },
            },
            '& .MuiSlider-rail': { opacity: 0.18 },
          }}
        />
      </Box>
    );
  };

  // ── stack-on-top: place this part above the tallest other part ──
  const handleStackOnTop = () => {
    const others = components.filter(c => c.id !== selected.id);
    if (others.length === 0) return;
    // pos[1] = 垂直方向（Z軸）の底面高さ、height = 垂直サイズ
    const maxZ = Math.max(...others.map(c => c.position[1] + c.dimensions.height));
    update('z', maxZ);  // 'z' → idx=1 → pos[1] (上下)
  };

  const ASSIST_BTN = {
    px: 0.9, py: 0.4, borderRadius: 1,
    border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
    fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,0.4)',
    userSelect: 'none', transition: 'all 0.12s',
    '&:hover': { borderColor: '#ffa726', color: '#ffa726', bgcolor: 'rgba(255,167,38,0.07)' },
  };

  return (
    <Box sx={{
      width: 240, height: '100%', bgcolor: 'rgba(10,15,25,0.95)',
      borderLeft: '1px solid rgba(255,255,255,0.08)',
      px: 1.75, py: 1.5, overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* ── header ── */}
      <Typography sx={{ color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, mb: 1.25, fontSize: 9, fontWeight: 700 }}>
        プロパティ
      </Typography>

      {/* ── name + actions ── */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.75, alignItems: 'flex-start' }}>
        <TextField
          label="名前" size="small" value={selected.name}
          onChange={(e) => update('name', e.target.value)}
          sx={{ flex: 1,
            '& label': { color: 'rgba(255,255,255,0.4)', fontSize: 11 },
            '& .MuiInputBase-input': { color: '#fff', fontSize: 12 },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
          }}
        />
        <Tooltip title="複製" arrow>
          <IconButton size="small" onClick={() => duplicateComponent(selected.id)}
            sx={{ mt: 0.5, color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1,
              '&:hover': { color: '#ffa726', borderColor: '#ffa726', bgcolor: 'rgba(255,167,38,0.06)' } }}>
            <ContentCopyRoundedIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="削除 (Delete)" arrow>
          <IconButton size="small" onClick={() => removeComponent(selected.id)}
            sx={{ mt: 0.5, color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 1,
              '&:hover': { color: '#ff4d4f', borderColor: '#ff4d4f', bgcolor: 'rgba(255,77,79,0.06)' } }}>
            <DeleteIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── 寸法 ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: SLIDER_DIM_COLOR, flexShrink: 0 }} />
        <Typography sx={{ color: SLIDER_DIM_COLOR, fontSize: 10, fontWeight: 700 }}>寸法</Typography>
      </Box>
      {numField('幅  W (mm)',   'width',  dim.width,  5, 3000, 1)}
      {numField('奥行 D (mm)', 'depth',  dim.depth,  5, 3000, 1)}
      {numField('高さ H (mm)', 'height', dim.height, 5, 3000, 1)}

      <Divider sx={{ my: 1.25, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── 位置 ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: SLIDER_POS_COLOR, flexShrink: 0 }} />
        <Typography sx={{ color: SLIDER_POS_COLOR, fontSize: 10, fontWeight: 700 }}>位置</Typography>
      </Box>
      {numField('X  左右 (mm)',  'x', pos[0], -3000, 3000, 1, true)}
      {numField('Y  前後 (mm)',  'y', pos[2], -3000, 3000, 1, true)}
      {numField('Z  上下 (mm)',  'z', pos[1],     0, 3000, 1, true)}

      {/* ── クイック配置 ── */}
      <Box sx={{ mt: 0.25, mb: 1.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 700, letterSpacing: 0.6, mb: 0.75, textTransform: 'uppercase' }}>
          クイック配置
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Box sx={ASSIST_BTN} onClick={() => update('z', 0)}>床面 Z=0</Box>
          <Box sx={ASSIST_BTN} onClick={() => update('x', 0)}>X 中央</Box>
          <Box sx={ASSIST_BTN} onClick={() => update('y', 0)}>Y 中央</Box>
          <Box sx={{ ...ASSIST_BTN, '&:hover': { borderColor: '#66bb6a', color: '#66bb6a', bgcolor: 'rgba(102,187,106,0.07)' } }}
            onClick={handleStackOnTop}>
            上に積む ↑
          </Box>
        </Box>
      </Box>

      <Divider sx={{ mb: 1.25, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── 現在の範囲（組み立て参考） ── */}
      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, fontWeight: 700, letterSpacing: 0.6, mb: 0.75, textTransform: 'uppercase' }}>
          範囲参考（組み立て用）
        </Typography>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 1.25, px: 1.25, py: 0.85 }}>
          {[
            { axis: 'X', min: bbox.xMin, max: bbox.xMax, color: '#ef9a9a' }, // 左右
            { axis: 'Y', min: bbox.yMin, max: bbox.yMax, color: '#90caf9' }, // 前後
            { axis: 'Z', min: bbox.zMin, max: bbox.zMax, color: '#a5d6a7' }, // 上下
          ].map(({ axis, min, max, color }) => (
            <Box key={axis} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.4 }}>
              <Typography sx={{ color, fontSize: 10, fontWeight: 700, minWidth: 12 }}>{axis}</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}>
                {min >= 0 ? '+' : ''}{min}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>↔</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'monospace' }}>
                {max >= 0 ? '+' : ''}{max}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, ml: 'auto' }}>
                {max - min}mm
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ mb: 1.25, borderColor: 'rgba(255,255,255,0.06)' }} />

      {/* ── 色 ── */}
      <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 9.5, fontWeight: 700, mb: 0.75 }}>色</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <input type="color" value={selected.color} onChange={(e) => update('color', e.target.value)}
          style={{ width: 36, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: 'monospace' }}>{selected.color}</Typography>
      </Box>
    </Box>
  );
}

// -------------------------------------------------------
// View mode toggle
// -------------------------------------------------------
const VIEW_MODES = [
  { key: '3d',      label: '3D' },
  { key: 'front',   label: '正面' },
  { key: 'side',    label: '側面' },
  { key: 'top',     label: '平面' },
  { key: 'quad',    label: '四面' },
  { key: 'plansec', label: '平断面' },
  { key: 'elevsec', label: '立断面' },
] as const;

// -------------------------------------------------------
// Canvas screenshot helper (must render inside <Canvas>)
// -------------------------------------------------------
function CaptureHelper({ captureRef }: { captureRef: React.MutableRefObject<(() => string | null) | null> }) {
  const { gl, scene, camera } = useThree();
  // Update capture fn each render so it always uses latest context
  captureRef.current = () => {
    gl.render(scene, camera);
    return gl.domElement.toDataURL('image/jpeg', 0.82);
  };
  return null;
}

// -------------------------------------------------------
// Room ghost — renders the 3DSL base GLB as a translucent reference
// Helps users build furniture in context of the actual space
// -------------------------------------------------------
function RoomGhostGlb({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const ghost = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#7090b0',
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          roughness: 0.9,
          metalness: 0,
        });
        child.castShadow = false;
        child.receiveShadow = false;
      }
    });
    return clone;
  }, [scene]);
  return <primitive object={ghost} />;
}

// -------------------------------------------------------
// Layout context panel — room preview with placed items
// Shown as floating overlay in DSC 3D view when opened from 3DSL

// Error boundary so a failing useGLTF never crashes the panel Canvas
class LayoutPanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: Error) { console.warn('[LayoutPanel] GLB load error (suppressed):', err); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
// -------------------------------------------------------

// -------------------------------------------------------
// Panel GLB helpers
// All content inside LayoutContextPanel is wrapped in <group scale={0.001}>
// so everything lives in native mm coordinates — no /1000 divisions needed here.
// -------------------------------------------------------

// Loads the room GLB and renders it with the same auto-centering that
// BaseGlb.jsx applies in the 3DSL viewport:
//   - XZ: bounding-box center → world origin (0, 0, 0)
//   - Y : floor (bbox.min.y) → 0
//
// Scale note:
//   The room GLB is in mm (same units as 3DSL, which uses mm as Three.js units).
//   We apply scale={0.001} on this component's own group so it converts to metres,
//   matching the furniture items that live inside a shared <group scale={0.001}>.
//   Centering is computed AFTER the 0.001 scale is applied, so centre.x/z and
//   minY are already in metres — g.position adjustments are therefore correct.
//
// Materials:
//   DoubleSide is set so walls/ceiling render from any camera angle, same as
//   BaseGlb.jsx which also applies DoubleSide in layout mode.
function PanelRoomGlb({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const clone = useMemo(() => {
    if (!gltf?.scene) return null;
    const c = gltf.scene.clone(true);
    // DoubleSide: walls/ceiling visible from any camera direction
    c.traverse((child: any) => {
      if (!child.isMesh) return;
      const applyDouble = (m: any) => { m.side = THREE.DoubleSide; m.needsUpdate = true; };
      if (Array.isArray(child.material)) child.material.forEach(applyDouble);
      else if (child.material) applyDouble(child.material);
    });
    return c;
  }, [gltf.scene]);

  // Apply BaseGlb.jsx-compatible centering after mount.
  // The group has scale={0.001}, so Box3 bounds are in metres (world space).
  // g.position has no parent scale → also in metres → subtraction is consistent.
  useEffect(() => {
    const g = groupRef.current;
    if (!g || !clone) return;
    g.position.set(0, 0, 0);          // reset before re-computing
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const minY   = box.min.y;
    if (isFinite(center.x) && isFinite(center.z) && isFinite(minY)) {
      g.position.x -= center.x;       // XZ centre → world origin
      g.position.z -= center.z;
      g.position.y -= minY;           // floor → Y = 0
      g.updateMatrixWorld(true);
    }
  }, [clone]);

  if (!clone) return null;
  // scale={0.001}: room is in mm → convert to metres, same as furniture scale group
  return (
    <group ref={groupRef} scale={0.001}>
      <primitive object={clone} />
    </group>
  );
}

// Fallback box shown while a furniture GLB is loading, or when no glbUrl is set.
// Dimensions are in mm (inside <group scale={0.001}>).
function PanelFurnitureFallbackBox({ dimensions }: { dimensions: { width: number; height: number; depth: number } }) {
  const { width, height, depth } = dimensions; // mm
  return (
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color="#7090b0" transparent opacity={0.7} roughness={0.7} metalness={0} />
    </mesh>
  );
}

// Loads a furniture GLB, clones it and auto-scales + bottom-aligns to match 3DSL.
// Mirrors FurnitureGlbResolvedInner in 3DSL exactly:
//   scaleVal = targetWidth_mm / native_model_width
//   offsetY  = -box.min.y  (shift bottom of model to Y=0 in local space)
// Structure: <group scale> → <group position Y-offset> → <primitive>
// This matches the item.position[1]=0 → floor-level convention used in 3DSL.
function PanelFurnitureGlb({
  url,
  dimensions,
}: {
  url: string;
  dimensions: { width: number; height: number; depth: number };
}) {
  const gltf = useGLTF(url);
  const { clone, scaleVal, offsetY } = useMemo(() => {
    if (!gltf?.scene) return { clone: null, scaleVal: 1, offsetY: 0 };
    const c = gltf.scene.clone(true);
    const box  = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    box.getSize(size);
    const s  = size.x > 0 ? dimensions.width / size.x : 1;
    const oy = box.isEmpty() ? 0 : -box.min.y;
    return { clone: c, scaleVal: s, offsetY: oy };
  }, [gltf.scene, dimensions.width]);

  if (!clone) return <PanelFurnitureFallbackBox dimensions={dimensions} />;
  // Outer group applies uniform scale; inner group shifts bottom to Y=0
  return (
    <group scale={[scaleVal, scaleVal, scaleVal]}>
      <group position={[0, offsetY, 0]}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

// Hard-clips camera control to the panel canvas boundary.
//
// Why this is necessary:
//   Three.js OrbitControls calls canvas.setPointerCapture(id) on pointerdown.
//   Pointer capture routes ALL subsequent pointermove events to the canvas even
//   when the physical cursor is outside the panel — so OrbitControls would keep
//   moving the camera outside the panel bounds.
//
// Why capture-phase + stopImmediatePropagation works:
//   Three.js dynamically adds its pointermove listener (bubble phase) inside
//   onPointerDown.  Our listener uses { capture: true }, so at the target element
//   capture listeners fire before bubble listeners.  stopImmediatePropagation()
//   on the capture listener prevents Three.js's bubble listener from running for
//   that event — the camera does NOT update for the out-of-bounds move frame.
//   We then dispatch pointercancel so Three.js releases capture and resets state.
function PanelBoundaryGuard() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onMove = (e: PointerEvent) => {
      if (!e.buttons) return;                               // no button held → no drag
      const r = canvas.getBoundingClientRect();
      if (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.bottom
      ) return;                                             // cursor still inside panel
      // Cursor left the panel while dragging:
      e.stopImmediatePropagation();                         // block Three.js pointermove (camera stays)
      canvas.dispatchEvent(new PointerEvent('pointercancel', {
        pointerId:   e.pointerId,
        pointerType: e.pointerType,
        bubbles:     true,
        cancelable:  false,
      }));                                                  // Three.js releases capture + resets state
    };
    // capture:true → fires before Three.js's dynamically-added bubble listener
    canvas.addEventListener('pointermove', onMove, { capture: true });
    return () => canvas.removeEventListener('pointermove', onMove, { capture: true });
  }, [gl]);
  return null;
}

// Auto-fits the panel camera to the placed-items bounds.
// Bounds are computed from item data directly (not scene.setFromObject) so the
// 20 m grid doesn't contaminate the calculation.
// Positions are in mm (3DSL convention) → convert to metres for the panel Canvas.
// IMPORTANT: OrbitControls' makeDefault runs in a React useEffect, which fires
// *after* the first requestAnimationFrame tick.  We must wait for controls to be
// non-null before marking done, otherwise oc.target.set() is skipped and
// OrbitControls resets the camera toward its default target (0,0,0) on frame 2.
function LayoutPanelAutoFit({ layoutItems }: { layoutItems: any[] }) {
  const { camera, controls } = useThree();
  const done = useRef(false);

  useFrame(() => {
    if (done.current) return;
    const oc = controls as any;
    if (!oc) return;   // wait for OrbitControls makeDefault effect to run
    done.current = true;

    let cx = 0, cz = 0, maxExt = 2;

    if (layoutItems.length > 0) {
      let minX =  Infinity, maxX = -Infinity;
      let minZ =  Infinity, maxZ = -Infinity;
      for (const it of layoutItems) {
        const [px, , pz] = it.position as [number, number, number];
        const pxM = px / 1000, pzM = pz / 1000;                    // mm → m
        const hw = (it.dimensions?.width  ?? 500) / 2000;           // m
        const hd = (it.dimensions?.depth  ?? 500) / 2000;           // m
        minX = Math.min(minX, pxM - hw); maxX = Math.max(maxX, pxM + hw);
        minZ = Math.min(minZ, pzM - hd); maxZ = Math.max(maxZ, pzM + hd);
      }
      cx     = (minX + maxX) / 2;
      cz     = (minZ + maxZ) / 2;
      maxExt = Math.max((maxX - minX) / 2, (maxZ - minZ) / 2, 2);
    }

    const dist = Math.max(maxExt * 3, 10);
    oc.target.set(cx, 0, cz);
    camera.position.set(cx + dist * 0.65, dist * 0.65, cz + dist * 0.65);
    camera.lookAt(cx, 0, cz);
    oc.update();
  });
  return null;
}

// -------------------------------------------------------
// LayoutSplitPane — left pane in split-screen mode
// Renders the 3DSL room + placed items side-by-side with the 3DSC editor.
// Because the two canvases are adjacent (not overlapping) OrbitControls
// pointer-capture never leaks into the other pane — no boundary guard needed.
// -------------------------------------------------------
function LayoutSplitPane({
  originContext,
  onClose,
  width,
}: {
  originContext: { baseGlbUrl?: string; layoutItems?: any[] } | null;
  onClose?: () => void;
  width?: number;
}) {
  const layoutItems = originContext?.layoutItems ?? [];

  return (
    <Box sx={{
      width: width ?? 420,
      minWidth: 220,
      flexShrink: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: '#080e1c',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box sx={{
        height: 30, flexShrink: 0,
        display: 'flex', alignItems: 'center', px: 1.5, gap: 0.75,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        bgcolor: 'rgba(5,10,20,0.92)',
      }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(100,181,246,0.65)', flexShrink: 0 }} />
        <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(100,181,246,0.85)', lineHeight: 1, flex: 1 }}>
          レイアウトビュー
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', lineHeight: 1, whiteSpace: 'nowrap', mr: 0.5 }}>
          RMB: 回転　Shift+RMB: パン　Ctrl+RMB: ズーム
        </Typography>
        {/* Close button */}
        <Tooltip title="レイアウトビューを閉じる" arrow placement="bottom">
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              width: 18, height: 18, borderRadius: 0.5, p: 0,
              color: 'rgba(100,181,246,0.5)',
              '&:hover': { bgcolor: 'rgba(100,181,246,0.12)', color: 'rgba(100,181,246,0.9)' },
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 300 }}>✕</span>
          </IconButton>
        </Tooltip>
      </Box>

      {/* Canvas area */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Canvas
          camera={{ position: [8, 6, 8], fov: 50, near: 0.05, far: 500 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
          style={{ background: '#0a1830', width: '100%', height: '100%' }}
        >
          <color attach="background" args={['#0a1830']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[8, 12, 6]} intensity={0.9} />
          <directionalLight position={[-4, 4, -4]} intensity={0.3} />
          <gridHelper args={[20, 20, 0x2a4060, 0x1a2a40]} />
          {/* 3DSCエディタと同じカメラ操作: RMB=回転 / Shift+RMB=パン / Ctrl+RMB=ズーム */}
          <OrbitControls
            makeDefault
            enableDamping={false}
            mouseButtons={{
              LEFT: null,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
          />
          <DscCameraController />
          {/* 部屋GLB: メートル単位で作成済み → スケールラッパーの外に配置 */}
          {originContext?.baseGlbUrl && (
            <Suspense fallback={null}>
              <PanelRoomGlb url={originContext.baseGlbUrl} />
            </Suspense>
          )}
          {/* 家具アイテム: 位置はmm単位 → 0.001ラッパーでメートルに変換 */}
          <group scale={0.001}>
            {layoutItems.map((item: any) => (
              <group key={item.id} position={item.position} rotation={item.rotation ?? [0, 0, 0]}>
                {item.glbUrl ? (
                  <Suspense fallback={<PanelFurnitureFallbackBox dimensions={item.dimensions} />}>
                    <PanelFurnitureGlb url={item.glbUrl} dimensions={item.dimensions} />
                  </Suspense>
                ) : (
                  <PanelFurnitureFallbackBox dimensions={item.dimensions} />
                )}
              </group>
            ))}
          </group>
          <LayoutPanelAutoFit layoutItems={layoutItems} />
        </Canvas>

        {layoutItems.length === 0 && (
          <Typography sx={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 10, color: 'rgba(255,255,255,0.4)',
            pointerEvents: 'none', textAlign: 'center', lineHeight: 1.6,
          }}>
            3DSL に配置された<br />アイテムがありません
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// -------------------------------------------------------
// LayoutContextPanel — legacy floating overlay (kept for reference)
// -------------------------------------------------------
function LayoutContextPanel({
  originContext,
}: {
  originContext: { baseGlbUrl?: string; layoutItems?: any[] } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // active = true → OrbitControls enabled, user clicked inside panel to operate camera
  // active = false → OrbitControls disabled, transparent overlay blocks canvas events
  const [active, setActive] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const layoutItems = originContext?.layoutItems ?? [];

  // When active, clicking anywhere outside the panel deactivates it.
  // Use the native capture phase so the handler fires before any stopPropagation.
  useEffect(() => {
    if (!active) return;
    const onDocDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setActive(false);
    };
    document.addEventListener('pointerdown', onDocDown, true);
    return () => document.removeEventListener('pointerdown', onDocDown, true);
  }, [active]);

  if (!originContext || (layoutItems.length === 0 && !originContext.baseGlbUrl)) return null;

  return (
    <Box
      ref={panelRef}
      sx={{
        position: 'absolute', top: 12, left: 12, zIndex: 20,
        width: collapsed ? 152 : 440,
        height: collapsed ? 34 : 334,
        borderRadius: 1.5,
        border: `1px solid ${active ? 'rgba(100,181,246,0.75)' : 'rgba(100,181,246,0.35)'}`,
        overflow: 'hidden',
        boxShadow: active
          ? '0 4px 24px rgba(0,0,0,0.65), 0 0 0 2px rgba(100,181,246,0.18)'
          : '0 4px 24px rgba(0,0,0,0.65)',
        transition: 'width 0.2s ease, height 0.2s ease, border-color 0.15s, box-shadow 0.15s',
        bgcolor: 'rgba(8,12,22,0.96)',
        pointerEvents: 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Header — click to collapse/expand */}
      <Box
        onClick={() => setCollapsed(v => !v)}
        sx={{
          height: 34, display: 'flex', alignItems: 'center', px: 1.25, gap: 0.75,
          borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.07)',
          cursor: 'pointer', userSelect: 'none',
          '&:hover': { bgcolor: 'rgba(15,20,35,0.96)' },
        }}
      >
        <Box sx={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          bgcolor: active ? '#64b5f6' : 'rgba(100,181,246,0.4)',
          transition: 'background-color 0.15s',
        }} />
        <Typography sx={{
          fontSize: 10, fontWeight: 700, flex: 1, lineHeight: 1,
          color: active ? 'rgba(100,181,246,1.0)' : 'rgba(100,181,246,0.8)',
          transition: 'color 0.15s',
        }}>
          レイアウトビュー{active ? ' ●' : ''}
        </Typography>
        <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', flexShrink: 0, lineHeight: 1 }}>
          {collapsed ? '◀' : '▼'}
        </Typography>
      </Box>

      {/* Body: dedicated R3F Canvas — independent WebGL context.
          All 3DSL content is inside <group scale={0.001}> (mm → m conversion).
          OrbitControls is disabled when the panel is inactive; a transparent overlay
          captures clicks and activates the panel on demand (multi-viewport pattern). */}
      {!collapsed && (
        <Box sx={{ height: 'calc(100% - 34px)', position: 'relative', bgcolor: '#0a1830' }}>
          <Canvas
            camera={{ position: [8, 6, 8], fov: 50, near: 0.05, far: 500 }}
            gl={{ antialias: true, alpha: false, powerPreference: 'default' }}
            style={{ background: '#0a1830', width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#0a1830']} />
            <ambientLight intensity={1.2} />
            <directionalLight position={[8, 12, 6]} intensity={0.9} />
            <directionalLight position={[-4, 4, -4]} intensity={0.3} />
            <gridHelper args={[20, 20, 0x2a4060, 0x1a2a40]} />
            <OrbitControls
              makeDefault
              enabled={active}
              enableDamping={false}
              mouseButtons={{
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.PAN,
              }}
            />
            {/* 0.001 wrapper: all children use native mm coordinates */}
            <group scale={0.001}>
              {originContext.baseGlbUrl && (
                <Suspense fallback={null}>
                  <PanelRoomGlb url={originContext.baseGlbUrl} />
                </Suspense>
              )}
              {layoutItems.map((item: any) => (
                <group key={item.id} position={item.position} rotation={item.rotation ?? [0, 0, 0]}>
                  {item.glbUrl ? (
                    <Suspense fallback={<PanelFurnitureFallbackBox dimensions={item.dimensions} />}>
                      <PanelFurnitureGlb url={item.glbUrl} dimensions={item.dimensions} />
                    </Suspense>
                  ) : (
                    <PanelFurnitureFallbackBox dimensions={item.dimensions} />
                  )}
                </group>
              ))}
            </group>
            <PanelBoundaryGuard />
            <LayoutPanelAutoFit layoutItems={layoutItems} />
          </Canvas>

          {/* Inactive overlay — sits above the canvas, blocks all canvas pointer events.
              Click activates the panel and removes this overlay so events reach the canvas. */}
          {!active && (
            <Box
              onPointerDown={(e) => { e.stopPropagation(); setActive(true); }}
              sx={{
                position: 'absolute', inset: 0, zIndex: 2,
                cursor: 'crosshair',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                '&:hover': { background: 'rgba(100,181,246,0.04)' },
              }}
            >
              <Typography sx={{
                fontSize: 9, color: 'rgba(255,255,255,0.28)',
                userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.04em',
              }}>
                クリックしてカメラ操作
              </Typography>
            </Box>
          )}

          {/* Operation hint — visible only while active */}
          {active && (
            <Typography sx={{
              position: 'absolute', bottom: 4, right: 6, zIndex: 3,
              fontSize: 8.5, color: 'rgba(100,181,246,0.7)',
              pointerEvents: 'none', lineHeight: 1,
              textShadow: '0 1px 2px rgba(0,0,0,0.85)',
            }}>
              LMB: 回転　MMB/RMB: パン　ホイール: ズーム
            </Typography>
          )}

          {layoutItems.length === 0 && (
            <Typography sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 10, color: 'rgba(255,255,255,0.4)',
              pointerEvents: 'none', textAlign: 'center', lineHeight: 1.4,
            }}>
              3DSL に配置された<br />アイテムがありません
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

// -------------------------------------------------------
// Main DscStudio export
// -------------------------------------------------------
export function DscStudio({ payload, onBack }: { payload: any; onBack: () => void }) {
  const { components, selectedId, selectComponent, viewMode, setViewMode, furnitureName, setFurnitureName, currentWorkFileId, showDscRightSidebar, originContext, dirty } = useDscStore();
  const { activeProjectId, projects } = useAppStore();
  const { currentUser } = useAuthStore();
  const captureRef = useRef<(() => string | null) | null>(null);

  // 自動保存（ローカル下書きのみ）— 編集停止後に 3DSC フォルダへ書き出す
  const dscProjectName = projects.find(p => p.id === activeProjectId)?.name || 'UnnamedProject';
  const dscSignal = useMemo(() => ({}), [furnitureName, components]);
  useAutosaveDraft({
    key: activeProjectId ? `3dsc:${currentWorkFileId || '__dsc_new__'}` : null,
    dirty,
    signal: dscSignal,
    save: async () => {
      if (!activeProjectId) return;
      await dscFsHelpers.saveLocalDraft(
        activeProjectId, dscProjectName,
        currentWorkFileId || '__dsc_new__', furnitureName || 'untitled',
        { furnitureName, components },
      );
    },
  });

  // Room ghost toggle — show/hide the 3DSL base room for spatial reference
  const [showRoomGhost, setShowRoomGhost] = useState(!!originContext?.baseGlbUrl);
  const [isInserting, setIsInserting] = useState(false);

  // ── テンプレート登録ダイアログ ─────────────────────────────────────────────
  const [saveTemplateOpen,    setSaveTemplateOpen]    = useState(false);
  const [saveTemplateThumbnail, setSaveTemplateThumbnail] = useState<string | null>(null);

  const handleOpenSaveTemplate = () => {
    // キャンバスのスクリーンショットを取得してからダイアログを開く
    const thumb = captureRef.current?.() ?? null;
    setSaveTemplateThumbnail(thumb);
    setSaveTemplateOpen(true);
  };

  // ── 全選択ハイライト ───────────────────────────────────────────────────────
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  // ギズモドラッグ中のマルチ選択オフセット (store単位: mm)
  const [multiDragDelta, setMultiDragDelta] = useState<[number, number, number] | null>(null);

  // ── レイアウトビュー開閉・幅 ───────────────────────────────────────────────
  const [layoutPanelOpen, setLayoutPanelOpen] = useState(true);
  const [layoutPanelWidth, setLayoutPanelWidth] = useState(420); // px

  // ── グリッド設定 ───────────────────────────────────────────────────────────
  const [gridCellMm,    setGridCellMm]    = useState(100);
  const [gridLineColor, setGridLineColor] = useState('#2a4a80'); // grid line base color
  const [gridColorAnchor, setGridColorAnchor] = useState<HTMLElement | null>(null);
  const GRID_SIZES = [10, 50, 100, 200, 500];


  // ── カメラフォーカス用コールバック refs ────────────────────────────────────
  const focus3dRef    = useRef<((comps: any[]) => void) | null>(null);
  const focusFrontRef = useRef<((comps: any[]) => void) | null>(null);
  const focusSideRef  = useRef<((comps: any[]) => void) | null>(null);
  const focusTopRef   = useRef<((comps: any[]) => void) | null>(null);
  const focusPlanRef  = useRef<((comps: any[]) => void) | null>(null);
  const focusElevRef  = useRef<((comps: any[]) => void) | null>(null);

  // ── 3D ビュー 矩形選択 ────────────────────────────────────────────────────
  const threeCameraRef   = useRef<THREE.Camera | null>(null);
  const canvasWrapRef    = useRef<HTMLDivElement>(null);
  const isDraggingSelRef  = useRef(false);
  const selStartRef       = useRef<{ x: number; y: number } | null>(null);
  const selCurRef         = useRef<{ x: number; y: number } | null>(null);
  // ギズモドラッグ中は矩形選択を抑制するフラグ
  const gizmoIsDraggingRef = useRef(false);
  const [selRect, setSelRect] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  // ── キーボードショートカット ───────────────────────────────────────────────
  // Delete/Backspace: 削除   Ctrl+A: 全選択&全フォーカス
  // F: 選択パーツにフォーカス   ZA (2打鍵): 全ビューを全パーツにフォーカス
  React.useEffect(() => {
    const keySeq = { v: '' };
    let seqTimer: ReturnType<typeof setTimeout> | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable;

      // Delete / Backspace — テキスト入力中は無視
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        const { selectedId: sid, removeComponent } = useDscStore.getState();
        if (sid) { removeComponent(sid); setMultiSelectedIds([]); }
        return;
      }

      if (isInput) return;

      // Ctrl+A — 全選択 + 全ビューフォーカス
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        const { components: comps } = useDscStore.getState();
        setMultiSelectedIds(comps.map(c => c.id));
        focus3dRef.current?.(comps);
        focusFrontRef.current?.(comps);
        focusSideRef.current?.(comps);
        focusTopRef.current?.(comps);
        focusPlanRef.current?.(comps);
        focusElevRef.current?.(comps);
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      // F — 選択パーツ(またはすべて)にフォーカス
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        const { selectedId: sid, components: comps } = useDscStore.getState();
        const targets = sid ? comps.filter(c => c.id === sid) : comps;
        focus3dRef.current?.(targets);
        focusFrontRef.current?.(targets);
        focusSideRef.current?.(targets);
        focusTopRef.current?.(targets);
        focusPlanRef.current?.(targets);
        focusElevRef.current?.(targets);
        return;
      }

      // Escape — 全選択解除
      if (e.key === 'Escape') {
        setMultiSelectedIds([]);
        useDscStore.getState().selectComponent(null);
        return;
      }

      // 2打鍵シーケンス: ZA → 全ビューを全パーツにフォーカス
      keySeq.v = (keySeq.v + e.key.toLowerCase()).slice(-4);
      if (seqTimer) clearTimeout(seqTimer);
      seqTimer = setTimeout(() => { keySeq.v = ''; }, 800);

      if (keySeq.v.endsWith('za')) {
        keySeq.v = '';
        if (seqTimer) { clearTimeout(seqTimer); seqTimer = null; }
        const { components: comps } = useDscStore.getState();
        focus3dRef.current?.(comps);
        focusFrontRef.current?.(comps);
        focusSideRef.current?.(comps);
        focusTopRef.current?.(comps);
        focusPlanRef.current?.(comps);
        focusElevRef.current?.(comps);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (seqTimer) clearTimeout(seqTimer);
    };
  }, []);

  // 保存状態
  const [isSaving, setIsSaving] = useState(false);         // Firestore WorkFile 保存中
  const [isGlbSaving, setIsGlbSaving] = useState(false);   // ローカル GLB 保存中
  const [isPreparingGlb, setIsPreparingGlb] = useState(false); // 3DSS ダイアログ用 GLB 生成中
  const [saveStatus, setSaveStatus] = useState<{ text: string; color: string } | null>(null);

  // 3DSS アップロードダイアログ
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const activeProjectName = projects?.find((p: any) => p.id === activeProjectId)?.name || 'UnnamedProject';

  // ── サムネイル付き保存（その場で保存、ダッシュボードに反映）──────────────────
  const handleSave = useCallback(async () => {
    if (!activeProjectId || !currentUser) {
      alert('プロジェクトを選択してから保存してください。\n左サイドバーからプロジェクトを選んでください。');
      return;
    }
    if (isSaving) return;
    setIsSaving(true);
    try {
      // 1. WorkFile を作成 or 更新
      let fileId = currentWorkFileId;
      if (fileId) {
        await WorkFileRepository.updateWorkFile(activeProjectId, fileId, {
          name: furnitureName || '新規造作家具',
          componentsJson: JSON.stringify(components),
        } as any);
      } else {
        const newFile = await WorkFileRepository.createWorkFile({
          projectId: activeProjectId,
          name: furnitureName || '新規造作家具',
          appScope: '3dsc',
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          status: 'active',
          thumbnailUrl: null,
          storagePath: null,
          componentsJson: JSON.stringify(components),
        });
        fileId = newFile.id;
        useDscStore.getState().setCurrentWorkFileId(fileId);
      }

      // 2. サムネイルキャプチャ → Storage アップロード
      if (captureRef.current && fileId && components.length > 0) {
        try {
          const dataUrl = captureRef.current();
          if (dataUrl) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const thumbFile = new File([blob], 'preview_thumb.jpg', { type: 'image/jpeg' });
            await WorkFileRepository.updateWorkFilePreviewAssets({
              projectId: activeProjectId,
              workFileId: fileId,
              thumbnailFile: thumbFile,
            });
          }
        } catch (thumbErr) {
          console.warn('[DSC] Thumbnail upload skipped (non-critical):', thumbErr);
        }
      }

      useDscStore.getState().incrementSavedCount(); // サイドバー・ダッシュボードを再フェッチ
      useDscStore.getState().setDirty(false); // 保存完了 → 未保存フラグ解除
      // 退避セッションをクリア（保存済みなので復元不要）
      const { DSC_NEW_SESSION_KEY } = await import('../store/useDscStore');
      useDscStore.getState().clearSession(DSC_NEW_SESSION_KEY);
      if (fileId) useDscStore.getState().clearSession(fileId);
      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      setSaveStatus({ text: `クラウド保存済み ${now}`, color: '#ffa726' });
    } catch (err) {
      console.error('[DSC] Failed to save furniture:', err);
      alert('保存に失敗しました。もう一度お試しください。');
    } finally {
      setIsSaving(false);
    }
  }, [furnitureName, components, activeProjectId, currentUser, currentWorkFileId, isSaving]);

  // ── GLB としてローカルに保存 ──────────────────────────────────────────────────
  const handleSaveGlb = useCallback(async () => {
    if (!activeProjectId) {
      alert('プロジェクトを選択してから保存してください。');
      return;
    }
    if (components.length === 0) {
      alert('パーツを追加してから保存してください。');
      return;
    }
    if (isGlbSaving) return;
    setIsGlbSaving(true);
    try {
      const glbBuffer = await exportComponentsToGlb(components);
      const savedPath = await saveGlbLocally(activeProjectId, activeProjectName, furnitureName, glbBuffer);
      const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      setSaveStatus({ text: `GLB保存済み ${now}`, color: '#66bb6a' });
      console.info('[DSC] GLB saved to:', savedPath);
    } catch (err) {
      console.error('[DSC] GLB save failed:', err);
      alert('GLBの保存に失敗しました。\n' + String(err));
    } finally {
      setIsGlbSaving(false);
    }
  }, [components, activeProjectId, activeProjectName, furnitureName, isGlbSaving]);

  // ── 3DSS アップロードダイアログを開く ────────────────────────────────────────
  const handleSaveTo3dss = useCallback(async () => {
    if (components.length === 0) {
      alert('パーツを追加してから保存してください。');
      return;
    }
    if (isPreparingGlb) return;
    setIsPreparingGlb(true);
    try {
      // 1. GLB バッファを生成
      const glbBuffer = await exportComponentsToGlb(components);
      const safeName  = (furnitureName || '造作家具').replace(/[\\/:*?"<>|]/g, '_');
      const glbFile   = new File([glbBuffer], `${safeName}.glb`, { type: 'model/gltf-binary' });

      // 2. AI 3DCreate と同様に家具の寸法を計算して File に付与
      const bbox = components.reduce(
        (acc, c) => ({
          width:  Math.max(acc.width,  Math.abs(c.position[0]) * 2 + c.dimensions.width),
          height: Math.max(acc.height, c.position[1] + c.dimensions.height),
          depth:  Math.max(acc.depth,  Math.abs(c.position[2]) * 2 + c.dimensions.depth),
        }),
        { width: 0, height: 0, depth: 0 },
      );
      (glbFile as any).dimensionsMm = {
        width:  Math.round(bbox.width),
        depth:  Math.round(bbox.depth),
        height: Math.round(bbox.height),
      };
      (glbFile as any).dscGenerated = true; // 3DSC 由来フラグ

      // 3. ダイアログに渡して開く（アップロード自体はダイアログが担当）
      setUploadFiles([glbFile]);
      setUploadModalOpen(true);
    } catch (err) {
      console.error('[DSC] GLB generation for 3DSS failed:', err);
      alert('GLBの生成に失敗しました。\n' + String(err));
    } finally {
      setIsPreparingGlb(false);
    }
  }, [components, furnitureName, isPreparingGlb]);

  const handleInsertAndReturn = useCallback(async () => {
    if (!activeProjectId || !currentUser) {
      alert('プロジェクトを選択してから保存してください。\n左サイドバーからプロジェクトを選んでください。');
      return;
    }
    if (isInserting) return;
    setIsInserting(true);
    try {
      // ── 1. WorkFile を保存 ──
      let fileId = currentWorkFileId;
      if (fileId) {
        await WorkFileRepository.updateWorkFile(activeProjectId, fileId, {
          name: furnitureName || '新規造作家具',
          componentsJson: JSON.stringify(components),
        } as any);
      } else {
        const newFile = await WorkFileRepository.createWorkFile({
          projectId: activeProjectId,
          name: furnitureName || '新規造作家具',
          appScope: '3dsc',
          createdBy: currentUser.uid,
          updatedBy: currentUser.uid,
          status: 'active',
          thumbnailUrl: null,
          storagePath: null,
          componentsJson: JSON.stringify(components),
        });
        fileId = newFile.id;
        useDscStore.getState().setCurrentWorkFileId(fileId);
      }

      // ── 2. サムネイルをキャプチャして Storage にアップロード ──
      if (captureRef.current && fileId && components.length > 0) {
        try {
          const dataUrl = captureRef.current();
          if (dataUrl) {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const thumbFile = new File([blob], 'preview_thumb.jpg', { type: 'image/jpeg' });
            await WorkFileRepository.updateWorkFilePreviewAssets({
              projectId: activeProjectId,
              workFileId: fileId,
              thumbnailFile: thumbFile,
            });
          }
        } catch (thumbErr) {
          console.warn('[DSC] Thumbnail upload skipped (non-critical):', thumbErr);
        }
      }

      // ── 3. 3DSL コンテキストがあれば GLB を生成してレイアウトに挿入 ──
      const ctx = useDscStore.getState().originContext;
      if (ctx?.planId && ctx?.workspaceId) {
        // GLB バッファ生成
        const glbBuffer = await exportComponentsToGlb(components);

        // Firebase Storage にアップロード
        const safeName  = (furnitureName || '造作家具').replace(/[\\/:*?"<>|]/g, '_');
        const gsPath    = `projects/${activeProjectId}/3dsc/${safeName}_${Date.now()}.glb`;
        const sRef      = storageRef(storage, gsPath);
        await uploadBytes(sRef, new Uint8Array(glbBuffer));
        const downloadUrl = await getDownloadURL(sRef);

        // 家具の外形寸法を計算 (mm → Three.js m)
        const bbox = components.reduce(
          (acc, c) => ({
            w: Math.max(acc.w, Math.abs(c.position[0]) + c.dimensions.width  / 2),
            h: Math.max(acc.h, c.position[1] + c.dimensions.height),
            d: Math.max(acc.d, Math.abs(c.position[2]) + c.dimensions.depth  / 2),
          }),
          { w: 0, h: 0, d: 0 },
        );

        // 3DSL レイアウトに造作家具として追加
        await layoutItemsApi.addExternalModelToLayoutBatch({
          projectId:  activeProjectId,
          workspaceId: ctx.workspaceId,
          planId:     ctx.planId,
          assetData: {
            itemType: '造作家具',
            name:     furnitureName || '造作家具',
            modelUrl: downloadUrl,
            dimensions: { x: bbox.w * 2 / 1000, y: bbox.h / 1000, z: bbox.d * 2 / 1000 },
            tags:     ['造作家具', '3DSC'],
          },
          transform: {
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale:    [1, 1, 1],
          },
          userId: currentUser.uid,
        });
      }

      useDscStore.getState().incrementSavedCount();
      useDscStore.getState().resetStudio();
      onBack();
    } catch (err) {
      console.error('[DSC] Failed to insert furniture into 3DSL:', err);
      alert('S.Layoutへの挿入に失敗しました。もう一度お試しください。');
    } finally {
      setIsInserting(false);
    }
  }, [furnitureName, components, activeProjectId, currentUser, currentWorkFileId, isInserting, onBack]);

  // ── 数値移動ダイアログ (ギズモ矢印ダブルクリック) ──────────────────────────────
  // threeAxis: Three.js 内部軸名 ('x'=左右 / 'y'=上下 / 'z'=前後)
  // UI 軸との対応: Three.js x→UI X, Three.js y→UI Z(上下), Three.js z→UI Y(前後)
  const THREEJS_AXIS_UI_LABEL = {
    x: 'X（左右）', y: 'Z（上下）', z: 'Y（前後）',
  } as const;
  const [numericMove, setNumericMove] = useState<{
    open: boolean; threeAxis: 'x' | 'y' | 'z' | null;
    dx: string; dy: string; dz: string;
  }>({ open: false, threeAxis: null, dx: '', dy: '', dz: '' });

  const handleGizmoDoubleClick = useCallback((threeAxis: 'x' | 'y' | 'z' | null) => {
    setNumericMove({ open: true, threeAxis, dx: '', dy: '', dz: '' });
  }, []);

  const handleApplyNumericMove = useCallback(() => {
    const sid = useDscStore.getState().selectedId;
    if (!sid) return;
    const comp = useDscStore.getState().components.find(c => c.id === sid);
    if (!comp) return;

    const newPos = [...comp.position] as [number, number, number];
    // UI フィールド → store 配列インデックスのマッピング
    // dx (X 左右) → pos[0]
    // dy (Y 前後) → pos[2]  ← depth/front-back
    // dz (Z 上下) → pos[1]  ← vertical/floor-height
    const dx = parseFloat(numericMove.dx) || 0;
    const dy = parseFloat(numericMove.dy) || 0;
    const dz = parseFloat(numericMove.dz) || 0;
    newPos[0] = Math.round(newPos[0] + dx);
    newPos[1] = Math.round(newPos[1] + dz);  // Z上下 → pos[1]
    newPos[2] = Math.round(newPos[2] + dy);  // Y前後 → pos[2]

    useDscStore.getState().updateComponent(sid, { position: newPos });
    setNumericMove({ open: false, threeAxis: null, dx: '', dy: '', dz: '' });
  }, [numericMove]);

  // ── LMB 矩形選択ハンドラ (3D ビューのキャンバスラッパー用) ──────────────
  const handleCanvasLmbDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingSelRef.current = false;
    selStartRef.current = { x: e.clientX, y: e.clientY };
    selCurRef.current   = { x: e.clientX, y: e.clientY };
  }, []);

  const handleCanvasLmbMove = useCallback((e: React.PointerEvent) => {
    // ギズモドラッグ中は矩形選択を抑制（選択矩形が出ていたら消す）
    if (gizmoIsDraggingRef.current) {
      if (selRect) setSelRect(null);
      selStartRef.current      = null;
      isDraggingSelRef.current = false;
      return;
    }
    if (!selStartRef.current) return;
    selCurRef.current = { x: e.clientX, y: e.clientY };
    const dx = Math.abs(e.clientX - selStartRef.current.x);
    const dy = Math.abs(e.clientY - selStartRef.current.y);
    if (dx > 5 || dy > 5) {
      isDraggingSelRef.current = true;
      setSelRect({ startX: selStartRef.current.x, startY: selStartRef.current.y, curX: e.clientX, curY: e.clientY });
    }
  }, [selRect]);

  const handleCanvasLmbUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // ギズモドラッグ終了時は選択状態をリセットして終了
    if (gizmoIsDraggingRef.current) {
      selStartRef.current      = null;
      selCurRef.current        = null;
      isDraggingSelRef.current = false;
      setSelRect(null);
      return;
    }
    if (isDraggingSelRef.current && selStartRef.current && selCurRef.current && threeCameraRef.current && canvasWrapRef.current) {
      const rect = canvasWrapRef.current.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const sx1 = Math.min(selStartRef.current.x, selCurRef.current.x) - rect.left;
      const sx2 = Math.max(selStartRef.current.x, selCurRef.current.x) - rect.left;
      const sy1 = Math.min(selStartRef.current.y, selCurRef.current.y) - rect.top;
      const sy2 = Math.max(selStartRef.current.y, selCurRef.current.y) - rect.top;

      const cam = threeCameraRef.current;
      const selected: string[] = [];
      for (const comp of components) {
        const { width, height, depth } = comp.dimensions;
        const [cpx, cpy, cpz] = comp.position;
        const worldPos = new THREE.Vector3(cpx * SCALE, (cpy + height / 2) * SCALE, cpz * SCALE);
        const ndc = worldPos.clone().project(cam);
        const sx = (ndc.x + 1) / 2 * W;
        const sy = (-ndc.y + 1) / 2 * H;
        if (sx >= sx1 && sx <= sx2 && sy >= sy1 && sy <= sy2) selected.push(comp.id);
      }
      if (selected.length > 0) {
        setMultiSelectedIds(selected);
        selectComponent(selected.length === 1 ? selected[0] : null);
      }
    }
    selStartRef.current      = null;
    selCurRef.current        = null;
    isDraggingSelRef.current = false;
    setSelRect(null);
  }, [components, selectComponent]);

  // ── レイアウトビュー幅リサイズ ──────────────────────────────────────────────
  const handleLayoutResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = layoutPanelWidth;
    document.body.style.cursor    = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(220, Math.min(660, startW + (ev.clientX - startX)));
      setLayoutPanelWidth(w);
    };
    const onUp = () => {
      document.body.style.cursor    = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [layoutPanelWidth]);

  const render3DView = () => {
    const cellSize    = gridCellMm * SCALE;
    const sectionSize = gridCellMm * SCALE * 5;
    const hasLayoutContext = !!originContext &&
      ((originContext.layoutItems?.length ?? 0) > 0 || !!originContext.baseGlbUrl);

    return (
      <Box sx={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* レイアウトビュー — 3DSLから来た場合のみ左ペインに表示 */}
        {hasLayoutContext && layoutPanelOpen && (
          <>
            <LayoutSplitPane
              originContext={originContext}
              onClose={() => setLayoutPanelOpen(false)}
              width={layoutPanelWidth}
            />
            {/* ドラッグ幅調整ハンドル */}
            <Box
              onMouseDown={handleLayoutResizerMouseDown}
              sx={{
                width: 5, flexShrink: 0,
                cursor: 'col-resize',
                position: 'relative', zIndex: 5,
                bgcolor: 'rgba(255,255,255,0.04)',
                borderLeft:  '1px solid rgba(255,255,255,0.07)',
                borderRight: '1px solid rgba(255,255,255,0.07)',
                transition: 'background-color 0.15s',
                '&:hover': { bgcolor: 'rgba(100,181,246,0.14)' },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: 2, height: 32, borderRadius: 1,
                  backgroundColor: 'rgba(100,181,246,0)',
                  transition: 'background-color 0.15s',
                },
                '&:hover::after': {
                  backgroundColor: 'rgba(100,181,246,0.75)',
                },
              }}
            />
          </>
        )}

        {/* 3DSC エディタ (右ペイン) */}
        <Box sx={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* ヘッダー — スプリット時のみ表示 */}
          {hasLayoutContext && (
            <Box sx={{
              height: 30, flexShrink: 0,
              display: 'flex', alignItems: 'center', px: 1.5, gap: 0.75,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              bgcolor: 'rgba(5,10,20,0.92)',
            }}>
              {/* レイアウトビューが閉じているときの再展開ボタン */}
              {!layoutPanelOpen && (
                <Tooltip title="レイアウトビューを開く" arrow placement="bottom">
                  <Box
                    onClick={() => setLayoutPanelOpen(true)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5,
                      px: 0.75, height: 20, borderRadius: 0.75,
                      border: '1px solid rgba(100,181,246,0.3)',
                      color: 'rgba(100,181,246,0.7)',
                      cursor: 'pointer', mr: 0.5, flexShrink: 0,
                      '&:hover': { bgcolor: 'rgba(100,181,246,0.1)', color: 'rgba(100,181,246,1.0)', borderColor: 'rgba(100,181,246,0.6)' },
                      transition: 'all 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 9, lineHeight: 1 }}>▶</span>
                    <Typography sx={{ fontSize: 9, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}>
                      レイアウトビュー
                    </Typography>
                  </Box>
                </Tooltip>
              )}
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'rgba(255,167,38,0.65)', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,167,38,0.85)', lineHeight: 1, flex: 1 }}>
                3DSC エディタ
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', lineHeight: 1, whiteSpace: 'nowrap' }}>
                RMB: 回転　MMB: パン　LMB: 矩形選択
              </Typography>
            </Box>
          )}

          {/* キャンバス領域 */}
          <Box
            ref={canvasWrapRef}
            sx={{ flex: 1, position: 'relative', cursor: 'default', overflow: 'hidden' }}
            onPointerDown={handleCanvasLmbDown}
            onPointerMove={handleCanvasLmbMove}
            onPointerUp={handleCanvasLmbUp}
          >
        <Canvas
          camera={{ position: [2, 2, 2], fov: 45 }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          style={{ background: '#0d1117' }}
          shadows
          onPointerMissed={() => {
            useDscStore.getState().selectComponent(null);
            setMultiSelectedIds([]);
          }}
        >
          <CaptureHelper captureRef={captureRef} />
          <CameraFocuser view="3d" focusRef={focus3dRef} />
          <CameraExposer cameraRef={threeCameraRef} />
          {/* RMB=軌道回転, Shift+RMB=パン, Ctrl+RMB=ズーム, LMB=矩形選択 */}
          <DscCameraController />
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
          <directionalLight position={[-3, 2, -3]} intensity={0.3} />
          <Grid
            args={[20, 20]}
            cellSize={cellSize}
            sectionSize={sectionSize}
            cellColor={gridLineColor}
            sectionColor={gridLineColor}
            infiniteGrid
          />
          {/* LMB 無効 (矩形選択に使用), RMB=軌道回転, MIDDLE=パン */}
          <OrbitControls
            makeDefault
            enableDamping={false}
            mouseButtons={{
              LEFT: null,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
          />
          {/* 3DSL 部屋ゴースト — 空間コンテキストを参照しながら造作できる */}
          {showRoomGhost && originContext?.baseGlbUrl && (
            <RoomGhostGlb url={originContext.baseGlbUrl} />
          )}
          {components.map(comp =>
            selectedId === comp.id
              ? <GizmoMesh
                  key={comp.id} comp={comp}
                  multiSelectedIds={multiSelectedIds}
                  allComponents={components}
                  onMultiDrag={setMultiDragDelta}
                  onDragStateChange={(active) => { gizmoIsDraggingRef.current = active; }}
                  onSelect={(id, shiftKey) => {
                    if (shiftKey) {
                      setMultiSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                    } else {
                      setMultiSelectedIds([]);
                      selectComponent(id);
                    }
                  }}
                  onGizmoDoubleClick={handleGizmoDoubleClick}
                />
              : <FurnitureComponentMesh
                  key={comp.id} comp={comp}
                  isSelected={false}
                  isMultiSelected={multiSelectedIds.includes(comp.id)}
                  dragPositionOffset={multiSelectedIds.includes(comp.id) && multiDragDelta ? multiDragDelta : undefined}
                  onSelect={(id, shiftKey) => {
                    if (shiftKey) {
                      setMultiSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
                    } else {
                      setMultiSelectedIds([]);
                      selectComponent(id);
                    }
                  }}
                />
          )}
        </Canvas>

        {/* 矩形選択オーバーレイ */}
        {selRect && (() => {
          const baseRect = canvasWrapRef.current?.getBoundingClientRect();
          if (!baseRect) return null;
          return (
            <Box sx={{
              position: 'absolute', pointerEvents: 'none',
              left:   Math.min(selRect.startX, selRect.curX) - baseRect.left,
              top:    Math.min(selRect.startY, selRect.curY) - baseRect.top,
              width:  Math.abs(selRect.curX - selRect.startX),
              height: Math.abs(selRect.curY - selRect.startY),
              border: '1px dashed rgba(255,167,38,0.7)',
              bgcolor: 'rgba(255,167,38,0.05)',
            }} />
          );
        })()}
        {/* 空パーツ時のヒント — canvasWrapRef 基準で中央に表示 */}
        {components.length === 0 && (
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <ViewInArIcon sx={{ fontSize: 48, color: 'rgba(255,167,38,0.2)', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.2)' }}>左サイドバーのパーツタブからパーツを追加してください</Typography>
          </Box>
        )}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderContent = () => {
    const orthoProps = { components, gridCellMm, gridLineColor };
    if (viewMode === 'quad') {
      return (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: '100%', gap: '1px', bgcolor: 'rgba(255,255,255,0.08)' }}>
          <OrthoViewport view="top"   {...orthoProps} focusRef={focusTopRef}   />
          <Box sx={{ overflow: 'hidden', position: 'relative' }}>{render3DView()}</Box>
          <OrthoViewport view="front" {...orthoProps} focusRef={focusFrontRef} />
          <OrthoViewport view="side"  {...orthoProps} focusRef={focusSideRef}  />
        </Box>
      );
    }
    if (viewMode === 'front')   return <OrthoViewport view="front" {...orthoProps} focusRef={focusFrontRef} />;
    if (viewMode === 'side')    return <OrthoViewport view="side"  {...orthoProps} focusRef={focusSideRef}  />;
    if (viewMode === 'top')     return <OrthoViewport view="top"   {...orthoProps} focusRef={focusTopRef}   />;
    if (viewMode === 'plansec') return <SectionViewport type="plansec" {...orthoProps} focusRef={focusPlanRef} />;
    if (viewMode === 'elevsec') return <SectionViewport type="elevsec" {...orthoProps} focusRef={focusElevRef} />;
    return render3DView();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0d1117', color: 'text.primary' }}>

      {/* ── Top bar ── */}
      <Box sx={{ height: 52, px: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(10,15,25,0.98)', flexShrink: 0 }}>
        <IconButton size="small" onClick={onBack} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <TextField
          value={furnitureName}
          onChange={(e) => setFurnitureName(e.target.value)}
          size="small" variant="standard"
          sx={{ width: 200, '& .MuiInputBase-input': { color: '#fff', fontSize: 14, fontWeight: 700, p: '2px 4px' }, '& .MuiInput-underline:before': { borderColor: 'rgba(255,255,255,0.2)' } }}
        />
        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* View mode buttons */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {VIEW_MODES.map(({ key, label }) => (
            <Button key={key} size="small" variant={viewMode === key ? 'contained' : 'text'}
              onClick={() => setViewMode(key)}
              sx={{ minWidth: 36, px: 1, fontSize: 11, bgcolor: viewMode === key ? '#ffa726' : 'transparent', color: viewMode === key ? '#000' : 'rgba(255,255,255,0.5)', '&:hover': { bgcolor: viewMode === key ? '#fb8c00' : 'rgba(255,255,255,0.05)', color: viewMode === key ? '#000' : '#fff' } }}>
              {label}
            </Button>
          ))}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 0.5 }} />

        {/* Grid settings: size + color */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Grid size (click to cycle) */}
          <Tooltip title={`グリッドサイズ: ${gridCellMm}mm (クリックで切り替え)`} arrow>
            <Box
              onClick={() => {
                const idx = GRID_SIZES.indexOf(gridCellMm);
                setGridCellMm(GRID_SIZES[(idx + 1) % GRID_SIZES.length]);
              }}
              sx={{
                px: 1, py: 0.3, borderRadius: 1, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600,
                userSelect: 'none', transition: 'all 0.12s',
                '&:hover': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' },
              }}
            >
              Grid {gridCellMm}mm
            </Box>
          </Tooltip>
          {/* Grid line color picker */}
          <Tooltip title="グリッド線の色を変更" arrow>
            <Box
              onClick={(e) => setGridColorAnchor(e.currentTarget as HTMLElement)}
              sx={{
                width: 22, height: 22, borderRadius: 1, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.15)',
                bgcolor: gridLineColor, flexShrink: 0,
                transition: 'border-color 0.12s',
                '&:hover': { borderColor: 'rgba(255,255,255,0.5)' },
              }}
            />
          </Tooltip>
          <Popover
            open={Boolean(gridColorAnchor)}
            anchorEl={gridColorAnchor}
            onClose={() => setGridColorAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            PaperProps={{
              sx: {
                bgcolor: 'rgba(10,15,25,0.97)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 2, p: 1.5,
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                mt: 0.5,
              }
            }}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 9.5, fontWeight: 700, mb: 1, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              グリッド線の色
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="color"
                value={gridLineColor}
                onChange={(e) => setGridLineColor(e.target.value)}
                style={{ width: 40, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer', background: 'transparent' }}
              />
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontFamily: 'monospace' }}>
                {gridLineColor.toUpperCase()}
              </Typography>
            </Box>
            {/* Preset colors */}
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25, flexWrap: 'wrap' }}>
              {['#2a4a80', '#1a3a1a', '#4a1a1a', '#3a3a2a', '#2a2a3a', '#555555', '#ffffff'].map(c => (
                <Box
                  key={c} onClick={() => setGridLineColor(c)}
                  sx={{
                    width: 20, height: 20, borderRadius: 0.75, cursor: 'pointer',
                    bgcolor: c,
                    border: gridLineColor === c ? '2px solid #ffa726' : '1px solid rgba(255,255,255,0.2)',
                    transition: 'border-color 0.1s',
                    '&:hover': { transform: 'scale(1.15)' },
                  }}
                />
              ))}
            </Box>
          </Popover>
        </Box>

        {/* Room ghost toggle — only shown when 3DSL context is available */}
        {originContext?.baseGlbUrl && (
          <>
            <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 0.5 }} />
            <Tooltip title={showRoomGhost ? '部屋を非表示' : '部屋を表示（空間参照）'} arrow>
              <Box
                onClick={() => setShowRoomGhost(v => !v)}
                sx={{
                  px: 1, py: 0.3, borderRadius: 1, cursor: 'pointer',
                  border: `1px solid ${showRoomGhost ? 'rgba(100,181,246,0.45)' : 'rgba(255,255,255,0.12)'}`,
                  color: showRoomGhost ? 'rgba(100,181,246,0.9)' : 'rgba(255,255,255,0.35)',
                  fontSize: 10, fontWeight: 600, userSelect: 'none',
                  bgcolor: showRoomGhost ? 'rgba(100,181,246,0.06)' : 'transparent',
                  transition: 'all 0.15s',
                  '&:hover': { borderColor: 'rgba(100,181,246,0.6)', color: '#64b5f6' },
                }}
              >
                部屋表示
              </Box>
            </Tooltip>
          </>
        )}

        <Box sx={{ flex: 1 }} />

        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', mr: 0.5 }}>
          {components.length} パーツ
        </Typography>

        {/* 保存状態ラベル */}
        {saveStatus && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            <CheckRoundedIcon sx={{ fontSize: 11, color: saveStatus.color }} />
            <Typography variant="caption" sx={{ color: saveStatus.color, fontSize: 10, opacity: 0.85 }}>
              {saveStatus.text}
            </Typography>
          </Box>
        )}

        {/* テンプレートとして登録 */}
        <Tooltip title="コミュニティテンプレートとして登録" arrow>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<BookmarkAddRoundedIcon sx={{ fontSize: 13 }} />}
              onClick={handleOpenSaveTemplate}
              disabled={components.length === 0}
              sx={{
                borderColor: 'rgba(100,181,246,0.35)',
                color: 'rgba(100,181,246,0.8)',
                fontWeight: 500,
                fontSize: 11,
                px: 1.2,
                '&:hover': { borderColor: '#64b5f6', color: '#64b5f6', bgcolor: 'rgba(100,181,246,0.06)' },
                '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
              }}
            >
              テンプレ登録
            </Button>
          </span>
        </Tooltip>

        {/* GLB としてローカルに保存 */}
        <Tooltip title={`GLBとしてローカルに保存\n保存先: WorkFiles/3DSC/`} arrow>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={isGlbSaving
                ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                : <SaveAltRoundedIcon sx={{ fontSize: 13 }} />
              }
              onClick={handleSaveGlb}
              disabled={isGlbSaving || components.length === 0}
              sx={{
                borderColor: 'rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.55)',
                fontWeight: 500,
                fontSize: 11,
                px: 1.2,
                '&:hover': { borderColor: 'rgba(255,255,255,0.5)', color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' },
                '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
              }}
            >
              {isGlbSaving ? '...' : 'GLB保存'}
            </Button>
          </span>
        </Tooltip>

        {/* クラウド WorkFile 保存（ダッシュボード用）*/}
        <Button
          variant="outlined"
          size="small"
          startIcon={isSaving
            ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
            : <SaveRoundedIcon sx={{ fontSize: 13 }} />
          }
          onClick={handleSave}
          disabled={isSaving}
          sx={{
            borderColor: 'rgba(255,167,38,0.4)',
            color: '#ffa726',
            fontWeight: 600,
            fontSize: 11,
            px: 1.2,
            '&:hover': { borderColor: '#ffa726', bgcolor: 'rgba(255,167,38,0.08)' },
            '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
          }}
        >
          {isSaving ? '...' : '保存'}
        </Button>

        {/* 3DSS アップロードダイアログを開く */}
        <Tooltip title="S.Modelsライブラリに保存（アップロードダイアログを開く）" arrow>
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={isPreparingGlb
                ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                : <CloudUploadRoundedIcon sx={{ fontSize: 13 }} />
              }
              onClick={handleSaveTo3dss}
              disabled={isPreparingGlb || components.length === 0}
              sx={{
                borderColor: 'rgba(206,147,216,0.35)',
                color: 'rgba(206,147,216,0.8)',
                fontWeight: 500,
                fontSize: 11,
                px: 1.2,
                mr: 1,
                '&:hover': { borderColor: '#ce93d8', color: '#ce93d8', bgcolor: 'rgba(206,147,216,0.06)' },
                '&.Mui-disabled': { borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' },
              }}
            >
              {isPreparingGlb ? '生成中...' : 'S.Models'}
            </Button>
          </span>
        </Tooltip>

        {/* 3DSL に挿入して戻る */}
        <Button
          variant="contained"
          startIcon={isInserting
            ? <CircularProgress size={13} sx={{ color: '#000' }} />
            : <ViewInArIcon />
          }
          onClick={handleInsertAndReturn}
          disabled={components.length === 0 || isInserting}
          sx={{ bgcolor: '#ffa726', '&:hover': { bgcolor: '#fb8c00' }, color: '#000', fontWeight: 700, fontSize: 12,
            '&.Mui-disabled': { bgcolor: 'rgba(255,167,38,0.3)', color: 'rgba(0,0,0,0.4)' } }}
        >
          {isInserting ? '挿入中...' : 'S.Layoutに挿入して戻る'}
        </Button>
      </Box>

      {/* ── Main area: canvas + right panel ── */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderContent()}
          {/* フローティングドック: 3DSP の DspEditorDock / 3DSL の BottomDock 左セクション相当 */}
          <DscEditorDock />

          {/* ── 数値移動ダイアログ (ギズモ矢印ダブルクリック) ── */}
          {numericMove.open && (
            <Box
              sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                bgcolor: 'rgba(8,12,22,0.97)',
                border: '1px solid rgba(255,167,38,0.3)',
                borderRadius: 2, p: 2.5, zIndex: 50, minWidth: 280,
                boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
              }}
            >
              {/* タイトル */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ color: '#ffa726', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                  数値移動 (mm)
                  {numericMove.threeAxis && (
                    <Box component="span" sx={{ ml: 1, color: 'rgba(255,255,255,0.45)', fontWeight: 400 }}>
                      — {THREEJS_AXIS_UI_LABEL[numericMove.threeAxis]}
                    </Box>
                  )}
                </Typography>
                <IconButton size="small"
                  onClick={() => setNumericMove({ open: false, threeAxis: null, dx: '', dy: '', dz: '' })}
                  sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' }, p: 0.25 }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>
                </IconButton>
              </Box>

              {/* 3 軸入力 */}
              {([
                { label: 'X  左右', key: 'dx', auto: numericMove.threeAxis === 'x', color: '#ef9a9a' },
                { label: 'Y  前後', key: 'dy', auto: numericMove.threeAxis === 'z', color: '#90caf9' },
                { label: 'Z  上下', key: 'dz', auto: numericMove.threeAxis === 'y', color: '#a5d6a7' },
              ] as const).map(({ label, key, auto, color }) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography sx={{ color, fontSize: 10, fontWeight: 700, minWidth: 60 }}>{label}</Typography>
                  <TextField
                    autoFocus={auto}
                    type="number"
                    size="small"
                    placeholder="0"
                    value={numericMove[key]}
                    onChange={(e) => setNumericMove(s => ({ ...s, [key]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleApplyNumericMove(); }
                      if (e.key === 'Escape') setNumericMove({ open: false, threeAxis: null, dx: '', dy: '', dz: '' });
                    }}
                    inputProps={{ step: 10 }}
                    sx={{
                      flex: 1,
                      '& .MuiInputBase-input': { color: auto ? color : 'rgba(255,255,255,0.75)', fontSize: 12, p: '5px 8px' },
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: auto ? `${color}60` : 'rgba(255,255,255,0.1)' },
                      '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: color },
                    }}
                  />
                  <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, minWidth: 18 }}>mm</Typography>
                </Box>
              ))}

              {/* ボタン */}
              <Box sx={{ display: 'flex', gap: 1, mt: 1.75 }}>
                <Button
                  variant="contained" size="small" onClick={handleApplyNumericMove}
                  sx={{ flex: 1, bgcolor: '#ffa726', color: '#000', fontWeight: 700, '&:hover': { bgcolor: '#fb8c00' } }}
                >
                  移動
                </Button>
                <Button
                  variant="outlined" size="small"
                  onClick={() => setNumericMove({ open: false, threeAxis: null, dx: '', dy: '', dz: '' })}
                  sx={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.45)', '&:hover': { borderColor: 'rgba(255,255,255,0.4)', color: '#fff' } }}
                >
                  キャンセル
                </Button>
              </Box>
            </Box>
          )}

        </Box>
        <Box sx={{ width: showDscRightSidebar ? 240 : 0, overflow: 'hidden', flexShrink: 0, transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <Box sx={{ width: 240 }}>
            <RightPanel />
          </Box>
        </Box>
      </Box>

      {/* ── テンプレート登録ダイアログ ── */}
      <SaveTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        furnitureName={furnitureName}
        componentsJson={JSON.stringify(components)}
        thumbnailDataUrl={saveTemplateThumbnail}
        onSaved={(id) => {
          console.log('[DscStudio] テンプレートを登録しました id=', id);
        }}
      />

      {/* ── 3DSS アップロードダイアログ ── */}
      <Modal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }}
      >
        <Box>
          <UploadModalContent
            open={uploadModalOpen}
            onClose={() => setUploadModalOpen(false)}
            initialFiles={uploadFiles}
          />
        </Box>
      </Modal>
    </Box>
  );
}
