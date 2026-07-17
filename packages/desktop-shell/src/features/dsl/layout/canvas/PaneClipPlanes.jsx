// PaneClipPlanes — 図面グリッド（分割図面ビュー）ペイン用のクリップ。
//
// なぜ renderer 単位（gl.clippingPlanes）なのか:
//   マテリアル実体はペイン間で共有される（gltf.scene.clone() はマテリアルを複製しない）ため、
//   SectionClipManager のように material.clippingPlanes へ焼き込む方式では
//   「ペインごとに別の断面位置」を持てない（複数ペインが毎フレーム奪い合いになる）。
//   renderer.clippingPlanes はレンダラー（= canvas = ペイン）単位に独立して効き、
//   マテリアルには一切触らないので、断面 A-A' | B-B' のような分割表示が成立する。
//
// 割り切り: renderer 単位クリップはそのペインの全描画（グリッド線等の UI 含む）に効く。
//   図面ペインは閲覧用なので許容する（編集ギズモは FRONT/RIGHT ペインには出ない）。
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function PaneClipPlanes({ planes }) {
  const { gl, scene, invalidate } = useThree();

  const threePlanes = useMemo(
    () => (planes || []).map((p) => new THREE.Plane(new THREE.Vector3(...p.normal), p.constant)),
    [planes]
  );

  useEffect(() => {
    gl.clippingPlanes = threePlanes;
    invalidate();
    // 診断用: 断面が切れない報告があったときに、ペインへ面が届いているか一目で分かるように。
    console.debug(
      `[PaneClipPlanes] apply ${threePlanes.length} plane(s)`,
      threePlanes.map((p) => `n=(${p.normal.x},${p.normal.y},${p.normal.z}) c=${p.constant}`).join(" | ")
    );
    return () => {
      gl.clippingPlanes = [];
    };
  }, [gl, threePlanes, invalidate]);

  // 共有マテリアルに（グリッド表示前の SINGLE ビューで）焼かれた material.clippingPlanes を
  // 掃除する。書き込み役の SectionClipManager はグリッド中 passive なので、ここで拭かないと
  // 古い断面が全ペインに残る。マテリアルは共有なので 1 ペインが拭けば全ペインに効く（冪等）。
  const lastRef = useRef(0);
  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastRef.current < 0.5) return;
    lastRef.current = now;
    let cleared = false;
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const clear = (m) => {
          if (m.clippingPlanes && m.clippingPlanes.length > 0) {
            m.clippingPlanes = [];
            m.needsUpdate = true;
            cleared = true;
          }
        };
        if (Array.isArray(child.material)) child.material.forEach(clear);
        else clear(child.material);
      }
    });
    if (cleared) invalidate();
  });

  return null;
}
