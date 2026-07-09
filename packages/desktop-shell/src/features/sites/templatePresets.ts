// テンプレートプリセットカタログ。
// 各プリセットは「人格 (personality) + アクセントカラー + モーション + テーマ上書き値」の組み合わせ。
// 100+ のキュレーション済みプリセットを 5 カテゴリに分類。

import type { SiteThemePersonality, SiteThemeOverrides, MotionMode } from '../projects/types';

// ---------- フォントスタック定義 ----------
const BODONI = `'Bodoni Moda', 'Shippori Mincho', serif`;
const MINCHO = `'Shippori Mincho', 'Noto Serif JP', serif`;
const SANS   = `'Inter', system-ui, 'Noto Sans JP', sans-serif`;
const PLAYFAIR  = `'Playfair Display', 'Noto Serif JP', serif`;
const GARAMOND  = `'EB Garamond', 'Noto Serif JP', serif`;
const CORMORANT = `'Cormorant Garamond', 'Shippori Mincho', serif`;

export type TemplateCategory =
  | 'editorial'     // 雑誌・出版スタイル
  | 'minimal'       // 超ミニマル
  | 'dark'          // ダーク系
  | 'contemporary'  // 現代建築スタジオ
  | 'accent';       // ラグジュアリー / 自然 / インダストリアル

