import { create } from "zustand";

// ウォークスルー中に「マテリアル（家具パターン）を切替」できるアイテムのレジストリ。
// FurnitureItem が選択肢（デフォルト＋各パターン）と apply を register し、
// HUD（WalkthroughItemInfoBadge）が「マテリアルを変える」ボタンのホバーで一覧展開する。

export interface ItemMaterialOption {
  id: string;
  label: string;
  swatchColor?: string;
  /** 素材のサムネ画像（albedoテクスチャ等）。あればギャラリーで色より優先表示。 */
  thumbUrl?: string;
  apply: () => void;
}

export interface ItemMaterialEntry {
  itemId: string;
  options: ItemMaterialOption[]; // [デフォルト, パターン1, ...]
  currentId?: string;            // 現在選択中の option id
  cycle?: () => void;            // 次のパターンへ（親ボタン押下用）
}

interface ItemMaterialRegistryState {
  map: Map<string, ItemMaterialEntry>;
  register: (entry: ItemMaterialEntry) => void;
  unregister: (itemId: string) => void;
  get: (itemId: string) => ItemMaterialEntry | null;
  has: (itemId: string) => boolean;
}

export const useItemMaterialRegistryStore = create<ItemMaterialRegistryState>((set, get) => ({
  map: new Map(),
  register: (entry) => { if (entry?.itemId) get().map.set(entry.itemId, entry); },
  unregister: (itemId) => { if (itemId) get().map.delete(itemId); },
  get: (itemId) => get().map.get(itemId) || null,
  has: (itemId) => (get().map.get(itemId)?.options?.length ?? 0) > 1,
}));
