// src/features/layout/components/MainArea/components/viewports/SingleViewportCanvas.jsx
import React, { useMemo, useCallback, useRef, useEffect, useState, Suspense } from "react";
import { layoutSceneRef } from "@desktop/features/dsl/layout/services/layoutSceneRef";
import { Box, Chip, Menu, MenuItem, Divider, ListItemIcon, ListItemText, IconButton, Slider, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { alpha, useTheme } from "@mui/material/styles";
import CheckIcon from "@mui/icons-material/Check";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";

import {
  VIEW_TYPES,
  getOrthoPreset,
  optimizeTopPlacement,
} from "@desktop/features/dsl/layout/utils/viewportUtils.js";

import Lights from "../scene/Lights.jsx";
import SceneGrid from "../scene/SceneGrid.jsx";
import BaseGlb from "../scene/BaseGlb.jsx";
import LandscapeBackdrop from "../scene/LandscapeBackdrop.jsx";
import FurnitureItem from "../scene/FurnitureItem.jsx";
import FurnitureDimensionOverlay from "../scene/FurnitureDimensionOverlay.jsx";
import AiPlaceholderItem from "../scene/AiPlaceholderItem.jsx";
import ZoneDrawController from "../scene/ZoneDrawController.jsx";
import ZoneCirculationController from "../scene/ZoneCirculationController.jsx";

import TransformGizmo from "@desktop/features/dsl/layout/canvas/tools/gizmo/TransformGizmo.jsx";
import LayoutModeInteractionController from "@desktop/features/dsl/layout/canvas/tools/layout/LayoutModeInteractionController.jsx";
import ZoneVisualizer from "../scene/ZoneVisualizer.jsx";

import { PerspectiveControlsBinder, OrthoControlsBinder } from "../controls/controlsBinders.jsx";
import ViewportFramingController from "../controls/ViewportFramingController.jsx";

import { useMarqueeSelection } from "@desktop/features/dsl/layout/hooks/useMarqueeSelection.js";


// ✁EObject3D registryE唯一のObject管琁EE
import { useSceneObjectRegistryStore } from "@desktop/features/dsl/layout/store/sceneObjectRegistryStore";

import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";
import { useZoningStore } from "@desktop/features/dsl/layout/store/useZoningStore";
import { useSelectionScopeStore, canSelectItem } from "@desktop/features/dsl/layout/store/useSelectionScopeStore";

// ✁Eviewport ui storeEElign / Command / layout etcEE
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

// ✁ESnap Engine
import SnapGuide from "@desktop/features/dsl/layout/canvas/tools/align/SnapGuide.jsx";

import AlignCursorBinder from "./controllers/AlignCursorBinder.jsx";
import AlignPointerController from "./controllers/AlignPointerController.jsx";
import SmoothAlignFollower from "./controllers/SmoothAlignFollower.jsx";
import MaterialPickController from "./controllers/MaterialPickController.jsx";
import MaterialCursorBinder from "./controllers/MaterialCursorBinder.jsx";

import { useViewportSelection } from "./hooks/useViewportSelection";
import { useRmbNav } from "./hooks/useRmbNav";
import { useSnapEngine } from "./hooks/useSnapEngine";
import { useEditorModeStore, ViewportOverrideContext } from "@desktop/features/dsl/layout/store/useEditorModeStore";
import { useViewportEnvStore, threeToneMapping, focalLengthToFov } from "@desktop/features/dsl/layout/store/useViewportEnvStore";

import { useThree } from "@react-three/fiber";
import LayoutCameraRig from "../tools/layout/LayoutCameraRig.jsx";
import SectionClipManager from "../SectionClipManager.jsx";
import GridPickController from "./controllers/GridPickController.jsx";

function ContextDisposer() {
  const { gl } = useThree();
  useEffect(() => {
    return () => {
      // モジュールスコープ参照をクリア（スタレ参照によるエラーを防ぐ）
      layoutSceneRef.gl = null;
      layoutSceneRef.scene = null;
      layoutSceneRef.baseRoot = null;
      layoutSceneRef.getCameraState = null;

      console.log("[ContextDisposer] 🧹 Force releasing WebGL context to prevent limit exhaustion!");
      try {
        if (gl && typeof gl.forceContextLoss === "function") {
          gl.forceContextLoss();
        }
        if (gl && typeof gl.dispose === "function") {
          gl.dispose();
        }
      } catch (e) {
        console.warn("[ContextDisposer] WebGL context loss error:", e);
      }
    };
  }, [gl]);
  return null;
}

class CanvasErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error("[SingleViewportCanvas] Render failed inside Canvas:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/* =========================================================
 * ViewportDisplayController
 * Applies display modes to the Three.js scene
 * ======================================================= */
function ViewportDisplayController({ mode, ghostOpacity = 0.45, renderSubMode = "standard" }) {
  const { scene, gl } = useThree();
  // Ambience の Camera/Render タブからの設定を購読
  const envToneMapping = useViewportEnvStore((s) => s.toneMapping);
  const envExposure = useViewportEnvStore((s) => s.exposure);

  useEffect(() => {
    if (!scene || !gl) return;

    // shadow map: rendered / shaded のどちらでも有効にしてスポットの照射円を常に確認可能にする
    const needsShadow = mode === "rendered" || mode === "shaded";
    if (gl.shadowMap) {
      if (gl.shadowMap.enabled !== needsShadow) {
        gl.shadowMap.enabled = needsShadow;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.shadowMap.needsUpdate = true;
      }
    }

    // ── GL-level: tone mapping & exposure
    // 「レンダリング」モード時のみ Ambience > Camera/Render タブの設定を適用。
    // 他モード (outline / shaded / ghosted) では忠実な色再現のためトーンマッピング無効。
    if (mode === "rendered") {
      gl.toneMapping = threeToneMapping(envToneMapping);
      gl.toneMappingExposure = envExposure;
    } else {
      gl.toneMapping = THREE.NoToneMapping;
      gl.toneMappingExposure = 1.0;
    }

    // A helper to recursively update materials
    scene.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        // Clone materials for this viewport to avoid affecting other viewports
        if (!obj.userData.hasViewportClonedMaterial) {
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(m => m.clone());
          } else {
            obj.material = obj.material.clone();
          }
          obj.userData.hasViewportClonedMaterial = true;
        }

        // Outline Edges handling
        if (mode === "outline" || mode === "shaded") {
          if (!obj.userData.outlineMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
            try {
              const edges = new THREE.EdgesGeometry(obj.geometry, 15); // angle threshold
              const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
              const outlineMesh = new THREE.LineSegments(edges, lineMat);
              // Render order helps but polygonOffset is better to prevent z-fighting
              lineMat.polygonOffset = true;
              lineMat.polygonOffsetFactor = -1;
              lineMat.polygonOffsetUnits = -1;
              
              obj.add(outlineMesh);
              obj.userData.outlineMesh = outlineMesh;
            } catch (err) {
              console.warn("Failed to create edges geometry for mesh", err);
            }
          }
          if (obj.userData.outlineMesh) {
            obj.userData.outlineMesh.visible = true;
            if (mode === "outline") {
              obj.userData.outlineMesh.material.color.setHex(0xffffff); // White outline on transparent faces
            } else if (mode === "shaded") {
              obj.userData.outlineMesh.material.color.setHex(0x000000); // Black edges on shaded mode
            }
          }
        } else {
          if (obj.userData.outlineMesh) {
            obj.userData.outlineMesh.visible = false;
          }
        }

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        
        mats.forEach(mat => {
          // Backup original settings if not already backed up
          if (mat.userData.originalWireframe === undefined) {
             mat.userData.originalWireframe = mat.wireframe || false;
             mat.userData.originalTransparent = mat.transparent || false;
             mat.userData.originalOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
             mat.userData.originalDepthTest = mat.depthTest !== undefined ? mat.depthTest : true;
             mat.userData.originalDepthWrite = mat.depthWrite !== undefined ? mat.depthWrite : true;
             mat.userData.originalColor = mat.color ? mat.color.getHex() : 0xffffff;
             mat.userData.originalRoughness = mat.roughness !== undefined ? mat.roughness : 0.5;
             mat.userData.originalMetalness = mat.metalness !== undefined ? mat.metalness : 0.5;
          }

          // Apply mode
          switch (mode) {
            case "ghosted":
              // 躯体のみ透過、家具は通常表示を維持
              mat.wireframe = false;
              if (obj.userData.isStructuralBase) {
                mat.transparent = true;
                mat.opacity = ghostOpacity;
                mat.depthTest = true;
                mat.depthWrite = false;
              } else {
                mat.transparent = mat.userData.originalTransparent;
                mat.opacity = mat.userData.originalOpacity;
                mat.depthTest = mat.userData.originalDepthTest;
                mat.depthWrite = mat.userData.originalDepthWrite;
              }
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              break;
            case "outline":
              mat.wireframe = false;
              mat.transparent = true;
              mat.opacity = 0.0; // Completely transparent faces
              mat.depthTest = true;
              mat.depthWrite = false;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              break;
            case "rendered":
              mat.wireframe = false;
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.depthTest = mat.userData.originalDepthTest;
              mat.depthWrite = mat.userData.originalDepthWrite;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              if (renderSubMode === "lighting") {
                // Lighting プレビュー: 元の PBR 値を尊重（Cycles シミュレート）
                if (mat.userData.originalRoughness !== undefined) mat.roughness = mat.userData.originalRoughness;
                if (mat.userData.originalMetalness !== undefined) mat.metalness = mat.userData.originalMetalness;
              } else {
                // 通常: ソフトでクリーンな見た目
                mat.roughness = 0.8;
                mat.metalness = 0.1;
              }
              break;
            case "shaded":
            default:
              // Restore
              mat.wireframe = mat.userData.originalWireframe;
              mat.transparent = mat.userData.originalTransparent;
              mat.opacity = mat.userData.originalOpacity;
              mat.depthTest = mat.userData.originalDepthTest;
              mat.depthWrite = mat.userData.originalDepthWrite;
              if (mat.color) mat.color.setHex(mat.userData.originalColor);
              if (mat.userData.originalRoughness !== undefined) mat.roughness = mat.userData.originalRoughness;
              if (mat.userData.originalMetalness !== undefined) mat.metalness = mat.userData.originalMetalness;
              break;
          }
          
          mat.needsUpdate = true;
        });
      }
    });

  }, [scene, gl, mode, ghostOpacity, renderSubMode, envToneMapping, envExposure]);

  return null;
}


