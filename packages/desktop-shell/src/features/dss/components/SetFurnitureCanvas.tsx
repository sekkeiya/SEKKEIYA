import React, { useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrthographicCamera, MapControls, OrbitControls, useGLTF, PivotControls, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useResolvedUrl } from '../../dsl/layout/hooks/useResolvedUrl';
import type { PlacedItem } from './SetFurnitureEditor';
import type { SetPlacementRule } from '../../dsl/layout/types/furnitureSet';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export function getGlbRaw(model: any): string {
  if (!model) return '';

  // 1) トップレベルの主要フィールド
  const top =
    model.glbUrl ??
    model.modelGlbUrl ??
    model.viewerGlbUrl ??
    model.glbStoragePath ??
    model.storageUrl ??        // AI生成アセット
    model.modelUrl ??          // autoLayoutService と共通
    model.files?.glb?.url ??
    model.files?.glb?.downloadUrl ??
    model.files?.glb?.downloadURL ??
    model.files?.glb?.storagePath ??
    model.files?.glb?.fullPath ??
    model.metadata?.glbUrl ??  // ネスト metadata
    model.metadata?.downloadUrl;

  if (top) return top;

  // 2) versions[latestVersion].glbUrl — バージョン管理アセット
  const lv = model.latestVersion;
  const latestVer = lv != null ? model.versions?.[lv] : undefined;
  const fromLatest = latestVer?.glbUrl ?? latestVer?.downloadUrl;
  if (fromLatest) return fromLatest;

  // 3) versions のいずれかから取れる場合
  const versions = model.versions;
  if (versions && typeof versions === 'object') {
    for (const ver of Object.values(versions)) {
      const v = ver as any;
      const url = v?.glbUrl ?? v?.downloadUrl;
      if (url) return url;
    }
  }

  // 4) 最終フォールバック: downloadUrl（GLB直接アップロードの場合はこれがGLB）
  return model.downloadUrl ?? '';
}

// ---------------------------------------------------------------------------
// Dimension overlay helpers
// ---------------------------------------------------------------------------

const DIM_ACCENT = '#a78bfa';
const DIM_GAP    = '#fbbf24';

function dimLabel(color: string, bg = 'rgba(8,11,18,0.88)'): React.CSSProperties {
  return {
    background: bg, color,
    font: '600 10px/1 ui-monospace, SFMono-Regular, monospace',
    padding: '2px 5px', borderRadius: 3,
    whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none',
    border: `1px solid color-mix(in srgb, ${color} 33%, transparent)`,
  };
}

interface GapResult {
  p1: [number, number, number];
  p2: [number, number, number];
  mid: [number, number, number];
  mm: number;
}

function computeGaps(a: PlacedItem, b: PlacedItem): GapResult[] {
  const ax1 = a.x - a.w / 2, ax2 = a.x + a.w / 2;
  const ay1 = a.y - a.d / 2, ay2 = a.y + a.d / 2;
  const bx1 = b.x - b.w / 2, bx2 = b.x + b.w / 2;
  const by1 = b.y - b.d / 2, by2 = b.y + b.d / 2;

  const results: GapResult[] = [];

  // X軸方向のギャップ（横並び）
  const overlapY = Math.min(ay2, by2) > Math.max(ay1, by1);
  if (overlapY) {
    const gapX = bx1 > ax2 ? bx1 - ax2 : ax1 > bx2 ? ax1 - bx2 : 0;
    if (gapX > 0 && gapX <= 5000) {
      const yc = (Math.max(ay1, by1) + Math.min(ay2, by2)) / 2;
      const p1x = bx1 > ax2 ? ax2 : ax1;
      const p2x = bx1 > ax2 ? bx1 : bx2;
      results.push({ p1: [p1x, yc, 2], p2: [p2x, yc, 2], mid: [(p1x + p2x) / 2, yc, 3], mm: Math.round(gapX) });
    }
  }

  // Y軸方向のギャップ（前後並び）
  const overlapX = Math.min(ax2, bx2) > Math.max(ax1, bx1);
  if (overlapX) {
    const gapY = by1 > ay2 ? by1 - ay2 : ay1 > by2 ? ay1 - by2 : 0;
    if (gapY > 0 && gapY <= 5000) {
      const xc = (Math.max(ax1, bx1) + Math.min(ax2, bx2)) / 2;
      const p1y = by1 > ay2 ? ay2 : ay1;
      const p2y = by1 > ay2 ? by1 : by2;
      results.push({ p1: [xc, p1y, 2], p2: [xc, p2y, 2], mid: [xc, (p1y + p2y) / 2, 3], mm: Math.round(gapY) });
    }
  }

  return results;
}

// SelectedItemLines — 選択アイテムの W/D 寸法線（紫）のみ
function SelectedItemLines({ item }: { item: PlacedItem }) {
  const θ = item.rotation * Math.PI / 180;
  const cθ = Math.cos(θ), sθ = Math.sin(θ);
  const hw = item.w / 2, hd = item.d / 2;
  const ext = 150;

  const wOff = hd + ext;
  const wP1: [number, number, number] = [item.x - hw * cθ + wOff * (-sθ), item.y - hw * sθ + wOff * cθ, 3];
  const wP2: [number, number, number] = [item.x + hw * cθ + wOff * (-sθ), item.y + hw * sθ + wOff * cθ, 3];
  const wMid: [number, number, number] = [(wP1[0] + wP2[0]) / 2, (wP1[1] + wP2[1]) / 2, 4];

  const dOff = hw + ext;
  const dP1: [number, number, number] = [item.x + dOff * cθ - hd * (-sθ), item.y + dOff * sθ - hd * cθ, 3];
  const dP2: [number, number, number] = [item.x + dOff * cθ + hd * (-sθ), item.y + dOff * sθ + hd * cθ, 3];
  const dMid: [number, number, number] = [(dP1[0] + dP2[0]) / 2, (dP1[1] + dP2[1]) / 2, 4];

  return (
    <>
      <Line points={[wP1, wP2]} color={DIM_ACCENT} lineWidth={1.5} depthTest={false} renderOrder={9998} />
      <Html position={wMid} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div style={dimLabel(DIM_ACCENT)}>W {item.w}</div>
      </Html>
      <Line points={[dP1, dP2]} color={DIM_ACCENT} lineWidth={1.5} depthTest={false} renderOrder={9998} />
      <Html position={dMid} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
        <div style={dimLabel(DIM_ACCENT)}>D {item.d}</div>
      </Html>
    </>
  );
}

