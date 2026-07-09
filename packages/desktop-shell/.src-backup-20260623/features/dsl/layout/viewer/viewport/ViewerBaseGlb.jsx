import React, { useEffect, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function applyShadowFlags(obj) {
  obj.traverse?.((c) => {
    if (c?.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

/**
 * ✅ Viewer Base GLB
 * Editor の BaseGlb.jsx と完全一致させる
 * - XZ: bbox center → 原点
 * - Y : bbox minY → 0（床）
 */
export default function ViewerBaseGlb({ url }) {
  const gltf = useGLTF(url);
  const groupRef = useRef(null);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    applyShadowFlags(g);
    g.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const minY = box.min.y;

    g.position.x -= center.x;
    g.position.z -= center.z;
    g.position.y -= minY;

    g.updateMatrixWorld(true);
  }, [gltf, url]);

  const clonedScene = React.useMemo(() => gltf.scene ? gltf.scene.clone() : null, [gltf.scene]);

  return (
    <group ref={groupRef}>
      {clonedScene && <primitive object={clonedScene} />}
    </group>
  );
}
