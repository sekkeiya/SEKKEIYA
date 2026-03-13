import { create } from 'zustand';

export const VALID_PANELS = ['drive', 'chat', 'notifications'];

export const useGlobalPanelStore = create((set) => ({
  activePanel: null, // "drive" | "chat" | "notifications" | null
  isSidebarExpanded: false,
  setSidebarExpanded: (expanded) => set({ isSidebarExpanded: expanded }),
  
  openPanel: (panelName) => {
    if (VALID_PANELS.includes(panelName)) {
      set({ activePanel: panelName });
    }
  },
  
  closePanel: () => {
    set({ activePanel: null });
  },
  
  togglePanel: (panelName) => {
    set((state) => {
      // Toggle logic: if already open, close it. Otherwise open the new one.
      if (state.activePanel === panelName) {
        return { activePanel: null };
      }
      if (VALID_PANELS.includes(panelName)) {
        return { activePanel: panelName };
      }
      return state;
    });
  }
}));
