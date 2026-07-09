import { create } from 'zustand';

export type DslContentTab = 'ALL' | 'Base' | 'Plan' | 'Option';
export type DslPlanType = 'base' | 'plan' | 'option';
export type DslQuality = 'standard' | 'cycles';
export type DslSortBy = 'newest' | 'oldest' | 'name';

interface DslFilterState {
  contentTab: DslContentTab;
  planTypes: DslPlanType[];
  qualities: DslQuality[];
  sortBy: DslSortBy;
  selectedRender: any | null;

  setContentTab: (tab: DslContentTab) => void;
  togglePlanType: (type: DslPlanType) => void;
  toggleQuality: (q: DslQuality) => void;
  setSortBy: (s: DslSortBy) => void;
  setSelectedRender: (render: any | null) => void;
  reset: () => void;
}

export const useDslFilterStore = create<DslFilterState>((set) => ({
  contentTab: 'Plan',
  planTypes: [],
  qualities: [],
  sortBy: 'newest',
  selectedRender: null,

  setContentTab: (contentTab) => set({ contentTab, selectedRender: null }),
  togglePlanType: (type) => set((s) => ({
    planTypes: s.planTypes.includes(type)
      ? s.planTypes.filter((t) => t !== type)
      : [...s.planTypes, type],
  })),
  toggleQuality: (q) => set((s) => ({
    qualities: s.qualities.includes(q)
      ? s.qualities.filter((x) => x !== q)
      : [...s.qualities, q],
  })),
  setSortBy: (sortBy) => set({ sortBy }),
  setSelectedRender: (selectedRender) => set({ selectedRender }),
  reset: () => set({ planTypes: [], qualities: [], sortBy: 'newest' }),
}));
