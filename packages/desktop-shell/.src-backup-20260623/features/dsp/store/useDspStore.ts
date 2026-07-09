import { create } from 'zustand';
import type { PresentationContent, PresentationElement, PresentationPage } from '../types/dsp.types';

/**
 * 編集中プレゼンの一時退避スナップショット。
 * EXIT / 別プレゼンへの切替 / サイドバー移動でエディターがアンマウントされても
 * 未保存の作業内容（アンドゥ履歴・選択状態含む）をメモリ上に保持し、
 * 再度開いたときに Firestore を再読込せず即座に復元するために使う。
 */
export interface DspSessionSnapshot {
  projectId: string | null;
  projectName: string | null;
  workspaceId: string | null;
  workFileId: string | null;
  workFileName: string | null;
  presentation: PresentationContent | null;
  past: PresentationContent[];
  future: PresentationContent[];
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  selectedPageId: string | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
  leftPanelActiveTab: 'slides' | 'outline';
  inspectorActiveTopTab: 'properties' | 'deck' | 'parts' | 'layers';
  showRightSidebar: boolean;
  isSlidesPanelOpen: boolean;
}

interface DspState {
  // Context Bound
  projectId: string | null;
  projectName: string | null;
  workspaceId: string | null;
  workFileId: string | null;
  workFileName: string | null;
  
  // Undo/Redo History
  past: PresentationContent[];
  future: PresentationContent[];
  
  // Data State
  isHydrated: boolean;
  saveStatus: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  presentation: PresentationContent | null;

  // 未保存の作業内容を workFileId 単位で退避するメモリキャッシュ
  sessionCache: Record<string, DspSessionSnapshot>;
  
  // UI Selection State
  selectedPageId: string | null;
  selectedElementId: string | null;
  selectedElementIds: string[];
  isSlidesPanelOpen: boolean;
  isSnapEnabled: boolean;
  isGridEnabled: boolean;
  gridSize: number;
  activeTool: 'select' | 'pencil';
  isModelPickerOpen: boolean;
  inspectorActiveTopTab: 'properties' | 'deck' | 'parts' | 'layers';
  leftPanelActiveTab: 'slides' | 'outline';
  showProjectBrowser: boolean;
  showRightSidebar: boolean;

  // Actions
  initializeWorkspace: (projectId: string, projectName: string, workspaceId: string, workFileId: string, workFileName: string, initialData: PresentationContent) => void;
  clearWorkspace: () => void;
  /** 現在の編集状態を sessionCache に退避してからアクティブ状態をクリアする（未保存時のみキャッシュ）。 */
  stashWorkspace: () => void;
  /** sessionCache から指定プレゼンの編集状態を復元する。復元できたら true。 */
  restoreSession: (workFileId: string) => boolean;
  /** 指定プレゼンの退避済みセッションが存在するか。 */
  hasSession: (workFileId: string) => boolean;
  /** 指定プレゼンの退避済みセッションを破棄する（削除時など）。 */
  clearSession: (workFileId: string) => void;
  setSlidesPanelOpen: (open: boolean) => void;
  toggleSlidesPanel: () => void;
  setIsSnapEnabled: (enabled: boolean) => void;
  setIsGridEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setCanvasSize: (size: import('../types/dsp.types').CanvasSize) => void;
  setActiveTool: (tool: 'select' | 'pencil') => void;
  setModelPickerOpen: (open: boolean) => void;
  setInspectorActiveTopTab: (tab: 'properties' | 'deck' | 'parts' | 'layers') => void;
  setLeftPanelActiveTab: (tab: 'slides' | 'outline') => void;
  setShowProjectBrowser: (show: boolean) => void;
  setShowRightSidebar: (show: boolean) => void;

  // Page Actions
  addPage: () => void;
  deletePage: (pageId: string) => void;
  duplicatePage: (pageId: string) => void;
  setSelectedPageId: (pageId: string | null) => void;
  
