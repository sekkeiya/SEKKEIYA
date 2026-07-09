// S.Library (3DSK) — ハイブリッド自動分類の「後段」。
//
// 追加時はまず ruleClassify（完全ローカル・即時）でカテゴリ/タグを付ける。
// ルールで分類しきれない（= その他のまま）「様々な内容のデータ」については、
// ここでバックグラウンドに AI（Cloud Function summarizeKnowledge）へ本文を渡し、
// カテゴリ・タグ・要約を補完する。AI が付ける新カテゴリは自由文字列なので、
// listKnownCategories 経由でそのまま選択肢へ自動合流していく。
//
// Cloud Function 未デプロイ時やオフライン時は静かに無視する（鳴らない後段）。

import { summarizeEntry } from './summarize';
import { useDskStore } from '../store/useDskStore';
import { isWeakCategory, type LibraryEntry } from '../types';

/**
 * 追加直後のエントリをバックグラウンドで AI 精緻化する（fire-and-forget 前提）。
 * - 要約・キーポイントは常に取り込む（検索 / RAG / 設計提案に効く）。
 * - カテゴリは「弱い（その他/未分類/空）」ときのみ AI の提案で上書き（ルールの確信を尊重）。
 * - タグは既存とマージ（重複排除）。
 * 失敗は握りつぶす（呼び出し側へは投げない）。
 */
export async function autoEnrichInBackground(entry: LibraryEntry): Promise<void> {
  // 社外秘（S_Library 由来）や未登録ローカルファイルはクラウド送信しない。
  if (entry.isConfidential || entry.isLocalFile) return;
  try {
    const result = await summarizeEntry(entry);
    const { patch, entries } = useDskStore.getState();
    // 追加後にユーザーが編集している可能性があるので最新を取り直す。
    const fresh = entries.find((e) => e.localId === entry.localId) ?? entry;

    const mergedTags = Array.from(
      new Set([...(fresh.tags ?? []), ...(result.suggestedTags ?? [])]),
    );
    const nextCategory =
      isWeakCategory(fresh.category) && result.suggestedCategory
        ? result.suggestedCategory
        : fresh.category;

    await patch({
      ...fresh,
      summary: result.summary ?? fresh.summary ?? null,
      keyPoints: result.keyPoints ?? fresh.keyPoints ?? [],
      tags: mergedTags,
      category: nextCategory,
    });
  } catch (e) {
    // summarizeKnowledge 未デプロイ等は想定内。静かに諦める。
    console.debug('[autoEnrich] skipped (AI unavailable)', e);
  }
}
