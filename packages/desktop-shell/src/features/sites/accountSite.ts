// アカウントサイト（マイページ＝公開ポートフォリオ）のデフォルト構成を生成する。
// プロジェクトサイトと同じ ProjectSite 構造を再利用し、Works セクションで実績を一覧する。

import type { ProjectSite, SitePage, SiteSection } from '../projects/types';
import { createSection, createPage } from './siteTemplates';
import { resolveEditorialTheme } from './editorialThemes';
import { CURATED_LAYOUTS } from './layoutPresets';

/** Works/projectlink が参照するプロジェクトの軽量情報。 */
export interface AccountProjectLite { id: string; name: string; cover?: string | null; isTeam?: boolean; }

interface AccountInfo {
  userId: string;
  displayName: string;
  role?: string;   // 肩書（例: 3D modeler / 建築家）
  bio?: string;
}

export function buildAccountSite(info: AccountInfo): ProjectSite {
  const personality = 'journal';
  const now = new Date().toISOString();

  const hero: SiteSection = {
    ...createSection('hero'),
    title: info.displayName,
    body: info.role || 'Architecture & Interior',
    variant: 'hero-typographic',
    assetRefs: [],
  };
  const about: SiteSection = {
    ...createSection('overview'),
    title: 'About',
    body: info.bio || `${info.displayName} のポートフォリオサイトです。これまで手がけたプロジェクトを通じて、空間づくりへの考え方をご紹介します。`,
    variant: 'lead',
  };
  const genres: SiteSection = { ...createSection('usergenres'), title: '得意ジャンル', body: '公開モデルから自動集計したスキルの分布です。' };
  const models: SiteSection = { ...createSection('usermodels'), title: '投稿モデル', body: 'これまでに公開した 3D モデル。' };
  const works: SiteSection = { ...createSection('works'), title: 'Works', body: 'これまでのプロジェクト。カードをクリックで各サイトをご覧いただけます。', worksScope: 'all' };
  const blog: SiteSection = { ...createSection('blog'), title: 'ブログ', body: '記事をカテゴリごとにご覧いただけます。' };
  const contact: SiteSection = {
    ...createSection('custom'),
    title: 'Contact',
    body: 'プロジェクトのご相談・ご依頼を承っております。お気軽にお問い合わせください。',
    variant: 'statement',
  };

  const stats: SiteSection = { ...createSection('profilestats'), title: '統計' };
  const home = createPage('ホーム', [hero, stats, about, genres, models, works, blog, contact]);
  home.slug = 'home';

  return {
    projectId: info.userId,
    templateFamily: 'portfolio',
    templateId: 'account-default',
    // 既定で「固定ヘッダー軸」のレイアウト（スタンダード）を適用＝ナビは常時上部に表示。
    theme: { accent: resolveEditorialTheme(personality).accent, mode: 'light', personality, layoutPresetId: CURATED_LAYOUTS[0]?.id },
    pages: [home],
    publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null },
    createdAt: now,
    updatedAt: now,
  };
}

/** 旧構成（プロジェクトごとの proj-* ページ）を除去する。My/Team は home の works セクションへ移行済み。 */
export function stripProjectPages(site: ProjectSite): SitePage[] | null {
  const next = site.pages.filter(p => !p.slug?.startsWith('proj-'));
  return next.length !== site.pages.length ? next : null;
}
