// Project Chat の会話ターゲット（誰とのチャットか）の状態。
// LINE のトーク選択に相当する。null = 未選択（選択画面を表示）。

import { create } from 'zustand';

export type ChatTarget =
  | { kind: 'project'; id: string; name: string; topicId?: string }                 // id = projectId、topicId 未指定=「一般」(chatMessages)
  | { kind: 'team'; id: string; name: string; memberIds: string[] }                 // id = teamId
  | { kind: 'dm'; id: string; name: string; photoURL?: string; otherUid: string };  // id = chats/{chatId}

interface TeamChatState {
  target: ChatTarget | null;
  setTarget: (target: ChatTarget | null) => void;
}

export const useTeamChatStore = create<TeamChatState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}));
