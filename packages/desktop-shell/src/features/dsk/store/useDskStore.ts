import { create } from 'zustand';
import type { LibraryEntry, KnowledgeKind } from '../types';
import type { CatalogVisionItem } from '../catalog/catalogVisionStore';
import { getLocalKnowledge, deleteKnowledgeEntry, updateKnowledgeEntry } from '../api/knowledgeApi';
import { getLocalDocumentEntries } from '../lib/localFiles';
import { getSLibraryEntries } from '../lib/sLibraryFiles';

export type KindFilter = 'all' | KnowledgeKind;

interface DskStoreState {
  entries: LibraryEntry[];
  loading: boolean;
  error: string | null;

  /** メインビュー（知識ライブラリ / 外付け脳(RAG) / 索引済み商品 / おすすめソース） */
  view: 'library' | 'brain' | 'products' | 'registry';
  setView: (v: 'library' | 'brain' | 'products' | 'registry') => void;

  /** kind フィルタ（すべて / 書籍 / PDF / Web / メモ） */
  kindFilter: KindFilter;
  setKindFilter: (f: KindFilter) => void;

  /** カテゴリフィルタ（'all' or カテゴリ名） */
  categoryFilter: string;
  setCategoryFilter: (c: string) => void;

  /** フリーワード検索 */
  search: string;
  setSearch: (s: string) => void;

  /** プロジェクト絞り込み（null=絞り込まない） */
  projectFilter: string | null;
  setProjectFilter: (id: string | null) => void;

  /** 右パネルで詳細表示中のエントリ */
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;

  /** 索引商品ビューで右パネルに詳細表示中の商品 */
  selectedProduct: CatalogVisionItem | null;
  setSelectedProduct: (p: CatalogVisionItem | null) => void;

  /** 本ビューアで開いているエントリ（null=閉じている） */
  viewerId: string | null;
  setViewerId: (id: string | null) => void;

  // ── RAGソース複数選択（一括取り込み）──
  /** RAG選択モード（チェックボックス表示） */
  ragSelectMode: boolean;
  setRagSelectMode: (on: boolean) => void;
  /** RAG取り込み対象に選択中の localId 集合 */
  ragSelection: Set<string>;
  toggleRagSelection: (localId: string) => void;
  setRagSelection: (ids: string[]) => void;
  clearRagSelection: () => void;

  /** ローカルインデックスを再読込 */
  refresh: () => Promise<void>;
  /** エントリを upsert（保存・更新後にローカル状態へ反映） */
  upsert: (entry: LibraryEntry) => void;
  /** 削除（Tauri + ローカル状態） */
  remove: (localId: string) => Promise<void>;
  /** 部分更新を Tauri に反映しつつローカルも更新 */
  patch: (entry: LibraryEntry) => Promise<LibraryEntry>;
}

export const useDskStore = create<DskStoreState>((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  view: 'library',
  setView: (view) => set({ view }),

  kindFilter: 'all',
  setKindFilter: (kindFilter) => set({ kindFilter, view: 'library' }),

  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  search: '',
  setSearch: (search) => set({ search }),

  projectFilter: null,
  setProjectFilter: (projectFilter) => set({ projectFilter }),

  selectedId: null,
  setSelectedId: (selectedId) => set({ selectedId }),
  selectedProduct: null,
  setSelectedProduct: (selectedProduct) => set({ selectedProduct }),

  viewerId: null,
  setViewerId: (viewerId) => set({ viewerId }),

  ragSelectMode: false,
  setRagSelectMode: (ragSelectMode) => set((s) => ({ ragSelectMode, ragSelection: ragSelectMode ? s.ragSelection : new Set<string>() })),
  ragSelection: new Set<string>(),
  toggleRagSelection: (localId) => set((s) => {
    const next = new Set(s.ragSelection);
    if (next.has(localId)) next.delete(localId); else next.add(localId);
    return { ragSelection: next };
  }),
  setRagSelection: (ids) => set({ ragSelection: new Set(ids) }),
  clearRagSelection: () => set({ ragSelection: new Set<string>() }),

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      // 登録済み知識（_index.json）+ LocalAssets/Documents の実ファイル + S_Library（社外秘）を統合。
      const [curated, localFiles, confidential] = await Promise.all([
        getLocalKnowledge(),
        getLocalDocumentEntries(),
        getSLibraryEntries(),
      ]);
      // 登録済みエントリの実体は LocalAssets\Documents に置かれるため、
      // 同一パスのローカルスキャン結果は重複表示になる。パス一致で除外する。
      const norm = (p?: string | null) => (p || '').replace(/\\/g, '/').toLowerCase();
      const curatedPaths = new Set(curated.map((e) => norm(e.filePath)).filter(Boolean));
      const dedupedLocal = localFiles.filter((f) => !curatedPaths.has(norm(f.filePath)));
      const dedupedConfidential = confidential.filter((f) => !curatedPaths.has(norm(f.filePath)));
      const entries = [...curated, ...dedupedLocal, ...dedupedConfidential];
      // 新しい順に
      entries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      set({ entries, loading: false });
    } catch (e: any) {
      console.error('[useDskStore] refresh failed', e);
      set({ error: String(e), loading: false });
    }
  },

  upsert: (entry) => set((s) => {
    const rest = s.entries.filter((e) => e.localId !== entry.localId);
    const next = [entry, ...rest];
    next.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { entries: next };
  }),

  remove: async (localId) => {
    await deleteKnowledgeEntry(localId);
    set((s) => ({
      entries: s.entries.filter((e) => e.localId !== localId),
      selectedId: s.selectedId === localId ? null : s.selectedId,
      viewerId: s.viewerId === localId ? null : s.viewerId,
    }));
  },

  patch: async (entry) => {
    const updated = await updateKnowledgeEntry(entry);
    get().upsert(updated);
    return updated;
  },
}));
