// // src/features/layout/components/MainArea/components/viewports/SingleViewportCanvas.jsx
// import React, { useMemo, useCallback, useRef, useEffect, useState, Suspense } from "react";
// import { Box, Chip } from "@mui/material";
// import { alpha, useTheme } from "@mui/material/styles";

// import * as THREE from "three";
// import { Canvas, useThree, useFrame } from "@react-three/fiber";
// import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";

// import { VIEW_TYPES, getOrthoPreset, optimizeTopPlacement } from "@desktop/features/dsl/layout/utils/viewportUtils.js";

// import Lights from "../scene/Lights.jsx";
// import SceneGrid from "../scene/SceneGrid.jsx";
// import BaseGlb from "../scene/BaseGlb.jsx";
// import FurnitureItem from "../scene/FurnitureItem.jsx";

// import TransformGizmo from "@desktop/features/dsl/layout/canvas/tools/gizmo/TransformGizmo.jsx";

// import { PerspectiveControlsBinder, OrthoControlsBinder } from "../controls/controlsBinders.jsx";
// import ViewportFramingController from "../controls/ViewportFramingController.jsx";

// import { useMarqueeSelection } from "@desktop/features/dsl/layout/hooks/useMarqueeSelection.js";
// import ViewportQuickMenu from "../menu/ViewportQuickMenu.jsx";

// // ✁Eselection store
// import { useUiSelectionStore } from "@desktop/features/dsl/layout/store/uiSelectionStore";

// // ✁EMaterialPicker store
// import { useMaterialPickerStore } from "@desktop/features/dsl/layout/store/materialPickerStore";

// // ✁EObject3D registry�E�唯一のObject管琁E��E
// import { useSceneObjectRegistryStore } from "@desktop/features/dsl/layout/store/sceneObjectRegistryStore";

// // ✁Eviewport ui store�E�Elign / Command / layout etc�E�E
// import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";

// function AlignCursorBinder({ enabled }) {
//   const { gl } = useThree();

//   useEffect(() => {
//     const el = gl?.domElement;
//     if (!el) return;

//     if (enabled) el.style.cursor = "crosshair";
//     else el.style.cursor = "";

//     return () => {
//       if (!el) return;
//       el.style.cursor = "";
//     };
//   }, [enabled, gl]);

//   return null;
// }


// /* =========================================================
//  * AlignPointerController�E�Eindowでpointer位置を記録 / 左クリチE��で確定！E
//  * - レイアウト変更/最大匁EQuadでも追従が安定すめE
//  * ======================================================= */
// function AlignPointerController({ enabled, onConfirm, lastNdcRef, isNavActive = false }) {
//   const { gl } = useThree();
//   const rectRef = useRef(null);
//   const rafIdRef = useRef(0);
//   const lastEvRef = useRef(null);

//   useEffect(() => {
//     if (!enabled) return;
//     if (isNavActive) return;

//     const el = gl?.domElement;
//     if (!el) return;

//     const updateRect = () => {
//       rectRef.current = el.getBoundingClientRect();
//     };
//     updateRect();

//     const ro = new ResizeObserver(updateRect);
//     ro.observe(el);

//     const toNdc = (clientX, clientY) => {
//       const rect = rectRef.current || el.getBoundingClientRect();
//       const x = ((clientX - rect.left) / rect.width) * 2 - 1;
//       const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
//       return { x, y };
//     };

//     const flush = () => {
//       rafIdRef.current = 0;
//       const ev = lastEvRef.current;
//       if (!ev) return;

//       const { x, y } = toNdc(ev.clientX, ev.clientY);
//       // canvas外�E無視（値を更新しなぁE��E
//       if (x < -1 || x > 1 || y < -1 || y > 1) return;

//       lastNdcRef.current = { x, y, t: performance.now() };
//     };

//     // ✁Emove は止めなぁE��重くなる�Eで stopPropagation もしなぁE��E
//     const onMove = (ev) => {
//       lastEvRef.current = ev;
//       if (!rafIdRef.current) rafIdRef.current = requestAnimationFrame(flush);
//     };

//     // ✁E確定クリチE��だけ�E止める�E�他UIへの伝播防止�E�E
//     const onDown = (ev) => {
//       if (ev.button !== 0) return;

//       const { x, y } = toNdc(ev.clientX, ev.clientY);
//       if (x < -1 || x > 1 || y < -1 || y > 1) return;

//       ev.preventDefault?.();
//       ev.stopPropagation?.();
//       ev.stopImmediatePropagation?.();

//       onConfirm?.();
//     };

//     const onResize = () => updateRect();

//     window.addEventListener("pointermove", onMove, { passive: true, capture: true });
//     window.addEventListener("pointerdown", onDown, { passive: false, capture: true });
//     window.addEventListener("resize", onResize);
//     window.addEventListener("scroll", onResize, true);

//     return () => {
//       window.removeEventListener("pointermove", onMove, true);
//       window.removeEventListener("pointerdown", onDown, true);
//       window.removeEventListener("resize", onResize);
//       window.removeEventListener("scroll", onResize, true);
//       ro.disconnect();
//       if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
//       rafIdRef.current = 0;
//     };
//   }, [enabled, isNavActive, gl, onConfirm, lastNdcRef]);

//   return null;
// }


// /* =========================================================
//  * SmoothAlignFollower�E�毎フレーム raycast→target更新、表示は補間�E�E
//  * - 見た目�E�毎フレーム “ぬるぬる E
//  * - React(items)更新�E�❌しなぁE��確定時 commit のみ�E�E
//  *
//  * ✁E褁E��選択対応！E
//  * - primaryObject ぁEpointer 追従で target を決める
//  * - delta�E�移動量�E�を全 selectedObjects に同じだけ適用�E�グループ移動！E
//  * ======================================================= */
// function SmoothAlignFollower({
//   active,
//   primaryObject,
//   selectedObjects, // [{ itemId, object }]
//   alignMode,
//   groundY,
//   snapAxisValue,
//   baseCollidersRef,
//   wallEps = 0.02,
//   wallMaxDist = 200,
//   lastNdcRef,
//   damping = 34,
//   getSnapActive,

//   // ✁Epreview�E�Eplitのもう牁E��が追従表示できる�E�E
//   onPreviewTransform,
//   onPreviewTransforms,
//   previewItemId,
//   previewThrottleMs = 33,
// }) {
//   const { camera, raycaster } = useThree();

//   // 使ぁE��し！EC削減！E
//   const planeRef = useRef(new THREE.Plane());
//   const hitRef = useRef(new THREE.Vector3());
//   const nRef = useRef(new THREE.Vector3());

//   // ✁Ewall raycast GC削減（使ぁE��し！E
//   const wallRcRef = useRef(new THREE.Raycaster());
//   const originRef = useRef(new THREE.Vector3());
//   const dirRef = useRef(new THREE.Vector3());

//   const lastPreviewAtRef = useRef(0);

//   const isWallHit = useCallback((hit) => {
//     const n = hit?.face?.normal;
//     if (!n) return true;
//     return Math.abs(n.y) < 0.6;
//   }, []);

//   const clampTargetByWallsGroup = useCallback(
//     (targetAnchor, axis) => {
//       const colliders = baseCollidersRef?.current || [];
//       if (!primaryObject) return targetAnchor;
//       if (!Array.isArray(colliders) || colliders.length === 0) return targetAnchor;

//       // ✁Egroup bounds offsets�E�Erimary基準！E
//       const group = alignMode?.groupBoundsOffsets;
//       if (!group) return targetAnchor;

//       const p = primaryObject.position;
//       const offset = alignMode?.offset || 0;

//       const currPosAxis = axis === "x" ? p.x : p.z;
//       const currAnchor = currPosAxis - offset;

//       const dirSign = Math.sign(targetAnchor - currAnchor);
//       if (dirSign === 0) return targetAnchor;

//       // group edge world position
//       const groupOffsetMin = axis === "x" ? group.minX : group.minZ;
//       const groupOffsetMax = axis === "x" ? group.maxX : group.maxZ;