// AllGapMeasurements — 全アイテムペア間のギャップ（黄色）を常時表示
function AllGapMeasurements({ items }: { items: PlacedItem[] }) {
  const gaps = useMemo(() => {
    const results: Array<GapResult & { key: string }> = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        computeGaps(items[i], items[j]).forEach((g, k) =>
          results.push({ ...g, key: `${i}-${j}-${k}` }),
        );
      }
    }
    return results;
  }, [items]); // eslint-disable-line

  return (
    <>
      {gaps.map(g => (
        <React.Fragment key={g.key}>
          <Line
            points={[g.p1, g.p2]} color={DIM_GAP} lineWidth={1.2}
            dashed dashSize={80} gapSize={50}
            depthTest={false} renderOrder={9997}
          />
          <Html position={g.mid} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <div style={dimLabel(DIM_GAP, 'rgba(14,11,3,0.9)')}>{g.mm}</div>
          </Html>
        </React.Fragment>
      ))}
    </>
  );
}

// DimensionOverlay — TOP ビューに重ねる全体寸法レイヤー
function DimensionOverlay({
  placedItems,
  selectedId,
  livePosRef,
}: {
  placedItems: PlacedItem[];
  selectedId: string | null;
  livePosRef: React.MutableRefObject<{ x: number; y: number } | null>;
}) {
  // ドラッグ中の live 位置を state にコピー（位置が変化したときだけ更新）
  const [liveXY, setLiveXY] = useState<{ x: number; y: number } | null>(null);
  const prevXYRef = useRef<{ x: number; y: number } | null>(null);

  useFrame(() => {
    const lp = livePosRef.current;
    const prev = prevXYRef.current;
    if (!lp) {
      if (prev !== null) { prevXYRef.current = null; setLiveXY(null); }
      return;
    }
    if (prev && Math.abs(prev.x - lp.x) < 0.5 && Math.abs(prev.y - lp.y) < 0.5) return;
    prevXYRef.current = { x: lp.x, y: lp.y };
    setLiveXY({ x: lp.x, y: lp.y });
  });

  // ドラッグ中は選択アイテムの位置をオーバーライド
  const effectiveItems = useMemo(() => {
    if (!liveXY || !selectedId) return placedItems;
    return placedItems.map(item =>
      item.instanceId === selectedId ? { ...item, x: liveXY.x, y: liveXY.y } : item,
    );
  }, [placedItems, selectedId, liveXY]);

  const selectedItem = useMemo(
    () => effectiveItems.find(i => i.instanceId === selectedId) ?? null,
    [effectiveItems, selectedId],
  );

  return (
    <group>
      {/* W×D ラベル（全アイテム常時、ドラッグ中は live 位置） */}
      {effectiveItems.map(item => {
        const isSelected = item.instanceId === selectedId;
        return (
          <Html key={`wdlabel-${item.instanceId}`}
            position={[item.x, item.y, 1]} center
            zIndexRange={[90, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div style={{
              background: isSelected ? 'rgba(167,139,250,0.92)' : 'rgba(8,11,18,0.72)',
              color: isSelected ? '#000' : DIM_ACCENT,
              font: '600 10px/1 ui-monospace, monospace',
              padding: '2px 5px', borderRadius: 3, whiteSpace: 'nowrap',
              border: isSelected ? 'none' : '1px solid rgba(167,139,250,0.3)',
            }}>
              {item.w}×{item.d}
            </div>
          </Html>
        );
      })}

      {/* 全ペアのギャップ（黄色、常時・ドラッグ中もリアルタイム） */}
      <AllGapMeasurements items={effectiveItems} />

      {/* 選択アイテムの W/D 寸法線（紫）のみ選択時に表示 */}
      {selectedItem && <SelectedItemLines item={selectedItem} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// FallbackBox
// ---------------------------------------------------------------------------
function FallbackBox({ w = 600, d = 600, selected = false }: { w?: number; d?: number; selected?: boolean }) {
  const h = Math.max(200, Math.min(w, d) * 0.5);
  return (
    <mesh position={[0, h / 2, 0]}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={selected ? '#a78bfa' : '#374151'} transparent opacity={0.6} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// GlbModel — auto-scale + bottom-center origin
// ---------------------------------------------------------------------------
function GlbModel({ url, dimensionsMm }: { url: string; dimensionsMm: any }) {
  const { scene } = useGLTF(url);

  const { cloned, ox, oy, oz, autoScale } = useMemo(() => {
    const c = scene.clone();
    const box = new THREE.Box3().setFromObject(c);
    if (box.isEmpty()) return { cloned: c, ox: 0, oy: 0, oz: 0, autoScale: 1 };
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const tw = dimensionsMm ? (Number(dimensionsMm.width ?? dimensionsMm.x) || 0) : 0;
    let scale = 1;
    if (tw > 0 && size.x > 0) scale = tw / size.x;
    else if (size.x > 0 && size.x < 50) scale = 600 / size.x;
    return { cloned: c, ox: -center.x, oy: -box.min.y, oz: -center.z, autoScale: scale };
  }, [scene, dimensionsMm]);

  return (
    <group scale={autoScale}>
      <group position={[ox, oy, oz]}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// ItemContent — URL resolution + GLB or fallback
// ---------------------------------------------------------------------------
function ItemContent({ modelData, w, d, selected }: { modelData: any; w: number; d: number; selected: boolean }) {
  const raw = useMemo(() => (modelData ? getGlbRaw(modelData) : ''), [modelData]);
  const url = useResolvedUrl(raw);
  const dims = modelData?.dimensionsMm ?? modelData?.dimensions ?? null;

  return url ? (
    <Suspense fallback={<FallbackBox w={w} d={d} selected={selected} />}>
      <GlbModel url={url} dimensionsMm={dims} />
    </Suspense>
  ) : (
    <FallbackBox w={w} d={d} selected={selected} />
  );
}

// ---------------------------------------------------------------------------
// PlacedItemContent — model (selection is indicated by PivotControls gizmo)
// ---------------------------------------------------------------------------
function PlacedItemContent({
  item, modelData, selected,
}: { item: PlacedItem; modelData: any; selected: boolean }) {
  return <ItemContent modelData={modelData} w={item.w} d={item.d} selected={selected} />;
}

// ---------------------------------------------------------------------------
// PlacedItemMesh — non-selected items (top view, Z-up)
// ---------------------------------------------------------------------------
interface PlacedItemMeshProps {
  item: PlacedItem;
  modelData: any;
  selected?: boolean;
  onItemPointerDown: (e: any, item: PlacedItem) => void;
  onItemClick: (id: string, shiftKey: boolean) => void;
}

function PlacedItemMeshInner({ item, modelData, selected = false, onItemPointerDown, onItemClick }: PlacedItemMeshProps) {
  return (
    <group
      position={[item.x, item.y, 0]}
      rotation={[0, 0, item.rotation * (Math.PI / 180)]}
      onPointerDown={(e) => onItemPointerDown(e, item)}
      onClick={(e) => { e.stopPropagation(); onItemClick(item.instanceId, e.nativeEvent?.shiftKey ?? false); }}
    >
      {/* Upright Y-up GLTF model into Z-up world (same as 3D view) */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <PlacedItemContent item={item} modelData={modelData} selected={selected} />
      </group>
    </group>
  );
}
const PlacedItemMesh = React.memo(PlacedItemMeshInner);

// ---------------------------------------------------------------------------
// SceneContents — top-down orthographic view
// ---------------------------------------------------------------------------
export interface SetFurnitureCanvasProps {
  placedItems: PlacedItem[];
  availableModels: any[];
  /** 複数選択に対応。最後の要素がギズモ対象 */
  selectedIds: string[];
  pendingModel: any | null;
  onPlaceAt: (x: number, z: number) => void;
  /** addToSelection=true のとき Shift+Click（トグル選択） */
  onSelect: (id: string | null, addToSelection?: boolean) => void;
  onMoveItem: (id: string, x: number, z: number) => void;
  onRotateItem: (id: string, rotDeg: number) => void;
  showDimensions?: boolean;
  /** Alignインタラクティブモード: 'AT'|'AB'|'AL'|'AR'|'AH'|'AV' または null */
  alignActiveKey?: string | null;
  /** マウス移動時に alignKey・world座標を通知（key をパラメータ渡しで stale closure 回避） */
  onAlignMove?: (key: string, worldX: number, worldY: number) => void;
  /** クリックで確定 */
  onAlignConfirm?: () => void;
  /** セット配置ルール（正面方向の矢印・前方クリアランス帯を可視化） */
  placementRule?: SetPlacementRule | null;
}

type DragState = {
  instanceId: string;
  startX: number;
  startZ: number;
  px0: number;
  pz0: number;
};

function SceneContents({
  placedItems, availableModels, selectedIds, pendingModel,
  onPlaceAt, onSelect, onMoveItem, onRotateItem,
  showDimensions = true,
  alignActiveKey = null,
  onAlignMove,
  onAlignConfirm,
  placementRule = null,
}: SetFurnitureCanvasProps) {
  // 最後に選択されたID（ギズモ用）
  const selectedId = selectedIds[selectedIds.length - 1] ?? null;

  // Alignモード中のマウス位置（ガイドライン描画用）
  const [alignGuidePos, setAlignGuidePos] = useState<{ x: number; y: number } | null>(null);
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const [ghostPos, setGhostPos] = useState<[number, number, number] | null>(null);

  const pendingRef = useRef(pendingModel);
  const onMoveRef = useRef(onMoveItem);
  const onPlaceRef = useRef(onPlaceAt);
  const onSelectRef = useRef(onSelect);
  const onRotateRef = useRef(onRotateItem);
  const onAlignMoveRef = useRef(onAlignMove);
  const onAlignConfirmRef = useRef(onAlignConfirm);
  useEffect(() => { pendingRef.current = pendingModel; }, [pendingModel]);
  useEffect(() => { onMoveRef.current = onMoveItem; }, [onMoveItem]);
  useEffect(() => { onPlaceRef.current = onPlaceAt; }, [onPlaceAt]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onRotateRef.current = onRotateItem; }, [onRotateItem]);
  useEffect(() => { onAlignMoveRef.current = onAlignMove; }, [onAlignMove]);
  useEffect(() => { onAlignConfirmRef.current = onAlignConfirm; }, [onAlignConfirm]);

  // Alignモード: カーソルをcrosshairに変更
  useEffect(() => {
    const el = gl.domElement;
    if (alignActiveKey) {
      el.style.cursor = 'crosshair';
      setAlignGuidePos(null);
    } else {
      el.style.cursor = '';
      setAlignGuidePos(null);
    }
    return () => { el.style.cursor = ''; };
  }, [alignActiveKey, gl.domElement]);

  // Configure top-view mouse buttons:
  // RIGHT = PAN (3DSL convention), LEFT disabled (item drag handles it manually)
  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.mouseButtons.LEFT = -1;   // don't steal left clicks from item handlers
    controlsRef.current.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controlsRef.current.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  });

  const dragRef = useRef<DragState | null>(null);

  useEffect(() => { if (!pendingModel) setGhostPos(null); }, [pendingModel]);

  const modelsById = useMemo(() => {
    const m = new Map<string, any>();
    availableModels.forEach(a => m.set(a.id, a));
    return m;
  }, [availableModels]);

  const selectedItem = useMemo(() =>
    placedItems.find(i => i.instanceId === selectedId) ?? null,
    [placedItems, selectedId],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gizmoInitMatrix = useMemo(() => {
    if (!selectedItem) return new THREE.Matrix4();
    // Z-up: rotate around Z axis
    const itemQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      selectedItem.rotation * (Math.PI / 180),
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(selectedItem.x, selectedItem.y, 0),
      itemQuat,
      new THREE.Vector3(1, 1, 1),
    );
  }, [selectedId]);

  const gizmoWorldMatRef = useRef(new THREE.Matrix4());

  // Z-up: intersect XY plane (Z=0)
  const getWorldXZ = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hit = new THREE.Vector3();
    rc.ray.intersectPlane(xyPlane, hit);
    return { x: hit.x, z: hit.y }; // "z" field = item.y (depth axis)
  }, [camera, gl]);

  // Alignモードのポインター移動
  const alignActivKeyRef = useRef(alignActiveKey);
  useEffect(() => { alignActivKeyRef.current = alignActiveKey; }, [alignActiveKey]);

  useEffect(() => {
    const onAlignPointerMove = (e: PointerEvent) => {
      if (!alignActivKeyRef.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top  && e.clientY <= rect.bottom;
      if (!inCanvas) return;
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      rc.ray.intersectPlane(xyPlane, hit);
      setAlignGuidePos({ x: hit.x, y: hit.y });
      // key をパラメータで渡すことで親側の stale closure 問題を回避
      onAlignMoveRef.current?.(alignActivKeyRef.current, hit.x, hit.y);
    };
    window.addEventListener('pointermove', onAlignPointerMove);
    return () => window.removeEventListener('pointermove', onAlignPointerMove);
  }, [camera, gl]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const pm = pendingRef.current;
      const drag = dragRef.current;
      if (!pm && !drag) return;

      const rect = gl.domElement.getBoundingClientRect();
      const inCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;

      if (!inCanvas) {
        if (pm && !drag) setGhostPos(null);
        return;
      }

      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const xyPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const hit = new THREE.Vector3();
      rc.ray.intersectPlane(xyPlane, hit);

      if (drag) {
        onMoveRef.current(
          drag.instanceId,
          drag.startX + (hit.x - drag.px0),
          drag.startZ + (hit.y - drag.pz0),
        );
      } else if (pm) {
        setGhostPos([hit.x, hit.y, 0]);
      }
    };

    const onUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        if (controlsRef.current) controlsRef.current.enabled = true;
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [camera, gl]);

  // Ctrl+Scroll → orthographic zoom (prevent browser page-zoom)
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const ortho = camera as THREE.OrthographicCamera;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      ortho.zoom = Math.max(0.005, Math.min(2, ortho.zoom * factor));
      ortho.updateProjectionMatrix();
      controlsRef.current?.update();
    };
    gl.domElement.addEventListener('wheel', onWheel, { passive: false });
    return () => gl.domElement.removeEventListener('wheel', onWheel);
  }, [camera, gl]);

  // Ctrl+RMB drag → orthographic zoom (drag up = zoom in, drag down = zoom out)
  useEffect(() => {
    const el = gl.domElement;
    const ortho = camera as THREE.OrthographicCamera;
    const dolly = { active: false, lastY: 0, pointerId: null as number | null };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 2 || !e.ctrlKey) return;
      e.stopPropagation();
      e.preventDefault();
      dolly.active = true;
      dolly.lastY = e.clientY;
      dolly.pointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (controlsRef.current) controlsRef.current.enabled = false;
    };

    const onMove = (e: PointerEvent) => {
      if (!dolly.active) return;
      const dy = e.clientY - dolly.lastY;
      dolly.lastY = e.clientY;
      // drag up (dy < 0) = zoom in, drag down (dy > 0) = zoom out
      ortho.zoom = Math.max(0.005, Math.min(2, ortho.zoom * Math.pow(0.995, dy)));
      ortho.updateProjectionMatrix();
      controlsRef.current?.update();
    };

    const onUp = (e: PointerEvent) => {
      if (!dolly.active || e.button !== 2) return;
      dolly.active = false;
      if (dolly.pointerId != null) {
        try { el.releasePointerCapture(dolly.pointerId); } catch { /* ignore */ }
        dolly.pointerId = null;
      }
      if (controlsRef.current) controlsRef.current.enabled = true;
    };

    const onContextMenu = (e: Event) => { if (dolly.active) e.preventDefault(); };

    el.addEventListener('pointerdown',   onDown,       { capture: true, passive: false });
    el.addEventListener('pointermove',   onMove,       { passive: true });
    el.addEventListener('pointerup',     onUp);
    el.addEventListener('contextmenu',   onContextMenu, { passive: false });
    window.addEventListener('pointerup', onUp, { passive: true });

    return () => {
      el.removeEventListener('pointerdown',   onDown, { capture: true } as any);
      el.removeEventListener('pointermove',   onMove);
      el.removeEventListener('pointerup',     onUp);
      el.removeEventListener('contextmenu',   onContextMenu);
      window.removeEventListener('pointerup', onUp);
    };
  }, [camera, gl]);

  const handleItemPointerDown = useCallback((e: any, item: PlacedItem) => {
    if (e.button !== 0) return;
    // Alignモード中はドラッグしない（クリック確定に使う）
    if (alignActivKeyRef.current) return;
    e.stopPropagation();
    const cx = e.nativeEvent?.clientX ?? e.clientX;
    const cy = e.nativeEvent?.clientY ?? e.clientY;
    const { x, z } = getWorldXZ(cx, cy);
    dragRef.current = { instanceId: item.instanceId, startX: item.x, startZ: item.y, px0: x, pz0: z };
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [getWorldXZ]);

  const handleItemClick = useCallback((id: string, shiftKey: boolean) => {
    // Alignモード中はクリックで確定
    if (alignActivKeyRef.current) {
      onAlignConfirmRef.current?.();
      return;
    }
    onSelectRef.current(id, shiftKey);
  }, []);

  const handleFloorClick = useCallback((e: any) => {
    // Alignモード中はクリックで確定
    if (alignActivKeyRef.current) {
      onAlignConfirmRef.current?.();
      return;
    }
    if (pendingRef.current) {
      onPlaceRef.current(e.point.x, e.point.y);
    } else {
      onSelectRef.current(null);
    }
  }, []);

  // ドラッグ中の live 位置（DimensionOverlay のリアルタイム更新用）
  const livePosRef = useRef<{ x: number; y: number } | null>(null);

  const handleGizmoDragStart = useCallback(() => {
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, []);

  const handleGizmoDrag = useCallback((
    _l: THREE.Matrix4,
    _dl: THREE.Matrix4,
    w: THREE.Matrix4,
  ) => {
    gizmoWorldMatRef.current.copy(w);
    // matrix4 の col-major layout: elements[12]=tx, elements[13]=ty
    if (!livePosRef.current) livePosRef.current = { x: 0, y: 0 };
    livePosRef.current.x = w.elements[12];
    livePosRef.current.y = w.elements[13];
  }, []);

  const handleGizmoDragEnd = useCallback(() => {
    livePosRef.current = null;
    if (!selectedId) return;
    const pos = new THREE.Vector3();
    const gizmoQuat = new THREE.Quaternion();
    gizmoWorldMatRef.current.decompose(pos, gizmoQuat, new THREE.Vector3());
    // Z-up: decompose Z-rotation
    const euler = new THREE.Euler().setFromQuaternion(gizmoQuat, 'ZXY');
    onMoveRef.current(selectedId, pos.x, pos.y); // depth = world Y
    onRotateRef.current(selectedId, THREE.MathUtils.radToDeg(euler.z));
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, [selectedId]);

  const ghostDims = pendingModel?.dimensions ?? pendingModel?.dimensionsMm ?? {};
  const ghostW = Math.max(100, Number(ghostDims.x ?? ghostDims.width ?? 800));
  const ghostD = Math.max(100, Number(ghostDims.y ?? ghostDims.depth ?? ghostDims.z ?? 600));
  const ghostH = Math.max(100, Math.min(ghostW, ghostD) * 0.7);

  return (
    <>
      {/* Z-up: camera looks down from +Z, up=[0,1,0] */}
      <OrthographicCamera
        makeDefault
        position={[0, 0, 20000]}
        up={[0, 1, 0]}
        zoom={0.1}
        near={0.1}
        far={200000}
      />
      <MapControls
        ref={controlsRef}
        enableRotate={false}
        screenSpacePanning={true}
        minZoom={0.005}
        maxZoom={2}
      />

      <ambientLight intensity={2.2} />
      <directionalLight position={[5000, 5000, 15000]} intensity={1.5} />
      {/* Grid on XY plane (Z=0) — rotate default XZ grid 90° around X */}
      <gridHelper args={[50000, 50, '#2a3044', '#1e2538']} rotation={[Math.PI / 2, 0, 0]} />

      {/* Invisible floor at Z=0 (XY plane, no rotation needed for default plane) */}
      <mesh position={[0, 0, -0.5]} onClick={handleFloorClick}>
        <planeGeometry args={[200000, 200000]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {pendingModel && ghostPos && (
        <group position={ghostPos}>
          {/* Ghost box: height along Z in Z-up world */}
          <mesh position={[0, 0, ghostH / 2]}>
            <boxGeometry args={[ghostW, ghostD, ghostH]} />
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, ghostH / 2]}>
            <boxGeometry args={[ghostW * 1.005, ghostD * 1.005, ghostH * 1.005]} />
            <meshBasicMaterial color="#c4b5fd" wireframe />
          </mesh>
        </group>
      )}

      {/* Alignガイドライン（crosshairに対応した基準線） */}
      {alignActiveKey && alignGuidePos && (() => {
        const isHorizontal = ['AT', 'AB', 'AV'].includes(alignActiveKey);
        const isVertical   = ['AL', 'AR', 'AH'].includes(alignActiveKey);
        const HALF = 25000;
        const COLOR = '#a78bfa';
        return (
          <>
            {isHorizontal && (
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    array={new Float32Array([-HALF, alignGuidePos.y, 1, HALF, alignGuidePos.y, 1])}
                    count={2} itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={COLOR} transparent opacity={0.6} depthTest={false} />
              </line>
            )}
            {isVertical && (
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    array={new Float32Array([alignGuidePos.x, -HALF, 1, alignGuidePos.x, HALF, 1])}
                    count={2} itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={COLOR} transparent opacity={0.6} depthTest={false} />
              </line>
            )}
          </>
        );
      })()}

      {/* Alignモード中: 全アイテムを通常メッシュで描画（PivotControls は位置が固定されるためスキップ） */}
      {alignActiveKey && placedItems.map(item => (
        <PlacedItemMesh
          key={item.instanceId}
          item={item}
          modelData={modelsById.get(item.assetId)}
          selected={selectedIds.includes(item.instanceId)}
          onItemPointerDown={handleItemPointerDown}
          onItemClick={handleItemClick}
        />
      ))}

      {/* 通常モード: selectedId 以外を通常メッシュ、selectedId は PivotControls（ギズモ）で描画 */}
      {!alignActiveKey && (
        <>
          {placedItems
            .filter(item => item.instanceId !== selectedId)
            .map(item => (
              <PlacedItemMesh
                key={item.instanceId}
                item={item}
                modelData={modelsById.get(item.assetId)}
                selected={selectedIds.includes(item.instanceId)}
                onItemPointerDown={handleItemPointerDown}
                onItemClick={handleItemClick}
              />
            ))}

          {selectedItem && (
            <PivotControls
              key={selectedId!}
              matrix={gizmoInitMatrix}
              autoTransform={true}
              scale={80}
              fixed={true}
              depthTest={false}
              activeAxes={[true, true, false]}
              disableScaling={true}
              annotations={false}
              lineWidth={2.5}
              onDragStart={handleGizmoDragStart}
              onDrag={handleGizmoDrag as any}
              onDragEnd={handleGizmoDragEnd}
            >
              <group onClick={(e) => e.stopPropagation()}>
                <group rotation={[Math.PI / 2, 0, 0]}>
                  <PlacedItemContent
                    item={selectedItem}
                    modelData={modelsById.get(selectedItem.assetId)}
                    selected={true}
                  />
                </group>
              </group>
            </PivotControls>
          )}
        </>
      )}

      {/* 寸法オーバーレイ: W×Dラベル + 選択時の寸法線・ギャップ表示 */}
      {showDimensions && (
        <DimensionOverlay
          placedItems={placedItems}
          selectedId={selectedId}
          livePosRef={livePosRef}
        />
      )}

      {/* セット配置ルール: 正面矢印 + 前方クリアランス帯 */}
      {placementRule && placedItems.length > 0 && (
        <PlacementRuleOverlay placedItems={placedItems} rule={placementRule} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PlacementRuleOverlay — セット正面方向の矢印と前方クリアランス帯を TOP ビューに描画
// frontDirectionDeg: 0=下(-Y/手前) / 90=右(+X) / 180=上(+Y/奥) / 270=左(-X)
// 方向ベクトル = (sinθ, -cosθ)
// ---------------------------------------------------------------------------
function PlacementRuleOverlay({ placedItems, rule }: { placedItems: PlacedItem[]; rule: SetPlacementRule }) {
  const geo = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const i of placedItems) {
      minX = Math.min(minX, i.x - i.w / 2);
      maxX = Math.max(maxX, i.x + i.w / 2);
      minY = Math.min(minY, i.y - i.d / 2);
      maxY = Math.max(maxY, i.y + i.d / 2);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rad = ((rule.frontDirectionDeg ?? 0) * Math.PI) / 180;
    const dirX = Math.sin(rad);
    const dirY = -Math.cos(rad);
    const alongY = Math.abs(dirY) > 0.5;
    const halfExtent = alongY ? (maxY - minY) / 2 : (maxX - minX) / 2;
    const clear = Math.max(0, rule.frontClearanceMm ?? 0);
    return { cx, cy, dirX, dirY, alongY, halfExtent, clear, bw: maxX - minX, bh: maxY - minY, rad };
  }, [placedItems, rule.frontDirectionDeg, rule.frontClearanceMm]);

  const { cx, cy, dirX, dirY, alongY, halfExtent, clear, bw, bh, rad } = geo;
  const Z = 3; // 床グリッドの上、家具メッシュと干渉しない高さ
  const COLOR = '#38bdf8';

  // クリアランス帯（正面エッジの外側に clear mm の帯）
  const bandCx = cx + dirX * (halfExtent + clear / 2);
  const bandCy = cy + dirY * (halfExtent + clear / 2);
  const bandW = alongY ? bw : clear;
  const bandH = alongY ? clear : bh;

  // 正面矢印（セット中心 → 正面エッジの先）
  const tipDist = halfExtent + Math.max(clear * 0.6, 300);
  const tipX = cx + dirX * tipDist;
  const tipY = cy + dirY * tipDist;
  const CONE_H = 240;

  return (
    <group>
      {clear > 0 && (
        <>
          <mesh position={[bandCx, bandCy, Z]}>
            <planeGeometry args={[bandW, bandH]} />
            <meshBasicMaterial color={COLOR} transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <Line
            points={[
              [bandCx - bandW / 2, bandCy - bandH / 2, Z],
              [bandCx + bandW / 2, bandCy - bandH / 2, Z],
              [bandCx + bandW / 2, bandCy + bandH / 2, Z],
              [bandCx - bandW / 2, bandCy + bandH / 2, Z],
              [bandCx - bandW / 2, bandCy - bandH / 2, Z],
            ]}
            color={COLOR}
            lineWidth={1}
            dashed
            dashSize={120}
            gapSize={80}
            transparent
            opacity={0.5}
          />
        </>
      )}
      <Line
        points={[[cx, cy, Z], [tipX, tipY, Z]]}
        color={COLOR}
        lineWidth={2.5}
        transparent
        opacity={0.85}
      />
      {/* cone は +Y 軸向きがデフォルト。Z回転 π+rad で (sinθ, -cosθ) 方向へ */}
      <mesh
        position={[tipX - dirX * (CONE_H / 2), tipY - dirY * (CONE_H / 2), Z]}
        rotation={[0, 0, Math.PI + rad]}
      >
        <coneGeometry args={[90, CONE_H, 12]} />
        <meshBasicMaterial color={COLOR} transparent opacity={0.9} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// SetFurnitureCanvas — top-down orthographic view
// ---------------------------------------------------------------------------
export function SetFurnitureCanvas(props: SetFurnitureCanvasProps) {
  return (
    <Canvas
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <SceneContents {...props} />
    </Canvas>
  );
}

// ===========================================================================
// 3D perspective view
// ===========================================================================

export interface SetFurnitureCanvas3DProps {
  placedItems: PlacedItem[];
  availableModels: any[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMoveItem?: (id: string, x: number, depth: number, elevation?: number) => void;
  onRotateItem?: (id: string, rotDeg: number) => void;
}

// ---------------------------------------------------------------------------
// flyToPosition — smooth camera animation (400 ms cubic ease-out)
// ---------------------------------------------------------------------------
function flyToPosition(camera: THREE.Camera, orbit: any, newPos: THREE.Vector3, duration = 400) {
  const startPos = camera.position.clone();
  const t0 = performance.now();
  const tick = () => {
    const t = Math.min((performance.now() - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, newPos, ease);
    orbit.update();
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


// ---------------------------------------------------------------------------
// Controls3DInner — Orbit camera controls (Z-up world)
//
//   RMB drag   → orbit around target (center-based rotation)
//   Scroll     → dolly zoom
//   AT/AR/AB/AL → 2-key camera preset angles (A → T/R/B/L within 650 ms)
// ---------------------------------------------------------------------------
function Controls3DInner({ orbitRef }: { orbitRef: React.RefObject<any> }) {
  const { camera, gl } = useThree();
  const cam = camera as THREE.PerspectiveCamera;

  useEffect(() => {
    const el = gl.domElement;

    // Configure OrbitControls:
    //   LMB = disabled, MIDDLE = dolly, RMB = orbit around target
    if (orbitRef.current) {
      orbitRef.current.enableDamping = false;
      orbitRef.current.dampingFactor = 0;
      (orbitRef.current.mouseButtons as any).LEFT   = -1;
      (orbitRef.current.mouseButtons as any).MIDDLE = THREE.MOUSE.DOLLY;
      (orbitRef.current.mouseButtons as any).RIGHT  = THREE.MOUSE.ROTATE;
    }

    const onContextMenu = (e: Event) => e.preventDefault();

    // AT/AR/AB/AL preset shortcuts
    let canvasHovered = false;
    const onEnter = () => { canvasHovered = true; };
    const onLeave = () => { canvasHovered = false; };
    let waitSecond = false;
    let shortcutTimer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (!canvasHovered) return;

      if (e.code === 'KeyA' && !waitSecond) {
        waitSecond = true;
        if (shortcutTimer) clearTimeout(shortcutTimer);
        shortcutTimer = setTimeout(() => { waitSecond = false; }, 650);
        return;
      }

      if (waitSecond) {
        waitSecond = false;
        if (shortcutTimer) { clearTimeout(shortcutTimer); shortcutTimer = null; }
        const oc = orbitRef.current;
        if (!oc) return;
        const target = oc.target.clone() as THREE.Vector3;
        const radius = cam.position.distanceTo(target);
        const h = radius * 0.55;
        const r = radius * 0.83;
        let newPos: THREE.Vector3 | null = null;
        switch (e.code) {
          case 'KeyT': newPos = new THREE.Vector3(target.x, target.y - 0.01, target.z + radius); break;
          case 'KeyR': newPos = new THREE.Vector3(target.x + r, target.y,       target.z + h);   break;
          case 'KeyB': newPos = new THREE.Vector3(target.x,     target.y - r,   target.z + h);   break;
          case 'KeyL': newPos = new THREE.Vector3(target.x - r, target.y,       target.z + h);   break;
        }
        if (newPos) flyToPosition(cam, oc, newPos);
      }
    };

    // Ctrl+Scroll → perspective dolly (prevent browser page-zoom)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const oc = orbitRef.current;
      if (!oc) return;
      const factor = e.deltaY > 0 ? 1.1 : 0.9; // scroll down = zoom out
      const toCam = new THREE.Vector3().subVectors(cam.position, oc.target);
      const dist = toCam.length();
      const newDist = Math.max(500, Math.min(200000, dist * factor));
      cam.position.copy(oc.target).addScaledVector(toCam.normalize(), newDist);
      oc.update();
    };

    // Ctrl+RMB drag: dolly (intercept via capture phase before OrbitControls)
    const dolly = { active: false, lastY: 0, pointerId: null as number | null };

    const onCtrlRmbDown = (e: PointerEvent) => {
      if (e.button !== 2 || !e.ctrlKey) return;
      e.stopPropagation();
      e.preventDefault();
      dolly.active = true;
      dolly.lastY = e.clientY;
      dolly.pointerId = e.pointerId;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      if (orbitRef.current) orbitRef.current.enabled = false;
    };

    const onCtrlRmbMove = (e: PointerEvent) => {
      if (!dolly.active) return;
      const dy = e.clientY - dolly.lastY;
      dolly.lastY = e.clientY;
      const oc = orbitRef.current;
      if (!oc) return;
      const toCam = new THREE.Vector3().subVectors(cam.position, oc.target);
      let dist = toCam.length();
      dist = Math.max(500, Math.min(200000, dist * Math.pow(0.995, -dy)));
      if (toCam.lengthSq() > 1e-5) {
        cam.position.copy(oc.target).addScaledVector(toCam.normalize(), dist);
        oc.update();
      }
    };

    const onCtrlRmbUp = (e: PointerEvent) => {
      if (!dolly.active || e.button !== 2) return;
      dolly.active = false;
      if (dolly.pointerId != null) {
        try { el.releasePointerCapture(dolly.pointerId); } catch { /* ignore */ }
        dolly.pointerId = null;
      }
      if (orbitRef.current) orbitRef.current.enabled = true;
    };

    el.addEventListener('contextmenu', onContextMenu,  { passive: false });
    el.addEventListener('pointerdown', onCtrlRmbDown,  { capture: true, passive: false });
    el.addEventListener('pointermove', onCtrlRmbMove,  { passive: true });
    el.addEventListener('pointerup',   onCtrlRmbUp);
    el.addEventListener('mouseenter',  onEnter);
    el.addEventListener('mouseleave',  onLeave);
    el.addEventListener('wheel',       onWheel, { passive: false });
    window.addEventListener('pointerup', onCtrlRmbUp, { passive: true });
    window.addEventListener('keydown', onKeyDown, { passive: false });

    return () => {
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('pointerdown', onCtrlRmbDown, { capture: true } as any);
      el.removeEventListener('pointermove', onCtrlRmbMove);
      el.removeEventListener('pointerup',   onCtrlRmbUp);
      el.removeEventListener('mouseenter',  onEnter);
      el.removeEventListener('mouseleave',  onLeave);
      el.removeEventListener('wheel',       onWheel);
      window.removeEventListener('pointerup', onCtrlRmbUp);
      window.removeEventListener('keydown', onKeyDown);
      if (orbitRef.current) orbitRef.current.enabled = true;
    };
  }, [camera, gl, orbitRef]);

  return null;
}

// ---------------------------------------------------------------------------
// Scene3DCameraSetup — auto-fits camera to placed items on first load
// ---------------------------------------------------------------------------
// Z-up: items are at (x, y, 0); camera looks from above (+Z) and front (-Y)
function Scene3DCameraSetup({ placedItems, orbitRef }: { placedItems: PlacedItem[]; orbitRef: React.RefObject<any> }) {
  const { camera } = useThree();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || placedItems.length === 0) return;
    done.current = true;

    const cx = placedItems.reduce((s, i) => s + i.x, 0) / placedItems.length;
    const cy = placedItems.reduce((s, i) => s + i.y, 0) / placedItems.length; // item.y = depth
    const maxR = placedItems.reduce((r, i) =>
      Math.max(r, Math.hypot(i.x - cx, i.y - cy) + Math.max(i.w, i.d) * 0.5), 500);
    const dist = Math.max(3000, maxR * 2.5);

    // Approach from -Y (front) and +Z (above) — Z-up convention
    camera.position.set(cx, cy - dist, dist * 0.7);
    camera.lookAt(cx, cy, 0);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix?.();

    if (orbitRef.current) {
      orbitRef.current.target.set(cx, cy, 0);
      orbitRef.current.update();
    }
  }, [camera, orbitRef, placedItems]);

  return null;
}

// ---------------------------------------------------------------------------
// PlacedItem3D — item in perspective view
//   LMB click  → select
//   RMB down   → On Object (set orbit pivot to item center)
// ---------------------------------------------------------------------------
// Z-up: floor is Z=0. Items at (x, y, 0); horizontal rotation around Z.
// Inner group rotation {[Math.PI/2, 0, 0]} uprights Y-up GLTF models into Z-up world:
//   model +Y (height) → world +Z  ✓
//   model +Z (depth)  → world -Y  ✓
function PlacedItem3D({
  item, modelData, orbitRef: _orbitRef, onSelect,
}: {
  item: PlacedItem;
  modelData: any;
  orbitRef: React.RefObject<any>;
  onSelect?: (id: string | null) => void;
}) {
  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    onSelect?.(item.instanceId);
  }, [item.instanceId, onSelect]);

  return (
    <group
      position={[item.x, item.y, item.z ?? 0]}
      rotation={[0, 0, item.rotation * (Math.PI / 180)]}
      onClick={handleClick}
    >
      {/* Upright GLTF (Y-up) model into Z-up world space */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <ItemContent modelData={modelData} w={item.w} d={item.d} selected={false} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Gizmo3D — PivotControls overlay in perspective view
//
// NOTE: Camera-facing reflection (negative scale) is intentionally NOT used here.
// PivotControls decomposes its matrix into position/rotation/scale to compute drag
// deltas. Negative scale values confuse that decomposition and cause translation
// handles to be misinterpreted as rotation, especially on the Z (up/down) axis.
// We therefore always keep scale=(1,1,1) and let handles occasionally face away
// from the camera — a minor cosmetic trade-off for correct interaction.
// ---------------------------------------------------------------------------
function Gizmo3D({
  item, orbitRef, onMoveItem, onRotateItem,
}: {
  item: PlacedItem;
  orbitRef: React.RefObject<any>;
  onMoveItem?: (id: string, x: number, depth: number, elevation?: number) => void;
  onRotateItem?: (id: string, rotDeg: number) => void;
}) {
  const pivotRef = useRef<THREE.Group>(null);
  const gizmoWorldMatRef = useRef(new THREE.Matrix4());
  const draggingRef = useRef(false);

  const itemRef = useRef(item);
  itemRef.current = item;

  // Initial matrix — only recomputed on selection change; useFrame keeps it in sync
  const initMatrix = useMemo(() => {
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      item.rotation * (Math.PI / 180),
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(item.x, item.y, item.z ?? 0),
      q,
      new THREE.Vector3(1, 1, 1),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.instanceId]);

  // Sync gizmo position/rotation every frame (scale always 1,1,1 — no reflection)
  useFrame(() => {
    if (!pivotRef.current || draggingRef.current) return;

    const cur = itemRef.current;
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      cur.rotation * (Math.PI / 180),
    );
    pivotRef.current.matrix.compose(
      new THREE.Vector3(cur.x, cur.y, cur.z ?? 0),
      q,
      new THREE.Vector3(1, 1, 1), // always unit scale
    );
    pivotRef.current.matrixAutoUpdate = false;
    pivotRef.current.matrixWorldNeedsUpdate = true;
  });

  return (
    <PivotControls
      ref={pivotRef as any}
      matrix={initMatrix}
      autoTransform={false}
      scale={120}
      fixed={true}
      depthTest={false}
      activeAxes={[true, true, true]}
      disableScaling={true}
      annotations={false}
      lineWidth={2.5}
      onDragStart={() => {
        draggingRef.current = true;
        if (orbitRef.current) orbitRef.current.enabled = false;
      }}
      onDrag={(_l, _dl, w: THREE.Matrix4) => { gizmoWorldMatRef.current.copy(w); }}
      onDragEnd={() => {
        // Read world matrix BEFORE re-enabling useFrame updates
        const pos = new THREE.Vector3();
        const q = new THREE.Quaternion();
        gizmoWorldMatRef.current.decompose(pos, q, new THREE.Vector3());
        q.normalize();
        const euler = new THREE.Euler().setFromQuaternion(q, 'ZXY');

        draggingRef.current = false;
        if (orbitRef.current) orbitRef.current.enabled = true;

        // pos.x = X (left/right), pos.y = Y (depth/front-back), pos.z = Z (elevation)
        onMoveItem?.(item.instanceId, pos.x, pos.y, pos.z);
        onRotateItem?.(item.instanceId, THREE.MathUtils.radToDeg(euler.z));
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Scene3DContents — perspective scene
// ---------------------------------------------------------------------------
function Scene3DContents({
  placedItems, availableModels, selectedId, onSelect, onMoveItem, onRotateItem,
}: SetFurnitureCanvas3DProps) {
  const orbitRef = useRef<any>(null);

  const modelsById = useMemo(() => {
    const m = new Map<string, any>();
    availableModels.forEach(a => m.set(a.id, a));
    return m;
  }, [availableModels]);

  const selectedItem = useMemo(
    () => placedItems.find(i => i.instanceId === selectedId) ?? null,
    [placedItems, selectedId],
  );

  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const handleFloorClick = useCallback(() => {
    onSelectRef.current?.(null);
  }, []);

  return (
    <>
      <OrbitControls ref={orbitRef} enableDamping={false} />
      <Controls3DInner orbitRef={orbitRef} />
      <Scene3DCameraSetup placedItems={placedItems} orbitRef={orbitRef} />

      <ambientLight intensity={2.2} />
      {/* Z-up: light comes from above (+Z) and slightly front/right */}
      <directionalLight position={[5000, -5000, 15000]} intensity={1.5} />
      {/* Grid on Z=0 plane (XY plane in Z-up) — rotate default XZ-plane grid by +90° around X */}
      <gridHelper args={[50000, 50, '#2a3044', '#1e2538']} rotation={[Math.PI / 2, 0, 0]} />

      {/* Invisible floor (Z=0, XY plane) — click to deselect */}
      <mesh position={[0, 0, -1]} onClick={handleFloorClick}>
        <planeGeometry args={[200000, 200000]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {placedItems.map(item => (
        <PlacedItem3D
          key={item.instanceId}
          item={item}
          modelData={modelsById.get(item.assetId)}
          orbitRef={orbitRef}
          onSelect={onSelect}
        />
      ))}

      {selectedItem && (
        <Gizmo3D
          key={selectedItem.instanceId}
          item={selectedItem}
          orbitRef={orbitRef}
          onMoveItem={onMoveItem}
          onRotateItem={onRotateItem}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SetFurnitureCanvas3D — perspective 3D view (exported wrapper)
// ---------------------------------------------------------------------------
export function SetFurnitureCanvas3D(props: SetFurnitureCanvas3DProps) {
  return (
    <Canvas
      gl={{ antialias: true }}
      // Z-up convention: up=[0,0,1], camera approaches from -Y (front) and +Z (above)
      // far=200000: mm-scale scene needs large far plane
      camera={{ fov: 45, position: [0, -7000, 4000], near: 10, far: 200000, up: [0, 0, 1] }}
      style={{ width: '100%', height: '100%' }}
    >
      <Scene3DContents {...props} />
    </Canvas>
  );
}
