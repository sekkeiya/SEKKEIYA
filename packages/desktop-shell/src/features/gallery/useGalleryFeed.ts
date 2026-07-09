import { useEffect, useState } from 'react';
import {
  collection, collectionGroup, query, where, or, and, limit, getDocs, documentId,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { GALLERY_KINDS, type GalleryItem, type GalleryKind, type GalleryScope, type GalleryRef } from './galleryTypes';

// Firestore Timestamp / ISO 文字列 / number を epoch ms へ吸収
function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return isNaN(t) ? 0 : t; }
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return 0;
}

function normalize(kind: GalleryKind, docId: string, x: any, ref: GalleryRef, authorId: string | undefined): GalleryItem {
  const created = toMs(x.createdAt);
  const updated = toMs(x.updatedAt) || created;
  return {
    id: `${kind}:${docId}`,
    kind,
    title: x.name || x.title || 'Untitled',
    thumbnailUrl: x.thumbnailUrl || x.thumbnail || null,
    // Resolve the actual GLB file URL using the same priority order as
    // SetFurnitureCanvas.getGlbRaw(), extended with downloads.glb and
    // files.glb sub-object patterns.
    modelUrl: kind === 'model'
      ? (() => {
          // Direct URL candidates (priority order matching DSS viewer)
          const direct: unknown[] = [
            x.glbUrl,
            x.modelGlbUrl,
            x.viewerGlbUrl,
            x.files?.glb?.url,
            x.files?.glb?.downloadUrl,
            x.files?.glb?.downloadURL,
            x.downloads?.glb,
            // Broader fallbacks — only accept if URL clearly ends in .glb/.gltf
            x.downloadUrl,
            x.fileUrl,
            x.storageUrl,
            x.modelUrl,
            x.url,
          ];
          // Must be an HTTPS URL pointing to a GLB/GLTF file
          const isGlbUrl = (u: unknown): u is string =>
            typeof u === 'string' &&
            u.startsWith('https://') &&
            /\.(glb|gltf)(\?|$)/i.test(u);

          // 1. Try dedicated GLB fields first (no extension check needed)
          const dedicated = [
            x.glbUrl, x.modelGlbUrl, x.viewerGlbUrl,
            x.files?.glb?.url, x.files?.glb?.downloadUrl, x.files?.glb?.downloadURL,
            x.downloads?.glb,
          ].find((u): u is string => typeof u === 'string' && u.startsWith('http'));

          if (dedicated) return dedicated;

          // 2. Fall back to broader fields but require .glb/.gltf extension
          return direct.find(isGlbUrl) ?? null;
        })()
      : null,
    author: { id: authorId || 'unknown' },
    createdAtMs: created,
    updatedAtMs: updated,
    tags: Array.isArray(x.tags) ? x.tags : [],
    ref,
  };
}

// followingIds === null → 全公開 / [] → フォロー0人（空） / [...] → フォロー中
type Following = string[] | null;

// S.Models: ルート assets コレクション
// DssRightPanel と同じシンプルな複合クエリ（type + visibility）を使用
async function fetchModels(following: Following): Promise<GalleryItem[]> {
  const col = collection(db, 'assets');
  let q;
  if (following) {
    if (following.length === 0) return [];
    q = query(col,
      where('type', '==', '3d-model'),
      where('visibility', '==', 'public'),
      where('ownerId', 'in', following.slice(0, 30)),
      limit(60));
  } else {
    q = query(col,
      where('type', '==', '3d-model'),
      where('visibility', '==', 'public'),
      limit(60));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const x = d.data() as any;
    return normalize('model', d.id, x, { kind: 'model', assetId: d.id }, x.ownerId || x.authorId);
  });
}

// S.Layout: collectionGroup('layouts')（projects/{pid}/workspaces/{wsid}/layouts/{id}）
async function fetchLayouts(following: Following): Promise<GalleryItem[]> {
  const cg = collectionGroup(db, 'layouts');
  let q;
  if (following) {
    if (following.length === 0) return [];
    q = query(cg, where('visibility', '==', 'public'), where('ownerId', 'in', following.slice(0, 30)), limit(60));
  } else {
    q = query(cg, where('visibility', '==', 'public'), limit(60));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const x = d.data() as any;
    const segs = d.ref.path.split('/');
    const projectId = x.projectId || segs[1];
    const workspaceId = x.workspaceId || segs[3];
    return normalize('layout', d.id, x, { kind: 'layout', projectId, workspaceId, layoutId: d.id }, x.createdBy || x.ownerId);
  });
}

