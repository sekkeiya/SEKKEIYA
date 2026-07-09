import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import { renderFirstPageThumbnail } from '../lib/pdf';
import type { DsfCategory } from '../store/useDsfStore';

// ポートフォリオは PDF のみ（一冊の本として閲覧するため）
const ALLOWED_EXT = ['pdf'];

const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export interface PortfolioUploadMetadata {
  title: string;
  category: DsfCategory;
  tags?: string[];
}

export const dsfUploadService = {
  /**
   * ポートフォリオ PDF を Firebase Storage にアップロードし、
   * 1 ページ目から表紙サムネイルを生成して、
   * projects/{projectId}/workFiles に portfolio の workFile ドキュメントを登録する。
   */
  async processPortfolioUpload(
    file: File,
    metadata: PortfolioUploadMetadata,
    projectId: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const ext = getExt(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error(`未対応のファイル形式です（${ext || 'unknown'}）。PDF をアップロードしてください。`);
    }

    const portfolioId = crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;

    // 1. 表紙サムネイルを先に生成（失敗してもアップロードは続行）
    let thumbnailUrl: string | null = null;
    try {
      const thumbBlob = await renderFirstPageThumbnail(file);
      if (thumbBlob) {
        const thumbPath = `projects/${projectId}/assets/${portfolioId}/cover.jpg`;
        const thumbRef = ref(storage, thumbPath);
        await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' });
        thumbnailUrl = await getDownloadURL(thumbRef);
      }
    } catch (e) {
      console.warn('[dsfUploadService] cover thumbnail generation skipped', e);
    }

    // 2. PDF 本体を Storage へアップロード（dsr と同じ projects/{projectId}/assets/{id}/ 配下）
    const storagePath = `projects/${projectId}/assets/${portfolioId}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress) onProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        },
        (error) => reject(error),
        () => resolve(),
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // 3. workFile ドキュメントを書き込む（Adapter が購読するパス）
    await setDoc(doc(db, `projects/${projectId}/workFiles`, portfolioId), {
      id: portfolioId,
      appScope: '3dsf',
      type: 'portfolio',
      title: metadata.title || file.name,
      category: metadata.category,
      format: ext,
      sizeBytes: file.size,
      storagePath,
      downloadUrl,
      thumbnailUrl,
      tags: metadata.tags ?? [],
      ownerId,
      createdBy: ownerId,
      visibility: 'private',
      projectId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 4. AI プロファイルログ（ベストエフォート）
    try {
      const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
      useAiProfileStore.getState().logSaveDataEvent({
        userId: ownerId || 'local-user',
        actionType: 'PORTFOLIO_UPLOADED_TO_WORKSPACE',
        context: {
          workspaceId: 'portfolio',
          projectId,
          targetId: portfolioId,
          targetType: '3dsf-portfolio',
          source: 'user',
          payload: {
            targetPortfolioName: metadata.title || file.name,
            targetCategory: metadata.category,
            targetFormat: ext,
          },
        },
      });
    } catch (e) {
      console.error('[dsfUploadService] Failed to log event', e);
    }

    return portfolioId;
  },

  /**
   * 表紙サムネが未保存の既存ポートフォリオに、生成済みの表紙 Blob をバックフィルする。
   * Storage へ cover.jpg を保存し、workFile ドキュメントの thumbnailUrl を更新する。
   * 表示時に一度だけ呼ぶ想定（ベストエフォート、失敗しても致命的ではない）。
   */
  async backfillCover(projectId: string, id: string, blob: Blob): Promise<string | null> {
    const thumbPath = `projects/${projectId}/assets/${id}/cover.jpg`;
    const thumbRef = ref(storage, thumbPath);
    await uploadBytes(thumbRef, blob, { contentType: 'image/jpeg' });
    const thumbnailUrl = await getDownloadURL(thumbRef);
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, id), {
      thumbnailUrl,
      updatedAt: serverTimestamp(),
    });
    return thumbnailUrl;
  },

  /**
   * ポートフォリオの公開可視性を切り替える（'public' | 'private'）。
   */
  async setPortfolioVisibility(projectId: string, id: string, visibility: 'public' | 'private'): Promise<void> {
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, id), {
      visibility,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * ポートフォリオを削除（Firestore ドキュメント + Storage オブジェクト）。
   */
  async deletePortfolio(projectId: string, item: any): Promise<void> {
    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, item.id));

    // 本体 PDF と表紙サムネイルを破棄（ベストエフォート）
    const paths = [item.storagePath, item.thumbnailUrl ? `projects/${projectId}/assets/${item.id}/cover.jpg` : null];
    for (const p of paths) {
      if (!p || typeof p !== 'string' || p.startsWith('http')) continue;
      try {
        await deleteObject(ref(storage, p));
      } catch (e) {
        console.warn('[dsfUploadService] storage delete skipped', p, e);
      }
    }
  },
};
