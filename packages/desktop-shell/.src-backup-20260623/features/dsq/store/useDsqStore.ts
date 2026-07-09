import { create } from 'zustand';

// 建築・インテリアデザイナー向け学習プラットフォーム S.Quest のコースカテゴリ。
// Udemy 的な「体系コース」と Progate 的な「実践クエスト」を横断するための分類。
export const DSQ_CATEGORIES = ['設計', 'インテリア', 'CAD/3D', 'プレゼン', 'ビジネス'] as const;
export type DsqCategory = (typeof DSQ_CATEGORIES)[number];

export type DsqCategoryFilter = 'all' | DsqCategory;

interface DsqStoreState {
  /** カタログのカテゴリフィルタ */
  categoryFilter: DsqCategoryFilter;
  setCategoryFilter: (filter: DsqCategoryFilter) => void;

  /** 右パネルで詳細表示中のコースID */
  selectedCourseId: string | null;
  setSelectedCourseId: (id: string | null) => void;
}

export const useDsqStore = create<DsqStoreState>((set) => ({
  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  selectedCourseId: null,
  setSelectedCourseId: (selectedCourseId) => set({ selectedCourseId }),
}));
