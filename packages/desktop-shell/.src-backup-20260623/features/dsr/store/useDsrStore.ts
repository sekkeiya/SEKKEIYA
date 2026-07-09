import { create } from 'zustand';

// 図面カテゴリ（設計図書 / 家具図 / 参考図面）
export const DSR_CATEGORIES = ['設計図書', '家具図', '参考図面'] as const;
export type DsrCategory = (typeof DSR_CATEGORIES)[number];

export type DsrCategoryFilter = 'all' | DsrCategory;

interface DsrStoreState {
  /** ツールバーのカテゴリフィルタ */
  categoryFilter: DsrCategoryFilter;
  setCategoryFilter: (filter: DsrCategoryFilter) => void;

  /** 現在開いているセット（フォルダ）のID。null ならトップ階層 */
  openSetId: string | null;
  setOpenSetId: (id: string | null) => void;

  /** 右パネルで詳細表示中の図面ID */
  selectedDrawingId: string | null;
  setSelectedDrawingId: (id: string | null) => void;

  /** アップロード進捗（0-100、null なら非アップロード中） */
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;
}

export const useDsrStore = create<DsrStoreState>((set) => ({
  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  openSetId: null,
  setOpenSetId: (openSetId) => set({ openSetId }),

  selectedDrawingId: null,
  setSelectedDrawingId: (selectedDrawingId) => set({ selectedDrawingId }),

  uploadProgress: null,
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}));