//       const edgeAxis =
//         dirSign > 0
//           ? currPosAxis - (groupOffsetMax ?? 0)
//           : currPosAxis - (groupOffsetMin ?? 0);

//       const origin = originRef.current.set(p.x, p.y, p.z);
//       const dir = dirRef.current.set(0, 0, 0);

//       if (axis === "x") {
//         origin.x = edgeAxis;
//         dir.set(dirSign, 0, 0);
//       } else {
//         origin.z = edgeAxis;
//         dir.set(0, 0, dirSign);
//       }

//       const rc = wallRcRef.current;
//       rc.set(origin, dir.normalize());
//       rc.near = 0;
//       rc.far = wallMaxDist;

//       const hits = rc.intersectObjects(colliders, true).filter(isWallHit);
//       if (!hits || hits.length === 0) return targetAnchor;

//       const hit = hits[0];
//       const hitAxis = axis === "x" ? hit.point.x : hit.point.z;

//       // edgeOffset: edgeAxis - currPosAxis
//       const edgeOffset = edgeAxis - currPosAxis;

//       const allowedPosAxis = hitAxis - edgeOffset - dirSign * wallEps;
//       const allowedAnchor = allowedPosAxis - offset;

//       if (dirSign > 0) return Math.min(targetAnchor, allowedAnchor);
//       return Math.max(targetAnchor, allowedAnchor);
//     },
//     [alignMode?.groupBoundsOffsets, alignMode?.offset, baseCollidersRef, primaryObject, isWallHit, wallEps, wallMaxDist]
//   );

//   useFrame((_, dt) => {
//     if (!active) return;
//     if (!primaryObject) return;
//     if (!alignMode) return;

//     const snapActive = typeof getSnapActive === "function" ? !!getSnapActive() : false;

//     const axis = alignMode.axis;
//     if (axis !== "x" && axis !== "y" && axis !== "z") return;

//     const ndc = lastNdcRef?.current;
//     if (!ndc) return;

//     raycaster.setFromCamera({ x: ndc.x, y: ndc.y }, camera);

//     const n =
//       alignMode.planeNormal instanceof THREE.Vector3
//         ? nRef.current.copy(alignMode.planeNormal)
//         : nRef.current.set(0, 1, 0);

//     const c = Number.isFinite(alignMode.planeConstant) ? alignMode.planeConstant : -groundY;
//     planeRef.current.set(n, c);

//     const hit = hitRef.current;
//     const ok = raycaster.ray.intersectPlane(planeRef.current, hit);
//     if (!ok) return;

//     const offset = alignMode.offset || 0;
//     const hitAxis = axis === "x" ? hit.x : axis === "y" ? hit.y : hit.z;

//     // ✁Esnap は “anchor E値に対して
//     let targetAnchor = snapAxisValue(hitAxis, axis, offset);

//     const isFloorPlane = Math.abs((n.y ?? 0) - 1) < 1e-6 || Math.abs((n.y ?? 0) + 1) < 1e-6;
//     const allowWallClamp = snapActive && isFloorPlane && (axis === "x" || axis === "z") && (selectedObjects?.length ?? 0) <= 1;

//      // ✁E壁クランプ！Enap ON の時だけ！E
//      if (allowWallClamp) {
//        targetAnchor = clampTargetByWallsGroup(targetAnchor, axis);
//      }

//     const t = 1 - Math.exp(-damping * dt);

//     const list = Array.isArray(selectedObjects) ? selectedObjects : [];
//     for (const it of list) {
//       const obj = it?.object;
//       if (!obj) continue;

//       const offsets = alignMode?.itemOffsets || {};
//       const off = Number.isFinite(offsets[it.itemId]) ? offsets[it.itemId] : (alignMode?.offset || 0);
//       const targetPosAxis = targetAnchor + off;

//       if (axis === "x") obj.position.x += (targetPosAxis - obj.position.x) * t;
//       if (axis === "y") obj.position.y += (targetPosAxis - obj.position.y) * t;
//       if (axis === "z") obj.position.z += (targetPosAxis - obj.position.z) * t;

//     }

//     // ✁Epreview めEdraft へ�E�褁E��なめEonPreviewTransforms 優先！E
//     // ✁ESnap OFF では preview を一刁E��たなぁE��Ehree.js冁E��けで完結させる�E�E
//     if (!snapActive) return;
    
//     const now = performance.now();
//     if (now - lastPreviewAtRef.current < previewThrottleMs) return;
//     lastPreviewAtRef.current = now;

//     if (typeof onPreviewTransforms === "function" && list.length > 0) {
//       const updates = list.map((it) => {
//         const obj = it.object;
//         return {
//           itemId: it.itemId,
//           transform: {
//             position: [obj.position.x, obj.position.y, obj.position.z],
//             rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
//             scale: [obj.scale.x, obj.scale.y, obj.scale.z],
//           },
//         };
//       });
//       onPreviewTransforms(updates);
//       return;
//     }

//     if (typeof onPreviewTransform === "function" && previewItemId) {
//       onPreviewTransform({
//         itemId: previewItemId,
//         transform: {
//           position: [primaryObject.position.x, primaryObject.position.y, primaryObject.position.z],
//           rotation: [primaryObject.rotation.x, primaryObject.rotation.y, primaryObject.rotation.z],
//           scale: [primaryObject.scale.x, primaryObject.scale.y, primaryObject.scale.z],
//         },
//       });
//     }
//   });

//   return null;
// }

// /* =========================================================
//  * MaterialPickController
//  * ======================================================= */
// function MaterialPickController({ active, enabled, baseCollidersRef, isBlocked, onPicked }) {
//   const { gl, camera, raycaster, pointer } = useThree();

//   const getAllObjects = useSceneObjectRegistryStore((s) => s.getAllObjects);

//   const extractMaterialInfo = useCallback((hit) => {
//     if (!hit) return null;

//     const obj = hit.object;
//     if (!obj) return null;

//     const matRaw = obj.material;
//     const mi = Number.isFinite(hit.materialIndex) ? hit.materialIndex : undefined;

//     let material = matRaw;
//     let materialIndex = mi;

//     if (Array.isArray(matRaw)) {
//       const idx = Number.isFinite(mi) ? mi : 0;
//       material = matRaw[idx] || matRaw[0] || null;
//       materialIndex = Number.isFinite(mi) ? mi : 0;
//     }

//     const normal = hit.face?.normal ? hit.face.normal.clone() : null;
//     if (normal && obj?.matrixWorld) normal.transformDirection(obj.matrixWorld);

//     const ownerItemId = obj?.userData?.itemId || obj?.parent?.userData?.itemId || null;

//     return {
//       material,
//       materialUuid: material?.uuid || null,
//       materialName: material?.name || "",
//       materialIndex: Number.isFinite(materialIndex) ? materialIndex : null,

//       objectUuid: obj.uuid,
//       objectName: obj.name || obj.userData?.name || "",

//       ownerItemId,

//       point: hit.point ? [hit.point.x, hit.point.y, hit.point.z] : null,
//       normal: normal ? [normal.x, normal.y, normal.z] : null,
//       uv: hit.uv ? [hit.uv.x, hit.uv.y] : null,
//     };
//   }, []);

//   const buildTargets = useCallback(() => {
//     const targets = [];

//     const base = baseCollidersRef?.current;
//     if (Array.isArray(base) && base.length > 0) targets.push(...base);

//     const objs = typeof getAllObjects === "function" ? getAllObjects() : [];
//     if (Array.isArray(objs) && objs.length > 0) targets.push(...objs);

//     const seen = new Set();
//     const uniq = [];
//     for (const t of targets) {
//       if (!t?.uuid) continue;
//       if (seen.has(t.uuid)) continue;
//       seen.add(t.uuid);
//       uniq.push(t);
//     }
//     return uniq;
//   }, [baseCollidersRef, getAllObjects]);

//   useEffect(() => {
//     if (!active) return;
//     if (!enabled) return;
//     if (isBlocked) return;

//     const el = gl.domElement;
//     let isPressing = false;


