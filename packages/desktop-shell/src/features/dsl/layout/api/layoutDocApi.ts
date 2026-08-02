import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';

/**
 * Base / Plan の doc（`layouts/{id}`）そのものを更新する、型の付いた最小 API。
 *
 * 同等の処理は `utils/workspaceStubs.js` の `updateLayoutInfo` にもあるが、あちらは JS で
 * 型が付かず TS から import すると暗黙 any になる（layoutPatternsApi と同じ理由でここに置く）。
 */
const layoutDoc = (projectId: string, workspaceId: string, layoutId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', layoutId);

/** Base / Plan の表示名を変更する。空文字は無視（名前無しの行を作らない）。 */
export async function renameLayout(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  layoutId: string | null | undefined,
  name: string,
): Promise<void> {
  const trimmed = (name || '').trim();
  if (!projectId || !workspaceId || !layoutId || !trimmed) return;
  await updateDoc(layoutDoc(projectId, workspaceId, layoutId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
}
