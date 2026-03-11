import { useState, useEffect, useCallback, useRef } from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { normalizeToUnifiedBoardItem } from "@/shared/api/adapters/boardAdapters";
import { getBoardItems as getLegacyBoardItems } from "@/shared/api/boards/getBoardItems";

/**
 * orderIndex/sortOrder -> createdAt に基づき要素をソートする
 */
const sortItems = (arr) => {
  return arr.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at; // 新しいものが上
  });
};

/**
 * 統合スキーマに対応した Dual-Read 版の useBoardItems
 * @param {Object} props - 引数オブジェクト
 * @param {import('../../shared/types/unifiedBoardTypes').UnifiedBoard} props.board - 検索対象のボード
 * @param {string} [props.itemCollection="model"] - 旧スキーマの fallback 先 (例: "models", "drawings") / 新スキーマの itemType フィルタに使用
 * @param {string} props.currentUserId - ログイン中ユーザーID (fallbackの権限解決などに利用)
 */
export function useBoardItems({ board, itemCollection = "models", currentUserId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const unsubscribeRef = useRef({});

  // old/newマッピングのため、itemCollection名を singular の itemType に簡易変換
  // 例: "models" -> "model", "drawings" -> "drawing"
  const expectedItemType = itemCollection.endsWith('s') 
    ? itemCollection.slice(0, -1) 
    : itemCollection;

  const fetchDualReadItems = useCallback(async () => {
    if (!board || !board.id) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    unsubscribeRef.current = {};

    try {
      // -------------------------------------------------------------
      // 1. 新スキーマからの読み出し (Single Read)
      // /boards/{boardId}/items
      // -------------------------------------------------------------
      const newItemsRef = query(
        collection(db, "boards", board.id, "items"),
        where("itemType", "==", expectedItemType)
      );
      
      unsubscribeRef.current.newItems = onSnapshot(newItemsRef, (snap) => {
        const parsedItems = snap.docs.map(d => 
            normalizeToUnifiedBoardItem(d.data(), d.id, board.id, board.ownerId)
        );
        setItems(sortItems(parsedItems));
        setLoading(false);
      }, (err) => {
        console.warn("[useBoardItems] Unified Schema Subscription failed.", err);
        setError(err);
        setLoading(false);
      });

    } catch (err) {
      console.error("[useBoardItems] Error setting up listener:", err);
      setError(err);
      setLoading(false);
    }
  }, [board, itemCollection, expectedItemType]);

  useEffect(() => {
    fetchDualReadItems();
    return () => {
      Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    };
  }, [fetchDualReadItems]);

  return { items, loading, error, refetch: fetchDualReadItems };
}
