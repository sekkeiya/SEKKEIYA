import { create } from "zustand";

// 断面ライン（A-A' / B-B' …）。平面上の切断位置を名前付きで登録し、ドックやプロパティから
// 呼び出す。axis="z"（前後＝正面切り, FRONT）/ "x"（左右＝側面切り, RIGHT）。pos は world 座標。
export interface SectionLine {
  id: string;
  name: string;     // "A-A'" など
  axis: "x" | "z";
  pos: number;      // world 座標（sectionClipX/Z と同スケール）
  flip: boolean;    // 向き反転（矢印を＋軸向きに＝pos 以上側を見る）
  /**
   * 線そのものの長さ（world 座標）。線が伸びている方向の座標で持つ:
   *   axis="z"（線は X 方向に伸びる）→ from/to は X ／ axis="x" → from/to は Z。
   * 未設定なら建物幅に合わせて自動。平面図で端部をドラッグすると設定される。
   */
  span?: { from: number; to: number };
}

/** 断面線の矢印スタイル（全断面線で共通のドキュメント設定）。
 *  filled=塗り三角 / open=白抜き三角 / chevron=山形 / half=片翼（製図の旗矢印） */
export type SectionArrowStyle = "filled" | "open" | "chevron" | "half";

interface SectionLinesState {
  lines: SectionLine[];
  activeLineId: string | null;
  arrowStyle: SectionArrowStyle;
  setArrowStyle: (style: SectionArrowStyle) => void;
  addLine: (axis?: "x" | "z", pos?: number) => SectionLine;
  removeLine: (id: string) => void;
  setActiveLine: (id: string | null) => void;
  updateActive: (patch: Partial<Pick<SectionLine, "axis" | "pos" | "flip" | "span">>) => void;
  updateLine: (id: string, patch: Partial<Pick<SectionLine, "axis" | "pos" | "flip" | "name" | "span">>) => void;
  renameLine: (id: string, name: string) => void;
}

let _seq = 0;
const nextId = () => `sl_${Date.now().toString(36)}_${_seq++}`;
// 既存名から次の A-A' / B-B' … を決める（重複を避ける）。
const nextName = (lines: SectionLine[]) => {
  for (let i = 0; i < 26; i++) {
    const L = String.fromCharCode(65 + i);
    const name = `${L}-${L}'`;
    if (!lines.some((l) => l.name === name)) return name;
  }
  return `断面${lines.length + 1}`;
};

export const useSectionLinesStore = create<SectionLinesState>((set, get) => ({
  lines: [],
  activeLineId: null,
  arrowStyle: "filled",
  setArrowStyle: (style) => set({ arrowStyle: style }),

  addLine: (axis = "z", pos = 0) => {
    const line: SectionLine = { id: nextId(), name: nextName(get().lines), axis, pos, flip: false };
    set((s) => ({ lines: [...s.lines, line], activeLineId: line.id }));
    return line;
  },

  removeLine: (id) =>
    set((s) => ({
      lines: s.lines.filter((l) => l.id !== id),
      activeLineId: s.activeLineId === id ? null : s.activeLineId,
    })),

  setActiveLine: (id) => set({ activeLineId: id }),

  updateActive: (patch) =>
    set((s) => {
      if (!s.activeLineId) return {} as any;
      return { lines: s.lines.map((l) => (l.id === s.activeLineId ? { ...l, ...patch } : l)) };
    }),

  updateLine: (id, patch) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),

  renameLine: (id, name) =>
    set((s) => ({ lines: s.lines.map((l) => (l.id === id ? { ...l, name } : l)) })),
}));
