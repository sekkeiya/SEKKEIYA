// WalkthroughAvatarModel.jsx
//
// 三人称ウォークスルーで S.Models 登録キャラクター(.glb)を表示するアバター。
// Phase B: GLB にアニメーション(idle/walk/run)があれば再生する。
//
// - SkeletonUtils.clone でスキン付きメッシュ/スケルトンを正しく複製
// - drei useAnimations で AnimationMixer を構築（mixer.update は内部で実行）
// - locomotionRef.current ("idle"|"walk"|"run") に応じてクリップをクロスフェード
// - 全高 heightM に合わせてスケールし、足元をローカル原点へ
//
// アニメが無いモデルは静的表示にフォールバック。

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";

import { resolveLocomotionClips } from "./gltfClipUtils";

const FADE = 0.25; // クロスフェード秒

export default function WalkthroughAvatarModel({ url, heightM = 1.7, unitsPerMeter = 1, locomotionRef }) {
  const { scene, animations } = useGLTF(url);

  // スキン付きを正しく複製（scene.clone では skeleton 参照が壊れる）
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  const groupRef = useRef(null);
  const { actions, names } = useAnimations(animations, groupRef);

  // 全高に合わせてスケール ＆ 足元を原点へ
  useEffect(() => {
    if (!cloned) return;
    cloned.scale.setScalar(1);
    cloned.position.set(0, 0, 0);
    cloned.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const targetH = heightM * unitsPerMeter;
    const s = size.y > 1e-6 ? targetH / size.y : 1;
    cloned.scale.setScalar(s);

    cloned.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box2.getCenter(center);
    cloned.position.x -= center.x;
    cloned.position.z -= center.z;
    cloned.position.y -= box2.min.y;

    cloned.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.frustumCulled = false; // スキン変形でカリング誤判定を防ぐ
      }
    });
  }, [cloned, heightM, unitsPerMeter]);

  const clipMap = useMemo(() => resolveLocomotionClips(names), [names]);
  const currentRef = useRef(null);

  // 初期クリップ（idle、無ければ最初のクリップ）を再生
  useEffect(() => {
    if (!names.length) return;
    const start = clipMap.idle || names[0];
    const act = start && actions[start];
    if (act) {
      act.reset().fadeIn(FADE).play();
      currentRef.current = start;
    }
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
      currentRef.current = null;
    };
    // actions / names が確定したタイミングで一度だけ
  }, [actions, names, clipMap.idle]);

  // ロコモーション状態に応じてクリップを切替
  useFrame(() => {
    if (!names.length || !locomotionRef) return;
    const want = locomotionRef.current || "idle";
    let target = clipMap[want];
    if (want === "run" && !clipMap.run) target = clipMap.walk; // run 無ければ walk
    if (!target) target = clipMap.idle || names[0];
    if (!target || target === currentRef.current) return;

    const next = actions[target];
    if (!next) return;
    const prev = currentRef.current ? actions[currentRef.current] : null;
    if (prev && prev !== next) prev.fadeOut(FADE);
    next.reset().fadeIn(FADE).play();
    currentRef.current = target;
  });

  if (!cloned) return null;
  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}
