// S.Library — チャット/UI 共通の登録アクション。
// SEKKEIYA Chat の library_* ツールと AddEntryDialog の双方から使う。
// 「調べた内容をメモとして保存」「製品ページ/電子カタログURLを登録」を 1 関数化する。

import { saveKnowledgeEntry, saveUrlSnapshot, downloadPdfToDocuments } from '../api/knowledgeApi';
import { useDskStore } from '../store/useDskStore';
import type { LibraryEntry } from '../types';

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

/** URL（製品ページ/電子カタログ等）を S.Library に登録する。 */
export async function saveUrlToLibrary(args: {
  url: string;
  title?: string;
  category?: string;
  tags?: string[];
  author?: string;      // 発信元 / メーカー名
  snapshot?: boolean;   // HTML スナップショットを保存するか（既定 true）
}): Promise<LibraryEntry> {
  const localId = uuid();
  const entry = await saveKnowledgeEntry({
    localId,
    kind: 'url',
    title: (args.title || args.url).trim(),
    category: args.category || '素材・建材',
    author: args.author || null,
    tags: args.tags || [],
    sourceUrl: args.url.trim(),
  });
  useDskStore.getState().upsert(entry);
  if (args.snapshot !== false) {
    try {
      await saveUrlSnapshot(localId, args.url.trim());
      await useDskStore.getState().refresh();
    } catch (e) {
      console.warn('[libraryActions] snapshot failed (best-effort)', e);
    }
  }
  return entry;
}

/**
 * URL から PDF カタログをダウンロードしてローカル（LocalAssets\Documents\PDF）に保存する。
 * 保存後はリフレッシュで S.Library 一覧に PDF として現れる（ローカル完結・クラウド非送信）。
 */
export async function downloadPdfToLibrary(args: { url: string; fileName?: string }): Promise<string> {
  const path = await downloadPdfToDocuments(args.url.trim(), args.fileName);
  await useDskStore.getState().refresh();
  return path;
}

/** 調査・要約した内容を Markdown メモとして S.Library に保存する。 */
export async function saveNoteToLibrary(args: {
  title: string;
  markdown: string;
  category?: string;
  tags?: string[];
}): Promise<LibraryEntry> {
  const localId = uuid();
  const entry = await saveKnowledgeEntry({
    localId,
    kind: 'note',
    title: args.title.trim(),
    category: args.category || 'その他',
    tags: args.tags || [],
    bodyMarkdown: args.markdown,
  });
  useDskStore.getState().upsert(entry);
  return entry;
}
