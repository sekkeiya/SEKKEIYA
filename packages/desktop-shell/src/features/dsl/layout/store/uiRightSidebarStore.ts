import { create } from "zustand";

export interface RightPanels {
  scene: boolean;
  properties: boolean;
  library: boolean;
  history: boolean;
  autoLayout: boolean;
  characters: boolean;
  map: boolean;
  viewportSettings: boolean;
}

export const DEFAULT_RIGHT_PANELS: RightPanels = {
  scene: true,
  properties: false,
  library: false,
  history: false,
  autoLayout: false,
  characters: false,
  map: false,
  viewportSettings: false,
};

function calcVisibleSections(rightPanels: RightPanels): string[] {
  const arr: string[] = [];
  if (rightPanels?.scene) arr.push("scene");
  if (rightPanels?.properties) arr.push("properties");
  if (rightPanels?.library) arr.push("library");
  if (rightPanels?.history) arr.push("history");
  if (rightPanels?.autoLayout) arr.push("autoLayout");
  if (rightPanels?.characters) arr.push("characters");
  if (rightPanels?.map) arr.push("map");
  if (rightPanels?.viewportSettings) arr.push("viewportSettings");
  return arr;
}

export interface UiRightSidebarState {
  rightPanels: RightPanels;
  visibleSections: string[];
  portalElement: HTMLElement | null;
  setPortalElement: (el: HTMLElement | null) => void;
  setRightPanel: (key: keyof RightPanels, value: boolean) => void;
  toggleRightPanel: (key: keyof RightPanels) => void;
  setRightPanels: (next: Partial<RightPanels>) => void;
  resetRightPanels: () => void;
  closeAll: () => void;
}

export const useUiRightSidebarStore = create<UiRightSidebarState>((set) => ({
  rightPanels: DEFAULT_RIGHT_PANELS,
  visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),
  portalElement: null,
  setPortalElement: (el) => set({ portalElement: el }),

  setRightPanel: (key, value) =>
    set((s) => {
      const boolValue = Boolean(value);
      if (s.rightPanels[key] === boolValue) return s; // skip update if unchanged
      
      const nextPanels = { ...s.rightPanels, [key]: boolValue };
      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  toggleRightPanel: (key) =>
    set((s) => {
      const nextPanels = { ...s.rightPanels, [key]: !s.rightPanels[key] };
      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  setRightPanels: (next) =>
    set((s) => {
      if (!next) return s;
      const nextPanels = { ...DEFAULT_RIGHT_PANELS, ...next };
      
      // Check if anything actually changed
      const hasChanges = Object.keys(nextPanels).some(
        (k) => nextPanels[k as keyof RightPanels] !== s.rightPanels[k as keyof RightPanels]
      );
      if (!hasChanges) return s;

      return {
        rightPanels: nextPanels,
        visibleSections: calcVisibleSections(nextPanels),
      };
    }),

  resetRightPanels: () =>
    set(() => ({
      rightPanels: DEFAULT_RIGHT_PANELS,
      visibleSections: calcVisibleSections(DEFAULT_RIGHT_PANELS),
    })),

  closeAll: () =>
    set(() => {
      const nextPanels = {
        scene: false,
        properties: false,
        library: false,
        history: false,
        autoLayout: false,
        characters: false,
        map: false,
        viewportSettings: false,
      };
      return {
        rightPanels: nextPanels,
        visibleSections: [],
      };
    })
}));
