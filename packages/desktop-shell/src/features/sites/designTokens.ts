// エディトリアル品質のデザイントークン（spacing / type / measure / grid）。
// 基準: a+u(Vignelli 的グリッド規律) / Vincent Van Duysen(特大余白) / NOT A HOTEL(シネマ).
// 数値は「世界レベルの誌面」に寄せた大きめの余白・明確な階層。

// セクション縦パディング（MUI spacing 単位＝8px）。theme.airy で倍率調整。
export const SECTION_PY = { xs: 8, md: 16 };
export const HERO_PY = { xs: 10, md: 20 };

// ヒーロー高さ（フルブリード）
export const HERO_MINH = { xs: '80vh', md: '92vh' };

// 本文の最大行長（measure）。読みやすさの要。
export const MEASURE = {
  text: 640,    // 本文
  wide: 1180,   // 画像グリッド
  hero: 1240,
};

// 横パディング
export const PAGE_PX = { xs: 3, md: 8, lg: 12 };

// タイプスケール（レスポンシブ）
export const TYPE = {
  displayXL: { xs: '2.9rem', md: '5.2rem' },  // ヒーロー大見出し
  display:   { xs: '2.2rem', md: '3.4rem' },  // ヒーロー/ステートメント
  h2:        { xs: '1.45rem', md: '2.1rem' }, // セクション見出し
  bodyLg:    '1.18rem',
  body:      '1.0rem',
  caption:   '0.76rem',
  kicker:    '0.68rem',
};

// 行間・字間
export const LEADING = { display: 1.05, heading: 1.14, body: 1.95 };
export const TRACK = { kickerWide: '0.22em', kickerNarrow: '0.06em' };

// 画像の標準比率
export const RATIO = { hero: '16/9', feature: '16/9', wide: '21/9', portrait: '3/4', card: '4/3', film: '3/2' };

/* ==========================================================
 * モーション（スクロール演出）トークン — デザインの第 4 軸
 * 土台: Lenis 慣性スクロール / GSAP ScrollTrigger パララックス / Framer リビール
 * 各モードのパラメータをここに集約し、人格・オーバーライドから解決する。
 * =========================================================*/

import type { MotionMode } from '../projects/types';

type CubicBezier = [number, number, number, number];

/** モーションモードごとの素のパラメータ。 */
export interface MotionFields {
  smooth: boolean;       // Lenis 慣性スクロールを使うか
  reveal: number;        // リビールの移動量(px)。0 でリビールなし
  durMs: number;         // リビールの所要時間(ms)
  ease: CubicBezier;     // Framer 用イージング
  parallax: number;      // ヒーロー画像パララックス強度 0..0.25
  clip: boolean;         // 画像を clip-path で「開く」リビール
  extra: boolean;        // experimental の追加表現（わずかな scale 立ち上がり 等）
}

export const MOTION: Record<MotionMode, MotionFields> = {
  still:        { smooth: false, reveal: 0,  durMs: 0,    ease: [0, 0, 1, 1],        parallax: 0,    clip: false, extra: false },
  subtle:       { smooth: true,  reveal: 22, durMs: 760,  ease: [0.22, 1, 0.36, 1],  parallax: 0.06, clip: false, extra: false },
  bold:         { smooth: true,  reveal: 46, durMs: 880,  ease: [0.16, 1, 0.30, 1],  parallax: 0.12, clip: false, extra: false },
  cinematic:    { smooth: true,  reveal: 60, durMs: 1050, ease: [0.16, 1, 0.30, 1],  parallax: 0.18, clip: true,  extra: false },
  experimental: { smooth: true,  reveal: 78, durMs: 980,  ease: [0.65, 0, 0.35, 1],  parallax: 0.22, clip: true,  extra: true  },
};

/** コンポーネントへ渡す解決済みモーション設定。enabled=false のとき完全に静的。 */
export interface MotionConfig {
  mode: MotionMode;
  enabled: boolean;
  smooth: boolean;
  reveal: number;
  durMs: number;
  ease: CubicBezier;
  parallax: number;
  clip: boolean;
  extra: boolean;
}

/**
 * 人格の既定モーション＋オーバーライド＋実行コンテキスト（編集/プレビュー・reduced-motion）
 * から、最終的な MotionConfig を解決する。
 */
export function resolveMotionConfig(
  baseMode: MotionMode,
  override: MotionMode | undefined,
  opts: { preview: boolean; reduced: boolean },
): MotionConfig {
  const mode = override ?? baseMode;
  const f = MOTION[mode];
  // 演出は「プレビュー/公開」かつ reduced-motion でなく、かつ still 以外のときだけ有効。
  const enabled = opts.preview && !opts.reduced && mode !== 'still';
  return {
    mode,
    enabled,
    smooth: enabled && f.smooth,
    reveal: enabled ? f.reveal : 0,
    durMs: enabled ? f.durMs : 0,
    ease: f.ease,
    parallax: enabled ? f.parallax : 0,
    clip: enabled && f.clip,
    extra: enabled && f.extra,
  };
}
