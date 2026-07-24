import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
import { useSceneObjectRegistryStore } from "../../store/sceneObjectRegistryStore";
import { useEditorModeStore } from "../../store/useEditorModeStore";

export default function SceneGrid() {
  const isGridVisible = useEditorModeStore((s) => s.isGridVisible);
  const gridHeightMm = useEditorModeStore((s) => s.gridHeightMm);
  const gridCellSizeMm = useEditorModeStore((s) => s.gridCellSizeMm);
  const gridLineStyle = useEditorModeStore((s) => s.gridLineStyle);   // solid / dashed / dotted
  const gridLineColor = useEditorModeStore((s) => s.gridLineColor);   // hex
  const gridLineOpacity = useEditorModeStore((s) => s.gridLineOpacity); // 0..1
  const editorMode = useEditorModeStore((s) => s.editorMode);
  const baseColliders = useSceneObjectRegistryStore((s) => s.baseColliders);

  // 原点からどこまで建物が広がっているか（各辺の最遠点の絶対値）。グリッドはこれを覆う。
  const buildingExtent = useMemo(() => {
    if (!baseColliders || baseColliders.length === 0) return 0;
    const box = new THREE.Box3();
    baseColliders.forEach((c) => {
      if (c.isMesh || c.isObject3D) {
        c.updateMatrixWorld(true);
        box.expandByObject(c);
      }
    });
    if (box.isEmpty()) return 0;
    return Math.max(
      Math.abs(box.min.x), Math.abs(box.max.x),
      Math.abs(box.min.z), Math.abs(box.max.z),
    );
  }, [baseColliders]);

  // グリッド本体（LineSegments）。線種・色・透明度をここで反映する。
  //   ・作業領域「全体」を覆う: ワールド原点中心に、建物端＋10m（最低でも半径30m）まで。
  //   ・セルは整数枚（左右対称）＝格子線が原点基準の cell 倍に一致（Shift スナップと重なる）。
  //   ・破線/点線は LineDashedMaterial＋computeLineDistances で表現する。
  const grid = useMemo(() => {
    if (editorMode !== "layout" || !isGridVisible || gridCellSizeMm <= 0) return null;
    let halfMm = Math.max(buildingExtent + 10000, 30000);
    halfMm = Math.min(halfMm, gridCellSizeMm * 500); // 片側 最大500セル（線が多すぎない上限）
    const cellsHalf = Math.max(1, Math.ceil(halfMm / gridCellSizeMm));
    const half = cellsHalf * gridCellSizeMm;
    const divisions = cellsHalf * 2;

    const positions = [];
    for (let i = 0; i <= divisions; i++) {
      const p = -half + i * gridCellSizeMm;
      positions.push(p, 0, -half, p, 0, half); // 縦線（Z 方向に伸びる）
      positions.push(-half, 0, p, half, 0, p); // 横線（X 方向に伸びる）
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

    const dashed = gridLineStyle === "dashed" || gridLineStyle === "dotted";
    const dotted = gridLineStyle === "dotted";
    const mat = dashed
      ? new THREE.LineDashedMaterial({
          color: gridLineColor,
          transparent: true,
          opacity: gridLineOpacity,
          depthWrite: false,
          dashSize: dotted ? gridCellSizeMm * 0.04 : gridCellSizeMm * 0.2,
          gapSize: dotted ? gridCellSizeMm * 0.06 : gridCellSizeMm * 0.12,
        })
      : new THREE.LineBasicMaterial({
          color: gridLineColor,
          transparent: true,
          opacity: gridLineOpacity,
          depthWrite: false,
        });

    const seg = new THREE.LineSegments(geo, mat);
    if (dashed) seg.computeLineDistances(); // 破線/点線は線距離が必要
    return seg;
  }, [editorMode, isGridVisible, buildingExtent, gridCellSizeMm, gridLineStyle, gridLineColor, gridLineOpacity]);

  // 破棄（設定変更で作り直すたびに前のジオメトリ/マテリアルを解放）
  useEffect(() => () => {
    if (grid) { grid.geometry.dispose(); grid.material.dispose(); }
  }, [grid]);

  if (!grid) return null;

  // 位置（高さ）は primitive の prop で与える（ジオメトリには焼き込まない）。1mm 持ち上げ。
  return <primitive object={grid} position={[0, gridHeightMm + 1, 0]} />;
}
