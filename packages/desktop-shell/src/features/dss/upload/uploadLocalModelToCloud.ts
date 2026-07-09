import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { storage, db, auth } from '../../../lib/firebase/client';

// ──────────────────────────────────────────────────────────────────────────────
// Local Models のモデルを、グローバル /assets（Public/Private Models）へアップロードする。
// 既存の dssUploadService.processDesktopUpload はプロジェクト配下 assets 用なので、
// 公開/非公開の個人モデル（top-level /assets, visibility + ownerId）はこちらで作成する。
// 紐付けは Rust の set_local_upload_record で local_uploads.json に記録する。
// ──────────────────────────────────────────────────────────────────────────────

export type ModelVisibility = 'public' | 'private';

export interface LocalUploadMeta {
  title?: string;
  type?: string;          // modelType（家具/建築 等）
  category?: string;      // mainCategory
  subCategory?: string;
  tags?: string[];
  dimensions?: { width: number; depth: number; height: number } | null;
}

async function fetchAsFile(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return new File([buf], name, { type });
}

function uploadTask(path: string, file: File, ownerId: string): Promise<string> {
  const r = ref(storage, path);
  const task = uploadBytesResumable(r, file, { customMetadata: { ownerId } });
  return new Promise<string>((resolve, reject) => {
    task.on('state_changed', undefined, reject, async () => {
      try { resolve(await getDownloadURL(r)); } catch (e) { reject(e); }
    });
  });
}

/**
 * Local Models のモデルをクラウド（公開/非公開）へアップロードする。
 * @returns 作成された assets ドキュメント ID
 */
export async function uploadLocalModelToCloud(
  model: any,
  visibility: ModelVisibility,
  meta?: LocalUploadMeta,
): Promise<string> {
  const ownerId = auth.currentUser?.uid;
  if (!ownerId) throw new Error('ログインが必要です');

  // プレビュー用 GLB を解決（3dm/blend はオンデマンド変換）。
  const { invoke, convertFileSrc, isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) throw new Error('デスクトップ版でのみアップロードできます');

  let glbSrcUrl: string | null = model.glbUrl || null;
  if (!glbSrcUrl && model.localPath) {
    const glbPath = await invoke<string>('ensure_local_preview_glb', { path: model.localPath });
    if (glbPath) glbSrcUrl = convertFileSrc(String(glbPath).replace(/\\/g, '/'));
  }
  if (!glbSrcUrl) throw new Error('プレビュー可能な GLB を生成できませんでした');

  const assetId = crypto.randomUUID();
  const title = (meta?.title && meta.title.trim()) || String(model.name || model.title || 'model').replace(/\.[^.]+$/, '');
  const baseName = String(model.name || model.title || 'model').replace(/\.[^.]+$/, '');
  const storageDir = `assets/${assetId}/v1`;

  // GLB 本体。
  const glbFile = await fetchAsFile(glbSrcUrl, `${baseName}.glb`, 'model/gltf-binary');
  const glbUrl = await uploadTask(`${storageDir}/${baseName}.glb`, glbFile, ownerId);

  // サムネ（GLB から生成）。失敗しても続行。
  let thumbnailUrl = '';
  try {
    const { generateThumbnailFromGlb } = await import('./utils/generateThumbnailFromGlb');
    const { blob } = await generateThumbnailFromGlb(glbFile as any, { width: 800, height: 600 });
    const thumbFile = new File([blob], `${baseName}_thumb.webp`, { type: 'image/webp' });
    thumbnailUrl = await uploadTask(`${storageDir}/${baseName}_thumb.webp`, thumbFile, ownerId);
  } catch (e) {
    console.warn('[uploadLocalModelToCloud] thumbnail failed', e);
  }

  const now = Date.now();
  const assetDoc: any = {
    id: assetId,
    name: title,
    type: '3d-model',
    format: 'glb',
    visibility,
    isPublic: visibility === 'public',
    ownerId,
    authorId: ownerId,
    sizeBytes: glbFile.size,
    downloadUrl: glbUrl,
    glbUrl,
    thumbnailUrl,
    storagePath: `${storageDir}/${baseName}.glb`,
    latestVersion: 1,
    versions: {
      '1': { downloadUrl: glbUrl, glbUrl, thumbnailUrl, createdAt: now },
    },
    files: { glb: { url: glbUrl, downloadUrl: glbUrl } },
    modelType: meta?.type || 'Object',
    category: meta?.category || 'Uncategorized',
    subCategory: meta?.subCategory || '',
    tags: meta?.tags || [],
    dimensions: meta?.dimensions || null,
    source: 'local-upload',
    createdAt: new Date(now).toISOString(),
  };

  await setDoc(doc(db, 'assets', assetId), assetDoc);

  // ローカル↔クラウド紐付けを記録。
  if (model.localPath) {
    try {
      await invoke('set_local_upload_record', {
        path: model.localPath,
        assetId,
        visibility,
        uploadedAt: new Date(now).toISOString(),
      });
    } catch (e) {
      console.warn('[uploadLocalModelToCloud] failed to record link', e);
    }
  }

  return assetId;
}

/**
 * クラウドへ保存したモデルを削除して「ローカルに戻す」。
 * /assets ドキュメントと Storage 上のファイル（GLB・サムネ）を削除し、
 * ローカルの紐付け記録も解除する。ローカル実体ファイルには触れない。
 */
export async function revertLocalModelToLocal(assetId: string, localPath?: string | null): Promise<void> {
  // Firestore からファイル URL を集めてから削除。
  try {
    const snap = await getDoc(doc(db, 'assets', assetId));
    if (snap.exists()) {
      const d: any = snap.data();
      const urls = [d.downloadUrl, d.glbUrl, d.thumbnailUrl,
        ...Object.values(d.versions || {}).flatMap((v: any) => [v?.downloadUrl, v?.glbUrl, v?.thumbnailUrl])]
        .filter(Boolean);
      for (const url of urls) {
        try { await deleteObject(ref(storage, url as string)); }
        catch (e) { console.warn('[revertLocalModelToLocal] storage delete failed', url, e); }
      }
    }
    await deleteDoc(doc(db, 'assets', assetId));
  } catch (e) {
    console.error('[revertLocalModelToLocal] firestore delete failed', e);
    throw e;
  }

  // ローカルの紐付け記録を解除。
  if (localPath) {
    try {
      const { invoke, isTauri } = await import('@tauri-apps/api/core');
      if (isTauri()) await invoke('remove_local_upload_record', { path: localPath });
    } catch (e) {
      console.warn('[revertLocalModelToLocal] failed to remove link record', e);
    }
  }
}
