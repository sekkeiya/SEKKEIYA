import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { getGlobalDb } from "../api/firebaseDb";

/**
 * 特定のセクションのHistoryをリアルタイム講読するフック
 * @param {string} projectId 
 * @param {string} section 
 * @returns {{ history: Array, loading: boolean, error: Error }}
 */
export function useSectionHistory(projectId, section) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId || !section) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const db = getGlobalDb();
    const historyRef = collection(db, `projects/${projectId}/sections/${section}/history`);
    const q = query(historyRef, orderBy("version", "desc"));

    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistory(fetched);
        setLoading(false);
      },
      (err) => {
        console.error(`useSectionHistory error for ${section}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, section]);

  return { history, loading, error };
}
