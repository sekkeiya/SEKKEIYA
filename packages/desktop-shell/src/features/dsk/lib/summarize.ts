// Phase C — AI要約パイプライン（クライアント側）。
// 実体の要約は Firebase Cloud Function `summarizeKnowledge`（別リポの functions に要デプロイ）が行う。
// 入力: { kind, title, text } / 出力: { summary, keyPoints, suggestedTags, suggestedCategory }
// 著作権配慮のため text は要約のために一時送信されるのみ（ユーザー承認済の方針）。
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase/client';
import type { LibraryEntry } from '../types';
import { fetchUrlContent } from '../api/knowledgeApi';
import { extractPdfText } from './pdfText';

export interface SummarizeResult {
  summary: string;
  keyPoints: string[];
  suggestedTags?: string[];
  suggestedCategory?: string;
}

/** エントリ種別に応じて要約対象テキストを用意する */
async function buildText(entry: LibraryEntry): Promise<string> {
  if (entry.kind === 'note') return entry.bodyMarkdown || '';
  if (entry.kind === 'url') {
    if (!entry.sourceUrl) return '';
    const content = await fetchUrlContent(entry.sourceUrl);
    return content.text;
  }
  // book / pdf
  if (entry.filePath) return extractPdfText(entry.filePath);
  return '';
}

/**
 * エントリを AI 要約する。Cloud Function `summarizeKnowledge` を呼ぶ。
 * 関数が未デプロイの場合はエラーを投げるので、呼び出し側でハンドリングすること。
 */
export async function summarizeEntry(entry: LibraryEntry): Promise<SummarizeResult> {
  const text = await buildText(entry);
  if (!text.trim()) {
    throw new Error('要約対象のテキストを取得できませんでした。');
  }
  const fn = httpsCallable<{ kind: string; title: string; text: string }, SummarizeResult>(
    functions,
    'summarizeKnowledge',
  );
  const res = await fn({ kind: entry.kind, title: entry.title, text });
  return res.data;
}