  // Element Actions
  addElement: (pageId: string, element: Omit<PresentationElement, 'id'>) => void;
  addElements: (pageId: string, elements: Omit<PresentationElement, 'id'>[]) => void;
  updateElement: (elementId: string, updates: Partial<PresentationElement>, commitHistory?: boolean) => void;
  updateElements: (updates: { id: string, updates: Partial<PresentationElement> }[], commitHistory?: boolean) => void;
  deleteElement: (elementId: string) => void;
  deleteElements: (elementIds: string[]) => void;
  setSelectedElementId: (elementId: string | null) => void;
  setSelectedElementIds: (elementIds: string[]) => void;
  
  // System Actions
  setSaveStatus: (status: 'idle' | 'dirty' | 'saving' | 'saved' | 'error') => void;
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Page Note Actions
  updatePageNotes: (pageId: string, notes: string) => void;

  // Template Actions
  replacePresentation: (content: PresentationContent) => void;
  appendPages: (pages: PresentationPage[]) => void;
}

export const useDspStore = create<DspState>((set, get) => ({
  projectId: null,
  projectName: null,
  workspaceId: null,
  workFileId: null,
  workFileName: null,
  past: [],
  future: [],
  isHydrated: false,
  saveStatus: 'idle',
  presentation: null,
  sessionCache: {},
  selectedPageId: null,
  selectedElementId: null,
  selectedElementIds: [],
  isSlidesPanelOpen: true,
  isSnapEnabled: true,
  isGridEnabled: false,
  gridSize: 20,
  activeTool: 'select',
  isModelPickerOpen: false,
  inspectorActiveTopTab: 'properties',
  leftPanelActiveTab: 'slides',
  showProjectBrowser: false,
  showRightSidebar: true,

  setSlidesPanelOpen: (open) => set({ isSlidesPanelOpen: open }),
  toggleSlidesPanel: () => set((state) => ({ isSlidesPanelOpen: !state.isSlidesPanelOpen })),
  setIsSnapEnabled: (enabled) => set({ isSnapEnabled: enabled }),
  setIsGridEnabled: (enabled) => set({ isGridEnabled: enabled }),
  setGridSize: (size) => set({ gridSize: size }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setModelPickerOpen: (open) => set({ isModelPickerOpen: open }),
  setInspectorActiveTopTab: (tab) => set({ inspectorActiveTopTab: tab }),
  setLeftPanelActiveTab: (tab) => set({ leftPanelActiveTab: tab }),
  setShowProjectBrowser: (show) => set({ showProjectBrowser: show }),
  setShowRightSidebar: (show) => set({ showRightSidebar: show }),
  setCanvasSize: (size) => set(state => {
    if (!state.presentation) return state;
    return {
      presentation: {
        ...state.presentation,
        canvasSize: size
      },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty'
    };
  }),

  initializeWorkspace: (projectId, projectName, workspaceId, workFileId, workFileName, initialData) => set({
    projectId,
    projectName,
    workspaceId,
    workFileId,
    workFileName,
    presentation: initialData,
    past: [],
    future: [],
    isHydrated: true,
    saveStatus: 'idle',
    selectedPageId: initialData.pages.length > 0 ? initialData.pages[0].id : null,
    selectedElementId: null,
    selectedElementIds: [],
    leftPanelActiveTab: 'slides',
    showProjectBrowser: false,
  }),

  clearWorkspace: () => set({
    projectId: null,
    projectName: null,
    workspaceId: null,
    workFileId: null,
    workFileName: null,
    presentation: null,
    past: [],
    future: [],
    isHydrated: false,
    saveStatus: 'idle',
    selectedPageId: null,
    selectedElementId: null,
    selectedElementIds: []
  }),

  stashWorkspace: () => set((state) => {
    // アクティブ状態のリセット（clearWorkspace と同じ。ただし sessionCache は保持）
    const cleared = {
      projectId: null,
      projectName: null,
      workspaceId: null,
      workFileId: null,
      workFileName: null,
      presentation: null,
      past: [],
      future: [],
      isHydrated: false,
      saveStatus: 'idle' as const,
      selectedPageId: null,
      selectedElementId: null,
      selectedElementIds: [],
    };

    // 未保存（dirty）の作業内容のみ退避する。
    // 保存済み/未編集の場合は古いキャッシュを破棄して、次回は最新を再読込させる
    // （Mac/iOS と origin を共有しており、他端末の更新を取りこぼさないため）。
    if (state.workFileId && state.presentation && state.saveStatus === 'dirty') {
      const snapshot: DspSessionSnapshot = {
        projectId: state.projectId,
        projectName: state.projectName,
        workspaceId: state.workspaceId,
        workFileId: state.workFileId,
        workFileName: state.workFileName,
        presentation: state.presentation,
        past: state.past,
        future: state.future,
        saveStatus: state.saveStatus,
        selectedPageId: state.selectedPageId,
        selectedElementId: state.selectedElementId,
        selectedElementIds: state.selectedElementIds,
        leftPanelActiveTab: state.leftPanelActiveTab,
        inspectorActiveTopTab: state.inspectorActiveTopTab,
        showRightSidebar: state.showRightSidebar,
        isSlidesPanelOpen: state.isSlidesPanelOpen,
      };
      return { ...cleared, sessionCache: { ...state.sessionCache, [state.workFileId]: snapshot } };
    }

    if (state.workFileId && state.sessionCache[state.workFileId]) {
      const next = { ...state.sessionCache };
      delete next[state.workFileId];
      return { ...cleared, sessionCache: next };
    }

    return cleared;
  }),

  restoreSession: (workFileId) => {
    const snap = get().sessionCache[workFileId];
    if (!snap) return false;
    set({
      projectId: snap.projectId,
      projectName: snap.projectName,
      workspaceId: snap.workspaceId,
      workFileId: snap.workFileId,
      workFileName: snap.workFileName,
      presentation: snap.presentation,
      past: snap.past,
      future: snap.future,
      isHydrated: true,
      saveStatus: snap.saveStatus,
      selectedPageId: snap.selectedPageId,
      selectedElementId: snap.selectedElementId,
      selectedElementIds: snap.selectedElementIds,
      leftPanelActiveTab: snap.leftPanelActiveTab,
      inspectorActiveTopTab: snap.inspectorActiveTopTab,
      showRightSidebar: snap.showRightSidebar,
      isSlidesPanelOpen: snap.isSlidesPanelOpen,
      showProjectBrowser: false,
    });
    return true;
  },

  hasSession: (workFileId) => Boolean(get().sessionCache[workFileId]),

  clearSession: (workFileId) => set((state) => {
    if (!state.sessionCache[workFileId]) return state;
    const next = { ...state.sessionCache };
    delete next[workFileId];
    return { sessionCache: next };
  }),

  setSelectedPageId: (pageId) => set({ selectedPageId: pageId, selectedElementId: null, selectedElementIds: [] }),
  setSelectedElementId: (elementId) => set({ selectedElementId: elementId, selectedElementIds: elementId ? [elementId] : [] }),
  setSelectedElementIds: (elementIds) => set(state => ({
    selectedElementIds: elementIds,
    selectedElementId: elementIds.length > 0 ? elementIds[0] : null,
    // 未選択→選択への遷移時のみプロパティを自動表示
    ...(elementIds.length > 0 && state.selectedElementIds.length === 0
      ? { showRightSidebar: true, inspectorActiveTopTab: 'properties' as const }
      : {}),
  })),

  addPage: () => set(state => {
    if (!state.presentation) return state;
    const newPage: PresentationPage = {
      id: `page-${Date.now()}`,
      name: `Slide ${state.presentation.pages.length + 1}`,
      elements: []
    };
    return {
      presentation: {
        ...state.presentation,
        pages: [...state.presentation.pages, newPage]
      },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedPageId: newPage.id,
      selectedElementId: null,
      selectedElementIds: []
    };
  }),

  deletePage: (pageId) => set(state => {
    if (!state.presentation) return state;
    const newPages = state.presentation.pages.filter(p => p.id !== pageId);
    let nextSelectedPageId = state.selectedPageId;
    
    // If the active page is deleted, select the previous page, or the first page
    if (state.selectedPageId === pageId) {
      if (newPages.length === 0) {
         nextSelectedPageId = null;
      } else {
         const deletedIdx = state.presentation.pages.findIndex(p => p.id === pageId);
         const targetIdx = Math.max(0, deletedIdx - 1);
         nextSelectedPageId = newPages[targetIdx]?.id || newPages[0].id;
      }
    }
    
    return {
      presentation: {
        ...state.presentation,
        pages: newPages
      },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedPageId: nextSelectedPageId,
      ...(state.selectedPageId === pageId ? { selectedElementId: null, selectedElementIds: [] } : {})
    };
  }),

  duplicatePage: (pageId) => set(state => {
    if (!state.presentation) return state;
    const pageIndex = state.presentation.pages.findIndex(p => p.id === pageId);
    if (pageIndex === -1) return state;

    const sourcePage = state.presentation.pages[pageIndex];
    // Deep clone elements and give them new IDs
    const clonedElements = sourcePage.elements.map(el => ({
       ...el,
       id: `el-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    }));

    const newPage: PresentationPage = {
      ...sourcePage,
      id: `page-${Date.now()}`,
      name: `${sourcePage.name} (Copy)`,
      elements: clonedElements
    };

    const newPages = [...state.presentation.pages];
    newPages.splice(pageIndex + 1, 0, newPage);

    return {
      presentation: {
        ...state.presentation,
        pages: newPages
      },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedPageId: newPage.id,
      selectedElementId: null,
      selectedElementIds: []
    };
  }),

  addElement: (pageId, element) => set(state => {
    if (!state.presentation) return state;
    const newElement: PresentationElement = {
      ...element,
      id: `el-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    };
    
    const newPages = state.presentation.pages.map(page => 
      page.id === pageId 
        ? { ...page, elements: [...page.elements, newElement] }
        : page
    );

    return {
      presentation: { ...state.presentation, pages: newPages },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedElementId: newElement.id,
      selectedElementIds: [newElement.id]
    };
  }),

  addElements: (pageId, elements) => set(state => {
    if (!state.presentation || elements.length === 0) return state;

    const idMap: Record<string, string> = {};
    const processedElements = elements.map((el, idx) => {
      const newId = `el-${Date.now()}-${Math.floor(Math.random() * 10000)}-${idx}`;
      if ((el as any)._originalId) {
        idMap[(el as any)._originalId] = newId;
      }
      return { ...el, id: newId };
    });

    const newElements = processedElements.map(el => {
      const copy = { ...el };
      delete (copy as any)._originalId;
      if (copy.type === 'line' && copy.data) {
        const data = { ...copy.data } as any;
        if (data.startBindingId && idMap[data.startBindingId]) {
          data.startBindingId = idMap[data.startBindingId];
        }
        if (data.endBindingId && idMap[data.endBindingId]) {
          data.endBindingId = idMap[data.endBindingId];
        }
        copy.data = data;
      }
      return copy as PresentationElement;
    });
    
    const newPages = state.presentation.pages.map(page => 
      page.id === pageId 
        ? { ...page, elements: [...page.elements, ...newElements] }
        : page
    );

    const newIds = newElements.map(e => e.id);

    return {
      presentation: { ...state.presentation, pages: newPages },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedElementId: newIds.length === 1 ? newIds[0] : null,
      selectedElementIds: newIds
    };
  }),

  updateElement: (elementId, updates, commitHistory) => set(state => {
    if (!state.presentation) return state;
    
    let updated = false;
    const newPages = state.presentation.pages.map(page => {
      const elIndex = page.elements.findIndex(e => e.id === elementId);
      if (elIndex === -1) return page;
      
      updated = true;
      const newElements = [...page.elements];
      newElements[elIndex] = { ...newElements[elIndex], ...updates };
      return { ...page, elements: newElements };
    });

    if (!updated) return state;
    
    return {
      presentation: { ...state.presentation, pages: newPages },
      saveStatus: 'dirty',
      ...(commitHistory ? { past: [...state.past, state.presentation], future: [] } : {})
    };
  }),

  updateElements: (updatesList, commitHistory) => set(state => {
    if (!state.presentation || updatesList.length === 0) return state;
    
    let updated = false;
    const newPages = state.presentation.pages.map(page => {
      let pageUpdated = false;
      const newElements = [...page.elements];
      
      updatesList.forEach(({ id, updates }) => {
        const elIndex = newElements.findIndex(e => e.id === id);
        if (elIndex !== -1) {
          newElements[elIndex] = { ...newElements[elIndex], ...updates };
          pageUpdated = true;
          updated = true;
        }
      });
      
      return pageUpdated ? { ...page, elements: newElements } : page;
    });

    if (!updated) return state;
    
    return {
      presentation: { ...state.presentation, pages: newPages },
      saveStatus: 'dirty',
      ...(commitHistory ? { past: [...state.past, state.presentation], future: [] } : {})
    };
  }),

  deleteElement: (elementId) => set(state => {
    if (!state.presentation) return state;
    
    const newPages = state.presentation.pages.map(page => ({
       ...page,
       elements: page.elements.filter(e => e.id !== elementId)
    }));

    return {
      presentation: { ...state.presentation, pages: newPages },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      ...(state.selectedElementIds.includes(elementId) ? { 
        selectedElementIds: state.selectedElementIds.filter(id => id !== elementId), 
        selectedElementId: state.selectedElementId === elementId ? null : state.selectedElementId 
      } : {})
    };
  }),

  deleteElements: (elementIds) => set(state => {
    if (!state.presentation) return state;
    
    const newPages = state.presentation.pages.map(page => ({
       ...page,
       elements: page.elements.filter(e => !elementIds.includes(e.id))
    }));

    return {
      presentation: { ...state.presentation, pages: newPages },
      past: [...state.past, state.presentation],
      future: [],
      saveStatus: 'dirty',
      selectedElementId: null,
      selectedElementIds: []
    };
  }),

  setSaveStatus: (status) => set({ saveStatus: status }),

  commitHistory: () => set(state => {
    if (!state.presentation) return state;
    return { past: [...state.past, state.presentation], future: [] };
  }),

  undo: () => set(state => {
    if (state.past.length === 0 || !state.presentation) return state;
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, -1);
    return {
      past: newPast,
      future: [state.presentation, ...state.future],
      presentation: previous,
      saveStatus: 'dirty' // Requires DB sync since we rolled back
    };
  }),

  redo: () => set(state => {
    if (state.future.length === 0 || !state.presentation) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    return {
      past: [...state.past, state.presentation],
      future: newFuture,
      presentation: next,
      saveStatus: 'dirty' // Requires DB sync since we rolled forward
    };
  }),

  updatePageNotes: (pageId, notes) => set(state => {
    if (!state.presentation) return state;
    return {
      presentation: {
        ...state.presentation,
        pages: state.presentation.pages.map(p =>
          p.id === pageId ? { ...p, notes } : p
        ),
      },
      saveStatus: 'dirty',
    };
  }),

  replacePresentation: (content) => set(() => ({
    presentation: content,
    selectedPageId: content.pages[0]?.id ?? null,
    selectedElementId: null,
    selectedElementIds: [],
    past: [],
    future: [],
    saveStatus: 'dirty',
  })),

  appendPages: (pages) => set(state => {
    if (!state.presentation) return {};
    return {
      presentation: { ...state.presentation, pages: [...state.presentation.pages, ...pages] },
      saveStatus: 'dirty',
    };
  }),

}));
