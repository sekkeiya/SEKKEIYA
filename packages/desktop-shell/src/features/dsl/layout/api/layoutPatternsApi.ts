import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { stripUndefinedDeep, type LayoutPattern, type PatternSnapshot } from '../utils/layoutPatterns';

// 参照はこのファイル内で組み立てる（surfaceFinishApi / layoutStateApi と同じ流儀）。
// paths/workspacePaths.js は JS のままで型が付かず、import すると暗黙 any の型エラーになるため。
const patternsCol = (projectId: string, workspaceId: string, planId: string) =>
  collection(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId, 'patterns');

const patternDoc = (projectId: string, workspaceId: string, planId: string, patternId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId, 'patterns', patternId);

const planDoc = (projectId: string, workspaceId: string, planId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId);

/** patterns サブコレクションを購読する。解除関数を返す（購読できない引数なら no-op）。 */
export function subscribePatterns(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  planId: string | null | undefined,
  cb: (list: LayoutPattern[]) => void,
): () => void {
  if (!projectId || !workspaceId || !planId) { cb([]); return () => {}; }
  return onSnapshot(query(patternsCol(projectId, workspaceId, planId)), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as LayoutPattern[];
    // order 未設定は末尾。同値でも並びが揺れないよう id で決定的に並べる。
    list.sort((a, b) => {
      const oa = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
      const ob = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.id.localeCompare(b.id);
    });
    cb(list);
  }, (err) => {
    console.warn('[layoutPatternsApi] subscribe error:', err);
    cb([]);
  });
}

export async function createPattern(
  projectId: string, workspaceId: string, planId: string, name: string,
  snap: PatternSnapshot & { order?: number },
): Promise<string> {
  if (!projectId || !workspaceId || !planId) throw new Error('パターンの保存先を特定できません');
  const ref = await addDoc(patternsCol(projectId, workspaceId, planId), {
    ...stripUndefinedDeep(snap),
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePattern(
  projectId: string, workspaceId: string, planId: string, patternId: string,
  patch: Partial<LayoutPattern>,
): Promise<void> {
  if (!projectId || !workspaceId || !planId || !patternId) return;
  await updateDoc(patternDoc(projectId, workspaceId, planId, patternId), {
    ...stripUndefinedDeep(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePattern(
  projectId: string, workspaceId: string, planId: string, patternId: string,
): Promise<void> {
  if (!projectId || !workspaceId || !planId || !patternId) return;
  await deleteDoc(patternDoc(projectId, workspaceId, planId, patternId));
}

/** 選択中パターンはプラン doc に持つ（null = デフォルト＝プラン素のまま）。 */
export async function setActivePatternId(
  projectId: string, workspaceId: string, planId: string, patternId: string | null,
): Promise<void> {
  if (!projectId || !workspaceId || !planId) return;
  await updateDoc(planDoc(projectId, workspaceId, planId), {
    activePatternId: patternId,
    updatedAt: serverTimestamp(),
  });
}
