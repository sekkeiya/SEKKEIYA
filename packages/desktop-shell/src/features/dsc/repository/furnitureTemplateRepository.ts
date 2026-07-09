/**
 * FurnitureTemplateRepository
 * Firestore コレクション: furnitureTemplates
 * Storage パス:          furnitureTemplates/{templateId}/thumbnail.jpg
 */
import {
  collection, addDoc, getDocs, query, where, orderBy,
  doc, updateDoc, deleteDoc, serverTimestamp, limit, increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/client';

export const TEMPLATE_CATEGORIES_LIST = [
  'テーブル', 'チェア', 'ソファ・ベンチ', 'ベッド',
  'キャビネット・棚', 'アウトドア', '和家具', 'キッズ', '備品', 'カスタム',
] as const;

export type TemplateCategoryName = typeof TEMPLATE_CATEGORIES_LIST[number];

export interface FurnitureTemplate {
  id?: string;
  name: string;
  description?: string;
  category: string;
  tags?: string[];
  /** JSON.stringify(FurnitureComponent[]) */
  componentsJson: string;
  thumbnailUrl?: string | null;
  visibility: 'public' | 'private';
  createdBy: string;
  creatorName?: string;
  creatorPhotoUrl?: string | null;
  createdAt?: any;
  updatedAt?: any;
  useCount?: number;
  likeCount?: number;
}

const COL = 'furnitureTemplates';

export const FurnitureTemplateRepository = {

  /** テンプレートを新規作成（サムネイル付き） */
  async create(
    data: Omit<FurnitureTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    thumbnailDataUrl?: string,
  ): Promise<string> {
    const docRef = await addDoc(collection(db, COL), {
      ...data,
      thumbnailUrl: null,
      useCount: 0,
      likeCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (thumbnailDataUrl) {
      try {
        const url = await this.uploadThumbnail(docRef.id, thumbnailDataUrl);
        await updateDoc(docRef, { thumbnailUrl: url });
      } catch (e) {
        console.warn('[FurnitureTemplate] サムネイルのアップロードに失敗しました', e);
      }
    }
    return docRef.id;
  },

  /** サムネイルを Storage にアップロードして URL を返す */
  async uploadThumbnail(templateId: string, dataUrl: string): Promise<string> {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    const storageRef = ref(storage, `furnitureTemplates/${templateId}/thumbnail.jpg`);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(storageRef);
  },

  /** 自分のテンプレート一覧を取得 */
  async getMyTemplates(userId: string): Promise<FurnitureTemplate[]> {
    const q = query(
      collection(db, COL),
      where('createdBy', '==', userId),
      orderBy('updatedAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureTemplate));
  },

  /** 公開テンプレート一覧を取得 */
  async getPublicTemplates(limitCount = 60): Promise<FurnitureTemplate[]> {
    const q = query(
      collection(db, COL),
      where('visibility', '==', 'public'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FurnitureTemplate));
  },

  /** テンプレートを更新 */
  async update(templateId: string, updates: Partial<FurnitureTemplate>): Promise<void> {
    await updateDoc(doc(db, COL, templateId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  },

  /** テンプレートを削除（Storage のサムネイルも削除） */
  async delete(templateId: string): Promise<void> {
    await deleteDoc(doc(db, COL, templateId));
    try {
      await deleteObject(ref(storage, `furnitureTemplates/${templateId}/thumbnail.jpg`));
    } catch { /* サムネイルが存在しない場合は無視 */ }
  },

  /** 使用回数をインクリメント */
  async incrementUseCount(templateId: string): Promise<void> {
    await updateDoc(doc(db, COL, templateId), { useCount: increment(1) });
  },
};
