/**
 * S.Image 生成チャットのセッション永続化（Firestore users/{uid}/imageSessions/{id}）。
 * プロジェクトごとの生成/編集チャット（系統＋生成画像URL）をクラウド同期し、
 * 右パネル「プロジェクト」タブで選び直して続きから生成できるようにする。
 * 画像は Storage URL のみ保存（base64 は保存しない）ためドキュメントは軽量。
 */
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useDsiEditorStore, type DsiBranch } from './store/useDsiEditorStore';

export interface DsiSessionRow {
  id: string;
  projectId?: string | null;
  title?: string;
  provider?: string;
  mode?: string;
  originImageUrl?: string | null;
  originTitle?: string;
  branches?: DsiBranch[];
  createdAtMs?: number;
  updatedAtMs?: number;
}

/** 未完了(running)のアシスタントメッセージは保存しない（再読込で回り続けないように）。jobId も落とす。 */
function sanitizeBranches(branches: DsiBranch[]): DsiBranch[] {
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    currentImageUrl: b.currentImageUrl ?? null,
    messages: b.messages
      .filter((m) => !(m.role === 'assistant' && m.status === 'running'))
      .map((m) => ({
        id: m.id,
        role: m.role,
        ...(m.text !== undefined ? { text: m.text } : {}),
        ...(m.imageUrl ? { imageUrl: m.imageUrl } : {}),
        ...(m.status ? { status: m.status } : {}),
        ...(m.error ? { error: m.error } : {}),
        jobId: null,
      })),
  }));
}

function deriveTitle(): string {
  const st = useDsiEditorStore.getState();
  for (const b of st.branches) {
    const firstUser = b.messages.find((m) => m.role === 'user' && m.text);
    if (firstUser?.text) return firstUser.text.slice(0, 40);
  }
  return st.originTitle || '無題のチャット';
}

/** 現在のエディタセッションを Firestore に保存。
 *  自動保存では空チャットをスキップし、新規作成時のみ allowEmpty で即保存して
 *  左ツリーにすぐ表示する（「＋新規チャット」を押したのに何も出ない混乱を防ぐ）。 */
export async function saveCurrentSession(uid: string, opts?: { allowEmpty?: boolean }): Promise<void> {
  const st = useDsiEditorStore.getState();
  if (!uid || !st.sessionId) return;
  const hasContent = st.branches.some((b) => b.messages.length > 0);
  if (!hasContent && !opts?.allowEmpty) return; // 自動保存では空チャットを保存しない
  const ref = doc(db, 'users', uid, 'imageSessions', st.sessionId);
  await setDoc(
    ref,
    {
      projectId: st.targetProjectId || null,
      title: deriveTitle(),
      provider: st.provider,
      mode: st.mode,
      originImageUrl: st.originImageUrl || null,
      originTitle: st.originTitle || '',
      branches: sanitizeBranches(st.branches),
      createdAtMs: st.sessionCreatedAt || Date.now(),
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    },
    { merge: true },
  );
}

export async function deleteSession(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'imageSessions', id));
}

/** users/{uid}/imageSessions を購読（更新日時降順）。返り値で購読解除。 */
export function subscribeSessions(uid: string, cb: (rows: DsiSessionRow[]) => void): () => void {
  const q = query(collection(db, 'users', uid, 'imageSessions'), orderBy('updatedAtMs', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))),
    (e) => { console.warn('[dsiSessions] subscribe error', e); cb([]); },
  );
}
