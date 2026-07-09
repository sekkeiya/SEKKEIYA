// useViewportEnvStore.ts
// Twinmotion 風 Ambience タブ群 (Env / Camera / Render) の設定を保持する Store。
// Ambience を Scene で選択した時の Properties パネルから編集され、
// SingleViewportCanvas / ViewportDisplayController / Lights がこの値を読み取って
// gl.toneMapping / gl.toneMappingExposure / camera.fov / shadow map size /
// 各ライトの color に white balance tint を反映する。

import { create } from 'zustand';
import * as THREE from 'three';

export type ToneMappingMode = 'none' | 'aces' | 'reinhard' | 'cineon' | 'agx';
export type ShadowQuality = 'low' | 'medium' | 'high';

/** ShadowQuality → 各ライトの shadow map ピクセル数 */
export function shadowMapSizeForQuality(q: ShadowQuality): number {
  switch (q) {
    case 'low':    return 1024;
    case 'high':   return 4096;
    case 'medium':
    default:       return 2048;
  }
}

/** ToneMappingMode → THREE.js 定数 */
export function threeToneMapping(mode: ToneMappingMode) {
  switch (mode) {
    case 'aces':     return THREE.ACESFilmicToneMapping;
    case 'reinhard': return THREE.ReinhardToneMapping;
    case 'cineon':   return THREE.CineonToneMapping;
    case 'agx':      return (THREE as any).AgXToneMapping ?? THREE.ACESFilmicToneMapping;
    case 'none':
    default:         return THREE.NoToneMapping;
  }
}

/** Focal length (mm, 35mm 換算フルフレーム) → 垂直 FOV (度)
 *  V_FOV = 2 × arctan( sensorHeight / 2 / f )
 *  sensorHeight = 24mm (フルフレーム)
 *  - 15mm → 約 77.3° (超広角)
 *  - 35mm → 約 37.9° (標準やや広角)
 *  - 50mm → 約 27.0° (標準)
 *  - 100mm → 約 13.7° (望遠)
 */
export function focalLengthToFov(focalMm: number): number {
  const sensorHeight = 24;
  const rad = 2 * Math.atan(sensorHeight / (2 * Math.max(focalMm, 1)));
  return (rad * 180) / Math.PI;
}

/** Kelvin 色温度 → Linear sRGB の RGB (0..1)
 *  Tanner Helland 近似式。
 *  3000K = 暖オレンジ、6500K ≈ ニュートラル、10000K = 寒色青。
 */
function kelvinToRGB(K: number): { r: number; g: number; b: number } {
  const temp = K / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    b = 255;
  }

  return {
    r: Math.min(255, Math.max(0, r)) / 255,
    g: Math.min(255, Math.max(0, g)) / 255,
    b: Math.min(255, Math.max(0, b)) / 255,
  };
}

/** White balance (K) → 6500K を基準とした RGB tint multiplier。
 *  6500K のとき (1, 1, 1)。シーンを温める/冷ますために各ライト color に乗算する。
 *  正規化済み (最大成分を 1 に揃える) で過剰なエネルギー増加を抑える。 */
export function whiteBalanceTint(K: number): { r: number; g: number; b: number } {
  const c = kelvinToRGB(K);
  const ref = kelvinToRGB(6500);
  const tint = {
    r: c.r / Math.max(ref.r, 0.001),
    g: c.g / Math.max(ref.g, 0.001),
    b: c.b / Math.max(ref.b, 0.001),
  };
  // 最大成分で正規化 (overall brightness を保つ)
  const max = Math.max(tint.r, tint.g, tint.b, 0.001);
  return { r: tint.r / max, g: tint.g / max, b: tint.b / max };
}

/** Hex color × white balance tint → 適用後の THREE.Color */
export function applyWhiteBalanceToColor(hex: string, K: number): THREE.Color {
  const c = new THREE.Color(hex);
  if (K === 6500) return c;
  const t = whiteBalanceTint(K);
  c.r = Math.min(1, c.r * t.r);
  c.g = Math.min(1, c.g * t.g);
  c.b = Math.min(1, c.b * t.b);
  return c;
}

interface ViewportEnvStore {
  // ── Camera ─────────────────────────────────────────────
  exposure: number;        // 0.1 ~ 4.0 (toneMappingExposure)
  whiteBalance: number;    // K (2500 ~ 10000) — 各ライト color に温度カラー乗算
  focalLength: number;     // mm (15 ~ 135) — フルフレーム換算。FOV に変換して camera.fov に適用。

  // ── Render ─────────────────────────────────────────────
  toneMapping: ToneMappingMode;
  shadowQuality: ShadowQuality;

  // ── Actions ────────────────────────────────────────────
  setExposure: (v: number) => void;
  setWhiteBalance: (v: number) => void;
  setFocalLength: (v: number) => void;
  setToneMapping: (m: ToneMappingMode) => void;
  setShadowQuality: (q: ShadowQuality) => void;
  resetCamera: () => void;
  resetRender: () => void;
}

export const useViewportEnvStore = create<ViewportEnvStore>((set) => ({
  exposure: 1.0,
  whiteBalance: 6500,
  focalLength: 35,         // デフォルト 35mm (標準やや広角・室内インテリア定番)

  toneMapping: 'aces',     // デフォルトでフィルミックを ON (Lighting プレビュー寄り)
  shadowQuality: 'medium',

  setExposure: (exposure) => set({ exposure }),
  setWhiteBalance: (whiteBalance) => set({ whiteBalance }),
  setFocalLength: (focalLength) => set({ focalLength }),
  setToneMapping: (toneMapping) => set({ toneMapping }),
  setShadowQuality: (shadowQuality) => set({ shadowQuality }),
  resetCamera: () =>
    set({ exposure: 1.0, whiteBalance: 6500, focalLength: 35 }),
  resetRender: () =>
    set({ toneMapping: 'aces', shadowQuality: 'medium' }),
}));
