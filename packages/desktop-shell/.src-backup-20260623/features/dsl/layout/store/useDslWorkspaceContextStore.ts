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
}

interface DslWorkspaceContextState {
  byWorkspace: Record<string, DslWorkContext>;
  setContext: (projectId: string, workspaceId: string, patch: Partial<DslWorkContext>) => void;
  clearContext: (projectId: string, workspaceId: string) => void;
}

export const dslWorkspaceContextKey = (projectId: string, workspaceId: string) =>
  `${projectId}::${workspaceId}`;

const EMPTY: DslWorkContext = { baseId: null, planId: null, optionId: null };

export const useDslWorkspaceContextStore = create<DslWorkspaceContextState>((set, get) => ({
  byWorkspace: {},

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
      prev.optionName === next.optionName;
    if (same) return;

    set({ byWorkspace: { ...get().byWorkspace, [key]: next } });
  },

  clearContext: (projectId, workspaceId) => {
    const key = dslWorkspaceContextKey(projectId, workspaceId);
    const map = { ...get().byWorkspace };
    delete map[key];
    set({ byWorkspace: map });
  },
}));
