// チームサイト（チームページ＝公開ポートフォリオ）のデフォルト構成を生成する。
// アカウントサイト（buildAccountSite）と対称の SiteOwner 2 層モデル（docs/15 §8）。
// アカウントサイトと同じ ProjectSite 構造を再利用し、Works セクションで
// そのチームの TEAM プロジェクトを一覧する。

import type { ProjectSite, SiteSection } from '../projects/types';
import { createSection, createPage } from './siteTemplates';
import { resolveEditorialTheme } from './editorialThemes';

interface TeamSiteInfo {
  teamId: string;
  name: string;          // チーム名（事務所/会社名）
  description?: string;  // チーム紹介文
}

export function buildTeamSite(info: TeamSiteInfo): ProjectSite {
  const personality = 'studio';
  const now = new Date().toISOString();

  const hero: SiteSection = {
    ...createSection('hero'),
    title: info.name,
    body: info.description || 'Architecture & Interior Studio',
    variant: 'hero-typographic',
    assetRefs: [],
  };
  const about: SiteSection = {
    ...createSection('overview'),
    title: 'About',
    body: info.description || `${info.name} のチームサイトです。チームで手がけたプロジェクトをご紹介します。`,
    variant: 'lead',
  };
  // works を team スコープに固定 → このチームの TEAM プロジェクトのみカード表示。
  const works: SiteSection = {
    ...createSection('works'),
    title: 'Works',
    body: 'チームのプロジェクト。カードをクリックで各サイトをご覧いただけます。',
    worksScope: 'team',
  };
  const services: SiteSection = {
    ...createSection('services'),
    title: 'Services',
    body: '提供するサービス領域。',
  };
  const contact: SiteSection = {
    ...createSection('custom'),
    title: 'Contact',
    body: 'プロジェクトのご相談・ご依頼を承っております。お気軽にお問い合わせください。',
    variant: 'statement',
  };

  const home = createPage('ホーム', [hero, about, works, services, contact]);
  home.slug = 'home';

  return {
    projectId: info.teamId,
    templateFamily: 'studio',
    templateId: 'team-default',
    theme: { accent: resolveEditorialTheme(personality).accent, mode: 'light', personality },
    pages: [home],
    publish: { status: 'draft', slug: '', visibility: 'private', publishedAt: null, lastDeployId: null },
    createdAt: now,
    updatedAt: now,
  };
}
