// src/features/layout/components/MainArea/components/controls/controlsBinders.jsx
import React from "react";
import { useThree } from "@react-three/fiber";

// hooks
import { useViewportControls } from "@desktop/features/dsl/layout/hooks/useViewportControls.js";
import { useOrthoViewportControls } from "@desktop/features/dsl/layout/hooks/useOrthoViewportControls.js";

/**
 * Perspective用 binder
 * - Canvas内で useThree() から camera / gl.domElement を取得し
 * - useViewportControls を接続して "操作" を付与する役割
 */
export function PerspectiveControlsBinder({
  enabled,
  mouseEnabled,
  keyboardEnabled,
  orbitRef,
  selectedObject,
  moveSpeed,
  verticalSpeed,
  onSpeedChange,
  forcePanOnRmb,
  rmbOrbit,
}) {
  const { camera, gl } = useThree();

  useViewportControls({
    camera,
    domElement: gl.domElement,
    orbitRef,
    enabled,
    mouseEnabled,
    keyboardEnabled,
    getSelectedObject: () => selectedObject,
    selectedKey: selectedObject?.uuid,
    moveSpeed,
    verticalSpeed,
    onSpeedChange,
    forcePanOnRmb,
    rmbOrbit,
  });

  return null;
}

/**
 * Ortho用 binder
 * - OrthographicCamera + OrbitControls の組み合わせで
 * - useOrthoViewportControls を接続する役割
 */
export function OrthoControlsBinder({
  enabled,
  mouseEnabled,
  keyboardEnabled,
  orbitRef,
  selectedObject,
  moveSpeed,
  verticalSpeed,
  onSpeedChange,
}) {
  const { camera, gl } = useThree();

  useOrthoViewportControls({
    camera,
    domElement: gl.domElement,
    orbitRef,
    enabled,
    mouseEnabled,
    keyboardEnabled,
    getSelectedObject: () => selectedObject,
    selectedKey: selectedObject?.uuid,
    moveSpeed,
    verticalSpeed,
    onSpeedChange,
  });

  return null;
}