// S.Presentations / S.Create / S.Diagram: collectionGroup('workFiles') を appScope で判別
async function fetchWorkFiles(
  kind: 'presentation' | 'furniture' | 'diagram' | 'image' | 'portfolio',
  appScope: string,
  following: Following,
): Promise<GalleryItem[]> {
  const cg = collectionGroup(db, 'workFiles');
  let q;
  if (following) {
    if (following.length === 0) return [];
    q = query(cg, where('appScope', '==', appScope), where('visibility', '==', 'public'), where('createdBy', 'in', following.slice(0, 30)), limit(80));
  } else {
    q = query(cg, where('appScope', '==', appScope), where('visibility', '==', 'public'), limit(80));
  }
  const snap = await getDocs(q);
  let rows = snap.docs
    .map(d => ({ d, x: d.data() as any, projectId: d.ref.parent.parent?.id }))
    .filter(({ x }) => x.status !== 'archived' && x.isArchived !== true);
  // S.Diagram は type フィルターをクライアント側で実施（既存 composite index に合わせる）
  if (kind === 'diagram') rows = rows.filter(({ x }) => x.type === 'diagram-state');
  // S.Image は image-file のみ（セット image-set を除外）
  if (kind === 'image') rows = rows.filter(({ x }) => x.type === 'image-file');
  // S.Portfolio は portfolio のみ
  if (kind === 'portfolio') rows = rows.filter(({ x }) => x.type === 'portfolio');
  return rows.map(({ d, x, projectId }) =>
    normalize(kind, d.id, x, { kind, projectId, workFileId: d.id, appScope }, x.createdBy));
}

function fetchByKind(kind: GalleryKind, following: Following): Promise<GalleryItem[]> {
  switch (kind) {
    case 'model':        return fetchModels(following);
    case 'layout':       return fetchLayouts(following);
    case 'presentation': return fetchWorkFiles('presentation', '3dsp', following);
    case 'furniture':    return fetchWorkFiles('furniture', '3dsc', following);
    case 'diagram':      return fetchWorkFiles('diagram', '3dsd', following);
    case 'image':        return fetchWorkFiles('image', '3dsi', following);
    case 'portfolio':    return fetchWorkFiles('portfolio', '3dsf', following);
  }
}

// 著者プロフィール（users/{uid}）を 30件チャンクでまとめて解決
async function resolveAuthors(ids: string[]): Promise<Record<string, { displayName?: string; photoURL?: string }>> {
  const unique = [...new Set(ids.filter(id => id && id !== 'unknown'))];
  const out: Record<string, { displayName?: string; photoURL?: string }> = {};
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30);
    try {
      const snap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)));
      snap.docs.forEach(d => {
        const u = d.data() as any;
        out[d.id] = { displayName: u.displayName, photoURL: u.photoURL };
      });
    } catch (e) {
      console.warn('[gallery] author resolve failed for chunk', e);
    }
  }
  return out;
}

interface UseGalleryFeedArgs {
  kind: GalleryKind | 'all';
  scope: GalleryScope;
}

/**
 * 横断 Gallery のファンアウトフィード（v1）。
 * 各子アプリの公開クエリを並列実行し、共通 GalleryItem に正規化してマージ・更新日時降順ソートする。
 */
export function useGalleryFeed({ kind, scope }: UseGalleryFeedArgs) {
  const user = useAuthStore(s => s.currentUser);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let following: Following = null;
        if (scope === 'following') {
          if (!user?.uid) { if (active) { setItems([]); setLoading(false); } return; }
          const fs = await getDocs(collection(db, `users/${user.uid}/following`));
          following = fs.docs.map(d => d.id);
        }

        const wanted = kind === 'all' ? GALLERY_KINDS : [kind];
        const results = (await Promise.all(
          wanted.map(k => fetchByKind(k, following).catch(e => {
            console.warn('[gallery] fetch failed for', k, e);
            return [] as GalleryItem[];
          })),
        )).flat();

        const profiles = await resolveAuthors(results.map(r => r.author.id));
        if (!active) return;

        const merged = results
          .map(r => ({ ...r, author: { ...r.author, ...profiles[r.author.id] } }))
          .sort((a, b) => (b.updatedAtMs || b.createdAtMs) - (a.updatedAtMs || a.createdAtMs));

        setItems(merged);
        setLoading(false);
      } catch (e: any) {
        console.error('[gallery] feed error', e);
        if (active) { setError(String(e)); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [kind, scope, user?.uid]);

  return { items, loading, error };
}
