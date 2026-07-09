import React, { useMemo } from "react";
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";

export default function SceneGrid() {
  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const gridCellSizeMm = useEditorModeStore((s) => s.gridCellSizeMm);
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);

  const { size, center } = useMemo(() => {
    let _size = 20000; // default 20m
    let _center = new THREE.Vector3(0, 0, 0);

    if (baseColliders && baseColliders.length > 0) {
      const box = new THREE.Box3();
      baseColliders.forEach(c => {
        if (c.isMesh || c.isObject3D) {
          c.updateMatrixWorld(true);
          box.expandByObject(c);
        }
      });
      if (!box.isEmpty()) {
        box.getCenter(_center);
        const dim = new THREE.Vector3();
        box.getSize(dim);
        // Take the max bounding dimension + some padding
        _size = Math.max(dim.x, dim.z) + 2000; 
      }
    }
    return { size: _size, center: _center };
  }, [baseColliders]);

  if (editorMode !== "layout" || !isGridVisible || gridCellSizeMm <= 0) return null;

  // Calculate divisions to match exactly the requested grid cell sizes
  const roundedSize = Math.ceil(size / gridCellSizeMm) * gridCellSizeMm;
  const divisions = Math.max(1, Math.round(roundedSize / gridCellSizeMm));

  return (
    <gridHelper
      position={[center.x, gridHeightMm + 1, center.z]} // maintain 1mm lift
      args={[roundedSize, divisions, 0x2080ff, 0x6c6c6c]}
    />
  );
}
