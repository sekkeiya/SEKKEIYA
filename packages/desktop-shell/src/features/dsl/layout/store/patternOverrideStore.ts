import { create } from 'zustand';

/**
 * 見た目パターンで指定された「家具ごとの選択」。itemId → option id。
 *
 * FurnitureItem の matIndex / swapIndex はローカル state で外から書けないため、
 * この層を挟んで「オーバーライドがあれば優先」にする。ユーザーが手動でチップを選んだら
 * そのアイテムのオーバーライドは解除する（手動操作が勝つ）。
 */
interface PatternOverrideState {
  materials: Record<string, string>;
  swaps: Record<string, string>;
  setAll: (materials: Record<string, string>, swaps: Record<string, string>) => void;
  clearItem: (itemId: string) => void;
  clear: () => void;
}

export const usePatternOverrideStore = create<PatternOverrideState>((set) => ({
  materials: {},
  swaps: {},
  setAll: (materials, swaps) => set({ materials: { ...materials }, swaps: { ...swaps } }),
  clearItem: (itemId) => set((s) => {
    const materials = { ...s.materials }; delete materials[itemId];
    const swaps = { ...s.swaps }; delete swaps[itemId];
    return { materials, swaps };
  }),
  clear: () => set({ materials: {}, swaps: {} }),
}));
