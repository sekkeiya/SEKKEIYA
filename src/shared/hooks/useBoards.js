import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";

/**
 * 共通: orderIndex（なければ連番）→ createdAt で安定ソート
 * @param {import('../types/unifiedBoardTypes').UnifiedBoard[]} arr
 */
const getTimestampTime = (val) => {
  if (!val) return 0;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  const t = new Date(val).getTime();
  return isNaN(t) ? 0 : t;
};

const normalizeAndSort = (arr) => {
  const withIndex = arr.map((b, i) => ({
    ...b,
    orderIndex: typeof b.orderIndex === "number" ? b.orderIndex : i,
  }));
  return withIndex.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    const at = getTimestampTime(b?.createdAt);
    const bt = getTimestampTime(a?.createdAt);
    return bt - at;
  });
};

const useBoards = () => {
  const { user } = useAuth();
  
  // 統合された状態管理: 1つのリストとして保持
  const [boards, setBoards] = useState([]);
  
  // 購読管理リファレンス
  const unsubscribeRef = useRef({});

  const subscribeToBoards = useCallback(() => {
    if (!user?.uid) {
      setBoards([]);
      return;
    }

    // 全ての購読を解除
    Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    unsubscribeRef.current = {};

    const boardsRef = collection(db, "projects");

    // Unified Schema: ownerId か memberIds に userId が含まれるものを全取得
    const ownerQuery = query(
      boardsRef,
      where("ownerId", "==", user.uid)
    );

    const memberQuery = query(
      boardsRef,
      where("memberIds", "array-contains", user.uid)
    );

    let fetchedOwner = [];
    let fetchedMember = [];

    const flushBoards = () => {
      const mergedMap = new Map();
      fetchedOwner.forEach(b => mergedMap.set(b.id, b));
      fetchedMember.forEach(b => mergedMap.set(b.id, b));
      
      const allBoards = Array.from(mergedMap.values());
      // 全てを1つのリストとしてセット
      setBoards(normalizeAndSort(allBoards));
    };

    unsubscribeRef.current.owner = onSnapshot(ownerQuery, (snap) => {
      fetchedOwner = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      flushBoards();
    }, (err) => {
      console.error("[useBoards] Owner read error:", err);
      delete unsubscribeRef.current.owner;
      fetchedOwner = [];
      flushBoards();
    });

    unsubscribeRef.current.member = onSnapshot(memberQuery, (snap) => {
      fetchedMember = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      flushBoards();
    }, (err) => {
      console.error("[useBoards] Member read error:", err);
      delete unsubscribeRef.current.member;
      fetchedMember = [];
      flushBoards();
    });

  }, [user?.uid]);

  useEffect(() => {
    subscribeToBoards();
    return () => {
      Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
      unsubscribeRef.current = {};
    };
  }, [subscribeToBoards]);

  return {
    boards,
    // 後方互換で refresh 用の関数を提供
    refreshBoards: subscribeToBoards,
    setBoards,

    // 一時的な後方互換用 (既存のUIが壊れるのを防ぐため, 削除予定)
    myBoards: boards.filter(b => b.ownerId === user.uid),
    teamBoards: boards.filter(b => b.ownerId !== user.uid),
  };
};

export default useBoards;
