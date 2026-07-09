import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore, useViewportEditorMode } from "../../../store/useEditorModeStore";

export default function LayoutCameraRig({ orbitRef, layoutSubMode, baseBoundsRef }) {
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const { layoutCameraRotationIndex, layoutCameraTilt } = useViewportEditorMode();

  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3());

  // Calculate effective sub mode inside the rig as well to respond to tilt changes
  let effectiveSubMode = layoutSubMode;
  if (layoutSubMode === "furniture_iso") {
      if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
      else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
  }

  // One-shot framing when an orthographic top mode activates
  useEffect(() => {
    if (effectiveSubMode !== "zone_2d" && effectiveSubMode !== "furniture_top" && effectiveSubMode !== "ceiling_top") return;

    const frame = () => {
      const orbit = orbitRef.current;
      if (!orbit) return;

      const cam = orbit.object || camera;
      const b = baseBoundsRef?.current;

      if (b && b.center && b.maxDim > 0) {
        const { center, maxDim } = b;
        const orthoDist = Math.max(20, maxDim * 1.4);

        orbit.target.copy(center);
        cam.position.set(center.x, center.y + orthoDist, center.z);
        const rotIndex = layoutCameraRotationIndex || 0;
        const upVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotIndex * -Math.PI / 2);
        cam.up.copy(upVec);

        const frustumW = Math.abs(cam.right - cam.left);
        const frustumH = Math.abs(cam.top - cam.bottom);
        if (frustumW > 0 && frustumH > 0) {
          cam.zoom = Math.max(0.01, Math.min(frustumW, frustumH) / (maxDim * 1.2));
        }
      } else {
        orbit.target.set(0, 0, 0);
        cam.position.set(0, 90, 0.001);
        const rotIndex = layoutCameraRotationIndex || 0;
        const upVec = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotIndex * -Math.PI / 2);
        cam.up.copy(upVec);
        cam.zoom = 8;
      }

      cam.lookAt(orbit.target);
      cam.updateProjectionMatrix();
      orbit.update();
    };

    // Delay two frames so OrthographicCamera has mounted and taken ownership
    requestAnimationFrame(() => requestAnimationFrame(frame));
  }, [effectiveSubMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((state, delta) => {
    if (editorMode !== "layout") return;
    const orbit = orbitRef.current;
    if (!orbit) return;

    const lerpFactor = 1.0 - Math.exp(-10 * delta);

    let effectiveSubMode = layoutSubMode;
    if (layoutSubMode === "furniture_iso") {
        if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
        else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
    }

    // All these modes use OrthographicCamera with free pan, so no per-frame lerp is needed.
    if (effectiveSubMode === "furniture_iso") {
      // Natural orbiting via OrbitControls — no per-frame lock.
    }
  });

  return null;
}
