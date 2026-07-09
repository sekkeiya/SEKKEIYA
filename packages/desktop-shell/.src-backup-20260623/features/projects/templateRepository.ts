import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../../lib/firebase/client';
import type { RhinoTemplate, UploadStatus } from './types';

const MOCK_OFFICIAL_TEMPLATES: RhinoTemplate[] = [
  {
    id: 'tpl-off-1',
    name: 'Architecture - Millimeters',
    description: '標準的な建築スケールのモデリングに適したテンプレートです。',
    sourceType: 'official',
    ownerName: 'SEKKEIYA',
    rhinoVersion: 8,
    unitSystem: 'mm',
    category: 'Architecture',
    tags: ['standard', 'architecture'],
    isPublic: true,
    templatePath: 'C:\\Program Files\\Rhino 8\\System\\Default.3dm',
    isMock: false,
    usageCount: 1250,
    toolType: 'rhino'
  },
  {
    id: 'tpl-off-2',
    name: 'Blender - General',
    description: '標準的なBlenderのスタートアップファイルです。',
    sourceType: 'official',
    ownerName: 'SEKKEIYA',
    category: 'Default',
    tags: ['standard', 'general', 'blender'],
    isPublic: true,
    templatePath: 'startup.blend',
    isMock: false,
    usageCount: 840,
    toolType: 'blender'
  }
];

export const TemplateRepository = {
  async getTemplates(uid?: string): Promise<RhinoTemplate[]> {
    try {
      const templatesMap = new Map<string, RhinoTemplate>();

      MOCK_OFFICIAL_TEMPLATES.forEach(t => templatesMap.set(t.id, t));
      
      try {
        const offSnap = await getDocs(collection(db, 'officialTemplates'));
        offSnap.forEach(d => templatesMap.set(d.id, d.data() as RhinoTemplate));
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
      if (results.length === 0) return [...MOCK_OFFICIAL_TEMPLATES];
      
      return results;
    } catch (error) {
      console.error('Failed to fetch templates', error);
      return [...MOCK_OFFICIAL_TEMPLATES];
    }
  },

  async saveTemplate(
    template: RhinoTemplate, 
    file: File, 
    uid: string, 
    onProgress?: (status: UploadStatus) => void,
    thumbnailFile?: File | null,
    glbFile?: File | null
  ): Promise<void> {
    try {
      if (onProgress) onProgress('uploading');
      
      const storageRef = ref(storage, `templates/${uid}/${template.id}.3dm`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      const fullPath = storageRef.fullPath;

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
        storagePath: fullPath,
        thumbnailUrl: thumbUrl || template.thumbnailUrl || undefined,
        glbUrl: glbUrlParam || template.glbUrl || undefined,
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
