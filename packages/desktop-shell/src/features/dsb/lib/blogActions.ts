// S.Blog — チャット/外部から記事を作る操作（SEKKEIYA Chat の create_blog_draft 等から呼ぶ）。
import { useAuthStore } from '../../../store/useAuthStore';
import { useAppStore } from '../../../store/useAppStore';
import { useDsbStore } from '../store/useDsbStore';
import { saveBlogArticle } from '../api/blogApi';
import { newBlogDraft, slugify } from './blogUtils';
import type { BlogArticle } from '../types';

/**
 * チャットの会話内容などから記事の「下書き」を作成し、S.Blog を開いて編集状態にする。
 * 公開はユーザーがエディタで確認してから行う（いきなり公開はしない）。
 */
export async function createBlogDraftFromChat(args: {
  title: string;
  markdown: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
}): Promise<BlogArticle> {
  const user = useAuthStore.getState().currentUser as any;
  const uid = user?.uid as string | undefined;
  if (!uid) throw new Error('ログインが必要です');

  const base = newBlogDraft({ authorUid: uid, authorName: user?.displayName ?? null });
  const title = (args.title || '').trim() || '無題の記事';
  const article: BlogArticle = {
    ...base,
    title,
    slug: slugify(title),
    bodyMarkdown: args.markdown || '',
    excerpt: (args.excerpt || '').trim(),
    category: args.category || base.category,
    tags: Array.isArray(args.tags) ? args.tags : [],
  };

  await saveBlogArticle(uid, article);

  // S.Blog を前面に出し、作成した下書きをエディタで開く。
  const app = useAppStore.getState();
  app.setActiveWorkspaceId('blog');
  app.setLastActiveAppScope('3dsb');
  app.setCurrentMainView('workspace');

  const dsb = useDsbStore.getState();
  await dsb.refresh(uid);
  dsb.startEdit(article.id);

  return article;
}
