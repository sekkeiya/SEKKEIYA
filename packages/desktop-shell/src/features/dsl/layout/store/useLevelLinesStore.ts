// useLevelLinesStore — 俯瞰ビューでの GL/各階FL レベル線（表示専用）の ON/OFF。
// 「断面で高さを設定」モード(useHeightSetupStore.active)では従来どおりドラッグ編集可能な
// レベル線を出す。こちらは通常の俯瞰ビューに“表示専用”で重ねるかどうかのフラグ。
import { create } from "zustand";

/** 寸法線（CL / 階高）の矢印（端部ティック）サイズ倍率の範囲と既定値。
 *  1.0 = 従来サイズ（シーン幅 × 0.03）。 */
export const DIM_ARROW_SCALE_MIN = 0.3;
export const DIM_ARROW_SCALE_MAX = 3;
export const DIM_ARROW_SCALE_DEFAULT = 1;

interface LevelLinesStore {
  overviewVisible: boolean;
  setOverviewVisible: (v: boolean) => void;
  toggleOverview: () => void;
  /** CL / 階高 の寸法線の矢印（端部）サイズ倍率。 */
  dimArrowScale: number;
  setDimArrowScale: (v: number) => void;
}

export const useLevelLinesStore = create<LevelLinesStore>((set) => ({
  overviewVisible: true,
  setOverviewVisible: (overviewVisible) => set({ overviewVisible }),
  toggleOverview: () => set((s) => ({ overviewVisible: !s.overviewVisible })),

  dimArrowScale: DIM_ARROW_SCALE_DEFAULT,
  setDimArrowScale: (v) =>
    set({
      dimArrowScale: Math.min(
        DIM_ARROW_SCALE_MAX,
        Math.max(DIM_ARROW_SCALE_MIN, Number(v) || DIM_ARROW_SCALE_DEFAULT),
      ),
    }),
}));
