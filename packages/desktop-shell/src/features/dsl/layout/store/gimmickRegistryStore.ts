import { create } from "zustand";

// ウォークスルーでクリック操作できる「ギミック」（ドア開閉など）のレジストリ。
// 1アイテムに複数ギミックを持てる（itemId -> GimmickEntry[]）。
// FurnitureItem 配下の GimmickBinder が register/unregister し、
// WalkthroughInteractionController が itemId からリストを引いて toggle を呼ぶ。

export interface GimmickEntry {
  itemId: string;
  gimmickId: string;
  type: "clip" | "hinge";
  label: string;        // HUD 表示用（"ドア" など）
  toggle: () => void;   // 開⇄閉
  isOpen: () => boolean;
}

export interface GimmickRegistryState {
  map: Map<string, GimmickEntry[]>;
  hoverLabel: string | null;   // 照準/カーソルが今ギミック上にあるか（HUD 用）
  hoverItemId: string | null;  // ホバー中の「操作 or 情報」を持つアイテム（全モード共通バッジ用）
  activeItemId: string | null; // クリックでピン留めされた操作対象（操作/情報ボタン群を表示）

  register: (entry: GimmickEntry) => void;
  unregister: (itemId: string, gimmickId?: string) => void;
  getList: (itemId: string) => GimmickEntry[];
  get: (itemId: string) => GimmickEntry | null;
  has: (itemId: string) => boolean;
  setHoverLabel: (label: string | null) => void;
  setHoverItemId: (id: string | null) => void;
  setActiveItemId: (id: string | null) => void;
  clear: () => void;
}

export const useGimmickRegistryStore = create<GimmickRegistryState>((set, get) => ({
  map: new Map(),
  hoverLabel: null,
  hoverItemId: null,
  activeItemId: null,

  register: (entry) => {
    if (!entry?.itemId || !entry?.gimmickId) return;
    const m = get().map;
    const arr = m.get(entry.itemId) || [];
    const idx = arr.findIndex((e) => e.gimmickId === entry.gimmickId);
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    m.set(entry.itemId, arr);
  },

  unregister: (itemId, gimmickId) => {
    if (!itemId) return;
    const m = get().map;
    if (!gimmickId) { m.delete(itemId); }
    else {
      const arr = m.get(itemId);
      if (arr) {
        const next = arr.filter((e) => e.gimmickId !== gimmickId);
        if (next.length) m.set(itemId, next); else m.delete(itemId);
      }
    }
    set((s) => (s.activeItemId === itemId && !m.has(itemId) ? { activeItemId: null } : s));
  },

  getList: (itemId) => get().map.get(itemId) || [],
  get: (itemId) => (get().map.get(itemId) || [])[0] || null,
  has: (itemId) => (get().map.get(itemId)?.length ?? 0) > 0,

  setHoverLabel: (label) => set((s) => (s.hoverLabel === label ? s : { hoverLabel: label })),
  setHoverItemId: (id) => set((s) => (s.hoverItemId === id ? s : { hoverItemId: id })),
  setActiveItemId: (id) => set((s) => (s.activeItemId === id ? s : { activeItemId: id })),

  clear: () => set({ map: new Map(), hoverLabel: null, hoverItemId: null, activeItemId: null }),
}));