//    // ✁EmoveはpreventDefaultしなぁE��重くなる！E
//    const stopMove = (ev) => {
//      ev.stopPropagation?.();
//      ev.stopImmediatePropagation?.();
//    };
//    const stopDown = (ev) => {
//      ev.preventDefault?.();
//      ev.stopPropagation?.();
//      ev.stopImmediatePropagation?.();
//    };

//    const flush = () => {
//      rafIdRef.current = 0;
//      const ev = lastEvRef.current;
//      if (!ev) return;
//      const { x, y } = toNdc(ev.clientX, ev.clientY);
//      if (x < -1 || x > 1 || y < -1 || y > 1) return;
//      lastNdcRef.current = { x, y, t: performance.now() };
//    };

//     const onDownCapture = (ev) => {
//       if (ev.button !== 0) return;

//       const tag = String(ev.target?.tagName || "").toLowerCase();
//       if (tag === "input" || tag === "textarea") return;

//       isPressing = true;
//       stopAll(ev);

//       const rect = el.getBoundingClientRect();
//       const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
//       const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

//       pointer.set(x, y);
//       raycaster.setFromCamera(pointer, camera);

//       const targets = buildTargets();
//       if (!targets || targets.length === 0) return;

//       const hits = raycaster.intersectObjects(targets, true);
//       if (!hits || hits.length === 0) return;

//       const info = extractMaterialInfo(hits[0]);
//       if (!info) return;

//       useMaterialPickerStore.getState().commitScenePick(info);
//       onPicked?.(info);
//     };

//     const onMoveCapture = (ev) => {
//       if (!isPressing) return;
//       stopAll(ev);
//     };

//     const onUpCapture = (ev) => {
//       if (!isPressing) return;
//       isPressing = false;
//       stopAll(ev);
//     };

//     el.addEventListener("pointerdown", onDownCapture, true);
//     el.addEventListener("pointermove", onMoveCapture, true);
//     el.addEventListener("pointerup", onUpCapture, true);
//     el.addEventListener("pointercancel", onUpCapture, true);

//     return () => {
//       el.removeEventListener("pointerdown", onDownCapture, true);
//       el.removeEventListener("pointermove", onMoveCapture, true);
//       el.removeEventListener("pointerup", onUpCapture, true);
//       el.removeEventListener("pointercancel", onUpCapture, true);
//     };
//   }, [active, enabled, isBlocked, gl, camera, raycaster, pointer, buildTargets, extractMaterialInfo, onPicked]);

//   return null;
// }

// function MaterialCursorBinder({ enabled }) {
//   const { gl } = useThree();

//   useEffect(() => {
//     const el = gl?.domElement;
//     if (!el) return;

//     if (enabled) el.style.cursor = 'url("/cursors/eyedropper.png") 16 16, crosshair';
//     else el.style.cursor = "";

//     return () => {
//       if (!el) return;
//       el.style.cursor = "";
//     };
//   }, [enabled, gl]);

//   return null;
// }



// /* =========================================================
//  * SingleViewportCanvas
//  * ======================================================= */
// export default function SingleViewportCanvas({
//   viewportId,
//   type,
//   active = false,
//   onActivate,

//   onToggleMaximize,

//   isBaseReady,
//   displayBaseUrl,
//   pendingBaseUrl,
//   onPendingLoaded,

//   items = [],

//   onCanvasDrop,
//   onCanvasDragOver,
//   allowDrop = true,

//   lockToGround = true,
//   axisConstraint = "none",
//   snapEnabled = false,
//   snapStep = 0.5,
//   groundY = 0,

//   showGizmo = false,
//   gizmoMode = "translate",
//   gizmoSpace = "local",

//   onCommitTransform,
//   onCommitTransforms,

//   // Align中は items/state を更新しなぁE��針（確定時 commit のみ�E�E
//   onChangeTransform,
//   onChangeTransforms,

//   onRequestNumericOpen,
//   onRequestNumericClose,
//   numericCloseTick = 0,

//   focusTick = 0,
//   frameAllTick = 0,

//   speedMode = "walk",
//   speedMul = 1,
//   onChangeSpeedMode,
//   onSpeedMulChange,

//   onNavActiveChange,

//   registerViewportApi,

//   materialPicking = false,
//   onPickMaterial,
//   onGizmoHoverAxisChange,
//   onRequestCopy,
// }) {
//   const theme = useTheme();

//   // ============================================================
//   // ✁ECommandBar focus condition
//   // ============================================================
//   const commandOpen = useViewportUiStore((s) => s.commandOpen);

//   // ============================================================
//   // ✁EAlign tool state from store�E�Ewner/session方式！E
//   // ============================================================
//   const alignTick = useViewportUiStore((s) => s.alignTick);
//   const alignKey = useViewportUiStore((s) => s.alignKey);
//   const alignPhase = useViewportUiStore((s) => s.alignPhase);
//   const alignOwnerViewportId = useViewportUiStore((s) => s.alignOwnerViewportId);
//   const beginAlignSession = useViewportUiStore((s) => s.beginAlignSession);
//   const endAlignSession = useViewportUiStore((s) => s.endAlignSession);
//   const isAlignOwnerFn = useViewportUiStore((s) => s.isAlignOwner);

//   const isAlignOwner = isAlignOwnerFn?.(viewportId) && alignPhase !== "idle";
//   const setActiveViewportId = useViewportUiStore((s) => s.setActiveViewportId);

//   // ============================================================
//   // ✁Eselection store
//   // ============================================================
//   const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
//   const setSelectedItemId = useUiSelectionStore((s) => s.setSelectedItemId);
//   const setSelectedItemIds = useUiSelectionStore((s) => s.setSelectedItemIds);

//   const selectedItemId = useMemo(() => {
//     const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
//     return ids[0] ?? null;
//   }, [selectedItemIds]);

//   const clearSelection = useCallback(() => {
//     setSelectedItemIds?.([]);
//   }, [setSelectedItemIds, setSelectedItemId]);

//   // ============================================================
//   // ✁ECommandBar focus helper
//   // ============================================================
//   const focusCommandBar = useCallback(() => {
//     if (!commandOpen) return;

//     const api = useViewportUiStore.getState?.().toolbarApi;
//     if (!api?.focusCommand) return;

//     try {
//       api.focusCommand({ select: true });
//     } catch (e) {}

//     try {
//       if (typeof queueMicrotask === "function") queueMicrotask(() => api.focusCommand?.({ select: true }));
//       else Promise.resolve().then(() => api.focusCommand?.({ select: true }));
//     } catch {}

//     window.setTimeout(() => api.focusCommand?.({ select: true }), 0);
//   }, [commandOpen]);


//   const applySelectionIds = useCallback((ids, eventLike, source = "click") => {
//       const next = Array.isArray(ids) ? ids.filter(Boolean) : [];
//       const curr = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
//       const currSet = new Set(curr);

//       const shift = !!(
//         eventLike?.shiftKey ??
//         eventLike?.nativeEvent?.shiftKey
//       );

//       let out;
//       if (shift) {
//         // ✁ERhino�E�Shift はトグル�E�追加/解除�E�E
//         for (const id of next) {
//           if (currSet.has(id)) currSet.delete(id);
//           else currSet.add(id);
//         }
//         out = Array.from(currSet);
//       } else {
//         // ✁E置き換え（ドラチE��なら褁E��のまま入る！E
//         out = next;
//       }

//       setSelectedItemIds?.(out);

//       // ✁Emarquee中はフォーカスしなぁE��EommandBar側のuseEffectループ回避�E�E
//       if (!materialPicking && source !== "marquee") focusCommandBar();
//     },
//     [selectedItemIds, setSelectedItemIds, setSelectedItemId, materialPicking, focusCommandBar]
//   );




//   // ============================================================
//   // ✁EregistryMap を購読
//   // ============================================================
//   const registryMap = useSceneObjectRegistryStore((s) => s.map);

//   // ✁EobjectsRef�E�既孁Ehooks 互換�E�E
//   const objectsRef = useRef(new Map());
//   useEffect(() => {
//     if (registryMap && registryMap instanceof Map) objectsRef.current = registryMap;
//     else objectsRef.current = new Map();
//   }, [registryMap]);

