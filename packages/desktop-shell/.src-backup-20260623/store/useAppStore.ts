import { create } from 'zustand';
import type { DesktopProject, WorkspacePayload, WorkspaceLaunchPayload, ActivityItem } from '../features/projects/types';
import type { AppScope } from '../shared/layout/workspace/types';
export type ModelsScope = 'global_models' | 'global_following_models' | 'global_projects' | 'global_following_projects' | 'my_public_models' | 'my_private_models' | 'project_models' | 'team_project_models' | 'view_public_project_models';
export type DspScope = 'global_presentations' | 'global_projects' | 'my_public_presentations' | 'my_private_presentations' | 'project_presentations' | 'team_project_presentations';
export type DslScope = 'global_layouts' | 'global_following_layouts' | 'global_projects' | 'my_public_layouts' | 'my_private_layouts' | 'project_layouts' | 'team_project_layouts';
export type DsdScope = 'global_diagrams' | 'global_projects' | 'my_public_diagrams' | 'my_private_diagrams' | 'project_diagrams' | 'team_project_diagrams';
export type DsrScope = 'global_drawings' | 'global_projects' | 'my_public_drawings' | 'my_private_drawings' | 'project_drawings' | 'team_project_drawings';
export type DsiScope = 'global_images' | 'global_projects' | 'my_public_images' | 'my_private_images' | 'project_images' | 'team_project_images';
export type DsqScope = 'global_courses' | 'global_projects' | 'my_public_courses' | 'my_private_courses' | 'project_courses' | 'team_project_courses';
export type DsfScope = 'global_portfolios' | 'global_projects' | 'my_public_portfolios' | 'my_private_portfolios' | 'project_portfolios' | 'team_project_portfolios';
import { useAIRenderStore } from './useAIRenderStore';
import { useAI3DCreateStore } from './useAI3DCreateStore';

export interface DssSearchFilters {
  query: string;
  type: string;
  category: string;
  subCategory: string;
  tags: string;
  buildingTypes: string;
  rooms: string;
  zones: string;
  companionClasses: string;
  materials: string;
  wantsReady?: boolean;
  wantsCustom?: boolean;
  format: string;
  layoutPaths: string[];
  minWidth: string;
  maxWidth: string;
  minDepth: string;
  maxDepth: string;
  minHeight: string;
  maxHeight: string;
  minPrice: string;
  maxPrice: string;
}

const DEFAULT_DSS_FILTERS: DssSearchFilters = {
  query: '', type: 'ALL', category: 'ALL', subCategory: 'ALL',
  tags: '', buildingTypes: '', rooms: '', zones: '', companionClasses: '', materials: '',
  format: '', wantsReady: false, wantsCustom: false,
  layoutPaths: [],
  minWidth: '', maxWidth: '', minDepth: '', maxDepth: '', minHeight: '', maxHeight: '',
  minPrice: '', maxPrice: ''
};

const PINNED_TABS_KEY = 'sekkeiya_pinned_tabs';
const DEFAULT_PINNED_TABS = ['3dss', '3dsl', '3dsp', '3dsc', '3dsd', '3dsr', '3dsi', '3dsq', '3dsf'];
const REQUIRED_TABS = ['3dsd', '3dsr', '3dsi', '3dsf'];

const loadPinnedTabs = (): string[] => {
  try {
    const stored = localStorage.getItem(PINNED_TABS_KEY);
    if (stored) {
      let tabs: string[] = JSON.parse(stored);
      // Migrate: add any newly introduced required tabs if missing
      const missing = REQUIRED_TABS.filter(t => !tabs.includes(t));
      if (missing.length > 0) {
        tabs = [...tabs, ...missing];
        localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(tabs));
      }
      return tabs;
    }
  } catch {}
  return DEFAULT_PINNED_TABS;
};

export interface WorkingFileInfo {
  scope: string;        // '3dsl' | '3dsp' | '3dsc' | '3dsd' ...
  projectId: string;
  workFileId: string;   // 新規未保存は一時ID可
  name: string;
  isNew: boolean;       // まだクラウドに保存されていない
}

