import { create } from "zustand";

// ウォークスルー中にホバーで開示する「アイテム情報」（ⓘ）のレジストリ。
// FurnitureItem が register/unregister し、WalkthroughInteractionController が
// ホバー中の itemId をセット、HUD がⓘボタン＋情報パネルを表示する。

export interface ItemInfoLink {
  title?: string;
  url?: string;
}

export interface ItemInfoEntry {
  itemId: string;
  title: string;          // アイテム名（パネル見出し）
  description?: string;
  links?: ItemInfoLink[];
  thumbUrl?: string | null; // プレビュー画像（フローティングパネル用）
  modelId?: string | null;  // S.Models の元モデル ID（詳細画面遷移用）
  model?: any;              // S.Models 詳細を開くためのモデルオブジェクト

  // S.Models 相当のリッチ表示用（説明/リンクが無いモデルでも仕様を出せるように）
  categoryPath?: string | null; // 例: "家具 (既製品) / チェア / ラウンジチェア"
  dimsLabel?: string | null;    // 例: "W 1000 × D 780 × H 738 mm"
  priceLabel?: string | null;   // 例: "¥91,300"
  materials?: string[];         // 素材チップ
  tags?: string[];              // タグチップ
  catalogLinks?: any[];         // カタログ登録した似た商品 {title,url,thumbnail,source,price}
}

export type InfoPanelTab = "info" | "similar" | "links";

interface ItemInfoRegistryState {
  map: Map<string, ItemInfoEntry>;
  hoverInfoId: string | null;   // 照準/カーソルが今 info アイテム上にあるか
  openInfoId: string | null;    // 情報パネルを開いているアイテム
  openTab: InfoPanelTab;        // パネル上部の切替タブ（情報/似た商品/リンク）

  register: (entry: ItemInfoEntry) => void;
  unregister: (itemId: string) => void;
  get: (itemId: string) => ItemInfoEntry | null;
  has: (itemId: string) => boolean;
  setHoverInfoId: (id: string | null) => void;
  openInfo: (id: string | null, tab?: InfoPanelTab) => void;
  setOpenTab: (tab: InfoPanelTab) => void;
}

export const useItemInfoRegistryStore = create<ItemInfoRegistryState>((set, get) => ({
  map: new Map(),
  hoverInfoId: null,
  openInfoId: null,
  openTab: "info",

  register: (entry) => { if (entry?.itemId) get().map.set(entry.itemId, entry); },
  unregister: (itemId) => {
    if (!itemId) return;
    get().map.delete(itemId);
    set((s) => ({
      hoverInfoId: s.hoverInfoId === itemId ? null : s.hoverInfoId,
      openInfoId: s.openInfoId === itemId ? null : s.openInfoId,
    }));
  },
  get: (itemId) => get().map.get(itemId) || null,
  has: (itemId) => get().map.has(itemId),
  setHoverInfoId: (id) => set((s) => (s.hoverInfoId === id ? s : { hoverInfoId: id })),
  openInfo: (id, tab) => set((s) => ({ openInfoId: id, openTab: tab || (id ? s.openTab : "info") })),
  setOpenTab: (tab) => set({ openTab: tab }),
}));
