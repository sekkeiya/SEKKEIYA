import { create } from "zustand";

interface UiSelectionState {
  selectedItemIds: string[];
  setSelectedItemIds: (ids: (string | null | undefined)[]) => void;
  setSelectedItemId: (id: string | null) => void;
  clearSelection: () => void;
}

const toIds = (ids: (string | null | undefined)[]): string[] => (Array.isArray(ids) ? ids.filter((id): id is string => Boolean(id)) : []);

export const useUiSelectionStore = create<UiSelectionState>((set) => ({
  selectedItemIds: [],

  setSelectedItemIds: (ids) => set({ selectedItemIds: toIds(ids) }),
  setSelectedItemId: (id) => set({ selectedItemIds: id ? [id] : [] }),
  clearSelection: () => set({ selectedItemIds: [] }),
}));

// ✅ 互換用 selector（どこでも使える）
export const selectPrimarySelectedItemId = (s: UiSelectionState) => s.selectedItemIds[0] ?? null;
