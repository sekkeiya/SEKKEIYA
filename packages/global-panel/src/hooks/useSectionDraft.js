import { useState, useEffect } from "react";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { getGlobalDb } from "../api/firebaseDb";

/**
 * 特定のセクションの保留中(pending)のDraftを取得するフック
 * @param {string} projectId 
 * @param {string} section 
 * @returns {{ draft: Object|null, loading: boolean, error: Error }}
 */
export function useSectionDraft(projectId, section) {
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId || !section) {
      setDraft(null);
      setLoading(false);
      return;
    }

    const db = getGlobalDb();
    const draftsRef = collection(db, `projects/${projectId}/sections/${section}/drafts`);
    
    // orderByを組み合わせると複合インデックスが必要になる可能性があるため、
    // ここでは where("status", "==", "pending") だけで取得し、クライアント側でソートする
    const q = query(draftsRef, where("status", "==", "pending"));

    setLoading(true);

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setDraft(null);
        } else {
          // get all pending and sort by createdAt desc
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          docs.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
          setDraft(docs[0]);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`useSectionDraft error for ${section}:`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [projectId, section]);

  return { draft, loading, error };
}
