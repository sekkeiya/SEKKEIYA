import React, { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore } from "@desktop/features/dsl/layout/store/useEditorModeStore";

export default function GridPickController({ baseCollidersRef }) {
  const isGridPickingMode = useEditorModeStore((s) => s.isGridPickingMode);
  const setIsGridPickingMode = useEditorModeStore((s) => s.setIsGridPickingMode);
  const setGridHeightMm = useEditorModeStore((s) => s.setGridHeightMm);
  const editorMode = useEditorModeStore((s) => s.editorMode);

  const { camera, gl, scene, raycaster } = useThree();
  const draggingRef = useRef(false);

  useEffect(() => {
    if (editorMode !== "layout" || !isGridPickingMode) {
      gl.domElement.style.cursor = "default";
      return;
    }

    const dom = gl.domElement;
    dom.style.cursor = "crosshair";

    const getMouseNdc = (e) => {
      const rect = dom.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      return new THREE.Vector2(x, y);
    };

    const handlePointerDown = (e) => {
      draggingRef.current = true;
    };

    const handlePointerMove = (e) => {
      if (draggingRef.current) {
        draggingRef.current = false; // Disable pick if we drag
      }
    };

    const handlePointerUp = (e) => {
      const wasClick = draggingRef.current;
      draggingRef.current = false;
      
      if (!wasClick) return;

      const ndc = getMouseNdc(e);
      raycaster.setFromCamera(ndc, camera);

      let objectsToIntersect = scene.children;
      // If we have base colliders, prioritize them
      if (baseCollidersRef?.current?.children?.length > 0) {
        objectsToIntersect = baseCollidersRef.current.children;
      }

      const isSectionClipEnabled = useEditorModeStore.getState().isSectionClipEnabled;
      const sectionClipHeight = useEditorModeStore.getState().sectionClipHeight;

      const hits = raycaster.intersectObjects(objectsToIntersect, true);

      for (let hit of hits) {
        if (!hit.face) continue;

        // Ignore hits that are clipped by the section plane
        if (isSectionClipEnabled && hit.point.y > sectionClipHeight) {
          continue;
        }
        
        const normal = hit.face.normal.clone();
        if (hit.object) {
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
            normal.applyMatrix3(normalMatrix).normalize();
        }

        console.log("[GridPick] Clicked mesh:", {
          name: hit.object?.name,
          parent: hit.object?.parent?.name,
          point: hit.point,
          normal,
          worldPosition: hit.object?.getWorldPosition(new THREE.Vector3()),
        });

        // Must be top facing horizontal surface
        if (normal.y > 0.9) {
          const convertedHeight = Math.round(hit.point.y);

          console.log("[GridPick] Picked Surface:");
          console.log(" - Object Name:", hit.object?.name);
          console.log(" - Intersection Point:", hit.point);
          console.log(" - Intersection Normal:", normal);
          console.log(` - Saved (gridHeightMm): ${convertedHeight} mm`);

          setGridHeightMm(convertedHeight);
          setIsGridPickingMode(false);
          e.stopPropagation();
          return;
        } else {
          console.warn("[GridPick] Ignored face: Normal is not pointing up enough", normal);
        }
      }
    };

    dom.addEventListener("pointerdown", handlePointerDown);
    dom.addEventListener("pointermove", handlePointerMove);
    dom.addEventListener("pointerup", handlePointerUp);

    return () => {
      dom.style.cursor = "default";
      dom.removeEventListener("pointerdown", handlePointerDown);
      dom.removeEventListener("pointermove", handlePointerMove);
      dom.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isGridPickingMode, editorMode, gl, camera, scene, raycaster, setGridHeightMm, setIsGridPickingMode, baseCollidersRef]);

  return null;
}
