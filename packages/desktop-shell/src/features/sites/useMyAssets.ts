// サイトの素材ピッカー用：その「ユーザー自身」の素材だけを集める。
// 横断 Gallery（全ユーザー公開）は使わない。
// ソース: ① AI Drive のマイライブラリ（global assets, ownerId==自分）
//        ② 当プロジェクト配下の成果物（listProjectAssets）
// 仕様: ユーザー自身の素材 + SEKKEIYA テンプレ素材のみを使う。

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { resolveAssetPreviewUrl } from '../../store/useAIDriveStore';
import { listProjectAssets } from './projectAssetsApi';
import type { SiteAssetRef } from '../projects/types';

export function useMyAssets(projectId: string) {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const [items, setItems] = useState<SiteAssetRef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const out: SiteAssetRef[] = [];

      // ① 当プロジェクトの成果物（自分の素材）
      try {
        const projectAssets = await listProjectAssets(projectId);
        projectAssets.forEach(a => out.push(a.ref));
      } catch (e) {
        console.warn('[useMyAssets] project assets failed', e);
      }

      // ② AI Drive マイライブラリ（global assets, ownerId == 自分）
      if (uid) {
        try {
          const snap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid), limit(120)));
          snap.docs.forEach(d => {
            const x = d.data() as any;
            if (x.isDeleted) return;
            const thumb = resolveAssetPreviewUrl(x);
            if (!thumb) return;
            const isVideo = x.type === 'video' || /\.(mp4|webm|mov)$/i.test(x.name || '');
            out.push({
              id: `drive:${d.id}`,
              sourceApp: '3dss',
              assetId: d.id,
              kind: isVideo ? 'video' : 'image',
              title: x.name || x.title || undefined,
              thumbnailUrl: thumb,
            });
          });
        } catch (e) {
          console.warn('[useMyAssets] drive library failed', e);
        }
      }

      if (!active) return;
      // 重複排除
      const seen = new Set<string>();
      const deduped = out.filter(r => {
        const key = r.thumbnailUrl || r.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(deduped);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [projectId, uid]);

  return { items, loading };
}
