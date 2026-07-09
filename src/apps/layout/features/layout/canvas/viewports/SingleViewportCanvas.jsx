// src/features/layout/components/MainArea/components/viewports/SingleViewportCanvas.jsx
import React, { useMemo, useCallback, useRef, useEffect, useState, Suspense } from "react";
import { Box, Chip } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";

import {
  VIEW_TYPES,
  getOrthoPreset,
  optimizeTopPlacement,
} from "@layout/features/layout/utils/viewportUtils.js";

import Lights from "../scene/Lights.jsx";
import SceneGrid from "../scene/SceneGrid.jsx";
import BaseGlb from "../scene/BaseGlb.jsx";
import FurnitureItem from "../scene/FurnitureItem.jsx";

import TransformGizmo from "@layout/features/layout/canvas/tools/gizmo/TransformGizmo.jsx";

import { PerspectiveControlsBinder, OrthoControlsBinder } from "../controls/controlsBinders.jsx";
import ViewportFramingController from "../controls/ViewportFramingController.jsx";

import { useMarqueeSelection } from "@layout/features/layout/hooks/useMarqueeSelection.js";
import ViewportQuickMenu from "../menu/ViewportQuickMenu.jsx";

// ✁EObject3D registry�E�唯一のObject管琁E��E
import { useSceneObjectRegistryStore } from "@layout/features/layout/store/sceneObjectRegistryStore";

// ✁Eviewport ui store�E�Elign / Command / layout etc�E�E
import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";

// ✁ESnap Engine
import SnapGuide from "@layout/features/layout/canvas/tools/align/SnapGuide.jsx";

import AlignCursorBinder from "./controllers/AlignCursorBinder.jsx";
import AlignPointerController from "./controllers/AlignPointerController.jsx";
import SmoothAlignFollower from "./controllers/SmoothAlignFollower.jsx";
import MaterialPickController from "./controllers/MaterialPickController.jsx";
import MaterialCursorBinder from "./controllers/MaterialCursorBinder.jsx";

import { useViewportSelection } from "./hooks/useViewportSelection";
import { useRmbNav } from "./hooks/useRmbNav";
import { useSnapEngine } from "./hooks/useSnapEngine";


/* =========================================================
 * SingleViewportCanvas
 * ======================================================= */
