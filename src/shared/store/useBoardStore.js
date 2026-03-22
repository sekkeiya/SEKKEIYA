import { create } from 'zustand';

export const useBoardStore = create((set) => ({
  currentApp: 'sekkeiya', // 'sekkeiya' | 'share' | 'layout' | 'create' | 'presents' | 'books' | 'quest'
  currentBoardId: null,
  currentChatId: null,
  sidebarOpen: false,
  panelState: null, // 'chat' | 'drive' | null
  recentApps: [],
  
  setCurrentApp: (app) => set((state) => {
    if (state.currentApp === app) return {};
    const filtered = state.recentApps.filter(id => id !== state.currentApp && id !== app);
    return {
      currentApp: app,
      recentApps: [state.currentApp, ...filtered].slice(0, 3)
    };
  }),
  setCurrentBoardId: (id) => set({ currentBoardId: id }),
  setCurrentChatId: (id) => set({ currentChatId: id }),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setPanelState: (state) => set({ panelState: state }),
}));
