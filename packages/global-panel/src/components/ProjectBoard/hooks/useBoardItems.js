import { useState, useEffect, useCallback, useRef } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getGlobalDb } from "../../../api/firebaseDb";


/**
 * orderIndex/sortOrder -> createdAt に基づき要素をソートする
 */
const getTimestampTime = (val) => {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

const sortItems = (arr) => {
  return arr.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder && a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
    const at = getTimestampTime(a.createdAt);
    const bt = getTimestampTime(b.createdAt);
    return bt - at; // 新しいものが上
  });
};

/**
 * 統合スキーマに対応した Dual-Read 版の useBoardItems
 * @param {Object} props - 引数オブジェクト
 * @param {Object} props.board - 検索対象のボード
 * @param {string} [props.itemCollection="model"] - 旧スキーマの fallback 先 / 新スキーマの itemType フィルタに使用
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
      const db = getGlobalDb();
      if (!db) {
        throw new Error("Global DB is not set.");
      }

      // -------------------------------------------------------------
      // 1. 新スキーマからの読み出し (Single Read)
      // /boards/{boardId}/items
      // -------------------------------------------------------------
      const newItemsRef = query(
        collection(db, "boards", board.id, "items"),
        where("itemType", "==", expectedItemType)
      );
      
      unsubscribeRef.current.newItems = onSnapshot(newItemsRef, (snap) => {
        const parsedItems = snap.docs.map(d => ({ id: d.id, boardId: board.id, ...d.data() }));
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
