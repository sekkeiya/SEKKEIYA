// エディトリアル(誌面)テーマの人格レジストリ。各人格を世界レベルのベンチマークへ対応付け。
//   Journal = a+u（Vignelli 的グリッド規律 / Bodoni + 明朝 / 赤アクセント / 報道密度）
//   Atelier = Vincent Van Duysen（極限の抑制 / greige / 軽量サンス / 特大余白）
//   Gallery = NOT A HOTEL（シネマティック / ダーク / フルブリード写真 / 上質サンス）

import type { SiteThemePersonality, SiteThemeOverrides, MotionMode } from '../projects/types';

const MINCHO = `'Shippori Mincho', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'Noto Serif JP', serif`;
const SANS = `'Inter', system-ui, -apple-system, 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif`;
// Latin は Bodoni、和文は明朝へフォールバック（a+u の Bodoni + Kozuka 明朝に倣う）
const BODONI = `'Bodoni Moda', 'Shippori Mincho', 'Hiragino Mincho ProN', serif`;

export interface EditorialTheme {
  personality: SiteThemePersonality;
  label: string;
  benchmark: string;
  description: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  subtext: string;
  border: string;
  /** ヒーロー等の特大見出し用 */
  displayFamily: string;
  /** セクション見出し用 */
  headingFamily: string;
  bodyFamily: string;
  kickerFamily: string;
  headingWeight: number;
  headingLetterSpacing: string;
  kickerUppercase: boolean;
  /** 余白の倍率（1=標準, 1.5=Van Duysen 級の特大余白） */
  airy: number;
  /** ヒーローを画像の上に重ねる（フルブリード） */
  heroOverlay: boolean;
  /** この人格の既定スクロールモーション（motionOverride 未指定時に使用）。 */
  motion: MotionMode;
}

