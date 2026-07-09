// サイトの永続化を「サイトソース（プロジェクト / アカウント / チーム）」で抽象化する。
//   project → /projects/{id}/site/main
//   account → /users/{uid}/site/main（マイページ＝アカウントサイト）
//   team    → /teams/{teamId}/site/main（チームサイト＝SiteOwner 2層モデル, docs/15 §8）
// 仕様: docs/09_project_site_spec.md / アカウントサイト2層モデル

import { doc, getDocFromServer, setDoc, deleteDoc, waitForPendingWrites } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import type { ProjectSite } from '../projects/types';
import { normalizeSite } from './siteTemplates';

export type SiteSourceKind = 'project' | 'account' | 'team';
export interface SiteSource { kind: SiteSourceKind; id: string; }

function siteDocRef(source: SiteSource) {
  switch (source.kind) {
    case 'account': return doc(db, 'users', source.id, 'site', 'main');
    case 'team':    return doc(db, 'teams', source.id, 'site', 'main');
    default:        return doc(db, 'projects', source.id, 'site', 'main');
  }
}

/**
 * Firestore は `undefined` フィールドを含む書き込みを例外で拒否する（ignoreUndefinedProperties 未設定）。
 * createSection 等が生成する undefined（DEFAULT_TITLES に無い type の title / 未ログイン時の updatedBy 等）で
 * save が失敗し、サイトが永続化されず「リロードで消える」原因になるため、保存前に再帰的に除去する。
 */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(v => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export const SiteRepository = {
  /**
   * サーバーから直接取得（キャッシュをバイパス）。
   * persistentLocalCache 環境でキャッシュが古い場合にリロード後に旧データが返る問題を防ぐ。
   */
  async get(source: SiteSource): Promise<ProjectSite | null> {
    const snap = await getDocFromServer(siteDocRef(source));
    if (!snap.exists()) {
      console.warn('[SiteRepo] get: document not found', source.kind, source.id);
      return null;
    }
    const site = normalizeSite({ ...(snap.data() as ProjectSite), projectId: source.id });
    const heroTitle = (site.pages?.[0]?.sections as any[])?.find((s: any) => s.type === 'hero')?.title;
    console.log('[SiteRepo] get: heroTitle =', JSON.stringify(heroTitle), '| source:', source.kind, source.id);
    return site;
  },

  /**
   * サーバーへ書き込み、waitForPendingWrites でサーバー確認まで待機する。
   */
  async save(source: SiteSource, site: ProjectSite): Promise<void> {
    const heroTitle = (site.pages?.[0]?.sections as any[])?.find((s: any) => s.type === 'hero')?.title;
    console.log('[SiteRepo] save: heroTitle =', JSON.stringify(heroTitle), '| source:', source.kind, source.id);
    // 呼び出し元スタックトレースを出力（犯人特定用）
    console.trace('[SiteRepo] save caller trace');
    const payload = stripUndefined<ProjectSite>({ ...site, projectId: source.id, updatedAt: new Date().toISOString() });
    await setDoc(siteDocRef(source), payload, { merge: true });
    await waitForPendingWrites(db);
    console.log('[SiteRepo] save: server confirmed ✓');
  },

  /** サイトドキュメント（site/main）を削除する。公開停止は呼び出し側で別途行う。 */
  async remove(source: SiteSource): Promise<void> {
    await deleteDoc(siteDocRef(source));
    await waitForPendingWrites(db);
  },
};
