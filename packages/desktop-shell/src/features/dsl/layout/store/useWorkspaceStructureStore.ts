import { create } from "zustand";

export type StructureNodeType = "base" | "plan" | "option" | "layout";

export interface StructureNode {
  id: string;
  name?: string;
  planType?: string;
  rootBaseId?: string | null;
  parentPlanId?: string | null;
  [key: string]: unknown;
}

export interface WorkspaceConfirmState {
  open: boolean;
  type: StructureNodeType | null;
  targetId: string;
  title: string;
  description: string;
  busy: boolean;
}

export interface WorkspaceStructureExternal {
  // selection
  onSelectBase?: ((id: string) => void) | null;
  onSelectPlan?: ((id: string) => void) | null;
  onSelectOption?: ((id: string) => void) | null;

  // crud
  onCreateBase?: (() => unknown) | null;
  onCreatePlan?: ((baseId: string) => unknown) | null;
  onCreateOption?: ((payload: { baseId: string; planId: string }) => unknown) | null;
  onDeleteBase?: ((id: string) => unknown) | null;
  onDeletePlan?: ((id: string) => unknown) | null;
  onDeleteOption?: ((id: string) => unknown) | null;
  onDuplicateBase?: ((id: string) => unknown) | null;
  onDuplicatePlan?: ((id: string) => unknown) | null;
  onDuplicateOption?: ((id: string) => unknown) | null;

  // legacy flat layout handlers (kept for back-compat)
  onSelectLayout?: ((id: string) => void) | null;
  onCreateLayout?: (() => unknown) | null;
  onDeleteLayout?: ((id: string) => unknown) | null;
  onDuplicateLayout?: ((id: string) => unknown) | null;

  // navigation
  onGoToDashboard?: (() => void) | null;
  // ダッシュボードから Base を開く（最後の Plan / 先頭 Plan を自動解決して開く）
  onOpenLayout?: ((baseId: string) => void) | null;
}

export interface WorkspaceStructureState {
  // ===== data =====
  bases: StructureNode[];
  plansOfSelectedBase: StructureNode[];
  options: StructureNode[];
  optionsLoading: boolean;

  // legacy flat data
  layouts: StructureNode[];
  layoutsLoading: boolean;

  // ===== selection =====
  selectedBaseId: string | null;
  selectedPlanId: string | null;
  selectedOptionId: string | null;
  selectedLayoutId: string | null;

  // ===== busy flags =====
  creatingBase: boolean;
  creatingPlan: boolean;
  creatingOption: boolean;
  deletingBase: boolean;
  deletingPlan: boolean;
  deletingOption: boolean;
  duplicatingBase: boolean;
  duplicatingPlan: boolean;
  duplicatingOption: boolean;

  creatingLayout: boolean;
  deletingLayout: boolean;
  duplicatingLayout: boolean;

  // ===== confirm =====
  confirm: WorkspaceConfirmState;
  openConfirm: (payload: { type: StructureNodeType; targetId: string; title: string; description: string }) => void;
  closeConfirm: () => void;

  hydrate: (patch: Partial<WorkspaceStructureState>) => void;

  external: WorkspaceStructureExternal;
  bindExternal: (patch?: Partial<WorkspaceStructureExternal>) => void;

  // ===== selection actions =====
  selectBase: (baseId: string | null) => void;
  selectPlan: (planId: string | null) => void;
  selectOption: (optionId: string | null) => void;
  selectLayout: (layoutId: string | null) => void;

  // ===== crud actions =====
  createBase: () => Promise<unknown>;
  createPlan: (baseId: string) => Promise<unknown>;
  createOption: (payload: { baseId: string; planId: string }) => Promise<unknown>;
  deleteBase: (baseId: string) => Promise<unknown>;
  deletePlan: (planId: string) => Promise<unknown>;
  deleteOption: (optionId: string) => Promise<unknown>;
  duplicateBase: (baseId: string) => Promise<unknown>;
  duplicatePlan: (planId: string) => Promise<unknown>;
  duplicateOption: (optionId: string) => Promise<unknown>;

