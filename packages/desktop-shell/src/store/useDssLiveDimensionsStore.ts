import { create } from 'zustand';

export interface LiveDimensions {
  width: number;
  depth: number;
  height: number;
  /**
   * GLB の向き補正（Y 軸回りの度数、0 or 90）。W⇄D と対で変わるため、寸法と一緒に
   * 即時反映しないと、入れ替えた瞬間だけモデルが変形して見える。
   */
  yawDeg?: number;
}

// Model Info パネルで編集中の寸法 (mm) を、保存を待たずに
// 3Dビューワ（右パネル/詳細画面）へ即時反映するための共有ストア
interface DssLiveDimensionsState {
  liveDimensions: Record<string, LiveDimensions>;
  setLiveDimensions: (modelId: string, dims: LiveDimensions | null) => void;
}

export const useDssLiveDimensionsStore = create<DssLiveDimensionsState>((set) => ({
  liveDimensions: {},
  setLiveDimensions: (modelId, dims) =>
    set((state) => {
      const next = { ...state.liveDimensions };
      if (dims) {
        next[modelId] = dims;
      } else {
        delete next[modelId];
      }
      return { liveDimensions: next };
    }),
}));
