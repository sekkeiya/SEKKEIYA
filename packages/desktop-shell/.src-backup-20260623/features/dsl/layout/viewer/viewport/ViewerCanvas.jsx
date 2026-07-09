// src/features/layout/LayoutViewer/viewport/ViewerCanvas.jsx
import React, {
  Suspense,
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Box, Stack, Button } from "@mui/material";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";

import ViewerBaseGlb from "./ViewerBaseGlb.jsx";

// ✅ Editor側と同じ操作レイヤー
import { useViewportControls } from "@desktop/features/dsl/layout/hooks/useViewportControls.js";
import { useOrthoViewportControls } from "@desktop/features/dsl/layout/hooks/useOrthoViewportControls.js";

function Loader() {
  return null;
}

function GlbModel({ url, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], onClick }) {
  const gltf = useGLTF(url);
  const clonedScene = useMemo(() => gltf.scene ? gltf.scene.clone() : null, [gltf.scene]);

  return (
    <group
      position={position}
      rotation={rotation}
      scale={scale}
      onPointerDown={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      {clonedScene && <primitive object={clonedScene} />}
    </group>
  );
}

/**
 * ✅ Top用の Ortho Camera
 */
function TopOrthoCamera({ active }) {
  return active ? (
    <OrthographicCamera
      makeDefault
      position={[0, 20, 0]}
      near={-2000}
      far={2000}
      zoom={60}
      onUpdate={(cam) => {
        cam.up.set(0, 0, -1);
        cam.lookAt(0, 0, 0);

        cam.rotation.order = "YXZ";
        cam.rotation.z = 0;

        cam.updateProjectionMatrix();
      }}
    />
  ) : null;
}

function useRestorePerspectiveOnBack({ view, camera, orbitRef }) {
  const perspCamRef = useRef(null);
  const savedPerspRef = useRef(null);

  useEffect(() => {
    if (camera?.isPerspectiveCamera) perspCamRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const oc = orbitRef?.current;
    const persp = perspCamRef.current;

    if (view === "top") {
      if (!savedPerspRef.current && persp && oc) {
        savedPerspRef.current = {
          pos: persp.position.clone(),
          quat: persp.quaternion.clone(),
          up: persp.up.clone(),
          zoom: Number.isFinite(persp.zoom) ? persp.zoom : 1,
          target: oc.target.clone(),
        };
      }
      return;
    }

    const saved = savedPerspRef.current;
    if (!saved) return;
    if (!camera?.isPerspectiveCamera) return;

    camera.position.copy(saved.pos);
    camera.quaternion.copy(saved.quat);
    camera.up.copy(saved.up.lengthSq() > 0 ? saved.up : new THREE.Vector3(0, 1, 0));

    camera.rotation.order = "YXZ";
    camera.rotation.z = 0;

    camera.zoom = saved.zoom ?? camera.zoom;
    camera.updateProjectionMatrix();

    if (oc) {
      oc.target.copy(saved.target);
      oc.update();
    }

    savedPerspRef.current = null;
  }, [view, camera, orbitRef]);
}

function useWheelDollyZoom({ enabled, camera, domElement, orbitRef }) {
  useEffect(() => {
    if (!enabled || !camera || !domElement) return;

    const el = domElement;

    const onWheel = (e) => {
      if (!enabled) return;
      if (orbitRef?.current && orbitRef.current.enabled === false) return;

      e.preventDefault();

      const dy = e.deltaY || 0;
      const dir = dy > 0 ? 1 : -1;

      const oc = orbitRef?.current;
      const dist = oc ? camera.position.distanceTo(oc.target) : 6;
      const base = Math.max(0.08, dist * 0.08);
      const step = base * dir;

      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      if (forward.lengthSq() < 1e-8) forward.set(0, 0, -1);
      forward.normalize();

      const move = forward.multiplyScalar(-step);

      camera.position.add(move);

      if (oc) {
        oc.target.add(move);
        oc.update();
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, camera, domElement, orbitRef]);
}

function ControlsLayer({ enabled, view, selected, getSelectedObject }) {
  const orbitRef = useRef(null);
  const { camera, gl } = useThree();
  const editorMode = useEditorModeStore((s) => s.editorMode);

  const isTop = view === "top";

  useRestorePerspectiveOnBack({ view, camera, orbitRef });

  useOrthoViewportControls({
    camera,
    domElement: gl.domElement,
    orbitRef,
    enabled: enabled && isTop,
    getSelectedObject,
    selectedKey: selected?.selectedKey || selected?.itemId || selected?.baseId || "",
    moveSpeed: 85,
    panSpeed: 1.2,
    zoomWheelStep: 0.12,
    zoomMin: 5,
    zoomMax: 250,
    zoomKeySpeed: 2.2,
    autoPanOnSelect: false,
  });

  useViewportControls({
    camera,
    domElement: gl.domElement,
    orbitRef,
    enabled: enabled && !isTop && editorMode !== "layout",
    getSelectedObject,
    selectedKey: selected?.selectedKey || selected?.itemId || selected?.baseId || "",
    moveSpeed: 3.0,
    verticalSpeed: 3.0,
    lookSpeed: 0.003,
    panSpeed: 0.002,
    autoPivotOnSelect: false,
  });

  useWheelDollyZoom({
    enabled: enabled && !isTop && editorMode !== "layout",
    camera,
    domElement: gl.domElement,
    orbitRef,
  });

  return (
    <OrbitControls
      ref={orbitRef}
      makeDefault
      enabled={true}
      enableDamping
      dampingFactor={0}
      enableRotate={!isTop && editorMode !== "layout"}
      enablePan={false}
      enableZoom={false}
    />
  );
}

/**
 * ✅ WebGL canvas を縮小して dataURL を作る（容量削減）
 */
function canvasToScaledDataUrl(canvas, { type = "image/jpeg", quality = 0.82, maxW = 960, maxH = 540 } = {}) {
  if (!canvas) return "";
  const w = canvas.width || 0;
  const h = canvas.height || 0;
  if (!w || !h) return "";

  const scale = Math.min(1, maxW / w, maxH / h);
  const outW = Math.max(1, Math.floor(w * scale));
  const outH = Math.max(1, Math.floor(h * scale));

  if (scale >= 0.999) {
    try {
      return canvas.toDataURL(type, quality);
    } catch {
      return "";
    }
  }

  const tmp = document.createElement("canvas");
  tmp.width = outW;
  tmp.height = outH;

  const ctx = tmp.getContext("2d");
  if (!ctx) return "";

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  try {
    ctx.drawImage(canvas, 0, 0, outW, outH);
    return tmp.toDataURL(type, quality);
  } catch {
    return "";
  }
}

const ViewerCanvas = forwardRef(function ViewerCanvas(
{ selected, onSelectObject, baseGlbUrlResolved, layout, loading },
  ref
) {
  const glRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  
  const items = Array.isArray(layout?.items) ? layout.items : [];

  const [view, setView] = useState("perspective"); // "perspective" | "top"
  const isTop = view === "top";

  // ✅ 本物の WebGL canvas
  const webglCanvasRef = useRef(null);

  // ✅ “描画が1回でも走った” を検知（サムネが白になるのを避ける）
  const firstFrameReadyRef = useRef(false);

  const getSelectedObject = useMemo(() => () => null, []);
  const handleSetView = useCallback((next) => setView(next), []);

  // ✅ 外部に captureThumbnail API を公開
  useImperativeHandle(ref, () => ({
    captureThumbnail: async ({
      width = 2400,
      height = 800,
      quality = 0.92,
      mimeType = "image/jpeg",
    } = {}) => {
      const gl = glRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      if (!gl || !scene || !camera) return "";

      // ✅ 描画待ち（白対策）
      if (!firstFrameReadyRef.current) {
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => requestAnimationFrame(r));
      }

      // ---- 現在値を退避
      const prevSize = gl.getSize(new THREE.Vector2());
      const prevPixelRatio = gl.getPixelRatio();
      const prevAspect = camera.isPerspectiveCamera ? camera.aspect : null;

      // ---- 一時的に高解像度で描画（ここが本丸）
      gl.setPixelRatio(1);                 // ✅ 余計なDPRブレを避ける
      gl.setSize(width, height, false);

      if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }

      gl.render(scene, camera);

      // ---- 取り出し
      const dataUrl = gl.domElement.toDataURL(mimeType, quality);

      // ---- 元に戻す
      gl.setSize(prevSize.x, prevSize.y, false);
      gl.setPixelRatio(prevPixelRatio);
      if (camera.isPerspectiveCamera && prevAspect) {
        camera.aspect = prevAspect;
        camera.updateProjectionMatrix();
      }

      return dataUrl || "";
    },
  }));


  return (
    <Box sx={{ height: "100%", width: "100%", position: "relative" }}>
      {/* UI：右上切替 */}
      <Box sx={{ position: "absolute", top: 10, right: 10, zIndex: 5, pointerEvents: "auto" }}>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant={view === "perspective" ? "contained" : "outlined"}
            onClick={() => handleSetView("perspective")}
          >
            Perspective
          </Button>
          <Button size="small" variant={view === "top" ? "contained" : "outlined"} onClick={() => handleSetView("top")}>
            Top
          </Button>
        </Stack>
      </Box>

      <Canvas
        shadows
        camera={{ position: [6, 6, 6], fov: 45 }}
        // ✅ これが超重要：toDataURL で真っ白にならないため
        gl={{ preserveDrawingBuffer: true }}
        onCreated={({ gl, scene, camera }) => {
          webglCanvasRef.current = gl.domElement;
          glRef.current = gl;
          sceneRef.current = scene;
          cameraRef.current = camera;
        }}
        onAfterRender={() => {
          // ✅ 1回でも描画されたらOK
          firstFrameReadyRef.current = true;
        }}
      >
        <TopOrthoCamera active={isTop} />

        <ambientLight intensity={0.65} />
        <directionalLight position={[6, 10, 6]} intensity={1.0} castShadow />
        <gridHelper args={[100, 100, 0x888888, 0x444444]} />

        <ControlsLayer enabled view={view} selected={selected} getSelectedObject={getSelectedObject} />

        <Suspense fallback={<Loader />}>
          {baseGlbUrlResolved ? <ViewerBaseGlb url={baseGlbUrlResolved} /> : null}

          {items.map((it) => {
            const url = it?.glbUrl;
            if (!url) return null;

            const pos = it?.transform?.position || [0, 0, 0];
            const rot = it?.transform?.rotation || [0, 0, 0];
            const scl = it?.transform?.scale || [1, 1, 1];

            return (
              <GlbModel
                key={it.id}
                url={url}
                position={pos}
                rotation={rot}
                scale={scl}
                onClick={() =>
                  onSelectObject?.({
                    kind: "item",
                    itemId: it.id,
                    modelId: it.modelId,
                    name: it.name,
                  })
                }
              />
            );
          })}
        </Suspense>

        {loading ? <Loader /> : null}
      </Canvas>
    </Box>
  );
});

export default ViewerCanvas;

useGLTF.preload?.("");
