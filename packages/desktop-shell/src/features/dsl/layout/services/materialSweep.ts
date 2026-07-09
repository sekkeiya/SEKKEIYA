/**
 * マテリアル自動付与の「天井→壁→床へ斜めに這うスキャンライン」演出。
 *
 * 仕組み:
 *  - ワールド空間に1枚の斜めの前線(uSweepFront)を置き、上(天井)→下(床)へ降ろす。
 *  - 各オーバーレイ素材は同じ前線を共有し、前線より上=表示／下=非表示。
 *    壁は前線が降りるにつれ上から下へ連続してリビールされる（面を這う一体感）。
 *  - 前線方向 uSweepDir を少し斜めにして、線が斜めに走るようにする。
 *  - 前線付近の青いグローが「這う光の線」になる。
 *  - 非アクティブ時(uSweepActive=0)は全面そのまま表示（通常状態）。
 */
import { create } from "zustand";
import * as THREE from "three";

interface SweepState {
  sweep: { token: number; durationMs: number } | null;
  startSweep: (o: {
    durationMs?: number;
    color?: string;
    /** リビール境界のソフト幅（ワールド単位） */
    width?: number;
    /** 前線の向き（上向き成分が天井側）。少し斜めにすると斜め走行。 */
    dir: [number, number, number];
    /** dir 方向の投影レンジ（モデルのbboxから算出） */
    min: number;
    max: number;
  }) => void;
  clear: () => void;
}

let tokenSeq = 0;

/** 全オーバーレイ素材が共有するユニフォーム。 */
export const sweepUniforms = {
  uSweepActive: { value: 0 },
  /** 進行度 0..1（0=天井のみ, 1=全面） */
  uSweepProgress: { value: 0 },
  /** 前線の向き（正規化前でも可）。dir·p が大きいほど先に出る＝天井側。 */
  uSweepDir: { value: new THREE.Vector3(-0.35, 1, -0.2) },
  uSweepMin: { value: 0 },
  uSweepMax: { value: 1 },
  uSweepColor: { value: new THREE.Color("#5b9dff") },
  uSweepWidth: { value: 1 },
};

export const useMaterialSweepStore = create<SweepState>((set) => ({
  sweep: null,
  startSweep: (o) => {
    sweepUniforms.uSweepDir.value.set(o.dir[0], o.dir[1], o.dir[2]);
    sweepUniforms.uSweepMin.value = o.min;
    sweepUniforms.uSweepMax.value = o.max;
    if (o.color) sweepUniforms.uSweepColor.value.set(o.color);
    if (typeof o.width === "number") sweepUniforms.uSweepWidth.value = o.width;
    // 最初の描画フレームから「前線より下は非表示」にしておく（全面チラ見え防止）。
    sweepUniforms.uSweepProgress.value = 0;
    sweepUniforms.uSweepActive.value = 1;
    set({ sweep: { token: ++tokenSeq, durationMs: o.durationMs ?? 1500 } });
  },
  clear: () => set({ sweep: null }),
}));

/**
 * MeshStandardMaterial に「斜め前線リビール」を注入する（全面で共有ユニフォーム駆動）。
 * @param invert true で「前線より下（未スキャン側）」を表示する＝旧素材を残すために使う。
 *   これにより白を挟まず 旧→新 がクロスフェードする。invert された素材には光の線を出さない。
 */
export function applySweepToMaterial(material: any, invert = false) {
  if (!material) return;
  material.userData = material.userData || {};
  material.transparent = true;

  // invert は素材ごとに変えられる必要があるので素材固有ユニフォームにする。
  const uSweepInvert = { value: invert ? 1 : 0 };
  material.userData.__sweepInvert = uSweepInvert;

  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uSweepActive = sweepUniforms.uSweepActive;
    shader.uniforms.uSweepProgress = sweepUniforms.uSweepProgress;
    shader.uniforms.uSweepDir = sweepUniforms.uSweepDir;
    shader.uniforms.uSweepMin = sweepUniforms.uSweepMin;
    shader.uniforms.uSweepMax = sweepUniforms.uSweepMax;
    shader.uniforms.uSweepColor = sweepUniforms.uSweepColor;
    shader.uniforms.uSweepWidth = sweepUniforms.uSweepWidth;
    shader.uniforms.uSweepInvert = uSweepInvert;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSweepWorld;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vSweepWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;"
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vSweepWorld;\nuniform float uSweepActive;\nuniform float uSweepProgress;\nuniform vec3 uSweepDir;\nuniform float uSweepMin;\nuniform float uSweepMax;\nuniform vec3 uSweepColor;\nuniform float uSweepWidth;\nuniform float uSweepInvert;"
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
  if (uSweepActive > 0.5) {
    float proj = dot(vSweepWorld, normalize(uSweepDir));
    // 前線は上(max)→下(min)へ降りる
    float front = mix(uSweepMax, uSweepMin, uSweepProgress);
    float w = max(uSweepWidth, 1e-4);
    // 新素材: proj >= front（前線より上）を表示 / 旧素材(invert): 前線より下を表示
    float reveal = smoothstep(front - w, front, proj);
    float a = mix(reveal, 1.0 - reveal, uSweepInvert);
    if (a <= 0.001) discard;
    // 青い光の線（前線のグロー）は新旧どちらの素材にも出す。
    // 旧素材(invert)は前線より下を表示しているので、その上端＝前線に線が乗り、
    // 新素材のビルドが遅い面でも「表示中の素材の上をラインが走り続ける」。
    float band = exp(-pow((proj - front) / (w * 0.6), 2.0));
    gl_FragColor.rgb += uSweepColor * band * 1.9;
    gl_FragColor.a *= a;
  }`
      );
  };

  material.needsUpdate = true;
}
