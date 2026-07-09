// src/features/layout/components/MainArea/components/controls/controlsBinders.jsx
import React from "react";
import { useThree } from "@react-three/fiber";

// hooks
import { useViewportControls } from "@layout/features/layout/hooks/useViewportControls.js";
import { useOrthoViewportControls } from "@layout/features/layout/hooks/useOrthoViewportControls.js";

/**
 * Perspective用 binder
 * - Canvas内で useThree() から camera / gl.domElement を取得し
 * - useViewportControls を接続して "操作" を付与する役割
 */
export function PerspectiveControlsBinder({
  enabled,
  orbitRef,
  selectedObject,
  moveSpeed,
  verticalSpeed,
  onSpeedChange,
}) {
  const { camera, gl } = useThree();

  useViewportControls({
    camera,
    domElement: gl.domElement,
    orbitRef,
    enabled,
    getSelectedObject: () => selectedObject,
    selectedKey: selectedObject?.uuid,
    moveSpeed,
    verticalSpeed,
    onSpeedChange,
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
    getSelectedObject: () => selectedObject,
    selectedKey: selectedObject?.uuid,
    moveSpeed,
    verticalSpeed,
    onSpeedChange,
  });

  return null;
}
