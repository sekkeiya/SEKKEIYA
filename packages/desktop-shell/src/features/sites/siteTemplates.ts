// サイト初期テンプレート（3 系統）とセクションメタ定義。
// 仕様: docs/09_project_site_spec.md §4
// 各系統は今後「1 系統につき多数のテンプレ」を内包する。MVP では系統ごとに最低 1 テンプレ。

import { v4 as uuidv4 } from 'uuid';
import type {
  ProjectSite, SitePage, SiteSection, SiteSectionType, SiteSectionVariant, SiteTemplateFamily, SiteThemePersonality,
} from '../projects/types';
import { resolveEditorialTheme } from './editorialThemes';

/** セクション種別ごとの既定 variant（誌面レイアウト）。 */
export const DEFAULT_VARIANT: Record<SiteSectionType, SiteSectionVariant> = {
  hero: 'hero-fullbleed',
  overview: 'lead',
  custom: 'lead',
  layout: 'feature',
  presentation: 'split',
  walkthrough: 'feature',
  diagram: 'duo',
  drawing: 'duo',
  gallery: 'mosaic',
  portfolio: 'feature',
  spec: 'feature',
  research: 'feature',
  target: 'feature',
  regulation: 'feature',
  concept: 'feature',
  process: 'feature',
  zoning: 'feature',
  flow: 'feature',
  itemspec: 'feature',
  comparison: 'feature',
  works: 'feature',
  projectlink: 'feature',
  usergenres: 'feature',
  usermodels: 'feature',
  profilestats: 'feature',
  unitlist: 'feature',
  unitpicker: 'feature',
  services: 'feature',
  blog: 'blog-cards',
};

/** テンプレ系統ごとの既定の人格（後で chat / UI から変更可能）。 */
export const FAMILY_PERSONALITY: Record<SiteTemplateFamily, SiteThemePersonality> = {
  proposal: 'journal',
  record: 'atelier',
  portfolio: 'gallery',
  residence: 'atelier',
  parcel: 'mono',
  studio: 'studio',
};

/* ---------------- セクション種別メタ ---------------- */

export interface SectionMeta {
  label: string;
  description: string;
  /** asset を持たない説明系セクションか（hero/overview/custom）。 */
  textOnly: boolean;
  defaultLayout: SiteSection['layout'];
}

export const SECTION_META: Record<SiteSectionType, SectionMeta> = {
  hero:         { label: 'ヒーロー',       description: 'プロジェクト名・キービジュアル', textOnly: true,  defaultLayout: 'full' },
  overview:     { label: '概要',           description: 'コンセプト・概要文',             textOnly: true,  defaultLayout: 'full' },
  layout:       { label: 'レイアウト',     description: 'S.Layout のレンダー',            textOnly: false, defaultLayout: 'grid' },
  presentation: { label: 'プレゼン',       description: 'S.Presentations のスライド',     textOnly: false, defaultLayout: 'split' },
  walkthrough:  { label: 'ウォークスルー', description: 'S.Layout のウォークスルーを埋め込み（操作可能）', textOnly: false, defaultLayout: 'full' },
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
  unitlist:     { label: '部屋一覧',       description: '間取り・面積・価格・空き状況',   textOnly: false, defaultLayout: 'grid' },
  unitpicker:   { label: '区画セレクター', description: '建物図＋区画カード一覧',         textOnly: false, defaultLayout: 'split' },
  services:     { label: 'サービス',       description: '業務領域のカードグリッド',       textOnly: true,  defaultLayout: 'grid' },
  blog:         { label: 'ブログ',         description: 'S.Blog の公開記事を一覧（カテゴリ絞り込み付き）', textOnly: false, defaultLayout: 'grid' },
  custom:       { label: 'カスタム',       description: '自由テキスト',                   textOnly: true,  defaultLayout: 'full' },
};

/** 編集モードの「セクション追加」メニューに出す順序。 */
export const ADDABLE_SECTION_TYPES: SiteSectionType[] = [
  'overview', 'spec', 'research', 'target', 'regulation', 'concept', 'process',
  'layout', 'zoning', 'flow', 'gallery', 'drawing', 'diagram',
  'presentation', 'walkthrough', 'itemspec', 'comparison', 'portfolio',
  'unitlist', 'unitpicker', 'services', 'blog', 'custom',
];

