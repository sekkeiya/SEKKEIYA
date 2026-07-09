import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { PresentationContent } from '../types/dsp.types';

export interface PresentationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'proposal' | 'list' | 'report' | 'portfolio' | 'other';
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  visibility: 'public' | 'private';
  content: PresentationContent;
  slideCount: number;
  canvasSize?: { width: number; height: number; name?: string };
  usageCount: number;
}

const COLLECTION = 'presentationTemplates';

export const dspTemplateRepository = {
  /** テンプレートを新規作成し、生成されたIDを返す */
  async createTemplate(
    data: Omit<PresentationTemplate, 'id' | 'usageCount'>,
  ): Promise<string> {
    const ref = collection(db, COLLECTION);
    const docRef = await addDoc(ref, {
      ...data,
      usageCount: 0,
    });
    return docRef.id;
  },

  /** 公開テンプレート一覧を取得（usageCount降順）。カテゴリ指定可 */
  async listPublicTemplates(category?: string): Promise<PresentationTemplate[]> {
    const ref = collection(db, COLLECTION);
    const constraints = category && category !== 'all'
      ? [
          where('visibility', '==', 'public'),
          where('category', '==', category),
          orderBy('usageCount', 'desc'),
        ]
      : [
          where('visibility', '==', 'public'),
          orderBy('usageCount', 'desc'),
        ];
    const q = query(ref, ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PresentationTemplate));
  },

  /** 自分のテンプレート一覧を取得（createdAt降順） */
  async listMyTemplates(userId: string): Promise<PresentationTemplate[]> {
    const ref = collection(db, COLLECTION);
    const q = query(
      ref,
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PresentationTemplate));
  },

  /** テンプレートを削除する */
  async deleteTemplate(templateId: string): Promise<void> {
    const ref = doc(db, COLLECTION, templateId);
    await deleteDoc(ref);
  },

  /** テンプレートのメタ情報を更新する */
  async updateTemplate(
    templateId: string,
    data: Partial<Pick<PresentationTemplate, 'name' | 'description' | 'category' | 'visibility'>>,
  ): Promise<void> {
    const ref = doc(db, COLLECTION, templateId);
    await updateDoc(ref, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  },

  /** 使用回数をインクリメントする */
  async incrementUsage(templateId: string): Promise<void> {
    const ref = doc(db, COLLECTION, templateId);
    await updateDoc(ref, { usageCount: increment(1) });
  },
};
