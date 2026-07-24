// 公開スナップショットの解決（Phase C 焼き込み）。
//
// アカウント/プロジェクトサイトには live store / hook から描画する動的セクションがある
// （works 一覧・得意ジャンル・投稿モデル・統計・projectlink）。Web（別リポ）は認証なしで
// publishedSites を読むだけなので、これらを **公開時点で解決して section に焼き込み**、
// Web は静的に描画する。本人権限で読めるデータ（assets/followers 等）はここで取得する。

import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { resolveAssetPreviewUrl } from '../../store/useAIDriveStore';
import { listBlogArticles, loadBlogCategories } from '../dsb/api/blogApi';
import { slugify } from '../dsb/lib/blogUtils';
import type {
  ChartDatum, ProjectSite, ResolvedBlog, ResolvedProfile, ResolvedWork, SiteSection,
} from '../projects/types';

// 公開済みブログ記事＋カテゴリを焼き込み用に解決する（blog セクション）。
async function loadBlog(ownerUid: string): Promise<ResolvedBlog> {
  let pub: Awaited<ReturnType<typeof listBlogArticles>> = [];
  let cats: string[] = [];
  try { pub = (await listBlogArticles(ownerUid)).filter((a) => a.status === 'published'); } catch { /* noop */ }
  try { cats = await loadBlogCategories(ownerUid); } catch { /* noop */ }
  const counts = new Map<string, number>();
  for (const a of pub) { const c = (a.category || '').trim(); if (c) counts.set(c, (counts.get(c) ?? 0) + 1); }
  const ordered = [
    ...cats.filter((c) => counts.has(c)),
    ...[...counts.keys()].filter((c) => !cats.includes(c)).sort((x, y) => x.localeCompare(y, 'ja')),
  ];
  return {
    articles: pub.map((a) => ({
      id: a.id,
      slug: a.slug?.trim() || slugify(a.title),
      title: a.title,
      excerpt: a.excerpt,
      cover: a.coverUrl ?? null,
      category: a.category,
      publishedAt: a.publishedAt ?? a.updatedAt ?? null,
    })),
    categories: ordered.map((name) => ({ name, count: counts.get(name) ?? 0 })),
  };
}

// 投稿モデルの category / tags を集計（上位6）。useCreatorStats.aggregateGenres と同一ロジック。
function aggregateGenres(models: { category?: string; tags?: string[] }[]): ChartDatum[] {
  const counts: Record<string, number> = {};
  for (const a of models) {
    const sources: string[] = [];
    if (a.category) sources.push(a.category);
    if (Array.isArray(a.tags)) sources.push(...a.tags);
    for (const s of sources) { const k = (s || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
}

// このユーザーの公開済みプロジェクト: projectId -> slug（`@user/slug`）。
async function loadPublishedProjectSlugs(ownerUid: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const snap = await getDocs(query(
      collection(db, 'publishedSites'),
      where('ownerUid', '==', ownerUid),
      where('kind', '==', 'project'),
    ));
    snap.docs.forEach(d => {
      const x = d.data() as any;
      if (x.projectId && x.slug) map.set(x.projectId, x.slug);
    });
  } catch { /* noop（rules 未デプロイ時等は空のまま） */ }
  return map;
}

// プロフィール統計（得意ジャンル/投稿モデル/フォロワー）を本人権限で取得。
async function loadProfile(ownerUid: string, publishedProjectCount: number): Promise<ResolvedProfile> {
  let models: ResolvedProfile['models'] = [];
  let raw: { category?: string; tags?: string[] }[] = [];
  let followers = 0; let following = 0;
  try {
    const snap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', ownerUid), limit(24)));
    raw = snap.docs.map(d => d.data() as any);
    models = snap.docs.map(d => {
      const x = d.data() as any;
      return { id: d.id, name: x.name || x.title || 'Untitled', thumb: resolveAssetPreviewUrl(x) };
    });
  } catch { /* noop */ }
  try { followers = (await getDocs(collection(db, 'users', ownerUid, 'followers'))).size; } catch { /* noop */ }
  try { following = (await getDocs(collection(db, 'users', ownerUid, 'following'))).size; } catch { /* noop */ }
  return { followers, following, models, genres: aggregateGenres(raw), publishedProjectCount };
}

interface ProjectLike {
  id: string; name: string; isTeam?: boolean;
  coverThumbnailUrl?: string | null; iconEmoji?: string | null; iconUrl?: string | null;
}

/**
 * site の動的セクションを解決して焼き込んだ新しい site を返す（元 site は変更しない）。
 * 公開前に呼び、戻り値を publishSite({ site }) に渡す。
 */
export async function resolvePublishSnapshot(
  site: ProjectSite,
  ownerUid: string,
  projects: ProjectLike[],
): Promise<ProjectSite> {
  const publishedSlugs = await loadPublishedProjectSlugs(ownerUid);

  // プロフィール系セクションが含まれる時だけ取得（無駄な read を避ける）。
  const allSections = (site.pages || []).flatMap(p => p.sections || []);
  const needsProfile = allSections.some(s => s.type === 'usergenres' || s.type === 'usermodels' || s.type === 'profilestats');
  const profile = needsProfile ? await loadProfile(ownerUid, publishedSlugs.size) : null;

  // blog セクションがある時だけ公開記事を取得（無駄な read を避ける）。
  const needsBlog = allSections.some(s => s.type === 'blog');
  const blog = needsBlog ? await loadBlog(ownerUid) : null;

  const worksFor = (scope?: 'my' | 'team' | 'all'): ResolvedWork[] => {
    const filtered = scope === 'my' ? projects.filter(p => !p.isTeam)
      : scope === 'team' ? projects.filter(p => p.isTeam)
      : projects;
    return filtered.map(p => ({
      id: p.id,
      name: p.name,
      cover: p.coverThumbnailUrl ?? null,
      isTeam: !!p.isTeam,
      iconEmoji: p.iconEmoji ?? null,
      iconUrl: p.iconUrl ?? null,
      publishedSlug: publishedSlugs.get(p.id) ?? null,
    }));
  };

  const resolveSection = (s: SiteSection): SiteSection => {
    // assetRefs の表示 URL を可能なら解決（sample/placeholder はそのまま）。
    const assetRefs = (s.assetRefs || []).map(ref => {
      if (ref.thumbnailUrl || ref.sample || ref.placeholder) return ref;
      const url = resolveAssetPreviewUrl(ref);
      return url ? { ...ref, thumbnailUrl: url } : ref;
    });
    const next: SiteSection = { ...s, assetRefs };

    if (s.type === 'works') {
      next.resolvedWorks = worksFor(s.worksScope);
    } else if (s.type === 'blog' && blog) {
      next.resolvedBlog = blog;
    } else if (profile && (s.type === 'usergenres' || s.type === 'usermodels' || s.type === 'profilestats')) {
      next.resolvedProfile = profile;
    } else if (s.type === 'projectlink' && s.projectRef) {
      next.projectRef = { ...s.projectRef, publishedSlug: publishedSlugs.get(s.projectRef.projectId) ?? null };
    }
    return next;
  };

  return {
    ...site,
    pages: (site.pages || []).map(page => ({ ...page, sections: (page.sections || []).map(resolveSection) })),
  };
}
