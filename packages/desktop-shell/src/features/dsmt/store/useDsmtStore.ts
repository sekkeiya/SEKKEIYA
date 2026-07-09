import { create } from 'zustand';
import type { DsmtCategory } from '../types';

export type DsmtCategoryFilter = 'all' | DsmtCategory;

/**
 * S.Material のローカル UI 状態（フィルタ・選択）。
 *
 * 素材データそのものは Adapters.tsx の各サービスフックが Firestore から取得し、
 * DsmtDashboard へ props で渡す（S.Models / S.Image と同じ構成）。スコープ
 * （global / public / private / project）は useAppStore.dsmtScope が保持する。
 * ここではビュー側だけが必要とする一時状態を持つ。
 */
interface DsmtStoreState {
  /** フリーワード検索 */
  search: string;
  setSearch: (s: string) => void;

  /** カテゴリフィルタ */
  categoryFilter: DsmtCategoryFilter;
  setCategoryFilter: (c: DsmtCategoryFilter) => void;

  /** 詳細表示中の素材 ID */
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
}

export const useDsmtStore = create<DsmtStoreState>((set) => ({
  search: '',
  setSearch: (search) => set({ search }),

  categoryFilter: 'all',
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  selectedId: null,
  setSelectedId: (selectedId) => set({ selectedId }),
}));
