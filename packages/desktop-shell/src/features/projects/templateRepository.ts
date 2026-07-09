import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { invoke } from '@tauri-apps/api/core';
import { db, storage } from '../../lib/firebase/client';
import type { RhinoTemplate, UploadStatus } from './types';

// Rhinoのテンプレートファイル名 → templatePath を動的に解決するキャッシュ
let _rhinoTemplatesDir: string | null = null;
async function getRhinoTemplatesDir(): Promise<string | null> {
  if (_rhinoTemplatesDir !== null) return _rhinoTemplatesDir;
  try {
    _rhinoTemplatesDir = await invoke<string>('get_rhino_templates_dir');
  } catch {
    _rhinoTemplatesDir = '';
  }
  return _rhinoTemplatesDir || null;
}

function rhinoPath(dir: string, filename: string): string {
  return `${dir}\\${filename}`;
}

/** Rhino 公式テンプレートのメタデータ（パスは起動時に解決） */
const RHINO_OFFICIAL_META: Array<Omit<RhinoTemplate, 'templatePath'> & { filename: string; recommendedFor?: string }> = [
  {
    id: 'tpl-rhino-arch-mm',
    name: 'Architecture - Millimeters',
    description: '建築設計の標準テンプレート（mm単位）。住宅〜中規模建築の壁・床・開口部・階段など、建物全体のモデリングに最適です。許容差・グリッドスナップも建築スケールに調整済み。',
    recommendedFor: '住宅・店舗・中規模建築の基本設計〜実施設計',
    filename: 'Large Objects - Millimeters.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Architecture',
    tags: ['建築', 'architecture', '住宅', 'mm'], isPublic: true, isMock: false, usageCount: 1250, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-interior',
    name: 'Interior Design',
    description: 'インテリアデザイン専用テンプレート。家具配置・内装仕上げ・照明計画を想定したレイヤー構成で、店舗内装や住宅リノベーションの検討をすぐに始められます。',
    recommendedFor: '店舗内装・オフィス・住宅リノベーション',
    filename: 'Interior Design.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Interior',
    tags: ['インテリア', 'interior', '内装', '照明', 'mm'], isPublic: true, isMock: false, usageCount: 720, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-arch-m',
    name: 'Architecture - Meters',
    description: 'メートル単位の大規模建築向けテンプレート。庁舎・商業施設・集合住宅など、大型建物や複数棟のボリュームスタディに向いています。',
    recommendedFor: '大規模施設・集合住宅・ボリュームスタディ',
    filename: 'Large Objects - Meters.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'm', category: 'Architecture',
    tags: ['建築', 'architecture', '大規模', 'ボリューム', 'm'], isPublic: true, isMock: false, usageCount: 860, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-drawing',
    name: 'Architectural Drawing',
    description: '平面図・立面図・断面図を一元管理する2D図面作成テンプレート。線種・寸法スタイルが図面提出用に整っており、プレゼン資料のベースにも使えます。',
    recommendedFor: '確認申請図・プレゼン図面・2D作図',
    filename: '00_drawing.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Drawing',
    tags: ['図面', 'drawing', '平面図', '立面図', 'mm'], isPublic: true, isMock: false, usageCount: 620, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-furniture',
    name: 'Furniture Design',
    description: '家具・FF&E デザイン専用テンプレート。テーブル・椅子・収納などの原寸モデリングに適した許容差設定で、ジョイントや金物の細部まで作り込めます。',
    recommendedFor: 'オリジナル家具・造作家具・FF&E',
    filename: 'Furniture Design.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Furniture',
    tags: ['家具', 'furniture', '造作', 'FF&E', 'mm'], isPublic: true, isMock: false, usageCount: 540, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-small-mm',
    name: 'Product Design - Millimeters',
    description: 'プロダクト・小型オブジェクト向けテンプレート。照明器具・建具金物・インテリア小物など、手に取れるサイズの精密なモデリングに適した高精度設定です。',
    recommendedFor: '照明器具・金物・プロトタイプ・3Dプリント',
    filename: 'Small Objects - Millimeters.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Product',
    tags: ['プロダクト', 'product', '小物', '3Dプリント', 'mm'], isPublic: true, isMock: false, usageCount: 480, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-detail',
    name: 'Construction Detail',
    description: '納まり・矩計図検討用テンプレート。サッシ廻り・基礎・屋根などのディテールを原寸で検討するための高精度設定。部分詳細図の作成に向いています。',
    recommendedFor: '納まり検討・矩計図・部分詳細図',
    filename: 'Small Objects - Millimeters.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Detail',
    tags: ['ディテール', 'detail', '納まり', '矩計', 'mm'], isPublic: true, isMock: false, usageCount: 390, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-urban',
    name: 'Urban Planning - Meters',
    description: '都市計画・ランドスケープ向けテンプレート。敷地周辺の街区・公園・道路を含む広域モデルや、日影・景観検討のベースに最適なメートル単位設定です。',
    recommendedFor: '敷地分析・街区モデル・ランドスケープ',
    filename: 'Large Objects - Meters.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'm', category: 'Urban',
    tags: ['都市', 'urban', 'ランドスケープ', '敷地', 'm'], isPublic: true, isMock: false, usageCount: 310, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-living',
    name: 'Residential Living Plan',
    description: '住宅のリビング・ダイニング計画用テンプレート。家具レイアウト・動線・ゾーニングを素早く検討できる平面計画向けのセットアップです。',
    recommendedFor: '住宅プランニング・家具レイアウト検討',
    filename: '00_drawing-living.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Residential',
    tags: ['住宅', 'residential', 'リビング', '間取り', 'mm'], isPublic: true, isMock: false, usageCount: 295, toolType: 'rhino',
  },
  {
    id: 'tpl-rhino-mesh',
    name: 'Mesh Modeling',
    description: 'フリーフォーム・オーガニック形状向けメッシュモデリングテンプレート。SubD・スカルプト的な造形や、スキャンデータの編集に適しています。',
    recommendedFor: '曲面造形・SubD・スキャンデータ編集',
    filename: 'Mesh.3dm',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    rhinoVersion: 8, unitSystem: 'mm', category: 'Mesh',
    tags: ['メッシュ', 'mesh', 'SubD', 'オーガニック'], isPublic: true, isMock: false, usageCount: 210, toolType: 'rhino',
  },
];

