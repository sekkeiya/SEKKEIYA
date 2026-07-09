import { create } from 'zustand';

// 右サイドバーの「生成」ボタン → 下部ギャラリー（MediaGalleryBar）への橋渡し。
// MediaGalleryBar が renderTick を監視し、選択中アングルをレンダリングする。
// rendering は MediaGalleryBar が更新し、ボタンの無効化に使う。
interface MediaRenderState {
  renderTick: number;
  requestRender: () => void;
  rendering: boolean;
  setRendering: (v: boolean) => void;
}

export const useMediaRenderStore = create<MediaRenderState>((set) => ({
  renderTick: 0,
  requestRender: () => set((s) => ({ renderTick: s.renderTick + 1 })),
  rendering: false,
  setRendering: (v) => set({ rendering: v }),
}));
