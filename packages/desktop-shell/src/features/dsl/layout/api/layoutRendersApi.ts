import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../../lib/firebase/client';
import {
  getLayoutRendersColRef,
  getLayoutRenderRef,
  getLayoutPlanRef,
} from '../paths/workspacePaths';
import type { DslRenderDoc } from '../../../projects/types';

interface RenderContext {
  projectId: string;
  workspaceId: string;
  planId: string;
}

// ── Upload helpers ──────────────────────────────────────────────────────────

/** Convert data URL (data:image/png;base64,...) to a Blob. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** data URL の MIME からストレージ用の拡張子を決める。 */
function extFromDataUrl(dataUrl: string): string {
  const mime = dataUrl.match(/^data:(.*?);/)?.[1]?.toLowerCase() ?? 'image/png';
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  return map[mime] ?? (mime.startsWith('video/') ? 'mp4' : 'png');
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Upload a rendered image (data URL) to Firebase Storage and save its
 * metadata in the renders sub-collection. Optionally marks it as the
 * hero image and updates the plan's thumbnailUrl.
 *
 * Returns the new render doc ID.
 */
export async function saveRenderToLayout(
  dataUrl: string,
  ctx: RenderContext & { createdBy: string },
  meta: {
    shotName?: string;
    quality: 'standard' | 'cycles';
    width?: number;
    height?: number;
    samples?: number;
    setAsHero?: boolean;
    /** S.Image 連携用: メディア種別・カテゴリ・タグ */
    mediaType?: 'image' | 'video';
    category?: string;
    tags?: string[];
    /** 動画用: 長さ（秒）と、カバー/サムネに使うポスター画像 data URL */
    durationSec?: number;
    posterDataUrl?: string;
  },
): Promise<string> {
  const { projectId, workspaceId, planId, createdBy } = ctx;
  const mediaType = meta.mediaType ?? 'image';

  const colRef = getLayoutRendersColRef({ projectId, workspaceId, planId });
  if (!colRef) throw new Error('Invalid render context');

  // 1. Upload media to Storage（静止画=png/jpg、動画=mp4 など）
  const timestamp = Date.now();
  const ext = extFromDataUrl(dataUrl);
  const storagePath = `projects/${projectId}/renders/${workspaceId}/${planId}/${timestamp}.${ext}`;
  const storageRef = ref(storage, storagePath);
  const blob = dataUrlToBlob(dataUrl);
  await uploadBytes(storageRef, blob, { contentType: blob.type });
  const url = await getDownloadURL(storageRef);

  // 1b. 動画はポスター画像（静止画）を別途アップロードし、サムネイル/カバーに使う。
  //     動画 URL 自体は <img> で表示できないため、カバーには必ずポスターを使う。
  let posterUrl: string | undefined;
  if (mediaType === 'video' && meta.posterDataUrl) {
    try {
      const posterExt = extFromDataUrl(meta.posterDataUrl);
      const posterPath = `projects/${projectId}/renders/${workspaceId}/${planId}/${timestamp}_poster.${posterExt}`;
      const posterRef = ref(storage, posterPath);
      const posterBlob = dataUrlToBlob(meta.posterDataUrl);
      await uploadBytes(posterRef, posterBlob, { contentType: posterBlob.type });
      posterUrl = await getDownloadURL(posterRef);
    } catch (e) {
      console.warn('[layoutRendersApi] poster upload failed (non-fatal):', e);
    }
  }
  // カバー/サムネに使える画像 URL（動画はポスター、静止画は本体）
  const coverUrl = mediaType === 'video' ? posterUrl : url;

  // 2. Save Firestore document
  // Include projectId/workspaceId/planId so collectionGroup('renders') queries can
  // reconstruct the context without parsing the document path.
  const renderData: Record<string, any> = {
    type: mediaType,
    quality: meta.quality,
    url,
    width: meta.width ?? 1920,
    height: meta.height ?? 1080,
    isHero: meta.setAsHero ?? false,
    storagePath,
    projectId,
    workspaceId,
    planId,
    createdBy,
    // 新規レンダーはデフォルト公開（ギャラリーに自動表示）
    // RightPanelHost で非公開に変更可能
    visibility: 'public',
    createdAt: serverTimestamp(),
  };
  if (meta.shotName !== undefined) renderData.shotName = meta.shotName;
  if (meta.samples !== undefined) renderData.samples = meta.samples;
  if (posterUrl) renderData.thumbnailUrl = posterUrl;
  if (mediaType === 'video' && meta.durationSec !== undefined) {
    renderData.durationSec = meta.durationSec;
  }
  const docRef = await addDoc(colRef, renderData);

  // 3. Optionally update plan's thumbnailUrl（動画はポスター画像を使う）
  if (meta.setAsHero && coverUrl) {
    const planRef = getLayoutPlanRef({ projectId, workspaceId, planId });
    if (planRef) {
      await updateDoc(planRef, { thumbnailUrl: coverUrl, updatedAt: serverTimestamp() });
    }
  }

  // 4. Propagate thumbnail to the root Base doc so global / public layout lists
  //    can show a preview image without traversing the plan hierarchy.
  try {
    const planRef = getLayoutPlanRef({ projectId, workspaceId, planId });
    if (planRef) {
      const planSnap = await getDoc(planRef);
      const rootBaseId: string | undefined = planSnap.data()?.rootBaseId;
      if (rootBaseId && rootBaseId !== planId) {
        const baseRef = getLayoutPlanRef({ projectId, workspaceId, planId: rootBaseId });
        if (baseRef) {
          const baseSnap = await getDoc(baseRef);
          // Only set thumbnail if the base doesn't already have one
          // （動画はポスター画像。ポスターが無い動画は base サムネを更新しない）
          if (coverUrl && baseSnap.exists() && !baseSnap.data()?.thumbnailUrl) {
            await updateDoc(baseRef, { thumbnailUrl: coverUrl, updatedAt: serverTimestamp() });
          }
        }
      }
    }
  } catch (e) {
    console.warn('[layoutRendersApi] thumbnail propagation to base failed (non-fatal):', e);
  }

  // 5. S.Image（3DSI）へ参照インデックスを登録（ベストエフォート・参照のみ・実体は複製しない）。
  //    既定 visibility は private のため、S.Image 側で公開操作するまでギャラリーには出ない。
  //    動画は S.Movie 側で管理する方針のため、S.Image には静止画（パース）のみリンクする。
  if (mediaType !== 'video') {
    try {
      const { dsiUploadService } = await import('../../../dsi/upload/dsiUploadService');
      const category = (meta.category ?? 'パース') as any;
      await dsiUploadService.linkExternalImage(projectId, docRef.id, {
        title: meta.shotName || 'S.Layout パース',
        category,
        downloadUrl: url,
        thumbnailUrl: posterUrl,
        mediaType,
        format: ext,
        width: meta.width ?? 1920,
        height: meta.height ?? 1080,
        tags: meta.tags ?? [],
        sourceType: 'layout-render',
        sourceRef: { projectId, workspaceId, planId, renderId: docRef.id },
      });
    } catch (e) {
      console.warn('[layoutRendersApi] S.Image link skipped (non-fatal):', e);
    }
  }

  // 6. 動画は S.Movie がローカル管理する（docs/14 §0.5）。生成 mp4 を
  //    LocalAssets/Movies へ保存し、S.Movie の素材・ギャラリーに自動で現れるようにする。
  //    クラウド側のレンダー記録（上記）はメタデータとして残す。ベストエフォート。
  if (mediaType === 'video') {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const b64 = dataUrl.split(',')[1];
      if (b64) {
        const baseName = (meta.shotName || 'S.Layout 動画').replace(/\.[^.]+$/, '');
        const savedPath = await invoke<string>('save_local_movie', {
          fileName: `${baseName}.${ext}`,
          dataB64: b64,
        });
        console.log('[layoutRendersApi] S.Movie へローカル保存:', savedPath);
      }
    } catch (e) {
      console.warn('[layoutRendersApi] S.Movie local save skipped (non-fatal):', e);
    }
  }

  return docRef.id;
}