  createLayout: () => Promise<unknown>;
  deleteLayout: (layoutId: string) => Promise<unknown>;
  duplicateLayout: (layoutId: string) => Promise<unknown>;

  goToDashboard: () => void;
  openLayout: (baseId: string) => void;
}

const EMPTY_CONFIRM: WorkspaceConfirmState = {
  open: false,
  type: null,
  targetId: "",
  title: "",
  description: "",
  busy: false,
};

export const useWorkspaceStructureStore = create<WorkspaceStructureState>((set, get) => ({
  // ===== data =====
  bases: [],
  plansOfSelectedBase: [],
  options: [],
  optionsLoading: false,

  layouts: [],
  layoutsLoading: false,

  // ===== selection =====
  selectedBaseId: null,
  selectedPlanId: null,
  selectedOptionId: null,
  selectedLayoutId: null,

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

  creatingLayout: false,
  deletingLayout: false,
  duplicatingLayout: false,

  // ===== confirm =====
  confirm: { ...EMPTY_CONFIRM },

  openConfirm: ({ type, targetId, title, description }) =>
    set({ confirm: { open: true, type, targetId, title, description, busy: false } }),

  closeConfirm: () => set({ confirm: { ...EMPTY_CONFIRM } }),

  hydrate: (patch) => set((prev) => ({ ...prev, ...patch })),

  // ===== external bridge =====
  external: {
    onSelectBase: null,
    onSelectPlan: null,
    onSelectOption: null,
    onCreateBase: null,
    onCreatePlan: null,
    onCreateOption: null,
    onDeleteBase: null,
    onDeletePlan: null,
    onDeleteOption: null,
    onDuplicateBase: null,
    onDuplicatePlan: null,
    onDuplicateOption: null,
    onSelectLayout: null,
    onCreateLayout: null,
    onDeleteLayout: null,
    onDuplicateLayout: null,
    onGoToDashboard: null,
    onOpenLayout: null,
  },

  bindExternal: (patch = {}) =>
    set((prev) => ({
      ...prev,
      external: { ...prev.external, ...patch },
    })),

  // ===== selection actions =====
  selectBase: (baseId) => {
    if (!baseId) return;
    set({ selectedBaseId: baseId });
    get().external?.onSelectBase?.(baseId);
  },
  selectPlan: (planId) => {
    if (!planId) return;
    set({ selectedPlanId: planId });
    get().external?.onSelectPlan?.(planId);
  },
  selectOption: (optionId) => {
    if (!optionId) return;
    set({ selectedOptionId: optionId });
    get().external?.onSelectOption?.(optionId);
  },
  selectLayout: (layoutId) => {
    if (!layoutId) return;
    set({ selectedLayoutId: layoutId });
    get().external?.onSelectLayout?.(layoutId);
  },

  // ===== crud actions (delegate to bound external handlers) =====
  createBase: async () => {
    const fn = get().external?.onCreateBase;
    return fn ? await fn() : null;
  },
  createPlan: async (baseId) => {
    const fn = get().external?.onCreatePlan;
    return fn ? await fn(baseId) : null;
  },
  createOption: async (payload) => {
    const fn = get().external?.onCreateOption;
    return fn ? await fn(payload) : null;
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

  // ===== legacy flat layout actions =====
  createLayout: async () => {
    const fn = get().external?.onCreateLayout;
    return fn ? await fn() : null;
  },
  deleteLayout: async (layoutId) => {
    const fn = get().external?.onDeleteLayout;
    return fn ? await fn(layoutId) : null;
  },
  duplicateLayout: async (layoutId) => {
    const fn = get().external?.onDuplicateLayout;
    return fn ? await fn(layoutId) : null;
  },

  // ===== navigation =====
  goToDashboard: () => {
    get().external?.onGoToDashboard?.();
  },
  openLayout: (baseId) => {
    if (!baseId) return;
    get().external?.onOpenLayout?.(baseId);
  },
}));
