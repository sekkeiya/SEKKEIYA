// src/features/layout/components/MainArea/components/scene/BaseGlb.jsx
import React, { useEffect, useRef, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

function applyShadowFlags(obj) {
  obj.traverse?.((c) => {
    if (c && c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;

      // ✅ Raycastのface判定があるので、可能ならDoubleSideにしておくと当たりが安定する
      // （見た目に影響が出る場合はここは外してOK）
      if (Array.isArray(c.material)) c.material.forEach((m) => (m.needsUpdate = true));
      else if (c.material) c.material.needsUpdate = true;
    }
  });
}

/**
 * ✅ Base GLB
 * - XZは中心合わせ
 * - Yは床(minY)を 0 に合わせる
 *
 * 変更点（重要）:
 * - 「壁/床を名前で分類」ではなく、
 *   ✅ BaseのMeshをすべて収集して外へ渡す（Raycastはヒット後に法線で壁/床を判定する）
 *
 * onLoaded で返すもの：
 * - root: Group
 * - snap: { baseMeshes: Mesh[] }
 */
export default function BaseGlb({ url, onLoaded }) {
  const gltf = useGLTF(url);
  const groupRef = useRef(null);

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    applyShadowFlags(g);

    // いったん最新のワールド行列に
    g.updateMatrixWorld(true);

    // bbox（ワールド）から中心/minYを取得
    const box = new THREE.Box3().setFromObject(g);
    const center = box.getCenter(new THREE.Vector3());
    const minY = box.min.y;

    // XZは中心を原点へ、Yは床を0へ
    g.position.x -= center.x;
    g.position.z -= center.z;
    g.position.y -= minY;

    // 位置調整後の行列を更新（Raycast対象として正しい状態にする）
    g.updateMatrixWorld(true);

    // ✅ Base内の Mesh をすべて収集（壁/床の判定は Raycastヒット後に法線で行う）
    const baseMeshes = [];
    g.traverse((o) => {
      if (!o?.isMesh) return;
      if (!o.geometry) return;

      // Raycastが安定するよう、薄い板でも当たりやすくする（必要なら）
      if (Array.isArray(o.material)) o.material.forEach((m) => (m.side = THREE.DoubleSide));
      else if (o.material) o.material.side = THREE.DoubleSide;

      baseMeshes.push(o);
    });

    // ✅ 外へ通知（root + baseMeshes）
    if (typeof onLoaded === "function") {
      try {
        onLoaded({ root: g, snap: { baseMeshes } });
      } catch {
        // ignore
      }
    }

    // unmount/URL変更時にクリア（安全）
    return () => {
      if (typeof onLoaded === "function") {
        try {
          onLoaded(null);
        } catch {
          // ignore
        }
      }
    };
  }, [gltf, url, onLoaded]);

  const clonedScene = useMemo(() => {
    return gltf.scene ? gltf.scene.clone() : null;
  }, [gltf.scene]);

  return (
    <group ref={groupRef}>
      {clonedScene && <primitive object={clonedScene} />}
    </group>
  );
}
