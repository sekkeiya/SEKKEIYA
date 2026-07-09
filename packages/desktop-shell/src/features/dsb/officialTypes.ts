// 公式ブログ(SEKKEIYA 公式 = Firestore `officialArticles`)のデータモデル。
// アカウントブログ(BlogArticle / users/{uid}/blogArticles)とは別系統で、本文は HTML、
// カテゴリは {slug,name} オブジェクト、ステータスは draft/interview/review/published。
// Web admin(AdminArticleEditor)と同じスキーマを desktop に移植したもの。

export type OfficialStatus = 'draft' | 'interview' | 'review' | 'published';

export interface OfficialCategory {
  slug: string;
  name: string;
}

/** 記事の著者。AI記者パイプラインが生成した記事は reporter 情報も持つ。 */
export interface OfficialAuthor {
  uid: string | null;
  displayName: string;
}

/**
 * officialArticles ドキュメント。createdAt/updatedAt/publishedAt は Firestore Timestamp
 * （serverTimestamp で書き込み。読み出し時は Timestamp | null）。
 * interview 等 AI記者パイプライン由来のフィールドは Phase 2 で扱うため any で温存する。
 */
export interface OfficialArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  body: string;
  contentFormat: 'html' | 'markdown';
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  tagsLower?: string[];
  status: OfficialStatus;
  category: OfficialCategory | null;
  subCategory?: OfficialCategory | null;
  author?: OfficialAuthor;
  // ── AI記者パイプライン由来（Phase 2 で編集 UI を追加。今は保存時に温存するだけ） ──
  interview?: unknown | null;
  reporterName?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown;
}

/** エディタで編集する下書き（Firestore に依存しない編集用の平坦な形）。 */
export interface OfficialDraft {
  id: string | null;          // null = 新規
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  body: string;
  contentFormat: 'html' | 'markdown';
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  status: OfficialStatus;
  categoryName: string;
  categorySlug: string;
}

export function newOfficialDraft(): OfficialDraft {
  return {
    id: null,
    title: '',
    slug: '',
    excerpt: '',
    coverUrl: '',
    body: '',
    contentFormat: 'html',
    featured: false,
    seoTitle: '',
    seoDescription: '',
    tags: [],
    status: 'draft',
    categoryName: '',
    categorySlug: '',
  };
}

/** officialArticles ドキュメント → 編集用ドラフト。 */
export function articleToDraft(a: OfficialArticle): OfficialDraft {
  return {
    id: a.id,
    title: a.title || '',
    slug: a.slug || '',
    excerpt: a.excerpt || '',
    coverUrl: a.coverUrl || '',
    body: a.body || '',
    contentFormat: a.contentFormat || 'html',
    featured: !!a.featured,
    seoTitle: a.seoTitle || '',
    seoDescription: a.seoDescription || '',
    tags: Array.isArray(a.tags) ? a.tags : [],
    status: a.status || 'draft',
    categoryName: a.category?.name || '',
    categorySlug: a.category?.slug || '',
  };
}

export const OFFICIAL_STATUS_META: Record<OfficialStatus, { label: string; color: string; bg: string }> = {
  draft: { label: '下書き', color: 'light-dark(#aa7c03, #fbbf24)', bg: 'rgba(245,158,11,0.12)' },
  interview: { label: '🎤 取材待ち', color: 'light-dark(#aa4e03, #fb923c)', bg: 'rgba(251,146,60,0.14)' },
  review: { label: '🤖 レビュー待ち', color: 'light-dark(#5704a9, #c084fc)', bg: 'rgba(192,132,252,0.14)' },
  published: { label: '公開済み', color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
};
