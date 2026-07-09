// サイト全体のレイアウト・プリセット（約100種 / 14カテゴリ）。
// 構造プリミティブ（既存 SiteLayoutMode の8種）に、ヘッダー様式・サイドバー位置・
// 最大幅・整列の修飾を掛けて、ジェネレータで大量のプリセットを生成する。
// レンダラ（ProjectSiteCanvas）は resolveLayout() の結果を実際に反映する。

import type { SiteLayoutMode } from '../projects/types';

export type LayoutHeader = 'none' | 'bar' | 'float' | 'center' | 'split';
export type LayoutSidebar = 'none' | 'left' | 'right' | 'both';
export type LayoutAlign = 'left' | 'center';

export type LayoutCategory =
  | 'editorial' | 'sidebar-left' | 'sidebar-right' | 'sidebar-both'
  | 'header-bar' | 'header-center' | 'header-split' | 'floating'
  | 'minimal' | 'immersive' | 'portfolio'
  | 'magazine' | 'grid' | 'studio' | 'experimental';

export interface LayoutPreset {
  id: string;
  name: string;
  nameJa: string;
  category: LayoutCategory;
  mode: SiteLayoutMode;          // ベース構造（SVG/フォールバック用）
  header: LayoutHeader;
  sidebar: LayoutSidebar;
  maxWidth: number | null;       // null=フル幅
  align: LayoutAlign;
}

export const LAYOUT_CATEGORY_LABEL: Record<LayoutCategory, string> = {
  'editorial': 'エディトリアル',
  'sidebar-left': '左サイドバー',
  'sidebar-right': '右サイドバー',
  'sidebar-both': '両サイドバー',
  'header-bar': 'トップバー',
  'header-center': '中央ロゴ',
  'header-split': '分割ナビ',
  'floating': 'フローティング',
  'minimal': 'ミニマル',
  'immersive': '没入',
  'portfolio': 'ポートフォリオ',
  'magazine': 'マガジン',
  'grid': 'グリッド',
  'studio': 'スタジオ',
  'experimental': '実験的',
};
export const LAYOUT_CATEGORY_ORDER: LayoutCategory[] = [
  'editorial', 'sidebar-left', 'sidebar-right', 'sidebar-both',
  'header-bar', 'header-center', 'header-split', 'floating',
  'minimal', 'immersive', 'portfolio',
  'magazine', 'grid', 'studio', 'experimental',
];

/** 解決済みレイアウト構成（ProjectSiteCanvas が使用）。 */
export interface ResolvedLayout { sidebar: LayoutSidebar; header: LayoutHeader; maxWidth: number | null; align: LayoutAlign; mode: SiteLayoutMode; }
export function resolveLayout(p: LayoutPreset): ResolvedLayout {
  return { sidebar: p.sidebar, header: p.header, maxWidth: p.maxWidth, align: p.align, mode: p.mode };
}

