import { create } from "zustand";

// ウォークスルー中に「家具置き換え」できるアイテムのレジストリ。
// FurnitureItem が選択肢（元＋各候補）と apply を register し、
// HUD（WalkthroughItemInfoBadge）が「家具を変える」ボタンのホバーで一覧展開する。

export interface ItemSwapOption {
  id: string;
  label: string;
  thumbUrl?: string | null;
  apply: () => void;
}

export interface ItemSwapEntry {
  itemId: string;
  options: ItemSwapOption[]; // [元モデル, 候補1, ...]
  currentId?: string;        // 現在表示中の option id
  cycle?: () => void;        // 次の候補へ（親ボタン押下用）
}

interface ItemSwapRegistryState {
  map: Map<string, ItemSwapEntry>;
  register: (entry: ItemSwapEntry) => void;
  unregister: (itemId: string) => void;
  get: (itemId: string) => ItemSwapEntry | null;
  has: (itemId: string) => boolean;
}

export const useItemSwapRegistryStore = create<ItemSwapRegistryState>((_set, get) => ({
  map: new Map(),
  register: (entry) => { if (entry?.itemId) get().map.set(entry.itemId, entry); },
  unregister: (itemId) => { if (itemId) get().map.delete(itemId); },
  get: (itemId) => get().map.get(itemId) || null,
  has: (itemId) => (get().map.get(itemId)?.options?.length ?? 0) > 1,
}));