export default function SingleViewportCanvas({
  viewportId,
  type,
  active = false,
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
  const commandOpen = useViewportUiStore((s) => s.commandOpen);
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
  const gizmoHotAxis = useViewportUiStore((s) => s.gizmoHotAxis);
  const gizmoDraggingStore = useViewportUiStore((s) => s.gizmoDragging);
  const gizmoInteracting = useViewportUiStore((s) => s.gizmoInteracting);
  const setGizmoHotAxisStore = useViewportUiStore((s) => s.setGizmoHotAxis);

  const suppressMarqueePointerIdRef = useRef(null);
  const gizmoDraggingRef = useRef(false);

  const { 
    selectedItemIds,
    selectedItemId,
    selectedSet,
    applySelectionIds,
    clearSelection
  } = useViewportSelection({ materialPicking, commandOpen });

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
    return registryMap?.get(selectedItemId) || null;
  }, [selectedItemId, registryMap]);

  const [alignMode, setAlignMode] = useState(null);

  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const [isGizmoUiActive, setIsGizmoUiActive] = useState(false);
  const [hoverAxis, setHoverAxis] = useState(null);


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

  const baseBoundsRef = useRef(null);
  const didInitCameraRef = useRef(false);
  

  useEffect(() => {
    didInitCameraRef.current = false;
    baseBoundsRef.current = null;
  }, [displayBaseUrl, type]);

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

      if (type === VIEW_TYPES.PERSPECTIVE) {
        cam.position.copy(center).addScaledVector(dir, dist);
        cam.near = Math.max(0.01, dist / 200);
        cam.far = Math.max(2000, dist * 50);
        cam.updateProjectionMatrix();
        controls.update();
        didInitCameraRef.current = true;
        return;
      }

      const orthoDist = Math.max(20, maxDim * 1.2);
      if (type === VIEW_TYPES.TOP) cam.position.set(center.x, center.y + orthoDist, center.z);
      if (type === VIEW_TYPES.FRONT) cam.position.set(center.x, center.y, center.z + orthoDist);
      if (type === VIEW_TYPES.RIGHT) cam.position.set(center.x + orthoDist, center.y, center.z);

      cam.updateProjectionMatrix();
      controls.update();
      didInitCameraRef.current = true;
    },
    [type]
  );

  // ✁EBaseGlb の onLoaded は {root, snap:{baseMeshes}} を返す形に変更済み
  const handleBaseLoaded = useCallback(
    (payload) => {
      if (!payload) {
        baseRootRef.current = null;
        baseCollidersRef.current = [];
        baseBoundsRef.current = null;
        didInitCameraRef.current = false;
        return;
      }

      const rootGroup = payload.root || null;
      baseRootRef.current = rootGroup;

      // ✁ESnap/MaterialPick用�E�baseMeshes�E�EBase冁E�E全Mesh�E�E
      const baseMeshes = payload?.snap?.baseMeshes;
      baseCollidersRef.current = Array.isArray(baseMeshes) ? baseMeshes : [];

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
      inspect: { move: 1.2, vertical: 1.2 },
      walk: { move: 3.0, vertical: 3.0 },
      cycle: { move: 7.0, vertical: 5.0 },
      drive: { move: 14.0, vertical: 7.0 },
      fly: { move: 28.0, vertical: 18.0 },
    };
    return presets[speedMode] || presets.walk;
  }, [speedMode]);

  const isOrtho = type !== VIEW_TYPES.PERSPECTIVE;
  const marqueeEnabled = 
    active &&  
    !alignMode && 
    !isGizmoDragging &&  
    !gizmoDraggingStore &&
    !gizmoInteracting &&
    !materialPicking;

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
    if (isGizmoDragging || isGizmoUiActive || materialPicking) cancelMarquee?.();
  }, [isGizmoDragging, isGizmoUiActive, materialPicking, cancelMarquee]);




  const ortho = useMemo(() => (isOrtho ? getOrthoPreset(type) : null), [isOrtho, type]);

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

  const emitTransformUpdates = useCallback(
    (updates, { commit = false } = {}) => {
      if (!Array.isArray(updates) || updates.length === 0) return;

      if (updates.length > 1) {
        if (commit) {
          if (typeof onCommitTransforms === "function") onCommitTransforms(updates);
          else updates.forEach((u) => onCommitTransform?.(u));
        } else {
          if (typeof onChangeTransforms === "function") onChangeTransforms(updates);
          else updates.forEach((u) => onChangeTransform?.(u));
        }
        return;
      }

      if (commit) onCommitTransform?.(updates[0]);
      else onChangeTransform?.(updates[0]);
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

  const handleGizmoPreview = useCallback(
    (t) => {
      if (applyGizmoMultiDelta({ commit: false })) return;
      if (!selectedItemId || !t) return;
      onChangeTransform?.({ itemId: selectedItemId, transform: t });
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
      const n = Number(String(raw ?? "").trim());
      if (!Number.isFinite(n)) return;

      const ids = getSelectedIds();
      if (ids.length === 0) return;

      const targets = ids.map((id) => ({ id, obj: objectsRef.current.get(id) })).filter((x) => !!x.obj);
      if (targets.length === 0) return;

      const ax = getAxisVec(axis);
      const isXYZ = axis === "XYZ";

      if (mode === "translate") {
        if (!ax) return;
        const dist = n / 1000;
        targets.forEach(({ obj }) => {
          const dir = ax.clone();
          if (space === "local") dir.applyQuaternion(obj.quaternion);
          dir.normalize();
          obj.position.addScaledVector(dir, dist);
        });
      }

      if (mode === "rotate") {
        if (!ax) return;
        const rad = THREE.MathUtils.degToRad(n);
        targets.forEach(({ obj }) => {
          const axisN = ax.clone().normalize();
          if (space === "world") obj.rotateOnWorldAxis(axisN, rad);
          else obj.rotateOnAxis(axisN, rad);
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
      setHoverAxis(axis || null);
      setIsGizmoUiActive(!!axis);

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
    setHoverAxis(null);
    setIsGizmoUiActive(false);
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

      if (isGizmoUiActive) {
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
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    active,
    alignMode,
    alignPhase,
    isGizmoUiActive,
    handleNumericCloseFromGizmo,
    isMarqueeActive,
    cancelMarquee,
    setRmb,
    cancelAlign,
  ]);

  useEffect(() => {
    setHoverAxis(null);
    setIsGizmoUiActive(false);
  }, [numericCloseTick]);

  const showGizmoSafe = showGizmo && !alignMode && !materialPicking;
  const allowDropSafe = allowDrop && !materialPicking;
  const pointerMissedEnabled = !materialPicking;

  // ✁EAlign用�E�最後�EガイチEドット表示位置�E�ワールド座標！E
  const snapDotRef = useRef(null);
  const snapGuideValueRef = useRef(null);

  // ✁EAlign用�E�最後�Eマウス位置�E�EDC�E�E
  const lastAlignNdcRef = useRef({ x: 0, y: 0, t: 0 });

  const chipLabel = useMemo(() => {
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
  }, [materialPicking, label, isAlignOwner, alignMode, getSnapActive]);

  // ✁EAlign中に Snap ON/OFF が�Eり替わったら candidates を�E構篁E
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

  // ✁EAlign用�E�確定用の最終アンカー
  const snapFinalAnchorRef = useRef({ axis: null, anchor: null, snapActive: false, t: 0 });

  // ✁EAlign 中だぁEOrbitControls を制御�E�EizmoはTransformGizmoに一本化！E
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
      setActiveViewportId?.(viewportId);
      onActivate?.(viewportId);
      if (e.button === 2) setRmb(true);

      // Gizmo操作に入った�Eインタでは marquee を開始させなぁE
      if (e.button === 0) {
        const st = useViewportUiStore.getState?.();
        if (st?.gizmoInteracting || st?.gizmoDragging) {
          suppressMarqueePointerIdRef.current = e.pointerId ?? "gizmo";
        }
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
      if (e.button === 2) setRmb(false);
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

    <Chip
      size="small"
      label={chipLabel}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveViewportId?.(viewportId);
        onActivate?.(viewportId);
        onToggleMaximize?.();
      }}
      sx={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 25,
        bgcolor: alpha("#000", 0.42),
        color: "#fff",
        cursor: "pointer",
        userSelect: "none",
      }}
    />

    {active && type === VIEW_TYPES.PERSPECTIVE && (
      <ViewportQuickMenu
        speedMode={speedMode}
        onChangeSpeedMode={onChangeSpeedMode}
        speedMul={speedMul}
      />
    )}

    <Canvas
      frameloop="always"
      dpr={[1, 2]}
      gl={{ powerPreference: "high-performance", antialias: true }}

      onPointerMissed={() => {
        if (!active) return;
        if (!pointerMissedEnabled) return;
        if (isMarqueeActive) return;
        if (alignMode) return;
        if (isGizmoDragging) return;
        if (isGizmoUiActive) return;
        clearSelection();
      }}
    >
      <MaterialCursorBinder enabled={!!materialPicking} />
      <AlignCursorBinder enabled={!!isAlignOwner && !!alignMode && !materialPicking} />

      {/* ===== 以丁ECanvas 冁E��は変更なぁE===== */}

      <MaterialPickController
        active={active}
        enabled={materialPicking}
        baseCollidersRef={baseCollidersRef}
        isBlocked={!!alignMode || isGizmoDragging}
        onPicked={onPickMaterial}
      />

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

      {type === VIEW_TYPES.PERSPECTIVE && (
        <PerspectiveCamera makeDefault position={[24, 18, 24]} fov={50} />
      )}

      {type !== VIEW_TYPES.PERSPECTIVE && (
        <OrthographicCamera
          makeDefault
          position={ortho.position}
          up={ortho.up}
          zoom={ortho.zoom}
        />
      )}

      <Lights />
      <SceneGrid />

        {type !== VIEW_TYPES.PERSPECTIVE ? (
          <>
            <OrbitControls
              key={`${viewportId}-${type}`}
              ref={orbitRef}
              enableRotate={false}
              enabled={active}
              mouseButtons={{
                LEFT: null,              // ↁEこれが趁E��要E
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,
              }}
            />
            <OrthoControlsBinder
              enabled={active && !alignMode && !isGizmoDragging}
              orbitRef={orbitRef}
              selectedObject={selectedObject}
              moveSpeed={speedPreset.move}
              verticalSpeed={speedPreset.vertical}
              onSpeedChange={onSpeedMulChange}
            />
          </>
        ) : (
          <>
            <OrbitControls 
              ref={orbitRef}
              enabled={active}
              enableDamping={false}
              mouseButtons={{
                LEFT: null,              // ↁEこれが趁E��要E
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE,
              }}
            />
            <PerspectiveControlsBinder
              enabled={active && !alignMode && !isGizmoDragging}
              orbitRef={orbitRef}
              selectedObject={selectedObject}
              moveSpeed={speedPreset.move}
              verticalSpeed={speedPreset.vertical}
              onSpeedChange={onSpeedMulChange}
            />
          </>
        )}

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

        {isBaseReady && displayBaseUrl && <BaseGlb url={displayBaseUrl} onLoaded={handleBaseLoaded} />}

        {isBaseReady && pendingBaseUrl && pendingBaseUrl !== displayBaseUrl && (
          <Suspense fallback={null}>
            <group visible={false}>
              <BaseGlb url={pendingBaseUrl} onLoaded={onPendingLoaded} />
            </group>
          </Suspense>
        )}

        {normalizedItems.map((it) => (
          <FurnitureItem
            key={it.id}
            item={it}
            selected={selectedSet.has(it.id)}
            freezeTransform={isGizmoDragging}
            onSelect={(id, e) => {
              if (!active) return;
              if (materialPicking) return;
              applySelectionIds(id ? [id] : [], e?.nativeEvent ?? e, "click");
            }}
          />
        ))}

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
              setHoverAxis(next);
              setIsGizmoUiActive(!!next);
            }}
            onRequestNumericOpen={handleNumericOpenFromGizmo}
            onRequestNumericClose={handleNumericCloseFromGizmo}
            onDraggingChange={(payload) => {
              if (typeof payload === "boolean") {
                const isDragging = payload;

                // ✁Estateより先にref更新�E�これが効く！E
                gizmoDraggingRef.current = isDragging;

                setIsGizmoDragging(isDragging);

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
              if (kind === "input" || kind === "hover") setIsGizmoUiActive(value);
            }}
          />
        )}
      </Canvas>
    </Box>
  );
}
