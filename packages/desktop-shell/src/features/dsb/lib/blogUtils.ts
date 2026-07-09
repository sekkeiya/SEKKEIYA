import type { BlogArticle, BlogPublishTarget } from '../types';

/** タイトル等から URL スラッグを生成（日本語はそのまま残し、空白/記号を - に畳む）。 */
export function slugify(input: string): string {
  const base = (input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/\\]+/g, '-')          // 空白・スラッシュ → -
    .replace(/[^\p{L}\p{N}-]+/gu, '')   // 文字・数字・ハイフン以外を除去（Unicode対応）
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `post-${Date.now().toString(36)}`;
}

/** 新規ドラフト記事を生成。 */
export function newBlogDraft(args: {
  authorUid: string;
  authorName?: string | null;
  publishTarget?: BlogPublishTarget;
}): BlogArticle {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `blog-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    id,
    slug: '',
    title: '',
    excerpt: '',
    bodyMarkdown: '',
    coverUrl: null,
    tags: [],
    category: 'コラム',
    status: 'draft',
    publishTarget: args.publishTarget ?? { scope: 'account' },
    authorUid: args.authorUid,
    authorName: args.authorName ?? null,
    knowledgeSourceId: null,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
