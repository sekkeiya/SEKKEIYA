// src/features/layout/components/MainArea/Gizmo/TransformGizmo.jsx
import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useViewportUiStore } from "@layout/features/layout/store/viewportUiStore";

/**
 * TransformGizmo
 * - TransformControls の hoveron/hoveroff を使って「確実に」軸を拾ぁE
 * - hover中は数値入力を open�E�EommandBar側�E�できるように onRequestNumericOpen を呼ぶ
 * - ドラチE��中は marquee を抑止できるよう、親へ onDraggingChange めEboolean で返す�E�既存互換�E�E
 *
 * ✁E��要E��E
 * - Hooks の頁E��が変わらなぁE��ぁE��`if (!selectedObject) return null` は使わなぁE��末尾で三頁Eeturn�E�E
 *
 * ✁E��回の修正�E�E
 * - object={selectedObject} を使わなぁE��Ecene graph夁Eattach エラーを根絶�E�E
 * - tcRef.current.attach/detach をこちらで制御し、scene graph に入ってる時だぁEattach
 *
 * ✁Endo/Redo 対応�Eための修正�E�E
 * - onBeginTransform / onEndTransform をドラチE��開姁E終亁E��確実に呼ぶ�E�履歴トランザクション用�E�E
 * - 数値入力！EpplyNumeric�E�も begin/end で1操作として扱ぁE
 * - end が二重で呼ばれなぁE��ぁE�� guarding
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
  const { scene } = useThree();

  const tcRef = useRef(null);
  const objRef = useRef(null);

  const draggingRef = useRef(false);
  const rightDragRef = useRef(false);
  const hoverAxisRef = useRef(null);
  const rafPreviewRef = useRef(0);

  // ===== “最新のprops EめEref で保持�E�イベントが古いpropsを掴まなぁE��ぁE���E�E====
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
      space,
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
    space,
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
  }, [selectedObject]);

  const normalizeAxis = useCallback((axis) => {
    if (axis === "X" || axis === "Y" || axis === "Z" || axis === "XYZ") return axis;
    if (axis === "XY" || axis === "XZ" || axis === "YZ") return "XYZ";
    return null;
  }, []);

  // ✁Escene graph に入ってるか判定！Earent===null を弾く！E
  const isInSceneGraph = useCallback(
    (obj) => {
      if (!obj) return false;
      if (!scene) return false;
      if (!obj.parent) return false;

      let p = obj;
      while (p && p !== scene) p = p.parent;
      return p === scene;
    },
    [scene]
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

  // ✁ECommit & End めE回で確実に保証する�E�多重Push防止�E�E
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
    
    // まだCommitしてなければCommit
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
    
    // 忁E��End
    endTx();
  }, [readTransform, endTx]);
  // ===== Snap / Space =====
  const snap = useMemo(() => {
    if (!snapEnabled) return null;
    if (mode === "rotate") return { rotate: THREE.MathUtils.degToRad(15) };
    if (mode === "scale") return { scale: 0.1 };
    return { translate: 0.1 };
  }, [snapEnabled, mode]);

  const effectiveSpace = space === "world" ? "world" : "local";

  // ===== 数値入力ロチE���E�Eover連打でopenを乱発しなぁE��E====
  const lockedAxisRef = useRef(null);
  const lastOpenAtRef = useRef(0);

  useEffect(() => {
    lockedAxisRef.current = null;
  }, [numericCloseTick]);

  // ===== hover通知の「値が変わった時だけ」送る =====
  const lastSentHoverAxisRef = useRef(null);

  // ✁E親へ「ドラチE��状態」通知�E�Eayload / boolean 両対応！E
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

  // ✁ETransformControls が掴んでめEObject を基準に数値適用する
  const applyNumeric = useCallback(
    ({ axis, raw }) => {
      const obj = objRef.current;
      if (!obj) return;

      const n = Number(String(raw ?? "").trim());
      if (!Number.isFinite(n)) return;

      // ✁E数値入力�E 1操作として履歴に入れたぁE
      beginTx();

      const { mode: m, space: sp } = latestRef.current;
      const effSpace = sp === "world" ? "world" : "local";

      const axisWorld =
        axis === "X"
          ? new THREE.Vector3(1, 0, 0)
          : axis === "Y"
          ? new THREE.Vector3(0, 1, 0)
          : axis === "Z"
          ? new THREE.Vector3(0, 0, 1)
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

        const dist = n / 1000; // mm -> m
        const deltaWorld = axisWorld.clone().multiplyScalar(dist);

        if (effSpace === "local") {
          const objWorldQuat = new THREE.Quaternion();
          obj.getWorldQuaternion(objWorldQuat);
          deltaWorld.copy(axisWorld).applyQuaternion(objWorldQuat).multiplyScalar(dist);
        }

        const deltaLocal = deltaWorld.clone().applyQuaternion(parentWorldQuat.clone().invert());
        obj.position.add(deltaLocal);

        try {
          tcRef.current?.updateMatrixWorld?.();
        } catch {}

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
          } catch {}
          try {
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

        try {
          tcRef.current?.updateMatrixWorld?.();
        } catch {}

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
          } catch {}
          try {
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

        try {
          tcRef.current?.updateMatrixWorld?.();
        } catch {}

        const t = readTransform();
        if (t) {
          try {
            latestRef.current.onChangeTransform?.(t);
          } catch {}
          try {
            latestRef.current.onCommitTransform?.(t);
          } catch {}
        }

        commitAndEndTx();
      }
    },
    [readTransform, beginTx, endTx]
  );

  // ✁Eここが本命�E�object prop を使わず、sceneに入ってから attach�E�Eフレーム遁E��付き�E�E
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    // ぁE��たん忁E�� detach�E�古ぁE��照を残さなぁE��E
    try {
      tc.detach?.();
    } catch {}

    const obj = selectedObject || null;
    if (!obj) return;

    // scene に入ってなぁE��めEattach しなぁE��エラー根絶�E�E
    if (!isInSceneGraph(obj)) return;

    // さらに1フレーム遁E��せて安定化�E��E置直後�E “親付け替え中 Eを回避�E�E
    const id = requestAnimationFrame(() => {
      try {
        if (isInSceneGraph(obj)) tc.attach?.(obj);
      } catch {}
    });

    return () => cancelAnimationFrame(id);
  }, [selectedObject, isInSceneGraph]);

  // ✁E右ドラチE��検知�E�Eumeric即閉じ + hover無効�E�E
  useEffect(() => {
    const closeNumericNow = () => {
      if (lockedAxisRef.current) {
        lockedAxisRef.current = null;
        hoverAxisRef.current = null;
        lastSentHoverAxisRef.current = null;

        try {
          latestRef.current.onHoverAxisChange?.(null);
        } catch {}

        try {
          latestRef.current.onRequestNumericClose?.();
        } catch {}

        try {
          const st = useViewportUiStore.getState();
          st.setGizmoHotAxis?.(null);
          st.setGizmoInteracting?.(false);
        } catch {}
      }
    };

    const onPointerDown = (e) => {
      if (e?.button === 0) {
        try {
          const tc = tcRef.current;
          const axis = normalizeAxis(tc?.axis || hoverAxisRef.current || null);
          if (axis) {
            const st = useViewportUiStore.getState();
            st.setGizmoInteracting?.(true);
            st.setGizmoHotAxis?.(axis);
          }
        } catch {}
      }

      if (e?.button === 2) {
        rightDragRef.current = true;
        closeNumericNow();
      }
    };

    const onPointerUp = (e) => {
      if (e?.button === 2) rightDragRef.current = false;
      if (e?.button === 0 && !draggingRef.current) {
        try {
          const st = useViewportUiStore.getState();
          st.setGizmoInteracting?.(false);
          st.setGizmoHotAxis?.(null);
        } catch {}
      }
    };

    const onBlur = () => {
      rightDragRef.current = false;
      closeNumericNow();

      // ✁EドラチE��中に window blur した場合も確実に commit & end
      draggingRef.current = false;
      commitAndEndTx();

      try {
        const st = useViewportUiStore.getState();
        st.setGizmoInteracting?.(false);
        st.setGizmoDragging?.(false);
        st.setGizmoHotAxis?.(null);
      } catch {}
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
  }, [normalizeAxis, endTx]);

  // ✁ETransformControls のイベント登録�E�E回！E
  useEffect(() => {
    const tc = tcRef.current;
    if (!tc) return;

    const killOrbitNow = () => {
      const orbit = orbitRef?.current;
      if (!orbit) return;

      orbit.enabled = false;
      orbit.enableRotate = false;
      orbit.enablePan = false;
      orbit.enableZoom = false;
      orbit.state = -1;
    };

    const reviveOrbitNow = () => {
      const orbit = orbitRef?.current;
      if (!orbit) return;

      orbit.enabled = true;
      orbit.enableRotate = true;
      orbit.enablePan = true;
      orbit.enableZoom = true;
    };

    const closeNumericNow = () => {
      lockedAxisRef.current = null;
      lastSentHoverAxisRef.current = null;

      try {
        latestRef.current.onHoverAxisChange?.(null);
      } catch {}

      try {
        latestRef.current.onRequestNumericClose?.();
      } catch {}

      try {
        useViewportUiStore.getState().setGizmoHotAxis?.(null);
      } catch {}
    };

    const onMouseDown = () => {
      draggingRef.current = true;
      killOrbitNow();

      // ✁E履歴トランザクション開姁E
      beginTx();

      try {
        useViewportUiStore.getState().setGizmoInteracting?.(true);
      } catch {}

      try {
        const a = normalizeAxis(tc.axis || null);
        useViewportUiStore.getState().setGizmoHotAxis?.(a);
      } catch {}

      try {
        useViewportUiStore.getState().setGizmoDragging?.(true);
      } catch {}

      emitUiState({ kind: "drag", value: true, phase: "down" });
      emitUiState(true);

      closeNumericNow();
    };

    const onMouseUp = () => {
      draggingRef.current = false;
      reviveOrbitNow();

      try {
        useViewportUiStore.getState().setGizmoInteracting?.(false);
      } catch {}

      try {
        useViewportUiStore.getState().setGizmoDragging?.(false);
        useViewportUiStore.getState().setGizmoHotAxis?.(null);
      } catch {}

      emitUiState({ kind: "drag", value: false, phase: "up" });
      emitUiState(false);

      // ✁EmouseUp は “確定 Eの最終保障�E�Eragging-changed(false) が来なぁE��ース保険�E�E
      commitAndEndTx();
    };

    const emitPreview = () => {
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
    };

    const onDragChanged = (e) => {
      const isDragging = !!e?.value;

      if (isDragging) killOrbitNow();
      else reviveOrbitNow();

      try {
        useViewportUiStore.getState().setGizmoDragging?.(isDragging);
      } catch {}

      if (!isDragging) {
        try {
          useViewportUiStore.getState().setGizmoInteracting?.(false);
        } catch {}
      }

      if (draggingRef.current === isDragging) return;

      draggingRef.current = isDragging;
      emitUiState({ kind: "drag", value: isDragging });

      if (isDragging) {
        closeNumericNow();
        // ✁Edragging-changed(true) が最初に来たケースでめEbegin を保障
        beginTx();
      } else {
        // ✁Edragging-changed(false) で確実に commit & end
        commitAndEndTx();
      }
    };

    const onHoverOn = (e) => {
      if (draggingRef.current) return;
      if (rightDragRef.current) return;

      const axis = normalizeAxis(e?.axis || tc.axis || null);
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

      if (lockedAxisRef.current !== axis) {
        const now = performance.now();
        if (now - (lastOpenAtRef.current || 0) < 80) return;
        lastOpenAtRef.current = now;

        lockedAxisRef.current = axis;
        try {
          latestRef.current.onRequestNumericOpen?.({
            axis,
            mode: latestRef.current.mode,
            space: latestRef.current.space === "world" ? "world" : "local",
            applyNumeric,
          });
        } catch {}
      }
    };

    const onHoverOff = () => {
      if (draggingRef.current) return;
      hoverAxisRef.current = null;

      try {
        useViewportUiStore.getState().setGizmoHotAxis?.(null);
      } catch {}

      lockedAxisRef.current = null;
      lastSentHoverAxisRef.current = null;

      try {
        latestRef.current.onHoverAxisChange?.(null);
      } catch {}

      try {
        latestRef.current.onRequestNumericClose?.();
      } catch {}
    };

    tc.addEventListener("mouseDown", onMouseDown);
    tc.addEventListener("mouseUp", onMouseUp);
    tc.addEventListener("dragging-changed", onDragChanged);
    tc.addEventListener("change", emitPreview);
    tc.addEventListener("hoveron", onHoverOn);
    tc.addEventListener("hoveroff", onHoverOff);

    return () => {
      try {
        tc.removeEventListener("mouseDown", onMouseDown);
        tc.removeEventListener("mouseUp", onMouseUp);
        tc.removeEventListener("dragging-changed", onDragChanged);
        tc.removeEventListener("change", emitPreview);
        tc.removeEventListener("hoveron", onHoverOn);
        tc.removeEventListener("hoveroff", onHoverOff);
      } catch {}

      if (rafPreviewRef.current) cancelAnimationFrame(rafPreviewRef.current);
      rafPreviewRef.current = 0;

      draggingRef.current = false;
      lockedAxisRef.current = null;
      hoverAxisRef.current = null;
      lastSentHoverAxisRef.current = null;

      // ✁Eunmount 時もトランザクションを閉じる
      commitAndEndTx();

      try {
        const st = useViewportUiStore.getState();
        st.setGizmoHotAxis?.(null);
        st.setGizmoDragging?.(false);
        st.setGizmoInteracting?.(false);
      } catch {}

      // ✁E最後に detach�E�参照残り防止�E�E
      try {
        tcRef.current?.detach?.();
      } catch {}
    };
  }, [orbitRef, emitUiState, normalizeAxis, applyNumeric, readTransform, beginTx, endTx, commitAndEndTx]);

  // ✁EHooks頁E��を壊さなぁE��末尾で conditional render
  // - object prop を渡さなぁE��EttachはuseEffectで制御�E�E
  return selectedObject ? (
    <TransformControls
      ref={tcRef}
      enabled={isInSceneGraph(selectedObject)}
      mode={mode}
      space={effectiveSpace}
      showX
      showY
      showZ
      translationSnap={snap?.translate ?? null}
      rotationSnap={snap?.rotate ?? null}
      scaleSnap={snap?.scale ?? null}
    />
  ) : null;
}