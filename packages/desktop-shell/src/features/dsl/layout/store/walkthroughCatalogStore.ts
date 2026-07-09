import { create } from "zustand";
import type { CatalogMatch } from "../../../dss/catalog/searchCatalog";

// ウォークスルーの「カタログで探す」= S.Library カタログ視覚照合（CLIP）。
// 結果は情報パネルの「似た商品」タブに表示する。アイテムごとに最後の結果を保持。
// 重い vision エンジン（transformers.js）はレイアウト読込時に巻き込まないよう、
// 実行時に動的 import する。

interface WalkthroughCatalogState {
  forItemId: string | null;   // 結果が属するアイテム
  busy: boolean;
  error: string | null;
  matches: CatalogMatch[];
  // 登録済みカタログ商品のサムネ補完: productUrl → cropDataUrl（S.Library 索引より）。
  // S.Models 詳細「似ている商品・購入先」と同じ画像を出すため。
  thumbMap: Record<string, string>;
  thumbsLoaded: boolean;
  thumbsLoading: boolean;
  run: (itemId: string, model: any) => Promise<void>;
  loadThumbs: () => Promise<void>;
  reset: () => void;
}

export const useWalkthroughCatalogStore = create<WalkthroughCatalogState>((set, get) => ({
  forItemId: null,
  busy: false,
  error: null,
  matches: [],
  thumbMap: {},
  thumbsLoaded: false,
  thumbsLoading: false,

  run: async (itemId, model) => {
    if (get().busy) return;
    set({ forItemId: itemId, busy: true, error: null, matches: [] });
    try {
      const [{ searchCatalogByImage }, { getModelQueryImage }] = await Promise.all([
        import("../../../dss/catalog/searchCatalog"),
        import("../../../dss/utils/productImageSearch"),
      ]);
      const query = await getModelQueryImage(model);
      if (!query) throw new Error("モデルのプレビュー画像を取得できませんでした。");
      const matches = await searchCatalogByImage(query, 12);
      // 実行中に別アイテムへ切り替わっていたら破棄。
      if (get().forItemId !== itemId) return;
      if (!matches.length) {
        set({ busy: false, matches: [], error: "カタログ索引が空、または一致がありません。S.Library でカタログを索引してください。" });
        return;
      }
      set({ busy: false, matches });
    } catch (e: any) {
      if (get().forItemId !== itemId) return;
      set({ busy: false, error: e?.message || "カタログ照合に失敗しました。" });
    }
  },

  loadThumbs: async () => {
    if (get().thumbsLoaded || get().thumbsLoading) return;
    set({ thumbsLoading: true });
    try {
      const mod = await import("../../../dsk/catalog/catalogVisionStore");
      const items = await mod.getAllItems();
      const map: Record<string, string> = {};
      for (const it of items) {
        if (it.productUrl && it.cropDataUrl) map[it.productUrl] = it.cropDataUrl;
      }
      set({ thumbMap: map, thumbsLoaded: true, thumbsLoading: false });
    } catch {
      set({ thumbsLoaded: true, thumbsLoading: false });
    }
  },

  reset: () => set({ forItemId: null, busy: false, error: null, matches: [] }),
}));
