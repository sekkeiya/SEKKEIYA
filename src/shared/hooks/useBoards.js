import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { useAuth } from "@/features/auth/context/AuthContext";
import { normalizeToUnifiedBoard } from "../api/adapters/boardAdapters";

/**
 * 共通: orderIndex（なければ連番）→ createdAt で安定ソート
 * @param {import('../types/unifiedBoardTypes').UnifiedBoard[]} arr
 */
const normalizeAndSort = (arr) => {
  const withIndex = arr.map((b, i) => ({
    ...b,
    orderIndex: typeof b.orderIndex === "number" ? b.orderIndex : i,
  }));
  return withIndex.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    const at = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    const bt = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    return bt - at;
  });
};

const useBoards = () => {
  const { user } = useAuth();
  
  // 統合された状態管理
  const [myBoards, setMyBoards] = useState([]);
  const [teamBoards, setTeamBoards] = useState([]);
  
  // 購読管理リファレンス
  const unsubscribeRef = useRef({});

  const subscribeToBoards = useCallback(() => {
    if (!user?.uid) return;

    // 全ての購読を解除
    Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    unsubscribeRef.current = {};

    const boardsRef = collection(db, "boards");

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
      const my = allBoards.filter(b => b.boardType !== "teamBoards");
      const team = allBoards.filter(b => b.boardType === "teamBoards");

      setMyBoards(normalizeAndSort(my));
      setTeamBoards(normalizeAndSort(team));
    };

    unsubscribeRef.current.owner = onSnapshot(ownerQuery, (snap) => {
      console.log(`[useBoards] Owner query returned ${snap.docs.length} boards.`);
      fetchedOwner = snap.docs.map(d => normalizeToUnifiedBoard(d.data(), d.id, false));
      flushBoards();
    }, (err) => console.error("[useBoards] Owner read error:", err));

    unsubscribeRef.current.member = onSnapshot(memberQuery, (snap) => {
      console.log(`[useBoards] Member query returned ${snap.docs.length} boards.`);
      fetchedMember = snap.docs.map(d => normalizeToUnifiedBoard(d.data(), d.id, true));
      flushBoards();
    }, (err) => console.error("[useBoards] Member read error:", err));

  }, [user?.uid]);

  useEffect(() => {
    subscribeToBoards();
    return () => {
      Object.values(unsubscribeRef.current).forEach(unsub => typeof unsub === 'function' && unsub());
    };
  }, [subscribeToBoards]);

  return {
    myBoards,
    teamBoards,
    refreshTeamBoards: subscribeToBoards, // 後方互換性のため残す
    setMyBoards,
    setTeamBoards,
  };
};

export default useBoards;
