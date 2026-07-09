import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { getGlobalDb } from "./firebaseDb";

/**
 * StrategyWorkspace全体を購読するカスタムフック
 * @param {string} projectId 
 */
export function useStrategyWorkspace(projectId) {
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) {
      setMeta(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const db = getGlobalDb();
    const metaRef = doc(db, "projects", projectId, "sections", "strategy");
    const itemsRef = collection(db, "projects", projectId, "sections", "strategy", "items");

    setLoading(true);

    // Subscribe to Meta
    const unsubMeta = onSnapshot(
      metaRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setMeta({ id: docSnap.id, ...docSnap.data() });
        } else {
          // Initialize empty state structurally matching user requirements
          setMeta({
            type: "strategy",
            name: "戦略・コンセプト",
            conceptTitle: "",
            conceptDescription: "",
            progress: 0,
            createdAt: null,
            updatedAt: null,
          });
        }
      },
      (err) => {
        console.error("useStrategyWorkspace meta error:", err);
        setError(err);
      }
    );

    // Subscribe to Items
    const unsubItems = onSnapshot(
      itemsRef,
      (snap) => {
        const fetchedItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort by order locally so it is guaranteed sequential
        fetchedItems.sort((a, b) => (a.order || 0) - (b.order || 0));
        setItems(fetchedItems);
        setLoading(false);
      },
      (err) => {
        console.error("useStrategyWorkspace items error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubMeta();
      unsubItems();
    };
  }, [projectId]);

  // Project Home Summary (Selector)
  // Extracts the necessary summary bits directly avoiding duplication
  const summary = useMemo(() => {
    if (loading) return null;
    
    // Top Personas
    const personasList = items.filter(b => b.type === "persona");
    const firstPersona = personasList.length > 0 ? personasList[0] : null;
    const additionalPersonasCount = Math.max(0, personasList.length - 1);

    // Top Issues
    const issuesList = items.filter(b => b.type === "issue");
    const topIssues = issuesList.slice(0, 3); // Get top 3 by sorted order

    return {
      conceptTitle: meta?.conceptTitle || "",
      conceptDescription: meta?.conceptDescription || "",
      progress: meta?.progress || 0,
      personaSummary: {
        firstPersona,
        additionalCount: additionalPersonasCount
      },
      topIssues
    };
  }, [meta, items, loading]);

  return { meta, items, summary, loading, error };
}

/**
 * AI Context用の抽出・整形済み戦略サマリーを取得するセレクタフック
 * @param {string} projectId 
 */
export function useStrategyContextSummary(projectId) {
  const { meta, items, loading } = useStrategyWorkspace(projectId);

  const strategySummary = useMemo(() => {
    if (loading || !meta) return null;

    // 1. Concept
    const concept = {
      title: meta.conceptTitle || "",
      description: meta.conceptDescription || ""
    };

    // 2. Personas (Top 3)
    // fallback: needsが無ければtraitsを、それも無ければ空文字を返す
    const allPersonas = items.filter(i => i.type === "persona");
    const topPersonas = allPersonas.slice(0, 3).map(p => ({
      name: p.title || p.name || "",
      needs: p.needs || p.traits || ""
    }));

    // 3. Issues (Top 3, prioritize 'open' status if available)
    const allIssues = items.filter(i => i.type === "issue");
    // Sort logic to prioritize open issues, though mostly relying on order
    const openIssues = allIssues.filter(iss => iss.status !== "resolved");
    const topIssues = (openIssues.length >= 3 ? openIssues : allIssues).slice(0, 3).map(iss => ({
      title: iss.title || "",
      status: iss.status || "open"
    }));

    // Return sparse structured object
    return {
      concept,
      personas: topPersonas,
      issues: topIssues
    };
  }, [meta, items, loading]);

  return { strategySummary, loading };
}

/**
 * メタデータの更新
 */
export const updateStrategyMeta = async (projectId, data) => {
  if (!projectId) return;
  const db = getGlobalDb();
  const metaRef = doc(db, "projects", projectId, "sections", "strategy");
  
  // Update or set if it doesn't exist
  await setDoc(metaRef, { 
    ...data, 
    type: "strategy",
    // Name is preserved if passed, standard string overriden mostly
    updatedAt: serverTimestamp() 
  }, { merge: true });
};

/**
 * アイテム（Persona / Issue等）の追加
 */
export const addStrategyItem = async (projectId, itemData) => {
  if (!projectId) return null;
  const db = getGlobalDb();
  const itemRef = doc(collection(db, "projects", projectId, "sections", "strategy", "items"));
  
  const payload = {
    ...itemData,
    id: itemRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(itemRef, payload);
  return itemRef.id;
};

/**
 * アイテムの更新
 */
export const updateStrategyItem = async (projectId, itemId, data) => {
  if (!projectId || !itemId) return;
  const db = getGlobalDb();
  const itemRef = doc(db, "projects", projectId, "sections", "strategy", "items", itemId);
  
  await updateDoc(itemRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};

/**
 * アイテムの削除
 */
export const deleteStrategyItem = async (projectId, itemId) => {
  if (!projectId || !itemId) return;
  const db = getGlobalDb();
  const itemRef = doc(db, "projects", projectId, "sections", "strategy", "items", itemId);
  await deleteDoc(itemRef);
};

/**
 * 複数アイテムのOrderを一括更新 (Batch processing)
 * @param {string} projectId 
 * @param {Array<{id: string, order: number}>} itemsToUpdate 
 */
export const updateStrategyItemsOrder = async (projectId, itemsToUpdate) => {
  if (!projectId || !itemsToUpdate || itemsToUpdate.length === 0) return;
  const db = getGlobalDb();
  const batch = writeBatch(db);

  itemsToUpdate.forEach(item => {
    const itemRef = doc(db, "projects", projectId, "sections", "strategy", "items", item.id);
    batch.update(itemRef, { 
      order: item.order,
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
};
