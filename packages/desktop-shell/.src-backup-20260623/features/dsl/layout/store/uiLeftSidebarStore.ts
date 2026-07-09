import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LeftPanels {
  project: boolean;
  library: boolean;
  dashboard: boolean;
}

export const DEFAULT_LEFT_PANELS: LeftPanels = {
  project: true,
  library: true,
  dashboard: false,
};

function calcVisibleSections(leftPanels: LeftPanels): string[] {
  const arr: string[] = [];
  if (leftPanels?.project) arr.push("project");
  if (leftPanels?.library) arr.push("library");
  // Dashboard is explicitly NOT rendered in LeftSidebar, so no adding it to visibleSections array here!
  return arr;
}

export interface UiLeftSidebarState {
  leftPanels: LeftPanels;
  visibleSections: string[];
  sectionHeights: Record<string, number>;
  portalElement: HTMLElement | null;
  setPortalElement: (el: HTMLElement | null) => void;
  setLeftPanel: (key: keyof LeftPanels, value: boolean) => void;
  toggleLeftPanel: (key: keyof LeftPanels) => void;
  setLeftPanels: (next: Partial<LeftPanels>) => void;
  setSectionHeight: (section: string, height: number) => void;
  resetLeftPanels: () => void;
  closeAll: () => void;
  isLibraryDetached: boolean;
  toggleLibraryDetached: () => void;
}

export const useUiLeftSidebarStore = create<UiLeftSidebarState>()(
  persist(
    (set) => ({
      leftPanels: DEFAULT_LEFT_PANELS,
      visibleSections: calcVisibleSections(DEFAULT_LEFT_PANELS),
      sectionHeights: {
        project: 33,
        structure: 33,
        library: 33,
      },
      portalElement: null,
      setPortalElement: (el) => set({ portalElement: el }),
      isLibraryDetached: false,
      toggleLibraryDetached: () => set((s) => ({ isLibraryDetached: !s.isLibraryDetached })),

      setLeftPanel: (key, value) =>
        set((s) => {
          const nextPanels = { ...s.leftPanels, [key]: Boolean(value) };
          if (Boolean(value)) {
            if (key === 'dashboard') {
              nextPanels.project = false;
              nextPanels.library = false;
            } else if (key === 'project' || key === 'library') {
              nextPanels.dashboard = false;
            }
          }
          return {
            leftPanels: nextPanels,
            visibleSections: calcVisibleSections(nextPanels),
          };
        }),

      toggleLeftPanel: (key) =>
        set((s) => {
          const isTurningOn = !s.leftPanels[key];
          const nextPanels = { ...s.leftPanels, [key]: isTurningOn };
          
          if (isTurningOn) {
            if (key === 'dashboard') {
              // Opening dashboard automatically closes project & library
              nextPanels.project = false;
              nextPanels.library = false;
            } else if (key === 'project' || key === 'library') {
              // Opening project or library automatically closes dashboard
              nextPanels.dashboard = false;
            }
          }
          
          return {
            leftPanels: nextPanels,
            visibleSections: calcVisibleSections(nextPanels),
          };
        }),

      setLeftPanels: (next) =>
        set((s) => {
          const nextPanels = { ...s.leftPanels, ...next };
          return {
            leftPanels: nextPanels,
            visibleSections: calcVisibleSections(nextPanels),
          };
        }),

      setSectionHeight: (section, height) =>
        set((s) => ({
          sectionHeights: { ...s.sectionHeights, [section]: height },
        })),

      resetLeftPanels: () =>
        set({
          leftPanels: DEFAULT_LEFT_PANELS,
          visibleSections: calcVisibleSections(DEFAULT_LEFT_PANELS),
        }),

      closeAll: () =>
        set({
          leftPanels: { project: false, library: false, dashboard: false },
          visibleSections: [],
        }),
    }),
    {
      name: "sekkeiya-left-sidebar-store",
      partialize: (state) => ({
        leftPanels: state.leftPanels,
        sectionHeights: state.sectionHeights,
        isLibraryDetached: state.isLibraryDetached,
      }),
      // Handle migrations or clean up legacy keys
      merge: (persistedState: any, currentState: UiLeftSidebarState) => {
        const merged = { ...currentState, ...persistedState };
        // Legacy cleanup for removed panels
        if (merged.leftPanels) {
          delete merged.leftPanels.dashboard;
          delete merged.leftPanels.structure;
        }

        // Removed DEV TEMP for layout panel

        // Force recalculate visible sections
        merged.visibleSections = calcVisibleSections(merged.leftPanels);
        return merged;
      }
    }
  )
);