/** 旧モック由来のFirestoreレガシーID（新ラインナップと重複するため除外） */
const LEGACY_TEMPLATE_IDS = new Set(['tpl-off-1', 'tpl-off-2']);

const BLENDER_OFFICIAL_TEMPLATES: RhinoTemplate[] = [
  {
    id: 'tpl-off-blender',
    name: 'Blender - General',
    description: '標準的なBlenderのスタートアップファイルです。',
    sourceType: 'official', ownerName: 'SEKKEIYA',
    category: 'Default',
    tags: ['standard', 'general', 'blender'],
    isPublic: true,
    templatePath: 'startup.blend',
    isMock: false, usageCount: 840, toolType: 'blender',
  },
];

let _rhinoOfficialResolved: RhinoTemplate[] | null = null;

async function getRhinoOfficialTemplates(): Promise<RhinoTemplate[]> {
  if (_rhinoOfficialResolved) return _rhinoOfficialResolved;
  const dir = await getRhinoTemplatesDir();
  _rhinoOfficialResolved = RHINO_OFFICIAL_META.map(({ filename, ...meta }) => ({
    ...meta,
    templatePath: dir ? rhinoPath(dir, filename) : '',
    isMock: !dir,
  }));
  return _rhinoOfficialResolved;
}

// 同期フォールバック（Firestore が落ちたとき用）
const MOCK_OFFICIAL_TEMPLATES: RhinoTemplate[] = RHINO_OFFICIAL_META.map(({ filename, ...meta }) => ({
  ...meta,
  templatePath: '',
  isMock: true,
})).concat(BLENDER_OFFICIAL_TEMPLATES);

