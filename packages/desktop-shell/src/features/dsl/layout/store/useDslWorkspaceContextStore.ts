// src/features/dsl/layout/store/useDslWorkspaceContextStore.ts
// S.Layout エディタの「作業中コンテキスト」をワークスペース単位で保持する。
// panelSelections['layout'] はダッシュボードのカード選択と共用され、スコープ/タブ変更や
// プロジェクト切替で null クリアされてしまうため、作業状態（選択中の Base/Plan/Option）は
// この専用ストアに保存し、画面遷移をまたいで復元できるようにする。
import { create } from 'zustand';

export interface DslWorkContext {
  baseId: string | null;
  planId: string | null;
  optionId: string | null;
  baseName?: string | null;
  planName?: string | null;
  optionName?: string | null;
  /** Auto-trigger base setup when editor mounts: 'select_project' | 'select_workfile' | 'default_room' */
  pendingBaseSetup?: 'select_project' | 'select_workfile' | 'default_room' | null;
}

interface DslWorkspaceContextState {
  byWorkspace: Record<string, DslWorkContext>;
  /** Base ごとに「最後に開いていた Plan」を記憶する（baseId -> planId） */
  lastPlanByBase: Record<string, string | null>;
  setContext: (projectId: string, workspaceId: string, patch: Partial<DslWorkContext>) => void;
  setLastPlanForBase: (baseId: string, planId: string | null) => void;
  clearContext: (projectId: string, workspaceId: string) => void;
}

export const dslWorkspaceContextKey = (projectId: string, workspaceId: string) =>
  `${projectId}::${workspaceId}`;

const EMPTY: DslWorkContext = { baseId: null, planId: null, optionId: null };

/**
 * 指定 Base に対して開くべき Plan を解決する。
 * 1) 最後に開いていた Plan（存在する場合）
 * 2) Base 配下の先頭 Plan
 * 3) Plan が無ければ null（Base のみ表示）
 */
export function resolvePlanForBase(
  layouts: any[],
  baseId: string,
  lastPlanByBase: Record<string, string | null>
): string | null {
  const plans = (Array.isArray(layouts) ? layouts : []).filter(
    (d) => d?.planType === 'plan' && d?.rootBaseId === baseId
  );
  if (plans.length === 0) return null;
  const last = lastPlanByBase?.[baseId];
  if (last && plans.some((p) => p.id === last)) return last;
  return plans[0].id;
}

export const useDslWorkspaceContextStore = create<DslWorkspaceContextState>((set, get) => ({
  byWorkspace: {},
  lastPlanByBase: {},

  setContext: (projectId, workspaceId, patch) => {
    if (!projectId || !workspaceId) return;
    const key = dslWorkspaceContextKey(projectId, workspaceId);
    const prev = get().byWorkspace[key] || EMPTY;
    const next: DslWorkContext = { ...prev, ...patch };

    // 変化が無ければ更新しない（再レンダリングのループ防止）
    const same =
      prev.baseId === next.baseId &&
      prev.planId === next.planId &&
      prev.optionId === next.optionId &&
      prev.baseName === next.baseName &&
      prev.planName === next.planName &&
      prev.optionName === next.optionName &&
      (prev.pendingBaseSetup ?? null) === (next.pendingBaseSetup ?? null);
    if (same) return;

    set({ byWorkspace: { ...get().byWorkspace, [key]: next } });
  },

  setLastPlanForBase: (baseId, planId) => {
    if (!baseId) return;
    const prev = get().lastPlanByBase;
    if (prev[baseId] === planId) return;
    set({ lastPlanByBase: { ...prev, [baseId]: planId } });
  },

  clearContext: (projectId, workspaceId) => {
    const key = dslWorkspaceContextKey(projectId, workspaceId);
    const map = { ...get().byWorkspace };
    delete map[key];
    set({ byWorkspace: map });
  },
}));
