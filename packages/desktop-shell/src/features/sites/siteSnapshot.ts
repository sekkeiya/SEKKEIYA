// 現在の ProjectSite を「LLM / インテント解析が読める軽量サマリ」に変換する。
// 仕様: docs/10_sekkeiya_chat_spec.md §4.4 SITE_SNAPSHOT / §3.1 snapshot 注入。
// Phase A: バックエンドへの context 注入と、クライアント側インテント shim の的当てに使う。

import type { SiteSectionType } from '../projects/types';
import { useProjectSiteStore } from '../../store/useProjectSiteStore';

export interface SiteSectionSnapshot {
  id: string;
  type: SiteSectionType;
  title?: string;
  hasBody: boolean;
  assetCount: number;
  hidden?: boolean;
}

export interface SitePageSnapshot {
  id: string;
  title: string;
  active: boolean;
  sections: SiteSectionSnapshot[];
}

export interface SiteSnapshot {
  exists: boolean;            // ProjectSite が未作成なら false
  projectId: string | null;   // アクティブプロジェクトの Firestore ID
  projectName: string;
  templateFamily?: string;
  personality?: string;
  activePageId: string | null;
  pages: SitePageSnapshot[];
}

/** zustand ストアから現在のサイト構成スナップショットを生成する（純粋 read）。 */
export function buildSiteSnapshot(): SiteSnapshot {
  const { site, activePageId, displayName, source } = useProjectSiteStore.getState();
  const projectName = displayName;
  // account ソース（アカウントサイト）の id は uid であり project ID ではないため除外する。
  const projectId = source?.kind === 'project' ? source.id : null;
  if (!site) {
    return { exists: false, projectId, projectName, activePageId: null, pages: [] };
  }
  return {
    exists: true,
    projectId,
    projectName,
    templateFamily: site.templateFamily,
    personality: site.theme?.personality,
    activePageId,
    pages: site.pages.map(p => ({
      id: p.id,
      title: p.title,
      active: p.id === activePageId,
      sections: p.sections.map(s => ({
        id: s.id,
        type: s.type,
        title: s.title,
        hasBody: !!(s.body && s.body.trim()),
        assetCount: s.assetRefs?.length ?? 0,
        hidden: s.hidden,
      })),
    })),
  };
}

/** スナップショットを system prompt へ差し込むためのコンパクトなテキストへ整形する。 */
export function formatSiteSnapshotForPrompt(snap: SiteSnapshot): string {
  if (!snap.exists) {
    return '[現在のサイト] まだ ProjectSite は未作成です（テンプレート選択前）。';
  }
  const lines: string[] = [];
  lines.push(`[現在のサイト] project="${snap.projectName}" projectId=${snap.projectId ?? '-'} family=${snap.templateFamily} theme=${snap.personality ?? '-'}`);
  for (const page of snap.pages) {
    lines.push(`- page "${page.title}"${page.active ? ' (active)' : ''} [${page.id}]`);
    if (page.sections.length === 0) {
      lines.push('    (section なし)');
    }
    for (const s of page.sections) {
      lines.push(`    - ${s.type}${s.title ? ` "${s.title}"` : ''} body=${s.hasBody ? 'あり' : 'なし'} assets=${s.assetCount}${s.hidden ? ' hidden' : ''} [${s.id}]`);
    }
  }
  return lines.join('\n');
}