export const TemplateRepository = {
  async getTemplates(uid?: string): Promise<RhinoTemplate[]> {
    try {
      const templatesMap = new Map<string, RhinoTemplate>();

      // ローカルのRhinoテンプレートフォルダからパスを動的解決して登録
      const rhinoOfficial = await getRhinoOfficialTemplates();
      rhinoOfficial.forEach(t => templatesMap.set(t.id, t));
      BLENDER_OFFICIAL_TEMPLATES.forEach(t => templatesMap.set(t.id, t));

      try {
        const offSnap = await getDocs(collection(db, 'officialTemplates'));
        // Firestoreのエントリはパスが設定済みのものだけ上書き（ローカル解決結果を優先したい場合はスキップ）
        offSnap.forEach(d => {
          // 旧モック由来のレガシーIDは新ラインナップと重複するため無視
          if (LEGACY_TEMPLATE_IDS.has(d.id)) return;
          const data = d.data() as RhinoTemplate;
          // Firestoreに templatePath が入っていれば上書き、なければローカル解決を維持
          if (data.templatePath) {
            templatesMap.set(d.id, data);
          } else {
            // ローカル解決済みのパスを維持しつつメタ情報をマージ
            const existing = templatesMap.get(d.id);
            templatesMap.set(d.id, { ...(existing ?? {}), ...data, templatePath: existing?.templatePath ?? '' } as RhinoTemplate);
          }
        });
      } catch (e) {
        console.error('[DEBUG] Failed to fetch officialTemplates:', e);
      }

      // 2. public
      try {
        const pubSnap = await getDocs(collection(db, 'publicTemplates'));
        pubSnap.forEach(d => templatesMap.set(d.id, d.data() as RhinoTemplate));
      } catch (e) {
        console.error('[DEBUG] Failed to fetch publicTemplates:', e);
      }

      // 3. user
      if (uid) {
        try {
          const userSnap = await getDocs(collection(db, `users/${uid}/templates`));
          userSnap.forEach(d => templatesMap.set(d.id, d.data() as RhinoTemplate));
        } catch (e) {
          console.error(`[DEBUG] Failed to fetch users/${uid}/templates:`, e);
        }
      }

      const results = Array.from(templatesMap.values());
      if (results.length === 0) return [...rhinoOfficial, ...BLENDER_OFFICIAL_TEMPLATES];

      return results;
    } catch (error) {
      console.error('Failed to fetch templates', error);
      return [...MOCK_OFFICIAL_TEMPLATES];
    }
  },

  async saveTemplate(
    template: RhinoTemplate,
    file: File | null,
    uid: string,
    onProgress?: (status: UploadStatus) => void,
    thumbnailFile?: File | null,
    glbFile?: File | null
  ): Promise<void> {
    try {
      if (onProgress) onProgress('uploading');

      let downloadURL = template.templatePath || '';
      let fullPath = template.storagePath || '';

      if (file) {
        const storageRef = ref(storage, `templates/${uid}/${template.id}.3dm`);
        await uploadBytes(storageRef, file);
        downloadURL = await getDownloadURL(storageRef);
        fullPath = storageRef.fullPath;
      }

      let thumbUrl = '';
      if (thumbnailFile) {
        const thumbRef = ref(storage, `templates/${uid}/${template.id}_thumb.webp`);
        await uploadBytes(thumbRef, thumbnailFile);
        thumbUrl = await getDownloadURL(thumbRef);
      }

      let glbUrlParam = '';
      if (glbFile) {
        const glbRef = ref(storage, `templates/${uid}/${template.id}.glb`);
        await uploadBytes(glbRef, glbFile);
        glbUrlParam = await getDownloadURL(glbRef);
      }

      const templateData = {
        ...template,
        templatePath: downloadURL,
        storagePath: fullPath || undefined,
        thumbnailUrl: thumbUrl || template.thumbnailUrl || undefined,
        glbUrl: glbUrlParam || template.glbUrl || undefined,
        isDraft: !downloadURL,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        isMock: false
      };

      if (onProgress) onProgress('saving');
      
      if (templateData.sourceType === 'official') {
        try {
          await setDoc(doc(db, `officialTemplates/${template.id}`), templateData);
        } catch (e) {
          console.error(`[DEBUG] Failed to save officialTemplates/${template.id}:`, e);
          throw e;
        }
      } else {
        try {
          await setDoc(doc(db, `users/${uid}/templates/${template.id}`), templateData);
        } catch (e) {
          console.error(`[DEBUG] Failed to save users/${uid}/templates/${template.id}:`, e);
          throw e;
        }

        if (templateData.isPublic) {
          try {
            await setDoc(doc(db, `publicTemplates/${template.id}`), templateData);
          } catch (e) {
            console.error(`[DEBUG] Failed to save publicTemplates/${template.id}:`, e);
          }
        }
      }

      if (onProgress) onProgress('success');
    } catch (error) {
      console.error('[DEBUG] Template save error caught at top level:', error);
      if (onProgress) onProgress('error');
      throw error;
    }
  },

  async updateTemplate(
    templateId: string,
    uid: string,
    sourceType: 'official' | 'user' | 'public',
    isPublic: boolean,
    updatedData: Partial<RhinoTemplate>,
    newFile?: File | null,
    onProgress?: (status: UploadStatus) => void,
    thumbnailFile?: File | null,
    glbFile?: File | null
  ): Promise<void> {
    try {
      if (onProgress) onProgress('uploading');
      const updates = { ...updatedData, updatedAt: serverTimestamp() } as any;

      if (newFile) {
        const storageRef = ref(storage, `templates/${uid}/${templateId}.3dm`);
        await uploadBytes(storageRef, newFile);
        const downloadURL = await getDownloadURL(storageRef);
        
        updates.templatePath = downloadURL;
        updates.storagePath = storageRef.fullPath;
      }

      if (thumbnailFile) {
        const thumbRef = ref(storage, `templates/${uid}/${templateId}_thumb.webp`);
        await uploadBytes(thumbRef, thumbnailFile);
        const thumbUrl = await getDownloadURL(thumbRef);
        updates.thumbnailUrl = thumbUrl;
      }

      if (glbFile) {
        const glbRef = ref(storage, `templates/${uid}/${templateId}.glb`);
        await uploadBytes(glbRef, glbFile);
        const glbUrlParam = await getDownloadURL(glbRef);
        updates.glbUrl = glbUrlParam;
      }

      if (onProgress) onProgress('saving');

      if (sourceType === 'official') {
        const docRef = doc(db, `officialTemplates/${templateId}`);
        await setDoc(docRef, updates, { merge: true });
      } else {
        const userDocRef = doc(db, `users/${uid}/templates/${templateId}`);
        await setDoc(userDocRef, updates, { merge: true });

        if (isPublic || updatedData.isPublic) {
          const publicDocRef = doc(db, `publicTemplates/${templateId}`);
          try {
            await setDoc(publicDocRef, { ...updatedData, ...updates, id: templateId, ownerId: uid }, { merge: true });
          } catch (e) {
            console.error('Failed to update public template copy:', e);
          }
        }
      }

      if (onProgress) onProgress('success');
    } catch (error) {
      console.error('[DEBUG] Failed to update template:', error);
      if (onProgress) onProgress('error');
      throw error;
    }
  },

  async deleteTemplate(templateId: string, sourceType: 'official' | 'user' | 'public', uid: string, storagePath?: string): Promise<void> {
    try {
      // 1. Delete from Firestore
      if (sourceType === 'official') {
        await deleteDoc(doc(db, `officialTemplates/${templateId}`));
      } else {
        await deleteDoc(doc(db, `users/${uid}/templates/${templateId}`));
        try {
          await deleteDoc(doc(db, `publicTemplates/${templateId}`));
        } catch (e) {
          console.warn('Public copy might not exist or failed to delete', e);
        }
      }

      // 2. Delete from Storage if storagePath exists (user templates)
      if (storagePath) {
        try {
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn(`[DEBUG] Failed to delete file in storage (maybe already deleted or not found): ${storagePath}`, storageErr);
        }
      }
    } catch (error) {
      console.error('[DEBUG] Failed to delete template:', error);
      throw error;
    }
  }
};
