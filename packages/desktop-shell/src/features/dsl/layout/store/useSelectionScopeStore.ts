import { create } from "zustand";

export type SelectionScope = "all" | "item" | "lighting" | "zone" | "material" | "map" | "label";

interface SelectionScopeState {
  scope: SelectionScope;
  setScope: (scope: SelectionScope) => void;
}

export const useSelectionScopeStore = create<SelectionScopeState>((set) => ({
  scope: "all",
  setScope: (scope) => set({ scope }),
}));

export const canSelectItem = (scope: SelectionScope) =>
  scope === "all" || scope === "item";

export const canSelectLight = (scope: SelectionScope) =>
  scope === "all" || scope === "lighting";

export const canSelectZone = (scope: SelectionScope) =>
  scope === "all" || scope === "zone";

export const canSelectCirculation = (scope: SelectionScope) =>
  scope === "all" || scope === "zone";
