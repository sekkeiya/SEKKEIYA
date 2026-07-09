// 公開サイト（publishedSites）を認証なしで取得する。
// docId: account = `u__{username}` / project = `p__{username}__{projectId}`。
// project は projectId を知らないため username + projectSlug で query する。

import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/shared/config/firebase';

/** アカウントサイトを username で取得（無ければ null）。 */
export async function getPublishedAccount(username) {
  const u = (username || '').trim().toLowerCase();
  if (!u) return null;
  const snap = await getDoc(doc(db, 'publishedSites', `u__${u}`));
  return snap.exists() ? snap.data() : null;
}

/** プロジェクトサイトを username + projectSlug で取得（無ければ null）。 */
export async function getPublishedProject(username, projectSlug) {
  const u = (username || '').trim().toLowerCase();
  const slug = (projectSlug || '').trim().toLowerCase();
  if (!u || !slug) return null;
  const snap = await getDocs(query(
    collection(db, 'publishedSites'),
    where('kind', '==', 'project'),
    where('username', '==', u),
    where('projectSlug', '==', slug),
    limit(1),
  ));
  return snap.empty ? null : snap.docs[0].data();
}
