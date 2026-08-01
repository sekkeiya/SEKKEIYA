import { create } from 'zustand';
import type { OverrideChainEntry } from '../utils/planModelOverrides';

/**
 * 現在開いているプランの上書きチェーン（現在の layout → 親 Plan → Base の順）。
 * usePlanModelOverridesSync が Firestore 購読で埋め、FurnitureItem（ウォークスルー候補の
 * 絞り込み）と PropertiesModelPanel（編集 UI）が読む。揮発・表示用（Firestore が正）。
 */
interface PlanModelOverridesState {
  chain: OverrideChainEntry[];
  setChain: (chain: OverrideChainEntry[]) => void;
  clear: () => void;
}

export const usePlanModelOverridesStore = create<PlanModelOverridesState>((set) => ({
  chain: [],
  setChain: (chain) => set({ chain }),
  clear: () => set({ chain: [] }),
}));
