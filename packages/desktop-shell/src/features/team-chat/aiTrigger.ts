// SEKKEIYA Chat 共同チャットでの AI 応答トリガー判定（チャット統合 Phase 1）。
//   - 1人（自分＋AIのみ）           → 'always'  常に AI が応答（実質1:1の相棒）
//   - 複数人 ＋ @AI 召喚あり          → 'mention' その発言に AI が応答
//   - 複数人 ＋ 明らかに AI 依頼っぽい → 'suggest' 「AIが回答しますか？」を提示（押下で応答）
//   - それ以外（人同士の会話）        → 'none'    AI は黙る
//
// 純粋関数。UI/送信ロジックから呼ぶ（バックエンド非依存・ユニットテスト可能）。

export type AiTriggerMode = 'always' | 'mention' | 'suggest' | 'none';

// 明示的な AI 召喚メンション（全角/半角・日本語表記ゆれを許容）。
const AI_MENTION = /(^|\s)@ai\b|＠ai|@sekkeiya|＠sekkeiya|@セケイヤ|＠セケイヤ/i;

// 依頼・質問っぽさのヒューリスティック（日本語/英語）。
const REQUEST_HINTS: RegExp[] = [
  /(して|してください|して下さい|してほしい|お願いし|頼みたい|作って|作成して|生成して|描いて|まとめて|要約して|教えて|提案して|考えて|調べて|直して|修正して|追加して|変更して|レンダリングして|3d化)/i,
  /[?？]\s*$/,
  /\b(please|can you|could you|generate|create|make|summari[sz]e|explain|fix|add|change|how (do|to))\b/i,
];

/**
 * 会話の状況から AI の応答方針を決める。
 * @param text 送信されたメッセージ本文
 * @param humanMemberCount AI を除いた人間メンバー数（自分含む）
 */
export function decideAiTrigger(text: string, humanMemberCount: number): AiTriggerMode {
  const t = (text || '').trim();
  if (!t) return 'none';
  // 自分＋AI だけ（人間が1人）＝常に応答。
  if (humanMemberCount <= 1) return 'always';
  // 明示的な @AI 召喚が最優先。
  if (AI_MENTION.test(t)) return 'mention';
  // 依頼・質問っぽければサジェスト（押すまで AI は答えない）。
  if (REQUEST_HINTS.some((re) => re.test(t))) return 'suggest';
  return 'none';
}

/** 送信前に @AI メンション部分を取り除いた本文（保存・プロンプト用）。 */
export function stripAiMention(text: string): string {
  return (text || '').replace(AI_MENTION, ' ').replace(/\s{2,}/g, ' ').trim();
}