/* =========================================================
 * SingleViewportCanvas
 * ======================================================= */
export default function SingleViewportCanvas({
  viewportId,
  type,
  active = false,
  overrideSubMode,
  overrideRotOffset,
  onActivate,

  onToggleMaximize,

  isBaseReady,
  displayBaseUrl,
  pendingBaseUrl,
  onPendingLoaded,

  items = [],

  onCanvasDrop,
  onCanvasDragOver,
  allowDrop = true,
  onDeleteItems,

  lockToGround = true,
  axisConstraint = "none",
  snapEnabled = false,
  snapStep = 0.5,
  groundY = 0,

  showGizmo = false,
  gizmoMode = "translate",
  gizmoSpace = "local",

  onCommitTransform,
  onCommitTransforms,

  onChangeTransform,
  onChangeTransforms,

  onRequestNumericOpen,
  onRequestNumericClose,
  numericCloseTick = 0,

  focusTick = 0,
  frameAllTick = 0,

  speedMode = "walk",
  speedMul = 1,
  onChangeSpeedMode,
  onSpeedMulChange,

  onNavActiveChange,

  registerViewportApi,

  materialPicking = false,
  onPickMaterial,
  onGizmoHoverAxisChange,
  onRequestCopy,
  onBeginHistoryBatch,
  onEndHistoryBatch,
  onCancelHistoryBatch,
}) {
  const theme = useTheme();
  const editorMode = useEditorModeStore(state => state.editorMode);
  const globalLayoutSubMode = useEditorModeStore(state => state.layoutSubMode);
  const layoutCameraTilt = useEditorModeStore(state => state.layoutCameraTilt);
  // Ambience > Camera タブから focal length (mm) を購読し、垂直 FOV (度) に変換
  const envFocalLength = useViewportEnvStore((s) => s.focalLength);
  const envFov = useMemo(() => focalLengthToFov(envFocalLength), [envFocalLength]);

  const currentSubMode = overrideSubMode || globalLayoutSubMode;
  let effectiveSubMode = currentSubMode;
  // overrideSubMode が指定されている場合（2画面表示など）はその指定を尊重し、
  // グローバルな layoutCameraTilt による上書きを適用しない
  if (!overrideSubMode && currentSubMode === "furniture_iso") {
      if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
      else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
  }

  const isZone2D = 
    (editorMode === "zoning" && effectiveSubMode === "zone_2d") ||
    (editorMode === "layout" && (effectiveSubMode === "furniture_top" || effectiveSubMode === "ceiling_top"));
  const effectiveType = isZone2D ? VIEW_TYPES.TOP : type;

// ============================================================
  // ✁EHistory batch�E�Endo 1回＝操佁E回！E
  // - drag開始で begin
  // - commit or drag終亁E�� end�E�E重end防止�E�E
  // ============================================================
  const historyRef = useRef({ open: false, token: 0 });
  const pendingEndRef = useRef(false);

  const beginHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onBeginHistoryBatch) return;
      if (historyRef.current.open) return;
      historyRef.current.open = true;
      historyRef.current.token += 1;
      const token = historyRef.current.token;
      onBeginHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onBeginHistoryBatch, viewportId]
  );

  const endHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onEndHistoryBatch) return;
      if (!historyRef.current.open) return;
      historyRef.current.open = false;
      const token = historyRef.current.token;
      onEndHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onEndHistoryBatch, viewportId]
  );

  const cancelHistoryBatch = useCallback(
    (meta = {}) => {
      if (!onCancelHistoryBatch) return;
      if (!historyRef.current.open) return;
      historyRef.current.open = false;
      const token = historyRef.current.token;
      onCancelHistoryBatch({ source: "viewport", viewportId, token, ...meta });
    },
    [onCancelHistoryBatch, viewportId]
  );

  // ============================================================
  // ✁ECommandBar focus condition
  // ============================================================
  const commandAxis = useViewportUiStore((s) => s.commandAxis);

  // ============================================================
  // ✁EAlign tool state from store�E�Ewner/session方式！E
  // ============================================================
  const alignTick = useViewportUiStore((s) => s.alignTick);
  const alignKey = useViewportUiStore((s) => s.alignKey);
  const alignPhase = useViewportUiStore((s) => s.alignPhase);
  const alignOwnerViewportId = useViewportUiStore((s) => s.alignOwnerViewportId);
  const beginAlignSession = useViewportUiStore((s) => s.beginAlignSession);
  const endAlignSession = useViewportUiStore((s) => s.endAlignSession);
  const isAlignOwnerFn = useViewportUiStore((s) => s.isAlignOwner);

  const isAlignOwner = isAlignOwnerFn?.(viewportId) && alignPhase !== "idle";
  const setActiveViewportId = useViewportUiStore((s) => s.setActiveViewportId);
  const gizmoDraggingStore = useViewportUiStore((s) => s.gizmoDragging);
  const setGizmoHotAxisStore = useViewportUiStore((s) => s.setGizmoHotAxis);

  const suppressMarqueePointerIdRef = useRef(null);
  const gizmoDraggingRef = useRef(false);

  const { 
    selectedItemIds,
    selectedItemId,
    selectedSet,
    applySelectionIds,
    clearSelection
  } = useViewportSelection({ materialPicking });

  const { 
    rmbRef, 
    isNavActive, 
    setRmb 
  } = useRmbNav({ active, onNavActiveChange });

  const {
    shiftSnap,
    shiftSnapRef,
    getSnapActive,
    snapEngineRef,
    clearSnapLocks,
    lastSnapUiRef,
    snapAxisValue,
  } = useSnapEngine({ snapEnabled });


  // ============================================================
  // ✁EDisplay Mode
  const viewportDisplayModes = useViewportUiStore((s) => s.viewportDisplayModes);
  const setViewportDisplayMode = useViewportUiStore((s) => s.setViewportDisplayMode);
  const currentDisplayMode = viewportDisplayModes?.[viewportId] || "rendered";
  
  const layoutMode = useViewportUiStore((s) => s.layoutMode);
  const setLayoutMode = useViewportUiStore((s) => s.setLayoutMode);

  // ✁EMenu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const handleMenuClose = () => setMenuAnchorEl(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.45);
  // "standard" = 通常レンダリング / "lighting" = Lighting設定反映プレビュー
  const [renderSubMode, setRenderSubMode] = useState("standard");

  const displayModes = [
    { value: "outline", label: "ワイヤーフレーム" },
    { value: "shaded", label: "シェーディング" },
    { value: "rendered", label: "レンダリング" },
    { value: "ghosted", label: "ゴースト" },
  ];

  // ============================================================
  // ✁EregistryMap を購読
  // ============================================================
  const registryMap = useSceneObjectRegistryStore((s) => s.map);

  const objectsRef = useRef(new Map());
  useEffect(() => {
    if (registryMap && registryMap instanceof Map) objectsRef.current = registryMap;
    else objectsRef.current = new Map();
  }, [registryMap]);

  const selectedObject = useMemo(() => {
    if (!selectedItemId) return null;
    const obj = registryMap?.get(selectedItemId) || null;
    return obj;
  }, [selectedItemId, registryMap, viewportId]);

  const [alignMode, setAlignMode] = useState(null);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const isGizmoUiActiveRef = useRef(false);


  // ✁Esuppress めE“確実に解除 Eする�E�Eointerupがrootに来なぁE��ース対策！E
  useEffect(() => {
    const clear = () => {
      suppressMarqueePointerIdRef.current = null;
    };
    window.addEventListener("pointerup", clear, true);
    window.addEventListener("pointercancel", clear, true);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("pointerup", clear, true);
      window.removeEventListener("pointercancel", clear, true);
      window.removeEventListener("blur", clear);
    };
  }, []);


  // ============================================================
  // ✁ESnap candidates builder�E�※Baseはinsetではなく、他オブジェクト中忁E��寁E��る！E
  // - Baseは壁厚/床�E作りが多様なので bbox候補�E誤誘導しめE��ぁE
  // - 壁制紁E�E follower 側の Raycast(法線フィルタ)で行う
  // ============================================================
  const rootRef = useRef(null);
  const orbitRef = useRef(null);
  const baseRootRef = useRef(null);
  const baseCollidersRef = useRef([]);

  // ── layoutSceneRef をアクティブな viewport に向け直す ──────────
  // MultiViewportTiled は全 viewport を同時マウント（CSS display:none）するため
  // 最後にマウントされた canvas が onCreated を上書きしてしまう。
  // active prop が true になったタイミングで再登録することで正しい viewport を参照させる。
  const glRef    = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    layoutSceneRef.getCameraState = () => {
      const controls = orbitRef.current;
      if (!controls) return null;
      const cam = controls.object;
      if (!cam) return null;
      const fov = cam.isPerspectiveCamera ? cam.fov : 50;
      return {
        position: [cam.position.x, cam.position.y, cam.position.z],
        target:   [controls.target.x, controls.target.y, controls.target.z],
        fov,
      };
    };
    if (glRef.current)    layoutSceneRef.gl    = glRef.current;
    if (sceneRef.current) layoutSceneRef.scene = sceneRef.current;
  }, [active]);

  const baseBoundsRef = useRef(null);
  const didInitCameraRef = useRef(false);
  

  useEffect(() => {
    didInitCameraRef.current = false;
    baseBoundsRef.current = null;
  }, [displayBaseUrl, effectiveType]);

  const frameCameraToBase = useCallback(
    ({ force = false } = {}) => {
      const b = baseBoundsRef.current;
      const controls = orbitRef.current;
      if (!b || !controls) return;
      if (!force && didInitCameraRef.current) return;

      const cam = controls.object;
      if (!cam) return;

      const center = b.center;
      const maxDim = b.maxDim;
      const dir = new THREE.Vector3(1, 0.85, 1).normalize();
      const dist = Math.max(8, maxDim * 1.6);

      controls.target.copy(center);

      if (effectiveType === VIEW_TYPES.PERSPECTIVE) {
        cam.position.copy(center).addScaledVector(dir, dist);
        cam.near = Math.max(0.01, dist / 200);
        cam.far = Math.max(2000, dist * 50);
        cam.updateProjectionMatrix();
        controls.update();
        didInitCameraRef.current = true;
        return;
      }

      const orthoDist = Math.max(20, maxDim * 1.2);
      if (effectiveType === VIEW_TYPES.TOP) {
        cam.position.set(center.x, center.y + orthoDist, center.z);
        cam.up.set(0, 0, -1);
      } else if (effectiveType === VIEW_TYPES.FRONT) {
        cam.position.set(center.x, center.y, center.z + orthoDist);
        cam.up.set(0, 1, 0);
      } else if (effectiveType === VIEW_TYPES.RIGHT) {
        cam.position.set(center.x + orthoDist, center.y, center.z);
        cam.up.set(0, 1, 0);
      }

      const frustumW = Math.abs(cam.right - cam.left);
      const frustumH = Math.abs(cam.top - cam.bottom);
      const pad = 1.15;
      
      // If frustum is ready (not 0), update zoom to frame the object
      if (frustumW > 0 && frustumH > 0 && maxDim > 0) {
        const nextZoom = Math.max(0.01, Math.min(frustumW, frustumH) / (maxDim * pad));
        cam.zoom = nextZoom;
      }

      cam.lookAt(center);
      cam.updateProjectionMatrix();
      controls.update();
      didInitCameraRef.current = true;
    },
    [effectiveType]
  );

  const previousEffectiveTypeRef = useRef(effectiveType);
  useEffect(() => {
    if (previousEffectiveTypeRef.current !== effectiveType) {
      previousEffectiveTypeRef.current = effectiveType;
      // Reset initialization when switching camera types so it forces framing
      didInitCameraRef.current = false;
      requestAnimationFrame(() => frameCameraToBase({ force: true }));
    }
  }, [effectiveType, frameCameraToBase]);

  const handleBaseLoaded = useCallback(
    (payload) => {
      if (!payload) {
        baseRootRef.current = null;
        baseCollidersRef.current = [];
        useSceneObjectRegistryStore.getState().setBaseColliders([]);
        baseBoundsRef.current = null;
        didInitCameraRef.current = false;
        return;
      }

      const rootGroup = payload.root || null;
      baseRootRef.current = rootGroup;
      layoutSceneRef.baseRoot = rootGroup; // サムネイルフレーミング用

      const baseMeshes = payload?.snap?.baseMeshes;
      baseCollidersRef.current = Array.isArray(baseMeshes) ? baseMeshes : [];
      useSceneObjectRegistryStore.getState().setBaseColliders(baseCollidersRef.current);

      if (!rootGroup) return;

      const box = new THREE.Box3().setFromObject(rootGroup);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      if (Number.isFinite(maxDim) && maxDim > 0) {
        baseBoundsRef.current = { box, center, size, maxDim };
        requestAnimationFrame(() => frameCameraToBase());
      }
    },
    [frameCameraToBase]
  );

  const normalizedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.map((it, idx) => ({
      ...it,
      id: it?.id || it?.itemId || it?.modelId || `${it?.modelId || "item"}_${idx}`,
    }));
  }, [items]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return normalizedItems.find((x) => x.id === selectedItemId) || null;
  }, [normalizedItems, selectedItemId]);

  const currentPos = useMemo(() => {
    const p = selectedItem?.transform?.position || [0, 0.3, 0];
    return [p[0] ?? 0, p[1] ?? 0.3, p[2] ?? 0];
  }, [selectedItem]);

  const alignSelectedIds = useMemo(() => {
    const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
    if (ids.length > 0) return ids;
    return selectedItemId ? [selectedItemId] : [];
  }, [selectedItemIds, selectedItemId]);

  const alignSelectedObjects = useMemo(() => {
    const out = [];
    const map = registryMap;
    if (!map) return out;
    for (const id of alignSelectedIds) {
      const obj = map.get(id);
      if (obj) out.push({ itemId: id, object: obj });
    }
    return out;
  }, [alignSelectedIds, registryMap]);

  const stopAlignLocal = useCallback(() => {
    setAlignMode(null);
    clearSnapLocks();
  }, [clearSnapLocks]);

  const endAlign = useCallback(() => {
    stopAlignLocal();
    endAlignSession?.();
  }, [stopAlignLocal, endAlignSession]);

  // ✁EAlignキャンセル用�E�開始時点のTransformスナップショチE��
  const alignSnapshotRef = useRef(null);

  // ✁EAlignキャンセル中�E�Followerを止めるフラグ
  const alignAbortRef = useRef(false);

  const takeAlignSnapshot = useCallback(() => {
    const snap = {};
    const list = Array.isArray(alignSelectedObjects) ? alignSelectedObjects : [];
    for (const it of list) {
      const obj = it?.object;
      if (!obj) continue;
      obj.updateMatrixWorld?.(true);
      snap[it.itemId] = {
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      };
    }
    alignSnapshotRef.current = snap;
  }, [alignSelectedObjects]);

  const clearAlignSnapshot = useCallback(() => {
    alignSnapshotRef.current = null;
  }, []);

  const cancelAlign = useCallback(() => {
    alignAbortRef.current = true;

    stopAlignLocal();
    endAlignSession?.();
    cancelHistoryBatch({ kind: "align-cancel" });

    requestAnimationFrame(() => {
      const snap = alignSnapshotRef.current;

      if (!snap) {
        alignAbortRef.current = false;
        return;
      }

      for (const [itemId, t] of Object.entries(snap)) {
        const obj = registryMap?.get(itemId);
        if (!obj) continue;
        obj.position.set(...t.position);
        obj.rotation.set(...t.rotation);
        obj.scale.set(...t.scale);
        obj.updateMatrixWorld?.(true);
      }

      const updates = Object.entries(snap).map(([itemId, t]) => ({
        itemId,
        transform: { position: t.position, rotation: t.rotation, scale: t.scale },
      }));

      if (updates.length > 1 && typeof onChangeTransforms === "function") onChangeTransforms(updates);
      else if (updates.length === 1 && typeof onChangeTransform === "function") onChangeTransform(updates[0]);

      alignSnapshotRef.current = null;
      alignAbortRef.current = false;
    });
  }, [stopAlignLocal, endAlignSession, registryMap, onChangeTransform, onChangeTransforms, cancelHistoryBatch]);

  const commitAlign = useCallback(() => {
    if (!isAlignOwner) return;
    if (!selectedItemId || !selectedObject) return;
    if (!alignMode) return;

    // ✁Eこれが重要E��確定クリチE��した瞬間に follower を止める
    // �E�EetAlignMode(null) は非同期なので、Eフレームでも動くとズレの原因になる！E
    alignAbortRef.current = true;

    // ============================================================
    // ✁EクリチE��時にズレなぁE��ぁE��最終アンカーへ強制確定」してから commit
    // - SmoothAlignFollower ぁEclamp後�E targetAnchor めEsnapFinalAnchorRef に保存してぁE��前提
    // - ここでは damping を無視して“一発確定”させる
    // ============================================================
    const fin = snapFinalAnchorRef.current;
    const axis = fin?.axis;
    const anchor = fin?.anchor;
    const snapOn = !!fin?.snapActive;

    const canForce =
      snapOn &&
      (axis === "x" || axis === "y" || axis === "z") &&
      Number.isFinite(anchor);

    if (canForce) {
      const offsets = alignMode?.itemOffsets || {};
      const baseOff = Number.isFinite(alignMode?.offset) ? alignMode.offset : 0;

      for (const it of alignSelectedObjects) {
        const obj = it?.object;
        if (!obj) continue;

        const off = Number.isFinite(offsets[it.itemId]) ? offsets[it.itemId] : baseOff;
        const pos = anchor + off;

        if (axis === "x") obj.position.x = pos;
        if (axis === "y") obj.position.y = pos;
        if (axis === "z") obj.position.z = pos;

        obj.updateMatrixWorld?.(true);
      }
    } else {
      // snapOff の場合でも最新にしておく
      for (const it of alignSelectedObjects) it?.object?.updateMatrixWorld?.(true);
    }

    // ============================================================
    // ✁EMulti commit
    // ============================================================
    if (alignSelectedObjects.length > 1 && typeof onCommitTransforms === "function") {
      const updates = alignSelectedObjects.map((it) => {
        const obj = it.object;
        return {
          itemId: it.itemId,
          transform: {
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          },
        };
      });

      onCommitTransforms(updates);
      endHistoryBatch({ kind: "align" });
      clearAlignSnapshot();
      endAlign();
      return;
    }

    // ============================================================
    // ✁ESingle commit
    // - 回転/スケールは items の値を保持�E�Elignは移動だけ！E
    // ============================================================
    const p = selectedObject.position;

    onCommitTransform?.({
      itemId: selectedItemId,
      transform: {
        position: [p.x, p.y, p.z],
        rotation: selectedItem?.transform?.rotation,
        scale: selectedItem?.transform?.scale,
      },
    });

    endHistoryBatch({ kind: "align" });
    clearAlignSnapshot();
    endAlign();
    // ✁E次フレームで解除�E�Eommit後�E Align セチE��ョン自体が終わってる�Eで安�E�E�E
    requestAnimationFrame(() => {
      alignAbortRef.current = false;
    });
    
  }, [
    isAlignOwner,
    selectedItemId,
    selectedObject,
    alignMode,
    alignSelectedObjects,
    onCommitTransforms,
    onCommitTransform,
    clearAlignSnapshot,
    endAlign,
    selectedItem?.transform?.rotation,
    selectedItem?.transform?.scale,
    endHistoryBatch,
  ]);



  // ============================================================
  // ✁Ecandidates�E�他オブジェクト�E min/max/center は残す�E�E
  // - Base由来の「�E側bbox」候補�E廁E���E�壁厚・床形状の差で誤誘導するためE��E
  // - 壁�E“�E側/外�E”�E follower の Raycast(法緁E で解決
  // ============================================================
  const buildSnapCandidatesAllAxes = useCallback(() => {
    const out = { x: [], y: [], z: [], walls: { x: [], y: [], z: [] } };

    const pushFromBoxTo = (box, dst) => {
      if (!box || box.isEmpty()) return;
      const center = new THREE.Vector3();
      box.getCenter(center);

      dst.x.push(box.min.x, box.max.x, center.x);
      dst.y.push(box.min.y, box.max.y, center.y);
      dst.z.push(box.min.z, box.max.z, center.z);
    };

    // ✁Ebase は walls bucket へ
    if (baseRootRef.current) {
      const outer = new THREE.Box3().setFromObject(baseRootRef.current);
      pushFromBoxTo(outer, out.walls);
    }

    // ✁E他オブジェクト�E通常 bucket
    const map = objectsRef.current;
    map?.forEach?.((obj, id) => {
      if (!obj) return;
      if (id === selectedItemId) return;
      const b = new THREE.Box3().setFromObject(obj);
      pushFromBoxTo(b, out);
    });

    const uniqAxis = (arr) => {
      const uniq = [];
      const eps = 1e-4;
      for (const v of arr) {
        if (!Number.isFinite(v)) continue;
        if (!uniq.some((u) => Math.abs(u - v) < eps)) uniq.push(v);
      }
      return uniq;
    };

    out.x = uniqAxis(out.x);
    out.y = uniqAxis(out.y);
    out.z = uniqAxis(out.z);

    out.walls.x = uniqAxis(out.walls.x);
    out.walls.y = uniqAxis(out.walls.y);
    out.walls.z = uniqAxis(out.walls.z);

    return out;
  }, [selectedItemId]);



  // ============================================================
  // ✁EAlign: 軸決宁E
  // ============================================================
  const getAxisByKeyForView = useCallback(
    (key) => {
      const isTopLike = type === VIEW_TYPES.TOP || type === VIEW_TYPES.PERSPECTIVE;

      if (isTopLike) {
        if (key === "left" || key === "right" || key === "vcenter") return "x";
        return "z";
      }

      if (type === VIEW_TYPES.FRONT) {
        if (key === "left" || key === "right" || key === "vcenter") return "x";
        return "y";
      }

      if (type === VIEW_TYPES.RIGHT) {
        if (key === "left" || key === "right" || key === "vcenter") return "z";
        return "y";
      }

      return null;
    },
    [type]
  );

  const getAnchorKind = useCallback((key) => {
    if (key === "left" || key === "top") return "min";
    if (key === "right" || key === "bottom") return "max";
    return "center";
  }, []);

  const beginAlignLocal = useCallback(
    (key) => {
      if (!selectedItemId || !selectedObject) return false;

      alignAbortRef.current = false;

      const axis = getAxisByKeyForView(key);
      if (axis !== "x" && axis !== "y" && axis !== "z") return false;

      const anchorKind = getAnchorKind(key);

      selectedObject.updateMatrixWorld?.(true);

      const box = new THREE.Box3().setFromObject(selectedObject);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const p = selectedObject.position;
      const posAxis = axis === "x" ? p.x : axis === "y" ? p.y : p.z;

      const anchorAxis =
        anchorKind === "min"
          ? axis === "x"
            ? box.min.x
            : axis === "y"
              ? box.min.y
              : box.min.z
          : anchorKind === "max"
            ? axis === "x"
              ? box.max.x
              : axis === "y"
                ? box.max.y
                : box.max.z
            : axis === "x"
              ? center.x
              : axis === "y"
                ? center.y
                : center.z;

      const offset = posAxis - anchorAxis;

      let groupBoundsOffsets = null;
      if (alignSelectedObjects.length > 1 && (axis === "x" || axis === "z")) {
        const groupBox = new THREE.Box3();
        for (const it of alignSelectedObjects) {
          const obj = it.object;
          if (!obj) continue;
          obj.updateMatrixWorld?.(true);
          groupBox.union(new THREE.Box3().setFromObject(obj));
        }
        if (!groupBox.isEmpty()) {
          if (axis === "x") {
            groupBoundsOffsets = {
              minX: p.x - groupBox.min.x,
              maxX: p.x - groupBox.max.x,
              minZ: 0,
              maxZ: 0,
            };
          } else {
            groupBoundsOffsets = {
              minX: 0,
              maxX: 0,
              minZ: p.z - groupBox.min.z,
              maxZ: p.z - groupBox.max.z,
            };
          }
        }
      }

      let planeNormal = new THREE.Vector3(0, 1, 0);
      let planeConstant = -groundY;

      if (type === VIEW_TYPES.FRONT) {
        const planeZ = p.z;
        planeNormal = new THREE.Vector3(0, 0, 1);
        planeConstant = -planeZ;
      } else if (type === VIEW_TYPES.RIGHT) {
        const planeX = p.x;
        planeNormal = new THREE.Vector3(1, 0, 0);
        planeConstant = -planeX;
      } else {
        planeNormal = new THREE.Vector3(0, 1, 0);
        planeConstant = -groundY;
      }

      // ✁ESnap reset + candidates set
      clearSnapLocks();

      if (getSnapActive()) {
        const cands = buildSnapCandidatesAllAxes();
        snapEngineRef.current?.setCandidatesAll?.(cands);
        console.log("[snap candidates]", cands);
      } else {
        snapEngineRef.current?.setCandidatesAll?.({ x: [], y: [], z: [] });
      }

      const itemOffsets = {};
      for (const it of alignSelectedObjects) {
        const obj = it.object;
        if (!obj) continue;

        obj.updateMatrixWorld?.(true);
        const box = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const p2 = obj.position;
        const posAxis2 = axis === "x" ? p2.x : axis === "y" ? p2.y : p2.z;
        const anchorAxis2 =
          anchorKind === "min"
            ? axis === "x"
              ? box.min.x
              : axis === "y"
                ? box.min.y
                : box.min.z
            : anchorKind === "max"
              ? axis === "x"
                ? box.max.x
                : axis === "y"
                  ? box.max.y
                  : box.max.z
              : axis === "x"
                ? center.x
                : axis === "y"
                  ? center.y
                  : center.z;

        itemOffsets[it.itemId] = posAxis2 - anchorAxis2;
      }

      takeAlignSnapshot();

      setAlignMode({
        key,
        axis,
        offset,
        planeNormal,
        planeConstant,
        groupBoundsOffsets,
        itemOffsets,
      });

      beginHistoryBatch({ kind: "align" });
      
      return true;
    },
    [
      selectedItemId,
      selectedObject,
      type,
      groundY,
      getAxisByKeyForView,
      getAnchorKind,
      clearSnapLocks,
      getSnapActive,
      buildSnapCandidatesAllAxes,
      alignSelectedObjects,
      takeAlignSnapshot,
      beginHistoryBatch,
    ]
  );

  // ✁EAlignイベント消費�E�owner canvas だけが開始すめE
  const lastAlignTickRef = useRef(0);
  useEffect(() => {
    if (!alignTick || alignTick === lastAlignTickRef.current) return;
    lastAlignTickRef.current = alignTick;

    if (!alignKey) return;
    if (alignOwnerViewportId !== viewportId) return;

    if (materialPicking || isGizmoDragging) {
      endAlignSession?.();
      stopAlignLocal();
      return;
    }

    if (!selectedItemId || !selectedObject) {
      endAlignSession?.();
      stopAlignLocal();
      return;
    }

    beginAlignSession?.({ viewportId });
    setActiveViewportId?.(viewportId);
    if (!active) onActivate?.(viewportId);

    const ok = beginAlignLocal(alignKey);
    if (!ok) {
      endAlignSession?.();
      stopAlignLocal();
    }
  }, [
    alignTick,
    alignKey,
    alignOwnerViewportId,
    viewportId,
    beginAlignSession,
    endAlignSession,
    materialPicking,
    isGizmoDragging,
    active,
    onActivate,
    beginAlignLocal,
    selectedItemId,
    selectedObject,
    stopAlignLocal,
    setActiveViewportId,
  ]);

  const requestCopy = useCallback(() => {
    onRequestCopy?.({ offset: [0.2, 0, 0.2] });
  }, [onRequestCopy]);

  const requestMirror = useCallback(({ axis }) => {
    console.log("[mirror]", axis);
  }, []);

  // ============================================================
  // ✁EregisterViewportApi: 登録は1回だけ。中身はrefで最新匁E
  // ============================================================
  const activeRef = useRef(active);
  const onActivateRef = useRef(onActivate);
  const beginAlignLocalRef = useRef(beginAlignLocal);
  const requestCopyRef = useRef(requestCopy);
  const requestMirrorRef = useRef(requestMirror);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    onActivateRef.current = onActivate;
  }, [onActivate]);
  useEffect(() => {
    beginAlignLocalRef.current = beginAlignLocal;
  }, [beginAlignLocal]);
  useEffect(() => {
    requestCopyRef.current = requestCopy;
  }, [requestCopy]);
  useEffect(() => {
    requestMirrorRef.current = requestMirror;
  }, [requestMirror]);

  useEffect(() => {
    if (!registerViewportApi) return;

    const api = {
      align: (key) => {
        if (!activeRef.current) onActivateRef.current?.(viewportId);
        beginAlignLocalRef.current?.(key);
      },
      requestCopy: (...args) => requestCopyRef.current?.(...args),
      requestMirror: (...args) => requestMirrorRef.current?.(...args),
    };

    registerViewportApi(viewportId, api);
    return () => registerViewportApi(viewportId, null);
  }, [registerViewportApi, viewportId]);

  const speedPreset = useMemo(() => {
    const presets = {
      inspect: { move: 300.0, vertical: 300.0 }, // 1.2 -> 50 -> 300
      walk: { move: 1200.0, vertical: 1200.0 }, // 3.0 -> 200 -> 1200
      cycle: { move: 4800.0, vertical: 3600.0 }, // 7.0 -> 800 -> 4800
      drive: { move: 12000.0, vertical: 9000.0 }, // 14.0 -> 2000 -> 12000
      fly: { move: 30000.0, vertical: 18000.0 }, // 28.0 -> 5000 -> 30000
    };
    return presets[speedMode] || presets.walk;
  }, [speedMode]);

  const isOrtho = effectiveType !== VIEW_TYPES.PERSPECTIVE;
  const selectionScope = useSelectionScopeStore((s) => s.scope);
  const marqueeEnabled =
    active &&
    !alignMode &&
    !isGizmoDragging &&
    !gizmoDraggingStore &&
    !materialPicking &&
    canSelectItem(selectionScope);

  const { handlers, marqueeRect, isMarqueeActive, cancel: cancelMarquee } = useMarqueeSelection({
    enabled: marqueeEnabled,
    rootRef,
    orbitRef,
    objectsRef,
    
    getIsBlocked: () => {
      const st = useViewportUiStore.getState?.();
      return !!(
        suppressMarqueePointerIdRef.current != null ||
        st?.gizmoInteracting ||
        st?.gizmoDragging ||
        gizmoDraggingRef.current ||
        isGizmoDragging
      );
    },

    onPickIds: (ids, e) => {
      if (!active) return;
      applySelectionIds(ids, e, "marquee");
    },
    onPickId: (id, e) => {
      if (!active) return;
      applySelectionIds(id ? [id] : [], e, "marquee");
    },
  });

  useEffect(() => {
    if (isGizmoDragging || isGizmoUiActiveRef.current || materialPicking) cancelMarquee?.();
  }, [isGizmoDragging, materialPicking, cancelMarquee]);

  const ortho = useMemo(() => (isOrtho ? getOrthoPreset(effectiveType) : null), [isOrtho, effectiveType]);

  const label =
    type === VIEW_TYPES.TOP
      ? "Top"
      : type === VIEW_TYPES.FRONT
        ? "Front"
        : type === VIEW_TYPES.RIGHT
          ? "Right"
          : "Perspective";

  // =========================
  // Numeric apply / Gizmo / etc…
  // =========================
  const readTransformFromObj = useCallback((obj) => {
    if (!obj) return null;
    obj.updateMatrixWorld?.(true);
    return {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
  }, []);

  const getAxisVec = useCallback((axis) => {
    if (axis === "X") return new THREE.Vector3(1, 0, 0);
    if (axis === "Y") return new THREE.Vector3(0, 1, 0);
    if (axis === "Z") return new THREE.Vector3(0, 0, 1);
    return null;
  }, []);

  const getSelectedIds = useCallback(() => {
    const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
    if (ids.length > 0) return ids;
    return selectedItemId ? [selectedItemId] : [];
  }, [selectedItemIds, selectedItemId]);

  const gizmoMultiSnapshotRef = useRef(null);
  const lastStateUpdateTimeRef = useRef(0);

  const emitTransformUpdates = useCallback(
    (updates, { commit = false } = {}) => {
      if (!Array.isArray(updates) || updates.length === 0) return;

      if (updates.length > 1) {
        if (commit) {
          if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          else updates.forEach((u) => onCommitTransform?.(u));
        } else {
          // Optimization: React state is NOT synchronized during dragging (commit=false).
          // TransformGizmo mutates the three.js mesh directly. Doing full React updates
          // per-frame on large layouts causes severe lag.
        }
        return;
      }

      if (commit) {
        onCommitTransform?.(updates[0]);
      } else {
        // Same optimization for single object dragging.
      }
    },
    [onCommitTransform, onCommitTransforms, onChangeTransform, onChangeTransforms]
  );

  const beginGizmoMultiSnapshot = useCallback(() => {
    const ids = getSelectedIds();
    if (ids.length < 2) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    const snapMap = new Map();
    ids.forEach((id) => {
      const obj = objectsRef.current.get(id);
      if (!obj) return;
      snapMap.set(id, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
        scale: obj.scale.clone(),
      });
    });

    if (snapMap.size < 2) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    // Gizmoが実際に掴んでぁE�� selectedObject から基準IDを解決する
    let primaryId = null;
    if (selectedObject) {
      for (const id of ids) {
        const obj = objectsRef.current.get(id);
        if (obj && obj === selectedObject) {
          primaryId = id;
          break;
        }
      }
    }
    if (!primaryId && selectedItemId && snapMap.has(selectedItemId)) {
      primaryId = selectedItemId;
    }
    if (!primaryId) {
      primaryId = snapMap.keys().next().value || null;
    }

    const primaryBase = primaryId ? snapMap.get(primaryId) : null;
    if (!primaryBase) {
      gizmoMultiSnapshotRef.current = null;
      return;
    }

    gizmoMultiSnapshotRef.current = {
      primaryId,
      mode: gizmoMode,
      map: snapMap,
      primaryBasePos: primaryBase.position.clone(),
      primaryBaseQuat: primaryBase.quaternion.clone(),
      primaryBaseScale: primaryBase.scale.clone(),
    };
  }, [getSelectedIds, selectedItemId, selectedObject, gizmoMode]);

  const applyGizmoMultiDelta = useCallback(
    ({ commit = false } = {}) => {
      const snap = gizmoMultiSnapshotRef.current;
      if (!snap || !snap.map || snap.map.size < 2) return false;

      const primaryObj = objectsRef.current.get(snap.primaryId);
      if (!primaryObj) return false;

      const mode = snap.mode || gizmoMode;

      if (mode === "translate") {
        const delta = primaryObj.position.clone().sub(snap.primaryBasePos);
        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.position.copy(base.position).add(delta);
          obj.updateMatrixWorld?.(true);
        });
      } else if (mode === "rotate") {
        const qDelta = snap.primaryBaseQuat.clone().invert().multiply(primaryObj.quaternion);
        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.quaternion.copy(base.quaternion).multiply(qDelta);
          obj.updateMatrixWorld?.(true);
        });
      } else if (mode === "scale") {
        const ratioX =
          Math.abs(snap.primaryBaseScale.x) > 1e-8 ? primaryObj.scale.x / snap.primaryBaseScale.x : 1;
        const ratioY =
          Math.abs(snap.primaryBaseScale.y) > 1e-8 ? primaryObj.scale.y / snap.primaryBaseScale.y : 1;
        const ratioZ =
          Math.abs(snap.primaryBaseScale.z) > 1e-8 ? primaryObj.scale.z / snap.primaryBaseScale.z : 1;

        snap.map.forEach((base, id) => {
          if (id === snap.primaryId) return;
          const obj = objectsRef.current.get(id);
          if (!obj) return;
          obj.scale.set(base.scale.x * ratioX, base.scale.y * ratioY, base.scale.z * ratioZ);
          obj.updateMatrixWorld?.(true);
        });
      }

      const updates = [];
      snap.map.forEach((_, id) => {
        const obj = objectsRef.current.get(id);
        const t = readTransformFromObj(obj);
        if (!t) return;
        updates.push({ itemId: id, transform: t });
      });

      emitTransformUpdates(updates, { commit });
      return true;
    },
    [gizmoMode, readTransformFromObj, emitTransformUpdates]
  );

  const handleSelectFurniture = useCallback(
    (id, e) => {
      if (!active) return;
      if (materialPicking) return;
      applySelectionIds(id ? [id] : [], e?.nativeEvent ?? e, "click");
    },
    [active, materialPicking, applySelectionIds]
  );

  const handleGizmoPreview = useCallback(
    (t) => {
      if (applyGizmoMultiDelta({ commit: false })) return;
      if (!selectedItemId || !t) return;
      // Optimization: React state is NOT synchronized during dragging.
      // onChangeTransform?.({ itemId: selectedItemId, transform: t });
    },
    [applyGizmoMultiDelta, onChangeTransform, selectedItemId]
  );

  const handleGizmoCommit = useCallback(
    (t) => {
      const handledMulti = applyGizmoMultiDelta({ commit: true });
      gizmoMultiSnapshotRef.current = null;
      if (handledMulti) return;
      if (!selectedItemId || !t) return;
      onCommitTransform?.({ itemId: selectedItemId, transform: t });
    },
    [applyGizmoMultiDelta, onCommitTransform, selectedItemId]
  );

  const applyNumericToObjects = useCallback(
    ({ axis, mode, space, raw }) => {
      let s = String(raw ?? "").trim();
      // 全角数字を半角に変換
      s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      // 全角マイナス/ハイフンを半角マイナスに変換
      s = s.replace(/[ー－−-]/g, "-");
      
      const n = Number(s);
      
      console.log("[applyNumericToObjects] Extracted:", { axis, mode, space, raw, parsedNumber: n });
      
      if (!Number.isFinite(n)) return;

      const ids = getSelectedIds();
      if (ids.length === 0) return;

      const targets = ids.map((id) => ({ id, obj: objectsRef.current.get(id) })).filter((x) => !!x.obj);
      if (targets.length === 0) return;

      const ax = getAxisVec(axis);
      const isXYZ = axis === "XYZ";

      if (mode === "translate") {
        if (!ax) return;
        const dist = n / 1000; // MM -> M
        targets.forEach(({ obj }) => {
          const axisWorld = ax.clone();
          const deltaWorld = axisWorld.clone().multiplyScalar(dist);
          
          if (space === "local") {
            const objWorldQuat = new THREE.Quaternion();
            obj.getWorldQuaternion(objWorldQuat);
            deltaWorld.copy(axisWorld).applyQuaternion(objWorldQuat).multiplyScalar(dist);
          }
          
          const parent = obj.parent;
          const parentWorldQuat = new THREE.Quaternion();
          if (parent) parent.getWorldQuaternion(parentWorldQuat);
          else parentWorldQuat.identity();
          
          const deltaLocal = deltaWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
          obj.position.add(deltaLocal);
          obj.updateMatrixWorld?.(true);
        });
      }

      if (mode === "rotate") {
        if (!ax) return;
        const rad = THREE.MathUtils.degToRad(n);
        targets.forEach(({ obj }) => {
          const axisN = ax.clone().normalize();
          if (space === "world") obj.rotateOnWorldAxis(axisN, rad);
          else obj.rotateOnAxis(axisN, rad);
          obj.updateMatrixWorld?.(true);
        });
      }

      if (mode === "scale") {
        const f = n;
        if (!Number.isFinite(f) || f === 0) return;
        targets.forEach(({ obj }) => {
          if (isXYZ) obj.scale.multiplyScalar(f);
          else {
            if (axis === "X") obj.scale.x *= f;
            if (axis === "Y") obj.scale.y *= f;
            if (axis === "Z") obj.scale.z *= f;
          }
        });
      }

      const updates = targets
        .map(({ id, obj }) => {
          const t = readTransformFromObj(obj);
          if (!t) return null;

          let nextT = t;
          if (type === VIEW_TYPES.TOP) {
            nextT = optimizeTopPlacement({
              transform: nextT,
              currentPos,
              lockToGround,
              groundY,
              axisConstraint,
              snapEnabled,
              snapStep,
            });
            obj.position.fromArray(nextT.position);
            obj.rotation.set(...nextT.rotation);
            obj.scale.fromArray(nextT.scale);
          }
          return { itemId: id, transform: nextT };
        })
        .filter(Boolean);

      if (updates.length === 0) return;

      if (updates.length > 1 && typeof onCommitTransforms === "function") onCommitTransforms(updates);
      else onCommitTransform?.(updates[0]);
    },
    [
      getSelectedIds,
      getAxisVec,
      readTransformFromObj,
      type,
      currentPos,
      lockToGround,
      groundY,
      axisConstraint,
      snapEnabled,
      snapStep,
      onCommitTransform,
      onCommitTransforms,
    ]
  );

  const handleNumericOpenFromGizmo = useCallback(
    ({ axis, mode, space }) => {
      isGizmoUiActiveRef.current = !!axis;

      onRequestNumericOpen?.({
        axis,
        mode,
        space,
        autoFocus: true,

        applyNumeric: ({ axis: a, raw }) => {
          // ✁ENumeric も、E操作＝Undo1回、E
          beginHistoryBatch({ kind: "numeric", mode: mode || gizmoMode });
          // ✁E数値入力も、E操作」として扱ぁE��Eulti snapshot / marquee抑止�E�E
          // 1) suppress + marquee cancel
          suppressMarqueePointerIdRef.current = "gizmo";
          cancelMarquee?.();

          // 2) multi snapshot begin�E�褁E��選択時だけ有効�E�E
          beginGizmoMultiSnapshot();

          // 3) apply
          applyNumericToObjects({
            axis: a || axis,
            mode: mode || gizmoMode,
            space: space || gizmoSpace,
            raw,
          });

          // 4) snapshot end
          gizmoMultiSnapshotRef.current = null;

          endHistoryBatch({ kind: "numeric", mode: mode || gizmoMode });

          // ✁Enumeric入力直後に抑止を即解除すると、直後�EクリチE��で marquee が誤作動しやすいので
          // 1フレーム遁E��せて解除
          requestAnimationFrame(() => {
            if (suppressMarqueePointerIdRef.current === "gizmo") {
              suppressMarqueePointerIdRef.current = null;
            }
          });
        },
      });

      // Hover直後に即入力できるよう、CommandBarへフォーカスを強制
      try {
        const api = useViewportUiStore.getState?.().toolbarApi;
        api?.focusCommand?.({ select: true });
        queueMicrotask(() => api?.focusCommand?.({ select: true }));
        requestAnimationFrame(() => api?.focusCommand?.({ select: true }));
      } catch {}
    },
    [
      onRequestNumericOpen,
      applyNumericToObjects,
      gizmoMode,
      gizmoSpace,
      beginGizmoMultiSnapshot,
      cancelMarquee,
      beginHistoryBatch,
      endHistoryBatch,
    ]
  );

  const handleNumericCloseFromGizmo = useCallback(() => {
    isGizmoUiActiveRef.current = false;
    onRequestNumericClose?.();

    // Gizmoのnumeric終亁E���E入力フォーカスを外し、WASDQE系のNavを復帰させめE
    try {
      useViewportUiStore.getState?.().blurCommandBar?.();
    } catch {}
  }, [onRequestNumericClose]);

  // ✁EESC でコマンドキャンセル�E�Elign / Gizmo UI / Marquee / RMB nav�E�E
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      if (alignMode || (alignPhase && alignPhase !== "idle")) {
        e.preventDefault();
        e.stopPropagation();
        cancelAlign();
        return;
      }

      if (isGizmoUiActiveRef.current) {
        e.preventDefault();
        e.stopPropagation();
        handleNumericCloseFromGizmo?.();
        return;
      }

      if (isMarqueeActive) {
        e.preventDefault();
        e.stopPropagation();
        cancelMarquee?.();
        return;
      }

      if (rmbRef.current) {
        e.preventDefault();
        e.stopPropagation();
        setRmb(false);
        return;
      }

      const activeZoneId = useLayoutTaskStore.getState().activeZoneId;
      if (selectedItemIds.length > 0 || activeZoneId) {
        e.preventDefault();
        e.stopPropagation();
        clearSelection();
        useLayoutTaskStore.getState().setActiveZoneId(null);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    active,
    alignMode,
    alignPhase,
    handleNumericCloseFromGizmo,
    isMarqueeActive,
    cancelMarquee,
    setRmb,
    cancelAlign,
    selectedItemIds,
    clearSelection,
  ]);

  useEffect(() => {
    isGizmoUiActiveRef.current = false;
  }, [numericCloseTick]);

  const showGizmoSafe = showGizmo && !alignMode && !materialPicking;
  const allowDropSafe = allowDrop && !materialPicking;
  const pointerMissedEnabled = !materialPicking;

  // Track right-click position to distinguish between click and drag
  const rightClickStartRef = useRef(null);

  // ✁EAlign用E最後EガイチEドット表示位置Eワールド座標！E
  const snapDotRef = useRef(null);
  const snapGuideValueRef = useRef(null);

  // ✁EAlign用E最後Eマウス位置EEDCEE
  const lastAlignNdcRef = useRef({ x: 0, y: 0, t: 0 });

  const chipLabel = useMemo(() => {
    let label = String(type).charAt(0).toUpperCase() + String(type).slice(1);
    if (editorMode === "layout" || editorMode === "zoning") {
      if (effectiveSubMode === "furniture_top") label = "Layout / Top";
      else if (effectiveSubMode === "furniture_iso") label = "Layout / Perspective";
      else if (effectiveSubMode === "zone_2d") label = "2D Plan";
    }
    if (materialPicking) return `${label} • Material Pick`;


    if (isAlignOwner && alignMode) {
      const ax = String(alignMode.axis || "").toLowerCase();
      const shown = lastSnapUiRef.current?.[ax] ?? null;
      const txt =
        Number.isFinite(shown)
          ? ` • Snap ${ax.toUpperCase()}=${shown.toFixed(3)}`
          : getSnapActive?.()
            ? " • Snap ON"
            : "";

      return `${label} • Align (${alignMode.key})${txt}`;
    }

    return label;
  }, [materialPicking, type, isAlignOwner, alignMode, getSnapActive, editorMode, overrideSubMode, globalLayoutSubMode, overrideRotOffset]);

  // ✁EAlign中に Snap ON/OFF がEり替わったら candidates をE構篁E
  useEffect(() => {
    if (!alignMode) return;

    const activeNow = getSnapActive();
    clearSnapLocks();

    if (activeNow) {
      const cands = buildSnapCandidatesAllAxes();
      snapEngineRef.current?.setCandidatesAll?.(cands);
    } else {
      snapEngineRef.current?.setCandidatesAll?.({ x: [], y: [], z: [] });
    }
  }, [
    alignMode?.key,
    alignMode?.axis,
    snapEnabled,
    shiftSnap,
    getSnapActive,
    clearSnapLocks,
    buildSnapCandidatesAllAxes,
  ]);

  // ✁EAlign用E確定用の最終アンカー
  const snapFinalAnchorRef = useRef({ axis: null, anchor: null, snapActive: false, t: 0 });

  // ✁EAlign 中だぁEOrbitControls を制御EEizmoはTransformGizmoに一本化！E
  const savedMouseButtonsRef = useRef(null);

  useEffect(() => {
    const c = orbitRef.current;
    if (!c) return;

    if (!savedMouseButtonsRef.current) {
      savedMouseButtonsRef.current = { ...c.mouseButtons };
    }

    const alignActive = !!alignMode;
    const shouldKillLeft = type === VIEW_TYPES.PERSPECTIVE && alignActive;

    if (shouldKillLeft) {
      c.enableRotate = false;
      c.enableZoom = true;
      c.enablePan = true;
    } else {
      const saved = savedMouseButtonsRef.current;
      if (saved) c.mouseButtons = { ...saved };
      c.enableRotate = (type === VIEW_TYPES.PERSPECTIVE);
    }

    c.update?.();
  }, [type, alignMode]);

  useEffect(() => {
    if (!isGizmoDragging) return;

    // ✁Epending が残ってぁE��も強制キャンセル
    cancelMarquee?.();

    // suppressも確実に立てめE
    suppressMarqueePointerIdRef.current = "gizmo";
  }, [isGizmoDragging, cancelMarquee]);





