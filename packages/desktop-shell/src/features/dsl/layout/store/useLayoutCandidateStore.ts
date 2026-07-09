import { create } from 'zustand';

/** 自動レイアウトで生成した1案（平面図 + 復元用アイテム） */
export interface LayoutCandidate {
  id: string;
  image: string | null;        // Topビュー平面図の PNG data URL
  label: string;               // 例: 案1 A3 1:100
  items: any[];                // この案の生成アイテム（採用時にシーンへ適用）
  zoneIds: string[];           // 対象ゾーン
  sessionIds: string[];        // 学習ログのセッションID（採用/却下記録用）
  matchedSetIds: string[];     // 使用セット（採用率カウント用）
  createdAt: number;
}

/**
 * 自動レイアウトの複数案を貯めて、ギャラリーダイアログで比較・採用/不採用するためのストア。
 */
interface LayoutCandidateState {
  open: boolean;
  candidates: LayoutCandidate[];
  add: (c: LayoutCandidate) => void;
  remove: (id: string) => void;
  clear: () => void;
  setOpen: (v: boolean) => void;
}

export const useLayoutCandidateStore = create<LayoutCandidateState>((set) => ({
  open: false,
  candidates: [],
  add: (c) => set((s) => ({ candidates: [...s.candidates, c], open: true })),
  remove: (id) => set((s) => ({ candidates: s.candidates.filter((x) => x.id !== id) })),
  clear: () => set({ candidates: [], open: false }),
  setOpen: (v) => set({ open: v }),
}));
