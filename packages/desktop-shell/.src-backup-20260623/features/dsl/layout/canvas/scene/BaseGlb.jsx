// src/features/layout/components/MainArea/components/scene/BaseGlb.jsx
import React, { useEffect, useRef, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore, useViewportEditorMode } from "@desktop/features/dsl/layout/store/useEditorModeStore";

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
  const { layoutSubMode, layoutCameraTilt } = useViewportEditorMode();
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const isSectionClipEnabled = useEditorModeStore((s) => s.isSectionClipEnabled);
  const setSceneMaxY = useEditorModeStore((s) => s.setSceneMaxY);
  const setSectionClipHeight = useEditorModeStore((s) => s.setSectionClipHeight);
  const sectionClipHeight = useEditorModeStore((s) => s.sectionClipHeight);
  const setSceneExtentXZ = useEditorModeStore((s) => s.setSceneExtentXZ);

  let effectiveSubMode = layoutSubMode;
  if (layoutSubMode === "furniture_iso") {
      if (layoutCameraTilt === "ceiling") effectiveSubMode = "ceiling_top";
      else if (layoutCameraTilt === "top") effectiveSubMode = "furniture_top";
  }

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
    if (!box.isEmpty() && isFinite(center.x) && isFinite(center.z) && isFinite(minY)) {
      g.position.x -= center.x;
      g.position.z -= center.z;
      g.position.y -= minY;
      // 位置調整後の行列を更新
      g.updateMatrixWorld(true);

      // Recompute exact max Y and XZ extents to set into the store for scaling section clipping
      const adjustedBox = new THREE.Box3().setFromObject(g);
      const computedMaxY = adjustedBox.max.y;
      if (isFinite(computedMaxY) && computedMaxY > 0) {
        // Debounce or dispatch async to avoid deep warning during render
        setTimeout(() => {
          setSceneMaxY(computedMaxY);
          // XZ extent: the larger of absolute X/Z bounds, used for X/Z slider range
          const extentX = Math.max(Math.abs(adjustedBox.max.x), Math.abs(adjustedBox.min.x));
          const extentZ = Math.max(Math.abs(adjustedBox.max.z), Math.abs(adjustedBox.min.z));
          setSceneExtentXZ(Math.max(extentX, extentZ, computedMaxY * 0.5));
          // If sectionClipHeight is extremely small relative to the height (meaning they just loaded a huge mm scale file),
          // adjust the default sectionClipHeight to roughly the top.
          if (computedMaxY > 100 && sectionClipHeight < 10) {
            setSectionClipHeight(computedMaxY * 0.5); // Default completely in the middle
          }
        }, 0);
      }
    }

    // ✅ Base内の Mesh をすべて収集（壁/床の判定は Raycastヒット後に法線で行う）
    const baseMeshes = [];
    g.traverse((o) => {
      if (!o?.isMesh) return;
      if (!o.geometry) return;

      // ゴーストモードで躯体のみを透過するための識別フラグ
      o.userData.isStructuralBase = true;

      // 天井（Ceiling）の判定と表示制御
      const name = o.name.toLowerCase();
      const isCeiling = name.includes("ceiling") || name.includes("天井");
      if (isCeiling) {
        if (isSectionClipEnabled) {
          o.visible = false;
        } else if (editorMode === "layout") {
          o.visible = layoutSubMode === "ceiling_top";
        } else {
          o.visible = true;
        }
      }

      // Raycastが安定するよう、薄い板でも当たりやすくする（必要なら）
      const targetSide = effectiveSubMode === "furniture_iso" ? THREE.FrontSide : THREE.DoubleSide;
      if (Array.isArray(o.material)) o.material.forEach((m) => { m.side = targetSide; m.needsUpdate = true; });
      else if (o.material) { o.material.side = targetSide; o.material.needsUpdate = true; }

      // LayoutのTopビューやZoningの2Dビューで、壁の輪郭を黒い線で描画して平面図のように見せる
      if (!isCeiling) {
        const isTopView = (effectiveSubMode === "furniture_top" || effectiveSubMode === "zone_2d");
        if (isTopView) {
          if (!o.userData.baseOutlineMesh && o.geometry && o.geometry.attributes.position) {
            try {
              const edges = new THREE.EdgesGeometry(o.geometry, 15);
              const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
              lineMat.polygonOffset = true;
              lineMat.polygonOffsetFactor = -1;
              lineMat.polygonOffsetUnits = -1;
              const outlineMesh = new THREE.LineSegments(edges, lineMat);
              o.add(outlineMesh);
              o.userData.baseOutlineMesh = outlineMesh;
            } catch (err) {}
          }
          if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = true;
        } else {
          if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = false;
        }
      }

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
  }, [gltf, url, onLoaded, layoutSubMode, editorMode, isSectionClipEnabled, effectiveSubMode]);

  const clonedScene = useMemo(() => {
    return gltf.scene ? gltf.scene.clone() : null;
  }, [gltf.scene]);

  return (
    <group ref={groupRef}>
      {clonedScene && <primitive object={clonedScene} />}
    </group>
  );
}
