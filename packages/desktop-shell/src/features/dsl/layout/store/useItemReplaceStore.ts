import { create } from "zustand";
import type { RankedModel } from "../services/replaceSearch";

// ウォークスルーで、商品サムネ（カタログ/関連リンク）から
//   ① 似た S.Model モデルへ置換（CLIP 類似検索 → 候補選択）
//   ② 画像から 3D 生成 → 完了後に自動置換
// を行うための状態。置換結果は overrides に入り、FurnitureItem が表示モデルを差し替える。

export interface ReplaceTarget {
  id?: string;        // S.Model アセット ID（あればプロパティ取得に使う）
  glbUrl: string;
  title?: string;
  thumbUrl?: string | null;
  dimensions?: any;
}

interface ItemReplaceState {
  // 表示モデルの上書き（itemId → 置換先）。FurnitureItem が購読。
  overrides: Record<string, ReplaceTarget>;
  setOverride: (itemId: string, t: ReplaceTarget) => void;
  clearOverride: (itemId: string) => void;
  getOverride: (itemId: string) => ReplaceTarget | null;

  // 類似検索フロー（同時に1アイテム）
  searchItemId: string | null;
  searchBusy: boolean;
  searchError: string | null;
  candidates: RankedModel[];
  searchSimilar: (itemId: string, productImage: string, category: { mainCategory?: string | null; macroCategory?: string | null; excludeId?: string | null }) => Promise<void>;
  clearSearch: () => void;

  // 画像→3D生成中のアイテム（UIのスピナー用）。itemId → true
  generating: Record<string, boolean>;
  // productUrl があれば商品ページから実寸(mm)を取得し、置換モデルの寸法＋アップロード寸法に反映する。
  generateAndSwap: (itemId: string, imageUrl: string, projectId: string | null, productUrl?: string | null) => Promise<void>;
}

export const useItemReplaceStore = create<ItemReplaceState>((set, get) => ({
  overrides: {},
  setOverride: (itemId, t) => set((s) => ({ overrides: { ...s.overrides, [String(itemId)]: t } })),
  clearOverride: (itemId) =>
    set((s) => {
      const next = { ...s.overrides };
      delete next[String(itemId)];
      return { overrides: next };
    }),
  getOverride: (itemId) => get().overrides[String(itemId)] || null,

  searchItemId: null,
  searchBusy: false,
  searchError: null,
  candidates: [],
  searchSimilar: async (itemId, productImage, category) => {
    set({ searchItemId: itemId, searchBusy: true, searchError: null, candidates: [] });
    try {
      const { findSimilarModels } = await import("../services/replaceSearch");
      const results = await findSimilarModels(productImage, {
        mainCategory: category.mainCategory,
        macroCategory: category.macroCategory,
        excludeId: category.excludeId,
        topN: 8,
      });
      if (get().searchItemId !== itemId) return; // 別アイテムへ切替済み
      if (!results.length) {
        set({ searchBusy: false, candidates: [], searchError: "似たモデルが見つかりませんでした。「画像から3D生成」を試してください。" });
        return;
      }
      set({ searchBusy: false, candidates: results });
    } catch (e: any) {
      if (get().searchItemId !== itemId) return;
      set({ searchBusy: false, searchError: e?.message || "類似検索に失敗しました。" });
    }
  },
  clearSearch: () => set({ searchItemId: null, searchBusy: false, searchError: null, candidates: [] }),

  generating: {},
  generateAndSwap: async (itemId, imageUrl, projectId, productUrl) => {
    const key = String(itemId);
    set((s) => ({ generating: { ...s.generating, [key]: true } }));

    // 商品ページから実寸(mm)を並行取得（非ブロッキング）。取れたら置換モデル＆アップロード寸法へ反映。
    let scrapedDims: { width?: number; depth?: number; height?: number } | null = null;
    if (productUrl) {
      import("../../../dss/utils/productDimensions")
        .then((m) => m.fetchProductDimensions(productUrl))
        .then((d) => {
          if (!d) return;
          scrapedDims = d;
          // 自動アップロード（S.Model）で AI 推定より優先して反映させる。
          import("../../../../store/useDssUploadBridge").then(({ useDssUploadBridge }) => useDssUploadBridge.getState().setSeedDimensions(d)).catch(() => {});
          // 既に置換済みなら、その override に寸法をマージ（S.Layout で即・正寸に）。
          const cur = get().overrides[key];
          if (cur) get().setOverride(key, { ...cur, dimensions: { width: d.width, depth: d.depth, height: d.height } });
        })
        .catch(() => {});
    }

    try {
      const [{ useBatchGenStore }, { useAppStore }] = await Promise.all([
        import("../../../../store/useBatchGenStore"),
        import("../../../../store/useAppStore"),
      ]);
      // 自動保存（S.Model アップロードダイアログ）が開く設定のときは、完了後に
      // 元の画面（このS.Layout）へ戻すための復帰先を控えておく。
      const app = useAppStore.getState();
      if (useBatchGenStore.getState().autoSaveToModels) {
        app.setPendingReturnView({
          mainView: app.currentMainView,
          workspaceId: app.activeWorkspaceId,
          appScope: app.lastActiveAppScope,
        });
      }
      const imageId = `replace_${key}_${Date.now()}`;
      const { batchId } = await useBatchGenStore.getState().startBatch(
        [{ id: imageId, downloadUrl: imageUrl }],
        { projectId, workspaceId: null }, // workspaceId=null: 既存ボードへ自動配置はしない（置換はこちらで行う）
      );
      // このバッチの1件が done になったら override をセット（＝自動置換）。
      const unsub = useBatchGenStore.subscribe((state: any) => {
        const b = state.batches.find((x: any) => x.id === batchId);
        if (!b) return;
        const it = b.items[0];
        if (!it) return;
        if (it.status === "done" && it.glbUrl) {
          unsub();
          get().setOverride(key, {
            id: it.resultAssetId,
            glbUrl: it.glbUrl,
            // 商品ページから取れた実寸があれば適用（S.Layout で正寸表示）。
            dimensions: scrapedDims ? { width: scrapedDims.width, depth: scrapedDims.depth, height: scrapedDims.height } : undefined,
          });
          set((s) => ({ generating: { ...s.generating, [key]: false } }));
        } else if (it.status === "failed" || it.status === "skipped") {
          unsub();
          set((s) => ({ generating: { ...s.generating, [key]: false } }));
          // 失敗時は復帰先が残らないようクリア（無関係なアップロードで誤遷移しないため）。
          useAppStore.getState().setPendingReturnView(null);
        }
      });
    } catch (e) {
      set((s) => ({ generating: { ...s.generating, [key]: false } }));
      console.warn("[walkthrough] generateAndSwap failed", e);
    }
  },
}));
