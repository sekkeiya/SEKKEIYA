import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import type { DsrCategory } from '../store/useDsrStore';

const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg'];

const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export interface DrawingUploadMetadata {
  title: string;
  category: DsrCategory;
  parentSetId?: string | null;
  tags?: string[];
}

export const dsrUploadService = {
  /**
   * 図面ファイル（PDF / 画像）を Firebase Storage にアップロードし、
   * projects/{projectId}/workFiles に drawing-file の workFile ドキュメントを登録する。
   */
  async processDrawingUpload(
    file: File,
    metadata: DrawingUploadMetadata,
    projectId: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const ext = getExt(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error(`未対応のファイル形式です（${ext || 'unknown'}）。PDF / PNG / JPG をアップロードしてください。`);
    }

    const drawingId = crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;

    // 1. Storage へアップロード（DSS と同じ projects/{projectId}/assets/{id}/ 配下）
    const storagePath = `projects/${projectId}/assets/${drawingId}/${file.name}`;
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

    // 2. workFile ドキュメントを直接書き込む（Adapter が購読するパス）
    await setDoc(doc(db, `projects/${projectId}/workFiles`, drawingId), {
      id: drawingId,
      appScope: '3dsr',
      type: 'drawing-file',
      title: metadata.title || file.name,
      category: metadata.category,
      parentSetId: metadata.parentSetId ?? null,
      format: ext,
      sizeBytes: file.size,
      storagePath,
      downloadUrl,
      tags: metadata.tags ?? [],
      ownerId,
      createdBy: ownerId,
      visibility: 'private',
      projectId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. セット内に追加した場合は childCount を加算（denormalized、表示はグリッド側で再計算）
    if (metadata.parentSetId) {
      try {
        await updateDoc(doc(db, `projects/${projectId}/workFiles`, metadata.parentSetId), {
          childCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[dsrUploadService] failed to bump set childCount', e);
      }
    }

    // 4. AI プロファイルログ（ベストエフォート）
    try {
      const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
      useAiProfileStore.getState().logSaveDataEvent({
        userId: ownerId || 'local-user',
        actionType: 'DRAWING_UPLOADED_TO_WORKSPACE',
        context: {
          workspaceId: 'drawing',
          projectId,
          targetId: drawingId,
          targetType: '3dsr-drawing',
          source: 'user',
          payload: {
            targetDrawingName: metadata.title || file.name,
            targetCategory: metadata.category,
            targetFormat: ext,
          },
        },
      });
    } catch (e) {
      console.error('[dsrUploadService] Failed to log event', e);
    }

    return drawingId;
  },

  /**
   * 設計図書セット（フォルダ）を作成する。
   */
  async createDrawingSet(
    projectId: string,
    metadata: { title: string; category?: DsrCategory },
  ): Promise<string> {
    const setId = crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;

    await setDoc(doc(db, `projects/${projectId}/workFiles`, setId), {
      id: setId,
      appScope: '3dsr',
      type: 'drawing-set',
      title: metadata.title || '設計図書一式',
      category: metadata.category ?? '設計図書',
      childCount: 0,
      coverDownloadUrl: null,
      ownerId,
      createdBy: ownerId,
      visibility: 'private',
      projectId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return setId;
  },

  /**
   * 図面/セットの公開可視性を切り替える（'public' | 'private'）。
   */
  async setDrawingVisibility(projectId: string, id: string, visibility: 'public' | 'private'): Promise<void> {
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, id), {
      visibility,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * 図面を別のセットへ移動（または外す）。childCount を調整する。
   */
  async moveDrawingToSet(
    projectId: string,
    drawingId: string,
    newParentSetId: string | null,
    prevParentSetId: string | null,
  ): Promise<void> {
    if (newParentSetId === prevParentSetId) return;

    await updateDoc(doc(db, `projects/${projectId}/workFiles`, drawingId), {
      parentSetId: newParentSetId,
      updatedAt: serverTimestamp(),
    });

    const tasks: Promise<unknown>[] = [];
    if (prevParentSetId) {
      tasks.push(updateDoc(doc(db, `projects/${projectId}/workFiles`, prevParentSetId), {
        childCount: increment(-1),
        updatedAt: serverTimestamp(),
      }).catch((e) => console.warn('[dsrUploadService] dec childCount', e)));
    }
    if (newParentSetId) {
      tasks.push(updateDoc(doc(db, `projects/${projectId}/workFiles`, newParentSetId), {
        childCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch((e) => console.warn('[dsrUploadService] inc childCount', e)));
    }
    await Promise.all(tasks);
  },

  /**
   * 単体図面を削除（Firestore ドキュメント + Storage オブジェクト）。
   */
  async deleteDrawing(projectId: string, item: any): Promise<void> {
    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, item.id));

    if (item.parentSetId) {
      try {
        await updateDoc(doc(db, `projects/${projectId}/workFiles`, item.parentSetId), {
          childCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[dsrUploadService] dec childCount on delete', e);
      }
    }

    if (item.storagePath) {
      try {
        await deleteObject(ref(storage, item.storagePath));
      } catch (e) {
        console.warn('[dsrUploadService] storage delete skipped', e);
      }
    }
  },

  /**
   * セットを削除する。cascade=true なら子図面も削除、false なら子をトップ階層へ移す。
   */
  async deleteDrawingSet(projectId: string, setId: string, cascade: boolean): Promise<void> {
    // 子図面を取得
    const childSnap = await getDocs(query(
      collection(db, `projects/${projectId}/workFiles`),
      where('appScope', '==', '3dsr'),
      where('parentSetId', '==', setId),
    ));

    const children = childSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    if (cascade) {
      await Promise.all(children.map(c => this.deleteDrawing(projectId, c)));
    } else {
      // 子をトップ階層へ（parentSetId を null に）
      await Promise.all(children.map(c =>
        updateDoc(doc(db, `projects/${projectId}/workFiles`, c.id), {
          parentSetId: null,
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('[dsrUploadService] orphan child', e)),
      ));
    }

    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, setId));
  },
};
