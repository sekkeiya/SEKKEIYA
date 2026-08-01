import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { subscribePatterns } from '../api/layoutPatternsApi';
import { useLayoutPatternStore } from '../store/useLayoutPatternStore';

/**
 * 現在のプランの patterns サブコレクションと、プラン doc の activePatternId を購読する。
 * LayoutShell に1箇所だけマウントする。
 */
export function useLayoutPatternsSync(
  projectId?: string | null,
  workspaceId?: string | null,
  planId?: string | null,
) {
  useEffect(() => {
    if (!projectId || !workspaceId || !planId) {
      useLayoutPatternStore.getState().clear();
      return;
    }
    const unsubPatterns = subscribePatterns(projectId, workspaceId, planId, (list) => {
      useLayoutPatternStore.getState().setPatterns(list);
    });
    const unsubPlan = onSnapshot(
      doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId),
      (snap) => {
        const v = (snap.data() as { activePatternId?: string | null } | undefined)?.activePatternId;
        useLayoutPatternStore.getState().setActiveId(v ?? null);
      },
      (err) => console.warn('[useLayoutPatternsSync] plan doc error:', err),
    );
    return () => {
      unsubPatterns();
      unsubPlan();
      useLayoutPatternStore.getState().clear();
    };
  }, [projectId, workspaceId, planId]);
}
