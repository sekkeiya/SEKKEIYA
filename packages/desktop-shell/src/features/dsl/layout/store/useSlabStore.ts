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
  /**
   * その階の床レベル(FL)からの上下オフセット(mm)。+ で上、− で下。
   * 未設定/0 なら FL ちょうど（従来どおり）。段差床・スキップフロアに使う。
   * 断面ビューのギズモを上下にドラッグするとここが変わる。
   */
  offsetYMm?: number;
  /**
   * どの階の床か（0=1F）。未設定は 1F 扱い（既存データはそのまま使える）。
   * 作図した時点のアクティブ階が入り、以後その階の FL に敷かれる。
   */
  floorIndex?: number;
  /**
   * この面をどの図面で使うか。未設定は "floor"（従来どおり床だけ）。
   *   floor   … 平面図（床伏図）に床として出す。FL に敷く。
   *   ceiling … 天井伏図に天井として出す。その階の CL（天井高）に貼る。
   *   both    … 同じ輪郭を床と天井の両方に使う（部屋の輪郭を1回描けば済む）。
   * 天井は「その階の CL」に貼る（1F に描いた both は 平面1F と 天井1F に出る）。
   */
  role?: SlabRole;
  /**
   * この天井面の高さ(mm)。FL からの高さ。role が "ceiling" のときだけ意味を持つ。
   * 未設定 = その階の既定天井高（旧データ用のフォールバック）。
   * 天井高の正はこの面。部屋も建物も持たない（2026-08-01）。
   * 解決は utils/ceilingHeight の slabCeilingHeightMm を通すこと。
   */
  ceilingHeightMm?: number;
  /** どの部屋の天井か。平面の CH 表示と、部屋の rect 変更への追従に使う。 */
  roomId?: string;
  /**
   * 形（points）を手で編集したか。true の天井は部屋の rect を動かしても追従しない。
   * updateSlab / updateSlabLocal が points を含む patch を受けたときに自動で立つ。
   */
  shapeEdited?: boolean;
}

export type SlabRole = "floor" | "ceiling" | "both";
/** その面を床として描くか。 */
export const slabIsFloor = (s: { role?: SlabRole }) => (s.role || "floor") !== "ceiling";
/** その面を天井として描くか。 */
export const slabIsCeiling = (s: { role?: SlabRole }) => {
  const r = s.role || "floor";
  return r === "ceiling" || r === "both";
};

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

/**
 * スラブへ patch を当てる。points を手で変えたら shapeEdited を立てる
 * ＝以後その天井は部屋の rect に追従しなくなる。
 * ⚠️ 自動追従（syncRoomCeilingPoints）はここを通さない。通すと 1 回追従しただけで
 *    「手で編集した」ことになり、二度と追従しなくなる。
 */