//   // ✁EselectedObject�E�Erimary�E�E
//   const selectedObject = useMemo(() => {
//     if (!selectedItemId) return null;
//     return registryMap?.get(selectedItemId) || null;
//   }, [selectedItemId, registryMap]);

//   // ✁EAlign mode は “owner canvas Eのみが持つ local state
//   const [alignMode, setAlignMode] = useState(null);

//   const [isGizmoDragging, setIsGizmoDragging] = useState(false);
//   const [isGizmoUiActive, setIsGizmoUiActive] = useState(false);
//   const [hoverAxis, setHoverAxis] = useState(null);

//   // ============================================================
//   // ✁ESnap tuning�E�ヒスチE��シス + TimeLock�E�E
//   // ============================================================
//   const SNAP_ENGAGE = 0.25;
//   const SNAP_RELEASE = 0.42;
//   const SNAP_SWITCH_MARGIN = 0.003;
//   const SNAP_TIME_LOCK_MS = 200;

//   const snapLockRef = useRef({
//     x: { value: null, until: 0 },
//     y: { value: null, until: 0 },
//     z: { value: null, until: 0 },
//   });

//   const clearSnapLocks = useCallback(() => {
//     snapLockRef.current.x.value = null;
//     snapLockRef.current.y.value = null;
//     snapLockRef.current.z.value = null;
//     snapLockRef.current.x.until = 0;
//     snapLockRef.current.y.until = 0;
//     snapLockRef.current.z.until = 0;
//   }, []);

//   useEffect(() => {
//     clearSnapLocks();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [alignMode?.key, alignMode?.axis]);

//   // ============================================================
//   // ✁ESnap candidates cache�E�Elign開始時に一度だけ作る�E�E
//   // ============================================================
//   const snapCandidatesRef = useRef({ x: [], y: [], z: [], key: "" });

//   const speedPreset = useMemo(() => {
//     const presets = {
//       inspect: { move: 1.2, vertical: 1.2 },
//       walk: { move: 3.0, vertical: 3.0 },
//       cycle: { move: 7.0, vertical: 5.0 },
//       drive: { move: 14.0, vertical: 7.0 },
//       fly: { move: 28.0, vertical: 18.0 },
//     };
//     return presets[speedMode] || presets.walk;
//   }, [speedMode]);

//   const rootRef = useRef(null);
//   const orbitRef = useRef(null);
//   const baseRootRef = useRef(null);
//   const baseCollidersRef = useRef([]);

//   const baseBoundsRef = useRef(null);
//   const didInitCameraRef = useRef(false);

//   useEffect(() => {
//     didInitCameraRef.current = false;
//     baseBoundsRef.current = null;
//   }, [displayBaseUrl, type]);

//   const frameCameraToBase = useCallback(
//     ({ force = false } = {}) => {
//       const b = baseBoundsRef.current;
//       const controls = orbitRef.current;
//       if (!b || !controls) return;
//       if (!force && didInitCameraRef.current) return;

//       const cam = controls.object;
//       if (!cam) return;

//       const center = b.center;
//       const maxDim = b.maxDim;
//       const dir = new THREE.Vector3(1, 0.85, 1).normalize();
//       const dist = Math.max(8, maxDim * 1.6);

//       controls.target.copy(center);

//       if (type === VIEW_TYPES.PERSPECTIVE) {
//         cam.position.copy(center).addScaledVector(dir, dist);
//         cam.near = Math.max(0.01, dist / 200);
//         cam.far = Math.max(2000, dist * 50);
//         cam.updateProjectionMatrix();
//         controls.update();
//         didInitCameraRef.current = true;
//         return;
//       }

//       const orthoDist = Math.max(20, maxDim * 1.2);
//       if (type === VIEW_TYPES.TOP) cam.position.set(center.x, center.y + orthoDist, center.z);
//       if (type === VIEW_TYPES.FRONT) cam.position.set(center.x, center.y, center.z + orthoDist);
//       if (type === VIEW_TYPES.RIGHT) cam.position.set(center.x + orthoDist, center.y, center.z);

//       cam.updateProjectionMatrix();
//       controls.update();
//       didInitCameraRef.current = true;
//     },
//     [type]
//   );

//   const handleBaseLoaded = useCallback(
//     (rootGroup) => {
//       baseRootRef.current = rootGroup || null;
//       baseCollidersRef.current = [];
//       if (!rootGroup) return;

//       const meshes = [];
//       rootGroup.traverse?.((o) => {
//         if (o?.isMesh) meshes.push(o);
//       });
//       baseCollidersRef.current = meshes;

//       const box = new THREE.Box3().setFromObject(rootGroup);
//       const size = new THREE.Vector3();
//       const center = new THREE.Vector3();
//       box.getSize(size);
//       box.getCenter(center);

//       const maxDim = Math.max(size.x, size.y, size.z);
//       if (Number.isFinite(maxDim) && maxDim > 0) {
//         baseBoundsRef.current = { center, size, maxDim };
//         requestAnimationFrame(() => frameCameraToBase());
//       }
//     },
//     [frameCameraToBase]
//   );

//   const normalizedItems = useMemo(() => {
//     if (!Array.isArray(items)) return [];
//     return items.map((it, idx) => ({
//       ...it,
//       id: it?.id || it?.itemId || it?.modelId || `${it?.modelId || "item"}_${idx}`,
//     }));
//   }, [items]);

//   const selectedItem = useMemo(() => {
//     if (!selectedItemId) return null;
//     return normalizedItems.find((x) => x.id === selectedItemId) || null;
//   }, [normalizedItems, selectedItemId]);

//   const currentPos = useMemo(() => {
//     const p = selectedItem?.transform?.position || [0, 0.3, 0];
//     return [p[0] ?? 0, p[1] ?? 0.3, p[2] ?? 0];
//   }, [selectedItem]);

//   const selectedSet = useMemo(() => {
//     const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
//     return new Set(ids);
//   }, [selectedItemIds]);

//   // ============================================================
//   // ✁EAlign: 対象IDs�E�Erimary + 追従！E
//   // ============================================================
//   const alignSelectedIds = useMemo(() => {
//     const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
//     if (ids.length > 0) return ids;
//     return selectedItemId ? [selectedItemId] : [];
//   }, [selectedItemIds, selectedItemId]);

//   const alignSelectedObjects = useMemo(() => {
//     const out = [];
//     const map = registryMap;
//     if (!map) return out;
//     for (const id of alignSelectedIds) {
//       const obj = map.get(id);
//       if (obj) out.push({ itemId: id, object: obj });
//     }
//     return out;
//   }, [alignSelectedIds, registryMap]);

//   // ============================================================
//   // ✁EAlign commit�E�Ewnerのみ�E�E
//   // ============================================================
//   const handleCommitAlignSingle = useCallback(
//     (t) => {
//       if (!selectedItemId) return;
//       onCommitTransform?.({ itemId: selectedItemId, transform: t });
//     },
//     [selectedItemId, onCommitTransform]
//   );

//   const stopAlignLocal = useCallback(() => {
//     setAlignMode(null);
//     if (orbitRef.current) orbitRef.current.enabled = true;
//     clearSnapLocks();
//   }, [clearSnapLocks]);

//   const endAlign = useCallback(() => {
//     stopAlignLocal();
//     endAlignSession?.();
//   }, [stopAlignLocal, endAlignSession]);

//   const commitAlign = useCallback(() => {
//     if (!isAlignOwner) return;
//     if (!selectedItemId || !selectedObject) return;

//     // ✁E褁E��なら一括 commit
//     if (alignSelectedObjects.length > 1 && typeof onCommitTransforms === "function") {
//       const updates = alignSelectedObjects.map((it) => {
//         const obj = it.object;
//         obj.updateMatrixWorld?.(true);
//         return {
//           itemId: it.itemId,
//           transform: {
//             position: [obj.position.x, obj.position.y, obj.position.z],
//             rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
//             scale: [obj.scale.x, obj.scale.y, obj.scale.z],
//           },
//         };
//       });
//       onCommitTransforms(updates);
//       endAlign();
//       return;
//     }

