// BubbleFill — ゾーンを「グラデーションのかかった円（バブル）」で塗る板（Phase C）。
//   中心が濃く、rect の縁に向かって透明にフェードするラジアルグラデーション。
//   ゾーン＝室内の機能の“ざっくり範囲”を柔らかく示すためのマーカー表現。
//   rect（幅×奥行）にフィットする楕円グラデ。データ・操作は従来の rect のまま。
import React, { useMemo, useRef } from "react";
import * as THREE from "three";

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uCore; // 中心の“濃い”半径比（0..1）
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;     // -1..1（rect にフィットする楕円座標）
    float d = length(p);            // 0=中心 .. 1=縁
    float a = smoothstep(1.0, uCore, d); // 縁で0、uCore 以内でほぼ1
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;

export default function BubbleFill({
  width, depth, color = "#38bdf8", opacity = 0.4, core = 0.2,
  y = 0, renderOrder = 0, ...handlers
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uCore: { value: core },
    }),
    [], // 初期化のみ。値は下で毎回反映。
  );
  const matRef = useRef();
  // props 変化を uniform に反映（再マウントせず色/濃さを更新）。
  uniforms.uColor.value.set(color);
  uniforms.uOpacity.value = opacity;
  uniforms.uCore.value = core;

  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={renderOrder} {...handlers}>
      <planeGeometry args={[width, depth]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/** 楕円の輪郭ポイント（rect にフィット）。lineLoop 用の Float32Array（XZ 平面）。 */
export function ellipseOutline(width, depth, segments = 48) {
  const rx = width / 2;
  const rz = depth / 2;
  const arr = new Float32Array(segments * 3);
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    arr[i * 3] = Math.cos(t) * rx;
    arr[i * 3 + 1] = 0;
    arr[i * 3 + 2] = Math.sin(t) * rz;
  }
  return arr;
}
