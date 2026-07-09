import { create } from 'zustand';

// 汎用の画像ライトボックス（拡大＋←→ナビ）。
// レンダー結果・ギャラリー・サイト/スライド成果物プレビュー等、どこからでも
// useLightboxStore.getState().show(images, index) で開ける共有オーバーレイ。

export interface LightboxImage {
  url: string;
  caption?: string;
}

interface LightboxState {
  open: boolean;
  images: LightboxImage[];
  index: number;
  show: (images: LightboxImage[], index?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
}

export const useLightboxStore = create<LightboxState>((set, get) => ({
  open: false,
  images: [],
  index: 0,
  show: (images, index = 0) => {
    if (!images?.length) return;
    set({ open: true, images, index: Math.max(0, Math.min(index, images.length - 1)) });
  },
  close: () => set({ open: false }),
  next: () => set((s) => (s.images.length ? { index: (s.index + 1) % s.images.length } : {})),
  prev: () => set((s) => (s.images.length ? { index: (s.index - 1 + s.images.length) % s.images.length } : {})),
  setIndex: (i) => set((s) => ({ index: Math.max(0, Math.min(i, s.images.length - 1)) })),
}));
