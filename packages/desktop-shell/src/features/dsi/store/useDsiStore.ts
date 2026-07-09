import { create } from 'zustand';

// 画像/動画カテゴリ（パース / 静止画 / 動画 / AIレンダー / テクスチャ）
// - パース:   S.Layout で生成した静止画パース
// - 静止画:   手動アップロードの写真・図版など
// - 動画:     S.Layout の動画、手動アップロードの動画
// - AIレンダー: AI Render で生成された画像
// - テクスチャ: S.Material の自動生成用テクスチャ素材
export const DSI_CATEGORIES = ['パース', '静止画', '動画', 'AIレンダー', 'テクスチャ'] as const;
export type DsiCategory = (typeof DSI_CATEGORIES)[number];

export type DsiCategoryFilter = 'all' | DsiCategory;

interface DsiStoreState {
  /** ツールバーのカテゴリフィルタ */
  categoryFilter: DsiCategoryFilter;
  setCategoryFilter: (filter: DsiCategoryFilter) => void;

  /** 右パネルから設定するタグフィルタ（null = 全件） */
  tagFilter: string | null;
  setTagFilter: (tag: string | null) => void;

  /** 用途・部位フィルタ（室内/屋外・床/壁/天井。null = 全件、テクスチャのみ対象） */
  applicationFilter: string | null;
  setApplicationFilter: (app: string | null) => void;

  /** ピッカーモード(material)での生成済み絞り込み */
  generatedFilter: 'all' | 'generated' | 'ungenerated';
  setGeneratedFilter: (f: 'all' | 'generated' | 'ungenerated') => void;

  /** 現在開いているセット（フォルダ）のID。null ならトップ階層 */
  openSetId: string | null;
  setOpenSetId: (id: string | null) => void;

  /** 右パネルで詳細表示中の画像/動画ID */
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;

  /** アップロード進捗（0-100、null なら非アップロード中） */
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;

  // ── 複数選択（3D一括生成などのピッカー用）──
  /** 複数選択モード（チャットの画像ピッカー等から起動） */
  pickMode: boolean;
  /** 選択上限（既定 100） */
  pickMax: number;
  /** 選択中の画像ID集合 */
  selectedIds: Set<string>;
  setPickMode: (on: boolean, max?: number) => void;
  /** 選択トグル（上限尊重）。 */
  togglePick: (id: string) => void;
  /** 配列の ID を一括追加（上限尊重）。 */
  selectAll: (ids: string[]) => void;
  clearPicks: () => void;

  // ── テクスチャ手動セット化モード ──
  /** テクスチャをセットにまとめる選択モード */
  textureSetMode: boolean;
  setTextureSetMode: (on: boolean) => void;
  /** セット化対象に選択中の画像ID集合（テクスチャマップ単位） */
  textureSetSelection: Set<string>;
  /** グループのメンバー ID 群をまとめてトグル（全選択済みなら解除、未選択を含めば追加）。 */
  toggleTextureSetMembers: (ids: string[]) => void;
  clearTextureSetSelection: () => void;
}

export const useDsiStore = create<DsiStoreState>((set) => ({
  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  tagFilter: null,
  setTagFilter: (tagFilter) => set({ tagFilter }),

  applicationFilter: null,
  setApplicationFilter: (applicationFilter) => set({ applicationFilter }),

  generatedFilter: 'all',
  setGeneratedFilter: (generatedFilter) => set({ generatedFilter }),

  openSetId: null,
  setOpenSetId: (openSetId) => set({ openSetId }),

  selectedImageId: null,
  setSelectedImageId: (selectedImageId) => set({ selectedImageId }),

  uploadProgress: null,
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),

  pickMode: false,
  pickMax: 100,
  selectedIds: new Set<string>(),
  setPickMode: (on, max) =>
    set((s) => ({
      pickMode: on,
      pickMax: max ?? s.pickMax,
      selectedIds: new Set<string>(),
      generatedFilter: 'all',
    })),
  togglePick: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= s.pickMax) return s;
        next.add(id);
      }
      return { selectedIds: next };
    }),
  selectAll: (ids) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      for (const id of ids) {
        if (next.size >= s.pickMax) break;
        next.add(id);
      }
      return { selectedIds: next };
    }),
  clearPicks: () => set({ selectedIds: new Set<string>() }),

  textureSetMode: false,
  setTextureSetMode: (textureSetMode) =>
    set({ textureSetMode, textureSetSelection: new Set<string>() }),
  textureSetSelection: new Set<string>(),
  toggleTextureSetMembers: (ids) =>
    set((s) => {
      const next = new Set(s.textureSetSelection);
      const allIn = ids.length > 0 && ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allIn) next.delete(id);
        else next.add(id);
      }
      return { textureSetSelection: next };
    }),
  clearTextureSetSelection: () => set({ textureSetSelection: new Set<string>() }),
}));
