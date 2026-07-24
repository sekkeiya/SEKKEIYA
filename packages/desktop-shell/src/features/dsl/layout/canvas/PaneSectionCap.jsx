// PaneSectionCap — 図面グリッドのペイン用「切り口の黒塗り（ポシェ）＋切断面フレーム」。
//
// SectionCapFill のペイン版。本家はグローバルな断面状態（isSectionClipEnabled 等）を読むが、
// グリッドではペインごとに切断位置が違うため、axis/pos を props で受けて単軸だけ描く。
// ステンシル手法は「切られたジオメトリ」から断面を検出するので、切り方が
// material.clippingPlanes（単体ビュー）でも renderer.clippingPlanes（グリッドペイン）でも成立する。
import React, { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEditorModeStore } from "../store/useEditorModeStore";

const CAP_COLOR = 0x0a0a0a;

function makeStencilMat(side, op) {
  const m = new THREE.MeshBasicMaterial();
  m.depthWrite = false; m.depthTest = false; m.colorWrite = false; m.stencilWrite = true;
  m.stencilFunc = THREE.AlwaysStencilFunc; m.side = side;
  m.stencilFail = op; m.stencilZFail = op; m.stencilZPass = op;
  return m;
}

export default function PaneSectionCap({ axis, pos }) {
  const { gl, scene, camera } = useThree();
  const sceneMaxY = useEditorModeStore((s) => s.sceneMaxY);
  const sceneExtentXZ = useEditorModeStore((s) => s.sceneExtentXZ);

  const rootRef = useRef();
  const builtRef = useRef({ key: "", items: [] });
  const lastCheckRef = useRef(0);
  const [buildTick, setBuildTick] = useState(0);

  const collectSrcs = () => {
    const srcs = [];
    if (!scene) return srcs;
    scene.traverse((o) => {
      if (!o?.isMesh || !o.geometry) return;
      if (o.userData?.isSectionFill || o.userData?.isSurfaceFinish || o.userData?.replacedByUnion) return;
      if (o.userData?.isStructuralBase) srcs.push(o);
    });
    return srcs;
  };

  const capExtent = () =>
    Math.max((sceneExtentXZ || 0) * 1.4, (sceneMaxY || 0) * 1.4, (sceneMaxY || 0) > 100 ? 3000 : 3);

  // ビルド：躯体メッシュからステンシル対＋キャップ板を生成（自軸のみ）。
  useEffect(() => {
    const group = rootRef.current;
    if (!group) return;
    const srcs = collectSrcs();
    const half = capExtent();
    const capW = half * 2;
    const key = capW.toFixed(0) + "|" + srcs.map((s) => s.uuid).join(",");
    if (key === builtRef.current.key && group.children.length) return;
    if (!srcs.length) return; // 躯体未ロード（useFrame の再チェックで拾う）

    group.clear();
    const stencil = [];
    const order = 9990;
    for (const src of srcs) {
      const mB = new THREE.Mesh(src.geometry, makeStencilMat(THREE.BackSide, THREE.IncrementWrapStencilOp));
      const mF = new THREE.Mesh(src.geometry, makeStencilMat(THREE.FrontSide, THREE.DecrementWrapStencilOp));
      [mB, mF].forEach((m) => { m.matrixAutoUpdate = false; m.renderOrder = order; m.userData.isSectionFill = true; });
      group.add(mB); group.add(mF);
      stencil.push({ src, mB, mF });
    }
    const capMat = new THREE.MeshBasicMaterial({ color: CAP_COLOR, side: THREE.DoubleSide });
    capMat.stencilWrite = true; capMat.stencilRef = 0; capMat.stencilFunc = THREE.NotEqualStencilFunc;
    capMat.stencilFail = THREE.ReplaceStencilOp; capMat.stencilZFail = THREE.ReplaceStencilOp; capMat.stencilZPass = THREE.ReplaceStencilOp;
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(capW, capW), capMat);
    cap.renderOrder = order + 1; cap.userData.isSectionFill = true; cap.matrixAutoUpdate = false;
    cap.onAfterRender = (renderer) => renderer.clearStencil();
    group.add(cap);
    builtRef.current = { key, items: [{ stencil, cap, half }] };

    // このコンテキストで事前コンパイル（demand の非アクティブペインでも明示GL呼び出しは走る）。
    try {
      if (typeof gl.compileAsync === "function") gl.compileAsync(group, camera).catch(() => {});
      else gl.compile(group, camera);
    } catch { /* ベストエフォート */ }
  }, [buildTick, scene, camera, gl, sceneMaxY, sceneExtentXZ]);

  // 毎フレーム：キャップ位置＋行列同期。躯体の差し替えは 0.5s 間引きで検知して再ビルド。
  useFrame((state) => {
    const group = rootRef.current;
    if (!group) return;
    const items = builtRef.current.items;
    if (!items.length) {
      // 躯体がまだなら定期的にビルドを再試行
      const now = state.clock.elapsedTime;
      if (now - lastCheckRef.current > 0.5) { lastCheckRef.current = now; setBuildTick((t) => t + 1); }
      return;
    }
    const now = state.clock.elapsedTime;
    if (now - lastCheckRef.current > 0.5) {
      lastCheckRef.current = now;
      const srcs = collectSrcs();
      const capW = capExtent() * 2;
      const key = capW.toFixed(0) + "|" + srcs.map((s) => s.uuid).join(",");
      if (key !== builtRef.current.key) { setBuildTick((t) => t + 1); return; }
    }
    for (const it of items) {
      const half = it.half;
      if (axis === "x") { it.cap.position.set(pos, half * 0.5, 0); it.cap.rotation.set(0, Math.PI / 2, 0); }
      else { it.cap.position.set(0, half * 0.5, pos); it.cap.rotation.set(0, 0, 0); }
      it.cap.updateMatrix();
      it.cap.visible = true;
      for (const sm of it.stencil) {
        sm.mB.visible = true; sm.mF.visible = true;
        sm.mB.matrix.copy(sm.src.matrixWorld); sm.mF.matrix.copy(sm.src.matrixWorld);
      }
    }
  });

  // 切り口の黒ポシェ（rootRef のキャップ群）だけを描く。切断面フレーム（どこを切っているかの枠）は
  // 2D 作図ビューでは不要なので出さない（単体ビューの SectionClipManager と揃える）。
  return (
    <group userData={{ isSectionRef: true }}>
      <group ref={rootRef} userData={{ isSectionRef: true }} />
    </group>
  );
}
