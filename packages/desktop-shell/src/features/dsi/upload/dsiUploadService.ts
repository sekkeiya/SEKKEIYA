import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { db, storage } from '../../../lib/firebase/client';
import { useAuthStore } from '../../../store/useAuthStore';
import type { DsiCategory } from '../store/useDsiStore';

// 手動アップロードで受け入れる拡張子（画像 + 動画）
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v'];
const ALLOWED_EXT = [...IMAGE_EXT, ...VIDEO_EXT];

const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export const isVideoExt = (ext: string) => VIDEO_EXT.includes((ext || '').toLowerCase());
export const isImageExt = (ext: string) => IMAGE_EXT.includes((ext || '').toLowerCase());

/** 拡張子からメディア種別を判定 */
export const mediaTypeForExt = (ext: string): 'image' | 'video' => (isVideoExt(ext) ? 'video' : 'image');

export interface ImageUploadMetadata {
  title: string;
  category: DsiCategory;
  parentSetId?: string | null;
  tags?: string[];
}

/** 外部ソース（S.Layout / AI Render）から参照インデックスを作る際のメタ情報 */
export interface ImageLinkMetadata {
  title: string;
  category: DsiCategory;
  /** 表示・再生に使う URL（実体は元アプリ側の Storage に残す） */
  downloadUrl: string;
  /** 動画のポスター等。無ければ null */
  thumbnailUrl?: string | null;
  mediaType?: 'image' | 'video';
  format?: string;
  width?: number;
  height?: number;
  /** 検索用タグ（自動付与＋ユーザー編集） */
  tags?: string[];
  /** 元ソース種別 */
  sourceType: 'layout-render' | 'ai-render';
  /** 元ドキュメントへの逆参照（削除同期・ディープリンク用） */
  sourceRef?: Record<string, any>;
  /** 公開可視性（既定は private。ギャラリー重複を避けるため明示公開のみ表示） */
  visibility?: 'public' | 'private';
}

