import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { PivotControls } from "@react-three/drei";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useViewportUiStore } from "@desktop/features/dsl/layout/store/viewportUiStore";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

/**
 * TransformGizmo (Twinmotion Style - Unified PivotControls)
 * - Uses PivotControls to provide Translate, Rotate, and Scale in one unified gizmo.
 * - Extracts `hovered` state by intercepting pointer events and calculating geometry orientation.
 */
export default function TransformGizmo({
  orbitRef,
  selectedObject,
  mode = "translate",
  space = "local",
  snapEnabled = false,

  onDraggingChange,
  onChangeTransform,
  onCommitTransform,

  onBeginTransform,
  onEndTransform,

  onHoverAxisChange,
  onRequestNumericOpen,
  onRequestNumericClose,

  numericCloseTick = 0,
}) {
  const { scene, camera, gl } = useThree();
  
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const layoutCameraTilt = useEditorModeStore((s) => s.layoutCameraTilt);
  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const gridCellSizeMm = useEditorModeStore((s) => s.gridCellSizeMm);

  const isTopView = editorMode === "layout" && layoutCameraTilt === "top";
  // Always enable all axes. In Top View, Y translation is a dot, but Y rotation is crucial for planar rotation.
  const activeAxes = [true, true, true];
  
  // Force world space in Top View to ensure arrows always point consistently (X=Right, Z=Up/Down)
  const effectiveSpace = isTopView ? "world" : space;

  const tcRef = useRef(null);
  const gizmoRootRef = useRef(null);

  // Ensure DoubleSide rendering for negative-scaled Flip Axes logic
  useEffect(() => {
    if (gizmoRootRef.current) {
      gizmoRootRef.current.traverse((child) => {
        const mat = child.material;
        if (mat) {
          if (child.isMesh) mat.side = THREE.DoubleSide;
          mat.transparent = true;
          mat.opacity = 0.35;
          // Apply to arrays if material is an array
          if (Array.isArray(mat)) {
            mat.forEach(m => {
              if (child.isMesh) m.side = THREE.DoubleSide;
              m.transparent = true;
              m.opacity = 0.35;
            });
          }
        }
      });
    }
  });
  const objRef = useRef(null);

  const draggingRef = useRef(false);
  const rightDragRef = useRef(false);
  const hoverAxisRef = useRef(null);
  const rafPreviewRef = useRef(0);
  
  // PivotControls specific references
  const pivotMatrixRef = useRef(new THREE.Matrix4());
  // Object initial transform snapshot on drag start
  const initialWorldMatrixRef = useRef(new THREE.Matrix4());
  const initialObjectTransformRef = useRef({
    position: new THREE.Vector3(),
    quaternion: new THREE.Quaternion(),
    scale: new THREE.Vector3()
  });

  const lastMatrixWorldRef = useRef(new THREE.Matrix4());
  const cachedPivotPosRef = useRef(new THREE.Vector3());
  const localPivotOffsetRef = useRef(new THREE.Vector3());
  const boxEmptyRef = useRef(false);

  // Latest props ref
  const latestRef = useRef({
    mode,
    space,
    onDraggingChange,
    onChangeTransform,
    onCommitTransform,
    onBeginTransform,
    onEndTransform,
    onHoverAxisChange,
    onRequestNumericOpen,
    onRequestNumericClose,
  });

  useEffect(() => {
    latestRef.current = {
      mode,
      space: effectiveSpace,
      onDraggingChange,
      onChangeTransform,
      onCommitTransform,
      onBeginTransform,
      onEndTransform,
      onHoverAxisChange,
      onRequestNumericOpen,
      onRequestNumericClose,
    };
  }, [
    mode,
    effectiveSpace,
    onDraggingChange,
    onChangeTransform,
    onCommitTransform,
    onBeginTransform,
    onEndTransform,
    onHoverAxisChange,
    onRequestNumericOpen,
    onRequestNumericClose,
  ]);

  useEffect(() => {
    objRef.current = selectedObject || null;
    // 前の選択/ドラッグが終わっていない状態でオブジェクトが切り替わった場合にドラッグ状態をリセット
    if (draggingRef.current) {
      draggingRef.current = false;
      try {
        useViewportUiStore.getState().setGizmoInteracting?.(false);
        useViewportUiStore.getState().setGizmoDragging?.(false);
      } catch {}
    }
    // キャッシュをリセットして次フレームで必ず再計算させる
    lastMatrixWorldRef.current.identity();

    if (selectedObject) {
      selectedObject.updateMatrixWorld(true);
      pivotMatrixRef.current.copy(selectedObject.matrixWorld);
      
      const box = new THREE.Box3().setFromObject(selectedObject);
      const center = new THREE.Vector3();
      box.getCenter(center);
      
      let worldPivotPos;
      if (box.isEmpty()) {
        boxEmptyRef.current = true;
        const p = new THREE.Vector3();
        selectedObject.getWorldPosition(p);
        worldPivotPos = p;
      } else {
        boxEmptyRef.current = false;
        worldPivotPos = new THREE.Vector3(center.x, box.min.y, center.z);
      }
      
      const inv = new THREE.Matrix4().copy(selectedObject.matrixWorld).invert();
      localPivotOffsetRef.current.copy(worldPivotPos).applyMatrix4(inv);
    }
  }, [selectedObject]);

  // Sync PivotControls matrix with external object updates and apply camera-facing reflection
  useFrame((state) => {
    if (selectedObject) {
      selectedObject.updateMatrixWorld(true);
      
      // Freeze pivot matrix updates during dragging to prevent unstable raycast planes for planar sliders
      if (draggingRef.current) return;

      if (boxEmptyRef.current) {
        const box = new THREE.Box3().setFromObject(selectedObject);
        if (!box.isEmpty()) {
            boxEmptyRef.current = false;
            const center = new THREE.Vector3();
            box.getCenter(center);
            const worldPivotPos = new THREE.Vector3(center.x, box.min.y, center.z);
            const inv = new THREE.Matrix4().copy(selectedObject.matrixWorld).invert();
            localPivotOffsetRef.current.copy(worldPivotPos).applyMatrix4(inv);
            // Force update of pivotPos cache so it immediately takes effect
            lastMatrixWorldRef.current.identity(); 
        }
      }
      
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      selectedObject.matrixWorld.decompose(pos, quat, scale);
      
      let pivotPos = cachedPivotPosRef.current;
      
      if (!lastMatrixWorldRef.current.equals(selectedObject.matrixWorld)) {
        lastMatrixWorldRef.current.copy(selectedObject.matrixWorld);
        pivotPos.copy(localPivotOffsetRef.current).applyMatrix4(selectedObject.matrixWorld);
      }
      
      const finalQuat = effectiveSpace === "world" ? new THREE.Quaternion() : quat;
      
      // Determine camera viewing direction
      const vCam = new THREE.Vector3().subVectors(state.camera.position, pivotPos);
      
      // In Top View, instead of scaling Z by -1 (which breaks PivotControls matrix determinant),
      // we rotate the entire gizmo 180 degrees around the X axis.
      // This keeps X (Red) pointing right, flips Y (Green) pointing into the floor,
      // and flips Z (Blue) pointing UP on the screen (-Z World).
      let finalQuatToUse = finalQuat;
      if (isTopView) {
        const topViewQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
        finalQuatToUse = topViewQuat;
      }
      
      // Compute direction vectors of the 3 axes
      const xAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(finalQuatToUse);
      const yAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(finalQuatToUse);
      const zAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(finalQuatToUse);
      
      // Flip axis (scale by -1) if it points away from the camera hemisphere, EXCEPT in Top View where axes should remain fixed.
      const sx = isTopView ? 1 : (xAxis.dot(vCam) < 0 ? -1 : 1);
      const sy = isTopView ? 1 : (yAxis.dot(vCam) < 0 ? -1 : 1);
      const sz = isTopView ? 1 : (zAxis.dot(vCam) < 0 ? -1 : 1);
      
      const dummy = new THREE.Matrix4();
      dummy.compose(pivotPos, finalQuatToUse, new THREE.Vector3(sx, sy, sz));
      
      pivotMatrixRef.current.copy(dummy);
    }
  });

  const normalizeAxis = useCallback((axis) => {
    if (axis === "X" || axis === "Y" || axis === "Z" || axis === "XYZ") return axis;
    if (axis === "XY" || axis === "XZ" || axis === "YZ") return "XYZ";
    return null;
  }, []);

  const isInSceneGraph = useCallback(
    (obj) => {
      if (!obj) return false;
      return true;
    },
    []
  );

  const readTransform = useCallback(() => {
    const obj = objRef.current;
    if (!obj) return null;
    obj.updateMatrixWorld?.(true);
    return {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    };
  }, []);

  const txOpenRef = useRef(false);
  const txCommittedRef = useRef(false);

  const beginTx = useCallback(() => {
    if (txOpenRef.current) return;
    txOpenRef.current = true;
    txCommittedRef.current = false;
    try {
      latestRef.current.onBeginTransform?.();
    } catch {}
  }, []);

  const endTx = useCallback(() => {
    if (!txOpenRef.current) return;
    txOpenRef.current = false;
    try {
      latestRef.current.onEndTransform?.();
    } catch {}
  }, []);

  const commitAndEndTx = useCallback(() => {
    if (!txOpenRef.current) return;
    
    if (!txCommittedRef.current) {
      txCommittedRef.current = true;
      const t = readTransform();
      if (t) {
        try {
          latestRef.current.onChangeTransform?.(t);
        } catch {}
        try {
          latestRef.current.onCommitTransform?.(t);
        } catch {}
      }
    }
    
    endTx();
  }, [readTransform, endTx]);

  const snap = useMemo(() => {
    if (!snapEnabled) return null;
    return { 
      translate: 0.1,
      rotate: THREE.MathUtils.degToRad(15),
      scale: 0.1
    };
  }, [snapEnabled]);

  const lockedAxisRef = useRef(null);
  const lastOpenAtRef = useRef(0);

  useEffect(() => {
    lockedAxisRef.current = null;
  }, [numericCloseTick]);

  const lastSentHoverAxisRef = useRef(null);

  const emitUiState = useCallback((payload) => {
    const fn = latestRef.current.onDraggingChange;
    if (typeof fn !== "function") return;

    try {
      fn(payload);
    } catch {}

    if (payload?.kind === "drag") {
      try {
        fn(!!payload.value);
      } catch {}
    }

    if (typeof payload === "boolean") {
      try {
        fn(payload);
      } catch {}
    }
  }, []);

  // applyNumeric manually applies transformation using global axes
  const applyNumeric = useCallback(
    ({ axis, raw, mode }) => {
      const obj = objRef.current;
      if (!obj) return;

      let s = String(raw ?? "").trim();
      s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      s = s.replace(/[ー－−-]/g, "-");
      const n = Number(s);
      
      console.log("[TransformGizmo applyNumeric] Extracted:", { axis, mode, space: sp, raw, parsedNumber: n });
      
      if (!Number.isFinite(n)) return;

      beginTx();

      const { mode: defaultMode, space: sp } = latestRef.current;
      const m = mode || defaultMode;
      const effSpace = sp === "world" ? "world" : "local";

      const axisWorld =
        axis === "X"
          ? new THREE.Vector3(1, 0, 0)
          : axis === "Y"
          ? new THREE.Vector3(0, 1, 0)
          : axis === "Z"
          ? new THREE.Vector3(0, 0, isTopView ? -1 : 1)
          : null;

      obj.updateMatrixWorld?.(true);

      const parent = obj.parent;
      const parentWorldQuat = new THREE.Quaternion();
      if (parent) parent.getWorldQuaternion(parentWorldQuat);
      else parentWorldQuat.identity();

      if (m === "translate") {
        if (!axisWorld) {
          commitAndEndTx();
          return;
        }

        const dist = n / 1000;
        const deltaWorld = axisWorld.clone().multiplyScalar(dist);

        if (effSpace === "local") {
          const objWorldQuat = new THREE.Quaternion();
          obj.getWorldQuaternion(objWorldQuat);
          deltaWorld.copy(axisWorld).applyQuaternion(objWorldQuat).multiplyScalar(dist);
        }

        const deltaLocal = deltaWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
        obj.position.add(deltaLocal);

        obj.updateMatrixWorld(true);
        pivotMatrixRef.current.copy(obj.matrixWorld);

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
            latestRef.current.onCommitTransform?.(t);
          } catch {}
        }
        commitAndEndTx();
        return;
      }

      if (m === "rotate") {
        if (!axisWorld) {
          commitAndEndTx();
          return;
        }

        const rad = THREE.MathUtils.degToRad(n);
        if (effSpace === "world") obj.rotateOnWorldAxis(axisWorld.clone().normalize(), rad);
        else obj.rotateOnAxis(axisWorld.clone().normalize(), rad);

        obj.updateMatrixWorld(true);
        pivotMatrixRef.current.copy(obj.matrixWorld);

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
            latestRef.current.onCommitTransform?.(t);
          } catch {}
        }
        endTx();
        return;
      }

      if (m === "scale") {
        const f = n;
        if (!Number.isFinite(f) || f === 0) {
          commitAndEndTx();
          return;
        }

        if (axis === "XYZ") obj.scale.multiplyScalar(f);
        else if (axis === "X") obj.scale.x *= f;
        else if (axis === "Y") obj.scale.y *= f;
        else if (axis === "Z") obj.scale.z *= f;

        obj.updateMatrixWorld(true);
        pivotMatrixRef.current.copy(obj.matrixWorld);

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
            latestRef.current.onCommitTransform?.(t);
          } catch {}
        }
        commitAndEndTx();
      }
    },
    [readTransform, beginTx, endTx, commitAndEndTx]
  );

  const closeNumericNow = useCallback(() => {
    lockedAxisRef.current = null;
    lastSentHoverAxisRef.current = null;

    try {
      latestRef.current.onHoverAxisChange?.(null);
      latestRef.current.onRequestNumericClose?.();
      useViewportUiStore.getState().setGizmoHotAxis?.(null);
    } catch {}
  }, []);

  // Global right click detection and cancel
  useEffect(() => {
    const onPointerDown = (e) => {
      if (e?.button === 2) {
        rightDragRef.current = true;
        closeNumericNow();
      }
    };
    const onPointerUp = (e) => {
      if (e?.button === 2) rightDragRef.current = false;
    };
    const onBlur = () => {
      rightDragRef.current = false;
      closeNumericNow();
      if (draggingRef.current) {
        draggingRef.current = false;
        commitAndEndTx();
      }
    };
    const onContextMenu = () => {
      rightDragRef.current = false;
      closeNumericNow();
    };

    window.addEventListener("pointerdown", onPointerDown, { capture: true, passive: true });
    window.addEventListener("pointerup", onPointerUp, { capture: true, passive: true });
    window.addEventListener("blur", onBlur);
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [closeNumericNow, commitAndEndTx]);

  const killOrbitNow = useCallback(() => {
    const orbit = orbitRef?.current;
    if (!orbit) return;
    orbit.enabled = false;
  }, [orbitRef]);

  const reviveOrbitNow = useCallback(() => {
    const orbit = orbitRef?.current;
    if (!orbit) return;
    orbit.enabled = true;
  }, [orbitRef]);

  // PivotControls Drag Callbacks
  const onDragStart = useCallback(() => {
    if (rightDragRef.current) return;
    draggingRef.current = true;
    killOrbitNow();
    beginTx();

    if (objRef.current) {
       initialWorldMatrixRef.current.copy(objRef.current.matrixWorld);
       objRef.current.matrix.decompose(
         initialObjectTransformRef.current.position,
         initialObjectTransformRef.current.quaternion,
         initialObjectTransformRef.current.scale
       );
    }

    try {
      useViewportUiStore.getState().setGizmoInteracting?.(true);
      useViewportUiStore.getState().setGizmoDragging?.(true);
    } catch {}

    emitUiState({ kind: "drag", value: true, phase: "down" });
    emitUiState(true);
    closeNumericNow();
  }, [beginTx, closeNumericNow, emitUiState, killOrbitNow]);

  const lastPreviewTimeRef = useRef(0);

  const emitPreview = useCallback(() => {
    if (!draggingRef.current) return;
    if (typeof latestRef.current.onChangeTransform !== "function") return;

    if (rafPreviewRef.current) return;
    rafPreviewRef.current = requestAnimationFrame(() => {
      rafPreviewRef.current = 0;
      const t = readTransform();
      if (t) {
        try {
          latestRef.current.onChangeTransform?.(t);
        } catch {}
      }
    });
  }, [readTransform]);

  const onDrag = useCallback((local, deltaL, world, deltaW) => {
    if (!objRef.current) return;
    
    // We compute the new world matrix by applying the drag deltaW to the object's INITIAL world matrix.
    // This perfectly handles both "local" and "world" gizmo interactions without corrupting rotation/scale!
    objRef.current.matrixAutoUpdate = false;
    
    const dPos = new THREE.Vector3();
    const dQuat = new THREE.Quaternion();
    const dScale = new THREE.Vector3();
    deltaW.decompose(dPos, dQuat, dScale);
    
    const fixedDeltaW = new THREE.Matrix4().compose(dPos, dQuat, dScale);
    const newWorld = new THREE.Matrix4().copy(initialWorldMatrixRef.current).premultiply(fixedDeltaW);
    
    // For proper parent/child hierarchy decomposition:
    const parent = objRef.current.parent;
    if (parent) {
      // Convert the new world matrix back into local space of the parent
      const parentInverse = new THREE.Matrix4().copy(parent.matrixWorld).invert();
      const newLocal = new THREE.Matrix4().copy(newWorld).premultiply(parentInverse);
      
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      
      newLocal.decompose(pos, quat, scale);
      
      objRef.current.position.copy(pos);
      objRef.current.quaternion.copy(quat);
      objRef.current.scale.copy(scale);
      
      objRef.current.updateMatrix();
    } else {
      // Root object
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      
      newWorld.decompose(pos, quat, scale);
      
      objRef.current.position.copy(pos);
      objRef.current.quaternion.copy(quat);
      objRef.current.scale.copy(scale);

      objRef.current.updateMatrix();
    }
    
    objRef.current.matrixAutoUpdate = true;
    objRef.current.updateMatrixWorld(true);

    // 複数選択時に他のアイテムをリアルタイム追従させる
    // ※ emitPreview は rAF でスロットリング済み（最大60fps）かつ
    //   handleGizmoPreview → applyGizmoMultiDelta は Three.js オブジェクト直接更新のみで
    //   React state 更新なし → パフォーマンス問題なし
    emitPreview();
  }, [emitPreview]);

  const onDragEnd = useCallback(() => {
    draggingRef.current = false;
    reviveOrbitNow();

    try {
      useViewportUiStore.getState().setGizmoInteracting?.(false);
      useViewportUiStore.getState().setGizmoDragging?.(false);
      useViewportUiStore.getState().setGizmoHotAxis?.(null);
    } catch {}

    emitUiState({ kind: "drag", value: false, phase: "up" });
    emitUiState(false);

    commitAndEndTx();
  }, [commitAndEndTx, emitUiState, reviveOrbitNow]);

  const getHitAxis = useCallback((obj) => {
    if (!obj || !obj.geometry) return { axis: null, mode: null };
    const geomType = obj.geometry.type || "";
    
    let localDir = null;
    let explicitMode = "translate";
    let isPlane = false;

    if (geomType === "CylinderGeometry" || geomType === "ConeGeometry") {
      explicitMode = "translate";
      localDir = new THREE.Vector3(0, 1, 0);
    } else if (geomType === "PlaneGeometry" || geomType.includes("Plane")) {
      explicitMode = "translate";
      localDir = new THREE.Vector3(0, 0, 1);
      isPlane = true;
    } else if (geomType === "TorusGeometry" || geomType === "TubeGeometry" || geomType.includes("Line")) {
      explicitMode = "rotate";
      localDir = new THREE.Vector3(0, 0, 1);
    } else if (geomType === "BoxGeometry" || geomType === "SphereGeometry") {
      explicitMode = "scale";
      localDir = new THREE.Vector3(0, 1, 0);
    }

    if (!localDir) return { axis: null, mode: null };

    const objDir = localDir.clone().transformDirection(obj.matrixWorld).normalize();
    const pMat = pivotMatrixRef.current;
    const gX = new THREE.Vector3(1, 0, 0).transformDirection(pMat).normalize();
    const gY = new THREE.Vector3(0, 1, 0).transformDirection(pMat).normalize();
    const gZ = new THREE.Vector3(0, 0, 1).transformDirection(pMat).normalize();

    const dx = Math.abs(objDir.dot(gX));
    const dy = Math.abs(objDir.dot(gY));
    const dz = Math.abs(objDir.dot(gZ));

    let axis = null;
    if (isPlane) {
      if (dx > 0.9) axis = "YZ";
      else if (dy > 0.9) axis = "XZ";
      else if (dz > 0.9) axis = "XY";
    } else {
      if (dx > 0.9) axis = "X";
      else if (dy > 0.9) axis = "Y";
      else if (dz > 0.9) axis = "Z";
    }
    
    return { axis, mode: explicitMode };
  }, []);

  const handlePointerOver = useCallback((e) => {
    if (draggingRef.current) return;
    if (rightDragRef.current) return;
    
    const { axis: rawAxis } = getHitAxis(e.object);
    if (!rawAxis) return;
    
    let axis = normalizeAxis(rawAxis);
    if (!axis) return;
    
    hoverAxisRef.current = axis;
    try {
      useViewportUiStore.getState().setGizmoHotAxis?.(axis);
    } catch {}

    if (axis !== lastSentHoverAxisRef.current) {
      lastSentHoverAxisRef.current = axis;
      try {
        latestRef.current.onHoverAxisChange?.(axis);
      } catch {}
    }
  }, [normalizeAxis, getHitAxis]);

  const handleClick = useCallback((e) => {
    if (draggingRef.current) return;
    if (rightDragRef.current) return;
    
    const { axis: rawAxis, mode: explicitMode } = getHitAxis(e.object);
    if (!rawAxis) return;
    
    let axis = normalizeAxis(rawAxis);
    if (!axis) return;
    
    axis = normalizeAxis(axis);
    if (!axis) return;

    e.stopPropagation();

    lockedAxisRef.current = axis;
    try {
      latestRef.current.onRequestNumericOpen?.({
        axis,
        mode: explicitMode,
        space: latestRef.current.space === "world" ? "world" : "local",
        applyNumeric: (payload) => applyNumeric({ ...payload, mode: explicitMode }),
      });
    } catch {}
  }, [normalizeAxis, applyNumeric, getHitAxis]);

  const handlePointerOut = useCallback((e) => {
    if (draggingRef.current) return;
    
    hoverAxisRef.current = null;

    try {
      useViewportUiStore.getState().setGizmoHotAxis?.(null);
      latestRef.current.onHoverAxisChange?.(null);
    } catch {}

    lastSentHoverAxisRef.current = null;
  }, []);

  const isVisible = !!(selectedObject && isInSceneGraph(selectedObject));

  return isVisible ? (
    <group 
      ref={gizmoRootRef} 
      onClick={handleClick} 
      onPointerOver={handlePointerOver} 
      onPointerOut={handlePointerOut}
      userData={{ isGizmo: true }}
    >
      <PivotControls
        ref={tcRef}
        matrix={pivotMatrixRef.current}
        autoTransform={true}   // Allow PivotControls to update its own matrix visually during drag
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        scale={100}             // Visual scale of the gizmo (pixel equivalent when fixed=true)
        lineWidth={3.0}         // Line thickness for arcs and vectors
        activeAxes={activeAxes} 
        depthTest={false}       // Draw on top of everything
        fixed={true}            // Essential: Keep gizmo constant size on screen like TransformControls!
        translationSnap={null}
        translationLimits={undefined}
        rotationLimits={undefined}
        scaleLimits={undefined}
        annotations={false}     // Disable default annotations since we use Custom UI numeric inputs
      />
    </group>
  ) : null;
}