import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { createProject } from '../../projects/api/createProject';
import { TEMPLATE_WORKSPACE_NAME } from '../../../store/useAppStore';

export { TEMPLATE_WORKSPACE_NAME };

/**
 * テンプレ下書き用の「隠し」個人ワークスペースを取得（無ければ作成）し id を返す。
 * このプロジェクトは useAppStore.setProjects で一覧から除外されるため、
 * サイドバー等には表示されない。解決は Firestore 直参照で行い store には載せない。
 */
export async function getOrCreateTemplateWorkspace(uid: string, ownerName: string): Promise<string> {
  const KEY = `dsp_template_ws_${uid}`;

  // 1) localStorage にキャッシュした id が今も存在すれば使う
  try {
    const cached = localStorage.getItem(KEY);
    if (cached) {
      const snap = await getDoc(doc(db, 'projects', cached));
      if (snap.exists()) return cached;
    }
  } catch { /* ignore */ }

  // 2) 自分が owner の同名プロジェクトを探す
  try {
    const qs = await getDocs(query(
      collection(db, 'projects'),
      where('ownerId', '==', uid),
      where('name', '==', TEMPLATE_WORKSPACE_NAME),
      limit(1),
    ));
    if (!qs.empty) {
      const id = qs.docs[0].id;
      try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
      return id;
    }
  } catch { /* ignore, fall through to create */ }

  // 3) 無ければ作成
  const proj = await createProject({ userId: uid, ownerName, projectName: TEMPLATE_WORKSPACE_NAME, isTeam: false });
  try { localStorage.setItem(KEY, proj.id); } catch { /* ignore */ }
  return proj.id;
}
