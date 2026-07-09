// src/features/dsl/layout/hooks/usePlanOptions.ts
// Subscribes to the Option docs (planType === "option") that belong to a given Plan
// (parentPlanId === planId), within projects/{projectId}/workspaces/{workspaceId}/layouts.
// Used by the dashboard right panel to list a selected Plan's material-study Options.
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@desktop/lib/firebase/client';

export interface PlanOption {
  id: string;
  name?: string;
  title?: string;
  thumbnailUrl?: string;
  [key: string]: unknown;
}

export function usePlanOptions(
  projectId?: string | null,
  workspaceId?: string | null,
  planId?: string | null,
  enabled: boolean = true,
) {
  const [options, setOptions] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId || !workspaceId || !planId) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = collection(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts');
    const q = query(col, where('parentPlanId', '==', planId), where('planType', '==', 'option'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setOptions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as PlanOption[]);
        setLoading(false);
      },
      (err) => {
        console.warn('[usePlanOptions] snapshot error:', err);
        setOptions([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [projectId, workspaceId, planId, enabled]);

  return { options, loading };
}
