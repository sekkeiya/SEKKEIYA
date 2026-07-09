// スクロールスパイ（表示中セクション）の専用ストア。
// キャンバス本体は購読せず、サイドバーの目次だけが購読する。
// → セクション境界をまたぐたびに重いセクション群を再レンダーしない（カクつき防止）。

import { create } from 'zustand';

interface ScrollSpyState {
  activeSectionId: string | null;
  setActiveSectionId: (id: string | null) => void;
}

export const useScrollSpyStore = create<ScrollSpyState>((set) => ({
  activeSectionId: null,
  setActiveSectionId: (id) => set((s) => (s.activeSectionId === id ? s : { activeSectionId: id })),
}));
