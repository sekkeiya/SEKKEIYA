// useStructureHistoryStore — 躯体編集（床/壁/部屋/通り芯/寸法）の Undo/Redo タイムライン。
//
// 設計のキモ:
//   これらの構造データは最終的にすべて Base の spaceProgram.* に保存され、
//   Firestore を往復して baseDoc に反映される（LayoutShell の各 Update ハンドラや
//   ゾーン作成ダイアログなど、経路はバラバラでも着地点は同じ）。
//   そこで「commit の瞬間」を個別に追うのではなく、baseDoc.spaceProgram のスナップショットを
//   1本のタイムラインに積む（record は LayoutShell の effect から呼ぶ）。
//   Undo は 1つ前のスナップショットを Firestore へ書き戻すだけ＝既存の
//   baseDoc→各ストア反映 effect がそのまま画面を戻してくれる。
//
//   往復ズレ対策: present と同じ内容なら record しない（key 一致で弾く）。
//   Undo/Redo で書き戻した状態が Firestore から返ってきても present と一致するので、
//   新しい履歴として二重記録されない（restoring フラグのような時間依存のガードが不要）。
import { create } from "zustand";

/** 履歴に載せる構造データ一式（baseDoc.spaceProgram の該当キー）。 */
export interface StructureSnapshot {
  zones: any[];
  rooms: any[];
  walls: any[];
  slabs: any[];
  gridAxes: any[];
  manualDims: any[];
  dimChains: Record<string, any>;
  dimChainMarks: Record<string, any>;
}

const keyOf = (snap: StructureSnapshot | null): string => (snap ? JSON.stringify(snap) : "");

interface HistoryState {
  past: StructureSnapshot[];
  present: StructureSnapshot | null;
  presentKey: string;
  future: StructureSnapshot[];
  limit: number;

  /** 新しい Base を開いたとき等、この状態を履歴の起点にする（過去/未来を消す）。 */
  seed: (snap: StructureSnapshot) => void;
  /** commit を記録する。present と同じなら無視（往復ズレ・no-op を弾く）。 */
  record: (snap: StructureSnapshot) => void;
  /** 1つ戻す。戻し先スナップショットを返す（呼び出し側が Firestore へ書き戻す）。 */
  undo: () => StructureSnapshot | null;
  /** 1つ進める。進め先スナップショットを返す。 */
  redo: () => StructureSnapshot | null;
  reset: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useStructureHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  present: null,
  presentKey: "",
  future: [],
  limit: 100,

  seed: (snap) => set({ past: [], present: snap, presentKey: keyOf(snap), future: [] }),

  record: (snap) => {
    const s = get();
    const key = keyOf(snap);
    if (key === s.presentKey) return; // 変化なし（Undo/Redo の往復・no-op を弾く）
    const past = s.present ? [...s.past, s.present] : s.past;
    if (past.length > s.limit) past.splice(0, past.length - s.limit);
    set({ past, present: snap, presentKey: key, future: [] });
  },

  undo: () => {
    const s = get();
    if (!s.past.length) return null;
    const prev = s.past[s.past.length - 1];
    set({
      past: s.past.slice(0, -1),
      present: prev,
      presentKey: keyOf(prev),
      future: s.present ? [s.present, ...s.future] : s.future,
    });
    return prev;
  },

  redo: () => {
    const s = get();
    if (!s.future.length) return null;
    const next = s.future[0];
    set({
      past: s.present ? [...s.past, s.present] : s.past,
      present: next,
      presentKey: keyOf(next),
      future: s.future.slice(1),
    });
    return next;
  },

  reset: () => set({ past: [], present: null, presentKey: "", future: [] }),
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