/** 構造化セクション（誌面 variant を持たず、型固有のレイアウトで描画）。 */
export const STRUCTURED_TYPES: SiteSectionType[] = [
  'spec', 'itemspec', 'comparison', 'zoning', 'flow',
  'research', 'target', 'regulation', 'concept', 'process', 'works', 'projectlink',
  'usergenres', 'usermodels', 'profilestats',
  'unitlist', 'unitpicker', 'services', 'blog',
];

/** 誌面レイアウト variant の表示名。 */
export const VARIANT_LABEL: Record<SiteSectionVariant, string> = {
  'hero-fullbleed': 'フルブリード',
  'hero-editorial': 'エディトリアル',
  'hero-split': '分割（画像＋見出し）',
  'hero-typographic': 'タイポグラフィ',
  lead: 'リード',
  statement: 'ステートメント',
  'two-column': '2段組',
  quote: '引用',
  feature: 'フィーチャー',
  split: '左右交互',
  duo: '2枚並列',
  mosaic: 'モザイク',
  filmstrip: 'フィルムストリップ',
  band: '全幅バンド',
  masonry: 'メーソンリー',
  'index-list': '番号リスト',
  overlap: 'オーバーラップ',
  'hero-minimal': 'ミニマル',
  'hero-centered': 'センター',
  'hero-left': '左寄せ',
  'hero-card': 'カード',
  'hero-duotone': 'デュオトーン',
  'hero-stack': 'スタック',
  'hero-spec': 'スペック重ね',
  'hero-3d': 'レイアウト没入',
  'hero-scroll3d': '3Dスクロール',
  'three-column': '3段組',
  boxed: '囲み',
  'centered-text': '中央',
  'display-text': '特大',
  manifesto: 'マニフェスト',
  sidenote: 'サイドノート',
  'grid-3': '3列グリッド',
  'grid-4': '4列グリッド',
  carousel: 'カルーセル',
  'st-plain': '標準',
  'st-center': '中央寄せ',
  'st-surface': '面',
  'st-inverted': '反転',
  'st-boxed': '囲み',
  'st-divided': '区切り',
  'st-accent': '左アクセント',
  'st-spacious': 'ゆったり',
  'st-rule': '罫線',
  'st-quiet': '静か',
  'blog-cards': 'カード',
  'blog-list': 'リスト',
  'blog-magazine': 'マガジン',
  'blog-minimal': 'ミニマル',
  'blog-bar': 'カテゴリバー',
};

/** セクション種別ごとに選べる variant 一覧（テンプレートタブ用）。 */
export function variantsForType(type: SiteSectionType): SiteSectionVariant[] {
  if (type === 'blog') {
    // ブログ一覧の見せ方（右サイドバーで選択）
    return ['blog-cards', 'blog-list', 'blog-magazine', 'blog-minimal', 'blog-bar'];
  }
  if (STRUCTURED_TYPES.includes(type)) {
    // 構造化（データ駆動）セクションは装飾的な見せ方を 10 種提供
    return ['st-plain', 'st-center', 'st-surface', 'st-inverted', 'st-boxed',
            'st-divided', 'st-accent', 'st-spacious', 'st-rule', 'st-quiet'];
  }
  if (type === 'hero') {
    return ['hero-fullbleed', 'hero-editorial', 'hero-split', 'hero-typographic',
            'hero-minimal', 'hero-centered', 'hero-left', 'hero-card', 'hero-duotone', 'hero-stack',
            'hero-spec', 'hero-3d', 'hero-scroll3d'];
  }
  if (SECTION_META[type].textOnly) {
    return ['lead', 'statement', 'two-column', 'quote',
            'three-column', 'boxed', 'centered-text', 'display-text', 'manifesto', 'sidenote'];
  }
  return ['feature', 'split', 'duo', 'mosaic', 'filmstrip', 'band', 'masonry', 'index-list', 'overlap',
          'grid-3', 'grid-4', 'carousel'];
}

/* ---------------- テンプレ系統メタ ---------------- */

export interface TemplateFamilyMeta {
  family: SiteTemplateFamily;
  templateId: string;       // MVP: 系統ごとに 1 つ（'<family>-default'）
  label: string;
  description: string;
  accent: string;
  /** 初期 section 構成（hero は必ず先頭）。 */
  sectionTypes: SiteSectionType[];
}

