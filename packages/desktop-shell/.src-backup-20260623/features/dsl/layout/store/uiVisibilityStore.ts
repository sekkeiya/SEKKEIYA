import { create } from "zustand";

/**
 * Scene Outliner の 👁 トグルによる可視状態を管理するストア。
 * キーは Outliner の nodeId（例: "item:abc123", "scene:ambience"）。
 */
interface UiVisibilityState {
  /** nodeId → true のとき非表示 */
  hiddenNodeIds: Record<string, boolean>;

  /** トグル：表示⇔非表示 */
  toggleNodeVisibility: (nodeId: string) => void;

  /** 明示的に設定 */
  setNodeVisible: (nodeId: string, visible: boolean) => void;

  /** 現在の可視状態を返す */
  isNodeVisible: (nodeId: string) => boolean;

  /** 全リセット（シーン切替など） */
  resetAll: () => void;
}

export const useUiVisibilityStore = create<UiVisibilityState>((set, get) => ({
  hiddenNodeIds: {},

  toggleNodeVisibility: (nodeId) => {
    set((s) => ({
      hiddenNodeIds: {
        ...s.hiddenNodeIds,
        [nodeId]: !s.hiddenNodeIds[nodeId],
      },
    }));
  },

  setNodeVisible: (nodeId, visible) => {
    set((s) => ({
      hiddenNodeIds: {
        ...s.hiddenNodeIds,
        [nodeId]: !visible,
      },
    }));
  },

  isNodeVisible: (nodeId) => !get().hiddenNodeIds[nodeId],

  resetAll: () => set({ hiddenNodeIds: {} }),
}));