export interface TemplatePreset {
  id: string;
  name: string;
  nameJa?: string;
  category: TemplateCategory;
  tags: string[];
  personality: SiteThemePersonality;
  motion: MotionMode;
  accent: string;
  overrides?: SiteThemeOverrides;
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [

  // ================================================================
  // EDITORIAL — 雑誌・建築出版物スタイル
  // ================================================================

  {
    id: 'editorial-au',
    name: 'Journal Classic', nameJa: 'ジャーナル クラシック',
    category: 'editorial', tags: ['serif', 'light', 'publication'],
    personality: 'journal', motion: 'subtle', accent: '#b23a2b',
  },
  {
    id: 'editorial-au-indigo',
    name: 'Journal Indigo', nameJa: 'ジャーナル インジゴ',
    category: 'editorial', tags: ['serif', 'light', 'publication'],
    personality: 'journal', motion: 'subtle', accent: '#1a2a6c',
  },
  {
    id: 'editorial-au-midnight',
    name: 'Journal Midnight', nameJa: 'ジャーナル ミッドナイト',
    category: 'editorial', tags: ['serif', 'dark', 'publication'],
    personality: 'journal', motion: 'cinematic', accent: '#e8c97a',
    overrides: { bg: '#0f0e0a', surface: '#1a1916', text: '#f0ede6', subtext: 'rgba(240,237,230,0.55)', border: 'rgba(255,255,255,0.1)' },
  },
  {
    id: 'editorial-vignelli',
    name: 'Vignelli Grid', nameJa: 'ヴィニェリ グリッド',
    category: 'editorial', tags: ['sans', 'light', 'grid', 'bold'],
    personality: 'mono', motion: 'bold', accent: '#001F5B',
    overrides: { displayFamily: SANS, headingFamily: SANS, headingWeight: 900, headingLetterSpacing: '-0.04em', bg: '#ffffff', text: '#000000' },
  },
  {
    id: 'editorial-swiss',
    name: 'Swiss International', nameJa: 'スイス インターナショナル',
    category: 'editorial', tags: ['sans', 'light', 'grid', 'helvetica'],
    personality: 'mono', motion: 'bold', accent: '#e8271a',
    overrides: { headingWeight: 700, headingLetterSpacing: '0.01em', bg: '#fafafa', airy: 1.05 },
  },
  {
    id: 'editorial-garamond',
    name: 'Garamond Cream', nameJa: 'ガラモン クリーム',
    category: 'editorial', tags: ['serif', 'light', 'classic', 'warm'],
    personality: 'salon', motion: 'subtle', accent: '#6b3520',
    overrides: { displayFamily: GARAMOND, headingFamily: GARAMOND, bodyFamily: GARAMOND, headingWeight: 400, bg: '#f4ede0', surface: '#faf5ec', airy: 1.4 },
  },
  {
    id: 'editorial-cormorant',
    name: 'Cormorant Luxe', nameJa: 'コーモラン ラグジュアリー',
    category: 'editorial', tags: ['serif', 'light', 'elegant'],
    personality: 'salon', motion: 'subtle', accent: '#8b4513',
    overrides: { displayFamily: CORMORANT, headingFamily: CORMORANT, headingWeight: 500, headingLetterSpacing: '0.02em', bg: '#fdf8f0', airy: 1.35 },
  },
  {
    id: 'editorial-dezeen-dark',
    name: 'Dezeen Dark', nameJa: 'ディーザイン ダーク',
    category: 'editorial', tags: ['sans', 'dark', 'news'],
    personality: 'gallery', motion: 'bold', accent: '#b8ff00',
    overrides: { bg: '#1a1a1a', surface: '#242424', text: '#f0f0f0', subtext: 'rgba(240,240,240,0.55)', border: 'rgba(255,255,255,0.1)', headingWeight: 800, headingLetterSpacing: '-0.03em' },
  },
  {
    id: 'editorial-wallpaper',
    name: 'Wallpaper* Grey', nameJa: 'ウォールペーパー グレー',
    category: 'editorial', tags: ['sans', 'neutral', 'magazine'],
    personality: 'atelier', motion: 'subtle', accent: '#00838f',
    overrides: { bg: '#e8e8e8', surface: '#f0f0f0', text: '#1a1a1a', subtext: '#666', border: 'rgba(0,0,0,0.15)', headingWeight: 600 },
  },
  {
    id: 'editorial-monocle',
    name: 'Monocle Style', nameJa: 'モノクル スタイル',
    category: 'editorial', tags: ['mixed', 'light', 'magazine', 'warm'],
    personality: 'journal', motion: 'subtle', accent: '#c0392b',
    overrides: { bodyFamily: MINCHO, bg: '#f8f4ee', airy: 1.2 },
  },
  {
    id: 'editorial-playfair',
    name: 'Playfair Editorial', nameJa: 'プレイフェア エディトリアル',
    category: 'editorial', tags: ['serif', 'light', 'elegant'],
    personality: 'salon', motion: 'subtle', accent: '#c0392b',
    overrides: { displayFamily: PLAYFAIR, headingFamily: PLAYFAIR, headingWeight: 700, bg: '#fdfaf4', surface: '#ffffff' },
  },
  {
    id: 'editorial-frame',
    name: 'Frame Mag', nameJa: 'フレーム マガジン',
    category: 'editorial', tags: ['sans', 'light', 'design'],
    personality: 'studio', motion: 'bold', accent: '#0057ff',
    overrides: { headingWeight: 800, headingLetterSpacing: '-0.04em', bg: '#ffffff', airy: 1.1 },
  },
  {
    id: 'editorial-domus',
    name: 'Domus Warm', nameJa: 'ドムス ウォーム',
    category: 'editorial', tags: ['serif', 'light', 'classic', 'italian'],
    personality: 'journal', motion: 'subtle', accent: '#8c7a6b',
    overrides: { displayFamily: BODONI, headingWeight: 500, bg: '#faf6f1', surface: '#ffffff', airy: 1.25 },
  },
  {
    id: 'editorial-metropolis',
    name: 'Metropolis', nameJa: 'メトロポリス',
    category: 'editorial', tags: ['sans', 'neutral', 'modern'],
    personality: 'studio', motion: 'bold', accent: '#4d6fff',
    overrides: { bg: '#c8c8c8', surface: '#d5d5d5', text: '#111', subtext: '#555', border: 'rgba(0,0,0,0.2)', headingWeight: 700, headingLetterSpacing: '-0.02em' },
  },
  {
    id: 'editorial-pinup',
    name: 'PIN-UP Blush', nameJa: 'ピンナップ ブラッシュ',
    category: 'editorial', tags: ['serif', 'light', 'magazine', 'feminine'],
    personality: 'salon', motion: 'subtle', accent: '#b87093',
    overrides: { bg: '#f9eff0', surface: '#fdf5f6', text: '#2c1a1e', subtext: '#9a7080', border: 'rgba(44,26,30,0.12)', displayFamily: PLAYFAIR, headingWeight: 600 },
  },
  {
    id: 'editorial-brutus',
    name: 'Brutus Olive', nameJa: 'ブルータス オリーブ',
    category: 'editorial', tags: ['sans', 'light', 'magazine', 'eclectic'],
    personality: 'journal', motion: 'subtle', accent: '#5c6b2e',
    overrides: { displayFamily: SANS, headingFamily: SANS, headingWeight: 900, headingLetterSpacing: '-0.03em' },
  },
  {
    id: 'editorial-apartamento',
    name: 'Apartamento', nameJa: 'アパルタメント',
    category: 'editorial', tags: ['serif', 'warm', 'cozy'],
    personality: 'salon', motion: 'subtle', accent: '#7a5c3c',
    overrides: { displayFamily: GARAMOND, headingFamily: GARAMOND, headingWeight: 400, bg: '#f0e8d8', surface: '#f8f2e8', airy: 1.3 },
  },
  {
    id: 'editorial-lecorb',
    name: 'Le Corbusier', nameJa: 'ル コルビュジエ',
    category: 'editorial', tags: ['sans', 'light', 'modernist'],
    personality: 'mono', motion: 'bold', accent: '#d4a017',
    overrides: { bg: '#f5f1e8', surface: '#fffdf7', text: '#0a0a0a', headingWeight: 800 },
  },
  {
    id: 'editorial-bijutsu',
    name: 'Bijutsu Techo', nameJa: '美術手帖',
    category: 'editorial', tags: ['mixed', 'light', 'japanese', 'art'],
    personality: 'journal', motion: 'subtle', accent: '#2e5e9c',
    overrides: { bodyFamily: MINCHO, bg: '#fdf9f3', airy: 1.15 },
  },
  {
    id: 'editorial-nikkei',
    name: 'Nikkei Clear', nameJa: '日経クリア',
    category: 'editorial', tags: ['sans', 'light', 'news', 'japanese'],
    personality: 'studio', motion: 'subtle', accent: '#0a2e6b',
    overrides: { headingWeight: 600, headingLetterSpacing: '0', bg: '#ffffff', airy: 1.0 },
  },

  // ================================================================
  // MINIMAL — 超ミニマル・呼吸する余白
  // ================================================================

  {
    id: 'minimal-tokyo',
    name: 'Tokyo Minimal', nameJa: '東京 ミニマル',
    category: 'minimal', tags: ['sans', 'light', 'ultra-minimal'],
    personality: 'atelier', motion: 'subtle', accent: '#888080',
    overrides: { headingWeight: 300, headingLetterSpacing: '0.08em', bg: '#fefefe', surface: '#f8f8f8', airy: 1.6 },
  },
  {
    id: 'minimal-muji',
    name: 'MUJI', nameJa: '無印',
    category: 'minimal', tags: ['sans', 'warm', 'natural'],
    personality: 'atelier', motion: 'subtle', accent: '#7c6f62',
    overrides: { headingWeight: 400, bg: '#f7f3ed', surface: '#faf8f4', text: '#2d2822', airy: 1.5 },
  },
  {
    id: 'minimal-nordic',
    name: 'Nordic White', nameJa: 'ノルディック ホワイト',
    category: 'minimal', tags: ['sans', 'cool', 'scandinavian'],
    personality: 'atelier', motion: 'subtle', accent: '#2962ab',
    overrides: { headingWeight: 300, headingLetterSpacing: '0.04em', bg: '#f0f2f5', surface: '#f9fafb', text: '#1c2533', airy: 1.55 },
  },
  {
    id: 'minimal-naoshima',
    name: 'Naoshima', nameJa: '直島',
    category: 'minimal', tags: ['sans', 'warm', 'island', 'art'],
    personality: 'atelier', motion: 'subtle', accent: '#9c7b5a',
    overrides: { headingWeight: 400, bg: '#f2ede5', surface: '#f8f5f0', border: 'rgba(55,50,43,0.1)', airy: 1.45 },
  },
  {
    id: 'minimal-kyoto',
    name: 'Kyoto Stone', nameJa: '京都 石畳',
    category: 'minimal', tags: ['mixed', 'warm', 'japanese', 'stone'],
    personality: 'atelier', motion: 'subtle', accent: '#8a7b6a',
    overrides: { bodyFamily: MINCHO, bg: '#e8e0d0', surface: '#f0e8d8', text: '#2a2016', airy: 1.5 },
  },
  {
    id: 'minimal-fog',
    name: 'Fog', nameJa: '霧',
    category: 'minimal', tags: ['sans', 'cool', 'atmospheric'],
    personality: 'atelier', motion: 'subtle', accent: '#5078a8',
    overrides: { headingWeight: 300, bg: '#e8ecf0', surface: '#f2f5f8', text: '#2a3040', airy: 1.6 },
  },
  {
    id: 'minimal-shibui',
    name: 'Shibui', nameJa: '渋い',
    category: 'minimal', tags: ['sans', 'muted', 'japanese'],
    personality: 'atelier', motion: 'still', accent: '#6e6358',
    overrides: { headingWeight: 400, bg: '#e6e1d8', surface: '#eee9e0', text: '#302c26', border: 'rgba(48,44,38,0.08)', airy: 1.7 },
  },
  {
    id: 'minimal-ma',
    name: '間 (Ma)', nameJa: '間',
    category: 'minimal', tags: ['sans', 'extreme', 'japanese', 'space'],
    personality: 'atelier', motion: 'still', accent: '#1a1a1a',
    overrides: { headingWeight: 200, headingLetterSpacing: '0.12em', bg: '#ffffff', surface: '#fafafa', airy: 2.0, border: 'rgba(0,0,0,0.05)' },
  },
  {
    id: 'minimal-copenhagen',
    name: 'Copenhagen', nameJa: 'コペンハーゲン',
    category: 'minimal', tags: ['sans', 'cool', 'clean'],
    personality: 'atelier', motion: 'subtle', accent: '#0f3460',
    overrides: { headingWeight: 400, bg: '#f5f7fa', surface: '#ffffff', text: '#141f30', airy: 1.45 },
  },
  {
    id: 'minimal-zurich',
    name: 'Zurich Gold', nameJa: 'チューリッヒ ゴールド',
    category: 'minimal', tags: ['sans', 'light', 'swiss', 'grid'],
    personality: 'mono', motion: 'subtle', accent: '#c8a84b',
    overrides: { headingWeight: 600, bg: '#ffffff', border: 'rgba(0,0,0,0.6)', airy: 1.1 },
  },
  {
    id: 'minimal-oslo',
    name: 'Oslo Cabin', nameJa: 'オスロ キャビン',
    category: 'minimal', tags: ['sans', 'warm', 'nordic', 'wood'],
    personality: 'atelier', motion: 'subtle', accent: '#3d5e2e',
    overrides: { headingWeight: 400, bg: '#f5f0e8', surface: '#faf7f2', text: '#2a2218', airy: 1.4 },
  },
  {
    id: 'minimal-reykjavik',
    name: 'Reykjavik Ice', nameJa: 'レイキャビク アイス',
    category: 'minimal', tags: ['sans', 'cool', 'nordic', 'ice'],
    personality: 'atelier', motion: 'subtle', accent: '#4a90d9',
    overrides: { headingWeight: 300, bg: '#edf2f7', surface: '#f5f8fc', text: '#1e2a38', airy: 1.55 },
  },
  {
    id: 'minimal-amsterdam',
    name: 'Amsterdam Canal', nameJa: 'アムステルダム',
    category: 'minimal', tags: ['serif', 'cool', 'canal', 'heritage'],
    personality: 'journal', motion: 'subtle', accent: '#9c6030',
    overrides: { bg: '#f8f4ed', surface: '#fefbf6', text: '#1a1008', displayFamily: BODONI, headingWeight: 500, airy: 1.3 },
  },
  {
    id: 'minimal-kamakura',
    name: 'Kamakura', nameJa: '鎌倉',
    category: 'minimal', tags: ['serif', 'warm', 'japanese', 'historic'],
    personality: 'salon', motion: 'subtle', accent: '#7a4e7a',
    overrides: { bodyFamily: MINCHO, bg: '#f2ecd8', surface: '#f8f4e8', text: '#2a1e10', airy: 1.45 },
  },
  {
    id: 'minimal-paper',
    name: 'Washi Paper', nameJa: '和紙',
    category: 'minimal', tags: ['serif', 'warm', 'japanese', 'paper'],
    personality: 'journal', motion: 'subtle', accent: '#8b6914',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, bodyFamily: MINCHO, headingWeight: 400, bg: '#f0e8d0', surface: '#f8f2e0', text: '#1c140a' },
  },
  {
    id: 'minimal-glass',
    name: 'Glass', nameJa: 'ガラス',
    category: 'minimal', tags: ['sans', 'cool', 'translucent'],
    personality: 'atelier', motion: 'subtle', accent: '#64a0d0',
    overrides: { headingWeight: 300, headingLetterSpacing: '0.06em', bg: '#f0f6fc', surface: '#f8fbff', text: '#1a2840', border: 'rgba(100,160,208,0.2)', airy: 1.5 },
  },
  {
    id: 'minimal-hakone',
    name: 'Hakone Mist', nameJa: '箱根 霞',
    category: 'minimal', tags: ['mixed', 'warm', 'japanese', 'mountain'],
    personality: 'atelier', motion: 'subtle', accent: '#5b8c68',
    overrides: { bodyFamily: MINCHO, bg: '#ece8df', surface: '#f4f0e7', text: '#2a2820', airy: 1.5 },
  },
  {
    id: 'minimal-ise',
    name: 'Ise Shrine', nameJa: '伊勢神宮',
    category: 'minimal', tags: ['serif', 'extreme', 'japanese', 'sacred'],
    personality: 'atelier', motion: 'still', accent: '#d4a060',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, headingWeight: 400, headingLetterSpacing: '0.1em', bg: '#faf8f2', airy: 1.8, border: 'rgba(0,0,0,0.06)' },
  },
  {
    id: 'minimal-sand',
    name: 'Sand Dune', nameJa: 'サンドデューン',
    category: 'minimal', tags: ['sans', 'warm', 'desert'],
    personality: 'atelier', motion: 'subtle', accent: '#c0914a',
    overrides: { headingWeight: 300, bg: '#f5eedc', surface: '#faf5ea', text: '#2c2010', airy: 1.5 },
  },
  {
    id: 'minimal-chalk',
    name: 'Chalk White', nameJa: 'チョーク ホワイト',
    category: 'minimal', tags: ['sans', 'light', 'clean', 'pure'],
    personality: 'mono', motion: 'subtle', accent: '#555',
    overrides: { headingWeight: 400, headingLetterSpacing: '0.05em', bg: '#f8f8f5', surface: '#ffffff', border: 'rgba(0,0,0,0.08)' },
  },

  // ================================================================
  // DARK — ダーク系
  // ================================================================

  {
    id: 'dark-midnight',
    name: 'Midnight Gallery', nameJa: 'ミッドナイト ギャラリー',
    category: 'dark', tags: ['sans', 'dark', 'gold', 'cinematic'],
    personality: 'gallery', motion: 'cinematic', accent: '#d4af37',
    overrides: { bg: '#0d0d14', surface: '#13131e', text: '#f0ede0', subtext: 'rgba(240,237,224,0.55)', border: 'rgba(212,175,55,0.2)' },
  },
  {
    id: 'dark-obsidian',
    name: 'Obsidian', nameJa: 'オブシディアン',
    category: 'dark', tags: ['sans', 'dark', 'silver', 'sleek'],
    personality: 'gallery', motion: 'cinematic', accent: '#c0c8d4',
    overrides: { bg: '#080808', surface: '#101010', text: '#e8e8e8', headingWeight: 700, headingLetterSpacing: '-0.03em' },
  },
  {
    id: 'dark-cinema',
    name: 'Cinema Noir', nameJa: 'シネマ ノワール',
    category: 'dark', tags: ['sans', 'dark', 'red', 'dramatic'],
    personality: 'gallery', motion: 'cinematic', accent: '#e53030',
    overrides: { bg: '#0a0a0a', surface: '#141414', text: '#f5f5f5', headingWeight: 800, headingLetterSpacing: '-0.04em' },
  },
  {
    id: 'dark-forest',
    name: 'Dark Forest', nameJa: 'ダーク フォレスト',
    category: 'dark', tags: ['sans', 'dark', 'green', 'nature'],
    personality: 'gallery', motion: 'bold', accent: '#4a9e6a',
    overrides: { bg: '#0a1010', surface: '#121a18', text: '#d8ede0', subtext: 'rgba(216,237,224,0.55)', border: 'rgba(74,158,106,0.2)' },
  },
  {
    id: 'dark-charcoal',
    name: 'Charcoal Studio', nameJa: 'チャコール スタジオ',
    category: 'dark', tags: ['sans', 'dark', 'warm', 'studio'],
    personality: 'gallery', motion: 'bold', accent: '#e8d5b0',
    overrides: { bg: '#1c1a18', surface: '#242220', text: '#ede8e0', subtext: 'rgba(237,232,224,0.55)' },
  },
  {
    id: 'dark-volcanic',
    name: 'Volcanic', nameJa: '火山岩',
    category: 'dark', tags: ['sans', 'dark', 'orange', 'dramatic'],
    personality: 'gallery', motion: 'bold', accent: '#e85c20',
    overrides: { bg: '#110c08', surface: '#1a1410', text: '#f0e4d8', subtext: 'rgba(240,228,216,0.55)', border: 'rgba(232,92,32,0.2)' },
  },
  {
    id: 'dark-ocean',
    name: 'Deep Ocean', nameJa: 'ディープ オーシャン',
    category: 'dark', tags: ['sans', 'dark', 'blue', 'deep'],
    personality: 'gallery', motion: 'cinematic', accent: '#60a8e8',
    overrides: { bg: '#060e1a', surface: '#0d1826', text: '#c8ddf0', subtext: 'rgba(200,221,240,0.55)', border: 'rgba(96,168,232,0.15)' },
  },
  {
    id: 'dark-eclipse',
    name: 'Eclipse', nameJa: 'エクリプス',
    category: 'dark', tags: ['serif', 'dark', 'amber', 'luxe'],
    personality: 'gallery', motion: 'cinematic', accent: '#e8a840',
    overrides: { bg: '#0d0c0a', surface: '#161512', text: '#f0e8d8', subtext: 'rgba(240,232,216,0.55)', displayFamily: BODONI },
  },
  {
    id: 'dark-nocturn',
    name: 'Nocturn', nameJa: 'ノクターン',
    category: 'dark', tags: ['serif', 'dark', 'navy', 'brass'],
    personality: 'gallery', motion: 'cinematic', accent: '#c8a46a',
    overrides: { bg: '#080c14', surface: '#101520', text: '#e8dfc8', subtext: 'rgba(232,223,200,0.55)', displayFamily: BODONI },
  },
  {
    id: 'dark-carbon',
    name: 'Carbon', nameJa: 'カーボン',
    category: 'dark', tags: ['sans', 'dark', 'yellow', 'industrial'],
    personality: 'studio', motion: 'bold', accent: '#f0d000',
    overrides: { bg: '#141414', surface: '#1e1e1e', text: '#f5f5f5', headingWeight: 900, headingLetterSpacing: '-0.04em' },
  },
  {
    id: 'dark-pitch',
    name: 'Pitch Black', nameJa: 'ピッチ ブラック',
    category: 'dark', tags: ['sans', 'dark', 'extreme', 'graphic'],
    personality: 'mono', motion: 'bold', accent: '#ff2020',
    overrides: { bg: '#000000', surface: '#0a0a0a', text: '#ffffff', border: 'rgba(255,255,255,0.85)', headingWeight: 900 },
  },
  {
    id: 'dark-cobalt',
    name: 'Cobalt Night', nameJa: 'コバルト ナイト',
    category: 'dark', tags: ['sans', 'dark', 'blue', 'electric'],
    personality: 'gallery', motion: 'cinematic', accent: '#00d4ff',
    overrides: { bg: '#040820', surface: '#081030', text: '#c8e4f8', headingWeight: 700, headingLetterSpacing: '-0.03em' },
  },
  {
    id: 'dark-moss',
    name: 'Dark Moss', nameJa: 'ダーク モス',
    category: 'dark', tags: ['serif', 'dark', 'olive', 'natural'],
    personality: 'gallery', motion: 'bold', accent: '#c8b86a',
    overrides: { bg: '#0c1008', surface: '#141810', text: '#dce8c8', displayFamily: GARAMOND, headingWeight: 500 },
  },
  {
    id: 'dark-indigo',
    name: 'Deep Indigo', nameJa: '深藍',
    category: 'dark', tags: ['serif', 'dark', 'indigo', 'japanese'],
    personality: 'gallery', motion: 'cinematic', accent: '#e8d8b8',
    overrides: { bg: '#0a0c18', surface: '#12162a', text: '#e0d8c8', displayFamily: MINCHO, headingWeight: 400, headingLetterSpacing: '0.02em' },
  },
  {
    id: 'dark-lacquer',
    name: 'Lacquerware', nameJa: '漆器',
    category: 'dark', tags: ['serif', 'dark', 'red', 'japanese', 'luxe'],
    personality: 'gallery', motion: 'cinematic', accent: '#c82020',
    overrides: { bg: '#0a0000', surface: '#140808', text: '#f0e0d8', displayFamily: MINCHO, headingWeight: 400 },
  },
  {
    id: 'dark-velvet',
    name: 'Dark Velvet', nameJa: 'ダーク ベルベット',
    category: 'dark', tags: ['serif', 'dark', 'purple', 'luxe'],
    personality: 'gallery', motion: 'cinematic', accent: '#d4a8c8',
    overrides: { bg: '#0c0810', surface: '#140c1a', text: '#e8d8f0', displayFamily: CORMORANT, headingWeight: 500 },
  },
  {
    id: 'dark-onyx',
    name: 'Onyx & Gold', nameJa: 'オニキス ＆ ゴールド',
    category: 'dark', tags: ['serif', 'dark', 'gold', 'luxe'],
    personality: 'gallery', motion: 'cinematic', accent: '#c8a84a',
    overrides: { bg: '#090909', surface: '#111111', text: '#ede8d8', displayFamily: BODONI, headingWeight: 600 },
  },
  {
    id: 'dark-smoke',
    name: 'Smoke', nameJa: 'スモーク',
    category: 'dark', tags: ['sans', 'dark', 'neutral', 'film'],
    personality: 'gallery', motion: 'bold', accent: '#a0a0a0',
    overrides: { bg: '#181818', surface: '#202020', text: '#e0e0e0', headingWeight: 400, headingLetterSpacing: '0.04em' },
  },
  {
    id: 'dark-noir-serif',
    name: 'Noir Serif', nameJa: 'ノワール セリフ',
    category: 'dark', tags: ['serif', 'dark', 'classic'],
    personality: 'gallery', motion: 'cinematic', accent: '#e0cca0',
    overrides: { bg: '#0f0e0a', surface: '#1a1914', text: '#ede8d8', displayFamily: BODONI, headingWeight: 600 },
  },
  {
    id: 'dark-studio',
    name: 'Studio Night', nameJa: 'スタジオ ナイト',
    category: 'dark', tags: ['sans', 'dark', 'blue', 'studio'],
    personality: 'studio', motion: 'bold', accent: '#7090ff',
    overrides: { bg: '#0a0c14', surface: '#12141e', text: '#d8dff0', headingWeight: 800, headingLetterSpacing: '-0.04em' },
  },

  // ================================================================
  // CONTEMPORARY — 現代建築スタジオ
  // ================================================================

  {
    id: 'contemporary-big',
    name: 'BIG Copenhagen', nameJa: 'BIG コペンハーゲン',
    category: 'contemporary', tags: ['sans', 'light', 'bold', 'playful'],
    personality: 'studio', motion: 'bold', accent: '#0055ff',
    overrides: { headingWeight: 900, headingLetterSpacing: '-0.05em', bg: '#ffffff', airy: 1.1 },
  },
  {
    id: 'contemporary-sanaa',
    name: 'SANAA Ghost', nameJa: 'SANAA ゴースト',
    category: 'contemporary', tags: ['sans', 'extreme', 'japan', 'delicate'],
    personality: 'atelier', motion: 'subtle', accent: '#aaaaaa',
    overrides: { headingWeight: 200, headingLetterSpacing: '0.12em', bg: '#ffffff', surface: '#fafafa', text: '#1a1a1a', border: 'rgba(0,0,0,0.04)', airy: 1.8 },
  },
  {
    id: 'contemporary-zaha',
    name: 'Zaha Fluid', nameJa: 'ザハ フルイド',
    category: 'contemporary', tags: ['sans', 'light', 'dynamic', 'fluid'],
    personality: 'studio', motion: 'experimental', accent: '#7b2fff',
    overrides: { headingWeight: 800, headingLetterSpacing: '-0.04em', bg: '#f8f8ff', airy: 1.2 },
  },
  {
    id: 'contemporary-kuma',
    name: 'Kengo Kuma', nameJa: '隈研吾',
    category: 'contemporary', tags: ['mixed', 'warm', 'wood', 'organic'],
    personality: 'atelier', motion: 'subtle', accent: '#8c6840',
    overrides: { bodyFamily: MINCHO, bg: '#f5f0e8', surface: '#faf7f2', text: '#2a2010', airy: 1.45 },
  },
  {
    id: 'contemporary-ando',
    name: 'Ando Concrete', nameJa: '安藤忠雄 コンクリート',
    category: 'contemporary', tags: ['sans', 'neutral', 'material', 'brutalist'],
    personality: 'atelier', motion: 'subtle', accent: '#ffffff',
    overrides: { headingWeight: 400, headingLetterSpacing: '0.02em', bg: '#c8c4bc', surface: '#d4d0c8', text: '#0a0a0a', subtext: '#444', border: 'rgba(0,0,0,0.2)', airy: 1.4 },
  },
  {
    id: 'contemporary-oma',
    name: 'OMA Grid', nameJa: 'OMA グリッド',
    category: 'contemporary', tags: ['sans', 'light', 'analytic', 'grid'],
    personality: 'mono', motion: 'bold', accent: '#e81c0c',
    overrides: { headingWeight: 700, headingLetterSpacing: '0', bg: '#f5f5f5', surface: '#ffffff', border: 'rgba(0,0,0,0.75)', airy: 1.05 },
  },
  {
    id: 'contemporary-hmm',
    name: 'Herzog Material', nameJa: 'ヘルツォーク マテリアル',
    category: 'contemporary', tags: ['sans', 'neutral', 'material', 'swiss'],
    personality: 'atelier', motion: 'subtle', accent: '#888888',
    overrides: { headingWeight: 400, headingLetterSpacing: '0.02em', bg: '#e4e0dc', surface: '#eceae6', text: '#1a1816', airy: 1.4 },
  },
  {
    id: 'contemporary-piano',
    name: 'Renzo Piano Light', nameJa: 'レンゾ・ピアノ 光',
    category: 'contemporary', tags: ['sans', 'light', 'bright', 'warm'],
    personality: 'studio', motion: 'subtle', accent: '#e8a030',
    overrides: { headingWeight: 500, bg: '#fafaf7', surface: '#ffffff', text: '#1a1610', airy: 1.25 },
  },
  {
    id: 'contemporary-foster',
    name: 'Foster Glass', nameJa: 'フォスター ガラス',
    category: 'contemporary', tags: ['sans', 'cool', 'hi-tech', 'steel'],
    personality: 'studio', motion: 'bold', accent: '#4080c0',
    overrides: { headingWeight: 700, headingLetterSpacing: '-0.02em', bg: '#f2f6fa', surface: '#fafcff', text: '#141c28' },
  },
  {
    id: 'contemporary-mvrdv',
    name: 'MVRDV Red', nameJa: 'MVRDV レッド',
    category: 'contemporary', tags: ['sans', 'light', 'bold', 'dutch'],
    personality: 'mono', motion: 'bold', accent: '#e81c0c',
    overrides: { headingWeight: 900, headingLetterSpacing: '-0.05em', bg: '#ffffff', border: 'rgba(232,28,12,0.3)', airy: 1.0 },
  },
  {
    id: 'contemporary-siza',
    name: 'Siza White', nameJa: 'シザ ホワイト',
    category: 'contemporary', tags: ['sans', 'warm', 'mediterranean', 'shadow'],
    personality: 'atelier', motion: 'subtle', accent: '#d4a870',
    overrides: { headingWeight: 400, bg: '#faf7f2', surface: '#ffffff', text: '#1e1a14', airy: 1.5 },
  },
  {
    id: 'contemporary-nishizawa',
    name: 'Nishizawa Ghost', nameJa: '西沢 ゴースト',
    category: 'contemporary', tags: ['sans', 'extreme', 'minimal', 'japan'],
    personality: 'atelier', motion: 'still', accent: '#cccccc',
    overrides: { headingWeight: 200, headingLetterSpacing: '0.15em', bg: '#ffffff', surface: '#fefefe', text: '#888', border: 'rgba(0,0,0,0.03)', airy: 2.0 },
  },
  {
    id: 'contemporary-adjaye',
    name: 'Adjaye Geometric', nameJa: 'アジェイ ジオメトリック',
    category: 'contemporary', tags: ['serif', 'warm', 'africa', 'geometric'],
    personality: 'salon', motion: 'bold', accent: '#c06820',
    overrides: { displayFamily: BODONI, headingWeight: 600, bg: '#f5ece0', surface: '#faf5ec', text: '#1e1008' },
  },
  {
    id: 'contemporary-shban',
    name: 'Shigeru Ban Natural', nameJa: '坂茂 ナチュラル',
    category: 'contemporary', tags: ['mixed', 'warm', 'wood', 'natural'],
    personality: 'atelier', motion: 'subtle', accent: '#a08060',
    overrides: { bodyFamily: MINCHO, bg: '#f0ebe0', surface: '#f8f4ec', text: '#281e10', border: 'rgba(40,30,16,0.1)', airy: 1.4 },
  },
  {
    id: 'contemporary-hadid-dark',
    name: 'Hadid Space', nameJa: 'ハディッド スペース',
    category: 'contemporary', tags: ['sans', 'dark', 'fluid', 'futurist'],
    personality: 'studio', motion: 'experimental', accent: '#9060ff',
    overrides: { bg: '#08080f', surface: '#10101c', text: '#d8d0f0', headingWeight: 800, headingLetterSpacing: '-0.03em' },
  },
  {
    id: 'contemporary-selgas',
    name: 'Selgas Garden', nameJa: 'セルガス ガーデン',
    category: 'contemporary', tags: ['sans', 'light', 'nature', 'translucent'],
    personality: 'atelier', motion: 'subtle', accent: '#4a9448',
    overrides: { headingWeight: 300, bg: '#f2f8f0', surface: '#f9fcf8', text: '#1a2818', border: 'rgba(74,148,72,0.15)', airy: 1.5 },
  },
  {
    id: 'contemporary-souto',
    name: 'Souto Granite', nameJa: 'ソウト 花崗岩',
    category: 'contemporary', tags: ['sans', 'cool', 'stone', 'portuguese'],
    personality: 'atelier', motion: 'subtle', accent: '#c0b090',
    overrides: { headingWeight: 400, bg: '#e8e4dc', surface: '#f0ece4', text: '#1c1a14', airy: 1.4 },
  },
  {
    id: 'contemporary-mecanoo',
    name: 'Mecanoo Civic', nameJa: 'メカノー シビック',
    category: 'contemporary', tags: ['sans', 'warm', 'civic', 'dutch'],
    personality: 'studio', motion: 'bold', accent: '#e07830',
    overrides: { headingWeight: 700, headingLetterSpacing: '-0.02em', bg: '#f5f0e8', surface: '#faf7f2', text: '#201808' },
  },
  {
    id: 'contemporary-bv',
    name: 'Van Berkel Logic', nameJa: 'ファン・ベルケル ロジック',
    category: 'contemporary', tags: ['sans', 'light', 'parametric', 'dutch'],
    personality: 'studio', motion: 'bold', accent: '#0088cc',
    overrides: { headingWeight: 800, headingLetterSpacing: '-0.04em', bg: '#f8f8fa', airy: 1.1 },
  },
  {
    id: 'contemporary-kengo-dark',
    name: 'Kuma Dark', nameJa: '隈 ダーク',
    category: 'contemporary', tags: ['mixed', 'dark', 'wood', 'japanese'],
    personality: 'gallery', motion: 'cinematic', accent: '#c89060',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, headingWeight: 400, bg: '#100c08', surface: '#1a1610', text: '#e8d8c0' },
  },

  // ================================================================
  // ACCENT — ラグジュアリー / 自然 / インダストリアル / 和
  // ================================================================

  {
    id: 'luxury-champagne',
    name: 'Champagne', nameJa: 'シャンパン',
    category: 'accent', tags: ['serif', 'warm', 'luxury', 'gold'],
    personality: 'salon', motion: 'subtle', accent: '#c8a840',
    overrides: { displayFamily: BODONI, headingWeight: 500, bg: '#f8f0d8', surface: '#fdf8ec', text: '#1a1208', airy: 1.4 },
  },
  {
    id: 'luxury-noir',
    name: 'Noir Luxe', nameJa: 'ノワール ラグジュアリー',
    category: 'accent', tags: ['serif', 'dark', 'luxury', 'rose-gold'],
    personality: 'gallery', motion: 'cinematic', accent: '#d4a0a8',
    overrides: { displayFamily: BODONI, headingWeight: 600, bg: '#0a0808', surface: '#141010', text: '#f0e8e4' },
  },
  {
    id: 'luxury-ivory',
    name: 'Ivory Tower', nameJa: 'アイボリー タワー',
    category: 'accent', tags: ['serif', 'warm', 'luxury', 'classic'],
    personality: 'salon', motion: 'subtle', accent: '#a07840',
    overrides: { displayFamily: CORMORANT, headingFamily: CORMORANT, headingWeight: 400, bg: '#f5f0e5', surface: '#fdfaf2', text: '#1c1408', airy: 1.5 },
  },
  {
    id: 'luxury-cognac',
    name: 'Cognac', nameJa: 'コニャック',
    category: 'accent', tags: ['serif', 'warm', 'luxury', 'amber'],
    personality: 'salon', motion: 'subtle', accent: '#c8602a',
    overrides: { displayFamily: GARAMOND, headingWeight: 500, bg: '#f0e0c8', surface: '#f8ecd8', text: '#1c0c04', airy: 1.4 },
  },
  {
    id: 'luxury-matte-black',
    name: 'Matte Black', nameJa: 'マット ブラック',
    category: 'accent', tags: ['serif', 'dark', 'luxury', 'minimal'],
    personality: 'gallery', motion: 'bold', accent: '#d8d0c0',
    overrides: { displayFamily: GARAMOND, headingWeight: 400, headingLetterSpacing: '0.04em', bg: '#0e0e0e', surface: '#161616', text: '#e4ddd0' },
  },
  {
    id: 'nature-wabisabi',
    name: 'Wabi-Sabi', nameJa: '侘び寂び',
    category: 'accent', tags: ['mixed', 'warm', 'japanese', 'organic'],
    personality: 'atelier', motion: 'subtle', accent: '#8c6848',
    overrides: { bodyFamily: MINCHO, bg: '#ede4d0', surface: '#f4ece0', text: '#281e10', border: 'rgba(40,30,16,0.1)', airy: 1.6 },
  },
  {
    id: 'nature-forest-floor',
    name: 'Forest Floor', nameJa: 'フォレスト フロア',
    category: 'accent', tags: ['sans', 'dark', 'green', 'organic'],
    personality: 'gallery', motion: 'bold', accent: '#6a8e58',
    overrides: { bg: '#0c1808', surface: '#141f10', text: '#d0e4c0', border: 'rgba(106,142,88,0.2)' },
  },
  {
    id: 'nature-cedar',
    name: 'Cedar & Stone', nameJa: '杉 ＆ 石',
    category: 'accent', tags: ['mixed', 'warm', 'wood', 'natural'],
    personality: 'atelier', motion: 'subtle', accent: '#9a6840',
    overrides: { bg: '#e8e0d0', surface: '#f0e8d8', text: '#281a08', border: 'rgba(40,26,8,0.12)', airy: 1.4 },
  },
  {
    id: 'nature-desert',
    name: 'Desert Adobe', nameJa: 'デザート アドービ',
    category: 'accent', tags: ['sans', 'warm', 'desert', 'southwest'],
    personality: 'atelier', motion: 'subtle', accent: '#3a8ec8',
    overrides: { headingWeight: 400, bg: '#f0e0c0', surface: '#f8eccf', text: '#2a1a08', airy: 1.45 },
  },
  {
    id: 'nature-bamboo',
    name: 'Bamboo', nameJa: '竹',
    category: 'accent', tags: ['mixed', 'light', 'japanese', 'green'],
    personality: 'atelier', motion: 'subtle', accent: '#5a8850',
    overrides: { bodyFamily: MINCHO, bg: '#edf4e8', surface: '#f5faf2', text: '#1a2814', border: 'rgba(26,40,20,0.1)', airy: 1.5 },
  },
  {
    id: 'nature-volcanic-ash',
    name: 'Volcanic Ash', nameJa: '火山灰',
    category: 'accent', tags: ['sans', 'cool', 'stone', 'ash'],
    personality: 'atelier', motion: 'subtle', accent: '#e05820',
    overrides: { headingWeight: 400, bg: '#d8d4cc', surface: '#e4e0d8', text: '#1a1814', border: 'rgba(26,24,20,0.15)' },
  },
  {
    id: 'industrial-brutal',
    name: 'Brutalist', nameJa: 'ブルータリスト',
    category: 'accent', tags: ['sans', 'light', 'brutal', 'grid'],
    personality: 'mono', motion: 'bold', accent: '#8b1a0a',
    overrides: { headingWeight: 900, headingLetterSpacing: '-0.04em', bg: '#ffffff', text: '#000000', border: 'rgba(0,0,0,0.85)', airy: 1.0 },
  },
  {
    id: 'industrial-concrete',
    name: 'Raw Concrete', nameJa: 'コンクリート',
    category: 'accent', tags: ['sans', 'neutral', 'concrete', 'raw'],
    personality: 'atelier', motion: 'subtle', accent: '#e0e0e0',
    overrides: { headingWeight: 500, bg: '#c0bcb4', surface: '#ccc8c0', text: '#f8f8f8', subtext: 'rgba(248,248,248,0.6)', border: 'rgba(255,255,255,0.2)' },
  },
  {
    id: 'industrial-blueprint',
    name: 'Blueprint', nameJa: 'ブループリント',
    category: 'accent', tags: ['sans', 'dark', 'blue', 'technical'],
    personality: 'studio', motion: 'bold', accent: '#c8e4ff',
    overrides: { headingWeight: 600, headingLetterSpacing: '0.02em', bg: '#0c1a30', surface: '#122040', text: '#c0d8f0', subtext: 'rgba(192,216,240,0.55)', border: 'rgba(200,228,255,0.2)' },
  },
  {
    id: 'industrial-forge',
    name: 'The Forge', nameJa: 'ザ フォージ',
    category: 'accent', tags: ['sans', 'dark', 'iron', 'fire'],
    personality: 'studio', motion: 'bold', accent: '#ff6820',
    overrides: { headingWeight: 800, headingLetterSpacing: '-0.03em', bg: '#0c0a08', surface: '#181410', text: '#f0e0d0', border: 'rgba(255,104,32,0.15)' },
  },
  {
    id: 'japanese-edo',
    name: 'Edo Indigo', nameJa: '江戸 藍',
    category: 'accent', tags: ['serif', 'dark', 'japanese', 'indigo'],
    personality: 'gallery', motion: 'subtle', accent: '#e8d8b0',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, bodyFamily: MINCHO, headingWeight: 400, headingLetterSpacing: '0.04em', bg: '#12182a', surface: '#1a2038', text: '#e0d4b8' },
  },
  {
    id: 'japanese-sumi',
    name: 'Sumi-e', nameJa: '墨絵',
    category: 'accent', tags: ['serif', 'light', 'japanese', 'ink'],
    personality: 'journal', motion: 'still', accent: '#1a1a1a',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, bodyFamily: MINCHO, headingWeight: 400, headingLetterSpacing: '0.05em', bg: '#faf8f4', surface: '#ffffff', text: '#0a0a0a', border: 'rgba(0,0,0,0.08)', airy: 1.6 },
  },
  {
    id: 'japanese-bizen',
    name: 'Bizen Ceramic', nameJa: '備前焼',
    category: 'accent', tags: ['serif', 'warm', 'japanese', 'earthen'],
    personality: 'salon', motion: 'subtle', accent: '#8a5030',
    overrides: { bodyFamily: MINCHO, bg: '#e8d8c0', surface: '#f0e4d0', text: '#2a1808', border: 'rgba(42,24,8,0.15)', airy: 1.4 },
  },
  {
    id: 'japanese-katsura',
    name: 'Katsura Palace', nameJa: '桂離宮',
    category: 'accent', tags: ['serif', 'cool', 'japanese', 'imperial'],
    personality: 'journal', motion: 'subtle', accent: '#6040a0',
    overrides: { displayFamily: MINCHO, headingFamily: MINCHO, headingWeight: 400, headingLetterSpacing: '0.06em', bg: '#ecece8', surface: '#f4f4f0', text: '#1a1820', airy: 1.5 },
  },
  {
    id: 'japanese-temple',
    name: 'Temple Stone', nameJa: '寺石',
    category: 'accent', tags: ['mixed', 'cool', 'japanese', 'stone', 'moss'],
    personality: 'atelier', motion: 'subtle', accent: '#5a8858',
    overrides: { bodyFamily: MINCHO, bg: '#e0e8e0', surface: '#eaefe8', text: '#1a2018', border: 'rgba(26,32,24,0.1)', airy: 1.5 },
  },
];

/** カテゴリの表示ラベル。 */
export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  editorial:    '編集・出版',
  minimal:      'ミニマル',
  dark:         'ダーク',
  contemporary: 'コンテンポラリー',
  accent:       'アクセント',
};

/** カテゴリの絵文字アイコン。 */
export const CATEGORY_ICON: Record<TemplateCategory, string> = {
  editorial:    '📰',
  minimal:      '◻️',
  dark:         '🌑',
  contemporary: '🏛️',
  accent:       '🎨',
};

/** プリセット ID からプリセットを検索する。 */
export function findPreset(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find(p => p.id === id);
}

/** プリセットを `EditorialTheme` 互換の上書き値に変換する。 */
export function presetToThemeOverrides(preset: TemplatePreset): import('../projects/types').SiteThemeOverrides | undefined {
  return preset.overrides;
}