function applySlabPatch(slab: FloorSlab, patch: Partial<Omit<FloorSlab, "id">>): FloorSlab {
  const next = { ...slab, ...patch };
  if (patch.points && slab.roomId) next.shapeEdited = true;
  return next;
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

  addSlab: (points: SlabPoint[], floorIndex?: number, role?: SlabRole) => void;
  /**
   * 既存スラブを複製する（Alt+ドラッグ複製）。sourceId の見た目プロパティ
   * （厚み/役割/階/上下オフセット）を引き継ぎ、points を差し替えた新規スラブを作って選択する。
   * restorePoints を渡すと元スラブの points をそこへ戻す（ドラッグで動かした分を元位置へ）。
   */
  duplicateSlab: (sourceId: string, points: SlabPoint[], restorePoints?: SlabPoint[] | null) => void;
  updateSlab: (id: string, patch: Partial<Omit<FloorSlab, "id">>) => void;
  /** ドラッグ中の高頻度更新用（永続化しない）。確定時に persistSlabs() を呼ぶ。 */
  updateSlabLocal: (id: string, patch: Partial<Omit<FloorSlab, "id">>) => void;
  /** 現在の slabs を Base へ永続化（updateSlabLocal の確定用）。 */
  persistSlabs: () => void;
  /**
   * 部屋の輪郭から天井を1枚作る（部屋作成時の自動生成）。
   * その部屋の天井が既にあれば何もしない（二重作成を防ぐ）。
   */
  addRoomCeiling: (roomId: string, points: SlabPoint[], floorIndex: number, ceilingHeightMm: number) => void;
  /**
   * 部屋の rect 変更に合わせて、未編集（shapeEdited でない）天井の輪郭を差し替える。
   * ⚠️ shapeEdited は立てない（自動追従なので「手で編集した」ではない）。
   */
  syncRoomCeilingPoints: (roomId: string, points: SlabPoint[]) => void;
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

  addSlab: (points, floorIndex = 0, role) =>
    set((s) => {
      if (!points || points.length < SLAB_MIN_POINTS) return {};
      const slab: FloorSlab = {
        id: nextId(),
        points: points.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) })),
        thicknessMm: SLAB_DEFAULT_THICKNESS,
        floorIndex,
        // 天井ビューで作図した面は天井として使う（未指定は従来どおり床）。
        ...(role ? { role } : {}),
      };
      const slabs = [...s.slabs, slab];
      persist(slabs);
      return { slabs, selectedSlabId: slab.id, selectedSlabIds: [slab.id], draftPoints: [] };
    }),

  duplicateSlab: (sourceId, points, restorePoints) =>
    set((s) => {
      const src = s.slabs.find((x) => x.id === sourceId);
      if (!src || !points || points.length < SLAB_MIN_POINTS) return {};
      const clone: FloorSlab = {
        ...src, // 厚み/役割/階/上下オフセットなど見た目を引き継ぐ
        id: nextId(),
        points: points.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) })),
      };
      // 元スラブは掴む前の位置へ戻す（ドラッグした分はコピー側に乗る＝部屋の Alt 複製と同じ）
      const slabs = s.slabs.map((x) =>
        x.id === sourceId && restorePoints ? { ...x, points: restorePoints } : x,
      );
      slabs.push(clone);
      persist(slabs);
      return {
        slabs,
        selectedSlabId: clone.id,
        selectedSlabIds: [clone.id],
        selectedEdgeIndices: [],
      };
    }),

  updateSlab: (id, patch) =>
    set((s) => {
      const slabs = s.slabs.map((x) => (x.id === id ? applySlabPatch(x, patch) : x));
      persist(slabs);
      return { slabs };
    }),

  updateSlabLocal: (id, patch) =>
    set((s) => ({ slabs: s.slabs.map((x) => (x.id === id ? applySlabPatch(x, patch) : x)) })),

  persistSlabs: () => persist(get().slabs),

  addRoomCeiling: (roomId, points, floorIndex, ceilingHeightMm) =>
    set((s) => {
      if (!roomId || !points || points.length < SLAB_MIN_POINTS) return {};
      if (s.slabs.some((x) => x.roomId === roomId && x.role === "ceiling")) return {}; // 二重作成しない
      const slab: FloorSlab = {
        id: nextId(),
        points: points.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) })),
        thicknessMm: SLAB_DEFAULT_THICKNESS,
        floorIndex,
        role: "ceiling",
        ceilingHeightMm: Math.round(ceilingHeightMm),
        roomId,
      };
      const slabs = [...s.slabs, slab];
      persist(slabs);
      return { slabs };
    }),

  syncRoomCeilingPoints: (roomId, points) =>
    set((s) => {
      if (!roomId || !points || points.length < SLAB_MIN_POINTS) return {};
      const pts = points.map((p) => ({ x: Math.round(p.x), z: Math.round(p.z) }));
      let changed = false;
      const slabs = s.slabs.map((x) => {
        if (x.roomId !== roomId || x.role !== "ceiling" || x.shapeEdited) return x;
        changed = true;
        return { ...x, points: pts };
      });
      if (!changed) return {};
      persist(slabs);
      return { slabs };
    }),

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
