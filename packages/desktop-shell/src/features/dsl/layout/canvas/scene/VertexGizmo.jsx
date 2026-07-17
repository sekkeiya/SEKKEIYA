// VertexGizmo — 壁・床の「選択中の頂点/ハンドル」に、Item 選択時と同じ移動ギズモ
// (TransformGizmo = PivotControls) を取り付けて動かせるようにする。
//   ・頂点は平面上の点なので X / Z の矢印＋XZ 平面スライダーだけを出す
//     （Y・回転・スケールは意味がないので隠す）
//   ・ギズモは見えない代理オブジェクト（proxy）を動かし、その位置(mm)を
//     onMove({ xMm, zMm }) で通知する（rAF スロットリング済み）。離すと onCommit()。
//   ・xMm/zMm は「現在の頂点位置」。ドラッグ中以外は外部の変更（ハンドルの直接
//     ドラッグやスナップ確定）に proxy を追従させる。
// 親（Wall/SlabEditController）のルート group に ignoreClipping が付いているため、
// このギズモも断面クリップの対象外になる（頂点ハンドルと同じ扱い）。
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import TransformGizmo from "../tools/gizmo/TransformGizmo.jsx";

export default function VertexGizmo({ orbitRef, xMm, zMm, y, k, onBegin, onMove, onCommit }) {
  const proxy = useMemo(() => new THREE.Group(), []);
  const draggingRef = useRef(false);

  // ドラッグ中は TransformGizmo が proxy を動かす側なので、外部からの上書きはしない
  useEffect(() => {
    if (!draggingRef.current) proxy.position.set(xMm * k, y, zMm * k);
  }, [proxy, xMm, zMm, y, k]);

  return (
    <>
      <primitive object={proxy} />
      <TransformGizmo
        orbitRef={orbitRef}
        selectedObject={proxy}
        mode="translate"
        axes={[true, false, true]}
        disableRotations
        disableScaling
        onBeginTransform={() => {
          draggingRef.current = true;
          onBegin?.();
        }}
        onChangeTransform={(t) => {
          if (!draggingRef.current) return;
          onMove?.({ xMm: t.position[0] / k, zMm: t.position[2] / k });
        }}
        // onCommitTransform は onChangeTransform（最終値）→ onEndTransform の順で呼ばれる。
        // 最終値は上の onChangeTransform が受けるので、ここでは終了通知だけでよい。
        onEndTransform={() => {
          draggingRef.current = false;
          onCommit?.();
        }}
      />
    </>
  );
}
