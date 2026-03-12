import { create } from 'zustand';

export const useGlobalPanelStore = create((set) => ({
  activePanel: null, // 'drive' | 'chat' | 'notifications' | null
  
  openPanel: (panelName) => set({ activePanel: panelName }),
  
  closePanel: () => set({ activePanel: null }),
  
  togglePanel: (panelName) => set((state) => ({
    activePanel: state.activePanel === panelName ? null : panelName
  })),
}));
