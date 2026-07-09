import { create } from 'zustand';

// ──────────────────────────────────────────────────────────────────────────────
// S.Models「Local Models」スコープのローカル参照ソース管理ストア。
// 既定の LocalAssets\Models に加え、ユーザーが任意フォルダを参照ソースとして複数登録し、
// グリッドへの反映ON/OFF・削除・名称変更を一覧管理する。対象は S.Models が扱える
// 3Dモデル拡張子（3dm/glb/gltf/blend）のみ。実体はコピーせず asset:// 参照。
// 永続化は model_sources.json（アカウント私物）。S.Image の useImageSourcesStore と同型。
// ──────────────────────────────────────────────────────────────────────────────

/** Rust 側 ImageSource（モデルソースも同型）と一致。 */
export interface ModelSource {
  id: string;
  path: string;
  label: string;
  builtin: boolean;
  enabled: boolean;
  exists: boolean;
}

interface ModelSourcesState {
  sources: ModelSource[];
  loading: boolean;
  reloadKey: number;
  sourceFilter: string | null;
  setSourceFilter: (id: string | null) => void;

  // ソース内のサブフォルダ絞り込み（ソースルートからの相対パス。null = サブフォルダ指定なし）。
  subfolderFilter: string | null;
  setSubfolderFilter: (path: string | null) => void;
  // ソース＋サブフォルダをまとめて選択（ツリーのノードクリック用）。
  selectNode: (sourceId: string | null, subfolder: string | null) => void;

  counts: Record<string, number>;
  setCounts: (counts: Record<string, number>) => void;

  // sourceId → (サブフォルダ相対パス → 直下の素材数)。サイドバーのツリー用。
  subfolderCounts: Record<string, Record<string, number>>;
  setSubfolderCounts: (m: Record<string, Record<string, number>>) => void;

  refresh: () => Promise<void>;
  addSourceViaDialog: () => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  toggleSource: (id: string, enabled: boolean) => Promise<void>;
  renameSource: (id: string, label: string) => Promise<void>;
}

async function tauriCore() {
  const core = await import('@tauri-apps/api/core');
  return core.isTauri() ? core : null;
}

export const useModelSourcesStore = create<ModelSourcesState>((set, get) => ({
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
      const sources = await core.invoke<ModelSource[]>('list_model_sources');
      set({ sources, loading: false });
    } catch (e) {
      console.error('[useModelSourcesStore] list_model_sources failed', e);
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
      await core.invoke('add_model_source', { path: picked, label: null });
      await get().refresh();
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useModelSourcesStore] add_model_source failed', e);
      window.alert('フォルダの追加に失敗しました: ' + String(e));
    }
  },

  removeSource: async (id) => {
    const core = await tauriCore();
    if (!core) return;
    try {
      await core.invoke('remove_model_source', { id });
      if (get().sourceFilter === id) set({ sourceFilter: null });
      await get().refresh();
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useModelSourcesStore] remove_model_source failed', e);
      window.alert('ソースの削除に失敗しました: ' + String(e));
    }
  },

  toggleSource: async (id, enabled) => {
    const core = await tauriCore();
    if (!core) return;
    set((s) => ({ sources: s.sources.map((src) => (src.id === id ? { ...src, enabled } : src)) }));
    try {
      await core.invoke('update_model_source', { id, label: null, enabled });
      set((s) => ({ reloadKey: s.reloadKey + 1 }));
    } catch (e) {
      console.error('[useModelSourcesStore] toggle failed', e);
      await get().refresh();
    }
  },

  renameSource: async (id, label) => {
    const core = await tauriCore();
    if (!core) return;
    try {
      await core.invoke('update_model_source', { id, label, enabled: null });
      await get().refresh();
    } catch (e) {
      console.error('[useModelSourcesStore] rename failed', e);
      window.alert('名称の変更に失敗しました: ' + String(e));
    }
  },
}));