return (
  <Box
    className="ViewportCanvasRoot"
    ref={rootRef}
    sx={{
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      border: active
        ? `1px solid ${alpha(theme.palette.primary.main, 0.65)}`
        : `1px solid ${alpha("#fff", 0.08)}`,
      background: alpha("#050815", 0.55),
      userSelect: "none",
    }}
    onPointerDownCapture={(e) => {
      if (e.button === 2) {
        rightClickStartRef.current = { x: e.clientX, y: e.clientY };
      }
      setTimeout(() => setActiveViewportId?.(viewportId), 0);
      setTimeout(() => onActivate?.(viewportId), 0);
      // if (e.button === 2) setRmb(true); // Removed to prevent interrupting native pointerdown

      // Gizmo操作に入った�Eインタでは marquee を開始させなぁE
      if (e.button === 0) {
        const st = useViewportUiStore.getState?.();
        if (st?.gizmoInteracting || st?.gizmoDragging) {
          suppressMarqueePointerIdRef.current = e.pointerId ?? "gizmo";
        }
      }
    }}

    onContextMenu={(e) => {
      e.preventDefault();
      
      const start = rightClickStartRef.current;
      if (start) {
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          return; // It was a drag (e.g. panning), do not rotate
        }
      }

      const ids = getSelectedIds();
      if (ids.length > 0) {
        e.stopPropagation();
        
        let deg = 15;
        if (e.ctrlKey) deg = 90;
        if (!e.shiftKey) deg = -deg; // default is right rotation (clockwise -> negative Y)

        beginHistoryBatch({ kind: 'numeric', mode: 'rotate' });
        beginGizmoMultiSnapshot();
        
        applyNumericToObjects({
          axis: 'Y',
          mode: 'rotate',
          space: 'world',
          raw: deg,
        });
        
        gizmoMultiSnapshotRef.current = null;
        endHistoryBatch({ kind: 'numeric', mode: 'rotate' });
      }
    }}

    onPointerDown={(e) => {
      if (materialPicking) return;
      if (!marqueeEnabled) return;
      if (suppressMarqueePointerIdRef.current != null) return;

      // ✁Ehook側の getIsBlocked ぁEtrue なめEpending すら作られなぁE
      handlers?.onPointerDown?.(e);
    }}

    onPointerMove={(e) => {
      if (materialPicking) return;
      if (!marqueeEnabled) return;

      handlers?.onPointerMove?.(e);
    }}

    onPointerUp={(e) => {
      // if (e.button === 2) setRmb(false);
      if (materialPicking) return;
      if (!marqueeEnabled) return;

      handlers?.onPointerUp?.(e);
    }}

    onPointerCancel={(e) => {
      handlers?.onPointerCancel?.(e);
    }}

    onPointerLeave={() => {
      // ✁Eleave 時�E cancel�E�Eindow追跡がある�Eで無くてもいぁE��ど保険�E�E
      if (marqueeEnabled && isMarqueeActive) cancelMarquee?.();
    }}

    onDragOver={(e) => allowDropSafe && onCanvasDragOver?.(e)}
    onDrop={(e) => allowDropSafe && onCanvasDrop?.(e)}
  >
    {marqueeEnabled && marqueeRect && (
      <Box
        sx={{
          position: "absolute",
          left: marqueeRect.x,
          top: marqueeRect.y,
          width: marqueeRect.w,
          height: marqueeRect.h,
          zIndex: 20,
          pointerEvents: "none",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.9)}`,
          background: alpha(theme.palette.primary.main, 0.12),
          boxShadow: `0 0 0 1px ${alpha("#000", 0.35)} inset`,
        }}
      />
    )}

    <Box sx={{ position: "absolute", top: 10, left: 10, zIndex: 25, display: "flex", alignItems: "center", gap: 0.5 }}>
      <Chip
      size="small"
      label={chipLabel}

      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveViewportId?.(viewportId);
        onActivate?.(viewportId);
        // ダブルクリック: 1画面 ↔ 2画面(Top+Perspective)トグル
        if (layoutMode === "single") {
          setLayoutMode("split");
        } else {
          // 2画面 → 1画面: ダブルクリックされたチップのビューを表示する
          const es = useEditorModeStore.getState();
          if (overrideSubMode === "furniture_top") {
            es.setLayoutSubMode("furniture_top");
          } else if (overrideSubMode === "furniture_iso") {
            es.setLayoutSubMode("furniture_iso");
            es.setLayoutCameraTilt("default");
          }
          setLayoutMode("single");
          onActivate?.("vp_persp");
        }
      }}
      sx={{




        bgcolor: alpha("#000", 0.42),
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
      }}
    />
    <IconButton
      size="small"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAnchorEl(e.currentTarget);
      }}
      sx={{
        bgcolor: alpha("#000", 0.42),
        color: "#fff",
        width: 24,
        height: 24,
        "&:hover": {
          bgcolor: alpha("#000", 0.6),
        }
      }}
    >
      <PlayArrowIcon sx={{ fontSize: "1rem" }} />
    </IconButton>
  </Box>

    <Menu
      anchorEl={menuAnchorEl}
      open={Boolean(menuAnchorEl)}
      onClose={handleMenuClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      MenuListProps={{
        dense: true,
      }}
      PaperProps={{
        sx: {
          mt: 0.5,
          minWidth: 160,
          bgcolor: "rgba(20, 20, 20, 0.95)",
          color: "rgba(255, 255, 255, 0.9)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(8px)",
          "& .MuiMenuItem-root": {
            fontSize: "0.7rem",
            fontWeight: 300,
            py: 0.25,
            px: 1.5,
            minHeight: "26px",
            "&:hover": {
              bgcolor: "rgba(255, 255, 255, 0.1)",
            }
          },
          "& .MuiListItemText-primary": {
            fontSize: "inherit",
            fontWeight: "inherit",
          },
          "& .MuiListItemIcon-root": {
            minWidth: "24px",
            color: "inherit",
          }
        }
      }}
    >
      {displayModes.map((mode) => (
        <MenuItem
          key={mode.value}
          onClick={() => {
            setViewportDisplayMode(viewportId, mode.value);
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            {currentDisplayMode === mode.value ? <CheckIcon fontSize="small" /> : null}
          </ListItemIcon>
          <ListItemText>{mode.label}</ListItemText>
        </MenuItem>
      ))}
    </Menu>

    {/* レンダリングモード: 通常 / Lighting プレビュー切り替え */}
    {currentDisplayMode === "rendered" && (
      <Box
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 44,
          left: 10,
          zIndex: 25,
          bgcolor: "rgba(20, 20, 20, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 1,
          p: 0.5,
          backdropFilter: "blur(8px)",
          display: "flex",
          gap: 0.5,
        }}
      >
        {[
          { value: "standard", label: "通常" },
          { value: "lighting", label: "Lighting" },
        ].map(({ value, label }) => (
          <Box
            key={value}
            onClick={() => setRenderSubMode(value)}
            sx={{
              px: 1.25,
              py: 0.4,
              borderRadius: 0.5,
              fontSize: "0.65rem",
              cursor: "pointer",
              bgcolor: renderSubMode === value ? "rgba(255,255,255,0.18)" : "transparent",
              color: renderSubMode === value ? "#fff" : "rgba(255,255,255,0.45)",
              border: renderSubMode === value
                ? "1px solid rgba(255,255,255,0.25)"
                : "1px solid transparent",
              "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" },
              transition: "all 0.12s",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
    )}

    {/* ゴーストモード: 躯体透過率スライダー */}
    {currentDisplayMode === "ghosted" && (
      <Box
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        sx={{
          position: "absolute",
          top: 44,
          left: 10,
          zIndex: 25,
          bgcolor: "rgba(20, 20, 20, 0.85)",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: 1,
          px: 1.5,
          py: 0.75,
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          gap: 1,
          minWidth: 190,
        }}
      >
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem", whiteSpace: "nowrap" }}>
          躯体透過率
        </Typography>
        <Slider
          size="small"
          min={0}
          max={1}
          step={0.01}
          value={ghostOpacity}
          onChange={(_, val) => setGhostOpacity(val)}
          sx={{
            color: "rgba(255,255,255,0.75)",
            "& .MuiSlider-thumb": { width: 10, height: 10 },
            "& .MuiSlider-rail": { opacity: 0.3 },
            py: 0,
            flex: 1,
          }}
        />
        <Typography sx={{ color: "rgba(255,255,255,0.65)", fontSize: "0.65rem", minWidth: 30, textAlign: "right" }}>
          {Math.round(ghostOpacity * 100)}%
        </Typography>
      </Box>
    )}









    <Canvas
      frameloop="always"
      dpr={[1, 2]}
      shadows="soft"
      gl={{ powerPreference: "high-performance", antialias: true }}
      onCreated={({ gl, scene }) => {
        // ローカル ref に保存（active 変化時に layoutSceneRef へ反映する）
        glRef.current    = gl;
        sceneRef.current = scene;
        // ★ active な viewport だけ即時登録する。
        //   React の effect 発火順は depth-first post-order のため、
        //   vp_persp(active) の useEffect([active]) が登録しても、
        //   その後に続く vp_front/vp_right の onCreated が上書きしてしまう。
        //   inactive 分は登録せず、active 変化時に useEffect で再登録する。
        if (active) {
          layoutSceneRef.gl    = gl;
          layoutSceneRef.scene = scene;
          layoutSceneRef.getCameraState = () => {
            const controls = orbitRef.current;
            if (!controls) return null;
            const cam = controls.object;
            if (!cam) return null;
            // OrthographicCamera の場合も position/target は使える。fov は 50 で固定。
            const fov = cam.isPerspectiveCamera ? cam.fov : 50;
            return {
              position: [cam.position.x, cam.position.y, cam.position.z],
              target: [controls.target.x, controls.target.y, controls.target.z],
              fov,
            };
          };
        }
      }}

      onPointerMissed={(e) => {
        if (e.type === "pointerdown" && e.button !== 0) return;
        if (e.type === "click" && e.button !== 0) return;
        if (!active) return;
        if (!pointerMissedEnabled) return;
        if (isMarqueeActive) return;
        if (alignMode) return;
        if (isGizmoDragging) return;
        clearSelection();
        useLayoutTaskStore.getState().setActiveZoneId(null);
        
        if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
          useZoningStore.getState().setSelectedCirculationId(null);
          useZoningStore.getState().setSelectedCirculationNodeIndex(null);
        }
      }}
    >
      <ViewportOverrideContext.Provider value={{ layoutSubMode: overrideSubMode, layoutCameraRotationIndexOffset: overrideRotOffset }}>
      <ContextDisposer />
      <ViewportDisplayController mode={currentDisplayMode} ghostOpacity={ghostOpacity} renderSubMode={renderSubMode} />
      <SectionClipManager />

      <SmoothAlignFollower
        active={!!isAlignOwner && !!alignMode && !materialPicking}
        primaryObject={selectedObject}
        selectedObjects={alignSelectedObjects}
        alignMode={alignMode}
        groundY={groundY}
        snapAxisValue={snapAxisValue}
        baseCollidersRef={baseCollidersRef}
        baseBoundsRef={baseBoundsRef}
        wallEps={0.02}
        wallMaxDist={200}
        lastNdcRef={lastAlignNdcRef}
        damping={32}
        getSnapActive={getSnapActive}
        getAbortAlign={() => alignAbortRef.current}
        onPreviewTransform={onChangeTransform}
        onPreviewTransforms={onChangeTransforms}
        previewItemId={selectedItemId}
        previewThrottleMs={33}
        snapEngineRef={snapEngineRef}
        snapDotRef={snapDotRef}
        snapGuideValueRef={snapGuideValueRef}
        snapFinalAnchorRef={snapFinalAnchorRef}
      />

      {isAlignOwner && alignMode && (
        <SnapGuide axis={alignMode.axis} valueRef={snapGuideValueRef} pointRef={snapDotRef} />
      )}

      <AlignPointerController
        enabled={!!isAlignOwner && !!alignMode && !materialPicking}
        onConfirm={commitAlign}
        lastNdcRef={lastAlignNdcRef}
        isNavActive={isNavActive}
        getSnapActive={getSnapActive}
      />

      <GridPickController baseCollidersRef={baseCollidersRef} />

      {effectiveType === VIEW_TYPES.PERSPECTIVE && (
        <PerspectiveCamera
            makeDefault
            fov={envFov} near={0.1} far={100000}
            onUpdate={(c) => {
                console.log("[Canvas-PerspectiveCamera] activeCamUUID:", c.uuid);
                if (!c.userData.initialized) {
                    c.position.set(24, 18, 24);
                    c.lookAt(0, 0, 0);
                    c.userData.initialized = true;
                }
            }}
        />
      )}

      {effectiveType !== VIEW_TYPES.PERSPECTIVE && (
        <OrthographicCamera
          makeDefault
          position={ortho.position}
          up={ortho.up}
          zoom={ortho.zoom}
          near={0.1}
          far={100000}
        />
      )}

      <Lights hasBase={!!displayBaseUrl} />
      <SceneGrid />
      <Suspense fallback={null}>
        <LandscapeBackdrop />
      </Suspense>

    <OrbitControls
          ref={orbitRef}
          enableDamping={false}
          enableRotate={!isZone2D}
          panSpeed={editorMode === "zoning" ? 5.0 : 1.0}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: isZone2D ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          }}
        />
        <PerspectiveControlsBinder
          mouseEnabled={!alignMode && !isGizmoDragging}
          keyboardEnabled={active && !alignMode && !isGizmoDragging}
          enabled={active && !alignMode && !isGizmoDragging}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          moveSpeed={speedPreset.move}
          verticalSpeed={speedPreset.vertical}
          onSpeedChange={onSpeedMulChange}
          forcePanOnRmb={false}
          rmbOrbit={false}
        />

        <ViewportFramingController
          active={active}
          type={type}
          orbitRef={orbitRef}
          selectedObject={selectedObject}
          objectsRef={objectsRef}
          baseRootRef={baseRootRef}
          focusTick={focusTick}
          frameAllTick={frameAllTick}
          isUserInteracting={isGizmoDragging}
        />

        {isBaseReady && displayBaseUrl && (
          <CanvasErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              {/* Background Click Catcher */}
      <mesh 
        position={[0, groundY - 0.05, 0]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        visible={true}
        onClick={(e) => {
          if (!active) return;
          if (isMarqueeActive || isGizmoDragging || alignMode) return;
          clearSelection();
          useLayoutTaskStore.getState().setActiveZoneId(null);
          
          if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
            useZoningStore.getState().setSelectedCirculationId(null);
            useZoningStore.getState().setSelectedCirculationNodeIndex(null);
          }
          // e.stopPropagation() is optional here because nothing is below this
        }}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>

      <group
        onClick={(e) => {
          if (!active) return;
          if (isMarqueeActive || isGizmoDragging || alignMode) return;
          
          // Clear selection when clicking the BaseGlb (floor/walls)
          clearSelection();
          useLayoutTaskStore.getState().setActiveZoneId(null);
          
          if (useEditorModeStore.getState().editorMode === "zoning" && useZoningStore.getState().zoningSubMode === "circulation" && useZoningStore.getState().isZoningActionSelect) {
            useZoningStore.getState().setSelectedCirculationId(null);
            useZoningStore.getState().setSelectedCirculationNodeIndex(null);
          }
        }}
      >
        <BaseGlb url={displayBaseUrl} onLoaded={handleBaseLoaded} />
      </group>
            </Suspense>
          </CanvasErrorBoundary>
        )}

        {isBaseReady && pendingBaseUrl && pendingBaseUrl !== displayBaseUrl && (
          <CanvasErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <group visible={false}>
                <BaseGlb url={pendingBaseUrl} onLoaded={onPendingLoaded} />
              </group>
            </Suspense>
          </CanvasErrorBoundary>
        )}

        {normalizedItems.map((it) =>
          it.kind === "ai_placeholder" ? (
            <AiPlaceholderItem
              key={it.id}
              item={it}
              selected={selectedSet.has(it.id)}
              onSelect={handleSelectFurniture}
            />
          ) : (
            <FurnitureItem
              key={it.id}
              item={it}
              selected={selectedSet.has(it.id)}
              freezeTransform={isGizmoDragging && selectedSet.has(it.id)}
              onSelect={handleSelectFurniture}
            />
          )
        )}
        <FurnitureDimensionOverlay />
        <ZoneVisualizer items={normalizedItems} orbitRef={orbitRef} />
        <ZoneDrawController />
        <ZoneCirculationController />

        {showGizmoSafe && (
          <TransformGizmo
            orbitRef={orbitRef}
            selectedObject={selectedObject}
            mode={gizmoMode}
            space={gizmoSpace}
            snapEnabled={snapEnabled}
            onChangeTransform={handleGizmoPreview}
            onCommitTransform={handleGizmoCommit}
            onHoverAxisChange={(axis) => {
              onGizmoHoverAxisChange?.(axis ?? null);

              const next = axis || null;
              setGizmoHotAxisStore?.(next);

              // UI state only
              isGizmoUiActiveRef.current = !!next;
            }}
            onRequestNumericOpen={handleNumericOpenFromGizmo}
            onRequestNumericClose={handleNumericCloseFromGizmo}
            onDraggingChange={(payload) => {
              if (typeof payload === "boolean") {
                const isDragging = payload;

                // ✁Estateより先にref更新�E�これが効く！E
                gizmoDraggingRef.current = isDragging;

                setIsGizmoDragging(isDragging);
                
                useViewportUiStore.getState().setGizmoDragging(isDragging);

                if (isDragging) {
                  beginGizmoMultiSnapshot();

                  // ✁EGizmo操作開始したら篁E��選択を即停止 & 抑止を立てめE
                  suppressMarqueePointerIdRef.current = "gizmo";
                  cancelMarquee?.();
                } else {
                  suppressMarqueePointerIdRef.current = null;
                  requestAnimationFrame(() => {
                    gizmoMultiSnapshotRef.current = null;
                  });
                }
                return;
              }

              const kind = payload?.kind;
              const value = !!payload?.value;
              if (kind === "input" || kind === "hover") isGizmoUiActiveRef.current = value;
            }}
          />
        )}
        <LayoutModeInteractionController
          active={active}
          selectedItemIds={alignSelectedIds}
          onChangeTransforms={onChangeTransforms}
          onCommitTransforms={onCommitTransforms}
          onDeleteItems={onDeleteItems}
          snapGridSize={0.5}
          orbitRef={orbitRef}
          items={normalizedItems}
        />
        <LayoutCameraRig 
          orbitRef={orbitRef} 
          layoutSubMode={overrideSubMode || globalLayoutSubMode} 
          baseBoundsRef={baseBoundsRef}
        />
      </ViewportOverrideContext.Provider>
      </Canvas>
    </Box>
  );
}
