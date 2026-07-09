// ProjectSite の永続化リポジトリ。
// Firestore: /projects/{projectId}/site/main（単一ドキュメント）
// 仕様: docs/09_project_site_spec.md §3

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { ProjectSite } from '../types';
import { normalizeSite } from '../../sites/siteTemplates';

const siteDocRef = (projectId: string) => doc(db, 'projects', projectId, 'site', 'main');

/**
 * Firestore は `undefined` フィールドを含む書き込みを例外で拒否する（ignoreUndefinedProperties 未設定）。
 * createSection 等が生成する undefined（DEFAULT_TITLES に無い type の title 等）で save が失敗し、
 * サイトが永続化されず「リロードで消える」原因になるため、保存前に再帰的に除去する。
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

export const ProjectSiteRepository = {
  async get(projectId: string): Promise<ProjectSite | null> {
    const snap = await getDoc(siteDocRef(projectId));
    if (!snap.exists()) return null;
    return normalizeSite({ ...(snap.data() as ProjectSite), projectId });
  },

  async save(site: ProjectSite): Promise<void> {
    const payload = stripUndefined<ProjectSite>({ ...site, updatedAt: new Date().toISOString() });
    await setDoc(siteDocRef(site.projectId), payload, { merge: true });
  },
};
