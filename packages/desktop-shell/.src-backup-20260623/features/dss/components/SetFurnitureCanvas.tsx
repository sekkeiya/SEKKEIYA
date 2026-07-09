import React, { useRef, useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrthographicCamera, MapControls, OrbitControls, useGLTF, PivotControls } from '@react-three/drei';
import * as THREE from 'three';
import { useResolvedUrl } from '@desktop/features/dsl/layout/hooks/useResolvedUrl';
import type { PlacedItem } from './SetFurnitureEditor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getGlbRaw(model: any): string {
  return (
    model?.glbUrl ??
    model?.modelGlbUrl ??
    model?.files?.glb?.url ??
    model?.files?.glb?.downloadUrl ??
    model?.files?.glb?.downloadURL ??
    model?.files?.glb?.storagePath ??
    model?.files?.glb?.fullPath ??
    model?.glbStoragePath ??
    model?.viewerGlbUrl ??
    ''
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
// PlacedItemMesh — non-selected items (top view)
// ---------------------------------------------------------------------------
interface PlacedItemMeshProps {
  item: PlacedItem;
  modelData: any;
  onItemPointerDown: (e: any, item: PlacedItem) => void;
  onItemClick: (id: string) => void;
}

function PlacedItemMeshInner({ item, modelData, onItemPointerDown, onItemClick }: PlacedItemMeshProps) {
  return (
    <group
      position={[item.x, 0, item.y]}
      rotation={[0, item.rotation * (Math.PI / 180), 0]}
      onPointerDown={(e) => onItemPointerDown(e, item)}
      onClick={(e) => { e.stopPropagation(); onItemClick(item.instanceId); }}
    >
      <PlacedItemContent item={item} modelData={modelData} selected={false} />
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
  selectedId: string | null;
  pendingModel: any | null;
  onPlaceAt: (x: number, z: number) => void;
  onSelect: (id: string | null) => void;
  onMoveItem: (id: string, x: number, z: number) => void;
  onRotateItem: (id: string, rotDeg: number) => void;
}

type DragState = {
  instanceId: string;
  startX: number;
  startZ: number;
  px0: number;
  pz0: number;
};

function SceneContents({
  placedItems, availableModels, selectedId, pendingModel,
  onPlaceAt, onSelect, onMoveItem, onRotateItem,
}: SetFurnitureCanvasProps) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<any>(null);
  const [ghostPos, setGhostPos] = useState<[number, number, number] | null>(null);

  const pendingRef = useRef(pendingModel);
  const onMoveRef = useRef(onMoveItem);
  const onPlaceRef = useRef(onPlaceAt);
  const onSelectRef = useRef(onSelect);
  const onRotateRef = useRef(onRotateItem);
  useEffect(() => { pendingRef.current = pendingModel; }, [pendingModel]);
  useEffect(() => { onMoveRef.current = onMoveItem; }, [onMoveItem]);
  useEffect(() => { onPlaceRef.current = onPlaceAt; }, [onPlaceAt]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onRotateRef.current = onRotateItem; }, [onRotateItem]);

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
    // Use only the item's Y-rotation — no extra quaternion so PivotControls
    // doesn't flip the model when autoTransform applies the matrix to children.
    const itemQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      selectedItem.rotation * (Math.PI / 180),
    );
    return new THREE.Matrix4().compose(
      new THREE.Vector3(selectedItem.x, 0, selectedItem.y),
      itemQuat,
      new THREE.Vector3(1, 1, 1),
    );
  }, [selectedId]);

  const gizmoWorldMatRef = useRef(new THREE.Matrix4());

  const getWorldXZ = useCallback((clientX: number, clientY: number) => {
    const rect = gl.domElement.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(nx, ny), camera);
    const xzPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    rc.ray.intersectPlane(xzPlane, hit);
    return { x: hit.x, z: hit.z };
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
      const xzPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      rc.ray.intersectPlane(xzPlane, hit);

      if (drag) {
        onMoveRef.current(
          drag.instanceId,
          drag.startX + (hit.x - drag.px0),
          drag.startZ + (hit.z - drag.pz0),
        );
      } else if (pm) {
        setGhostPos([hit.x, 0, hit.z]);
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

  const handleItemPointerDown = useCallback((e: any, item: PlacedItem) => {
    if (e.button !== 0) return; // only left button starts item drag
    e.stopPropagation();
    const cx = e.nativeEvent?.clientX ?? e.clientX;
    const cy = e.nativeEvent?.clientY ?? e.clientY;
    const { x, z } = getWorldXZ(cx, cy);
    dragRef.current = { instanceId: item.instanceId, startX: item.x, startZ: item.y, px0: x, pz0: z };
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, [getWorldXZ]);

  const handleItemClick = useCallback((id: string) => {
    onSelectRef.current(id);
  }, []);

  const handleFloorClick = useCallback((e: any) => {
    if (pendingRef.current) {
      onPlaceRef.current(e.point.x, e.point.z);
    } else {
      onSelectRef.current(null);
    }
  }, []);

  const handleGizmoDragStart = useCallback(() => {
    if (controlsRef.current) controlsRef.current.enabled = false;
  }, []);

  const handleGizmoDrag = useCallback((
    _l: THREE.Matrix4,
    _dl: THREE.Matrix4,
    w: THREE.Matrix4,
  ) => {
    gizmoWorldMatRef.current.copy(w);
  }, []);

  const handleGizmoDragEnd = useCallback(() => {
    if (!selectedId) return;
    const pos = new THREE.Vector3();
    const gizmoQuat = new THREE.Quaternion();
    gizmoWorldMatRef.current.decompose(pos, gizmoQuat, new THREE.Vector3());
    // Decompose Y-rotation directly — no extra quaternion needed
    const euler = new THREE.Euler().setFromQuaternion(gizmoQuat, 'YXZ');
    onMoveRef.current(selectedId, pos.x, pos.z);
    onRotateRef.current(selectedId, THREE.MathUtils.radToDeg(euler.y));
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, [selectedId]);

  const ghostDims = pendingModel?.dimensions ?? pendingModel?.dimensionsMm ?? {};
  const ghostW = Math.max(100, Number(ghostDims.x ?? ghostDims.width ?? 800));
  const ghostD = Math.max(100, Number(ghostDims.y ?? ghostDims.depth ?? ghostDims.z ?? 600));
  const ghostH = Math.max(100, Math.min(ghostW, ghostD) * 0.7);

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[0, 20000, 0.001]}
        up={[0, 0, -1]}
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
      <directionalLight position={[5000, 15000, 5000]} intensity={1.5} />
      <gridHelper args={[50000, 50, '#2a3044', '#1e2538']} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} onClick={handleFloorClick}>
        <planeGeometry args={[200000, 200000]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>

      {pendingModel && ghostPos && (
        <group position={ghostPos}>
          <mesh position={[0, ghostH / 2, 0]}>
            <boxGeometry args={[ghostW, ghostH, ghostD]} />
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.28} depthWrite={false} />
          </mesh>
          <mesh position={[0, ghostH / 2, 0]}>
            <boxGeometry args={[ghostW * 1.005, ghostH * 1.005, ghostD * 1.005]} />
            <meshBasicMaterial color="#c4b5fd" wireframe />
          </mesh>
        </group>
      )}

      {placedItems
        .filter(item => item.instanceId !== selectedId)
        .map(item => (
          <PlacedItemMesh
            key={item.instanceId}
            item={item}
            modelData={modelsById.get(item.assetId)}
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
          activeAxes={[true, false, true]}
          disableScaling={true}
          annotations={false}
          lineWidth={2.5}
          onDragStart={handleGizmoDragStart}
          onDrag={handleGizmoDrag as any}
          onDragEnd={handleGizmoDragEnd}
        >
          <group onClick={(e) => e.stopPropagation()}>
            <PlacedItemContent
              item={selectedItem}
              modelData={modelsById.get(selectedItem.assetId)}
              selected={true}
            />
          </group>
        </PivotControls>
      )}
    </>
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
// Controls3DInner — full 3DSL-parity FPS camera controls (Z-up world)
//
//   RMB drag          → FPS look-around (yaw/pitch, pointer-locked)
//   Shift + RMB drag  → viewport-plane pan
//   Ctrl  + RMB drag  → dolly zoom
//   WASD              → forward/back/strafe  (only while RMB is held)
//   QE                → up/down along Z      (only while RMB is held)
//   Shift (during RMB)→ ×3 movement speed
//   RMB + wheel       → adjust speed multiplier (0.2× … 12×)
//   Scroll wheel      → zoom via OrbitControls (RMB not held)
//   AT/AR/AB/AL       → 2-key camera preset angles (A → T/R/B/L within 650 ms)
//   Cursor            → 'grabbing' on RMB, zoom SVG on Ctrl+RMB
// ---------------------------------------------------------------------------
function Controls3DInner({ orbitRef }: { orbitRef: React.RefObject<any> }) {
  const { camera, gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    const cam = camera as THREE.PerspectiveCamera;

    // ── State ─────────────────────────────────────────────────────────────
    const s = {
      keys:        new Set<string>(),
      rmb:         false,
      shift:       false,
      ctrl:        false,
      lastX:       0,
      lastY:       0,
      yaw:         0,
      pitch:       0,
      orbitDist:   6000,
      speedMul:    1.0,
      pointerId:   null as number | null,
      capturedRmb: false,
      isZoomDrag:  false,
    };

    // ── Constants ──────────────────────────────────────────────────────────
    const LOOK  = 0.003;
    const MOVE  = 3000;   // mm/s (scene is in mm)
    const VERT  = 3000;
    const WSTEP = 0.12;
    const WMIN  = 0.2;
    const WMAX  = 12.0;
    const ZOOM_CURSOR =
      `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">` +
      `<circle cx="16" cy="16" r="14" fill="rgba(255,255,255,0.8)" stroke="black" stroke-width="2"/>` +
      `<line x1="26" y1="26" x2="31" y2="31" stroke="black" stroke-width="4" stroke-linecap="round"/>` +
      `<g stroke="black" stroke-width="2">` +
      `<line x1="16" y1="8" x2="16" y2="14"/><line x1="13" y1="11" x2="19" y2="11"/>` +
      `<line x1="13" y1="21" x2="19" y2="21"/></g></svg>') 12 12, ns-resize`;

    // ── Helpers ────────────────────────────────────────────────────────────
    const isTextInput = (t: EventTarget | null) => {
      if (!t) return false;
      const el = t as HTMLElement;
      const tag = el.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || el.isContentEditable;
    };

    // Z-up: decompose camera rotation using ZXY Euler order
    const syncYawPitch = () => {
      const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'ZXY');
      s.yaw   = e.z;
      s.pitch = e.x;
    };

    // Z-up: apply yaw/pitch back to camera
    const applyCameraRotation = () => {
      const lim = Math.PI / 2 - 0.01;
      s.pitch = Math.max(-lim, Math.min(lim, s.pitch));
      cam.rotation.order = 'ZXY';
      cam.rotation.z = s.yaw;
      cam.rotation.x = s.pitch;
      cam.rotation.y = 0;
    };

    // After FPS ends, push OrbitControls target to where camera looks
    const syncOrbitTarget = () => {
      const oc = orbitRef.current;
      if (!oc) return;
      let dist = Number.isFinite(s.orbitDist) ? s.orbitDist : cam.position.distanceTo(oc.target);
      if (!Number.isFinite(dist)) dist = 6000;
      dist = Math.max(100, dist);
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      oc.target.copy(cam.position).add(fwd.multiplyScalar(dist));
      oc.update();
    };

    const endRmb = () => {
      if (!s.rmb) return;
      const wasCaptured = s.capturedRmb;
      s.rmb         = false;
      s.isZoomDrag  = false;
      s.capturedRmb = false;
      s.keys.clear();
      s.shift = false;
      s.ctrl  = false;

      el.style.cursor = '';
      if (wasCaptured && s.pointerId != null) {
        try { el.releasePointerCapture(s.pointerId); } catch { /* ignore */ }
      }
      s.pointerId = null;

      if (document.pointerLockElement === el) {
        try { document.exitPointerLock(); } catch { /* ignore */ }
      }

      if (orbitRef.current && wasCaptured) {
        syncOrbitTarget();
        orbitRef.current.enabled = true;
        orbitRef.current.update();
      }
    };

    // ── Initial OrbitControls config ───────────────────────────────────────
    if (orbitRef.current) {
      orbitRef.current.enableDamping  = false;
      orbitRef.current.dampingFactor  = 0;
      // LMB disabled; MIDDLE = dolly; RMB handled entirely by us
      (orbitRef.current.mouseButtons as any).LEFT   = -1;
      (orbitRef.current.mouseButtons as any).MIDDLE = THREE.MOUSE.DOLLY;
      (orbitRef.current.mouseButtons as any).RIGHT  = -1;
    }

    // ── WASD / QE animation loop ───────────────────────────────────────────
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!s.rmb || s.keys.size === 0) return;

      const mul = (Number.isFinite(s.speedMul) ? s.speedMul : 1.0) * (s.shift ? 3.0 : 1.0);
      const sp  = MOVE * mul;
      const vsp = VERT * mul;

      // forward: camera look direction (Z-up, includes all axes)
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      if (fwd.lengthSq() < 1e-8) fwd.set(0, -1, 0);
      fwd.normalize();

      // right strafe: fwd × worldUp(Z)
      const worldUp = new THREE.Vector3(0, 0, 1);
      const right = new THREE.Vector3().crossVectors(fwd, worldUp);
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();

      const v = new THREE.Vector3();
      if (s.keys.has('w')) v.add(fwd);
      if (s.keys.has('s')) v.sub(fwd);
      if (s.keys.has('d')) v.add(right);
      if (s.keys.has('a')) v.sub(right);

      if (v.lengthSq() > 0) {
        v.normalize().multiplyScalar(sp * dt);
        cam.position.add(v);
        orbitRef.current?.target.add(v);
      }

      // Q = move up (+Z), E = move down (-Z)
      const upSign = (s.keys.has('q') ? 1 : 0) - (s.keys.has('e') ? 1 : 0);
      if (upSign !== 0) {
        cam.position.addScaledVector(worldUp, upSign * vsp * dt);
        orbitRef.current?.target.addScaledVector(worldUp, upSign * vsp * dt);
      }

      orbitRef.current?.update();
    };

    raf = requestAnimationFrame(tick);

    // ── Canvas hover tracking ──────────────────────────────────────────────
    let canvasHovered = false;
    const onEnter = () => { canvasHovered = true; };
    const onLeave = () => { canvasHovered = false; };

    // ── AT/AR/AB/AL shortcut state ─────────────────────────────────────────
    let waitSecond = false;
    let shortcutTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Pointer events ─────────────────────────────────────────────────────
    const onContextMenu = (e: Event) => e.preventDefault();

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;

      s.rmb        = true;
      s.shift      = e.shiftKey;
      s.ctrl       = e.ctrlKey;
      s.lastX      = e.clientX;
      s.lastY      = e.clientY;
      s.pointerId  = e.pointerId;
      s.isZoomDrag = e.ctrlKey;
      s.capturedRmb = true;

      syncYawPitch();
      cam.rotation.order = 'ZXY';

      const oc = orbitRef.current;
      if (oc) {
        const d = cam.position.distanceTo(oc.target);
        s.orbitDist = Number.isFinite(d) && d > 0 ? d : 6000;
        oc.enabled = false;
      }

      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      el.style.cursor = s.isZoomDrag ? ZOOM_CURSOR : 'grabbing';

      // Request pointer lock for seamless look-around (non-shift, non-ctrl RMB only)
      if (!s.isZoomDrag && !s.shift) {
        try { (el as any).requestPointerLock?.(); } catch { /* ignore */ }
      }

      e.preventDefault();
    };

    const onPointerUp     = (e: PointerEvent) => { if (e.button === 2) endRmb(); };
    const onPointerCancel = ()                 => endRmb();

    const onPointerMove = (e: PointerEvent) => {
      if (!s.rmb || !s.capturedRmb) return;

      const locked = document.pointerLockElement === el;
      const dx = locked ? e.movementX : e.clientX - s.lastX;
      const dy = locked ? e.movementY : e.clientY - s.lastY;
      if (!locked) { s.lastX = e.clientX; s.lastY = e.clientY; }

      // Ctrl+RMB: dolly (move camera toward/away from orbit target)
      if (s.isZoomDrag) {
        const oc = orbitRef.current;
        if (oc) {
          const toCamera = new THREE.Vector3().subVectors(cam.position, oc.target);
          let dist = toCamera.length();
          dist = Math.max(10, dist * Math.pow(0.995, -dy));
          if (toCamera.lengthSq() > 1e-5) {
            cam.position.copy(oc.target).addScaledVector(toCamera.normalize(), dist);
            oc.update();
          }
        }
        return;
      }

      // Shift+RMB: viewport-plane pan
      if (s.shift) {
        const oc = orbitRef.current;
        const targetDist = oc ? cam.position.distanceTo(oc.target) : s.orbitDist;
        const fovRad = (cam.fov ?? 45) * Math.PI / 180;
        const panSpd  = (2 * targetDist * Math.tan(fovRad / 2)) / (el.clientHeight || 600);

        const r = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
        const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
        cam.position.addScaledVector(r, -dx * panSpd);
        cam.position.addScaledVector(u,  dy * panSpd);
        if (oc) {
          oc.target.addScaledVector(r, -dx * panSpd);
          oc.target.addScaledVector(u,  dy * panSpd);
          oc.update();
        }
        return;
      }

      // Plain RMB: FPS look-around (Z-up yaw=Z, pitch=X)
      s.yaw   -= dx * LOOK;
      s.pitch -= dy * LOOK;
      applyCameraRotation();
    };

    // RMB + wheel: adjust WASD speed multiplier (no zoom)
    const onWheel = (e: WheelEvent) => {
      if (!s.rmb) return;
      e.preventDefault();
      const dir = (e.deltaY ?? 0) > 0 ? -1 : 1;
      s.speedMul = Math.max(WMIN, Math.min(WMAX, s.speedMul * (1 + WSTEP * dir)));
    };

    // ── Keyboard events ────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;

      if (e.key === 'Shift')   { s.shift = true;  return; }
      if (e.key === 'Control') { s.ctrl  = true;  return; }

      const k = e.key.toLowerCase();

      // WASD/QE: movement only while RMB is held (same as 3DSL wasdRequiresRmb)
      // Note: 'a' is excluded here so it can still trigger AT shortcut when RMB is up
      if (s.rmb && ['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
        e.preventDefault();
        s.keys.add(k);
        return;
      }

      // ── AT/AR/AB/AL camera presets (canvas must be hovered) ────────────
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
        // Z-up: Z = vertical, Y = depth (front/back), X = right/left
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

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift')   s.shift = false;
      if (e.key === 'Control') s.ctrl  = false;
      s.keys.delete(e.key.toLowerCase());
    };

    const onWindowPtrUp   = (e: PointerEvent) => { if (e.button === 2) endRmb(); };
    const onWindowBlur    = ()                 => endRmb();
    const onKeyBlur       = ()                 => { s.keys.clear(); s.shift = false; s.ctrl = false; };
    const onVisChange     = ()                 => { if (document.visibilityState !== 'visible') endRmb(); };
    const onPtrLockChange = ()                 => { if (s.rmb && document.pointerLockElement !== el) endRmb(); };

    // ── Attach ─────────────────────────────────────────────────────────────
    el.addEventListener('contextmenu',   onContextMenu,  { passive: false });
    el.addEventListener('pointerdown',   onPointerDown,  { passive: false });
    el.addEventListener('pointerup',     onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    el.addEventListener('pointermove',   onPointerMove,  { passive: true });
    el.addEventListener('wheel',         onWheel,        { passive: false });
    el.addEventListener('mouseenter',    onEnter);
    el.addEventListener('mouseleave',    onLeave);
    window.addEventListener('pointerup',          onWindowPtrUp,   { passive: true });
    window.addEventListener('blur',               onWindowBlur);
    window.addEventListener('keydown',            onKeyDown,       { passive: false });
    window.addEventListener('keyup',              onKeyUp,         { passive: true });
    window.addEventListener('blur',               onKeyBlur);
    document.addEventListener('visibilitychange', onVisChange);
    document.addEventListener('pointerlockchange', onPtrLockChange);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('contextmenu',   onContextMenu);
      el.removeEventListener('pointerdown',   onPointerDown);
      el.removeEventListener('pointerup',     onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('pointermove',   onPointerMove);
      el.removeEventListener('wheel',         onWheel);
      el.removeEventListener('mouseenter',    onEnter);
      el.removeEventListener('mouseleave',    onLeave);
      window.removeEventListener('pointerup',          onWindowPtrUp);
      window.removeEventListener('blur',               onWindowBlur);
      window.removeEventListener('keydown',            onKeyDown);
      window.removeEventListener('keyup',              onKeyUp);
      window.removeEventListener('blur',               onKeyBlur);
      document.removeEventListener('visibilitychange', onVisChange);
      document.removeEventListener('pointerlockchange', onPtrLockChange);
      el.style.cursor = '';
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
