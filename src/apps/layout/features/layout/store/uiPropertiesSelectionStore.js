// PropertiesPanel に表示する対象を管理する
// いま「アイテム（家具）」を表示しているのか？
// いま「マテリアル」を表示しているのか？
// これを selection という1つの変数で持ちます。

import { create } from "zustand";

export const useUiPropertiesSelectionStore = create((set) => ({
    selection: null,
    setSelection: (selection) => set({ selection }),
    selectItem: (id) => set({ selection: id ? { kind: "item", id } : null }),
    selectMaterial: (payload) =>
        set({ selection: payload ? { kind: "material", ...payload } : null }),

    clearSelection: () => set({ selection: null }),
}))