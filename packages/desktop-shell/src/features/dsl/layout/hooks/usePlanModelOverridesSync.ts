import { useEffect, useRef } from 'react';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { usePlanModelOverridesStore } from '../store/planModelOverridesStore';
import type { OverrideChainEntry, PlanModelOverride } from '../utils/planModelOverrides';

const layoutDocRef = (projectId: string, workspaceId: string, layoutId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', layoutId);

const toEntry = (layoutId: string, data: Record<string, unknown> | undefined): OverrideChainEntry => ({
  layoutId,
  modelOverrides: ((data?.modelOverrides ?? {}) as Record<string, PlanModelOverride>),
});

/**
 * 現在開いているプランの modelOverrides チェーン（現在 → parentPlanId → rootBaseId）を購読して
 * usePlanModelOverridesStore に流す。LayoutShell に1箇所だけマウントする。
 *
 * 親/Base の doc id は現在 doc のスナップショットから得るため、購読は2段構え:
 * 現在 doc の購読が来るたびに、親側の購読を張り替える（id が変わらなければ張り替えない）。
 */
export function usePlanModelOverridesSync(
  projectId?: string | null,
  workspaceId?: string | null,
  layoutId?: string | null,
) {
  // 層ごとの最新値（current/parent/base）。どれかが更新されるたびにチェーンを組み直す。
  const entriesRef = useRef<{ current?: OverrideChainEntry; parent?: OverrideChainEntry; base?: OverrideChainEntry }>({});

  useEffect(() => {
    const store = usePlanModelOverridesStore.getState();
    if (!projectId || !workspaceId || !layoutId) {
      store.clear();
      return;
    }
    entriesRef.current = {};
    const publish = () => {
      const { current, parent, base } = entriesRef.current;
      // 同一 doc（layoutId が Base 自身のときなど）は重複させない
      const seen = new Set<string>();
      const chain = [current, parent, base]
        .filter((e): e is OverrideChainEntry => !!e)
        .filter((e) => (seen.has(e.layoutId) ? false : (seen.add(e.layoutId), true)));
      usePlanModelOverridesStore.getState().setChain(chain);
    };

    let unsubParent: Unsubscribe | null = null;
    let unsubBase: Unsubscribe | null = null;
    let parentId: string | null = null;
    let baseId: string | null = null;

    const unsubCurrent = onSnapshot(layoutDocRef(projectId, workspaceId, layoutId), (snap) => {
      const data = snap.data() as Record<string, unknown> | undefined;
      entriesRef.current.current = toEntry(layoutId, data);

      const nextParentId = (data?.parentPlanId as string) || null;
      const nextBaseId = (data?.rootBaseId as string) || null;

      if (nextParentId !== parentId) {
        parentId = nextParentId;
        unsubParent?.();
        unsubParent = null;
        entriesRef.current.parent = undefined;
        if (parentId && parentId !== layoutId) {
          unsubParent = onSnapshot(layoutDocRef(projectId, workspaceId, parentId), (s) => {
            entriesRef.current.parent = toEntry(s.id, s.data() as Record<string, unknown> | undefined);
            publish();
          });
        }
      }
      if (nextBaseId !== baseId) {
        baseId = nextBaseId;
        unsubBase?.();
        unsubBase = null;
        entriesRef.current.base = undefined;
        if (baseId && baseId !== layoutId && baseId !== parentId) {
          unsubBase = onSnapshot(layoutDocRef(projectId, workspaceId, baseId), (s) => {
            entriesRef.current.base = toEntry(s.id, s.data() as Record<string, unknown> | undefined);
            publish();
          });
        }
      }
      publish();
    });

    return () => {
      unsubCurrent();
      unsubParent?.();
      unsubBase?.();
      usePlanModelOverridesStore.getState().clear();
    };
  }, [projectId, workspaceId, layoutId]);
}
