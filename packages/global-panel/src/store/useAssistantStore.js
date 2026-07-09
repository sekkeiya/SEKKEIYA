import { create } from 'zustand';

export const assistantDrawerWidth = 360;

export const useAssistantStore = create((set) => ({
  isDriveOpen: false,
  isChatOpen: false,
  toggleDrive: () => set((state) => ({ isDriveOpen: !state.isDriveOpen, isChatOpen: false })),
  toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen, isDriveOpen: false })),
  closeAssistant: () => set({ isChatOpen: false, isDriveOpen: false }),
  // compatibility with 3DSS DashboardLayout
  dashboardActions: null,
  setDashboardActions: (actions) => set({ dashboardActions: actions }),
  currentSelectedModel: null,
  setCurrentSelectedModel: (model) => set({ currentSelectedModel: model }),
}));
