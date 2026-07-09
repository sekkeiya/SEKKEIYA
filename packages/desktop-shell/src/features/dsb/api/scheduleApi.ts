// S.Blog 投稿スケジュール — Firestore CRUD（正本: users/{uid}/blogSchedules/{id}）。
// 記事本体（blogArticles）とは別の「コンテンツカレンダー」。投稿戦略の計画に使う。
import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { BlogSchedule } from '../types';

const schedulesCol = (uid: string) => collection(db, 'users', uid, 'blogSchedules');

/** 投稿スケジュール一覧（予定日の昇順）。 */
export async function listBlogSchedules(uid: string): Promise<BlogSchedule[]> {
  const q = query(schedulesCol(uid), orderBy('date', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BlogSchedule, 'id'>) }));
}

/** スケジュールの作成/更新（merge 保存）。 */
export async function saveBlogSchedule(uid: string, schedule: BlogSchedule): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'blogSchedules', schedule.id), { ...schedule }, { merge: true });
}

/** スケジュールの削除。 */
export async function deleteBlogSchedule(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'blogSchedules', id));
}
