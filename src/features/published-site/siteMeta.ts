// セクションメタ定義 + 旧構造の正規化（デスクトップ siteTemplates.ts から抽出）。
import type {
  ProjectSite, SitePage, SiteSection, SiteSectionType, SiteSectionVariant,
} from './siteTypes';

export const DEFAULT_VARIANT: Record<SiteSectionType, SiteSectionVariant> = {
  hero: 'hero-fullbleed', overview: 'lead', custom: 'lead', layout: 'feature',
  presentation: 'split', walkthrough: 'feature', diagram: 'duo', drawing: 'duo',
  gallery: 'mosaic', portfolio: 'feature', spec: 'feature', research: 'feature',
  target: 'feature', regulation: 'feature', concept: 'feature', process: 'feature',
  zoning: 'feature', flow: 'feature', itemspec: 'feature', comparison: 'feature',
  works: 'feature', projectlink: 'feature', usergenres: 'feature', usermodels: 'feature',
  profilestats: 'feature',
};

export interface SectionMeta {
  label: string;
  description: string;
  textOnly: boolean;
  defaultLayout: SiteSection['layout'];
}

export const SECTION_META: Record<SiteSectionType, SectionMeta> = {
  hero:         { label: 'ヒーロー',       description: 'プロジェクト名・キービジュアル', textOnly: true,  defaultLayout: 'full' },
  overview:     { label: '概要',           description: 'コンセプト・概要文',             textOnly: true,  defaultLayout: 'full' },
  layout:       { label: 'レイアウト',     description: 'S.Layout のレンダー',            textOnly: false, defaultLayout: 'grid' },
  presentation: { label: 'プレゼン',       description: 'S.Presentations のスライド',     textOnly: false, defaultLayout: 'split' },
  walkthrough:  { label: 'ウォークスルー', description: '動画',                           textOnly: false, defaultLayout: 'full' },
  diagram:      { label: 'ダイアグラム',   description: 'S.Diagram',                      textOnly: false, defaultLayout: 'grid' },
  drawing:      { label: '図面',           description: 'S.Drawing の図面',              textOnly: false, defaultLayout: 'grid' },
  gallery:      { label: 'ギャラリー',     description: 'S.Image の画像群',              textOnly: false, defaultLayout: 'grid' },
  portfolio:    { label: 'ポートフォリオ', description: 'S.Portfolio の PDF',            textOnly: false, defaultLayout: 'full' },
  spec:         { label: 'プロジェクト概要', description: '用途・規模・数値のサマリー表',   textOnly: true,  defaultLayout: 'full' },
  research:     { label: '敷地・周辺調査', description: '写真＋観察メモ',                 textOnly: false, defaultLayout: 'split' },
  target:       { label: 'ターゲット',     description: '利用者像をグラフで分析',         textOnly: true,  defaultLayout: 'split' },
  regulation:   { label: '法規・与条件',   description: '容積率/建蔽率/用途地域 など',     textOnly: true,  defaultLayout: 'full' },
  concept:      { label: 'コンセプト',     description: 'キーワード＋ステートメント',     textOnly: true,  defaultLayout: 'full' },
  process:      { label: '検討の過程',     description: 'いきさつのタイムライン',         textOnly: true,  defaultLayout: 'full' },
  references:   { label: '参考文献',       description: '参照 URL・出典のリスト',         textOnly: true,  defaultLayout: 'full' },
  zoning:       { label: 'ゾーニング',     description: '図＋各ゾーンの狙い',             textOnly: false, defaultLayout: 'split' },
  flow:         { label: '動線計画',       description: '図＋導線の解説',                 textOnly: false, defaultLayout: 'split' },
  itemspec:     { label: 'アイテムスペック', description: '家具・什器の型番/寸法/数量',     textOnly: true,  defaultLayout: 'full' },
  comparison:   { label: '比較検討',       description: 'プラン A / B の比較',           textOnly: true,  defaultLayout: 'grid' },
  works:        { label: 'Works / 実績',   description: 'プロジェクトサイトを一覧',       textOnly: true,  defaultLayout: 'grid' },
  projectlink:  { label: 'プロジェクト',   description: 'プロジェクトへのリンク',         textOnly: true,  defaultLayout: 'full' },
  usergenres:   { label: '得意ジャンル',   description: 'スキル分布グラフ',               textOnly: true,  defaultLayout: 'split' },
  usermodels:   { label: '投稿モデル',     description: '公開した 3D モデル',            textOnly: true,  defaultLayout: 'grid' },
  profilestats: { label: '統計',           description: 'フォロワー・投稿数など',         textOnly: true,  defaultLayout: 'full' },
  custom:       { label: 'カスタム',       description: '自由テキスト',                   textOnly: true,  defaultLayout: 'full' },
};

function rid(): string {
  return 'p-' + Math.abs(Array.from(Math.random().toString()).reduce((a, c) => a + c.charCodeAt(0), Date.now() % 100000)).toString(36);
}

function slugify(s: string, fallback: string): string {
  const base = (s || '').trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-+|-+$/g, '');
  return base || fallback;
}

export function createPage(title: string, sections: SiteSection[] = []): SitePage {
  return { id: rid(), title, slug: slugify(title, 'page'), sections };
}

export function sectionsToPages(sections: SiteSection[]): SitePage[] {
  const home = createPage('ホーム', []);
  home.slug = 'home';
  const pages: SitePage[] = [home];
  let homeAssetTaken = false;
  for (const s of sections) {
    if (s.type === 'hero' || s.type === 'overview') {
      home.sections.push(s);
    } else if (!homeAssetTaken) {
      home.sections.push(s);
      homeAssetTaken = true;
    } else {
      const title = (s.title && s.title.trim()) || SECTION_META[s.type].label;
      pages.push(createPage(title, [s]));
    }
  }
  return pages;
}

/** 旧 single-sections な site を pages 構造へ正規化（後方互換）。 */
export function normalizeSite(site: ProjectSite): ProjectSite {
  if (site.pages && site.pages.length > 0) return site;
  const legacy = site.sections ?? [];
  const pages = legacy.length > 0 ? sectionsToPages(legacy) : [createPage('ホーム', [])];
  pages[0].slug = 'home';
  return { ...site, pages };
}
