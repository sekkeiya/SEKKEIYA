// WalkthroughAvatar.jsx
//
// 三人称ウォークスルー時に表示する簡易ヒューマノイド・アバター。
// 純粋な見た目だけのコンポーネント（位置・向きは親 group が制御する）。
// 将来的に実 GLB アバターへ差し替え可能。
//
// ローカル原点 = 足元。+Z 方向が「正面」。

import { useMemo } from "react";
import * as THREE from "three";

// descriptor: { color, heightM, shoulderM } を受け取る簡易アバター
export default function WalkthroughAvatar({ color = "#5b8def", heightM = 1.75, shoulderM = 0.46, unitsPerMeter = 1 }) {
  const c = { color, heightM, shoulderM };
  const u = unitsPerMeter;

  const dims = useMemo(() => {
    const h = c.heightM * u;
    const shoulder = c.shoulderM * u;
    // 比率（全高 h に対する各パーツ）
    const headR = h * 0.07;
    const headCenterY = h * 0.91;
    const torsoH = h * 0.34;
    const torsoCenterY = h * 0.58;
    const torsoR = shoulder * 0.5;
    const hipY = h * 0.45;
    const legH = h * 0.45;
    const legR = torsoR * 0.42;
    const legOffset = torsoR * 0.45;
    const armH = h * 0.36;
    const armR = torsoR * 0.34;
    const armOffset = torsoR + armR * 0.6;
    const armCenterY = h * 0.6;
    return {
      h, headR, headCenterY, torsoH, torsoCenterY, torsoR,
      hipY, legH, legR, legOffset, armH, armR, armOffset, armCenterY,
    };
  }, [c.heightM, c.shoulderM, u]);

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.55, metalness: 0.1 }),
    [c.color]
  );
  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#f0c9a8", roughness: 0.7, metalness: 0.0 }),
    []
  );

  return (
    <group>
      {/* 頭 */}
      <mesh position={[0, dims.headCenterY, 0]} material={skinMat} castShadow>
        <sphereGeometry args={[dims.headR, 20, 16]} />
      </mesh>

      {/* 胴体（カプセル） */}
      <mesh position={[0, dims.torsoCenterY, 0]} material={bodyMat} castShadow>
        <capsuleGeometry args={[dims.torsoR, dims.torsoH, 6, 12]} />
      </mesh>

      {/* 鼻（正面マーカー、+Z を向く） */}
      <mesh
        position={[0, dims.headCenterY, dims.headR * 0.92]}
        rotation={[Math.PI / 2, 0, 0]}
        material={skinMat}
      >
        <coneGeometry args={[dims.headR * 0.22, dims.headR * 0.5, 8]} />
      </mesh>

      {/* 両腕 */}
      <mesh position={[dims.armOffset, dims.armCenterY, 0]} material={bodyMat} castShadow>
        <capsuleGeometry args={[dims.armR, dims.armH, 4, 8]} />
      </mesh>
      <mesh position={[-dims.armOffset, dims.armCenterY, 0]} material={bodyMat} castShadow>
        <capsuleGeometry args={[dims.armR, dims.armH, 4, 8]} />
      </mesh>

      {/* 両脚 */}
      <mesh position={[dims.legOffset, dims.legH * 0.5, 0]} material={bodyMat} castShadow>
        <capsuleGeometry args={[dims.legR, dims.legH, 4, 8]} />
      </mesh>
      <mesh position={[-dims.legOffset, dims.legH * 0.5, 0]} material={bodyMat} castShadow>
        <capsuleGeometry args={[dims.legR, dims.legH, 4, 8]} />
      </mesh>
    </group>
  );
}
