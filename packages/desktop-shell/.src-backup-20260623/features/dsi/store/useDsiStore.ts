import { create } from 'zustand';

// 画像/動画カテゴリ（パース / 静止画 / 動画 / AIレンダー）
// - パース:   S.Layout で生成した静止画パース
// - 静止画:   手動アップロードの写真・図版など
// - 動画:     S.Layout の動画、手動アップロードの動画
// - AIレンダー: AI Render で生成された画像
export const DSI_CATEGORIES = ['パース', '静止画', '動画', 'AIレンダー'] as const;
export type DsiCategory = (typeof DSI_CATEGORIES)[number];

export type DsiCategoryFilter = 'all' | DsiCategory;

interface DsiStoreState {
  /** ツールバーのカテゴリフィルタ */
  categoryFilter: DsiCategoryFilter;
  setCategoryFilter: (filter: DsiCategoryFilter) => void;

  /** 現在開いているセット（フォルダ）のID。null ならトップ階層 */
  openSetId: string | null;
  setOpenSetId: (id: string | null) => void;

  /** 右パネルで詳細表示中の画像/動画ID */
  selectedImageId: string | null;
  setSelectedImageId: (id: string | null) => void;

  /** アップロード進捗（0-100、null なら非アップロード中） */
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;
}

export const useDsiStore = create<DsiStoreState>((set) => ({
  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  openSetId: null,
  setOpenSetId: (openSetId) => set({ openSetId }),

  selectedImageId: null,
  setSelectedImageId: (selectedImageId) => set({ selectedImageId }),

  uploadProgress: null,
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}));
