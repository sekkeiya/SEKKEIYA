// SectionWarmup — 高さ設定（断面）に入った瞬間に、各ビューポートのクリッピング版
// シェーダを非ブロッキングで事前コンパイルする。
//
// 背景: SINGLE レイアウトでは vp_top/persp/front/right の4枚が常時マウントされるが、
// 非アクティブな Canvas は display:none + frameloop="demand" のため描画されない。
// このため「縦/側面(vp_right) ⇄ 横/正面(vp_front)」を初めて切り替えた瞬間に、
// そのコンテキストで全マテリアルのクリッピング付きシェーダがまとめて初コンパイルされ、
// 数秒のフリーズ（断面が出るまでの待ち）が発生していた。
//
// 対策: 高さ設定 active になったら、各ビューポートのコンテキストで
//   - まだクリップ面を持たないマテリアルに「何も切らない遠方の1面」を割り当て、
//     クリップ面数=1 のプログラム亜種を gl.compileAsync で先にコンパイル・キャッシュさせる。
//   - その1面は付けたまま残す（外すとプログラム参照が消えてキャッシュ破棄→事前コンパイルが無駄になる）。
//     遠方で何も切らないので見た目は不変。実際に表示中のビューは SectionClipManager が
//     本物のクリップ面（同じ面数=1）へ差し替えるため、再コンパイルは起きずに即切替できる。
// 高さ設定を抜けると SectionClipManager の無効化処理が全マテリアルのクリップ面を消す。
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useHeightSetupStore } from "../../store/useHeightSetupStore";

export default function SectionWarmup() {
  const { gl, scene, camera } = useThree();
  const active = useHeightSetupStore((s) => s.active);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!active) { doneRef.current = false; return; }
    if (doneRef.current) return;
    doneRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        gl.localClippingEnabled = true;
        // 何も切らない遠方の面（-y + 1e7 >= 0 が常に真 → 全フラグメント保持）。
        const benign = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e7);
        let touched = 0;
        scene.traverse((o) => {
          if (!o?.isMesh || !o.material) return;
          if (o.userData?.ignoreClipping) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            // 既にクリップ面を持つ（=表示中ビューの本物のクリップ等）マテリアルは触らない。
            if (m.clippingPlanes && m.clippingPlanes.length >= 1) continue;
            m.clippingPlanes = [benign];
            m.needsUpdate = true;
            touched++;
          }
        });
        if (!touched) return;
        if (typeof gl.compileAsync === "function") {
          await gl.compileAsync(scene, camera);
        } else {
          gl.compile(scene, camera);
        }
        if (cancelled) return;
      } catch {
        // ウォームアップはベストエフォート。失敗しても従来通り（初回切替で遅延）になるだけ。
      }
    })();

    return () => { cancelled = true; };
  }, [active, gl, scene, camera]);

  return null;
}
