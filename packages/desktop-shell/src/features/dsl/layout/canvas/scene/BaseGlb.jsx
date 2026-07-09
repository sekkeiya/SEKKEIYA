// src/features/layout/components/MainArea/components/scene/BaseGlb.jsx
import React, { useEffect, useRef, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useEditorModeStore, useViewportEditorMode } from "../../store/useEditorModeStore";
import { runScanDiagnostics } from "../../services/scanDiagnostics";

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
  // 平面図ポシェ用の真っ黒・無光源マテリアル（Topビューで壁を塗りつぶす）。
  // depthTest/Write 無効＋高 renderOrder で、床仕上げの上に常に黒く描く。
  const fillMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, depthTest: false, depthWrite: false }),
    []
  );
  useEffect(() => () => { fillMat.dispose(); }, [fillMat]);
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
          // mm スケール GLB を読み込んだ場合（computedMaxY > 100）、
          // sectionClipHeight を常に 1500mm に設定する（建物高さの中間ではなく固定値）。
          if (computedMaxY > 100 && sectionClipHeight < 10) {
            setSectionClipHeight(1500); // 1500mm 固定
          }
        }, 0);
      }
    }

    // ✅ Base内の Mesh をすべて収集（壁/床の判定は Raycastヒット後に法線で行う）
    const baseMeshes = [];
    g.traverse((o) => {
      if (!o?.isMesh) return;
      if (!o.geometry) return;

      // 自前で追加した平面図ポシェ用の黒塗りメッシュ（isSectionFill）は処理対象外。
      // これを躯体メッシュとして処理すると、同形状の黒塗り子メッシュを無限に追加し続け、
      // 1 回の traverse 内で updateMatrixWorld がスタックオーバーフロー（Maximum call stack）する。
      if (o.userData?.isSectionFill) return;

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

        // 壁判定: 鉛直方向に高さがあるメッシュ＝壁（薄い床・板は除外）。mm/m スケール両対応。
        let isWall = false;
        try {
          const wb = new THREE.Box3().setFromObject(o);
          const yExt = wb.max.y - wb.min.y;
          const mm = wb.max.y > 50; // mm スケール GLB かどうかの簡易判定
          isWall = yExt > (mm ? 500 : 0.5);
        } catch (err) {}

        if (isTopView) {
          // 輪郭線（既存）
          if (!o.userData.baseOutlineMesh && o.geometry && o.geometry.attributes.position) {
            try {
              const edges = new THREE.EdgesGeometry(o.geometry, 15);
              const lineMat = new THREE.LineBasicMaterial({ color: 0x000000 });
              lineMat.polygonOffset = true;
              lineMat.polygonOffsetFactor = -1;
              lineMat.polygonOffsetUnits = -1;
              const outlineMesh = new THREE.LineSegments(edges, lineMat);
              outlineMesh.renderOrder = 10000; // 黒塗りより前面に
              o.add(outlineMesh);
              o.userData.baseOutlineMesh = outlineMesh;
            } catch (err) {}
          }
          if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = true;

          // 壁の黒塗り（平面図ポシェ）: 壁メッシュと同形状の黒い子メッシュを重ねる。
          // 上から見ると壁の天端面が黒く塗られ、平面図の「壁の中が黒」表現になる。
          // ただし断面クリップ中は「切って中を見る」モードなので黒塗りは出さない
          // （単一マスの躯体だと黒塗りが建物全体を覆って真っ黒になるため）。
          if (isWall && !isSectionClipEnabled) {
            if (!o.userData.baseFillMesh && o.geometry && o.geometry.attributes.position) {
              try {
                const fillMesh = new THREE.Mesh(o.geometry, fillMat);
                fillMesh.renderOrder = 9998;
                fillMesh.raycast = () => null;
                fillMesh.userData.isSectionFill = true;
                o.add(fillMesh);
                o.userData.baseFillMesh = fillMesh;
              } catch (err) {}
            }
            if (o.userData.baseFillMesh) o.userData.baseFillMesh.visible = true;
          } else if (o.userData.baseFillMesh) {
            o.userData.baseFillMesh.visible = false;
          }
        } else {
          if (o.userData.baseOutlineMesh) o.userData.baseOutlineMesh.visible = false;
          if (o.userData.baseFillMesh) o.userData.baseFillMesh.visible = false;
        }
      }

      baseMeshes.push(o);
    });

    // 🔬 一時診断: window.__SK_SCAN_DEBUG__=true のときのみ走る（自動マテリアル設計検証）
    try { runScanDiagnostics(g, baseMeshes); } catch (e) { /* noop */ }

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
