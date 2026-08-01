import { doc, updateDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import type { PlanModelOverride } from '../utils/planModelOverrides';

/**
 * layouts/{planId}.modelOverrides[modelId] を設定/解除する。
 * override=null で解除（デフォルトに戻す）。書き込み先は「いま開いているプランの doc」
 * （呼び出し側が dslPlanContext.planId を渡す。仕様 §6）。
 */
export async function setPlanModelOverride(
  projectId: string,
  workspaceId: string,
  planId: string,
  modelId: string,
  override: PlanModelOverride | null,
): Promise<void> {
  const ref = doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId);
  await updateDoc(ref, {
    [`modelOverrides.${modelId}`]: override ?? deleteField(),
    updatedAt: serverTimestamp(),
  });
}
