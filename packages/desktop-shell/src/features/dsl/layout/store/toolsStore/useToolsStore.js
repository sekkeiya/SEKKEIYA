// src/store/toolsStore/useToolsStore.js
import { create } from "zustand";

export const useToolsStore = create((set, get) => ({
    // =========================
    // Tool UI states
    // =========================
    mode: "translate", // translate | rotate | scale
    space: "world", // world | local
    snapEnabled: false,
    materialPicking: false,
    showFurnitureDimensions: false,
    showFurnitureGapDimensions: false,
    showItemDimensions: false,

    setMode: (mode) => set({ mode }),
    setSpace: (space) => set({ space }),
    toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
    setSnapEnabled: (v) => set({ snapEnabled: Boolean(v) }),

    toggleMaterialPicker: () => set((s) => ({ materialPicking: !s.materialPicking })),
    setMaterialPicking: (v) => set({ materialPicking: Boolean(v) }),

    toggleFurnitureDimensions: () => set((s) => ({ showFurnitureDimensions: !s.showFurnitureDimensions })),
    setShowFurnitureDimensions: (v) => set({ showFurnitureDimensions: Boolean(v) }),

    toggleFurnitureGapDimensions: () => set((s) => ({ showFurnitureGapDimensions: !s.showFurnitureGapDimensions })),
    setShowFurnitureGapDimensions: (v) => set({ showFurnitureGapDimensions: Boolean(v) }),

    toggleItemDimensions: () => set((s) => ({ showItemDimensions: !s.showItemDimensions })),
    setShowItemDimensions: (v) => set({ showItemDimensions: Boolean(v) }),

    // =========================
    // Workspace UI states
    // =========================
    dirty: false,
    saving: false,
    setDirty: (dirty) => set({ dirty: Boolean(dirty) }),
    setSaving: (saving) => set({ saving: Boolean(saving) }),



    // =========================
    // Commands (registered by upper layer)
    // =========================
    commands: {
        save: null,
        undo: null,
        redo: null,
    },

    // ✅ 受け取った関数を保存（部分更新でOK）
    setCommands: (patch) =>
        set((s) => ({
            commands: { ...(s.commands || {}), ...(patch || {}) },
        })),

    // ✅ ToolButtons が呼ぶ “共通アクション”
    save: async () => {
        const fn = get().commands?.save;
        if (typeof fn === "function") return await fn();
    },
    undo: () => {
        const fn = get().commands?.undo;
        if (typeof fn === "function") fn();
    },
    redo: () => {
        const fn = get().commands?.redo;
        if (typeof fn === "function") fn();
    },

    // 任意：外部同期（既存）
    syncFromExternal: ({ mode, space, snapEnabled, materialPicking, showFurnitureDimensions, showFurnitureGapDimensions, showItemDimensions, dirty, saving } = {}) => {
        const next = {};
        if (mode) next.mode = mode;
        if (space) next.space = space;
        if (typeof snapEnabled === "boolean") next.snapEnabled = snapEnabled;
        if (typeof materialPicking === "boolean") next.materialPicking = materialPicking;
        if (typeof showFurnitureDimensions === "boolean") next.showFurnitureDimensions = showFurnitureDimensions;
        if (typeof showFurnitureGapDimensions === "boolean") next.showFurnitureGapDimensions = showFurnitureGapDimensions;
        if (typeof showItemDimensions === "boolean") next.showItemDimensions = showItemDimensions;
        if (typeof dirty === "boolean") next.dirty = dirty;
        if (typeof saving === "boolean") next.saving = saving;
        if (Object.keys(next).length) set(next);
    },
}));
