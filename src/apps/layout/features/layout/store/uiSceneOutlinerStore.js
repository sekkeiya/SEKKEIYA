// アウトライナーはツリー構造なので、
// 各ノード（item / group など）を「開く/閉じる」状態が必要
// expanded：開いてるノード一覧（ID → true/false）
// setExpanded(next)：開閉状態をまとめて更新
// resetExpanded()：全部閉じる（空に戻す）

import { create } from "zustand";

function toArray(v) {
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    if (v instanceof Set) return Array.from(v);
    return [];
}

export const useUiSceneOutlinerStore = create((set) => ({
    // ✅ SceneOutlinerPanel は expandedItems.forEach を使うので配列
    // 例: ["scene:root", "scene:items", "item:xxx"]
    expanded: [],

    setExpanded: (next) => set({ expanded: toArray(next) }),

    resetExpanded: () => set({ expanded: [] }),

    toggleExpanded: (id) =>
        set((s) => {
            if (!id) return s; // ✅ ガード（null/undefined/""）
            const cur = Array.isArray(s.expanded) ? s.expanded : [];
            const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
            return { expanded: next };
        }),

    expandAll: (ids) => set({ expanded: toArray(ids) }),

    collapseAll: () => set({ expanded: [] }),
}));
