/**
 * articleToLibrary — SEKKEIYA Reader で表示中の記事を S.Library へワンクリック登録する。
 *
 * ブックマーク・ブリッジ（bookmarkBridge.ts）と同じ登録パイプライン
 * （ルール分類 → 保存 → 原文HTMLスナップショット → 弱分類のみAI後段補完）に乗せるが、
 * リーダーは**翻訳済み本文ブロック（画像・動画の参照込み）**を持っているので、
 * URLだけでなく読んだままの本文を Markdown として bodyMarkdown に保存する。
 * → S.Library 側で RAG / 要約 / 検索の材料になり「第二の脳」に直接効く。
 *
 * 画像・動画は元記事のURL参照として Markdown に埋め込む（実体ダウンロードは
 * スナップショット assets 同梱 = docs/11 Phase B で対応予定）。
 */
import { saveKnowledgeEntry, saveUrlSnapshot, getLocalKnowledge } from '../../dsk/api/knowledgeApi';
import { classifyKnowledge } from '../../dsk/lib/ruleClassify';
import { autoEnrichInBackground } from '../../dsk/lib/autoEnrich';
import { isWeakCategory } from '../../dsk/types';
import { useDskStore } from '../../dsk/store/useDskStore';
import type { LibraryEntry } from '../../dsk/types';
import type { BlogSourceRef } from '../types';
import type { ReaderBlock } from '../SourceArticleReader';

const uuid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`);

/** 記事が S.Library に追加されたことを全ウィンドウへ知らせるイベント名（payload: { url }）。 */
export const LIBRARY_ADDED_EVENT = 'sblog-library-added';

/** リーダーの本文ブロック列を S.Library 保存用 Markdown に変換する。 */
export function blocksToMarkdown(source: BlogSourceRef, blocks: ReaderBlock[], translated: boolean): string {
  const lines: string[] = [
    `# ${source.title}`,
    '',
    `> 出典: ${source.source ? `${source.source} — ` : ''}${source.url}${translated ? '（日本語訳）' : ''}`,
    '',
  ];
  for (const b of blocks) {
    if (b.t === 'h') lines.push(`## ${b.text}`, '');
    else if (b.t === 'p') lines.push(b.text, '');
    else if (b.t === 'img') lines.push(`![](${b.src})`, '');
    else if (b.t === 'video') lines.push(`[▶ 動画](${b.src})`, '');
  }
  return lines.join('\n');
}

/** この記事が S.Library に登録済みなら該当エントリを返す（URL照合）。 */
export async function findLibraryEntryByUrl(url: string): Promise<LibraryEntry | null> {
  try {
    const entries = await getLocalKnowledge();
    return entries.find((e) => (e.sourceUrl || '').trim() === url.trim()) || null;
  } catch {
    return null; // Web版など
  }
}

/**
 * 表示中の記事を S.Library に登録する。
 * - kind='url'（Web記事）として、翻訳済み本文 Markdown・出典URL・媒体名を保存
 * - ルール分類でカテゴリ/タグを即時付与、分類しきれなければ AI 後段で補完
 * - 原文ページの HTML スナップショットも best-effort で保存（レイアウト・画像の原本）
 */
export async function saveArticleToLibrary(args: {
  source: BlogSourceRef;
  blocks: ReaderBlock[];
  translated: boolean;
}): Promise<LibraryEntry> {
  const { source, blocks, translated } = args;
  const title = (source.title || source.url).trim();

  // 分類材料は本文テキスト全部（ルール照合は軽い）
  const plainText = blocks.map((b) => (b.t === 'p' || b.t === 'h' ? b.text : '')).join('\n');
  const r = classifyKnowledge({ fileName: title, text: plainText });
  const category = r.matched ? r.category : 'その他';
  const tags = [...(r.matched ? r.tags : [])];
  if (source.source && !tags.includes(source.source)) tags.push(source.source);

  const localId = uuid();
  const entry = await saveKnowledgeEntry({
    localId,
    kind: 'url',
    title,
    category,
    author: source.source || null,
    tags,
    sourceUrl: source.url.trim(),
    bodyMarkdown: blocksToMarkdown(source, blocks, translated),
  });
  useDskStore.getState().upsert(entry);

  // 原文 HTML スナップショット（best-effort）→ 反映のため再読込
  try {
    await saveUrlSnapshot(localId, source.url.trim());
    await useDskStore.getState().refresh();
  } catch (e) {
    console.warn('[articleToLibrary] snapshot failed (best-effort)', e);
  }

  // ルールで分類しきれなかったものだけ AI 後段補完（fire-and-forget）
  if (isWeakCategory(category)) {
    void autoEnrichInBackground(entry);
  }

  // 全ウィンドウへ通知（ホームのフィードが「追加済み」バッジを即時反映するため）
  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(LIBRARY_ADDED_EVENT, { url: source.url.trim() });
  } catch { /* Web版など */ }

  return entry;
}
