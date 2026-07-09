// S.Library (3DSK) — 選択した知識エントリを SEKKEIYA Chat のナレッジ (RAG) へ取り込む。
//
// AI Studio の「ナレッジ (RAG)」（useAiProfileStore.ingestKnowledgeSource →
// Cloud Function `ingestKnowledge`）と同じ経路を再利用する。ローカルの PDF /
// テキストファイルを読み、テキスト抽出（図面・スキャンは OCR 画像も同送）して
// 埋め込みを生成する。これにより S.Library に並ぶローカル資料を、その場で
// AI の判断根拠（RAG）として接続できる。

import { readLocalBinaryFile, fetchUrlContent } from '../api/knowledgeApi';
import { extractPdfTextWithMeta, renderPdfPagesForOcr } from '../../dsf/lib/pdf';
import { useAiProfileStore, type KnowledgeSource } from '../../../store/useAiProfileStore';
import type { LibraryEntry } from '../types';

/** RAG 取り込みの照合・表示に使うソースファイル識別子。 */
export function ragSourceKey(entry: LibraryEntry): string {
  return entry.relPath || entry.filePath || entry.title;
}

/** 既存ナレッジに同一ソースが取り込み済みか判定する。
 *  取り込み中/失敗のテンポラリソース（status 'ingesting'/'error'）は「追加済み」と
 *  みなさない（失敗しても追加済み表示になる誤検知を防ぐ）。 */
export function isEntryIngested(entry: LibraryEntry, sources: KnowledgeSource[]): boolean {
  const key = ragSourceKey(entry);
  return sources.some(
    (s) => (s.status == null || s.status === 'ready') &&
      ((!!s.sourceFile && s.sourceFile === key) || s.title === entry.title),
  );
}

/**
 * エントリをナレッジ (RAG) へ取り込む。
 * - PDF/書籍: ローカル PDF を読み、テキスト抽出（テキスト層が乏しければ OCR 画像も同送）
 * - メモ: bodyMarkdown を本文として送る
 * - 法令: law.json（条文構造）を条単位ヘッダ付きで平文化して送る（出典が常に残る）
 * - その他テキストファイル: バイト列を UTF-8 デコード
 */
export async function ingestEntryToRag(
  entry: LibraryEntry,
  uid: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  const ingest = useAiProfileStore.getState().ingestKnowledgeSource;
  const path = entry.filePath || '';
  const isPdf =
    entry.kind === 'book' || entry.kind === 'pdf' || path.toLowerCase().endsWith('.pdf');

  let text = '';
  let images: { data: string; mimeType: string }[] | undefined;

  if (entry.kind === 'law') {
    onProgress?.('条文を読み込み中…');
    const { loadLawDoc, buildLawRagText } = await import('../law/lawImport');
    const doc = await loadLawDoc(entry);
    text = buildLawRagText(doc);
  } else if (path) {
    onProgress?.('ファイルを読み込み中…');
    const bytes = await readLocalBinaryFile(path);
    const buf = new Uint8Array(bytes).buffer;
    if (isPdf) {
      onProgress?.('PDFからテキストを抽出中…');
      const meta = await extractPdfTextWithMeta(buf);
      text = meta.text;
      // テキスト層が乏しい（図面/スキャン）PDF はページ画像も渡してサーバ側で OCR。
      const sparse = text.trim().length < Math.max(300, 250 * meta.pageCount);
      if (sparse) {
        onProgress?.('図面とみてOCRで読み取り中…');
        try {
          images = await renderPdfPagesForOcr(buf);
        } catch {
          /* OCR 画像化失敗はテキストのみで続行 */
        }
      }
    } else {
      text = new TextDecoder().decode(new Uint8Array(bytes));
    }
  } else if (entry.bodyMarkdown) {
    text = entry.bodyMarkdown;
  } else if (entry.sourceUrl) {
    // url（Web）エントリ: 本文を取得してテキスト化（CORS回避は Tauri 側 fetch_url_content）。
    // 応答しないサイトで無限ローディングにならないよう 25 秒でタイムアウトさせる。
    onProgress?.('URLの本文を取得中…');
    try {
      const withTimeout = <T,>(p: Promise<T>, ms: number) =>
        Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('URL取得がタイムアウトしました')), ms))]);
      const c = await withTimeout(fetchUrlContent(entry.sourceUrl), 25000);
      text = `${c.title || entry.title}\n\n${c.text || ''}`.trim();
    } catch (e) {
      console.warn('[ragIngest] fetchUrlContent failed', e);
    }
  }

  if (text.trim().length < 20 && (!images || images.length === 0)) {
    throw new Error('テキストを抽出できませんでした');
  }

  onProgress?.('埋め込みを生成中…');
  await ingest({ uid, title: entry.title, text, sourceFile: ragSourceKey(entry), images });
}
