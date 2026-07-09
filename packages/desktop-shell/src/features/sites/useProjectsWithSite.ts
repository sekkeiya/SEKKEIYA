// 「プロジェクトサイトが作成済み」のプロジェクトだけを返す。
// アカウントサイトの Works / プロジェクトページは、サイトが作られたプロジェクトにのみ追従する。

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAppStore } from '../../store/useAppStore';
import type { AccountProjectLite } from './accountSite';

export function useProjectsWithSite(): { items: AccountProjectLite[]; loading: boolean } {
  const projects = useAppStore(s => s.projects);
  const [items, setItems] = useState<AccountProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const key = projects.map(p => p.id).join(',');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const checks = await Promise.all(projects.map(async p => {
        try {
          const snap = await getDoc(doc(db, 'projects', p.id, 'site', 'main'));
          return snap.exists() ? p : null;
        } catch { return null; }
      }));
      if (!active) return;
      const lite: AccountProjectLite[] = checks
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map(p => ({ id: p.id, name: p.name, cover: p.coverThumbnailUrl, isTeam: p.isTeam }));
      setItems(lite);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [key]);

  return { items, loading };
}
