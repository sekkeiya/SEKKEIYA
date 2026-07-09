import { doc, getDoc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { db } from '../../../lib/firebase/client';
import type { PresentationWorkFile, PresentationContent } from '../types/dsp.types';


export const dspRepository = {
  /**
   * Create a new Presentation WorkFile
   */
  async createPresentationWorkFile(
    projectId: string,
    name: string,
    createdByUserId: string,
    workFileType: 'presentation' | 'canvas' = 'presentation',
    providedContent?: PresentationContent,
  ): Promise<PresentationWorkFile> {
    const parentRef = collection(db, `projects/${projectId}/workFiles`);
    const newDocRef = doc(parentRef);
    const workFileId = newDocRef.id;

    const versionsRef = collection(db, `projects/${projectId}/workFiles/${workFileId}/versions`);
    const newVersionRef = doc(versionsRef);
    const versionId = newVersionRef.id;

    const now = new Date().toISOString();

    const initialContent: PresentationContent = providedContent ?? {
      pages: [
        {
          id: `page-${Date.now()}`,
          name: 'Blank Slide',
          elements: []
        }
      ]
    };

    const newPresentation: PresentationWorkFile = {
      id: workFileId,
      projectId,
      name,
      toolType: 'other', // Base mapping
      appScope: '3dsp',
      type: workFileType,
      currentVersionId: versionId,
      latestVersionNumber: 1,
      createdAt: now,
      createdBy: createdByUserId,
      updatedAt: now,
      updatedBy: createdByUserId,
      status: 'active',
      content: initialContent
    };

    const initialVersion = {
      id: versionId,
      workFileId: workFileId,
      versionNumber: 1,
      comment: "Initial creation",
      createdAt: now,
      createdBy: createdByUserId
    };

    // Firestore rejects undefined values — strip them by round-tripping through JSON
    const sanitize = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

    const batch = writeBatch(db);
    batch.set(newDocRef, sanitize(newPresentation));
    batch.set(newVersionRef, sanitize(initialVersion));
    await batch.commit();

    return newPresentation;
  },

  /**
   * Load an existing Presentation WorkFile
   */
  async loadPresentationWorkFile(projectId: string, workFileId: string): Promise<PresentationWorkFile | null> {
    const ref = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) return null;
      return snap.data() as PresentationWorkFile;
    } catch (e) {
      console.error('[DSP] Failed to load presentation', e);
      return null;
    }
  },

  /**
   * Saves only the content and updates the modified timestamp
   */
  async savePresentationContent(projectId: string, workFileId: string, content: PresentationContent, updatedByUserId: string): Promise<void> {
    const docRef = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    try {
      await updateDoc(docRef, {
        content,
        updatedAt: new Date().toISOString(),
        updatedBy: updatedByUserId
      });
    } catch (e) {
      console.error('[DSP] Failed to save presentation content', e);
      throw e;
    }
  },

  /**
   * Updates presentation metadata (tags, name, visibility, etc.)
   */
  async updatePresentationMeta(
    projectId: string,
    workFileId: string,
    updates: { tags?: string[]; name?: string; visibility?: 'public' | 'private' },
  ): Promise<void> {
    const docRef = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    await updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
  },

  /**
   * Uploads a canvas thumbnail blob to Firebase Storage and saves the URL to Firestore.
   * Returns the download URL, or null if upload fails.
   */
  async uploadAndSaveThumbnail(projectId: string, workFileId: string, blob: Blob): Promise<string | null> {
    try {
      const storageRef = ref(storage, `projects/${projectId}/workFiles/${workFileId}/thumbnail.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const url = await getDownloadURL(storageRef);
      const docRef = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
      await updateDoc(docRef, { thumbnailUrl: url });
      return url;
    } catch (e) {
      console.error('[DSP] Thumbnail upload failed', e);
      return null;
    }
  },
};
