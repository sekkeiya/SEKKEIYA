import type { DsmtCategory, DsmtPbrParams } from '../types';

/**
 * S.Material のデフォルト素材（建築・インテリアの定番）。
 * テクスチャ画像なしの procedural PBR パラメータのみ＝オフラインでも動き、
 * three.js / Rhino / Blender いずれにも同じ値で適用できる「共通コア」。
 * 後からテクスチャ(maps)やネイティブ包装(packages)を足して拡充できる。
 */
export interface DefaultMaterialDef {
  slug: string;
  title: string;
  category: DsmtCategory;
  params: DsmtPbrParams;
  tags: string[];
}

export const DEFAULT_MATERIALS: DefaultMaterialDef[] = [
  { slug: 'fabric-light-gray', title: 'ファブリック・ライトグレー', category: 'fabric', params: { baseColor: '#c8c5be', roughness: 0.92, metalness: 0, opacity: 1 }, tags: ['張地', 'ソファ', 'グレー'] },
  { slug: 'fabric-charcoal',   title: 'ファブリック・チャコール',   category: 'fabric', params: { baseColor: '#3a3d42', roughness: 0.88, metalness: 0, opacity: 1 }, tags: ['張地', 'ソファ', 'ダーク'] },
  { slug: 'fabric-beige',      title: 'ファブリック・ベージュ',     category: 'fabric', params: { baseColor: '#d8cbb3', roughness: 0.9,  metalness: 0, opacity: 1 }, tags: ['張地', 'ナチュラル'] },
  { slug: 'wood-oak',          title: 'オーク無垢',                 category: 'wood',   params: { baseColor: '#b9895a', roughness: 0.55, metalness: 0, opacity: 1 }, tags: ['木', '無垢', 'ナチュラル'] },
  { slug: 'wood-walnut',       title: 'ウォールナット',             category: 'wood',   params: { baseColor: '#5a3d2b', roughness: 0.5,  metalness: 0, opacity: 1 }, tags: ['木', 'ダークウッド'] },
  { slug: 'metal-black-steel', title: 'ブラックスチール',           category: 'metal',  params: { baseColor: '#2b2d31', roughness: 0.4,  metalness: 1, opacity: 1 }, tags: ['金属', '脚', '黒'] },
  { slug: 'metal-brass',       title: 'ヘアライン真鍮',             category: 'metal',  params: { baseColor: '#b8924a', roughness: 0.35, metalness: 1, opacity: 1 }, tags: ['金属', '真鍮', 'ゴールド'] },
  { slug: 'metal-aluminum',    title: 'アルミ・サテン',             category: 'metal',  params: { baseColor: '#c4c6c9', roughness: 0.3,  metalness: 1, opacity: 1 }, tags: ['金属', 'アルミ', 'シルバー'] },
  { slug: 'paint-white',       title: 'ホワイト塗装（マット）',     category: 'paint',  params: { baseColor: '#f2f1ed', roughness: 0.6,  metalness: 0, opacity: 1 }, tags: ['塗装', '白', 'マット'] },
  { slug: 'stone-concrete',    title: 'コンクリート打放し',         category: 'stone',  params: { baseColor: '#9a9893', roughness: 0.85, metalness: 0, opacity: 1 }, tags: ['コンクリート', '無機質'] },
  { slug: 'leather-black',     title: 'ブラックレザー',             category: 'leather', params: { baseColor: '#1f1d1b', roughness: 0.55, metalness: 0, opacity: 1 }, tags: ['革', 'チェア', '黒'] },
  { slug: 'glass-clear',       title: 'クリアガラス',               category: 'glass',  params: { baseColor: '#cfe6ea', roughness: 0.05, metalness: 0, opacity: 0.35 }, tags: ['ガラス', '透明'] },
];
