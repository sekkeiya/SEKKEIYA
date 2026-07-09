import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase/client';
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
  /** 1枚目スライドの縮小画像（Storage URL）。管理ビュー/ピッカーのカードで優先表示 */
  thumbnailUrl?: string;
  /** 直近に content を上書きしたユーザー */
  updatedBy?: string;
}

const COLLECTION = 'presentationTemplates';

export const dspTemplateRepository = {
  /** テンプレートを新規作成し、生成されたIDを返す */
  async createTemplate(
    data: Omit<PresentationTemplate, 'id' | 'usageCount'>,
  ): Promise<string> {
    const ref = collection(db, COLLECTION);
    // Firestore は undefined を拒否するため round-trip でサニタイズ（thumbnailUrl 未指定など）
    const sanitized = JSON.parse(JSON.stringify({ ...data, usageCount: 0 }));
    const docRef = await addDoc(ref, sanitized);
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

  /** テンプレートを1件取得（適用時に他人の公開テンプレも読む）。無ければ null */
  async getTemplate(templateId: string): Promise<PresentationTemplate | null> {
    const snap = await getDoc(doc(db, COLLECTION, templateId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as PresentationTemplate;
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

  /** テンプレートの本文(content)を上書き更新する。エディタの「既存を上書き」保存で使用 */
  async updateTemplateContent(
    templateId: string,
    content: PresentationContent,
    slideCount: number,
    updatedBy: string,
    thumbnailUrl?: string,
  ): Promise<void> {
    const ref = doc(db, COLLECTION, templateId);
    // Firestore は undefined を拒否するため round-trip でサニタイズ
    const sanitized = JSON.parse(JSON.stringify(content));
    const patch: Record<string, unknown> = {
      content: sanitized,
      slideCount,
      updatedBy,
      updatedAt: new Date().toISOString(),
    };
    if (thumbnailUrl) patch.thumbnailUrl = thumbnailUrl;
    await updateDoc(ref, patch);
  },

  /** 既存テンプレートを複製し、新しいIDを返す（名前に「のコピー」を付与） */
  async duplicateTemplate(source: PresentationTemplate, createdBy: string, createdByName: string): Promise<string> {
    const now = new Date().toISOString();
    return this.createTemplate({
      name: `${source.name} のコピー`,
      description: source.description,
      category: source.category,
      visibility: 'private', // 複製は常に非公開から
      createdBy,
      createdByName,
      createdAt: now,
      updatedAt: now,
      content: source.content,
      slideCount: source.slideCount,
      canvasSize: source.canvasSize,
      thumbnailUrl: source.thumbnailUrl,
    });
  },

  /**
   * テンプレートのサムネイル(JPEG Blob)を Storage にアップロードし、URLを doc に保存する。
   * @returns download URL / 失敗時 null
   */
  async uploadTemplateThumbnail(templateId: string, blob: Blob): Promise<string | null> {
    try {
      const storageRef = ref(storage, `${COLLECTION}/${templateId}/thumbnail.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, COLLECTION, templateId), { thumbnailUrl: url });
      return url;
    } catch (e) {
      console.error('[dspTemplateRepository] Thumbnail upload failed', e);
      return null;
    }
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
