// S.Blog dual-publish ① — 公開記事を SEKKEIYA Chat / SEARCH のナレッジ(RAG)へ同期する。
// S.Library の ragIngest と同じ経路（useAiProfileStore.ingestKnowledgeSource →
// Cloud Function `ingestKnowledge`）を再利用し、記事本文を埋め込み索引に載せる。
// これにより「公開した記事が Chat の根拠／検索対象になる」を新検索インフラなしで実現する。
import { useAiProfileStore } from '../../../store/useAiProfileStore';
import type { BlogArticle } from '../types';

/** RAG 取り込みの照合キー（記事1件＝1ソース。再公開時の重複判定にサーバ側で使用想定）。 */
export function blogRagSourceKey(article: BlogArticle): string {
  return `blog:${article.id}`;
}

/** 記事本文を RAG 用テキストへ整形（タイトル/抜粋/カテゴリ/タグを前置きして検索性を上げる）。 */
function buildKnowledgeText(article: BlogArticle): string {
  const head = [
    `# ${article.title}`,
    article.excerpt ? article.excerpt : '',
    article.category ? `カテゴリ: ${article.category}` : '',
    article.tags.length ? `タグ: ${article.tags.join(', ')}` : '',
  ].filter(Boolean).join('\n');
  return `${head}\n\n${article.bodyMarkdown}`.trim();
}

/**
 * 公開記事をナレッジ(RAG)へ同期する。本文が薄すぎる場合は同期しない。
 * 失敗は呼び出し側で握りつぶし、記事保存自体はブロックしない方針。
 */
export async function syncBlogArticleToKnowledge(uid: string, article: BlogArticle): Promise<void> {
  if (!uid) return;
  const text = buildKnowledgeText(article);
  if (text.replace(/[#\s]/g, '').length < 20) return; // 実質本文が無い

  const ingest = useAiProfileStore.getState().ingestKnowledgeSource;
  await ingest({
    uid,
    title: article.title || '無題の記事',
    text,
    sourceFile: blogRagSourceKey(article),
  });
}
