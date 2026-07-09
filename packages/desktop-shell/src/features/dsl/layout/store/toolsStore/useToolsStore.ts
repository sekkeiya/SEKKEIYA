import { create } from "zustand";

export interface ToolsCommands {
  save: (() => Promise<any> | void) | null;
  undo: (() => void) | null;
  redo: (() => void) | null;
  autoFurnitureMaterial: ((styleKey: string) => Promise<void> | void) | null;
  autoReplaceFurniture:
    | ((styleKey: string) => Promise<{ ok: boolean; replaced: number; reason?: string } | void> | void)
    | null;
}

export interface ToolsState {
  mode: "translate" | "rotate" | "scale";
  space: "world" | "local";
  snapEnabled: boolean;
  materialPicking: boolean;
  showFurnitureDimensions: boolean;
  showFurnitureGapDimensions: boolean;
  showItemDimensions: boolean;

  setMode: (mode: "translate" | "rotate" | "scale") => void;
  setSpace: (space: "world" | "local") => void;
  toggleSnap: () => void;
  setSnapEnabled: (v: boolean) => void;

  toggleMaterialPicker: () => void;
  setMaterialPicking: (v: boolean) => void;

  toggleFurnitureDimensions: () => void;
  setShowFurnitureDimensions: (enabled: boolean) => void;

  toggleFurnitureGapDimensions: () => void;
  setShowFurnitureGapDimensions: (enabled: boolean) => void;

  toggleItemDimensions: () => void;
  setShowItemDimensions: (enabled: boolean) => void;

  dirty: boolean;
  saving: boolean;
  setDirty: (dirty: boolean) => void;
  setSaving: (saving: boolean) => void;

  commands: ToolsCommands;
  setCommands: (patch: Partial<ToolsCommands>) => void;

  save: () => Promise<any>;
  undo: () => void;
  redo: () => void;

  syncFromExternal: (patch?: Partial<ToolsState>) => void;
  reset: () => void;
}

export const useToolsStore = create<ToolsState>((set, get) => ({
  mode: "translate",
  space: "world",
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
  setShowFurnitureDimensions: (enabled) => set({ showFurnitureDimensions: enabled }),

  toggleFurnitureGapDimensions: () => set((s) => ({ showFurnitureGapDimensions: !s.showFurnitureGapDimensions })),
  setShowFurnitureGapDimensions: (enabled) => set({ showFurnitureGapDimensions: enabled }),

  toggleItemDimensions: () => set((s) => ({ showItemDimensions: !s.showItemDimensions })),
  setShowItemDimensions: (enabled) => set({ showItemDimensions: enabled }),

  dirty: false,
  saving: false,
  setDirty: (dirty) => set({ dirty: Boolean(dirty) }),
  setSaving: (saving) => set({ saving: Boolean(saving) }),

  commands: {
    save: null,
    undo: null,
    redo: null,
    autoFurnitureMaterial: null,
    autoReplaceFurniture: null,
  },

  setCommands: (patch) =>
    set((s) => ({
      commands: { ...s.commands, ...(patch || {}) },
    })),

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

  syncFromExternal: (patch = {}) => {
    const next: Partial<ToolsState> = {};
    if (patch.mode) next.mode = patch.mode;
    if (patch.space) next.space = patch.space;
    if (typeof patch.snapEnabled === "boolean") next.snapEnabled = patch.snapEnabled;
    if (typeof patch.materialPicking === "boolean") next.materialPicking = patch.materialPicking;
    if (typeof patch.dirty === "boolean") next.dirty = patch.dirty;
    if (typeof patch.saving === "boolean") next.saving = patch.saving;
    if (Object.keys(next).length) set(next);
  },

  reset: () => set({
    mode: "translate",
    space: "world",
    snapEnabled: false,
    materialPicking: false,
    showFurnitureDimensions: false,
    showFurnitureGapDimensions: false,
    showItemDimensions: false,
    dirty: false,
    saving: false,
    commands: { save: null, undo: null, redo: null }
  })
}));
