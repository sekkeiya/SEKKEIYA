// ブログ運営戦略の保存/取得（AIと議論して決めた戦略を planBlogContent が使う）。
// account = users/{uid}/blogSettings/main.strategy / official = config/official.strategy。
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { BlogStrategy } from '../types';

export type BlogScope = 'account' | 'official';

const strategyRef = (scope: BlogScope, uid: string) =>
  scope === 'official' ? doc(db, 'config', 'official') : doc(db, 'users', uid, 'blogSettings', 'main');

export async function loadBlogStrategy(scope: BlogScope, uid: string): Promise<BlogStrategy | null> {
  try {
    const snap = await getDoc(strategyRef(scope, uid));
    const s = snap.exists() ? (snap.data() as any).strategy : null;
    return s && typeof s === 'object' && s.summary ? (s as BlogStrategy) : null;
  } catch { return null; }
}

export async function saveBlogStrategy(scope: BlogScope, uid: string, strategy: BlogStrategy): Promise<void> {
  await setDoc(strategyRef(scope, uid), { strategy }, { merge: true });
}
