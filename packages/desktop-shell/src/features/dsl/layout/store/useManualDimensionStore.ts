// useManualDimensionStore — ヘッダー「寸法」ツールで作図する手動寸法。
//   2点クリックで作成し、作成したビュー（平面/天井/断面/立面/展開）でのみ表示する。
//   保存先は Base ドキュメントの spaceProgram.manualDims（壁・床と同じ扱い＝全 Plan/Option 共通）。
//   永続化は LayoutShell が window イベント "LayoutShell:UpdateManualDims" を受けて updateDoc する。
import { create } from "zustand";

/** 寸法の端点（world mm）。平面では y は作図面の高さ、断面/立面では z or x が作図面の奥行き。 */
export interface ManualDimPoint {
  x: number;
  y: number;
  z: number;
}

export interface ManualDim {
  id: string;
  /**
   * どのビューで作図した寸法か（そのビューでのみ表示する）:
   *   "plan:{floorIndex}"  = 平面（階ごと）
   *   "ceil:{floorIndex}"  = 天井伏図（階ごと）
   *   "sect:{sectionLineId}" = 断面（断面線ごと）
   *   "elev:{elevationId|dir}" = 展開図
   *   "facade:front|right" = 立面
   */
  viewKey: string;
  a: ManualDimPoint;
  b: ManualDimPoint;
}

let _seq = 0;
const nextId = () => `mdim_${Date.now().toString(36)}_${_seq++}`;

/** 手動寸法の変更を Base へ永続化（LayoutShell が購読）。 */
function persist(dims: ManualDim[]) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateManualDims", { detail: { dims } }));
  } catch {
    /* noop */
  }
}

interface ManualDimState {
  /** 手動寸法一覧（Base の spaceProgram.manualDims のミラー） */
  dims: ManualDim[];
  /** 寸法作図ツールが構えられているか（ヘッダー「寸法」ボタン） */
  drawActive: boolean;
  /** 作図中のプレビュー（始点確定→カーソル追従）。null = 非作図。 */
  draft: { a: ManualDimPoint; b: ManualDimPoint } | null;

  setDims: (dims: ManualDim[]) => void; // Base からのロード（永続化しない）
  setDrawActive: (on: boolean) => void;
  toggleDraw: () => void;
  setDraft: (draft: ManualDimState["draft"]) => void;

  addDim: (viewKey: string, a: ManualDimPoint, b: ManualDimPoint) => ManualDim;
  updateDim: (id: string, patch: Partial<Omit<ManualDim, "id">>) => void;
  /** ドラッグ中の高頻度更新用（永続化しない）。確定時に persistDims() を呼ぶ。 */
  updateDimLocal: (id: string, patch: Partial<Omit<ManualDim, "id">>) => void;
  persistDims: () => void;
  removeDim: (id: string) => void;
}

export const useManualDimensionStore = create<ManualDimState>((set, get) => ({
  dims: [],
  drawActive: false,
  draft: null,

  setDims: (dims) => set({ dims: Array.isArray(dims) ? dims : [] }),
  setDrawActive: (on) => set({ drawActive: !!on, draft: null }),
  toggleDraw: () => set((s) => ({ drawActive: !s.drawActive, draft: null })),
  setDraft: (draft) => set({ draft }),

  addDim: (viewKey, a, b) => {
    const dim: ManualDim = {
      id: nextId(),
      viewKey,
      a: { x: Math.round(a.x), y: Math.round(a.y), z: Math.round(a.z) },
      b: { x: Math.round(b.x), y: Math.round(b.y), z: Math.round(b.z) },
    };
    set((s) => {
      const dims = [...s.dims, dim];
      persist(dims);
      return { dims };
    });
    return dim;
  },

  updateDim: (id, patch) =>
    set((s) => {
      const dims = s.dims.map((d) => (d.id === id ? { ...d, ...patch } : d));
      persist(dims);
      return { dims };
    }),

  updateDimLocal: (id, patch) =>
    set((s) => ({ dims: s.dims.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),

  persistDims: () => persist(get().dims),

  removeDim: (id) =>
    set((s) => {
      const dims = s.dims.filter((d) => d.id !== id);
      persist(dims);
      return { dims };
    }),
}));
