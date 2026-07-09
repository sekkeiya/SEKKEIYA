// ──────────────────────────────────────────────────────────────────────────────
// 内装材メーカーのプリセットと、商品比較の軸・スコアリング補助。
// 1 マテリアルに複数メーカーの商品をぶら下げ、価格・耐久・防火の 3 軸で比較する。
// ──────────────────────────────────────────────────────────────────────────────

import type { DsmtProduct } from '../types';

export interface ManufacturerPreset {
  name: string;
  note: string;
  /** URL 取り込み時のメーカー自動判定に使うドメインキーワード。 */
  domains: string[];
}

export interface ManufacturerGroup {
  group: string;
  items: ManufacturerPreset[];
}

/** カテゴリ別メーカープリセット。 */
export const MANUFACTURER_GROUPS: ManufacturerGroup[] = [
  {
    group: '壁紙・クロス系',
    items: [
      { name: 'サンゲツ', note: '国内最大手の内装材メーカー。壁紙・床材・ファブリックを幅広く。', domains: ['sangetsu'] },
      { name: 'リリカラ', note: '壁紙・床材・カーテンの総合インテリア。デザイン性に定評。', domains: ['lilycolor'] },
      { name: 'シンコール', note: '壁紙・床材中心。コストパフォーマンスが強み。', domains: ['sincol'] },
      { name: '東リ', note: '床材（タイルカーペット・Pタイル）と壁紙で国内トップクラス。', domains: ['toli'] },
    ],
  },
  {
    group: '床材系',
    items: [
      { name: '大建工業（DAIKEN）', note: 'フローリング・建材全般。木質系床材で国内首位級。', domains: ['daiken'] },
      { name: '朝日ウッドテック', note: '高品質な無垢・複合フローリングの専業メーカー。', domains: ['woodtec'] },
      { name: '永大産業（EIDAI）', note: 'フローリング・建材。ハウスメーカー採用実績が豊富。', domains: ['eidai'] },
    ],
  },
  {
    group: 'タイル・石材系',
    items: [
      { name: 'LIXIL（リクシル）', note: 'タイル・衛生陶器・建材を網羅する国内最大の住宅設備。', domains: ['lixil', 'inax'] },
      { name: '名古屋モザイク工業', note: '輸入タイル中心の高級タイル専門商社。設計業界で知名度大。', domains: ['nagoya-mosaic', 'nagoyamosaic'] },
    ],
  },
];

/** プリセットのフラットな一覧（セレクト用）。 */
export const MANUFACTURER_PRESETS: ManufacturerPreset[] = MANUFACTURER_GROUPS.flatMap((g) => g.items);

/** URL（ドメイン）からメーカー名を推定する。判定不能なら空文字。 */
export function detectManufacturerFromUrl(url: string): string {
  const lower = (url || '').toLowerCase();
  for (const m of MANUFACTURER_PRESETS) {
    if (m.domains.some((d) => lower.includes(d))) return m.name;
  }
  return '';
}

// ── 防火等級 → スコア（防火・安全性能の根拠から 0–100 を当てる）──
export const FIRE_RATINGS: { value: string; score: number }[] = [
  { value: '不燃', score: 100 },
  { value: '準不燃', score: 80 },
  { value: '難燃', score: 60 },
  { value: '防炎', score: 50 },
  { value: '規定なし', score: 20 },
];

export function fireScoreFromRating(rating?: string): number | undefined {
  if (!rating) return undefined;
  return FIRE_RATINGS.find((r) => r.value === rating)?.score;
}

// ── 比較軸 ──
export type CompareAxisKey = 'price' | 'durability' | 'fireSafety';

export interface CompareAxis {
  key: CompareAxisKey;
  label: string;
  /** 値が大きいほど良いか。価格は「安いほど良い」ので false。 */
  higherIsBetter: boolean;
  color: string;
}

export const COMPARE_AXES: CompareAxis[] = [
  { key: 'price',      label: '価格',          higherIsBetter: false, color: '#ffb74d' },
  { key: 'durability', label: '耐久性・メンテ', higherIsBetter: true,  color: '#4dd0e1' },
  { key: 'fireSafety', label: '防火・安全',     higherIsBetter: true,  color: '#ff8a80' },
];

/** 商品から軸の生値を取り出す（未設定は undefined）。 */
export function rawAxisValue(p: DsmtProduct, key: CompareAxisKey): number | undefined {
  if (key === 'price') return typeof p.price === 'number' ? p.price : undefined;
  if (key === 'durability') return typeof p.durability === 'number' ? p.durability : undefined;
  if (key === 'fireSafety') return typeof p.fireSafety === 'number' ? p.fireSafety : undefined;
  return undefined;
}

/**
 * 軸ごとに商品群を 0–100 のスコアへ正規化する（レーダー用に「良い＝外側」へ揃える）。
 * - durability / fireSafety: そのまま（0–100 前提、範囲外はクランプ）。
 * - price: 集合内の最安=100・最高=0 で相対化（1 件のみ or 同値は 50 基準で 100）。
 * 値が無い商品はその軸 0 として扱う。
 */
export function normalizedScore(
  products: DsmtProduct[],
  product: DsmtProduct,
  axis: CompareAxis,
): number {
  const raw = rawAxisValue(product, axis.key);
  if (raw == null) return 0;
  if (axis.key !== 'price') return Math.max(0, Math.min(100, raw));

  // 価格: 集合内で相対化（安い=高スコア）。
  const prices = products.map((p) => rawAxisValue(p, 'price')).filter((v): v is number => v != null);
  if (prices.length === 0) return 0;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return 100; // 全部同価格 or 1 件 → 満点扱い
  return Math.round(((max - raw) / (max - min)) * 100);
}

/** 3 軸スコアの単純平均（総合バランス）。 */
export function overallScore(products: DsmtProduct[], product: DsmtProduct): number {
  const vals = COMPARE_AXES.map((a) => normalizedScore(products, product, a));
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

/** 商品識別用の安定色（系列色）。 */
export const SERIES_COLORS = [
  '#ec407a', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc',
  '#26c6da', '#ef5350', '#8d6e63', '#9ccc65', '#5c6bc0',
];
