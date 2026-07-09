import { create } from 'zustand';

// SEKKEIYA Chat の入力欄への「橋」。
// 自動化作業リスト（AI Studio の AiStudioAutomation）などの別パネルから、チャット入力欄に
// 依頼文を“挿入”するために使う。送信はしない（ユーザーが文言を直してから送れる）。
// 実体の chatText は AIChatPanel のローカル state。ここは nonce 付きの受け渡し口だけを持つ。

interface ChatComposerState {
  /** 挿入待ちのテキスト。nonce が変わるたびに AIChatPanel が一度だけ取り込む。 */
  pendingInsert: { text: string; nonce: number } | null;
  /** チャット入力欄にテキストを差し込む（送信はしない）。カタログ等から呼ぶ。 */
  insertIntoChat: (text: string) => void;
  /** AIChatPanel が取り込んだ後にクリアする。 */
  consumeInsert: () => void;
}

let nonce = 0;

export const useChatComposerStore = create<ChatComposerState>((set) => ({
  pendingInsert: null,
  insertIntoChat: (text) => set({ pendingInsert: { text, nonce: ++nonce } }),
  consumeInsert: () => set({ pendingInsert: null }),
}));
