// Chat の商品検索結果（共有グリッド描画用）の非永続ストア。
// 画像base64入りの商品配列を localStorage に永続化すると肥大化するため、
// メッセージには resultId だけを持たせ、実データ（items）はここ（メモリ）に保持する。
// セッション内でのみ有効＝リロード後は消える（再検索で再生成）。
import { create } from 'zustand';
import type { ProductResultItem } from '../features/search/ProductResultGrid';

interface ChatProductResultsState {
  byId: Record<string, ProductResultItem[]>;
  setResults: (id: string, items: ProductResultItem[]) => void;
}

export const useChatProductResultsStore = create<ChatProductResultsState>((set) => ({
  byId: {},
  setResults: (id, items) => set((s) => ({ byId: { ...s.byId, [id]: items } })),
}));
