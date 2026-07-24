// useViewportDisplayStore — モードに依存しない「ビューポート表示」トグル。
// ビューポート設定パネルから操作し、モードを跨いで保持する（統一管理）。
//   - ghostFurniture: 家具を半透明（ゴースト）表示。床/壁/天井の面を選びやすくする用途。
//     既定 OFF（家具は通常表示）。Material 等の面ピック時に任意で ON にする。
//   - showSymbols: 図面上の「記号」（断面線 A-A'・ゾーン・展開記号）をまとめて表示/非表示。
//     既定 ON。配置そのものを見たいときに記号を一括で伏せる用途。
//   - drawingLight: 図面ビュー（展開/立面/断面＝側面正射）専用の補助光。
//     通常のシーン照明（太陽＋Ambience）はカメラ正対の壁面をほぼ照らさず
//     マテリアルが黒く沈むため、既定 ON でカメラ方向からのフィルライトを足す。
//     実際の陰影（日当たり等）を確認したいときに OFF にする用途。
import { create } from "zustand";

/**
 * 「記号」トグルで個別に切り替えられる項目。
 *   sceneGrid（床グリッド）は「表示」だけを切る。配置のスナップは
 *   useEditorModeStore.isGridVisible が持っているので、こちらを OFF にしても
 *   スナップの効き方は変わらない（図面から目障りな線を消すだけ）。
 */
export type SymbolKind = "section" | "elevation" | "grid" | "zone" | "dimension" | "sceneGrid";

export const SYMBOL_LABEL: Record<SymbolKind, string> = {
  section: "断面線",
  elevation: "展開記号",
  grid: "通り芯",
  zone: "ゾーン",
  dimension: "寸法列",
  sceneGrid: "グリッド",
};

/** 項目の並び順（メニューの表示順）。 */
export const SYMBOL_KINDS: SymbolKind[] = ["section", "elevation", "grid", "zone", "dimension", "sceneGrid"];

export type SymbolFlags = Record<SymbolKind, boolean>;

const ALL_ON: SymbolFlags = {
  section: true, elevation: true, grid: true, zone: true, dimension: true, sceneGrid: true,
};

interface ViewportDisplayStore {
  ghostFurniture: boolean;
  setGhostFurniture: (v: boolean) => void;
  toggleGhostFurniture: () => void;

  showSymbols: boolean;
  setShowSymbols: (v: boolean) => void;
  toggleShowSymbols: () => void;

  /** 記号の項目別スイッチ。showSymbols が OFF のときは全部隠れる（マスター＋個別）。 */
  symbolFlags: SymbolFlags;
  setSymbolFlag: (kind: SymbolKind, v: boolean) => void;
  toggleSymbolFlag: (kind: SymbolKind) => void;
  setAllSymbolFlags: (v: boolean) => void;
  /** その項目を図面に出すか（マスターとの AND）。 */
  isSymbolOn: (kind: SymbolKind) => boolean;

  drawingLight: boolean;
  setDrawingLight: (v: boolean) => void;
  toggleDrawingLight: () => void;
}

export const useViewportDisplayStore = create<ViewportDisplayStore>((set, get) => ({
  ghostFurniture: false,
  setGhostFurniture: (ghostFurniture) => set({ ghostFurniture }),
  toggleGhostFurniture: () => set((s) => ({ ghostFurniture: !s.ghostFurniture })),

  showSymbols: true,
  setShowSymbols: (showSymbols) => set({ showSymbols }),
  toggleShowSymbols: () => set((s) => ({ showSymbols: !s.showSymbols })),

  symbolFlags: { ...ALL_ON },
  setSymbolFlag: (kind, v) =>
    set((s) => ({ symbolFlags: { ...s.symbolFlags, [kind]: !!v } })),
  toggleSymbolFlag: (kind) =>
    set((s) => ({ symbolFlags: { ...s.symbolFlags, [kind]: !s.symbolFlags[kind] } })),
  setAllSymbolFlags: (v) =>
    set(() => ({
      symbolFlags: SYMBOL_KINDS.reduce((acc, k) => { acc[k] = !!v; return acc; }, {} as SymbolFlags),
    })),
  isSymbolOn: (kind) => {
    const s = get();
    return !!s.showSymbols && !!s.symbolFlags[kind];
  },

  drawingLight: true,
  setDrawingLight: (drawingLight) => set({ drawingLight }),
  toggleDrawingLight: () => set((s) => ({ drawingLight: !s.drawingLight })),
}));
