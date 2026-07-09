// src/features/layout/hooks/useWorkspaces.js
import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";

const normalizeAndSort = (arr) => {
  return arr.sort((a, b) => {
    const at = b?.updatedAt?.toMillis?.() ?? (b?.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : 0);
    const bt = a?.updatedAt?.toMillis?.() ?? (a?.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : 0);
    return bt - at;
  });
};

export function useWorkspaces(projectId, uid) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const unsubscribeRef = useRef(null);

  const subscribeToWorkspaces = useCallback(() => {
    if (!projectId || !uid) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    if (unsubscribeRef.current) {
        unsubscribeRef.current();
    }

    // Projects -> Workspaces
    const wsCol = collection(db, "projects", projectId, "workspaces");
    
    // For now, fetch all workspaces in the project that the user has access to.
    // If visibility is implemented, we can filter by ownerId or memberIds.
    // However, in Sekkeiya, generally if you have project access, you have workspace access.
    // If strict access is required, you can add query constraints here.
    const wsQuery = query(wsCol); 

    unsubscribeRef.current = onSnapshot(wsQuery, (snap) => {
      const docs = snap.docs.map((d, i) => ({
        id: d.id,
        workspaceId: d.id,
        ...d.data(),
        orderIndex: i, // keep index
      }));
      setWorkspaces(normalizeAndSort(docs));
      setLoading(false);
    }, (err) => { 
      console.error(err);
      setError(err); 
      setLoading(false); 
    });

  }, [projectId, uid]);

  useEffect(() => {
    subscribeToWorkspaces();
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [subscribeToWorkspaces]);

  return { workspaces, loading, error };
}

// ----------------------------------------------------------------------
// Subscribes to ALL layouts within a workspace.
// Returns a flat array of Layouts.
export function useWorkspaceLayouts(projectId, workspaceId) {
    const [layouts, setLayouts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const unsubscribeRef = useRef(null);
  
    const subscribeToLayouts = useCallback(() => {
      if (!projectId || !workspaceId) {
        setLayouts([]);
        setLoading(false);
        return;
      }
  
      setLoading(true);
      if (unsubscribeRef.current) {
          unsubscribeRef.current();
      }
  
      // get all layouts
      const layoutsCol = collection(db, "projects", projectId, "workspaces", workspaceId, "layouts");
      const q = query(layoutsCol);
  
      unsubscribeRef.current = onSnapshot(q, (snap) => {
        try {
          const docs = snap.docs.map((d) => ({
            id: d.id,
            layoutId: d.id,
            ...d.data(),
          }));
          
          // Sorting by sortOrder on client to ensure we don't miss docs without it
          docs.sort((a, b) => {
            const aT = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const bT = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : aT;
            const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : bT;
            return (aOrder || 0) - (bOrder || 0);
          });

          setLayouts(docs);
        } catch (error) {
          console.error("Error processing layouts snapshot:", error);
          setError(error);
        } finally {
          setLoading(false);
        }
      }, (err) => { 
        console.error(err);
        setError(err); 
        setLoading(false); 
      });
  
    }, [projectId, workspaceId]);
  
    useEffect(() => {
      subscribeToLayouts();
      return () => {
        if (unsubscribeRef.current) unsubscribeRef.current();
      };
    }, [subscribeToLayouts]);
  
    return { layouts, loading, error };
}
