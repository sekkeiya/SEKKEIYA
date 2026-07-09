import { create } from 'zustand';

// ポートフォリオのカテゴリ（会社案内 / 作品集 / 提案書 / その他）
export const DSF_CATEGORIES = ['会社案内', '作品集', '提案書', 'その他'] as const;
export type DsfCategory = (typeof DSF_CATEGORIES)[number];

export type DsfCategoryFilter = 'all' | DsfCategory;

interface DsfStoreState {
  /** ツールバーのカテゴリフィルタ */
  categoryFilter: DsfCategoryFilter;
  setCategoryFilter: (filter: DsfCategoryFilter) => void;

  /** 右パネルで詳細表示中のポートフォリオID */
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (id: string | null) => void;

  /** 本ビューアで開いているポートフォリオID（null なら閉じている） */
  viewerPortfolioId: string | null;
  setViewerPortfolioId: (id: string | null) => void;

  /** アップロード進捗（0-100、null なら非アップロード中） */
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;
}

export const useDsfStore = create<DsfStoreState>((set) => ({
  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  selectedPortfolioId: null,
  setSelectedPortfolioId: (selectedPortfolioId) => set({ selectedPortfolioId }),

  viewerPortfolioId: null,
  setViewerPortfolioId: (viewerPortfolioId) => set({ viewerPortfolioId }),

  uploadProgress: null,
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
}));
