import { create } from 'zustand';
import type { LayoutPattern } from '../utils/layoutPatterns';

/**
 * 現在のプランに登録されている見た目パターンと、選択中のパターン（null = デフォルト）。
 * Firestore が正で、useLayoutPatternsSync が購読して流し込む（このストアは表示用）。
 *
 * ⚠ 面ごとの仕上げパターンを扱う useSurfacePatternStore とは別物。
 */
interface LayoutPatternState {
  patterns: LayoutPattern[];
  activePatternId: string | null;
  setPatterns: (list: LayoutPattern[]) => void;
  setActiveId: (id: string | null) => void;
  clear: () => void;
}

export const useLayoutPatternStore = create<LayoutPatternState>((set) => ({
  patterns: [],
  activePatternId: null,
  setPatterns: (patterns) => set({ patterns }),
  setActiveId: (activePatternId) => set({ activePatternId }),
  clear: () => set({ patterns: [], activePatternId: null }),
}));
