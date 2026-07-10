// 公開ブログ記事を SEKKEIYA Drive の「記事」資産として同期する（dual-publish の一部）。
// 取り込み方針（2026-07-10 合意 / project_drive_sblog_ingest_policy）:
//   公開記事のみ資産化・下書きは出さない。外部フィードは取り込まない。
//
// 1記事 = assets/blog_{id} の 1 ドキュメント（deterministic id）で upsert する。
//   公開       → upsert（Chat の search_drive や他アプリから参照できる）
//   非公開/削除 → 同ドキュメントを削除
// ベストエフォート（失敗しても記事保存は成立させる）。既存の Library/Knowledge/Community 同期と同列。
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { getUsername, PUBLIC_BASE } from '../../sites/publishService';
import type { BlogArticle } from '../types';

const driveRef = (articleId: string) => doc(db, 'assets', `blog_${articleId}`);

export async function syncBlogArticleToDrive(uid: string, article: BlogArticle): Promise<void> {
  // 下書き（非公開）は Drive に出さない → 既存があれば削除。
  if (article.status !== 'published') {
    try { await deleteDoc(driveRef(article.id)); } catch { /* no-op */ }
    return;
  }

  // 公開ページの URL（username 未設定なら null）。ダブルクリックで「ブラウザで開く」先。
  let publicUrl: string | null = null;
  try {
    const username = await getUsername(uid);
    if (username && article.slug) publicUrl = `${PUBLIC_BASE}/${username}/blog/${article.slug}`;
  } catch { /* URL 構築失敗は致命的でない */ }

  const data: Record<string, any> = {
    name: article.title || '無題の記事',
    type: 'article',
    appScope: '3dsb',
    ownerId: uid,
    // 公開記事＝公開層。My Public Folder（visibility=='public'）に出す（My Private ではなく）。
    visibility: 'public',
    projectId: null,
    sourceCollection: 'global_assets',
    // ★storageUrl は設定しない（リンク的に扱い、ダブルクリックで sourceUrl を開く）。
    ...(publicUrl ? { sourceUrl: publicUrl } : {}),
    ...(article.coverUrl ? { thumbnailUrl: article.coverUrl, imageUrl: article.coverUrl } : {}),
    tags: ['記事', ...(article.category ? [article.category] : [])],
    metadata: {
      kind: 'article',
      publishedVia: 'sblog',
      articleId: article.id,
      slug: article.slug || null,
      excerpt: article.excerpt || null,
      publishedAt: article.publishedAt || null,
    },
    createdAt: article.publishedAt ? new Date(article.publishedAt).getTime() : Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(driveRef(article.id), data, { merge: true });
}

/** 記事削除時に Drive 資産も消す。 */
export async function removeBlogArticleFromDrive(articleId: string): Promise<void> {
  try { await deleteDoc(driveRef(articleId)); } catch { /* no-op */ }
}
