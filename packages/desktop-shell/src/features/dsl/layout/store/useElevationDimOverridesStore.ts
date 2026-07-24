// useElevationDimOverridesStore — 展開図の寸法値の手入力オーバーライド＋区切り削除。
//   - overrides: 自動算出した寸法を別の数値に上書き（CAD の寸法テキスト上書き相当。表示のみ）。
//   - removedMarks: 削除した区切り（隣のセグメントに統合される寸法境界）。
//   キーは (展開id or 向き) + 役割 + 位置(50mm丸め) で、家具を動かさない限り安定する。
//   ※ セッション内保持（ドキュメント永続化はしていない）。
//   undo/redo: この2マップの状態スナップショットを past/future に積む。展開図表示中の
//   Ctrl+Z は LayoutShell がこの undo を優先的に呼ぶ（家具レイアウトの履歴とは別系統）。
import { create } from "zustand";

type Maps = {
  overrides: Record<string, number>;
  removedMarks: Record<string, true>;
  /** key → 区切り位置(mm) の手動上書き（端部ドラッグで移動した寸法境界） */
  markPositions: Record<string, number>;
};

interface ElevationDimOverridesState extends Maps {
  past: Maps[];
  future: Maps[];
  setOverride: (key: string, mm: number | null) => void;
  removeMark: (key: string) => void;
  restoreMark: (key: string) => void;
  /** 区切り位置の上書き。commit=true でドラッグ確定（履歴に積む）。ドラッグ中の途中は false。 */
  setMarkPosition: (key: string, mm: number | null, commit?: boolean) => void;
  /** 変更前の状態を履歴に積む（ドラッグ開始時に1回呼び、以降 commit=false でライブ更新する用）。 */
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearAll: () => void;
}

const HISTORY_LIMIT = 100;

export const useElevationDimOverridesStore = create<ElevationDimOverridesState>((set, get) => {
  // 変更前の状態を past に積んで future を捨てる（新しい操作＝redo 系列を切る）。
  const snapshot = () => {
    const s = get();
    const past = [...s.past, { overrides: s.overrides, removedMarks: s.removedMarks, markPositions: s.markPositions }];
    if (past.length > HISTORY_LIMIT) past.shift();
    return { past, future: [] as Maps[] };
  };

  return {
    overrides: {},
    removedMarks: {},
    markPositions: {},
    past: [],
    future: [],

    setOverride: (key, mm) =>
      set((s) => {
        const overrides = { ...s.overrides };
        if (mm == null) delete overrides[key];
        else overrides[key] = mm;
        return { overrides, ...snapshot() };
      }),

    removeMark: (key) =>
      set((s) => ({ removedMarks: { ...s.removedMarks, [key]: true }, ...snapshot() })),

    restoreMark: (key) =>
      set((s) => {
        const removedMarks = { ...s.removedMarks };
        delete removedMarks[key];
        return { removedMarks, ...snapshot() };
      }),

    setMarkPosition: (key, mm, commit = true) =>
      set((s) => {
        const markPositions = { ...s.markPositions };
        if (mm == null) delete markPositions[key];
        else markPositions[key] = mm;
        // ドラッグ中の途中フレームは履歴に積まない（確定時のみ）。
        return commit ? { markPositions, ...snapshot() } : { markPositions };
      }),

    beginHistory: () => set(() => snapshot()),

    undo: () =>
      set((s) => {
        if (!s.past.length) return {} as any;
        const prev = s.past[s.past.length - 1];
        return {
          overrides: prev.overrides,
          removedMarks: prev.removedMarks,
          markPositions: prev.markPositions,
          past: s.past.slice(0, -1),
          future: [{ overrides: s.overrides, removedMarks: s.removedMarks, markPositions: s.markPositions }, ...s.future],
        };
      }),

    redo: () =>
      set((s) => {
        if (!s.future.length) return {} as any;
        const next = s.future[0];
        return {
          overrides: next.overrides,
          removedMarks: next.removedMarks,
          markPositions: next.markPositions,
          past: [...s.past, { overrides: s.overrides, removedMarks: s.removedMarks, markPositions: s.markPositions }],
          future: s.future.slice(1),
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    clearAll: () => set({ overrides: {}, removedMarks: {}, markPositions: {}, past: [], future: [] }),
  };
});