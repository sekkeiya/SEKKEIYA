// 自動化作業リストの「ワークフロー設定」を永続化するストア（docs/19 / docs/20）。
// capability.id ごとにユーザーが編集した WorkflowDef を保存する。
// 保存が無い capability は buildDefaultWorkflow の既定で描画する（この store は差分だけ持つ）。
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkflowDef } from '../features/ai-studio/Automation/workflowTypes';

interface WorkflowConfigState {
  /** capabilityId → 保存済みワークフロー（未保存 capability は含まれない）。 */
  saved: Record<string, WorkflowDef>;
  /** 編集内容を保存/上書きする。 */
  save: (def: WorkflowDef) => void;
  /** 既定に戻す（保存を削除）。 */
  reset: (capabilityId: string) => void;
}

export const useWorkflowConfigStore = create<WorkflowConfigState>()(
  persist(
    (set) => ({
      saved: {},
      save: (def) =>
        set((s) => ({ saved: { ...s.saved, [def.capabilityId]: def } })),
      reset: (capabilityId) =>
        set((s) => {
          const next = { ...s.saved };
          delete next[capabilityId];
          return { saved: next };
        }),
    }),
    { name: 'sekkeiya-workflow-config' },
  ),
);
