import { create } from 'zustand';
import type { DesktopProject, WorkspacePayload, WorkspaceLaunchPayload, ActivityItem } from '../features/projects/types';
import type { AppScope } from '../shared/layout/workspace/types';
export type ModelsScope = 'global_models' | 'global_following_models' | 'global_projects' | 'global_following_projects' | 'my_public_models' | 'my_private_models' | 'project_models' | 'team_project_models' | 'view_public_project_models' | 'local_models';
export type DspScope = 'global_presentations' | 'global_projects' | 'my_public_presentations' | 'my_private_presentations' | 'project_presentations' | 'team_project_presentations' | 'my_templates';

/** テンプレ下書き用の隠しワークスペース名。プロジェクト一覧からは除外される（表示しない）。 */
export const TEMPLATE_WORKSPACE_NAME = '📋 テンプレート下書き';
export type DslScope = 'global_layouts' | 'global_following_layouts' | 'global_projects' | 'my_public_layouts' | 'my_private_layouts' | 'project_layouts' | 'team_project_layouts';
export type DsdScope = 'global_diagrams' | 'global_projects' | 'my_public_diagrams' | 'my_private_diagrams' | 'project_diagrams' | 'team_project_diagrams';
export type DsrScope = 'global_drawings' | 'global_projects' | 'my_public_drawings' | 'my_private_drawings' | 'project_drawings' | 'team_project_drawings';
export type DsiScope = 'global_images' | 'global_projects' | 'my_public_images' | 'my_private_images' | 'project_images' | 'team_project_images' | 'local_assets';
export type DsqScope = 'global_courses' | 'global_projects' | 'my_public_courses' | 'my_private_courses' | 'project_courses' | 'team_project_courses';
export type DsfScope = 'global_portfolios' | 'global_projects' | 'my_public_portfolios' | 'my_private_portfolios' | 'project_portfolios' | 'team_project_portfolios';
export type DsmScope = 'global_movies' | 'global_projects' | 'local_movies' | 'my_public_movies' | 'my_private_movies' | 'project_movies' | 'team_project_movies';
export type DsmtScope = 'global_materials' | 'global_projects' | 'local_assets' | 'my_public_materials' | 'my_private_materials' | 'project_materials' | 'team_project_materials';
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
const DEFAULT_PINNED_TABS = ['3dss', '3dsl', '3dsp', '3dsc', '3dsd', '3dsr', '3dsi', '3dsq', '3dsf', '3dsb', '3dsm', '3dsmt'];
const REQUIRED_TABS = ['3dsd', '3dsr', '3dsi', '3dsf', '3dsb', '3dsm', '3dsmt'];

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
  dsmScope: DsmScope;
  dsmtScope: DsmtScope;
  activeDiagramId: string | null;
  isAIChatOpen: boolean;
  /** SEKKEIYA OS を独立ネイティブ窓（ポップアウト）へ切り出しているか。true の間は本体内チャットは
   *  開かない（会話は1箇所＝ポップアウト窓に集約する）。窓を閉じると false に戻る。 */
  isChatPoppedOut: boolean;
  setChatPoppedOut: (v: boolean) => void;
  /** SEKKEIYA Chat を右ドックから切り離してフローティング表示にしているか。 */
  isAIChatDetached: boolean;
  /** フローティング・チャットをピン留めして開いたまま維持しているか（未ピンはホバーを外すと自動収納）。 */
  isAIChatPinned: boolean;
  /** 🔊 SEKKEIYA Chat の音声モード。ONにするとAIの応答を自動で読み上げる（設定はlocalStorageに永続化）。 */
  isChatVoiceModeOn: boolean;
  toggleChatVoiceMode: () => void;
  /** 右下ピルをホバー中か（ホバーで“ピーク”表示するための連携フラグ）。 */
  chatHoverPill: boolean;
  /** フローティング・チャット本体をホバー中か。 */
  chatHoverPanel: boolean;
  /** SEKKEIYA Chat フローティングパネル（コックピット）の表示タブ。chat/drive/teamchat/render/gen3d を内包。 */
  chatPanelTab: 'chat' | 'drive' | 'teamchat' | 'render' | 'gen3d';
  /** SEKKEIYA SEARCH（横断検索ダイアログ）の表示状態。MiniSidebar の検索と Chat ハブで共有。 */
  isGlobalSearchOpen: boolean;
  /** プロジェクトメンバー間チャット（Team Chat）パネル。 */
  isTeamChatOpen: boolean;
  /** Project Chat のトーク選択サイドバー（LINE のトーク一覧に相当）。 */
  isTeamChatSidebarOpen: boolean;
  isChatHistorySidebarOpen: boolean;
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
  userSettingsOpen: boolean;
  userSettingsInitialTab: number;
  openUserSettings: (tab?: number) => void;
  closeUserSettings: () => void;
  pendingScreenshot: string | null;
  setPendingScreenshot: (url: string | null) => void;
  isScreenshotDialogOpen: boolean;
  setScreenshotDialogOpen: (open: boolean) => void;
  openAI3DCreate: (payload: { baseImage: string; projectId: string | null; workspaceId: string | null }) => void;
  openAIRender: (payload: { baseImage: string; projectId: string | null; workspaceId: string | null }) => void;
  globalLaunchingTool: string | null;
  currentMainView: 'workspace' | 'project-management' | 'ai-studio' | 'marketplace' | 'creator-profile' | 'my-site' | 'team-site' | 'global-settings' | 'teams' | 'gallery';
  /** チャット等から ProjectHome のタブを切り替えるための pending state。null = 変更なし */
  pendingProjectTab: string | null;
  setPendingProjectTab: (tab: string | null) => void;
  /** FloatingPanel 等から新規タスク作成を起動するための pending state。'manual'|'ai'|null */
  pendingOpenNewTask: string | null;
  setPendingOpenNewTask: (type: string | null) => void;
  /** ウォークスルー等から S.Model のモデル詳細を開くための pending state（model オブジェクト）。 */
  pendingModelDetail: any | null;
  setPendingModelDetail: (model: any | null) => void;
  /** S.Model のアップロード完了後に自動で戻る画面（例: S.Layout からの画像→3D生成）。 */
  pendingReturnView: { mainView: any; workspaceId: string | null; appScope: any } | null;
  setPendingReturnView: (v: { mainView: any; workspaceId: string | null; appScope: any } | null) => void;
  /** ProjectHome の現在タブ（プロジェクト切り替え後も維持）。'home' | 'workfiles' | 'schedule' | 'memo' */
  activeProjectTab: string;
  setActiveProjectTab: (tab: string) => void;
  viewingPublicProjectId: string | null;
  setViewingPublicProjectId: (id: string | null) => void;
  viewingPublicProjectName: string | null;
  setViewingPublicProjectName: (name: string | null) => void;
  viewingCreatorId: string | null;
  setViewingCreatorId: (id: string | null) => void;
  /** クリエイターページ(マイページ)を開く前にいたメインビュー。←ボタンで戻る先 */
  creatorProfileReturnView: string | null;
  setCreatorProfileReturnView: (view: string | null) => void;
  panelSelections: Record<string, any>;
  /** 子アプリ（タブ scope）ごとの未保存フラグ。タブ上の「作業中」ドット表示に使う。 */
  dirtyScopes: Record<string, boolean>;
  setScopeDirty: (scope: string, dirty: boolean) => void;
  /** 現在 S.Slide エディターで開いているプレゼン（青ハイライト表示用）。 */
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
  dsmShellMode: 'dashboard' | 'editor';
  setDsmShellMode: (mode: 'dashboard' | 'editor') => void;
  dsiShellMode: 'dashboard' | 'editor';
  setDsiShellMode: (mode: 'dashboard' | 'editor') => void;
  dssShellMode: 'dashboard' | 'editor';
  setDssShellMode: (mode: 'dashboard' | 'editor') => void;
  dspGlobalFilter: 'following' | 'all';
  setDspGlobalFilter: (filter: 'following' | 'all') => void;
  /** S.Slide の種別フィルタ（すべて/スライド/無限ボード）。ビュー横断で共有し、テンプレ⇄プレゼン切替時も保持する。 */
  dspTypeFilter: 'all' | 'presentation' | 'canvas';
  setDspTypeFilter: (v: 'all' | 'presentation' | 'canvas') => void;
  dsdGlobalFilter: 'following' | 'all';
  setDsdGlobalFilter: (filter: 'following' | 'all') => void;
  dsmtGlobalFilter: 'following' | 'all';
  setDsmtGlobalFilter: (filter: 'following' | 'all') => void;
  setCurrentMainView: (view: 'workspace' | 'project-management' | 'ai-studio' | 'marketplace' | 'creator-profile' | 'my-site' | 'team-site' | 'global-settings' | 'teams' | 'gallery') => void;
  setPanelSelection: (workspaceId: string, itemData: any | null) => void;
  setGlobalLaunchingTool: (tool: string | null) => void;
  setGlobalModelsHub: (scope?: ModelsScope) => void;
  setGlobalDspHub: () => void;
  toggleProjectSidebar: () => void;
  setProjectSidebarOpen: (open: boolean) => void;
  setProjects: (projects: DesktopProject[]) => void;
  patchProject: (id: string, patch: Partial<DesktopProject>) => void;
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
  setDsmScope: (scope: DsmScope) => void;
  setDsmtScope: (scope: DsmtScope) => void;
  setActiveDiagramId: (id: string | null) => void;
  setGlobalDslHub: () => void;
  toggleAIChat: () => void;
  setAIChatOpen: (open: boolean) => void;
  toggleAIChatDetached: () => void;
  setAIChatDetached: (v: boolean) => void;
  toggleAIChatPinned: () => void;
  setAIChatPinned: (v: boolean) => void;
  setChatHoverPill: (v: boolean) => void;
  setChatHoverPanel: (v: boolean) => void;
  /** ピーク（未ピンのフローティング）をホバーで即時に開く／予約収納／予約キャンセル。 */
  openChatPeek: () => void;
  closeChatPeekSoon: () => void;
  cancelChatPeekClose: () => void;
  setChatPanelTab: (tab: 'chat' | 'drive' | 'teamchat' | 'render' | 'gen3d') => void;
  setGlobalSearchOpen: (open: boolean) => void;
  toggleGlobalSearch: () => void;
  toggleTeamChat: () => void;
  setTeamChatOpen: (open: boolean) => void;
  toggleTeamChatSidebar: () => void;
  toggleChatHistorySidebar: () => void;
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
  /** AIタスクボタン位置計算用。outerRight(MainLayout右パネル) + innerRight(WorkspaceShell右パネル) + MARGIN = right値。extraBottom + MARGIN = bottom値 */
  aiTaskOuterRight: number;
  aiTaskInnerRight: number;
  aiTaskExtraBottom: number;
  setAiTaskOuterRight: (px: number) => void;
  setAiTaskInnerRight: (px: number) => void;
  setAiTaskExtraBottom: (px: number) => void;
}

