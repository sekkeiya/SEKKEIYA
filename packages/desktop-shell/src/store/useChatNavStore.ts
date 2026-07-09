// src/store/useChatNavStore.ts
// リロード／パネルを閉じて再度開いたときに「前回開いていたチャット」を復元するための
// 最小ナビ状態を永続化する。
// - activeSessionId（アカウント/マイPのチャット本体）は useAIChatStore が永続化済み。
// - ここでは選択の文脈（コックピットのタブ・アクティブプロジェクト・チームトピック）だけを保持する。
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ChatNavState {
  /** 最後に開いていたコックピットのタブ（'chat' | 'drive' | 'teamchat' | 'render' | 'gen3d'）。 */
  lastTab: string | null;
  /** 最後に開いていたチャットのプロジェクト（null = アカウントサイト）。 */
  lastProjectId: string | null;
  /** 最後に開いていたチームチャットのトピック（メインチャットは null）。 */
  lastTopicId: string | null;
  setLastChatNav: (v: { tab: string; projectId: string | null; topicId: string | null }) => void;
}

export const useChatNavStore = create<ChatNavState>()(
  persist(
    (set) => ({
      lastTab: null,
      lastProjectId: null,
      lastTopicId: null,
      setLastChatNav: ({ tab, projectId, topicId }) =>
        set({ lastTab: tab, lastProjectId: projectId, lastTopicId: topicId }),
    }),
    { name: 'sekkeiya-chat-nav' },
  ),
);
