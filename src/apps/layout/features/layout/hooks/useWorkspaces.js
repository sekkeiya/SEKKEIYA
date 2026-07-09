// src/features/layout/hooks/useWorkspaces.js
import { useEffect, useState, useRef, useCallback } from "react";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

const normalizeAndSort = (arr) => {
  return arr.sort((a, b) => {
    const at = b?.updatedAt?.toMillis?.() ?? b?.updatedAt?.seconds * 1000 ?? 0;
    const bt = a?.updatedAt?.toMillis?.() ?? a?.updatedAt?.seconds * 1000 ?? 0;
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
// Subscribes to ALL plans within a workspace.
// Returns a flat array. The UI will assemble them into a tree using parentPlanId/rootBaseId.
export function useWorkspacePlans(projectId, workspaceId) {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const unsubscribeRef = useRef(null);
  
    const subscribeToPlans = useCallback(() => {
      if (!projectId || !workspaceId) {
        setPlans([]);
        setLoading(false);
        return;
      }
  
      setLoading(true);
      if (unsubscribeRef.current) {
          unsubscribeRef.current();
      }
  
      // get all plans without deeply nesting. We can filter/sort them on the client.
      const plansCol = collection(db, "projects", projectId, "workspaces", workspaceId, "plans");
      const q = query(plansCol, orderBy("sortOrder", "asc"));
  
      unsubscribeRef.current = onSnapshot(q, (snap) => {
        const docs = snap.docs.map((d) => ({
          id: d.id,
          planId: d.id,
          ...d.data(),
        }));
        
        // Sorting by sortOrder is already done by query, but we can do a fallback
        setPlans(docs);
        setLoading(false);
      }, (err) => { 
        console.error(err);
        setError(err); 
        setLoading(false); 
      });
  
    }, [projectId, workspaceId]);
  
    useEffect(() => {
      subscribeToPlans();
      return () => {
        if (unsubscribeRef.current) unsubscribeRef.current();
      };
    }, [subscribeToPlans]);
  
    return { plans, loading, error };
}