// ピーク（フローティング・チャット）の収納予約タイマー（モジュールスコープで共有）。
let peekCloseTimer: ReturnType<typeof setTimeout> | null = null;
// 直近にピーク表示を開いた時刻。開いた直後はポインタがパネルへ乗り移る猶予を与え、
// 表示直後の誤クローズ（pointerEvents 反映前 / アニメ中の取りこぼし）を防ぐ。
let peekOpenedAt = 0;
const PEEK_OPEN_GRACE_MS = 100;

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
  // 起動直後・プロジェクト未選択時は各アプリのグローバル一覧（Models / Layouts /
  // Presentations）を表示する。プロジェクトをサイドバーで選ぶと handleProjectSelect が
  // project_* スコープへ切り替え、そのプロジェクトの一覧を表示する。
  modelsScope: 'global_following_models',
  dspScope: 'global_presentations',
  dslScope: 'global_following_layouts',
  // S.Diagram / S.Drawing / S.Image / S.Portfolio も同様にグローバル一覧を既定とする。
  // プロジェクト選択時のみ project_* へ切り替わり、そのプロジェクトの一覧を表示する。
  dsdScope: 'global_diagrams',
  dsrScope: 'global_drawings',
  dsiScope: 'global_images',
  dsqScope: 'global_courses',
  dsfScope: 'global_portfolios',
  // S.Movie はクラウドのグローバル一覧が設計上空（動画はローカル管理）。未選択時は
  // ローカル素材一覧を既定として表示し、プロジェクト選択時のみ project_movies に切り替わる。
  dsmScope: 'local_movies',
  dsmtScope: 'global_materials',
  activeDiagramId: null,
  setActiveDiagramId: (activeDiagramId) => set({ activeDiagramId }),
  isAIChatOpen: false,
  isChatPoppedOut: false,
  setChatPoppedOut: (v) => set(v ? { isChatPoppedOut: true, isAIChatOpen: false } : { isChatPoppedOut: false }),
  isAIChatDetached: false,
  isAIChatPinned: false,
  isChatVoiceModeOn: (() => { try { return localStorage.getItem('sekkeiya-chat-voice-mode') === '1'; } catch { return false; } })(),
  toggleChatVoiceMode: () => set((state) => {
    const next = !state.isChatVoiceModeOn;
    try { localStorage.setItem('sekkeiya-chat-voice-mode', next ? '1' : '0'); } catch { /* noop */ }
    return { isChatVoiceModeOn: next };
  }),
  chatHoverPill: false,
  chatHoverPanel: false,
  chatPanelTab: 'chat',
  isGlobalSearchOpen: false,
  isTeamChatOpen: false,
  isTeamChatSidebarOpen: false,
  isChatHistorySidebarOpen: true,
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
  userSettingsOpen: false,
  userSettingsInitialTab: 0,
  openUserSettings: (tab = 0) => set({ userSettingsOpen: true, userSettingsInitialTab: tab }),
  closeUserSettings: () => set({ userSettingsOpen: false, userSettingsInitialTab: 0 }),
  pendingScreenshot: null,
  setPendingScreenshot: (url) => set({ pendingScreenshot: url }),
  isScreenshotDialogOpen: false,
  setScreenshotDialogOpen: (open) => set({ isScreenshotDialogOpen: open }),
  
  openAI3DCreate: ({ baseImage, projectId, workspaceId }) => {
    set({ 
      isAI3DCreateOpen: true,
      isAIRenderOpen: false,
      isAIDriveOpen: false,
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
      isScreenshotDialogOpen: false,
      pendingScreenshot: null 
    });
    const store = useAIRenderStore.getState();
    store.setImageUrl(baseImage);
    store.setContext(projectId, workspaceId);
  },

  globalLaunchingTool: null,
  currentMainView: 'my-site',
  viewingPublicProjectId: null,
  setViewingPublicProjectId: (id) => set({ viewingPublicProjectId: id }),
  viewingPublicProjectName: null,
  setViewingPublicProjectName: (name) => set({ viewingPublicProjectName: name }),
  viewingCreatorId: null,
  setViewingCreatorId: (id) => set({ viewingCreatorId: id }),
  creatorProfileReturnView: null,
  setCreatorProfileReturnView: (view) => set({ creatorProfileReturnView: view }),
  panelSelections: {},
  dirtyScopes: {},
  canvasPages: [],
  canvasCurrentPageId: null,
  setCanvasPages: (pages) => set({ canvasPages: pages }),
  setCanvasCurrentPageId: (id) => set({ canvasCurrentPageId: id }),
  lastCanvasAiPrompt: null,
  triggerCanvasAiPrompt: (text) => set({ lastCanvasAiPrompt: { text, timestamp: Date.now() } }),
  selectedLlmModel: 'auto', // 既定は自動振り分け（軽い会話=Haiku / 実務・重要=Sonnet）
  setSelectedLlmModel: (model) => set({ selectedLlmModel: model }),
  aiTaskOuterRight: 0,
  aiTaskInnerRight: 0,
  aiTaskExtraBottom: 0,
  setAiTaskOuterRight: (px) => set({ aiTaskOuterRight: px }),
  setAiTaskInnerRight: (px) => set({ aiTaskInnerRight: px }),
  setAiTaskExtraBottom: (px) => set({ aiTaskExtraBottom: px }),
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
  dsmShellMode: 'dashboard',
  setDsmShellMode: (mode) => set({ dsmShellMode: mode }),
  dsiShellMode: 'dashboard',
  setDsiShellMode: (mode) => set({ dsiShellMode: mode }),
  dssShellMode: 'dashboard',
  setDssShellMode: (mode) => set({ dssShellMode: mode }),
  dspGlobalFilter: 'following',
  setDspGlobalFilter: (filter) => set({ dspGlobalFilter: filter }),
  dspTypeFilter: 'all',
  setDspTypeFilter: (v) => set({ dspTypeFilter: v }),
  dsdGlobalFilter: 'all',
  setDsdGlobalFilter: (filter) => set({ dsdGlobalFilter: filter }),
  dsmtGlobalFilter: 'all',
  setDsmtGlobalFilter: (filter) => set({ dsmtGlobalFilter: filter }),
  setCurrentMainView: (view) => set({ currentMainView: view }),
  pendingProjectTab: null,
  setPendingProjectTab: (tab) => set({ pendingProjectTab: tab }),
  pendingOpenNewTask: null,
  setPendingOpenNewTask: (type) => set({ pendingOpenNewTask: type }),
  pendingModelDetail: null,
  setPendingModelDetail: (model) => set({ pendingModelDetail: model }),
  pendingReturnView: null,
  setPendingReturnView: (v) => set({ pendingReturnView: v }),
  activeProjectTab: 'home',
  setActiveProjectTab: (tab) => set({ activeProjectTab: tab }),
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
  setDsmScope: (scope) => set({ dsmScope: scope }),
  setDsmtScope: (scope) => set({ dsmtScope: scope }),
  // ポップアウト窓へ切り出している間は本体内チャットを開かせない（会話を1箇所に集約）。
  // 閉じる方向（open=false / トグルで閉じる）は常に許可する。
  // toggleAIChat はユーザー操作の想定なので、開こうとしたら既存のポップアウト窓を前面に出して応答する
  // （setAIChatOpen(true) は自動オープン等プログラム用途があるため、こちらは無反応＝フォーカスを奪わない）。
  toggleAIChat: () => set((state) => {
    if (state.isChatPoppedOut && !state.isAIChatOpen) {
      import('../utils/openChatWindow').then(m => m.focusChatWindowIfOpen()).catch(() => {});
      return {};
    }
    return { isAIChatOpen: !state.isAIChatOpen };
  }),
  setAIChatOpen: (open) => set((state) => (open && state.isChatPoppedOut ? {} : { isAIChatOpen: open })),
  toggleAIChatDetached: () => set((state) => ({ isAIChatDetached: !state.isAIChatDetached })),
  setAIChatDetached: (v) => set({ isAIChatDetached: v }),
  toggleAIChatPinned: () => set((state) => ({ isAIChatPinned: !state.isAIChatPinned })),
  setAIChatPinned: (v) => set({ isAIChatPinned: v }),
  // 値が変わらないときは set しない（全体購読しているコンポーネントの無駄な再描画を防ぐ）。
  setChatHoverPill: (v) => { if (get().chatHoverPill !== v) set({ chatHoverPill: v }); },
  setChatHoverPanel: (v) => { if (get().chatHoverPanel !== v) set({ chatHoverPanel: v }); },
  openChatPeek: () => {
    if (peekCloseTimer) { clearTimeout(peekCloseTimer); peekCloseTimer = null; }
    // ピルにホバーした時刻を記録（パネルへ乗り移る猶予の起点）。
    peekOpenedAt = Date.now();
    // 同期的に開く（イベントハンドラ内で即時表示。useEffect を介さない）。
    // 既に開いていれば set しない（無駄な再描画を防ぐ）。
    const st = get();
    // ポップアウト窓へ切り出している間は本体内チャットを開かない。
    if (st.isChatPoppedOut) return;
    if (st.isAIChatDetached && st.isAIChatOpen) return;
    const patch: Partial<AppState> = {};
    if (!st.isAIChatDetached) patch.isAIChatDetached = true;
    if (!st.isAIChatOpen) patch.isAIChatOpen = true;
    set(patch);
  },
  cancelChatPeekClose: () => {
    if (peekCloseTimer) { clearTimeout(peekCloseTimer); peekCloseTimer = null; }
  },
  closeChatPeekSoon: () => {
    if (peekCloseTimer) clearTimeout(peekCloseTimer);
    const run = () => {
      peekCloseTimer = null;
      const st = get();
      // ピン留め中／ピル・パネルをホバー中なら閉じない（ピル↔パネルの移動を許容）。
      if (st.isAIChatPinned || st.chatHoverPill || st.chatHoverPanel) return;
      // 開いた直後はポインタがピル→パネルへ乗り移る猶予を与える（表示直後の誤クローズ防止）。
      // パネルが pointerEvents:auto になりアニメが落ち着くまでの取りこぼしを吸収する。
      if (Date.now() - peekOpenedAt < PEEK_OPEN_GRACE_MS) {
        peekCloseTimer = setTimeout(run, 30);
        return;
      }
      // モデル選択・添付・履歴などのメニュー/ダイアログ表示中は閉じない。
      if (typeof document !== 'undefined' &&
          document.querySelector('.MuiPopover-root, .MuiMenu-root, .MuiDialog-root, .MuiModal-root')) {
        peekCloseTimer = setTimeout(run, 150);
        return;
      }
      set({ isAIChatOpen: false });
    };
    // 0ms（次ティック）。ピル→パネルへ移る瞬間の mouseleave→mouseenter で即キャンセルできる。
    peekCloseTimer = setTimeout(run, 0);
  },
  setChatPanelTab: (tab) => set({ chatPanelTab: tab }),
  setGlobalSearchOpen: (open) => set({ isGlobalSearchOpen: open }),
  toggleGlobalSearch: () => set((state) => ({ isGlobalSearchOpen: !state.isGlobalSearchOpen })),
  toggleTeamChat: () => set((state) => ({ isTeamChatOpen: !state.isTeamChatOpen })),
  setTeamChatOpen: (open) => set({ isTeamChatOpen: open }),
  toggleTeamChatSidebar: () => set((state) => ({ isTeamChatSidebarOpen: !state.isTeamChatSidebarOpen })),
  toggleChatHistorySidebar: () => set((state) => ({ isChatHistorySidebarOpen: !state.isChatHistorySidebarOpen })),
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
    // テンプレ下書き用の隠しワークスペースは一覧に載せない（全サイドバー/ピッカーから除外）。
    // ただし有効性チェックは raw（隠しWS含む）で行い、下書き編集中に activeProjectId を消さない。
    const visible = projects.filter(p => (p as any)?.name !== TEMPLATE_WORKSPACE_NAME);
    set({ projects: visible });
    const state = get();
    if (!state.isInitialized) {
      // ログイン後の最初のダッシュボード＝アカウントサイト（マイページ）
      if (visible.length > 0) {
        set({ activeProjectId: visible[0].id, currentMainView: 'my-site', isInitialized: true });
      } else {
        set({ isInitialized: true, currentMainView: 'my-site' });
      }
    } else {
      const isValid = projects.some(p => p.id === state.activeProjectId);
      if (state.activeProjectId && !isValid) {
        set({ activeProjectId: null });
      }
    }
  },
  patchProject: (id, patch) => set((state) => ({
    projects: state.projects.map(p => (p.id === id ? { ...p, ...patch } : p)),
  })),
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
      const scopeToId: Record<string, string> = { '3dss': 'models', '3dsl': 'layout', '3dsp': 'presents', '3dsc': 'create', '3dsd': 'diagram', '3dsr': 'drawing', '3dsi': 'image', '3dsq': 'quest', '3dsf': 'portfolio', '3dsm': 'movie', 'canvas': 'canvas' };
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
        'models': { workspaceId: 'models', id: 'models', name: 'S.Model', workspaceType: '3dss' },
        'layout': { workspaceId: 'layout', id: 'layout', name: 'S.Layout', workspaceType: '3dsl' },
        'presents': { workspaceId: 'presents', id: 'presents', name: 'S.Slide', workspaceType: '3dsp' },
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