export const TEMPLATE_FAMILIES: TemplateFamilyMeta[] = [
  {
    family: 'proposal',
    templateId: 'proposal-default',
    label: '設計提案プレゼン用',
    description: '未受注・提案段階。コンセプトと提案内容を魅力的に見せる。',
    accent: '#00BFFF',
    sectionTypes: ['hero', 'overview', 'layout', 'presentation', 'walkthrough', 'custom'],
  },
  {
    family: 'record',
    templateId: 'record-default',
    label: '竣工記録 / 実例紹介用',
    description: '完成後の実績記録。施工写真・図面・実例を残す。',
    accent: '#43e97b',
    sectionTypes: ['hero', 'overview', 'gallery', 'drawing', 'walkthrough', 'diagram'],
  },
  {
    family: 'portfolio',
    templateId: 'portfolio-default',
    label: 'ポートフォリオ用',
    description: '複数プロジェクト/作品を束ねる見せ方。',
    accent: '#bb8fce',
    sectionTypes: ['hero', 'overview', 'portfolio', 'gallery', 'custom'],
  },
  {
    family: 'residence',
    templateId: 'residence-default',
    label: '集合住宅・分譲プロジェクト用',
    description: '部屋一覧・間取り・価格・アメニティを掲載する分譲サイト。',
    accent: '#4ade80',
    sectionTypes: ['hero', 'overview', 'unitlist', 'research', 'custom'],
  },
  {
    family: 'parcel',
    templateId: 'parcel-default',
    label: '区画・戸建て分譲用',
    description: '建物図から区画を選ぶ、少数ユニット向けセレクター型サイト。',
    accent: '#e2e8f0',
    sectionTypes: ['hero', 'overview', 'unitpicker', 'spec', 'research', 'custom'],
  },
  {
    family: 'studio',
    templateId: 'studio-default',
    label: '事務所・スタジオ紹介用',
    description: 'サービス・実績・比較を訴求する事務所・設計会社のサイト。',
    accent: '#38bdf8',
    sectionTypes: ['hero', 'overview', 'services', 'profilestats', 'works', 'comparison', 'custom'],
  },
];

/* ---------------- ファクトリ ---------------- */

const DEFAULT_TITLES: Partial<Record<SiteSectionType, string>> = {
  overview: '概要',
  layout: 'レイアウト',
  presentation: 'プレゼンテーション',
  walkthrough: 'ウォークスルー',
  diagram: 'ダイアグラム',
  drawing: '図面',
  gallery: 'ギャラリー',
  portfolio: 'ポートフォリオ',
  custom: 'セクション',
};

export function createSection(type: SiteSectionType, title?: string): SiteSection {
  return {
    id: uuidv4(),
    type,
    title: title ?? DEFAULT_TITLES[type],
    layout: SECTION_META[type].defaultLayout,
    variant: DEFAULT_VARIANT[type],
    assetRefs: [],
    body: '',
  };
}

/** テンプレ系統から空の ProjectSite を生成する（in-memory。保存は呼び出し側）。 */
export function createSiteFromTemplate(
  projectId: string,
  family: SiteTemplateFamily,
  projectName: string,
): ProjectSite {
  const meta = TEMPLATE_FAMILIES.find(t => t.family === family) ?? TEMPLATE_FAMILIES[0];
  const now = new Date().toISOString();
  const personality = FAMILY_PERSONALITY[meta.family];
  const accent = resolveEditorialTheme(personality).accent;
  const sections = meta.sectionTypes.map(type =>
    type === 'hero'
      ? { ...createSection('hero', projectName), body: 'プロジェクトの概要をここに記述します。' }
      : createSection(type),
  );
  return {
    projectId,
    templateFamily: meta.family,
    templateId: meta.templateId,
    theme: { accent, mode: 'dark', personality },
    pages: sectionsToPages(sections),
    publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null },
    createdAt: now,
    updatedAt: now,
  };
}

/* ==========================================================
 * 複数ページモデルのヘルパー
 * =========================================================*/

function slugify(s: string, fallback: string): string {
  const base = (s || '').trim().toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, '-').replace(/^-+|-+$/g, '');
  return base || fallback;
}

export function createPage(title: string, sections: SiteSection[] = []): SitePage {
  return { id: uuidv4(), title, slug: slugify(title, 'page'), sections };
}

/**
 * セクション列を複数ページへ分割する。
 * ホーム = hero + overview +（最初の素材セクション1つ）。
 * 以降の素材/カスタムセクションは各々を独立ページにする（サイドバーの項目になる）。
 */
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
