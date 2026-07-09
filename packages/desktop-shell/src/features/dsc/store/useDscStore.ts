import { create } from 'zustand';

export type ComponentType = 'panel' | 'frame' | 'door' | 'shelf' | 'top_board' | 'bottom_board' | 'back_panel' | 'side_panel' | 'leg';

export interface FurnitureComponent {
  id: string;
  type: ComponentType;
  name: string;
  position: [number, number, number]; // mm
  rotation: [number, number, number]; // degree
  dimensions: {
    width: number;  // mm
    height: number; // mm
    depth: number;  // mm
  };
  color: string;
}

export type ViewMode = '3d' | 'front' | 'side' | 'top' | 'quad' | 'plansec' | 'elevsec';
export type DscViewScope =
  | 'global_following_furniture' // フォロー中ユーザーの公開Furniture（Furniture タブ）
  | 'global_furniture'           // 全ユーザーの公開Furniture（Furniture タブ・All切替）
  | 'global_projects'            // 全ユーザーの公開プロジェクト（Public Projects タブ）
  | 'my_public_furniture'        // 自分の公開Furniture（Public Furniture タブ）
  | 'my_private_furniture'       // 自分の非公開Furniture（Private Furniture タブ）
  | 'project';                   // プロジェクト固有（My/Team Projects 内）

interface DscStoreState {
  furnitureName: string;
  components: FurnitureComponent[];
  legStyle: string; // 脚スタイルキー (table用)
  selectedId: string | null;
  viewMode: ViewMode;
  originContext: {
    boardId?: string;
    projectId?: string;
    workspaceId?: string;
    planId?: string;      // 3DSL layout plan ID (for insert-and-return)
    baseGlbUrl?: string;  // room GLB URL (for room ghost in 3DSC canvas)
    layoutItems?: Array<{
      id: string;
      position: [number, number, number];   // mm (3DSL world space)
      rotation: [number, number, number];
      dimensions: { width: number; height: number; depth: number }; // mm
      glbUrl?: string | null;               // resolved GLB/GLTF URL for the furniture model
    }>;
  } | null;

  showDscProjectBrowser: boolean;
  showDscRightSidebar: boolean;
  savedCount: number;
  currentWorkFileId: string | null;
  dscViewScope: DscViewScope;
  /** 未保存の編集があるか（タブの「作業中」ドット表示に使う） */
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  setFurnitureName: (name: string) => void;
  addComponent: (type: ComponentType) => void;
  updateComponent: (id: string, updates: Partial<FurnitureComponent>) => void;
  removeComponent: (id: string) => void;
  selectComponent: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setOriginContext: (ctx: DscStoreState['originContext']) => void;
  setShowDscProjectBrowser: (show: boolean) => void;
  setShowDscRightSidebar: (show: boolean) => void;
  incrementSavedCount: () => void;
  setCurrentWorkFileId: (id: string | null) => void;
  setLegStyle: (style: string) => void;
  setDscViewScope: (scope: DscViewScope) => void;
  loadWorkFile: (workFile: { id: string; name?: string; componentsJson?: string }) => void;
  resetStudio: () => void;
  setComponents: (components: FurnitureComponent[]) => void;
  duplicateComponent: (id: string) => void;

  // ── 作業状態の退避/復元（画面切替・別ファイル切替で未保存を失わない） ──
  sessionCache: Record<string, DscSessionSnapshot>;
  /** 現在の編集状態を sessionCache に退避（dirty のときのみ）。 */
  stashWorkspace: () => void;
  /** sessionCache から復元。成功で true。 */
  restoreSession: (key: string) => boolean;
  hasSession: (key: string) => boolean;
  clearSession: (key: string) => void;
}

/** 新規（未保存）造作家具のセッションキー。 */
export const DSC_NEW_SESSION_KEY = '__dsc_new__';

export interface DscSessionSnapshot {
  furnitureName: string;
  components: FurnitureComponent[];
  legStyle: string;
  selectedId: string | null;
  viewMode: ViewMode;
  currentWorkFileId: string | null;
  originContext: DscStoreState['originContext'];
  dirty: boolean;
}

const DEFAULT_DIMENSIONS: Record<ComponentType, FurnitureComponent['dimensions']> = {
  panel:        { width: 400, height: 18,  depth: 350 },
  frame:        { width: 30,  height: 720, depth: 30  },
  door:         { width: 300, height: 600, depth: 18  },
  shelf:        { width: 400, height: 18,  depth: 300 },
  top_board:    { width: 800, height: 24,  depth: 400 },
  bottom_board: { width: 764, height: 18,  depth: 400 },
  back_panel:   { width: 764, height: 720, depth: 9   },
  side_panel:   { width: 18,  height: 720, depth: 400 },
  leg:          { width: 60,  height: 700, depth: 60  },
};

let componentCounter = 1;

