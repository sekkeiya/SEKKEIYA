import { create } from "zustand";

const toIds = (ids) => (Array.isArray(ids) ? ids.filter(Boolean) : []);

export const useUiSelectionStore = create((set) => ({
    selectedItemIds: [],

    setSelectedItemIds: (ids) => set({ selectedItemIds: toIds(ids) }),
    setSelectedItemId: (id) => set({ selectedItemIds: id ? [id] : [] }),
    clearSelection: () => set({ selectedItemIds: [] }),
}));

// ✅ 互換用 selector（どこでも使える）
export const selectPrimarySelectedItemId = (s) => s.selectedItemIds[0] ?? null;
