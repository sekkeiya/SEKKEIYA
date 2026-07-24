// useDimChainStore — 図面の寸法列（4辺 × 1〜3列）の構成。
//   製図では寸法は「外側=総寸法 → 通り芯間 → 開口・壁面」という階層で並ぶ。
//   その列構成をビュー（平面/天井/断面/立面）ごとに保存する。
//   刻み元(source)を選ぶだけで列が増やせるのが狙いで、刻みの実体は通り芯・躯体・階レベル。
//   保存先は Base の spaceProgram.dimChains（通り芯と同じ扱い＝全 Plan/Option 共通）。
//   永続化は LayoutShell が "LayoutShell:UpdateDimChains" を受けて updateDoc する。
import { create } from "zustand";

/** 寸法列の刻み元。 */
export type ChainSource =
  | "total"   // 総寸法（両端だけの1本）
  | "grid"    // 通り芯間
  | "wall"    // 躯体の壁面・壁芯で刻む
  | "level";  // 階レベル（GL / FL / CL / 階高）※縦方向の列のみ

export type ChainSide = "top" | "bottom" | "left" | "right";

export interface ChainColumn {
  id: string;
  source: ChainSource;
}

export type ViewChains = Record<ChainSide, ChainColumn[]>;

export const CHAIN_SIDES: ChainSide[] = ["top", "bottom", "left", "right"];

export const CHAIN_SOURCE_LABEL: Record<ChainSource, string> = {
  total: "総寸法",
  grid: "通り芯間",
  wall: "壁面",
  level: "階レベル",
};

export const CHAIN_SIDE_LABEL: Record<ChainSide, string> = {
  top: "上",
  bottom: "下",
  left: "左",
  right: "右",
};

/** 1辺に置ける列の上限（内側から外側へ3列まで）。 */
export const MAX_COLUMNS_PER_SIDE = 3;

let _seq = 0;
const nextId = () => `dc_${Date.now().toString(36)}_${_seq++}`;

export const emptyChains = (): ViewChains => ({ top: [], bottom: [], left: [], right: [] });

const col = (source: ChainSource): ChainColumn => ({ id: nextId(), source });

/**
 * ビュー種別ごとの既定の列構成。viewKey の接頭辞で決める。
 *   平面・天井 … 下と左に「通り芯間 → 総寸法」（内側から外側へ）
 *   断面・立面 … 下に「通り芯間 → 総寸法」、左に「階レベル → 総寸法」
 *   展開       … 既存の展開図注記（ElevationDimensionsOverlay）が担当するので空
 */
export function defaultChainsFor(viewKey: string): ViewChains {
  const kind = String(viewKey || "").split(":")[0];
  if (kind === "elev") return emptyChains();
  if (kind === "sect" || kind === "facade") {
    return {
      top: [],
      bottom: [col("grid"), col("total")],
      left: [col("level"), col("total")],
      right: [],
    };
  }
  // plan / ceil
  return {
    top: [],
    bottom: [col("grid"), col("total")],
    left: [col("grid"), col("total")],
    right: [],
  };
}

/** 寸法列の設定を Base へ永続化（LayoutShell が購読）。 */
function persist(configs: Record<string, ViewChains>) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateDimChains", { detail: { configs } }));
  } catch {
    /* noop */
  }
}

/** 消した区切りを Base へ永続化（配列の設定とは別枠で持つ）。 */
function persistMarks(removedMarks: Record<string, true>) {
  try {
    window.dispatchEvent(new CustomEvent("LayoutShell:UpdateDimChainMarks", { detail: { removedMarks } }));
  } catch {
    /* noop */
  }
}

/**
 * 消した区切りのキー。位置は 50mm 丸めで持つので、通り芯を少し動かしても対応が保たれる。
 * ここで消した区切りは寸法列から外れ、両隣のセグメントがひとつに統合される。
 */
export function markKey(viewKey: string, side: ChainSide, source: ChainSource, posMm: number): string {
  return `${viewKey}|${side}|${source}|${Math.round(posMm / 50)}`;
}

