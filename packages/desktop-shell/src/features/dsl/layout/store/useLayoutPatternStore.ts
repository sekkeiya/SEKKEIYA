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
  /** Plan 切替を伴う提案適用の予約。SurfaceFinishLoader がプラン既定の
   *  ロード完了後にこの id のパターンを重ねて適用し、null に戻す。
   *  （切替直後に同期適用するとローダーが後から走って提案の見た目を消すため） */
  pendingApplyId: string | null;
  /** 提案の適用（復元）中は自動キャプチャを抑止するフラグ。
   *  適用途中の中間状態が、切替先/元の提案へ誤って記録されるのを防ぐ。 */
  applying: boolean;
  /** useLayoutPatternsSync が購読成立後に一度でも setPatterns を呼んだか。
   *  ensure-active（activeOptionId が無ければ作成/選択する effect）が、
   *  購読前の初期値 [] を「提案が0件」と誤認して空 Base に提案を量産しないためのガード。 */
  loaded: boolean;
  setPatterns: (list: LayoutPattern[]) => void;
  setActiveId: (id: string | null) => void;
  setPendingApply: (id: string | null) => void;
  setApplying: (v: boolean) => void;
  clear: () => void;
}

export const useLayoutPatternStore = create<LayoutPatternState>((set) => ({
  patterns: [],
  activePatternId: null,
  pendingApplyId: null,
  applying: false,
  loaded: false,
  setPatterns: (patterns) => set({ patterns, loaded: true }),
  setActiveId: (activePatternId) => set({ activePatternId }),
  setPendingApply: (pendingApplyId) => set({ pendingApplyId }),
  setApplying: (applying) => set({ applying }),
  clear: () => set({ patterns: [], activePatternId: null, pendingApplyId: null, applying: false, loaded: false }),
}));
