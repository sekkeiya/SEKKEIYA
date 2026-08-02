import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { stripUndefinedDeep, type LayoutPattern, type PatternSnapshot } from '../utils/layoutPatterns';

// 参照はこのファイル内で組み立てる（surfaceFinishApi / layoutStateApi と同じ流儀）。
// paths/workspacePaths.js は JS のままで型が付かず、import すると暗黙 any の型エラーになるため。
// 提案（旧 Option）は Base 直下に持つ。photo: docs/superpowers/specs/2026-08-01-proposal-model-design.md §2
const patternsCol = (projectId: string, workspaceId: string, baseId: string) =>
  collection(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', baseId, 'patterns');

const patternDoc = (projectId: string, workspaceId: string, baseId: string, patternId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', baseId, 'patterns', patternId);

const baseDoc = (projectId: string, workspaceId: string, baseId: string) =>
  doc(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', baseId);

/** patterns サブコレクションを購読する。解除関数を返す（購読できない引数なら no-op）。 */
export function subscribePatterns(
  projectId: string | null | undefined,
  workspaceId: string | null | undefined,
  baseId: string | null | undefined,
  cb: (list: LayoutPattern[]) => void,
): () => void {
  if (!projectId || !workspaceId || !baseId) { cb([]); return () => {}; }
  return onSnapshot(query(patternsCol(projectId, workspaceId, baseId)), (snap) => {
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
  projectId: string, workspaceId: string, baseId: string, name: string,
  snap: PatternSnapshot & { order?: number },
): Promise<string> {
  if (!projectId || !workspaceId || !baseId) throw new Error('パターンの保存先を特定できません');
  const ref = await addDoc(patternsCol(projectId, workspaceId, baseId), {
    ...stripUndefinedDeep(snap),
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePattern(
  projectId: string, workspaceId: string, baseId: string, patternId: string,
  patch: Partial<LayoutPattern>,
): Promise<void> {
  if (!projectId || !workspaceId || !baseId || !patternId) return;
  await updateDoc(patternDoc(projectId, workspaceId, baseId, patternId), {
    ...stripUndefinedDeep(patch),
    updatedAt: serverTimestamp(),
  });
}

export async function deletePattern(
  projectId: string, workspaceId: string, baseId: string, patternId: string,
): Promise<void> {
  if (!projectId || !workspaceId || !baseId || !patternId) return;
  await deleteDoc(patternDoc(projectId, workspaceId, baseId, patternId));
}

/** 選択中パターンは Base doc に持つ（null = デフォルト＝Base 素のまま）。 */
export async function setActivePatternId(
  projectId: string, workspaceId: string, baseId: string, patternId: string | null,
): Promise<void> {
  if (!projectId || !workspaceId || !baseId) return;
  await updateDoc(baseDoc(projectId, workspaceId, baseId), {
    activePatternId: patternId,
    updatedAt: serverTimestamp(),
  });
}

// 旧配置（layouts/{planId}/patterns）からの lazy 移行。Base を開いたときに 1 回だけ走る。
// 元 doc は消さず migratedTo を記録する（非破壊・migrateLegacyBaseToPlanOption と同じ流儀）。
const migratedBases = new Set<string>();
// 進行中の移行トラッキング: Firestore スナップショット再発火による並行実行を防止し、二重コピーを防ぐ。
const migratingBases = new Set<string>();

export async function migratePlanPatternsToBase(
  projectId: string, workspaceId: string, baseId: string, planIds: string[],
): Promise<number> {
  const key = `${projectId}/${workspaceId}/${baseId}`;
  if (migratedBases.has(key) || migratingBases.has(key)) return 0;
  let moved = 0;
  migratingBases.add(key);
  try {
    for (const planId of planIds) {
      const snap = await getDocs(
        collection(db, 'projects', projectId, 'workspaces', workspaceId, 'layouts', planId, 'patterns'),
      );
      for (const d of snap.docs) {
        const data = d.data() as Record<string, unknown>;
        if (data.migratedTo) continue;
        const ref = await addDoc(patternsCol(projectId, workspaceId, baseId), {
          ...data,
          planId,
          updatedAt: serverTimestamp(),
        });
        await updateDoc(d.ref, { migratedTo: ref.id });
        moved += 1;
      }
    }
    // 全件成功した場合のみ「移行済み」とマークする。途中で例外が出たら add せず、
    // 次に Base を開いたときに再試行できるようにする（fail-open）。
    migratedBases.add(key);
  } catch (err) {
    migratedBases.delete(key);
    throw err;
  } finally {
    migratingBases.delete(key);
  }
  if (moved) console.log(`[layoutPatternsApi] 旧 Option ${moved} 件を Base 直下の提案へ移行しました`);
  return moved;
}
