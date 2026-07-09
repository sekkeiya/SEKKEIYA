// Scene に存在する Object3D の実体管理専用
// itemId → Object3D
// Gizmo
// MaterialPicker
// Framing
// Selection
// Align
// 「Three.js のオブジェクトそのもの」

// src/store/sceneObjectRegistryStore.js
import { create } from "zustand";

export const useSceneObjectRegistryStore = create((set, get) => ({
    map: new Map(), // itemId -> Object3D

    register: (id, obj) => {
        if (!id) return;
        set((s) => {
            const next = new Map(s.map);
            if (obj) next.set(id, obj);
            else next.delete(id);
            return { map: next };
        });
    },

    getObject: (id) => get().map.get(id) || null,

    // MaterialPickController 用：raycast 対象配列
    getAllObjects: () => Array.from(get().map.values()).filter(Boolean),

    clear: () => set({ map: new Map() }),
}));
