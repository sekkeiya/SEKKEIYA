// useGridAxisStore — 通り芯（構造グリッド）。図面の寸法列の「刻み元」になる基準線。
//   axis="x" … 平面で縦に走る芯（位置は world X）。慣例の X通り = X1, X2…
//   axis="z" … 平面で横に走る芯（位置は world Z）。慣例の Y通り = Y1, Y2…
//   保存先は Base の spaceProgram.gridAxes（壁・床と同じ扱い＝全 Plan/Option 共通）。
//   永続化は LayoutShell が window イベント "LayoutShell:UpdateGridAxes" を受けて updateDoc する。
import { create } from "zustand";

export type GridAxisDir = "x" | "z";

export interface GridAxis {
  id: string;
  axis: GridAxisDir;
  /** world mm。axis="x" なら X 座標、"z" なら Z 座標。 */
  pos: number;
  /** 符号（X1 / Y2 など）。既定は位置順の自動採番。 */
  name: string;
  /**
   * 手動で改名したか。true の芯は自動採番の対象外にして名前を守る
   * （途中に芯を挿しても、名前を付け直した芯だけはその名前のまま残る）。
   */
  renamed?: boolean;
  /**
   * 線そのものの長さ（world 座標）。線が伸びている方向の座標で持つ:
   *   axis="x"（平面で縦線＝Z 方向に伸びる）→ from/to は Z ／ axis="z" → from/to は X。
   * 未設定なら建物幅に合わせて自動。平面図で端部をドラッグすると設定される。
   */
  span?: { from: number; to: number };
}

/** 通り芯のドラッグ刻み(mm)。壁の作図と揃える。 */
export const GRID_AXIS_SNAP_MM = 50;

let _seq = 0;
const nextId = () => `gax_${Date.now().toString(36)}_${_seq++}`;

/**
 * 符号を位置順に振り直す。改名済み(renamed)の芯は飛ばして名前を守る。
 *   X通り … 画面左（X 小）から X0, X1, X2…
 *   Y通り … 画面下から Y0, Y1, Y2… と上へ。平面図は「上＝−Z」の約束なので、
 *           画面下＝Z が大きい側。つまり Z の降順に採番する。
 * 通り芯の番号は 0 始まり（X0 / Y0 が基準の通り）。
 */
export function renumberAxes(axes: GridAxis[]): GridAxis[] {
  const out = [...axes];
  (["x", "z"] as GridAxisDir[]).forEach((dir) => {
    const prefix = dir === "x" ? "X" : "Y";
    const sorted = out
      .filter((a) => a.axis === dir)
      .sort((a, b) => (dir === "x" ? a.pos - b.pos : b.pos - a.pos));
    let n = -1;
    for (const a of sorted) {
      n += 1;
      if (a.renamed) continue;
      a.name = `${prefix}${n}`;
    }
  });
  return out;
}

/** 通り芯配列の変更を Base へ永続化（LayoutShell が購読）。 */
function persist(axes: GridAxis[]) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateGridAxes", { detail: { axes } }));
  } catch {
    /* noop */
  }
}

interface GridAxisState {
  /** 通り芯一覧（Base の spaceProgram.gridAxes のミラー） */
  axes: GridAxis[];
  /** 選択中の通り芯（Properties の編集対象・平面では濃く表示） */
  selectedId: string | null;
  /** 通り芯パネルを開いているか（ヘッダーの「通り芯」ボタン） */
  panelOpen: boolean;
  /** 図面に通り芯を表示するか */
  visible: boolean;

  setAxes: (axes: GridAxis[]) => void; // Base からのロード（永続化しない）
  setSelectedId: (id: string | null) => void;
  setPanelOpen: (on: boolean) => void;
  togglePanel: () => void;
  setVisible: (on: boolean) => void;

  /** 1本追加して選択する。pos 未指定なら既存の外側 or 0 に置く。 */
  addAxis: (axis: GridAxisDir, pos?: number) => GridAxis;
  /** まとめて置き換え（壁芯からの自動生成）。既存は破棄する。 */
  replaceAxes: (axes: Array<Pick<GridAxis, "axis" | "pos">>) => void;
  updateAxis: (id: string, patch: Partial<Omit<GridAxis, "id">>) => void;
  /** ドラッグ中の高頻度更新用（永続化しない）。確定時に persistAxes() を呼ぶ。 */
  updateAxisLocal: (id: string, patch: Partial<Omit<GridAxis, "id">>) => void;
  persistAxes: () => void;
  removeAxis: (id: string) => void;
}

export const useGridAxisStore = create<GridAxisState>((set, get) => ({
  axes: [],
  selectedId: null,
  panelOpen: false,
  visible: true,

  // 保存済みデータも新しい採番規約（0 始まり / Y は下から）で表示する。
  // ここでは永続化しない（次に何か変更したときに一緒に保存される）。
  setAxes: (axes) => set({ axes: Array.isArray(axes) ? renumberAxes(axes) : [] }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setVisible: (visible) => set({ visible }),

  addAxis: (axis, pos) => {
    const s = get();
    const same = s.axes.filter((a) => a.axis === axis);
    // 位置指定が無ければ、番号が増えていく向きへ 3640mm（2間）離して置く。
    //   X通りは画面右（X 大）へ、Y通りは画面上（Z 小）へ増えていく。
    const fallback = same.length
      ? (axis === "x"
          ? Math.max(...same.map((a) => a.pos)) + 3640
          : Math.min(...same.map((a) => a.pos)) - 3640)
      : 0;
    const item: GridAxis = {
      id: nextId(),
      axis,
      pos: Math.round((pos ?? fallback) / GRID_AXIS_SNAP_MM) * GRID_AXIS_SNAP_MM,
      name: "",
    };
    const axes = renumberAxes([...s.axes, item]);
    persist(axes);
    set({ axes, selectedId: item.id });
    return axes.find((a) => a.id === item.id) as GridAxis;
  },

  replaceAxes: (list) => {
    const axes = renumberAxes(
      list.map((a) => ({
        id: nextId(),
        axis: a.axis,
        pos: Math.round(a.pos / GRID_AXIS_SNAP_MM) * GRID_AXIS_SNAP_MM,
        name: "",
      })),
    );
    persist(axes);
    set({ axes, selectedId: null });
  },

  updateAxis: (id, patch) =>
    set((s) => {
      // 位置が動いたら採番し直す（改名済みの芯は名前を保つ）。
      const next = s.axes.map((a) => (a.id === id ? { ...a, ...patch } : a));
      const axes = patch.pos !== undefined ? renumberAxes(next) : next;
      persist(axes);
      return { axes };
    }),

  updateAxisLocal: (id, patch) =>
    set((s) => {
      const next = s.axes.map((a) => (a.id === id ? { ...a, ...patch } : a));
      return { axes: patch.pos !== undefined ? renumberAxes(next) : next };
    }),

  persistAxes: () => persist(get().axes),

  removeAxis: (id) =>
    set((s) => {
      const axes = renumberAxes(s.axes.filter((a) => a.id !== id));
      persist(axes);
      return { axes, selectedId: s.selectedId === id ? null : s.selectedId };
    }),
}));