export const dsiUploadService = {
  /**
   * 画像 / 動画ファイルを Firebase Storage にアップロードし、
   * projects/{projectId}/workFiles に image-file の workFile ドキュメントを登録する（手動アップロード）。
   */
  async processImageUpload(
    file: File,
    metadata: ImageUploadMetadata,
    projectId: string,
    onProgress?: (progress: number) => void,
  ): Promise<string> {
    const ext = getExt(file.name);
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Error(`未対応のファイル形式です（${ext || 'unknown'}）。画像（PNG/JPG/WebP/GIF）または動画（MP4/MOV/WebM）をアップロードしてください。`);
    }

    const imageId = crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;
    const mediaType = mediaTypeForExt(ext);

    // 1. Storage へアップロード（DSS / DSR と同じ projects/{projectId}/assets/{id}/ 配下）
    const storagePath = `projects/${projectId}/assets/${imageId}/${file.name}`;
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
    await setDoc(doc(db, `projects/${projectId}/workFiles`, imageId), {
      id: imageId,
      appScope: '3dsi',
      type: 'image-file',
      title: metadata.title || file.name,
      category: metadata.category,
      parentSetId: metadata.parentSetId ?? null,
      mediaType,
      format: ext,
      sourceType: 'manual-upload',
      sizeBytes: file.size,
      storagePath,
      downloadUrl,
      // 画像はサムネ = 本体、動画はポスター無し（カード側で <video> プレビュー）
      thumbnailUrl: mediaType === 'image' ? downloadUrl : null,
      tags: metadata.tags ?? [],
      ownerId,
      createdBy: ownerId,
      visibility: 'private',
      projectId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 3. セット内に追加した場合は childCount を加算
    if (metadata.parentSetId) {
      try {
        await updateDoc(doc(db, `projects/${projectId}/workFiles`, metadata.parentSetId), {
          childCount: increment(1),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[dsiUploadService] failed to bump set childCount', e);
      }
    }

    return imageId;
  },

  /**
   * 外部ソース（S.Layout レンダー / AI Render）の成果物を S.Image に「参照」として登録する。
   * 実体ファイルは複製せず、downloadUrl で元 Storage を指す（参照インデックス方式）。
   * ベストエフォート: 失敗しても元アプリのフローを止めない想定で呼び出すこと。
   *
   * 重複登録を避けるため linkKey（= sourceType:sourceId）を doc ID に使う。
   */
  async linkExternalImage(
    projectId: string,
    linkKey: string,
    metadata: ImageLinkMetadata,
  ): Promise<string> {
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;
    // 決定的な doc ID（同じソースを二重登録しない）
    const docId = `link_${metadata.sourceType}_${linkKey}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const mediaType = metadata.mediaType ?? 'image';

    await setDoc(doc(db, `projects/${projectId}/workFiles`, docId), {
      id: docId,
      appScope: '3dsi',
      type: 'image-file',
      title: metadata.title,
      category: metadata.category,
      parentSetId: null,
      mediaType,
      format: metadata.format ?? (mediaType === 'video' ? 'mp4' : 'png'),
      sourceType: metadata.sourceType,
      sourceRef: metadata.sourceRef ?? null,
      // リンクは元 Storage を参照（storagePath は持たない = 削除時に元実体を消さない）
      downloadUrl: metadata.downloadUrl,
      thumbnailUrl: metadata.thumbnailUrl ?? (mediaType === 'image' ? metadata.downloadUrl : null),
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      tags: metadata.tags ?? [],
      ownerId,
      createdBy: ownerId,
      // 既定は private（公開済みの元データとギャラリーで重複しないように）
      visibility: metadata.visibility ?? 'private',
      projectId,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return docId;
  },

  /**
   * 画像セット（フォルダ）を作成する。
   */
  async createImageSet(
    projectId: string,
    metadata: { title: string; category?: DsiCategory },
  ): Promise<string> {
    const setId = crypto.randomUUID();
    const ownerId = useAuthStore.getState().currentUser?.uid ?? null;

    await setDoc(doc(db, `projects/${projectId}/workFiles`, setId), {
      id: setId,
      appScope: '3dsi',
      type: 'image-set',
      title: metadata.title || '画像セット',
      category: metadata.category ?? '静止画',
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
   * 画像/動画/セットの公開可視性を切り替える（'public' | 'private'）。
   */
  async setImageVisibility(projectId: string, id: string, visibility: 'public' | 'private'): Promise<void> {
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, id), {
      visibility,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * 画像/動画のカテゴリ・タグ等のメタ情報を更新する（S.Image 右パネルの編集用）。
   */
  async updateImageMeta(
    projectId: string,
    id: string,
    fields: Partial<{ category: DsiCategory; tags: string[]; title: string }>,
  ): Promise<void> {
    await updateDoc(doc(db, `projects/${projectId}/workFiles`, id), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * 画像を別のセットへ移動（または外す）。childCount を調整する。
   */
  async moveImageToSet(
    projectId: string,
    imageId: string,
    newParentSetId: string | null,
    prevParentSetId: string | null,
  ): Promise<void> {
    if (newParentSetId === prevParentSetId) return;

    await updateDoc(doc(db, `projects/${projectId}/workFiles`, imageId), {
      parentSetId: newParentSetId,
      updatedAt: serverTimestamp(),
    });

    const tasks: Promise<unknown>[] = [];
    if (prevParentSetId) {
      tasks.push(updateDoc(doc(db, `projects/${projectId}/workFiles`, prevParentSetId), {
        childCount: increment(-1),
        updatedAt: serverTimestamp(),
      }).catch((e) => console.warn('[dsiUploadService] dec childCount', e)));
    }
    if (newParentSetId) {
      tasks.push(updateDoc(doc(db, `projects/${projectId}/workFiles`, newParentSetId), {
        childCount: increment(1),
        updatedAt: serverTimestamp(),
      }).catch((e) => console.warn('[dsiUploadService] inc childCount', e)));
    }
    await Promise.all(tasks);
  },

  /**
   * 単体の画像/動画を削除（Firestore ドキュメント + 手動アップロード時のみ Storage オブジェクト）。
   * 参照（リンク）アイテムは元 Storage を消さない（storagePath を持たないため自然に skip）。
   */
  async deleteImage(projectId: string, item: any): Promise<void> {
    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, item.id));

    if (item.parentSetId) {
      try {
        await updateDoc(doc(db, `projects/${projectId}/workFiles`, item.parentSetId), {
          childCount: increment(-1),
          updatedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('[dsiUploadService] dec childCount on delete', e);
      }
    }

    // storagePath を持つ = 手動アップロードの実体のみ削除（リンクは元アプリの実体を守る）
    if (item.storagePath && item.sourceType !== 'layout-render' && item.sourceType !== 'ai-render') {
      try {
        await deleteObject(ref(storage, item.storagePath));
      } catch (e) {
        console.warn('[dsiUploadService] storage delete skipped', e);
      }
    }
  },

  /**
   * セットを削除する。cascade=true なら子も削除、false なら子をトップ階層へ移す。
   */
  async deleteImageSet(projectId: string, setId: string, cascade: boolean): Promise<void> {
    const childSnap = await getDocs(query(
      collection(db, `projects/${projectId}/workFiles`),
      where('appScope', '==', '3dsi'),
      where('parentSetId', '==', setId),
    ));

    const children = childSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    if (cascade) {
      await Promise.all(children.map(c => this.deleteImage(projectId, c)));
    } else {
      await Promise.all(children.map(c =>
        updateDoc(doc(db, `projects/${projectId}/workFiles`, c.id), {
          parentSetId: null,
          updatedAt: serverTimestamp(),
        }).catch((e) => console.warn('[dsiUploadService] orphan child', e)),
      ));
    }

    await deleteDoc(doc(db, `projects/${projectId}/workFiles`, setId));
  },
};