interface AppState {
  projects: DesktopProject[];
  activeProjectId: string | null;
  activeWorkspaceId: string | null;
  lastActiveAppScope: AppScope | null;
  pinnedTabIds: string[];
  togglePinnedTab: (id: string) => void;
  setPinnedTabIds: (ids: string[]) => void;
  lastLaunchPayload: WorkspaceLaunchPayload | null;
  modelsScope: ModelsScope;
  dspScope: DspScope;
  dslScope: DslScope;
  dsdScope: DsdScope;
  dsrScope: DsrScope;
  dsiScope: DsiScope;
  dsqScope: DsqScope;
  dsfScope: DsfScope;
  activeDiagramId: string | null;
  isAIChatOpen: boolean;
  isAIDriveOpen: boolean;
  isAIDriveExpanded: boolean;
  isAI3DCreateOpen: boolean; // AI 3D Generate (display: "AI 3D Generate")
  isAI3DCreateExpanded: boolean;
  isAIRenderOpen: boolean;
  isAIRenderExpanded: boolean;
  isProjectSidebarOpen: boolean;
  dslLeftPanel: 'project' | 'structure' | 'library' | 'none';
  setDslLeftPanel: (panel: 'project' | 'structure' | 'library' | 'none') => void;
  isInitialized: boolean;
  isGlobalLoading: boolean;
  globalLoadingMessage?: string;
  setGlobalLoading: (isLoading: boolean, message?: string) => void;
  pendingScreenshot: string | null;
  setPendingScreenshot: (url: string | null) => void;
  isScreenshotDialogOpen: boolean;
  setScreenshotDialogOpen: (open: boolean) => void;
  openAI3DCreate: (payload: { baseImage: string; projectId: string | null; workspaceId: string | null }) => void;
  openAIRender: (payload: { baseImage: string; projectId: string | null; workspaceId: string | null }) => void;
  globalLaunchingTool: string | null;
  currentMainView: 'workspace' | 'project-management' | 'ai-studio' | 'app-hub' | 'marketplace' | 'creator-profile' | 'global-settings' | 'teams' | 'gallery';
  viewingPublicProjectId: string | null;
  setViewingPublicProjectId: (id: string | null) => void;
  viewingCreatorId: string | null;
  setViewingCreatorId: (id: string | null) => void;
  panelSelections: Record<string, any>;
  /** 子アプリ（タブ scope）ごとの未保存フラグ。タブ上の「作業中」ドット表示に使う。 */
  dirtyScopes: Record<string, boolean>;
  setScopeDirty: (scope: string, dirty: boolean) => void;
  /** 現在 S.Presentation エディターで開いているプレゼン（青ハイライト表示用）。 */
  dspOpenSession: { projectId: string; workFileId: string } | null;
  setDspOpenSession: (info: { projectId: string; workFileId: string } | null) => void;
  /** 未保存の作業内容を保持しているプレゼン（サイドバーの「作業中」ドット表示用）。workFileId → { projectId } */
  dspWorkingSessions: Record<string, { projectId: string }>;
  setDspWorkingSession: (workFileId: string, info: { projectId: string } | null) => void;
  /**
   * 横断的な「未保存ファイル」レジストリ。タブのドットクリック一覧・終了時ダイアログで使う。
   * key = `${scope}:${workFileId}`。isNew = まだクラウド未保存。
   */
  workingFiles: Record<string, WorkingFileInfo>;
  setWorkingFile: (key: string, info: WorkingFileInfo | null) => void;
  canvasTheme: 'default' | 'blueprint' | 'monochrome' | 'editorial';
  setCanvasTheme: (theme: 'default' | 'blueprint' | 'monochrome' | 'editorial') => void;
  canvasMode: 'all' | 'diagram' | 'mood' | 'material';
  setCanvasMode: (mode: 'all' | 'diagram' | 'mood' | 'material') => void;
  dssSearchFilters: DssSearchFilters;
  setDssSearchFilters: (updater: Partial<DssSearchFilters> | ((prev: DssSearchFilters) => DssSearchFilters)) => void;
  resetDssSearchFilters: () => void;
  availableLayoutPaths: string[];
  setAvailableLayoutPaths: (paths: string[]) => void;
  dslShellMode: 'dashboard' | 'canvas';
  setDslShellMode: (mode: 'dashboard' | 'canvas') => void;
  dscShellMode: 'dashboard' | 'studio';
  setDscShellMode: (mode: 'dashboard' | 'studio') => void;
  dspShellMode: 'dashboard' | 'editor';
  setDspShellMode: (mode: 'dashboard' | 'editor') => void;
  dsdShellMode: 'dashboard' | 'editor';
  setDsdShellMode: (mode: 'dashboard' | 'editor') => void;
  dsrShellMode: 'dashboard' | 'editor';
  setDsrShellMode: (mode: 'dashboard' | 'editor') => void;
  dspGlobalFilter: 'following' | 'all';
  setDspGlobalFilter: (filter: 'following' | 'all') => void;
  dsdGlobalFilter: 'following' | 'all';
  setDsdGlobalFilter: (filter: 'following' | 'all') => void;
  setCurrentMainView: (view: 'workspace' | 'project-management' | 'ai-studio' | 'app-hub' | 'marketplace' | 'creator-profile' | 'global-settings' | 'teams' | 'gallery') => void;
  setPanelSelection: (workspaceId: string, itemData: any | null) => void;
  setGlobalLaunchingTool: (tool: string | null) => void;
  setGlobalModelsHub: (scope?: ModelsScope) => void;
  setGlobalDspHub: () => void;
  toggleProjectSidebar: () => void;
  setProjectSidebarOpen: (open: boolean) => void;
  setProjects: (projects: DesktopProject[]) => void;
  setActiveProjectId: (id: string | null, navigateTo?: 'home' | 'canvas') => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setLastActiveAppScope: (scope: AppScope | null) => void;
  setLastLaunchPayload: (payload: WorkspaceLaunchPayload | null) => void;
  setModelsScope: (scope: ModelsScope) => void;
  setDspScope: (scope: DspScope) => void;
  setDslScope: (scope: DslScope) => void;
  setDsdScope: (scope: DsdScope) => void;
  setDsrScope: (scope: DsrScope) => void;
  setDsiScope: (scope: DsiScope) => void;
  setDsqScope: (scope: DsqScope) => void;
  setDsfScope: (scope: DsfScope) => void;
  setActiveDiagramId: (id: string | null) => void;
  setGlobalDslHub: () => void;
  toggleAIChat: () => void;
  setAIChatOpen: (open: boolean) => void;
  toggleAIDrive: () => void;
  toggleAI3DCreate: () => void;
  setAI3DCreateOpen: (open: boolean) => void;
  setAIDriveOpen: (open: boolean) => void;
  setAIDriveExpanded: (expanded: boolean) => void;
  setAI3DCreateExpanded: (expanded: boolean) => void;
  toggleAIRender: () => void;
  setAIRenderOpen: (open: boolean) => void;
  setAIRenderExpanded: (expanded: boolean) => void;
  getActiveProject: () => DesktopProject | undefined;
  getActiveWorkspace: () => WorkspacePayload | undefined;
  addRecentActivity: (projectId: string, activity: ActivityItem) => void;
  canvasPages: { id: string; name: string }[];
  canvasCurrentPageId: string | null;
  setCanvasPages: (pages: { id: string; name: string }[]) => void;
  setCanvasCurrentPageId: (id: string | null) => void;
  lastCanvasAiPrompt: { text: string; timestamp: number } | null;
  triggerCanvasAiPrompt: (text: string) => void;
  selectedLlmModel: string;
  setSelectedLlmModel: (model: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeWorkspaceId: null,
  lastActiveAppScope: null,
  pinnedTabIds: loadPinnedTabs(),
  togglePinnedTab: (id) => set((state) => {
    const next = state.pinnedTabIds.includes(id)
      ? state.pinnedTabIds.filter(i => i !== id)
      : [...state.pinnedTabIds, id];
    localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(next));
    return { pinnedTabIds: next };
  }),
  setPinnedTabIds: (ids) => {
    localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(ids));
    set({ pinnedTabIds: ids });
  },
  lastLaunchPayload: null,
  modelsScope: 'project_models',
  dspScope: 'project_presentations',
  dslScope: 'project_layouts',
  dsdScope: 'project_diagrams',
  dsrScope: 'project_drawings',
  dsiScope: 'project_images',
  dsqScope: 'global_courses',
  dsfScope: 'project_portfolios',
  activeDiagramId: null,
  setActiveDiagramId: (activeDiagramId) => set({ activeDiagramId }),
  isAIChatOpen: false,
  isAIDriveOpen: false,
  isAIDriveExpanded: false,
  isAI3DCreateOpen: false,
  isAI3DCreateExpanded: false,
  isAIRenderOpen: false,
  isAIRenderExpanded: false,
  isProjectSidebarOpen: true,
  dslLeftPanel: 'structure',
  setDslLeftPanel: (panel) => set({ dslLeftPanel: panel }),
  isInitialized: false,
  isGlobalLoading: false,
  globalLoadingMessage: undefined,
  setGlobalLoading: (isLoading, message) => set({ isGlobalLoading: isLoading, globalLoadingMessage: message }),
  pendingScreenshot: null,
  setPendingScreenshot: (url) => set({ pendingScreenshot: url }),
  isScreenshotDialogOpen: false,
  setScreenshotDialogOpen: (open) => set({ isScreenshotDialogOpen: open }),
  
  openAI3DCreate: ({ baseImage, projectId, workspaceId }) => {
    set({ 
      isAI3DCreateOpen: true, 
      isAIRenderOpen: false, 
      isAIDriveOpen: false,
      isAIChatOpen: false,
      isScreenshotDialogOpen: false, 
      pendingScreenshot: null 
    });
    const store = useAI3DCreateStore.getState();
    store.setImageUrl(baseImage);
    store.setContext(projectId, workspaceId);
  },
  
  openAIRender: ({ baseImage, projectId, workspaceId }) => {
    set({ 
      isAIRenderOpen: true, 
      isAI3DCreateOpen: false, 
      isAIDriveOpen: false,
      isAIChatOpen: false,
      isScreenshotDialogOpen: false, 
      pendingScreenshot: null 
    });
    const store = useAIRenderStore.getState();
    store.setImageUrl(baseImage);
    store.setContext(projectId, workspaceId);
  },

  globalLaunchingTool: null,
  currentMainView: 'project-management',
  viewingPublicProjectId: null,
  setViewingPublicProjectId: (id) => set({ viewingPublicProjectId: id }),
  viewingCreatorId: null,
  setViewingCreatorId: (id) => set({ viewingCreatorId: id }),
  panelSelections: {},
  dirtyScopes: {},
  canvasPages: [],
  canvasCurrentPageId: null,
  setCanvasPages: (pages) => set({ canvasPages: pages }),
  setCanvasCurrentPageId: (id) => set({ canvasCurrentPageId: id }),
  lastCanvasAiPrompt: null,
  triggerCanvasAiPrompt: (text) => set({ lastCanvasAiPrompt: { text, timestamp: Date.now() } }),
  selectedLlmModel: 'gemini-1.5-flash',
  setSelectedLlmModel: (model) => set({ selectedLlmModel: model }),
  canvasTheme: 'default',
  setCanvasTheme: (theme) => set({ canvasTheme: theme }),
  canvasMode: 'all',
  setCanvasMode: (mode) => set({ canvasMode: mode }),
  dssSearchFilters: DEFAULT_DSS_FILTERS,
  setDssSearchFilters: (updater) => set((state) => ({
    dssSearchFilters: typeof updater === 'function' ? updater(state.dssSearchFilters) : { ...state.dssSearchFilters, ...updater }
  })),
  resetDssSearchFilters: () => set({ dssSearchFilters: DEFAULT_DSS_FILTERS }),
  availableLayoutPaths: [],
  setAvailableLayoutPaths: (paths) => set({ availableLayoutPaths: paths }),
  dslShellMode: 'dashboard',
  setDslShellMode: (mode) => set({ dslShellMode: mode }),
  dscShellMode: 'dashboard',
  setDscShellMode: (mode) => set({ dscShellMode: mode }),
  dspShellMode: 'dashboard',
  setDspShellMode: (mode) => set({ dspShellMode: mode }),
  dsdShellMode: 'dashboard',
  setDsdShellMode: (mode) => set({ dsdShellMode: mode }),
  dsrShellMode: 'dashboard',
  setDsrShellMode: (mode) => set({ dsrShellMode: mode }),
  dspGlobalFilter: 'following',
  setDspGlobalFilter: (filter) => set({ dspGlobalFilter: filter }),
  dsdGlobalFilter: 'all',
  setDsdGlobalFilter: (filter) => set({ dsdGlobalFilter: filter }),
  setCurrentMainView: (view) => set({ currentMainView: view }),
  setPanelSelection: (workspaceId, itemData) => set((state) => ({
    panelSelections: { ...state.panelSelections, [workspaceId]: itemData }
  })),
  setScopeDirty: (scope, dirty) => set((state) => {
    if (Boolean(state.dirtyScopes[scope]) === Boolean(dirty)) return state;
    return { dirtyScopes: { ...state.dirtyScopes, [scope]: Boolean(dirty) } };
  }),
  dspOpenSession: null,
  setDspOpenSession: (info) => set((state) => {
    const cur = state.dspOpenSession;
    if (cur?.workFileId === info?.workFileId && cur?.projectId === info?.projectId) return state;
    return { dspOpenSession: info };
  }),
  dspWorkingSessions: {},
  setDspWorkingSession: (workFileId, info) => set((state) => {
    const exists = state.dspWorkingSessions[workFileId];
    if (info) {
      if (exists && exists.projectId === info.projectId) return state;
      return { dspWorkingSessions: { ...state.dspWorkingSessions, [workFileId]: info } };
    }
    if (!exists) return state;
    const next = { ...state.dspWorkingSessions };
    delete next[workFileId];
    return { dspWorkingSessions: next };
  }),
  workingFiles: {},
  setWorkingFile: (key, info) => set((state) => {
    const exists = state.workingFiles[key];
    if (info) {
      if (exists && exists.scope === info.scope && exists.projectId === info.projectId &&
          exists.workFileId === info.workFileId && exists.name === info.name && exists.isNew === info.isNew) {
        return state;
      }
      return { workingFiles: { ...state.workingFiles, [key]: info } };
    }
    if (!exists) return state;
    const next = { ...state.workingFiles };
    delete next[key];
    return { workingFiles: next };
  }),
  setGlobalLaunchingTool: (tool) => set({ globalLaunchingTool: tool }),
  setGlobalModelsHub: (scope) => set((state) => ({
    activeProjectId: null,
    currentMainView: 'workspace',
    activeWorkspaceId: 'models',
    modelsScope: scope || 'global_following_models'
  })),
  setGlobalDspHub: () => set({
    activeProjectId: null,
    currentMainView: 'workspace',
    activeWorkspaceId: 'presents'
  }),
  setGlobalDslHub: () => set({
    activeProjectId: null,
    currentMainView: 'workspace',
    activeWorkspaceId: 'layout'
  }),
  setModelsScope: (scope) => set({ modelsScope: scope }),
  setDspScope: (scope) => set({ dspScope: scope }),
  setDslScope: (scope) => set({ dslScope: scope }),
  setDsdScope: (scope) => set({ dsdScope: scope }),
  setDsrScope: (scope) => set({ dsrScope: scope }),
  setDsiScope: (scope) => set({ dsiScope: scope }),
  setDsqScope: (scope) => set({ dsqScope: scope }),
  setDsfScope: (scope) => set({ dsfScope: scope }),
  toggleAIChat: () => set((state) => ({ isAIChatOpen: !state.isAIChatOpen })),
  setAIChatOpen: (open) => set({ isAIChatOpen: open }),
  toggleAIDrive: () => set((state) => ({ isAIDriveOpen: !state.isAIDriveOpen })),
  toggleAI3DCreate: () => set((state) => ({ isAI3DCreateOpen: !state.isAI3DCreateOpen })),
  setAI3DCreateOpen: (open) => set({ isAI3DCreateOpen: open }),
  setAIDriveOpen: (open) => set({ isAIDriveOpen: open }),
  setAIDriveExpanded: (expanded) => set({ isAIDriveExpanded: expanded }),
  setAI3DCreateExpanded: (expanded) => set({ isAI3DCreateExpanded: expanded }),
  toggleAIRender: () => set((state) => ({ isAIRenderOpen: !state.isAIRenderOpen })),
  setAIRenderOpen: (open) => set({ isAIRenderOpen: open }),
  setAIRenderExpanded: (expanded) => set({ isAIRenderExpanded: expanded }),
  toggleProjectSidebar: () => set((state) => ({ isProjectSidebarOpen: !state.isProjectSidebarOpen })),
  setProjectSidebarOpen: (open) => set({ isProjectSidebarOpen: open }),
  setProjects: (projects) => {
    set({ projects });
    const state = get();
    if (!state.isInitialized) {
      if (projects.length > 0) {
        set({ activeProjectId: projects[0].id, currentMainView: 'app-hub', isInitialized: true });
      } else {
        set({ isInitialized: true, currentMainView: 'app-hub' });
      }
    } else {
      const isValid = projects.some(p => p.id === state.activeProjectId);
      if (state.activeProjectId && !isValid) {
        set({ activeProjectId: null });
      }
    }
  },
  addRecentActivity: (projectId, activity) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === projectId 
        ? { ...p, recentActivities: [activity, ...(p.recentActivities || [])] }
        : p
    )
  })),
  setActiveProjectId: (id, navigateTo) => set((state) => {
    let nextWorkspaceId = state.activeWorkspaceId;

    if (navigateTo === 'home') {
      nextWorkspaceId = null;
    } else if (navigateTo === 'canvas') {
      nextWorkspaceId = 'canvas';
    } else if (id && state.lastActiveAppScope) {
      const scopeToId: Record<string, string> = { '3dss': 'models', '3dsl': 'layout', '3dsp': 'presents', '3dsc': 'create', '3dsd': 'diagram', '3dsr': 'drawing', '3dsi': 'image', '3dsq': 'quest', '3dsf': 'portfolio', 'canvas': 'canvas' };
      nextWorkspaceId = scopeToId[state.lastActiveAppScope] || null;
    }

    return { 
      activeProjectId: id, 
      currentMainView: id ? 'workspace' : state.currentMainView, 
      activeWorkspaceId: nextWorkspaceId, 
      lastLaunchPayload: null,
      panelSelections: id !== state.activeProjectId ? {} : state.panelSelections
    };
  }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setLastActiveAppScope: (scope) => set({ lastActiveAppScope: scope }),
  setLastLaunchPayload: (payload) => set({ lastLaunchPayload: payload }),
  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find(p => p.id === activeProjectId);
  },
  getActiveWorkspace: () => {
    const project = get().getActiveProject();
    const { activeWorkspaceId } = get();
    if (!project || !activeWorkspaceId) return undefined;
    
    const found = project.workspaces?.find(ws => ws.workspaceId === activeWorkspaceId || (ws as any).id === activeWorkspaceId);
    if (!found) {
      const standardMap: Record<string, object> = {
        'models': { workspaceId: 'models', id: 'models', name: 'S.Models', workspaceType: '3dss' },
        'layout': { workspaceId: 'layout', id: 'layout', name: 'S.Layout', workspaceType: '3dsl' },
        'presents': { workspaceId: 'presents', id: 'presents', name: 'S.Presentations', workspaceType: '3dsp' },
        'create': { workspaceId: 'create', id: 'create', name: 'S.Create', workspaceType: '3dsc' },
        'canvas': { workspaceId: 'canvas', id: 'canvas', name: 'AI Canvas', workspaceType: 'canvas' },
        'diagram': { workspaceId: 'diagram', id: 'diagram', name: 'S.Diagram', workspaceType: '3dsd' },
        'drawing': { workspaceId: 'drawing', id: 'drawing', name: 'S.Drawing', workspaceType: '3dsr' },
        'image': { workspaceId: 'image', id: 'image', name: 'S.Image', workspaceType: '3dsi' },
        'portfolio': { workspaceId: 'portfolio', id: 'portfolio', name: 'S.Portfolio', workspaceType: '3dsf' }
      };
      return standardMap[activeWorkspaceId] as any;
    }
    return found;
  }
}));