//     // ✁E単体互換
//     selectedObject.updateMatrixWorld?.(true);
//     const p = selectedObject.position;

//     handleCommitAlignSingle({
//       position: [p.x, p.y, p.z],
//       rotation: selectedItem?.transform?.rotation,
//       scale: selectedItem?.transform?.scale,
//     });

//     endAlign();
//   }, [
//     isAlignOwner,
//     selectedItemId,
//     selectedObject,
//     alignSelectedObjects,
//     onCommitTransforms,
//     handleCommitAlignSingle,
//     selectedItem?.transform,
//     endAlign,
//   ]);

//   // ============================================================
//   // ✁ESnap candidates builder�E�Elign開始時に xyz 全部作ってキャチE��ュ�E�E
//   // ============================================================
//   const buildSnapCandidatesAllAxes = useCallback(() => {
//     const out = { x: [], y: [], z: [] };

//     const pushFromBox = (box) => {
//       if (!box || box.isEmpty()) return;
//       const center = new THREE.Vector3();
//       box.getCenter(center);

//       out.x.push(box.min.x, box.max.x, center.x);
//       out.y.push(box.min.y, box.max.y, center.y);
//       out.z.push(box.min.z, box.max.z, center.z);
//     };

//     if (baseRootRef.current) {
//       const b = new THREE.Box3().setFromObject(baseRootRef.current);
//       pushFromBox(b);
//     }

//     const map = objectsRef.current;
//     map?.forEach?.((obj, id) => {
//       if (!obj) return;
//       // ✁EAlign中 primary だけ除外（他�E選択も含めて候補にしてOK�E�E
//       if (id === selectedItemId) return;
//       const b = new THREE.Box3().setFromObject(obj);
//       pushFromBox(b);
//     });

//     const uniqAxis = (arr) => {
//       const uniq = [];
//       const eps = 1e-4;
//       for (const v of arr) {
//         if (!Number.isFinite(v)) continue;
//         if (!uniq.some((u) => Math.abs(u - v) < eps)) uniq.push(v);
//       }
//       return uniq;
//     };

//     out.x = uniqAxis(out.x);
//     out.y = uniqAxis(out.y);
//     out.z = uniqAxis(out.z);

    
//     return out;
//   }, [selectedItemId]);

//   // ============================================================
//   // ✁EShift key (temporary snap)
//   // ============================================================
//   const shiftSnapRef = useRef(false);

//   const getSnapActive = useCallback(() => {
//     return !!(snapEnabled || shiftSnapRef.current);
//   }, [snapEnabled]);

//   useEffect(() => {
//     const onKeyDown = (e) => {
//       if (e.key === "Shift") shiftSnapRef.current = true;
//     };
//     const onKeyUp = (e) => {
//       if (e.key === "Shift") shiftSnapRef.current = false;
//     };
//     window.addEventListener("keydown", onKeyDown);
//     window.addEventListener("keyup", onKeyUp);
//     return () => {
//       window.removeEventListener("keydown", onKeyDown);
//       window.removeEventListener("keyup", onKeyUp);
//     };
//   }, []);

//   // ============================================================
//   // ✁ESnap (Hysteresis + TimeLock)
//   // - 3rd引数 offset は呼び出し互換のため受け取るだけ！Enapは anchor 値に掛ける�Eで基本不要E��E
//   // ============================================================
//   const snapAxisValue = useCallback(
//     (raw, axis, wallCandidate /*, offset*/) => {
//       const slot = snapLockRef.current?.[axis];
//       const snapActive = getSnapActive();

//       // ✁ESnap OFF ↁE生値
//       if (!snapActive) return raw;

//       const baseCandidates = snapCandidatesRef.current?.[axis] || [];
//       const candidates = Array.isArray(baseCandidates) ? baseCandidates : [];

//       // slot が無ぁE��ースは通常なぁE��ど、安�Eに
//       if (!slot) return raw;

//       const now = performance.now();
//       const lock = slot.value;

//       const ENGAGE = SNAP_ENGAGE;   // ✁E固宁E
//       const RELEASE = SNAP_RELEASE; // ✁E固宁E
//       const HARD_BREAK = RELEASE * 2.0;

//       // =========================
//       // 1) 既にロチE��中なら基本は保持
//       // =========================
//       if (Number.isFinite(lock)) {
//         const lockDist = Math.abs(lock - raw);

//         // ロチE��時間冁E�E lock に固定（ただし大きく離れたら解除�E�E
//         if (now < slot.until) {
//           if (lockDist > HARD_BREAK) {
//             slot.value = null;
//             slot.until = 0;
//           } else {
//             return lock;
//           }
//         }
//       }

//       // =========================
//       // 2) 最も近い candidate を探ぁE
//       // =========================
//       let best = raw;
//       let bestDist = Infinity;

//       for (let i = 0; i < candidates.length; i++) {
//         const c = candidates[i];
//         if (!Number.isFinite(c)) continue;
//         const d = Math.abs(c - raw);
//         if (d < bestDist) {
//           bestDist = d;
//           best = c;
//         }
//       }

//       // =========================
//       // 3) ロチE��がある場合：RELEASEまではロチE��維持E
//       //    ただし、より近い候補がENGAGE冁E��ら乗り換え可
//       // =========================
//       if (Number.isFinite(lock)) {
//         const lockDist = Math.abs(lock - raw);

//         if (lockDist <= RELEASE) {
//           if (bestDist + SNAP_SWITCH_MARGIN < lockDist && bestDist <= ENGAGE) {
//             slot.value = best;
//             slot.until = now + SNAP_TIME_LOCK_MS;
//             return best;
//           }
//           return lock;
//         }

//         // RELEASEを趁E��たらロチE��解除
//         slot.value = null;
//         slot.until = 0;
//       }

//       // =========================
//       // 4) 新規スナップ：ENGAGE冁E��ら吸ぁE��く
//       // =========================
//       if (bestDist <= ENGAGE) {
//         slot.value = best;
//         slot.until = now + SNAP_TIME_LOCK_MS;
//         return best;
//       }

//       // 近い候補が無ぁEↁE生値
//       return raw;
//     },
//     [getSnapActive, SNAP_ENGAGE, SNAP_RELEASE, SNAP_SWITCH_MARGIN, SNAP_TIME_LOCK_MS]
//   );


//   // ============================================================
//   // ✁EAlign: 軸決宁E
//   // ============================================================
//   const getAxisByKeyForView = useCallback(
//     (key) => {
//       const isTopLike = type === VIEW_TYPES.TOP || type === VIEW_TYPES.PERSPECTIVE;

//       if (isTopLike) {
//         if (key === "left" || key === "right" || key === "vcenter") return "x";
//         return "z";
//       }

//       if (type === VIEW_TYPES.FRONT) {
//         if (key === "left" || key === "right" || key === "vcenter") return "x";
//         return "y";
//       }

//       if (type === VIEW_TYPES.RIGHT) {
//         if (key === "left" || key === "right" || key === "vcenter") return "z";
//         return "y";
//       }

//       return null;
//     },
//     [type]
//   );

//   const getAnchorKind = useCallback((key) => {
//     if (key === "left" || key === "top") return "min";
//     if (key === "right" || key === "bottom") return "max";
//     return "center";
//   }, []);

//   const beginAlignLocal = useCallback(
//     (key) => {
//       if (!selectedItemId || !selectedObject) return false;

//       const axis = getAxisByKeyForView(key);
//       if (axis !== "x" && axis !== "y" && axis !== "z") return false;

//       const anchorKind = getAnchorKind(key);

//       if (orbitRef.current) orbitRef.current.enabled = false;

//       selectedObject.updateMatrixWorld?.(true);

//       // ✁Eprimary の anchor offset
//       const box = new THREE.Box3().setFromObject(selectedObject);
//       const center = new THREE.Vector3();
//       box.getCenter(center);

//       const p = selectedObject.position;
//       const posAxis = axis === "x" ? p.x : axis === "y" ? p.y : p.z;

