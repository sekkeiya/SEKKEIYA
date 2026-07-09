// MaterialBinding 永続化 API（Phase C 基盤）
//
// 「どのモデル / 配置インスタンスの・どのスロットに・どの素材を当てたか」を
// projects/{projectId}/materialBindings/{id} に保存する。S.Models 詳細（Phase D）と
// S.Layout Properties（Phase E）の双方がこの API を通じて読み書きする。
//
// ドキュメント ID は決定的:
//   - モデル既定バインディング:        model_{modelId}
//   - 配置インスタンス上書きバインディング: obj_{layoutObjectId}
// これにより upsert が冪等になり、ルックアップも getDoc 一発で済む。

import { doc, setDoc, getDoc, deleteDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import type { MaterialBinding } from '../../dsmt/types';

const sanitize = (s: string) => (s || '').replace(/[^a-zA-Z0-9_-]/g, '_');

export const bindingIdForModel = (modelId: string) => `model_${sanitize(modelId)}`;
export const bindingIdForLayoutObject = (layoutObjectId: string) => `obj_${sanitize(layoutObjectId)}`;

const colPath = (projectId: string) => `projects/${projectId}/materialBindings`;

/** バインディングを upsert（保存・更新）。 */
export async function saveMaterialBinding(projectId: string, binding: MaterialBinding): Promise<string> {
  const id = binding.id
    || (binding.targetType === 'layoutObject' && binding.layoutObjectId
      ? bindingIdForLayoutObject(binding.layoutObjectId)
      : bindingIdForModel(binding.modelId));
  const updatedBy = useAuthStore.getState().currentUser?.uid ?? null;
  await setDoc(doc(db, colPath(projectId), id), {
    ...binding,
    id,
    updatedBy,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return id;
}

export async function deleteMaterialBinding(projectId: string, bindingId: string): Promise<void> {
  await deleteDoc(doc(db, colPath(projectId), bindingId));
}

/** モデル既定バインディングを 1 件取得（無ければ null）。 */
export async function getModelBinding(projectId: string, modelId: string): Promise<MaterialBinding | null> {
  const snap = await getDoc(doc(db, colPath(projectId), bindingIdForModel(modelId)));
  return snap.exists() ? (snap.data() as MaterialBinding) : null;
}

/** 配置インスタンス上書きバインディングを 1 件取得（無ければ null）。 */
export async function getLayoutObjectBinding(projectId: string, layoutObjectId: string): Promise<MaterialBinding | null> {
  const snap = await getDoc(doc(db, colPath(projectId), bindingIdForLayoutObject(layoutObjectId)));
  return snap.exists() ? (snap.data() as MaterialBinding) : null;
}

/**
 * 適用時の解決順: 配置インスタンス上書き > モデル既定。
 * layoutObjectId が無ければモデル既定のみを見る。
 */
export async function resolveBinding(
  projectId: string,
  modelId: string,
  layoutObjectId?: string | null,
): Promise<MaterialBinding | null> {
  if (layoutObjectId) {
    const objBinding = await getLayoutObjectBinding(projectId, layoutObjectId);
    if (objBinding) return objBinding;
  }
  return getModelBinding(projectId, modelId);
}

/** モデル既定バインディングをライブ購読。 */
export function subscribeModelBinding(
  projectId: string,
  modelId: string,
  cb: (binding: MaterialBinding | null) => void,
): () => void {
  return onSnapshot(
    doc(db, colPath(projectId), bindingIdForModel(modelId)),
    (snap) => cb(snap.exists() ? (snap.data() as MaterialBinding) : null),
    (err) => { console.error('[materialBindingApi] subscribeModelBinding error', err); cb(null); },
  );
}

/** プロジェクト内の全バインディングを取得（管理 / デバッグ用）。 */
export async function listProjectBindings(projectId: string): Promise<MaterialBinding[]> {
  const snap = await getDocs(query(collection(db, colPath(projectId)), where('targetType', 'in', ['model', 'layoutObject'])));
  return snap.docs.map((d) => d.data() as MaterialBinding);
}
