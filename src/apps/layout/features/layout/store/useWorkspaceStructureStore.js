// src/store/useWorkspaceStructureStore.js
import { create } from "zustand";

export const useWorkspaceStructureStore = create((set, get) => ({
    // ===== data =====
    bases: [],
    plansOfSelectedBase: [],
    options: [],
    optionsLoading: false,

    // ===== selection =====
    selectedBaseId: null,
    selectedPlanId: null,
    selectedOptionId: null,

    // ===== busy =====
    creatingBase: false,
    creatingPlan: false,
    creatingOption: false,
    deletingBase: false,
    deletingPlan: false,
    deletingOption: false,
    duplicatingBase: false,
    duplicatingPlan: false,
    duplicatingOption: false,

    // ===== confirm =====
    confirm: { open: false, type: null, targetId: "", title: "", description: "", busy: false },

    openConfirm: ({ type, targetId, title, description }) =>
        set({ confirm: { open: true, type, targetId, title, description, busy: false } }),

    closeConfirm: () =>
        set({ confirm: { open: false, type: null, targetId: "", title: "", description: "", busy: false } }),

    // ✅ LayoutShell から同期（data/flags/ids）
    hydrate: (patch) => set((prev) => ({ ...prev, ...patch })),

    // ✅ LayoutShell の “実体関数” を bind する置き場
    external: {
        // selection
        onSelectBase: null,
        onSelectPlan: null,
        onSelectOption: null,

        // crud
        onCreateBase: null,
        onCreatePlan: null,
        onCreateOption: null,
        onDeleteBase: null,
        onDeletePlan: null,
        onDeleteOption: null,
        onDuplicateBase: null,
        onDuplicatePlan: null,
        onDuplicateOption: null,
    },

    // ✅ まとめて bind（必要なものだけ渡してOK）
    bindExternal: (patch = {}) =>
        set((prev) => ({
            ...prev,
            external: {
                ...prev.external,
                ...patch,
            },
        })),

    // ===== actions =====
    // ✅ selection（store更新 + LayoutShell実体も呼ぶ）
    selectBase: (baseId) => {
        if (!baseId) return;
        set({ selectedBaseId: baseId, selectedPlanId: null, selectedOptionId: null });
        get().external?.onSelectBase?.(baseId);
    },

    selectPlan: (planId) => {
        if (!planId) return;
        set({ selectedPlanId: planId, selectedOptionId: null });
        get().external?.onSelectPlan?.(planId);
    },

    selectOption: (optionId) => {
        if (!optionId) return;
        set({ selectedOptionId: optionId });
        get().external?.onSelectOption?.(optionId);
    },

    // ✅ CRUD（Menus が見ている “onCreateX / onDeleteX” を store から提供）
    // ※ busy flags は LayoutShell の hydrate を信頼（Step1）
    createBase: async () => {
        const fn = get().external?.onCreateBase;
        return fn ? await fn() : null;
    },

    createPlan: async (baseId) => {
        const fn = get().external?.onCreatePlan;
        return fn ? await fn(baseId) : null;
    },

    createOption: async ({ baseId, planId } = {}) => {
        const fn = get().external?.onCreateOption;
        return fn ? await fn({ baseId, planId }) : null;
    },

    deleteBase: async (baseId) => {
        const fn = get().external?.onDeleteBase;
        return fn ? await fn(baseId) : null;
    },

    deletePlan: async (planId) => {
        const fn = get().external?.onDeletePlan;
        return fn ? await fn(planId) : null;
    },

    deleteOption: async (optionId) => {
        const fn = get().external?.onDeleteOption;
        return fn ? await fn(optionId) : null;
    },

    duplicateBase: async (baseId) => {
        const fn = get().external?.onDuplicateBase;
        return fn ? await fn(baseId) : null;
    },

    duplicatePlan: async (planId) => {
        const fn = get().external?.onDuplicatePlan;
        return fn ? await fn(planId) : null;
    },

    duplicateOption: async (optionId) => {
        const fn = get().external?.onDuplicateOption;
        return fn ? await fn(optionId) : null;
    },
}));