//       const anchorAxis =
//         anchorKind === "min"
//           ? axis === "x"
//             ? box.min.x
//             : axis === "y"
//             ? box.min.y
//             : box.min.z
//           : anchorKind === "max"
//           ? axis === "x"
//             ? box.max.x
//             : axis === "y"
//             ? box.max.y
//             : box.max.z
//           : axis === "x"
//           ? center.x
//           : axis === "y"
//           ? center.y
//           : center.z;

//       const offset = posAxis - anchorAxis;

//       // ✁Egroup bounds�E�褁E��選択時の壁制限�Eため�E�E
//       let groupBoundsOffsets = null;
//       if (alignSelectedObjects.length > 1 && (axis === "x" || axis === "z")) {
//         const groupBox = new THREE.Box3();
//         for (const it of alignSelectedObjects) {
//           const obj = it.object;
//           if (!obj) continue;
//           obj.updateMatrixWorld?.(true);
//           groupBox.union(new THREE.Box3().setFromObject(obj));
//         }
//         if (!groupBox.isEmpty()) {
//           if (axis === "x") {
//             groupBoundsOffsets = {
//               minX: p.x - groupBox.min.x,
//               maxX: p.x - groupBox.max.x,
//               minZ: 0,
//               maxZ: 0,
//             };
//           } else {
//             groupBoundsOffsets = {
//               minX: 0,
//               maxX: 0,
//               minZ: p.z - groupBox.min.z,
//               maxZ: p.z - groupBox.max.z,
//             };
//           }
//         }
//       }

//       let planeNormal = new THREE.Vector3(0, 1, 0);
//       let planeConstant = -groundY;

//       if (type === VIEW_TYPES.FRONT) {
//         const planeZ = p.z;
//         planeNormal = new THREE.Vector3(0, 0, 1);
//         planeConstant = -planeZ;
//       } else if (type === VIEW_TYPES.RIGHT) {
//         const planeX = p.x;
//         planeNormal = new THREE.Vector3(1, 0, 0);
//         planeConstant = -planeX;
//       } else {
//         planeNormal = new THREE.Vector3(0, 1, 0);
//         planeConstant = -groundY;
//       }

//       clearSnapLocks();

//       if (snapEnabled) {
//         const sig = `${selectedItemId}:${normalizedItems?.length || 0}:${baseCollidersRef.current?.length || 0}`;
//         snapCandidatesRef.current = { ...buildSnapCandidatesAllAxes(), key: sig };
//       } else {
//         snapCandidatesRef.current = { x: [], y: [], z: [], key: "" };
//       }

//        const itemOffsets = {};
//        for (const it of alignSelectedObjects) {
//          const obj = it.object;
//          if (!obj) continue;
      
//          obj.updateMatrixWorld?.(true);
//          const box = new THREE.Box3().setFromObject(obj);
//          const center = new THREE.Vector3();
//          box.getCenter(center);
      
//          const p = obj.position;
//          const posAxis = axis === "x" ? p.x : axis === "y" ? p.y : p.z;
//          const anchorAxis =
//            anchorKind === "min"
//              ? axis === "x" ? box.min.x : axis === "y" ? box.min.y : box.min.z
//              : anchorKind === "max"
//              ? axis === "x" ? box.max.x : axis === "y" ? box.max.y : box.max.z
//              : axis === "x" ? center.x : axis === "y" ? center.y : center.z;
      
//          itemOffsets[it.itemId] = posAxis - anchorAxis;
//        }

//       setAlignMode({
//         key,
//         axis,
//         offset,
//         planeNormal,
//         planeConstant,
//         groupBoundsOffsets,
//         itemOffsets,
//       });
//       return true;
//     },
//     [
//       selectedItemId,
//       selectedObject,
//       type,
//       groundY,
//       getAxisByKeyForView,
//       getAnchorKind,
//       clearSnapLocks,
//       snapEnabled,
//       buildSnapCandidatesAllAxes,
//       normalizedItems?.length,
//       alignSelectedObjects,
//     ]
//   );

//   useEffect(() => {
//     clearSnapLocks();

//     if (!alignMode) return;

//     if (snapEnabled) {
//       const sig = `${selectedItemId}:${normalizedItems?.length || 0}:${baseCollidersRef.current?.length || 0}`;
//       snapCandidatesRef.current = { ...buildSnapCandidatesAllAxes(), key: sig };
//     } else {
//       snapCandidatesRef.current = { x: [], y: [], z: [], key: "" };
//     }
//   }, [snapEnabled, alignMode, selectedItemId, normalizedItems?.length, buildSnapCandidatesAllAxes, clearSnapLocks]);

//   // ✁EAlignイベント消費�E�owner canvas だけが開始する！Ective に依存しなぁE��E
//   const lastAlignTickRef = useRef(0);
//   useEffect(() => {
//     if (!alignTick || alignTick === lastAlignTickRef.current) return;
//     lastAlignTickRef.current = alignTick;

//     if (!alignKey) return;

//     if (alignOwnerViewportId !== viewportId) return;

//     if (materialPicking || isGizmoDragging) {
//       endAlignSession?.();
//       stopAlignLocal();
//       return;
//     }

//     if (!selectedItemId || !selectedObject) {
//       endAlignSession?.();
//       stopAlignLocal();
//       return;
//     }

//     beginAlignSession?.({ viewportId });
//     setActiveViewportId?.(viewportId);
//     if (!active) onActivate?.(viewportId);

//     const ok = beginAlignLocal(alignKey);
//     if (!ok) {
//       endAlignSession?.();
//       stopAlignLocal();
//     }
//   }, [
//     alignTick,
//     alignKey,
//     alignOwnerViewportId,
//     viewportId,
//     beginAlignSession,
//     endAlignSession,
//     materialPicking,
//     isGizmoDragging,
//     active,
//     onActivate,
//     beginAlignLocal,
//     selectedItemId,
//     selectedObject,
//     stopAlignLocal,
//     setActiveViewportId,
//   ]);

//   useEffect(() => {
//     registerViewportApi?.(viewportId, {
//       align: (key) => {
//         if (!active) onActivate?.(viewportId);
//         beginAlignLocal(key);
//       },
//     });
//     return () => registerViewportApi?.(viewportId, null);
//   }, [registerViewportApi, viewportId, beginAlignLocal, active, onActivate]);

//   const requestCopy = useCallback(() => {
//     onRequestCopy?.({ offset: [0.2, 0, 0.2] });
//   }, [onRequestCopy]);

//   const requestMirror = useCallback(({ axis }) => {
//     // ぁE��たんログでもOK�E�次にmirrorOpsへ�E�E
//     console.log("[mirror]", axis);
//   }, []);

//   useEffect(() => {
//     registerViewportApi?.({
//       requestCopy,
//       requestMirror,
//       // requestGroup / requestUngroup もここに雁E��E��てぁE��と綺麁E
//     });
//     return () => registerViewportApi?.(null);
//   }, [registerViewportApi, requestCopy, requestMirror]);


//   const isOrtho = type !== VIEW_TYPES.PERSPECTIVE;
//   const marqueeEnabled = active && isOrtho && !alignMode && !isGizmoDragging && !isGizmoUiActive && !materialPicking;

//   const { handlers, marqueeRect, isMarqueeActive, cancel: cancelMarquee } = useMarqueeSelection({
//     enabled: marqueeEnabled,
//     rootRef,
//     orbitRef,
//     objectsRef,
//     onPickIds: (ids, e) => {
//       console.log("[marquee ids]", ids, "shift", e?.shiftKey);
//       if (!active) return;
//       applySelectionIds(ids, e, "marquee");
//     },
//     onPickId: (id, e) => {
//       if (!active) return;
//       applySelectionIds(id ? [id] : [], e, "marquee");
//     },
//   });

//   useEffect(() => {
//     if (isGizmoDragging || isGizmoUiActive || materialPicking) cancelMarquee?.();
//   }, [isGizmoDragging, isGizmoUiActive, materialPicking, cancelMarquee]);