/**
 * Subscribe to all renders for a plan, ordered newest-first.
 */
export function subscribeToRenders(
  ctx: RenderContext,
  onData: (renders: (DslRenderDoc & { id: string; storagePath?: string })[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const colRef = getLayoutRendersColRef(ctx);
  if (!colRef) {
    onData([]);
    return () => {};
  }
  const q = query(colRef, orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      onData(docs);
    },
    (err) => onError?.(err as Error),
  );
}

/**
 * Fetch renders once (no real-time listener).
 */
export async function getRenders(
  ctx: RenderContext,
): Promise<(DslRenderDoc & { id: string; storagePath?: string })[]> {
  const colRef = getLayoutRendersColRef(ctx);
  if (!colRef) return [];
  const snap = await getDocs(query(colRef, orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/**
 * Set a specific render as the plan's hero (thumbnailUrl).
 */
export async function setRenderAsHero(
  ctx: RenderContext,
  renderId: string,
  renderUrl: string,
): Promise<void> {
  const batch = writeBatch(db);

  const planRef = getLayoutPlanRef(ctx);
  if (planRef) {
    batch.update(planRef, { thumbnailUrl: renderUrl, updatedAt: serverTimestamp() });
  }

  const renderRef = getLayoutRenderRef({ ...ctx, renderId });
  if (renderRef) {
    batch.update(renderRef, { isHero: true });
  }

  await batch.commit();
}

/**
 * Update arbitrary fields on a render document (e.g. visibility, isHero).
 */
export async function updateRenderDoc(
  ctx: RenderContext,
  renderId: string,
  fields: Partial<{ visibility: 'public' | 'private'; isHero: boolean; shotName: string }>,
): Promise<void> {
  const renderRef = getLayoutRenderRef({ ...ctx, renderId });
  if (!renderRef) return;
  await updateDoc(renderRef, { ...fields, updatedAt: serverTimestamp() });
}

/**
 * Delete a render from Storage + Firestore.
 */
export async function deleteRender(
  ctx: RenderContext,
  renderId: string,
  storagePath?: string,
): Promise<void> {
  if (storagePath) {
    try {
      await deleteObject(ref(storage, storagePath));
    } catch (e) {
      console.warn('[layoutRendersApi] Storage delete failed (file may already be gone):', e);
    }
  }
  const renderRef = getLayoutRenderRef({ ...ctx, renderId });
  if (renderRef) await deleteDoc(renderRef);
}
