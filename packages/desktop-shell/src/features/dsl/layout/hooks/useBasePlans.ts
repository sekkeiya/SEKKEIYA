// src/features/dsl/layout/hooks/useBasePlans.ts
// Subscribes to the Plan docs (planType === "plan") that belong to a given Base
// (rootBaseId === baseId), within projects/{projectId}/workspaces/{workspaceId}/layouts.
// Used by the dashboard right panel to list a selected Base's Plans (interior variations).
import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';

export interface BasePlan {
  id: string;
  name?: string;
  title?: string;
  thumbnailUrl?: string;
  updatedAt?: any;
  createdAt?: any;
  order?: number;
  [key: string]: unknown;
}

export function useBasePlans(
  projectId?: string | null,
  workspaceId?: string | null,
  baseId?: string | null,
  enabled: boolean = true,
) {
  const [plans, setPlans] = useState<BasePlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !projectId || !workspaceId || !baseId) {
      setPlans([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = collection(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts');
    const q = query(col, where('rootBaseId', '==', baseId), where('planType', '==', 'plan'));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as BasePlan[];
        // 作成順（order があればそれ、なければ createdAt）で安定ソート
        list.sort((a, b) => {
          const oa = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
          const ob = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
          if (oa !== ob) return oa - ob;
          const ta = a.createdAt?.seconds ?? 0;
          const tb = b.createdAt?.seconds ?? 0;
          return ta - tb;
        });
        setPlans(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[useBasePlans] snapshot error:', err);
        setPlans([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [projectId, workspaceId, baseId, enabled]);

  return { plans, loading };
}