//   // ============================================================
//   // ✁ERMB nav state
//   // ============================================================
//   const rmbRef = useRef(false);
//   const [isNavActive, setIsNavActive] = useState(false);

//   const setRmb = useCallback(
//     (next) => {
//       const v = !!next;
//       if (rmbRef.current === v) return;
//       rmbRef.current = v;
//       setIsNavActive(v);
//       onNavActiveChange?.(v);
//     },
//     [onNavActiveChange]
//   );

//   useEffect(() => {
//     if (!active) return;
//     const up = (e) => e.button === 2 && setRmb(false);
//     const blur = () => setRmb(false);
//     window.addEventListener("pointerup", up);
//     window.addEventListener("blur", blur);
//     return () => {
//       window.removeEventListener("pointerup", up);
//       window.removeEventListener("blur", blur);
//     };
//   }, [active, setRmb]);

//   const ortho = useMemo(() => (isOrtho ? getOrthoPreset(type) : null), [isOrtho, type]);

//   const label =
//     type === VIEW_TYPES.TOP ? "Top" : type === VIEW_TYPES.FRONT ? "Front" : type === VIEW_TYPES.RIGHT ? "Right" : "Perspective";

//   // =========================
//   // Numeric apply / Gizmo / etc…
//   // =========================
//   const readTransformFromObj = useCallback((obj) => {
//     if (!obj) return null;
//     obj.updateMatrixWorld?.(true);
//     return {
//       position: [obj.position.x, obj.position.y, obj.position.z],
//       rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
//       scale: [obj.scale.x, obj.scale.y, obj.scale.z],
//     };
//   }, []);

//   const getAxisVec = useCallback((axis) => {
//     if (axis === "X") return new THREE.Vector3(1, 0, 0);
//     if (axis === "Y") return new THREE.Vector3(0, 1, 0);
//     if (axis === "Z") return new THREE.Vector3(0, 0, 1);
//     return null;
//   }, []);

//   const getSelectedIds = useCallback(() => {
//     const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
//     if (ids.length > 0) return ids;
//     return selectedItemId ? [selectedItemId] : [];
//   }, [selectedItemIds, selectedItemId]);

//   const applyNumericToObjects = useCallback(
//     ({ axis, mode, space, raw }) => {
//       const n = Number(String(raw ?? "").trim());
//       if (!Number.isFinite(n)) return;

//       const ids = getSelectedIds();
//       if (ids.length === 0) return;

//       const targets = ids.map((id) => ({ id, obj: objectsRef.current.get(id) })).filter((x) => !!x.obj);
//       if (targets.length === 0) return;

//       const ax = getAxisVec(axis);
//       const isXYZ = axis === "XYZ";

//       if (mode === "translate") {
//         if (!ax) return;
//         const dist = n / 1000;
//         targets.forEach(({ obj }) => {
//           const dir = ax.clone();
//           if (space === "local") dir.applyQuaternion(obj.quaternion);
//           dir.normalize();
//           obj.position.addScaledVector(dir, dist);
//         });
//       }

//       if (mode === "rotate") {
//         if (!ax) return;
//         const rad = THREE.MathUtils.degToRad(n);
//         targets.forEach(({ obj }) => {
//           const axisN = ax.clone().normalize();
//           if (space === "world") obj.rotateOnWorldAxis(axisN, rad);
//           else obj.rotateOnAxis(axisN, rad);
//         });
//       }

//       if (mode === "scale") {
//         const f = n;
//         if (!Number.isFinite(f) || f === 0) return;
//         targets.forEach(({ obj }) => {
//           if (isXYZ) obj.scale.multiplyScalar(f);
//           else {
//             if (axis === "X") obj.scale.x *= f;
//             if (axis === "Y") obj.scale.y *= f;
//             if (axis === "Z") obj.scale.z *= f;
//           }
//         });
//       }

//       const updates = targets
//         .map(({ id, obj }) => {
//           const t = readTransformFromObj(obj);
//           if (!t) return null;

//           let nextT = t;
//           if (type === VIEW_TYPES.TOP) {
//             nextT = optimizeTopPlacement({
//               transform: nextT,
//               currentPos,
//               lockToGround,
//               groundY,
//               axisConstraint,
//               snapEnabled,
//               snapStep,
//             });
//             obj.position.fromArray(nextT.position);
//             obj.rotation.set(...nextT.rotation);
//             obj.scale.fromArray(nextT.scale);
//           }
//           return { itemId: id, transform: nextT };
//         })
//         .filter(Boolean);

//       if (updates.length === 0) return;

//       if (updates.length > 1 && typeof onCommitTransforms === "function") onCommitTransforms(updates);
//       else onCommitTransform?.(updates[0]);
//     },
//     [
//       getSelectedIds,
//       getAxisVec,
//       readTransformFromObj,
//       type,
//       currentPos,
//       lockToGround,
//       groundY,
//       axisConstraint,
//       snapEnabled,
//       snapStep,
//       onCommitTransform,
//       onCommitTransforms,
//     ]
//   );

//   const handleNumericOpenFromGizmo = useCallback(
//     ({ axis, mode, space }) => {
//       setHoverAxis(axis || null);
//       setIsGizmoUiActive(!!axis);

//       onRequestNumericOpen?.({
//         axis,
//         mode,
//         space,
//         applyNumeric: ({ axis: a, raw }) => {
//           applyNumericToObjects({
//             axis: a || axis,
//             mode: mode || gizmoMode,
//             space: space || gizmoSpace,
//             raw,
//           });
//         },
//       });
//     },
//     [onRequestNumericOpen, applyNumericToObjects, gizmoMode, gizmoSpace]
//   );

//   const handleNumericCloseFromGizmo = useCallback(() => {
//     setHoverAxis(null);
//     setIsGizmoUiActive(false);
//     onRequestNumericClose?.();
//   }, [onRequestNumericClose]);

//   useEffect(() => {
//     setHoverAxis(null);
//     setIsGizmoUiActive(false);
//   }, [numericCloseTick]);

//   const showGizmoSafe = showGizmo && !alignMode && !materialPicking;
//   const allowDropSafe = allowDrop && !materialPicking;
//   const pointerMissedEnabled = !materialPicking;

//   // ✁EAlign用�E�最後�Eマウス位置�E�EDC�E�E
//   const lastAlignNdcRef = useRef({ x: 0, y: 0, t: 0 });

//   // ✁EownerじゃないCanvasは label に Align を�EさなぁE
//   const chipLabel = useMemo(() => {
//     if (materialPicking) return `${label} • Material Pick`;
//     if (isAlignOwner && alignMode) return `${label} • Align (${alignMode.key})`;
//     return label;
//   }, [materialPicking, label, isAlignOwner, alignMode]);

//   return (
//     <Box
//       className="ViewportCanvasRoot"
//       ref={rootRef}
//       sx={{
//         position: "relative",
//         width: "100%",
//         height: "100%",
//         overflow: "hidden",
//         border: active ? `1px solid ${alpha(theme.palette.primary.main, 0.65)}` : `1px solid ${alpha("#fff", 0.08)}`,
//         background: alpha("#050815", 0.55),
//         userSelect: "none",
//       }}
//       onPointerDownCapture={(e) => {
//         setActiveViewportId?.(viewportId);
//         onActivate?.(viewportId);
//         if (e.button === 2) setRmb(true);

