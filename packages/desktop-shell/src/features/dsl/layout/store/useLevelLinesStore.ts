// useLevelLinesStore — 俯瞰ビューでの GL/各階FL レベル線（表示専用）の ON/OFF。
// 「断面で高さを設定」モード(useHeightSetupStore.active)では従来どおりドラッグ編集可能な
// レベル線を出す。こちらは通常の俯瞰ビューに“表示専用”で重ねるかどうかのフラグ。
import { create } from "zustand";

interface LevelLinesStore {
  overviewVisible: boolean;
  setOverviewVisible: (v: boolean) => void;
  toggleOverview: () => void;
}

export const useLevelLinesStore = create<LevelLinesStore>((set) => ({
  overviewVisible: true,
  setOverviewVisible: (overviewVisible) => set({ overviewVisible }),
  toggleOverview: () => set((s) => ({ overviewVisible: !s.overviewVisible })),
}));
