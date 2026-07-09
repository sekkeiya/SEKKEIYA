// S.Blog dual-publish ②(可視化) — 公開記事を S.Library の LibraryEntry として登録/更新する。
// 目的: 公開した記事を S.Library 一覧に「知識資源」として表示し、横断管理・RAG接続の起点にする。
// S.Library はデスクトップ(ローカル)前提のため isTauri ガード。記事の正本は Firestore(blogArticles)、
// ここで作るのはローカルの可視化ミラー（kind=note）。再公開時は libraryEntryId で同一エントリを更新。
import { isTauri } from '@tauri-apps/api/core';
import { saveKnowledgeEntry, updateKnowledgeEntry, getLocalKnowledge } from '../../dsk/api/knowledgeApi';
import { useDskStore } from '../../dsk/store/useDskStore';
import type { BlogArticle } from '../types';

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

/**
 * 公開記事を S.Library に登録/更新し、対応する LibraryEntry の localId を返す。
 * デスクトップ以外、または失敗時は null を返す（呼び出し側は記事保存を継続）。
 */
export async function syncBlogArticleToLibrary(article: BlogArticle): Promise<string | null> {
  if (!isTauri()) return null; // S.Library はローカル(デスクトップ)のみ

  const title = article.title || '無題の記事';
  const body = article.bodyMarkdown || '';
  const category = article.category || 'その他';
  const tags = article.tags || [];

  // 既存エントリがあれば更新（再公開で重複させない）。
  if (article.libraryEntryId) {
    try {
      const all = await getLocalKnowledge();
      const existing = all.find((e) => e.localId === article.libraryEntryId);
      if (existing) {
        const updated = await updateKnowledgeEntry({
          ...existing,
          title,
          bodyMarkdown: body,
          category,
          tags,
          updatedAt: new Date().toISOString(),
        });
        useDskStore.getState().upsert(updated);
        return updated.localId;
      }
    } catch (e) {
      console.warn('[blogLibrarySync] update failed, will recreate', e);
    }
  }

  // 新規作成（kind=note：既存 S.Library UI で安全に表示できる）。
  const localId = uuid();
  const entry = await saveKnowledgeEntry({
    localId,
    kind: 'note',
    title,
    category,
    tags,
    bodyMarkdown: body,
  });
  useDskStore.getState().upsert(entry);
  return entry.localId;
}
