import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePresentationUiStore = create(persist((set, get) => ({
  // Active Presentation State
  activePresentation: null,
  isHydrated: false,
  isSaving: false,
  saveStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
  lastSavedAt: null,

  // UI State
  dashboardType: 'all', // 'all', 'competition', 'proposal', 'report', 'material', 'product'
  selectedPageId: null,
  selectedElementId: null,
  rightPanelTab: 'properties', // 'elements' | 'assets' | 'properties'
  previewMode: 'edit',         // 'edit' | 'preview' | 'present'
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,

  resetPresentationState: () => {
    set({
      activePresentation: null,
      isHydrated: false,
      isSaving: false,
      saveStatus: 'idle',
      selectedPageId: null,
      selectedElementId: null,
      rightPanelTab: 'properties'
    });
  },

  setActivePresentation: (data) => set({ 
    activePresentation: data,
    isHydrated: !!data
  }),

  setIsHydrated: (val) => set({ isHydrated: val }),

  setSaveStatus: (status) => set((state) => ({ 
    saveStatus: status, 
    isSaving: status === 'saving',
    lastSavedAt: status === 'saved' ? new Date().toISOString() : state.lastSavedAt 
  })),

  setDashboardType: (type) => set({ dashboardType: type }),
  setSelectedPageId: (id) => set({ selectedPageId: id, selectedElementId: null }),
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  toggleLeftPanel: () => set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),

  // --- activePresentation Operations ---

  addPage: (presentId) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const newPage = { id: `pg-${Date.now()}`, name: `New Page`, elements: [] };
      return { 
        activePresentation: {
          ...state.activePresentation,
          pages: [...(state.activePresentation.pages || []), newPage]
        },
        selectedPageId: newPage.id, 
        selectedElementId: null 
      };
    });
  },

  duplicatePage: (presentId, pageId) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const pres = state.activePresentation;
      const pageIndex = (pres.pages || []).findIndex(p => p.id === pageId);
      if (pageIndex === -1) return state;

      const pageToDuplicate = pres.pages[pageIndex];
      const duplicatedElements = (pageToDuplicate.elements || []).map(el => ({ 
        ...el, 
        id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 5)}` 
      }));
      const newPage = { 
        ...pageToDuplicate, 
        id: `pg-${Date.now()}`, 
        name: `${pageToDuplicate.name} (Copy)`, 
        elements: duplicatedElements 
      };
      
      const newPages = [...pres.pages];
      newPages.splice(pageIndex + 1, 0, newPage);

      return { 
        activePresentation: { ...pres, pages: newPages },
        selectedPageId: newPage.id, 
        selectedElementId: null 
      };
    });
  },

  deletePage: (presentId, pageId) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const pres = state.activePresentation;
      const newPages = (pres.pages || []).filter(p => p.id !== pageId);
      const nextSelectedId = newPages.length > 0 ? newPages[0].id : null;

      return { 
        activePresentation: { ...pres, pages: newPages },
        selectedPageId: nextSelectedId, 
        selectedElementId: null 
      };
    });
  },

  addElement: (presentId, pageId, element) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const pres = state.activePresentation;
      const pageIndex = (pres.pages || []).findIndex(p => p.id === pageId);
      if (pageIndex === -1) return state;
      
      const baseElement = { x: 0, y: 0, w: 200, h: 200, zIndex: 1, rotation: 0, locked: false, data: {} };
      const newElement = { id: `el-${Date.now()}`, ...baseElement, ...element };
      
      const newPages = [...pres.pages];
      newPages[pageIndex] = {
        ...newPages[pageIndex],
        elements: [...(newPages[pageIndex].elements || []), newElement]
      };
      
      return { 
        activePresentation: { ...pres, pages: newPages },
        selectedElementId: newElement.id, 
        rightPanelTab: 'properties' 
      };
    });
  },

  updateElement: (elementId, patch) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const pres = state.activePresentation;
      let foundPageIndex = -1;
      let foundElIndex = -1;

      for (let j = 0; j < (pres.pages || []).length; j++) {
        const page = pres.pages[j];
        if (!page.elements) continue;
        const elIdx = page.elements.findIndex(e => e.id === elementId);
        if (elIdx !== -1) {
          foundPageIndex = j;
          foundElIndex = elIdx;
          break;
        }
      }

      if (foundPageIndex === -1) return state;

      const page = pres.pages[foundPageIndex];
      const newElements = [...page.elements];
      newElements[foundElIndex] = { ...newElements[foundElIndex], ...patch };

      const newPages = [...pres.pages];
      newPages[foundPageIndex] = { ...page, elements: newElements };

      return { activePresentation: { ...pres, pages: newPages } };
    });
  },

  updateElementData: (elementId, dataPatch) => {
    set((state) => {
      if (!state.activePresentation) return state;
      const pres = state.activePresentation;
      let foundPageIndex = -1;
      let foundElIndex = -1;

      for (let j = 0; j < (pres.pages || []).length; j++) {
        const page = pres.pages[j];
        if (!page.elements) continue;
        const elIdx = page.elements.findIndex(e => e.id === elementId);
        if (elIdx !== -1) {
          foundPageIndex = j;
          foundElIndex = elIdx;
          break;
        }
      }

      if (foundPageIndex === -1) return state;

      const page = pres.pages[foundPageIndex];
      const element = page.elements[foundElIndex];
      const newElements = [...page.elements];
      newElements[foundElIndex] = { 
        ...element, 
        data: { ...(element.data || {}), ...dataPatch } 
      };

      const newPages = [...pres.pages];
      newPages[foundPageIndex] = { ...page, elements: newElements };

      return { activePresentation: { ...pres, pages: newPages } };
    });
  },
}), {
  name: 'sekkeiya-presents-storage',
  version: 2, // Bump to clear old migrations via condition or just let partialize clear the rest
  partialize: (state) => ({
    // Only persist UI states
    dashboardType: state.dashboardType,
    rightPanelTab: state.rightPanelTab,
    previewMode: state.previewMode,
    leftPanelCollapsed: state.leftPanelCollapsed,
    rightPanelCollapsed: state.rightPanelCollapsed
  }),
  migrate: (persistedState, version) => {
    // If migrating from v1, partialize will drop presentations array automatically on next save.
    // Ensure we don't accidentally load old state over our store initialization.
    if (version < 2) {
      delete persistedState.presentations;
      delete persistedState.activePresentation;
    }
    return persistedState;
  }
}));
