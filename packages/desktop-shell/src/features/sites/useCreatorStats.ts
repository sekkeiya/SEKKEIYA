// アカウントサイト（マイページ）用に、ログインユーザーのプロフィール統計を集約する。
// データ源（既存 CreatorProfilePage と同一）:
//   - users/{uid}                : title / bio
//   - assets where ownerId==uid  : 投稿モデル
//   - 得意ジャンル               : モデルの category + tags を集計（上位6）
//   - users/{uid}/followers,following : 件数

import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { resolveAssetPreviewUrl } from '../../store/useAIDriveStore';
import type { ChartDatum } from '../projects/types';

export interface CreatorModel { id: string; name: string; thumb: string | null; }
export interface CreatorStats {
  title?: string;
  bio?: string;
  models: CreatorModel[];
  genres: ChartDatum[];      // 得意ジャンル（label, value=count）
  followers: number;
  following: number;
  loading: boolean;
}

function aggregateGenres(models: { category?: string; tags?: string[] }[]): ChartDatum[] {
  const counts: Record<string, number> = {};
  for (const a of models) {
    const sources: string[] = [];
    if (a.category) sources.push(a.category);
    if (Array.isArray(a.tags)) sources.push(...a.tags);
    for (const s of sources) { const k = (s || '').trim(); if (k) counts[k] = (counts[k] || 0) + 1; }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
}

export function useCreatorStats(): CreatorStats {
  const uid = useAuthStore(s => s.currentUser?.uid);
  const [stats, setStats] = useState<CreatorStats>({ models: [], genres: [], followers: 0, following: 0, loading: true });

  useEffect(() => {
    if (!uid) { setStats({ models: [], genres: [], followers: 0, following: 0, loading: false }); return; }
    let active = true;
    (async () => {
      let title: string | undefined; let bio: string | undefined;
      let models: CreatorModel[] = []; let raw: { category?: string; tags?: string[] }[] = [];
      let followers = 0; let following = 0;
      try { const p = await getDoc(doc(db, 'users', uid)); if (p.exists()) { const d = p.data() as any; title = d.title; bio = d.bio; } } catch { /* noop */ }
      try {
        const snap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid), limit(24)));
        raw = snap.docs.map(d => d.data() as any);
        models = snap.docs.map(d => { const x = d.data() as any; return { id: d.id, name: x.name || x.title || 'Untitled', thumb: resolveAssetPreviewUrl(x) }; });
      } catch (e) { console.warn('[creatorStats] assets failed', e); }
      try { followers = (await getDocs(collection(db, 'users', uid, 'followers'))).size; } catch { /* noop */ }
      try { following = (await getDocs(collection(db, 'users', uid, 'following'))).size; } catch { /* noop */ }
      if (!active) return;
      setStats({ title, bio, models, genres: aggregateGenres(raw), followers, following, loading: false });
    })();
    return () => { active = false; };
  }, [uid]);

  return stats;
}
