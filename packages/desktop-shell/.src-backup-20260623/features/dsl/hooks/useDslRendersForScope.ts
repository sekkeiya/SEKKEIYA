import { useState, useEffect, useRef } from 'react';
import { collectionGroup, getDocs, query, where } from 'firebase/firestore';
import { db } from '@desktop/lib/firebase/client';
import { getRenders } from '../layout/api/layoutRendersApi';
import type { DslRenderDoc } from '@desktop/features/projects/types';

export type RenderWithContext = DslRenderDoc & {
  id: string;
  storagePath?: string;
  planId: string;
  planName: string;
  projectId: string;
  workspaceId: string;
};

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val?.seconds) return val.seconds * 1000;
  if (val?.toMillis) return (val as any).toMillis();
  return 0;
}

/**
 * Fetch renders for a specific owner via collectionGroup('renders').
 * Used for My Layouts / global scopes where we don't have the full plan hierarchy.
 * Render documents must include `projectId`, `workspaceId`, `planId`, `createdBy` fields
 * (saved by saveRenderToLayout since the propagation fix).
 */
export function useDslRendersForOwner(
  uid: string | null,
  enabled: boolean,
): { renders: RenderWithContext[]; loading: boolean } {
  const [renders, setRenders] = useState<RenderWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!enabled || !uid) {
      setRenders([]);
      return;
    }

    abortRef.current = false;
    setLoading(true);

    (async () => {
      try {
        const q = query(collectionGroup(db, 'renders'), where('createdBy', '==', uid));
        const snap = await getDocs(q);

        if (abortRef.current) return;

        const results: RenderWithContext[] = snap.docs
          .map((d) => {
            const data = d.data() as any;
            // projectId/workspaceId/planId are stored in the render doc itself (since propagation fix).
            // For legacy renders without these fields, extract them from the document path:
            // projects/{projectId}/workspaces/{workspaceId}/layouts/{planId}/renders/{renderId}
            let planId: string = data.planId ?? '';
            let projectId: string = data.projectId ?? '';
            let workspaceId: string = data.workspaceId ?? '';
            if (!planId || !projectId) {
              const segments = d.ref.path.split('/');
              // segments: ['projects', pid, 'workspaces', wid, 'layouts', planId, 'renders', renderId]
              if (segments.length >= 8) {
                projectId = projectId || segments[1];
                workspaceId = workspaceId || segments[3];
                planId = planId || segments[5];
              }
            }
            return {
              ...data,
              id: d.id,
              planId,
              planName: data.shotName || planId || d.id,
              projectId,
              workspaceId,
            } as RenderWithContext;
          })
          .filter((r) => r.planId && r.projectId); // skip renders where path parsing also failed

        results.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setRenders(results);
      } catch (e) {
        console.warn('[useDslRendersForOwner] query failed:', e);
        setRenders([]);
      } finally {
        if (!abortRef.current) setLoading(false);
      }
    })();

    return () => {
      abortRef.current = true;
    };
  }, [uid, enabled]);

  return { renders, loading };
}

export function useDslRendersForScope(
  plans: any[],
  enabled: boolean,
): { renders: RenderWithContext[]; loading: boolean } {
  const [renders, setRenders] = useState<RenderWithContext[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setRenders([]);
      return;
    }

    const valid = plans.filter((p) => p?.projectId && p?.workspaceId && p?.id);
    if (valid.length === 0) {
      setRenders([]);
      return;
    }

    abortRef.current = false;
    setLoading(true);

    (async () => {
      const results = await Promise.allSettled(
        valid.map(async (plan) => {
          const rs = await getRenders({
            projectId: plan.projectId,
            workspaceId: plan.workspaceId,
            planId: plan.id,
          });
          return rs.map((r) => ({
            ...r,
            planId: plan.id,
            planName: plan.name ?? 'Layout',
            projectId: plan.projectId,
            workspaceId: plan.workspaceId,
          })) as RenderWithContext[];
        }),
      );

      if (abortRef.current) return;

      const flat: RenderWithContext[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') flat.push(...r.value);
      }
      flat.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

      setRenders(flat);
      setLoading(false);
    })();

    return () => {
      abortRef.current = true;
    };
  }, [plans, enabled]);

  return { renders, loading };
}
