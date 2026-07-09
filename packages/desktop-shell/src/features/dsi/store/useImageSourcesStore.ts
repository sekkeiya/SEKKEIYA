import { create } from 'zustand';

// ──────────────────────────────────────────────────────────────────────────────
// S.Image ローカル参照ソース管理ストア。
// 既定の LocalAssets に加え、ユーザーが任意のフォルダを「参照ソース」として複数登録し、
// グリッドへの反映ON/OFF・削除・名称変更を一覧で管理する。実体はコピーせず asset://
// 参照のみ（Rust 側 list_local_image_assets が走査）。永続化は sources.json（アカウント私物）。
// ──────────────────────────────────────────────────────────────────────────────

/** Rust 側 ImageSource と一致させる。 */
export interface ImageSource {
  /** 安定 ID。既定は "default"。 */
  id: string;
  /** 走査対象の OS フルパス。 */
  path: string;
  /** 表示名。 */
  label: string;
  /** 既定ソース（削除・改名・パス変更不可）。 */
  builtin: boolean;
  /** グリッドへ反映するか。 */
  enabled: boolean;
  /** フォルダが実在するか（接続状態ドット用）。 */
  exists: boolean;
}

interface ImageSourcesState {
  /** 登録済みソース一覧（既定を先頭に含む）。 */
  sources: ImageSource[];
  loading: boolean;
  /** 素材リストの再走査トリガ。ソース変更のたびに +1。 */
  reloadKey: number;
  /** グリッドのソース別フィルタ（null = すべて）。ソース切替時はサブフォルダ選択を解除。 */
  sourceFilter: string | null;
  setSourceFilter: (id: string | null) => void;

  /** グリッドのサブフォルダ別フィルタ（ソース内の相対パス。null = ソース全体）。 */
  subfolderFilter: string | null;
  setSubfolderFilter: (path: string | null) => void;
  /** ソース＋サブフォルダを一括選択（フォルダツリーのノードクリック）。 */
  selectNode: (sourceId: string | null, subfolder: string | null) => void;

  /** ソースID → 走査済み素材数。サイドバーの枚数バッジ用。 */
  counts: Record<string, number>;
  setCounts: (counts: Record<string, number>) => void;

  /** ソースID → サブフォルダ相対パス → 直下の件数。サイドバーのフォルダツリー用。 */
  subfolderCounts: Record<string, Record<string, number>>;
  setSubfolderCounts: (m: Record<string, Record<string, number>>) => void;

  /** Rust から最新のソース一覧を取得。 */
  refresh: () => Promise<void>;
  /** フォルダ選択ダイアログを開いてソースを追加。 */
  addSourceViaDialog: () => Promise<void>;
  /** 参照を外す（実体ファイルは削除しない）。 */
  removeSource: (id: string) => Promise<void>;
  /** 表示ON/OFF を切り替え。 */
  toggleSource: (id: string, enabled: boolean) => Promise<void>;
  /** 表示名を変更（既定は不可）。 */
  renameSource: (id: string, label: string) => Promise<void>;
}

async function tauriCore() {
  const core = await import('@tauri-apps/api/core');
  return core.isTauri() ? core : null;
}

export const useImageSourcesStore = create<ImageSourcesState>((set, get) => ({
  sources: [],
  loading: false,
  reloadKey: 0,
  sourceFilter: null,
  setSourceFilter: (sourceFilter) => set({ sourceFilter, subfolderFilter: null }),

  subfolderFilter: null,
  setSubfolderFilter: (subfolderFilter) => set({ subfolderFilter }),
  selectNode: (sourceId, subfolder) => set({ sourceFilter: sourceId, subfolderFilter: subfolder }),

  counts: {},
  setCounts: (counts) => set({ counts }),

  subfolderCounts: {},
  setSubfolderCounts: (subfolderCounts) => set({ subfolderCounts }),

  refresh: async () => {
    const core = await tauriCore();
    if (!core) { set({ sources: [], loading: false }); return; }
    set({ loading: true });
    try {
      const sources = await core.invoke<ImageSource[]>('list_image_sources');
      set({ sources, loading: false });
    } catch (e) {
      console.error('[useImageSourcesStore] list_image_sources failed', e);
      set({ loading: false });
    }
  },

  addSourceViaDialog: async () => {
    const core = await tauriCore();
    if (!core) return;
    const { open } = await import('@tauri-apps/plugin-dialog');
    const picked = await open({ directory: true, multiple: false, title: '参照するフォルダを選択' });
    if (!picked || typeof picked !== 'string') return;
    try {
      await core.invoke('add_image_source', { path: picked, label: null });
      await get().refresh();
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useImageSourcesStore] add_image_source failed', e);
      window.alert('フォルダの追加に失敗しました: ' + String(e));
    }
  },

  removeSource: async (id) => {
    const core = await tauriCore();
    if (!core) return;
    try {
      await core.invoke('remove_image_source', { id });
      // フィルタ中のソースを外したら全件表示へ戻す（サブフォルダ選択も解除）。
      if (get().sourceFilter === id) set({ sourceFilter: null, subfolderFilter: null });
      await get().refresh();
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useImageSourcesStore] remove_image_source failed', e);
      window.alert('ソースの削除に失敗しました: ' + String(e));
    }
  },

  toggleSource: async (id, enabled) => {
    const core = await tauriCore();
    if (!core) return;
    // 楽観的に反映。
    set((s) => ({ sources: s.sources.map((src) => (src.id === id ? { ...src, enabled } : src)) }));
    try {
      await core.invoke('update_image_source', { id, label: null, enabled });
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useImageSourcesStore] toggle failed', e);
      await get().refresh();
    }
  },

  renameSource: async (id, label) => {
    const core = await tauriCore();
    if (!core) return;
    try {
      await core.invoke('update_image_source', { id, label, enabled: null });
      await get().refresh();
    } catch (e) {
      console.error('[useImageSourcesStore] rename failed', e);
      window.alert('名称の変更に失敗しました: ' + String(e));
    }
  },
}));
