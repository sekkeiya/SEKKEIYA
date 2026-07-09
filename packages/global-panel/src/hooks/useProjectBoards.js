import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getGlobalDb } from "../api/firebaseDb";

const useProjectBoards = (projectId) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);

  const subscribeToBoards = useCallback(() => {
    if (!projectId) {
      setBoards([]);
      setLoading(false);
      return () => {};
    }

    setLoading(true);
    const boardsRef = collection(getGlobalDb(), "projects", projectId, "sections");

    const unsub = onSnapshot(boardsRef, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBoards(data.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      }));
      setLoading(false);
    }, (err) => {
      console.error("[useProjectBoards] Error:", err);
      setLoading(false);
    });

    return unsub;
  }, [projectId]);

  useEffect(() => {
    const unsub = subscribeToBoards();
    return () => unsub();
  }, [subscribeToBoards]);

  return { boards, loading };
};

export default useProjectBoards;
