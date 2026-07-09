// useViewportDisplayStore — モードに依存しない「ビューポート表示」トグル。
// ビューポート設定パネルから操作し、モードを跨いで保持する（統一管理）。
//   - ghostFurniture: 家具を半透明（ゴースト）表示。床/壁/天井の面を選びやすくする用途。
//     既定 OFF（家具は通常表示）。Material 等の面ピック時に任意で ON にする。
import { create } from "zustand";

interface ViewportDisplayStore {
  ghostFurniture: boolean;
  setGhostFurniture: (v: boolean) => void;
  toggleGhostFurniture: () => void;
}

export const useViewportDisplayStore = create<ViewportDisplayStore>((set) => ({
  ghostFurniture: false,
  setGhostFurniture: (ghostFurniture) => set({ ghostFurniture }),
  toggleGhostFurniture: () => set((s) => ({ ghostFurniture: !s.ghostFurniture })),
}));
