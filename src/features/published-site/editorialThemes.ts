// エディトリアル(誌面)テーマの人格レジストリ（デスクトップから移植）。
import type { SiteThemePersonality, MotionMode } from './siteTypes';

const MINCHO = `'Shippori Mincho', 'Yu Mincho', 'YuMincho', 'Hiragino Mincho ProN', 'Noto Serif JP', serif`;
const SANS = `'Inter', system-ui, -apple-system, 'Yu Gothic UI', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif`;
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
  displayFamily: string;
  headingFamily: string;
  bodyFamily: string;
  kickerFamily: string;
  headingWeight: number;
  headingLetterSpacing: string;
  kickerUppercase: boolean;
  airy: number;
  heroOverlay: boolean;
  motion: MotionMode;
}

export const EDITORIAL_THEMES: Record<SiteThemePersonality, EditorialTheme> = {
  journal: {
    personality: 'journal', label: 'Journal', benchmark: 'a+u（Architecture and Urbanism）',
    description: '報道的でクリーン。Vignelli 的グリッド規律と Bodoni＋明朝の誌面。',
    accent: '#b23a2b', bg: '#fbfaf8', surface: '#ffffff', text: '#16140f', subtext: '#6f6a60', border: 'rgba(0,0,0,0.12)',
    displayFamily: BODONI, headingFamily: BODONI, bodyFamily: MINCHO, kickerFamily: SANS,
    headingWeight: 600, headingLetterSpacing: '0', kickerUppercase: true, airy: 1.1, heroOverlay: true, motion: 'subtle',
  },
  atelier: {
    personality: 'atelier', label: 'Atelier', benchmark: 'Vincent Van Duysen',
    description: '静謐で抑制的。greige の配色と軽いサンス、たっぷりの余白。',
    accent: '#9a8c78', bg: '#e9e4db', surface: '#f1ede5', text: '#37322b', subtext: '#8a8175', border: 'rgba(55,50,43,0.14)',
    displayFamily: SANS, headingFamily: SANS, bodyFamily: MINCHO, kickerFamily: SANS,
    headingWeight: 400, headingLetterSpacing: '0.01em', kickerUppercase: true, airy: 1.5, heroOverlay: false, motion: 'subtle',
  },
  gallery: {
    personality: 'gallery', label: 'Gallery', benchmark: 'NOT A HOTEL',
    description: '大胆でシネマティック。フルブリード写真と没入スクロール。',
    accent: '#d8c7a8', bg: '#0b0b0c', surface: '#161618', text: '#f3efe8', subtext: 'rgba(243,239,232,0.62)', border: 'rgba(255,255,255,0.14)',
    displayFamily: SANS, headingFamily: SANS, bodyFamily: SANS, kickerFamily: SANS,
    headingWeight: 700, headingLetterSpacing: '-0.03em', kickerUppercase: true, airy: 1.25, heroOverlay: true, motion: 'cinematic',
  },
  salon: {
    personality: 'salon', label: 'Salon', benchmark: 'Architectural Digest',
    description: 'クラシックで高級。クリーム＋Bodoni セリフ＋ブロンズの誌面。',
    accent: '#9c6b3f', bg: '#f3ece1', surface: '#fbf7f0', text: '#2a2017', subtext: '#8a7c66', border: 'rgba(42,32,23,0.16)',
    displayFamily: BODONI, headingFamily: BODONI, bodyFamily: MINCHO, kickerFamily: SANS,
    headingWeight: 500, headingLetterSpacing: '0', kickerUppercase: true, airy: 1.3, heroOverlay: false, motion: 'subtle',
  },
  mono: {
    personality: 'mono', label: 'Mono', benchmark: 'Brutalist / Swiss editorial',
    description: '純白×黒のブルータリスト。強いグリッドと特大の見出し。',
    accent: '#ff3b00', bg: '#ffffff', surface: '#f3f3f3', text: '#0a0a0a', subtext: '#5a5a5a', border: 'rgba(0,0,0,0.85)',
    displayFamily: SANS, headingFamily: SANS, bodyFamily: SANS, kickerFamily: SANS,
    headingWeight: 800, headingLetterSpacing: '-0.04em', kickerUppercase: true, airy: 1.0, heroOverlay: false, motion: 'bold',
  },
  studio: {
    personality: 'studio', label: 'Studio', benchmark: 'Contemporary studio (BIG 等)',
    description: '現代的で大胆。特大グロテスクと鮮烈なアクセント。',
    accent: '#3a4cf0', bg: '#f5f4f1', surface: '#ffffff', text: '#141414', subtext: '#777270', border: 'rgba(0,0,0,0.12)',
    displayFamily: SANS, headingFamily: SANS, bodyFamily: SANS, kickerFamily: SANS,
    headingWeight: 800, headingLetterSpacing: '-0.035em', kickerUppercase: true, airy: 1.15, heroOverlay: true, motion: 'bold',
  },
};

export function resolveEditorialTheme(
  personality: SiteThemePersonality | undefined,
  accentOverride?: string,
): EditorialTheme {
  const base = EDITORIAL_THEMES[personality ?? 'journal'] ?? EDITORIAL_THEMES.journal;
  return accentOverride ? { ...base, accent: accentOverride } : base;
}