export const EDITORIAL_THEMES: Record<SiteThemePersonality, EditorialTheme> = {
  // a+u: 白基調・厳格グリッド・Bodoni 見出し＋明朝本文・赤アクセント
  journal: {
    personality: 'journal',
    label: 'Journal',
    benchmark: 'a+u（Architecture and Urbanism）',
    description: '報道的でクリーン。Vignelli 的グリッド規律と Bodoni＋明朝の誌面。',
    accent: '#b23a2b',
    bg: '#fbfaf8',
    surface: '#ffffff',
    text: '#16140f',
    subtext: '#6f6a60',
    border: 'rgba(0,0,0,0.12)',
    displayFamily: BODONI,
    headingFamily: BODONI,
    bodyFamily: MINCHO,
    kickerFamily: SANS,
    headingWeight: 600,
    headingLetterSpacing: '0',
    kickerUppercase: true,
    airy: 1.1,
    heroOverlay: true,
    motion: 'subtle',
  },
  // Vincent Van Duysen: greige・軽量サンス・特大余白・極限の抑制
  atelier: {
    personality: 'atelier',
    label: 'Atelier',
    benchmark: 'Vincent Van Duysen',
    description: '静謐で抑制的。greige の配色と軽いサンス、たっぷりの余白。',
    accent: '#9a8c78',
    bg: '#e9e4db',
    surface: '#f1ede5',
    text: '#37322b',
    subtext: '#8a8175',
    border: 'rgba(55,50,43,0.14)',
    displayFamily: SANS,
    headingFamily: SANS,
    bodyFamily: MINCHO,
    kickerFamily: SANS,
    headingWeight: 400,
    headingLetterSpacing: '0.01em',
    kickerUppercase: true,
    airy: 1.5,
    heroOverlay: false,
    motion: 'subtle',
  },
  // NOT A HOTEL: ダーク・シネマティック・フルブリード写真・上質サンス
  gallery: {
    personality: 'gallery',
    label: 'Gallery',
    benchmark: 'NOT A HOTEL',
    description: '大胆でシネマティック。フルブリード写真と没入スクロール。',
    accent: '#d8c7a8',
    bg: '#0b0b0c',
    surface: '#161618',
    text: '#f3efe8',
    subtext: 'rgba(243,239,232,0.62)',
    border: 'rgba(255,255,255,0.14)',
    displayFamily: SANS,
    headingFamily: SANS,
    bodyFamily: SANS,
    kickerFamily: SANS,
    headingWeight: 700,
    headingLetterSpacing: '-0.03em',
    kickerUppercase: true,
    airy: 1.25,
    heroOverlay: true,
    motion: 'cinematic',
  },
  // Architectural Digest: クリーム基調・Bodoni セリフ・ブロンズ・クラシックな高級感
  salon: {
    personality: 'salon',
    label: 'Salon',
    benchmark: 'Architectural Digest',
    description: 'クラシックで高級。クリーム＋Bodoni セリフ＋ブロンズの誌面。',
    accent: '#9c6b3f',
    bg: '#f3ece1',
    surface: '#fbf7f0',
    text: '#2a2017',
    subtext: '#8a7c66',
    border: 'rgba(42,32,23,0.16)',
    displayFamily: BODONI,
    headingFamily: BODONI,
    bodyFamily: MINCHO,
    kickerFamily: SANS,
    headingWeight: 500,
    headingLetterSpacing: '0',
    kickerUppercase: true,
    airy: 1.3,
    heroOverlay: false,
    motion: 'subtle',
  },
  // ブルータリスト・エディトリアル: 純白×黒・強いグリッド線・特大グロテスク・高コントラスト
  mono: {
    personality: 'mono',
    label: 'Mono',
    benchmark: 'Brutalist / Swiss editorial',
    description: '純白×黒のブルータリスト。強いグリッドと特大の見出し。',
    accent: '#ff3b00',
    bg: '#ffffff',
    surface: '#f3f3f3',
    text: '#0a0a0a',
    subtext: '#5a5a5a',
    border: 'rgba(0,0,0,0.85)',
    displayFamily: SANS,
    headingFamily: SANS,
    bodyFamily: SANS,
    kickerFamily: SANS,
    headingWeight: 800,
    headingLetterSpacing: '-0.04em',
    kickerUppercase: true,
    airy: 1.0,
    heroOverlay: false,
    motion: 'bold',
  },
  // 現代的スタジオ: オフホワイト・特大グロテスク・鮮烈アクセント・モダン
  studio: {
    personality: 'studio',
    label: 'Studio',
    benchmark: 'Contemporary studio (BIG 等)',
    description: '現代的で大胆。特大グロテスクと鮮烈なアクセント。',
    accent: '#3a4cf0',
    bg: '#f5f4f1',
    surface: '#ffffff',
    text: '#141414',
    subtext: '#777270',
    border: 'rgba(0,0,0,0.12)',
    displayFamily: SANS,
    headingFamily: SANS,
    bodyFamily: SANS,
    kickerFamily: SANS,
    headingWeight: 800,
    headingLetterSpacing: '-0.035em',
    kickerUppercase: true,
    airy: 1.15,
    heroOverlay: true,
    motion: 'bold',
  },
};

export function resolveEditorialTheme(
  personality: SiteThemePersonality | undefined,
  accentOverride?: string,
  overrides?: SiteThemeOverrides,
): EditorialTheme {
  const base = EDITORIAL_THEMES[personality ?? 'journal'] ?? EDITORIAL_THEMES.journal;
  const withAccent = accentOverride ? { ...base, accent: accentOverride } : base;
  return overrides ? { ...withAccent, ...overrides } : withAccent;
}

export const PERSONALITY_LIST: SiteThemePersonality[] = ['journal', 'atelier', 'gallery', 'salon', 'mono', 'studio'];

// 厳選スタイル（パネルで提示する3種）。他の人格も内部的には有効（既存サイトは引き続き解決される）。
export const CURATED_PERSONALITIES: SiteThemePersonality[] = ['journal', 'atelier', 'gallery'];

/** モーション・オーバーライドメニューの選択肢（null = 人格の既定に従う）。 */
export const MOTION_OPTIONS: { value: MotionMode | null; label: string; description: string }[] = [
  { value: null,           label: '自動（人格に従う）', description: 'スタイルごとの既定モーション' },
  { value: 'subtle',       label: '控えめ',             description: '静かなフェード＋慣性スクロール（建築相応）' },
  { value: 'bold',         label: '大胆',               description: '大きめの立ち上がり' },
  { value: 'cinematic',    label: 'シネマティック',     description: 'ヒーロー強パララックス＋画像リビール' },
  { value: 'experimental', label: '変わり種',           description: '攻めた演出（実験的）' },
  { value: 'still',        label: '静止',               description: 'アニメーションなし' },
];
