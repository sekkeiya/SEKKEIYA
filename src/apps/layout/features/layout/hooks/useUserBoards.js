// ✅ 追加：src/features/layout/hooks/useUserBoards.js
import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

const normalizeAndSort = (arr) => {
  const withIndex = arr.map((b, i) => ({
    ...b,
    orderIndex: typeof b.orderIndex === "number" ? b.orderIndex : i,
  }));
  return withIndex.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    const at = b?.createdAt?.toMillis?.() ?? b?.createdAt?.seconds * 1000 ?? 0;
    const bt = a?.createdAt?.toMillis?.() ?? a?.createdAt?.seconds * 1000 ?? 0;
    return bt - at;
  });
};

export function useUserBoards(uid) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef({});

  const subscribeToBoards = useCallback(() => {
    if (!uid) {
      setBoards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    unsubscribeRef.current.owner?.();
    unsubscribeRef.current.member?.();

    const boardsCol = collection(db, "boards");

    const ownerQuery = query(boardsCol, where("ownerId", "==", uid));
    const memberQuery = query(boardsCol, where("memberIds", "array-contains", uid));

    let fetchedOwner = [];
    let fetchedMember = [];

    const flushAllBoards = () => {
      const mergedMap = new Map();
      fetchedOwner.forEach(b => mergedMap.set(b.id, b));
      fetchedMember.forEach(b => mergedMap.set(b.id, b));
      
      const allBoards = Array.from(mergedMap.values());
      const normalized = normalizeAndSort(allBoards);
      setBoards(normalized);
      setLoading(false);
    };

    const processDocs = (docs) => {
      return docs.map((d, i) => ({
        id: d.id,
        boardId: d.id,
        ...d.data(),
        orderIndex: typeof d.data().orderIndex === "number" ? d.data().orderIndex : i,
        showInSidebar: d.data().showInSidebar ?? true,
        isPublic: d.data().visibility === "public",
        isPrivate: d.data().visibility === "private",
        readableByMe: true,
      }));
    };

    unsubscribeRef.current.owner = onSnapshot(ownerQuery, (snap) => {
      fetchedOwner = processDocs(snap.docs);
      flushAllBoards();
    }, (err) => { setError(err); setLoading(false); });

    unsubscribeRef.current.member = onSnapshot(memberQuery, (snap) => {
      fetchedMember = processDocs(snap.docs);
      flushAllBoards();
    }, (err) => { setError(err); setLoading(false); });

  }, [uid]);

  useEffect(() => {
    subscribeToBoards();
    return () => {
      unsubscribeRef.current.owner?.();
      unsubscribeRef.current.member?.();
    };
  }, [subscribeToBoards]);

  return { boards, loading, error };
}