//         if (materialPicking) return;
//         if (!isGizmoDragging && !isGizmoUiActive && marqueeEnabled) handlers?.onPointerDown?.(e);
//       }}
//       onPointerMoveCapture={(e) => {
//         setActiveViewportId?.(viewportId);
//         if (materialPicking) return;
//         if (!isGizmoDragging && !isGizmoUiActive && marqueeEnabled) handlers?.onPointerMove?.(e);
//       }}
//       onPointerUp={(e) => {
//         if (e.button === 2) setRmb(false);
//         if (materialPicking) return;
//         if (!isGizmoDragging && !isGizmoUiActive && marqueeEnabled) handlers?.onPointerUp?.(e);
//       }}
//       onPointerCancel={(e) => {
//         if (materialPicking) return;
//         if (!isGizmoDragging && !isGizmoUiActive && marqueeEnabled) handlers?.onPointerCancel?.(e);
//       }}
//       onPointerLeave={() => {
//         if (marqueeEnabled && isMarqueeActive) cancelMarquee?.();
//       }}
//       onDragOver={(e) => allowDropSafe && onCanvasDragOver?.(e)}
//       onDrop={(e) => allowDropSafe && onCanvasDrop?.(e)}
//     >
//       {marqueeEnabled && marqueeRect && (
//         <Box
//           sx={{
//             position: "absolute",
//             left: marqueeRect.x,
//             top: marqueeRect.y,
//             width: marqueeRect.w,
//             height: marqueeRect.h,
//             zIndex: 20,
//             pointerEvents: "none",
//             border: `1px solid ${alpha(theme.palette.primary.main, 0.9)}`,
//             background: alpha(theme.palette.primary.main, 0.12),
//             boxShadow: `0 0 0 1px ${alpha("#000", 0.35)} inset`,
//           }}
//         />
//       )}

//       <Chip
//         size="small"
//         label={chipLabel}
//         onDoubleClick={(e) => {
//           e.preventDefault();
//           e.stopPropagation();
//           setActiveViewportId?.(viewportId);
//           onActivate?.(viewportId);
//           onToggleMaximize?.();
//         }}
//         sx={{
//           position: "absolute",
//           top: 10,
//           left: 10,
//           zIndex: 25,
//           bgcolor: alpha("#000", 0.42),
//           color: "#fff",
//           cursor: "pointer",
//           userSelect: "none",
//         }}
//       />

//       {active && type === VIEW_TYPES.PERSPECTIVE && (
//         <ViewportQuickMenu speedMode={speedMode} onChangeSpeedMode={onChangeSpeedMode} speedMul={speedMul} />
//       )}

//       <Canvas
//         frameloop="always"
//         dpr={[1, 2]}
//         gl={{ powerPreference: "high-performance", antialias: true }}
//         onPointerMissed={() => {
//           if (!active) return;
//           if (!pointerMissedEnabled) return;
//           if (isMarqueeActive) return;
//           if (alignMode) return;
//           if (isGizmoDragging) return;
//           if (isGizmoUiActive) return;
//           clearSelection();
//         }}
//       >
//         <MaterialCursorBinder enabled={!!materialPicking} />
//         <AlignCursorBinder enabled={!!isAlignOwner && !!alignMode && !materialPicking} />


//         <MaterialPickController
//           active={active}
//           enabled={materialPicking}
//           baseCollidersRef={baseCollidersRef}
//           isBlocked={!!alignMode || isGizmoDragging}
//           onPicked={onPickMaterial}
//         />

//         {/* ✁EAlign�E�owner一致のviewportだけ動く（褁E��も同じΔで追従！E*/}
//         <SmoothAlignFollower
//           active={!!isAlignOwner && !!alignMode && !materialPicking}
//           primaryObject={selectedObject}
//           selectedObjects={alignSelectedObjects}
//           alignMode={alignMode}
//           groundY={groundY}
//           snapAxisValue={snapAxisValue}
//           baseCollidersRef={baseCollidersRef}
//           wallEps={0.02}
//           wallMaxDist={200}
//           lastNdcRef={lastAlignNdcRef}
//           damping={32}
//           getSnapActive={getSnapActive}
//           onPreviewTransform={onChangeTransform}
//           onPreviewTransforms={onChangeTransforms}
//           previewItemId={selectedItemId}
//           previewThrottleMs={33}
//         />

//         {/* ✁Epointer は owner の時だけ！Eindow監視！E*/}
//         <AlignPointerController
//           enabled={!!isAlignOwner && !!alignMode && !materialPicking}
//           onConfirm={commitAlign}
//           lastNdcRef={lastAlignNdcRef}
//           isNavActive={isNavActive}
//         />

//         {type === VIEW_TYPES.PERSPECTIVE && <PerspectiveCamera makeDefault position={[24, 18, 24]} fov={50} />}
//         {type !== VIEW_TYPES.PERSPECTIVE && <OrthographicCamera makeDefault position={ortho.position} up={ortho.up} zoom={ortho.zoom} />}

//         <Lights />
//         <SceneGrid />

//         {type !== VIEW_TYPES.PERSPECTIVE ? (
//           <>
//             <OrbitControls
//               key={`${viewportId}-${type}`}
//               ref={orbitRef}
//               enableRotate={false}
//               enabled={active && !alignMode && !isGizmoDragging}
//             />
//             <OrthoControlsBinder
//               enabled={active && !alignMode && !isGizmoDragging}
//               orbitRef={orbitRef}
//               selectedObject={selectedObject}
//               moveSpeed={speedPreset.move}
//               verticalSpeed={speedPreset.vertical}
//               onSpeedChange={onSpeedMulChange}
//             />
//           </>
//         ) : (
//           <>
//             <OrbitControls ref={orbitRef} enabled={active && !alignMode && !isGizmoDragging} />
//             <PerspectiveControlsBinder
//               enabled={active && !alignMode && !isGizmoDragging}
//               orbitRef={orbitRef}
//               selectedObject={selectedObject}
//               moveSpeed={speedPreset.move}
//               verticalSpeed={speedPreset.vertical}
//               onSpeedChange={onSpeedMulChange}
//             />
//           </>
//         )}

//         <ViewportFramingController
//           active={active}
//           type={type}
//           orbitRef={orbitRef}
//           selectedObject={selectedObject}
//           objectsRef={objectsRef}
//           baseRootRef={baseRootRef}
//           focusTick={focusTick}
//           frameAllTick={frameAllTick}
//           isUserInteracting={isGizmoDragging}
//         />

//         {isBaseReady && displayBaseUrl && <BaseGlb url={displayBaseUrl} onLoaded={handleBaseLoaded} />}

//         {isBaseReady && pendingBaseUrl && pendingBaseUrl !== displayBaseUrl && (
//           <Suspense fallback={null}>
//             <group visible={false}>
//               <BaseGlb url={pendingBaseUrl} onLoaded={onPendingLoaded} />
//             </group>
//           </Suspense>
//         )}

//         {normalizedItems.map((it) => (
//           <FurnitureItem
//             key={it.id}
//             item={it}
//             selected={selectedSet.has(it.id)}
//             freezeTransform={isGizmoDragging}
//             onSelect={(id, e) => {
//               if (!active) return;
//               if (materialPicking) return;
//               applySelectionIds(id ? [id] : [], e?.nativeEvent ?? e, "click");
//             }}
//           />
//         ))}

//         {showGizmoSafe && (
//           <TransformGizmo
//             selectedObject={selectedObject}
//             mode={gizmoMode}
//             space={gizmoSpace}
//             snapEnabled={snapEnabled}
//             onChangeTransform={(t) => {
//               if (!selectedItemId || !t) return;
//               onChangeTransform?.({ itemId: selectedItemId, transform: t });
//             }}
//             onCommitTransform={(t) => {
//               if (!selectedItemId || !t) return;
//               onCommitTransform?.({ itemId: selectedItemId, transform: t });
//             }}
//             onHoverAxisChange={(axis) => {
//               onGizmoHoverAxisChange?.(axis ?? null);

//               const next = axis || null;
//               setHoverAxis(next);
//               setIsGizmoUiActive(!!next);

//               if (!next) handleNumericCloseFromGizmo();
//             }}
//             onRequestNumericOpen={handleNumericOpenFromGizmo}
//             onRequestNumericClose={handleNumericCloseFromGizmo}
//             onDraggingChange={(payload) => {
//               if (typeof payload === "boolean") {
//                 const isDragging = payload;
//                 setIsGizmoDragging(isDragging);
//                 if (orbitRef.current) orbitRef.current.enabled = !isDragging;
//                 return;
//               }
//               const kind = payload?.kind;
//               const value = !!payload?.value;
//               if (kind === "input" || kind === "hover") setIsGizmoUiActive(value);
//             }}
//           />
//         )}
//       </Canvas>
//     </Box>
//   );
// }
