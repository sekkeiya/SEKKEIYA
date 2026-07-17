// useSlabStore — S.Layout で作図する床（スラブ）。多角形の頂点列で持つ。
//   保存先は Base の spaceProgram.slabs（壁と同じ扱い＝全 Plan/Option 共通）。
//   永続化は LayoutShell が "LayoutShell:UpdateSlabs" イベントを受けて updateDoc する。
import { create } from "zustand";

export interface SlabPoint { x: number; z: number }

export interface FloorSlab {
  id: string;
  /** 多角形の頂点（world mm / XZ 平面、順回り）。3点以上。 */
  points: SlabPoint[];
  /** スラブ厚(mm)。上面が床レベル(FL)に揃い、下へ厚みが付く。 */
  thicknessMm: number;
}

export const SLAB_DEFAULT_THICKNESS = 150;
/** 多角形を閉じたとみなす最小頂点数 */
export const SLAB_MIN_POINTS = 3;

let _seq = 0;
const nextId = () => `slab_${Date.now().toString(36)}_${_seq++}`;

/** 多角形の面積(mm²)。靴紐公式（向きに依らず正値）。 */
export function slabAreaMm2(points: SlabPoint[]): number {
  if (!points || points.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.z - b.x * a.z;
  }
  return Math.abs(s) / 2;
}

function persist(slabs: FloorSlab[]) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateSlabs", { detail: { slabs } }));
  } catch { /* noop */ }
}

interface SlabState {
  slabs: FloorSlab[];
  /** 床作図ツールが有効か（ツールバーの「床」トグル） */
  drawActive: boolean;
  /** 作図中の頂点列（確定前）。 */
  draftPoints: SlabPoint[];
  selectedSlabId: string | null;
  /** 複数選択（範囲選択・Ctrl+クリック）。selectedSlabId は常に先頭/最後の主選択とミラー。 */
  selectedSlabIds: string[];
  /** 選択中スラブの「選択された辺」（辺 i = points[i] → points[i+1]）。壁の一括作成に使う。 */
  selectedEdgeIndices: number[];

  setSlabs: (slabs: FloorSlab[]) => void;
  setDrawActive: (v: boolean) => void;
  toggleDraw: () => void;
  setDraftPoints: (pts: SlabPoint[]) => void;
  setSelectedSlabId: (id: string | null) => void;
  /** 範囲選択（マーキー）用: 選択セットをまとめて置換。主選択は先頭。 */
  setSelectedSlabIds: (ids: string[]) => void;
  toggleEdgeIndex: (i: number) => void;
  clearEdgeSelection: () => void;

  addSlab: (points: SlabPoint[]) => void;
  updateSlab: (id: string, patch: Partial<Omit<FloorSlab, "id">>) => void;
  /** ドラッグ中の高頻度更新用（永続化しない）。確定時に persistSlabs() を呼ぶ。 */
  updateSlabLocal: (id: string, patch: Partial<Omit<FloorSlab, "id">>) => void;
  /** 現在の slabs を Base へ永続化（updateSlabLocal の確定用）。 */
  persistSlabs: () => void;
  removeSlab: (id: string) => void;
}

export const useSlabStore = create<SlabState>((set, get) => ({
  slabs: [],
  drawActive: false,
  draftPoints: [],
  selectedSlabId: null,
  selectedSlabIds: [],
  selectedEdgeIndices: [],

  setSlabs: (slabs) => set({ slabs: Array.isArray(slabs) ? slabs : [] }),
  setDrawActive: (drawActive) => set({ drawActive, draftPoints: [] }),
  toggleDraw: () => set((s) => ({ drawActive: !s.drawActive, draftPoints: [] })),
  setDraftPoints: (draftPoints) => set({ draftPoints }),
  // スラブを切り替えたら辺選択はクリア（前のスラブの辺 index が残らないように）
  setSelectedSlabId: (selectedSlabId) =>
    set((s) => ({
      selectedSlabId,
      selectedSlabIds: selectedSlabId ? [selectedSlabId] : [],
      selectedEdgeIndices: selectedSlabId === s.selectedSlabId ? s.selectedEdgeIndices : [],
    })),

  setSelectedSlabIds: (ids) =>
    set((s) => {
      const selectedSlabIds = Array.isArray(ids) ? ids : [];
      const selectedSlabId = selectedSlabIds[0] || null;
      return {
        selectedSlabIds,
        selectedSlabId,
        selectedEdgeIndices: selectedSlabId === s.selectedSlabId ? s.selectedEdgeIndices : [],
      };
    }),
  toggleEdgeIndex: (i) =>
    set((s) => ({
      selectedEdgeIndices: s.selectedEdgeIndices.includes(i)
        ? s.selectedEdgeIndices.filter((x) => x !== i)
        : [...s.selectedEdgeIndices, i],
    })),
  clearEdgeSelection: () => set({ selectedEdgeIndices: [] }),

  addSlab: (points) =>
    set((s) => {
      if (!points || points.length < SLAB_MIN_POINTS) return {};
      const slab: FloorSlab = {
        id: nextId(),
        points: points.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) })),
        thicknessMm: SLAB_DEFAULT_THICKNESS,
      };
      const slabs = [...s.slabs, slab];
      persist(slabs);
      return { slabs, selectedSlabId: slab.id, selectedSlabIds: [slab.id], draftPoints: [] };
    }),

  updateSlab: (id, patch) =>
    set((s) => {
      const slabs = s.slabs.map((x) => (x.id === id ? { ...x, ...patch } : x));
      persist(slabs);
      return { slabs };
    }),

  updateSlabLocal: (id, patch) =>
    set((s) => ({ slabs: s.slabs.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

  persistSlabs: () => persist(get().slabs),

  removeSlab: (id) =>
    set((s) => {
      const slabs = s.slabs.filter((x) => x.id !== id);
      persist(slabs);
      return {
        slabs,
        selectedSlabId: s.selectedSlabId === id ? null : s.selectedSlabId,
        selectedSlabIds: s.selectedSlabIds.filter((x) => x !== id),
      };
    }),
}));