export const useDscStore = create<DscStoreState>((set, get) => ({
  furnitureName: '新規造作家具',
  components: [],
  legStyle: 'square',
  selectedId: null,
  viewMode: '3d',
  originContext: null,
  showDscProjectBrowser: false,
  showDscRightSidebar: true,
  savedCount: 0,
  currentWorkFileId: null,
  dscViewScope: 'global_following_furniture',
  dirty: false,
  sessionCache: {},

  setDirty: (dirty) => set({ dirty: Boolean(dirty) }),

  stashWorkspace: () => set((state) => {
    if (!state.dirty) return {};
    const key = state.currentWorkFileId || DSC_NEW_SESSION_KEY;
    return {
      sessionCache: {
        ...state.sessionCache,
        [key]: {
          furnitureName: state.furnitureName,
          components: state.components,
          legStyle: state.legStyle,
          selectedId: state.selectedId,
          viewMode: state.viewMode,
          currentWorkFileId: state.currentWorkFileId,
          originContext: state.originContext,
          dirty: true,
        },
      },
    };
  }),

  restoreSession: (key) => {
    const snap = get().sessionCache[key];
    if (!snap) return false;
    set({
      furnitureName: snap.furnitureName,
      components: snap.components,
      legStyle: snap.legStyle,
      selectedId: snap.selectedId,
      viewMode: snap.viewMode,
      currentWorkFileId: snap.currentWorkFileId,
      originContext: snap.originContext,
      dirty: true,
    });
    return true;
  },

  hasSession: (key) => Boolean(get().sessionCache[key]),

  clearSession: (key) => set((state) => {
    if (!state.sessionCache[key]) return {};
    const next = { ...state.sessionCache };
    delete next[key];
    return { sessionCache: next };
  }),

  setFurnitureName: (name) => set({ furnitureName: name, dirty: true }),
  setLegStyle: (style) => set({ legStyle: style }),

  addComponent: (type) => {
    const id = `comp_${Date.now()}_${componentCounter++}`;
    const newComp: FurnitureComponent = {
      id,
      type,
      name: `${type}_${componentCounter}`,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { ...DEFAULT_DIMENSIONS[type] },
      color: '#c8a882',
    };
    set(state => ({ components: [...state.components, newComp], selectedId: id, dirty: true }));
  },

  updateComponent: (id, updates) =>
    set(state => ({
      components: state.components.map(c => c.id === id ? { ...c, ...updates } : c),
      dirty: true,
    })),

  removeComponent: (id) =>
    set(state => ({
      components: state.components.filter(c => c.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      dirty: true,
    })),

  selectComponent: (id) => set({ selectedId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setOriginContext: (ctx) => set({ originContext: ctx }),
  setShowDscProjectBrowser: (show) => set({ showDscProjectBrowser: show }),
  setShowDscRightSidebar: (show) => set({ showDscRightSidebar: show }),
  incrementSavedCount: () => set(state => ({ savedCount: state.savedCount + 1 })),
  setCurrentWorkFileId: (id) => set({ currentWorkFileId: id }),
  setDscViewScope: (scope) => set({ dscViewScope: scope }),
  setComponents: (comps) => set({ components: comps, selectedId: null, dirty: true }),
  duplicateComponent: (id) => set(state => {
    const src = state.components.find(c => c.id === id);
    if (!src) return {};
    const newId = `comp_${Date.now()}_${componentCounter++}`;
    const dup: FurnitureComponent = {
      ...src,
      id: newId,
      name: `${src.name}_2`,
      position: [src.position[0] + 50, src.position[1], src.position[2]],
    };
    return { components: [...state.components, dup], selectedId: newId, dirty: true };
  }),
  loadWorkFile: (workFile) => {
    const state = get();
    // 1) 退出する編集が未保存なら退避
    if (state.dirty && (state.components.length > 0 || state.currentWorkFileId)) {
      const outKey = state.currentWorkFileId || DSC_NEW_SESSION_KEY;
      set({
        sessionCache: {
          ...state.sessionCache,
          [outKey]: {
            furnitureName: state.furnitureName,
            components: state.components,
            legStyle: state.legStyle,
            selectedId: state.selectedId,
            viewMode: state.viewMode,
            currentWorkFileId: state.currentWorkFileId,
            originContext: state.originContext,
            dirty: true,
          },
        },
      });
    }
    // 2) 再開するファイルに未保存セッションがあればそれを優先復元
    const incoming = get().sessionCache[workFile.id];
    if (incoming) {
      set({
        furnitureName: incoming.furnitureName,
        components: incoming.components,
        legStyle: incoming.legStyle,
        selectedId: incoming.selectedId,
        viewMode: incoming.viewMode,
        currentWorkFileId: incoming.currentWorkFileId,
        originContext: incoming.originContext,
        dirty: true,
      });
      return;
    }
    // 3) 通常ロード
    let components: FurnitureComponent[] = [];
    try {
      if (workFile.componentsJson) components = JSON.parse(workFile.componentsJson);
    } catch {}
    set({
      furnitureName: workFile.name || '新規造作家具',
      components,
      selectedId: null,
      currentWorkFileId: workFile.id,
      viewMode: '3d',
      dirty: false,
    });
  },
  resetStudio: () => set({
    furnitureName: '新規造作家具',
    components: [],
    legStyle: 'square',
    selectedId: null,
    viewMode: '3d',
    originContext: null,
    showDscProjectBrowser: false,
    showDscRightSidebar: true,
    currentWorkFileId: null,
    dirty: false,
  }),
}));
