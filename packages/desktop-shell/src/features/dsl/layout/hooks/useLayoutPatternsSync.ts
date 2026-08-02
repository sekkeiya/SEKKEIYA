import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { subscribePatterns } from '../api/layoutPatternsApi';
import { useLayoutPatternStore } from '../store/useLayoutPatternStore';

/**
 * 現在の Base の patterns サブコレクション（提案一覧）と、Base doc の activePatternId を購読する。
 * LayoutShell に1箇所だけマウントする。
 */
export function useLayoutPatternsSync(
  projectId?: string | null,
  workspaceId?: string | null,
  baseId?: string | null,
) {
  useEffect(() => {
    if (!projectId || !workspaceId || !baseId) {
      useLayoutPatternStore.getState().clear();
      return;
    }
    const unsubPatterns = subscribePatterns(projectId, workspaceId, baseId, (list) => {
      useLayoutPatternStore.getState().setPatterns(list);
    });
    const unsubBase = onSnapshot(
      doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', baseId),
      (snap) => {
        const v = (snap.data() as { activePatternId?: string | null } | undefined)?.activePatternId;
        useLayoutPatternStore.getState().setActiveId(v ?? null);
      },
      (err) => console.warn('[useLayoutPatternsSync] base doc error:', err),
    );
    return () => {
      unsubPatterns();
      unsubBase();
      useLayoutPatternStore.getState().clear();
    };
  }, [projectId, workspaceId, baseId]);
}
