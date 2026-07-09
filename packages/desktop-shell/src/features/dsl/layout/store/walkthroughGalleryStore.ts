import { create } from "zustand";

// ウォークスルーで親ボタン（動かす/マテリアル/家具）にホバーしたとき、
// 画面下部に表示する「ギャラリー」の状態。どのアイテムのどのカテゴリを開いているか。
// 親ボタンとギャラリー本体の双方が hover を出し入れするため、少し遅延して閉じる。

export type GalleryCategory = "action" | "material" | "swap" | "catalog" | "links";

interface GalleryPanel {
  itemId: string;
  category: GalleryCategory;
}

interface WalkthroughGalleryState {
  panel: GalleryPanel | null;
  tick: number; // 選択変更時に bump して再描画を促す
  open: (itemId: string, category: GalleryCategory) => void;
  closeSoon: () => void;
  keepOpen: () => void;
  bump: () => void;
}

let closeTimer: any = null;

export const useWalkthroughGalleryStore = create<WalkthroughGalleryState>((set) => ({
  panel: null,
  tick: 0,
  open: (itemId, category) => {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    set({ panel: { itemId, category } });
  },
  keepOpen: () => { if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; } },
  closeSoon: () => {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => { set({ panel: null }); closeTimer = null; }, 200);
  },
  bump: () => set((s) => ({ tick: s.tick + 1 })),
}));
