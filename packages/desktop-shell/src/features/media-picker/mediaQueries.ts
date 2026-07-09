// 汎用メディアピッカーのデータ層。3つのソースをそれぞれ取得し MediaPickerItem に正規化する。
// クエリの where 句は既存の Gallery / useMyAssets と同じものを使い、デプロイ済みインデックスを再利用する。

import {
  collection, collectionGroup, query, where, limit, getDocs, documentId,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { WorkFileRepository } from '../projects/workFileRepository';
import type { MediaKind, MediaPickerItem } from './types';
import { VIDEO_EXT_RE } from './types';

const pickUrl = (x: any): string | null =>
  x.storageUrl || x.downloadUrl || x.url || x.imageUrl || x.thumbnailUrl || x.previewUrl || x.src || null;

const pickThumb = (x: any): string | null =>
  x.thumbnailUrl || x.previewUrl || x.imageUrl || x.storageUrl || x.downloadUrl || x.url || x.src || null;

/** ドキュメントの種別が動画かを判定（type / mediaType / 拡張子）。 */
const detectKind = (x: any, url: string | null): MediaKind => {
  if (x.mediaType === 'video' || x.type === 'video') return 'video';
  if (url && VIDEO_EXT_RE.test(url)) return 'video';
  if (x.name && VIDEO_EXT_RE.test(x.name)) return 'video';
  return 'image';
};

/** 埋め込めないもの（3Dモデル/PDF等）を除外しつつ accept で絞る。 */
const acceptable = (kind: MediaKind, accept: MediaKind[]) => accept.includes(kind);

// ── ① AI Drive（自分のクラウド資産）: ルート assets コレクション ownerId==自分 ──
export async function fetchDriveMedia(uid: string, accept: MediaKind[]): Promise<MediaPickerItem[]> {
  const out: MediaPickerItem[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'assets'), where('ownerId', '==', uid), limit(150)));
    snap.docs.forEach((d) => {
      const x = d.data() as any;
      if (x.isDeleted) return;
      if (x.type === '3d-model') return; // 3Dモデルは本文に埋め込めない
      const url = pickUrl(x);
      if (!url) return;
      const kind = detectKind(x, url);
      if (!acceptable(kind, accept)) return;
      out.push({
        id: `drive:${d.id}`,
        url,
        thumbnailUrl: pickThumb(x) || url,
        kind,
        title: x.name || x.title || undefined,
        source: 'drive',
        authorId: uid,
      });
    });
  } catch (e) {
    console.warn('[mediaQueries] drive failed', e);
  }
  return out;
}

// ── ② 自分の成果物（プロジェクト配下）: workFiles + projects/{id}/assets ──
export async function fetchProjectMedia(projectId: string, accept: MediaKind[]): Promise<MediaPickerItem[]> {
  const out: MediaPickerItem[] = [];

  // 2-a) workFiles（S.Image の画像・動画）
  try {
    const files = await WorkFileRepository.getWorkFiles(projectId);
    for (const f of files) {
      const x = f as any;
      if (x.status === 'archived' || x.isArchived) continue;
      if ((x.appScope || '').toLowerCase() !== '3dsi') continue;
      if (x.type && x.type !== 'image-file') continue; // image-set（フォルダ）除外
      const url = pickUrl(x);
      if (!url) continue;
      const kind = detectKind(x, url);
      if (!acceptable(kind, accept)) continue;
      out.push({
        id: `project:wf:${x.id}`,
        url,
        thumbnailUrl: pickThumb(x) || url,
        kind,
        title: x.name || x.title || undefined,
        source: 'project',
      });
    }
  } catch (e) {
    console.warn('[mediaQueries] project workFiles failed', e);
  }

  // 2-b) projects/{id}/assets（AI Drive でこのプロジェクトに紐付けた素材）
  try {
    const snap = await getDocs(collection(db, 'projects', projectId, 'assets'));
    snap.docs.forEach((d) => {
      const x = d.data() as any;
      if (x.isDeleted) return;
      if (x.type === '3d-model') return;
      const url = pickUrl(x);
      if (!url) return;
      const kind = detectKind(x, url);
      if (!acceptable(kind, accept)) return;
      out.push({
        id: `project:asset:${d.id}`,
        url,
        thumbnailUrl: pickThumb(x) || url,
        kind,
        title: x.name || x.title || undefined,
        source: 'project',
      });
    });
  } catch (e) {
    console.warn('[mediaQueries] project assets failed', e);
  }

  return out;
}

// ── ③ 横断 Gallery（全ユーザー公開）: collectionGroup public ──
// 既存 Gallery と同じ where 句（appScope+visibility / visibility）でインデックス再利用。
export async function fetchGalleryMedia(accept: MediaKind[]): Promise<MediaPickerItem[]> {
  const out: MediaPickerItem[] = [];

  // 3-a) 公開 S.Image（画像・動画）
  try {
    const cg = collectionGroup(db, 'workFiles');
    const snap = await getDocs(query(cg, where('appScope', '==', '3dsi'), where('visibility', '==', 'public'), limit(80)));
    snap.docs.forEach((d) => {
      const x = d.data() as any;
      if (x.type !== 'image-file') return;
      if (x.status === 'archived' || x.isArchived) return;
      const url = pickUrl(x);
      if (!url) return;
      const kind = detectKind(x, url);
      if (!acceptable(kind, accept)) return;
      out.push({
        id: `gallery:wf:${d.id}`,
        url,
        thumbnailUrl: pickThumb(x) || url,
        kind,
        title: x.name || x.title || undefined,
        source: 'gallery',
        authorId: x.createdBy || x.ownerId,
      });
    });
  } catch (e) {
    console.warn('[mediaQueries] gallery images failed', e);
  }

  // 3-b) 公開 S.Layout レンダー（静止画として）
  if (accept.includes('image')) {
    try {
      const cg = collectionGroup(db, 'layouts');
      const snap = await getDocs(query(cg, where('visibility', '==', 'public'), limit(60)));
      snap.docs.forEach((d) => {
        const x = d.data() as any;
        if (!x.thumbnailUrl) return;
        out.push({
          id: `gallery:layout:${d.id}`,
          url: x.thumbnailUrl,
          thumbnailUrl: x.thumbnailUrl,
          kind: 'image',
          title: x.name || 'レイアウト',
          source: 'gallery',
          authorId: x.createdBy || x.ownerId,
        });
      });
    } catch (e) {
      console.warn('[mediaQueries] gallery layouts failed', e);
    }
  }

  return out;
}

/** 著者プロフィール（users/{uid}.displayName）を 30件チャンクでまとめて解決。 */
export async function resolveAuthorNames(ids: (string | undefined)[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const out: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    if (chunk.length === 0) break;
    try {
      const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
      snap.docs.forEach((d) => {
        const u = d.data() as any;
        if (u.displayName) out[d.id] = u.displayName;
      });
    } catch (e) {
      console.warn('[mediaQueries] author resolve failed', e);
    }
  }
  return out;
}
