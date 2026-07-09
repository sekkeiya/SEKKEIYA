import { create } from "zustand";

export type LandscapeTarget = "flat" | "sky";

export type PropertiesSelection =
  | { kind: "item"; id: string }
  | { kind: "material"; [key: string]: any }
  | { kind: "libraryModel"; model: any }
  | { kind: "light"; lightId: string }
  | { kind: "landscape"; target: LandscapeTarget }
  | null;

export interface UiPropertiesSelectionState {
  selection: PropertiesSelection;
  setSelection: (selection: PropertiesSelection) => void;
  selectItem: (id: string | null) => void;
  selectMaterial: (payload: any | null) => void;
  selectLight: (lightId: string | null) => void;
  selectLandscape: (target: LandscapeTarget | null) => void;
  clearSelection: () => void;
}

export const useUiPropertiesSelectionStore = create<UiPropertiesSelectionState>((set) => ({
  selection: null,
  setSelection: (selection) => set({ selection }),
  selectItem: (id) => set({ selection: id ? { kind: "item", id } : null }),
  selectMaterial: (payload) =>
    set({ selection: payload ? { kind: "material", ...payload } : null }),
  selectLight: (lightId) =>
    set({ selection: lightId ? { kind: "light", lightId } : null }),
  selectLandscape: (target) =>
    set({ selection: target ? { kind: "landscape", target } : null }),
  clearSelection: () => set({ selection: null }),
}));