interface DimChainState {
  /** viewKey → 4辺の列構成（Base の spaceProgram.dimChains のミラー） */
  configs: Record<string, ViewChains>;
  /** 寸法列パネルを開いているか（ヘッダーの「寸法列」ボタン） */
  panelOpen: boolean;
  /** 図面に寸法列を表示するか */
  visible: boolean;
  /** 消した区切り（× で削除したもの）。両隣の寸法が統合される。 */
  removedMarks: Record<string, true>;

  setConfigs: (configs: Record<string, ViewChains>) => void; // Base からのロード
  setRemovedMarks: (marks: Record<string, true>) => void;
  /** 区切りを消す（両隣の寸法を統合）。 */
  removeMark: (key: string) => void;
  /** 消した区切りを戻す。 */
  restoreMark: (key: string) => void;
  /** そのビューで消した区切りを全部戻す。 */
  restoreMarksFor: (viewKey: string) => void;
  setPanelOpen: (on: boolean) => void;
  setVisible: (on: boolean) => void;

  /** そのビューの構成。未設定なら既定を返す（保存はしない）。 */
  chainsFor: (viewKey: string) => ViewChains;
  /** 列を1つ足す（上限まで）。 */
  addColumn: (viewKey: string, side: ChainSide, source: ChainSource) => void;
  removeColumn: (viewKey: string, side: ChainSide, id: string) => void;
  setColumnSource: (viewKey: string, side: ChainSide, id: string, source: ChainSource) => void;
  /** そのビューを既定構成に戻す。 */
  resetView: (viewKey: string) => void;
}

export const useDimChainStore = create<DimChainState>((set, get) => {
  // 変更を1か所に集約（未設定ビューは既定から始める）。
  const mutate = (viewKey: string, fn: (v: ViewChains) => ViewChains) => {
    const s = get();
    const cur = s.configs[viewKey] || defaultChainsFor(viewKey);
    const configs = { ...s.configs, [viewKey]: fn(cur) };
    persist(configs);
    set({ configs });
  };

  return {
    configs: {},
    panelOpen: false,
    visible: true,
    removedMarks: {},

    setConfigs: (configs) => set({ configs: configs && typeof configs === "object" ? configs : {} }),
    setRemovedMarks: (marks) => set({ removedMarks: marks && typeof marks === "object" ? marks : {} }),

    removeMark: (key) =>
      set((s) => {
        const removedMarks = { ...s.removedMarks, [key]: true as const };
        persistMarks(removedMarks);
        return { removedMarks };
      }),

    restoreMark: (key) =>
      set((s) => {
        const removedMarks = { ...s.removedMarks };
        delete removedMarks[key];
        persistMarks(removedMarks);
        return { removedMarks };
      }),

    restoreMarksFor: (viewKey) =>
      set((s) => {
        const removedMarks: Record<string, true> = {};
        Object.keys(s.removedMarks).forEach((k) => {
          if (!k.startsWith(`${viewKey}|`)) removedMarks[k] = true;
        });
        persistMarks(removedMarks);
        return { removedMarks };
      }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),
    setVisible: (visible) => set({ visible }),

    chainsFor: (viewKey) => get().configs[viewKey] || defaultChainsFor(viewKey),

    addColumn: (viewKey, side, source) =>
      mutate(viewKey, (v) => {
        if ((v[side] || []).length >= MAX_COLUMNS_PER_SIDE) return v;
        return { ...v, [side]: [...(v[side] || []), col(source)] };
      }),

    removeColumn: (viewKey, side, id) =>
      mutate(viewKey, (v) => ({ ...v, [side]: (v[side] || []).filter((c) => c.id !== id) })),

    setColumnSource: (viewKey, side, id, source) =>
      mutate(viewKey, (v) => ({
        ...v,
        [side]: (v[side] || []).map((c) => (c.id === id ? { ...c, source } : c)),
      })),

    resetView: (viewKey) => mutate(viewKey, () => defaultChainsFor(viewKey)),
  };
});