// ── ジェネレータで約100プリセットを 14 カテゴリに分けて構築 ──
function build(): LayoutPreset[] {
  const out: LayoutPreset[] = [];
  const wL = (w: number | null) => w === null ? '全幅' : w <= 700 ? '極狭' : w <= 800 ? '狭' : w <= 1000 ? '中' : '広';
  const aL = (a: LayoutAlign) => a === 'center' ? '中央' : '左';
  const hL: Record<LayoutHeader, string> = { none: 'ヘッダーなし', bar: 'バー', float: 'フローティング', center: '中央ロゴ', split: '分割ナビ' };
  const push = (
    category: LayoutCategory, mode: SiteLayoutMode, header: LayoutHeader, sidebar: LayoutSidebar,
    maxWidth: number | null, align: LayoutAlign, nameJa: string,
  ) => {
    out.push({
      id: `ly-${out.length + 1}`,
      name: `${category} ${mode} ${header}/${sidebar} ${maxWidth ?? 'full'} ${align}`,
      nameJa, category, mode, header, sidebar, maxWidth, align,
    });
  };

  // 1. editorial（誌面・左ToC）
  for (const mw of [960, 1200, null] as (number | null)[])
    for (const align of ['left', 'center'] as LayoutAlign[])
      push('editorial', 'editorial', 'none', 'left', mw, align, `誌面・${wL(mw)}・${aL(align)}`);

  // 2. sidebar-left（左ナビ＋本文）
  for (const header of ['none', 'bar'] as LayoutHeader[])
    for (const mw of [1000, 1200, null] as (number | null)[])
      push('sidebar-left', 'split', header, 'left', mw, 'left', `左ナビ・${hL[header]}・${wL(mw)}`);

  // 3. sidebar-right（右ナビ）
  for (const mode of ['split', 'editorial'] as SiteLayoutMode[])
    for (const mw of [1000, 1200, null] as (number | null)[])
      push('sidebar-right', mode, 'none', 'right', mw, 'left', `右ナビ・${mode}・${wL(mw)}`);

  // 3b. sidebar-both（左ページナビ＋右セクションTOC）
  for (const header of ['none', 'bar'] as LayoutHeader[])
    for (const mw of [1200, null] as (number | null)[])
      push('sidebar-both', 'split', header, 'both', mw, 'left', `両サイドバー・${hL[header]}・${wL(mw)}`);

  // 4. header-bar（上部固定バー）
  for (const mode of ['magazine', 'studio'] as SiteLayoutMode[])
    for (const mw of [1200, null] as (number | null)[])
      for (const align of ['left', 'center'] as LayoutAlign[])
        push('header-bar', mode, 'bar', 'none', mw, align, `バー・${mode}・${wL(mw)}・${aL(align)}`);

  // 5. header-center（中央ロゴ）
  for (const mode of ['magazine', 'studio', 'grid'] as SiteLayoutMode[])
    for (const mw of [1200, null] as (number | null)[])
      push('header-center', mode, 'center', 'none', mw, 'center', `中央ロゴ・${mode}・${wL(mw)}`);

  // 6. header-split（分割ナビ：ロゴ左・ナビ右）
  for (const mode of ['magazine', 'studio', 'grid'] as SiteLayoutMode[])
    for (const mw of [1200, null] as (number | null)[])
      push('header-split', mode, 'split', 'none', mw, 'left', `分割ナビ・${mode}・${wL(mw)}`);

  // 7. floating（フローティングナビ）
  for (const mode of ['portfolio', 'immersive', 'magazine'] as SiteLayoutMode[])
    for (const align of ['left', 'center'] as LayoutAlign[])
      push('floating', mode, 'float', 'none', null, align, `フローティング・${mode}・${aL(align)}`);

  // 8. minimal（中央寄せ・狭幅）
  for (const header of ['none', 'center'] as LayoutHeader[])
    for (const mw of [640, 760, 880] as number[])
      push('minimal', 'minimal', header, 'none', mw, 'center', `ミニマル・${hL[header]}・幅${mw}`);

  // 9. immersive（ナビなし全画面）
  for (const align of ['left', 'center'] as LayoutAlign[])
    for (const mw of [null, 1200] as (number | null)[])
      push('immersive', 'immersive', 'none', 'none', mw, align, `没入・${aL(align)}・${wL(mw)}`);
  push('immersive', 'immersive', 'float', 'none', null, 'center', `没入・浮遊ナビ・中央`);
  push('immersive', 'immersive', 'float', 'none', null, 'left', `没入・浮遊ナビ・左`);

  // 10. portfolio（フルスクリーン作品）
  for (const header of ['none', 'float'] as LayoutHeader[])
    for (const align of ['left', 'center'] as LayoutAlign[])
      for (const mw of [null, 1200] as (number | null)[])
        push('portfolio', 'portfolio', header, 'none', mw, align, `作品・${hL[header]}・${aL(align)}・${wL(mw)}`);

  // 11. magazine（マガジン全幅／左サイド）
  for (const sidebar of ['none', 'left'] as LayoutSidebar[])
    for (const mw of [1200, null] as (number | null)[])
      for (const align of ['left', 'center'] as LayoutAlign[])
        push('magazine', 'magazine', sidebar === 'left' ? 'none' : 'bar', sidebar, mw, align, `マガジン・${sidebar === 'left' ? '左サイド' : 'バー'}・${wL(mw)}・${aL(align)}`);

  // 12. grid（グリッドマガジン）
  for (const header of ['bar', 'center', 'none'] as LayoutHeader[])
    for (const mw of [1200, null] as (number | null)[])
      push('grid', 'grid', header, 'none', mw, 'left', `グリッド・${hL[header]}・${wL(mw)}`);

  // 13. studio（全幅スタジオ）
  for (const header of ['bar', 'none'] as LayoutHeader[])
    for (const mw of [1200, null] as (number | null)[])
      for (const align of ['left', 'center'] as LayoutAlign[])
        push('studio', 'studio', header, 'none', mw, align, `スタジオ・${hL[header]}・${wL(mw)}・${aL(align)}`);

  // 14. experimental（変化球）
  for (const mode of ['split', 'studio', 'immersive', 'grid'] as SiteLayoutMode[])
    for (const header of ['split', 'center', 'float'] as LayoutHeader[])
      push('experimental', mode, header, mode === 'split' ? 'right' : 'none', null, 'center', `実験・${mode}・${hL[header]}`);

  return out;
}

export const LAYOUT_PRESETS: LayoutPreset[] = build();
export function findLayoutPreset(id: string | undefined): LayoutPreset | undefined {
  return id ? LAYOUT_PRESETS.find(p => p.id === id) : undefined;
}

/** 厳選レイアウト（パネルで提示する3種）。id は生成プリセットから条件で解決。 */
export interface CuratedLayout { id: string; label: string; description: string; mode: SiteLayoutMode; }
export const CURATED_LAYOUTS: CuratedLayout[] = (() => {
  const idOf = (pred: (p: LayoutPreset) => boolean) => LAYOUT_PRESETS.find(pred)?.id;
  const defs: (CuratedLayout | null)[] = [
    {
      id: idOf(p => p.category === 'header-bar' && p.mode === 'magazine' && p.header === 'bar' && p.maxWidth === 1200 && p.align === 'left') ?? '',
      label: 'スタンダード', description: '上部固定バーナビ。左にサイト名、右に項目を並べる標準形。', mode: 'magazine',
    },
    {
      id: idOf(p => p.category === 'sidebar-left' && p.header === 'none' && p.maxWidth === 1200) ?? '',
      label: '左サイドバー', description: '左サイドバーが全ナビを担う。トップバーなし・コンテンツ優先のクリーンなレイアウト。', mode: 'split',
    },
    {
      id: idOf(p => p.category === 'sidebar-both' && p.header === 'none' && p.maxWidth === 1200) ?? '',
      label: '両サイドバー', description: '左にページナビ、右にセクション目次。コンテンツに集中しやすいドキュメント型レイアウト。', mode: 'split',
    },
  ].map(d => (d && d.id ? d : null));
  return defs.filter((d): d is CuratedLayout => !!d);
})();
