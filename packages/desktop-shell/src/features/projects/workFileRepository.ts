import { doc, setDoc, getDocs, collection, query, orderBy, limit, writeBatch, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { db, storage } from '../../lib/firebase/client';
import type { WorkFile, ProjectActivity, WorkFileVersion } from './types';

/**
 * Repository for tracking shared Work Files and their Activities within a Project (Board).
 * Phase 1 mappings: 'projectId' maps to Firestore 'boards' doc IDs.
 */
export const WorkFileRepository = {
  /**
   * Get all Work Files for a specific project
   */
  async getWorkFiles(projectId: string): Promise<WorkFile[]> {
    try {
      const q = query(collection(db, `projects/${projectId}/workFiles`), orderBy('updatedAt', 'desc'));
      const snap = await getDocs(q);
      const files = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkFile));
      return files.filter(f => !f.isDeleted);
    } catch (e) {
      console.error('[DEBUG] Failed to get WorkFiles:', e);
      return [];
    }
  },

  /**
   * Get all versions for a specific Work File
   */
  async getVersions(projectId: string, workFileId: string): Promise<WorkFileVersion[]> {
    try {
      const q = query(
        collection(db, `projects/${projectId}/workFiles/${workFileId}/versions`),
        orderBy('versionNumber', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkFileVersion));
    } catch (e) {
      console.error('[DEBUG] Failed to get WorkFile Versions:', e);
      return [];
    }
  },

  /**
   * Get all Activities for a specific project
   */
  async getActivities(projectId: string): Promise<ProjectActivity[]> {
    try {
      const q = query(collection(db, `projects/${projectId}/activities`), orderBy('createdAt', 'desc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectActivity));
    } catch (e) {
      console.error('[DEBUG] Failed to get Activities:', e);
      return [];
    }
  },

  /**
   * Create a new Work File and its initial version
   */
  async createWorkFile(workFile: Omit<WorkFile, 'id' | 'createdAt' | 'updatedAt' | 'latestVersionNumber' | 'currentVersionId'>): Promise<WorkFile> {
    const parentRef = collection(db, `projects/${workFile.projectId}/workFiles`);
    const newId = doc(parentRef).id;
    const ref = doc(db, `projects/${workFile.projectId}/workFiles/${newId}`);
    
    const versionsRef = collection(db, `projects/${workFile.projectId}/workFiles/${newId}/versions`);
    const newVersionId = doc(versionsRef).id;

    const now = new Date().toISOString();
    
    const finalDoc: WorkFile = {
      ...workFile,
      id: newId,
      currentVersionId: newVersionId,
      latestVersionNumber: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
    };

    const initialVersion: WorkFileVersion = {
      id: newVersionId,
      workFileId: newId,
      versionNumber: 1,
      comment: "Initial creation",
      createdAt: now,
      createdBy: workFile.createdBy,
    };

    const batch = writeBatch(db);
    batch.set(ref, finalDoc);
    batch.set(doc(versionsRef, newVersionId), initialVersion);
    batch.update(doc(db, `projects/${workFile.projectId}`), { updatedAt: serverTimestamp() });
    await batch.commit();

    return finalDoc;
  },

  /**
   * Upload a new Work File mapping (Uint8Array) directly to Storage + Firestore
   */
  async commitNewWorkFile({ projectId, fileData, fileName, toolType, createdByUserId }: {
    projectId: string;
    fileData: Uint8Array;
    fileName: string;
    toolType: string;
    createdByUserId: string;
  }, onProgress?: (progress: number) => void): Promise<WorkFile> {
    const parentRef = collection(db, `projects/${projectId}/workFiles`);
    const newDocRef = doc(parentRef);
    const workFileId = newDocRef.id;

    const extension = fileName.split('.').pop() || "bin";
    const storagePath = `workFiles/${projectId}/${workFileId}/v1_${Date.now()}.${extension}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, fileData);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const versionsRef = collection(db, `projects/${projectId}/workFiles/${workFileId}/versions`);
            const newVersionRef = doc(versionsRef);
            const versionId = newVersionRef.id;
            
            const now = new Date().toISOString();

            const finalDoc: WorkFile = {
              id: workFileId,
              projectId,
              name: fileName,
              toolType: toolType as any,
              currentVersionId: versionId,
              latestVersionNumber: 1,
              updatedAt: now,
              updatedBy: createdByUserId,
              status: 'active',
              thumbnailUrl: null,
              storagePath: storagePath,
              lastOpenedAt: null,
              createdAt: now,
              createdBy: createdByUserId,
              size: fileData.byteLength
            };

            const initialVersion: WorkFileVersion = {
              id: versionId,
              workFileId: workFileId,
              versionNumber: 1,
              comment: "Initial upload",
              storagePath: storagePath,
              createdAt: now,
              createdBy: createdByUserId,
              size: fileData.byteLength
            };

            const activitiesRef = collection(db, `projects/${projectId}/activities`);
            const newActivityRef = doc(activitiesRef);
            const initialActivity = {
              id: newActivityRef.id,
              projectId,
              type: "work_file_created",
              targetType: "workFile",
              targetId: workFileId,
              userId: createdByUserId,
              meta: { toolType, fileName },
              createdAt: now
            };

            const batch = writeBatch(db);
            batch.set(newDocRef, finalDoc);
            batch.set(newVersionRef, initialVersion);
            batch.set(newActivityRef, initialActivity);
            batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
            await batch.commit();

            resolve(finalDoc);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  },

  /**
   * Upload a new version of an existing Work File to Storage + Firestore
   */
  async commitNewVersion({ projectId, workFileId, fileData, fileName, comment, createdByUserId }: {
    projectId: string;
    workFileId: string;
    fileData: Uint8Array;
    fileName: string;
    comment: string;
    createdByUserId: string;
  }, onProgress?: (progress: number) => void): Promise<WorkFileVersion> {
    const workFileRef = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    let currentVersionNum = 0;
    
    try {
      await runTransaction(db, async (t) => {
        const docSnap = await t.get(workFileRef);
        if (!docSnap.exists()) throw new Error("WorkFile not found");
        currentVersionNum = docSnap.data().latestVersionNumber || 0;
      });
    } catch (e) {
      throw new Error("Could not fetch WorkFile metadata");
    }

    const nextVersionNumber = currentVersionNum + 1;
    const extension = fileName.split('.').pop() || "bin";
    const storagePath = `workFiles/${projectId}/${workFileId}/v${nextVersionNumber}_${Date.now()}.${extension}`;
    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(storageRef, fileData);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        async () => {
          try {
            const versionsRef = collection(db, `projects/${projectId}/workFiles/${workFileId}/versions`);
            const newVersionRef = doc(versionsRef);
            const versionId = newVersionRef.id;
            const now = new Date().toISOString();

            const newVersion: WorkFileVersion = {
              id: versionId,
              workFileId: workFileId,
              versionNumber: nextVersionNumber,
              comment: comment,
              storagePath: storagePath,
              createdAt: now,
              createdBy: createdByUserId,
              size: fileData.byteLength
            };

            const activitiesRef = collection(db, `projects/${projectId}/activities`);
            const newActivityRef = doc(activitiesRef);
            const newActivity = {
              id: newActivityRef.id,
              projectId,
              type: "work_file_version_created",
              targetType: "workFile",
              targetId: workFileId,
              userId: createdByUserId,
              meta: { fileName, versionNumber: nextVersionNumber },
              createdAt: now
            };

            const batch = writeBatch(db);
            batch.set(newVersionRef, newVersion);
            batch.update(workFileRef, {
              currentVersionId: versionId,
              latestVersionNumber: nextVersionNumber,
              updatedAt: now,
              updatedBy: createdByUserId,
              storagePath: storagePath,
              size: fileData.byteLength
            });
            batch.set(newActivityRef, newActivity);
            batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
            await batch.commit();

            resolve(newVersion);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  },

  /**
   * Update an existing Work File (e.g. updatedAt, lastOpenedAt when opened)
   */
  async updateWorkFileTime(projectId: string, workFileId: string, updatedByUserId: string): Promise<void> {
    const ref = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    const now = new Date().toISOString();
    
    try {
      const batch = writeBatch(db);
      batch.update(ref, {
        updatedAt: now,
        lastOpenedAt: now,
        updatedBy: updatedByUserId
      });
      batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (e) {
      console.error('[DEBUG] Failed to update WorkFile timestamp:', e);
    }
  },

  /**
   * Get the direct download URL from Firebase Storage path
   */
  async getStorageDownloadUrl(storagePath: string): Promise<string> {
    const { getDownloadURL } = await import('firebase/storage');
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  },

  /**
   * Upload and update preview assets (thumbnail and/or GLB) for a WorkFile silently 
   * without creating a new version.
   */
  async updateWorkFilePreviewAssets({
    projectId,
    workFileId,
    thumbnailFile,
    glbFile
  }: {
    projectId: string;
    workFileId: string;
    thumbnailFile?: File | null;
    glbFile?: File | null;
  }): Promise<void> {
    const updates: Partial<WorkFile> = {};
    const timestamp = Date.now();

    try {
      if (thumbnailFile) {
        const thumbRef = ref(storage, `workFiles/${projectId}/${workFileId}/preview_thumb.webp`);
        await uploadBytes(thumbRef, thumbnailFile);
        const rawUrl = await getDownloadURL(thumbRef);
        updates.thumbnailUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${timestamp}`;
      }

      if (glbFile) {
        const glbRef = ref(storage, `workFiles/${projectId}/${workFileId}/preview.glb`);
        await uploadBytes(glbRef, glbFile);
        const rawUrl = await getDownloadURL(glbRef);
        updates.glbUrl = `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}v=${timestamp}`;
      }

      if (Object.keys(updates).length > 0) {
        const refDoc = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
        updates.updatedAt = new Date().toISOString(); // Force firestore event
        
        const batch = writeBatch(db);
        batch.update(refDoc, updates);
        batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
        await batch.commit();
      }
    } catch (e) {
      console.error('[DEBUG] Failed to update WorkFile preview assets:', e);
      throw e;
    }
  },

  /**
   * Update properties of a Work File (e.g. name, status)
   */
  async updateWorkFile(projectId: string, workFileId: string, updates: Partial<WorkFile>): Promise<void> {
    const ref = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    try {
      const batch = writeBatch(db);
      batch.update(ref, {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (e) {
      console.error('[DEBUG] Failed to update WorkFile:', e);
      throw e;
    }
  },

  /**
   * Delete a Work File permanently (Firestore + Storage)
   */
  async deleteWorkFile(projectId: string, workFileId: string): Promise<void> {
    const docRef = doc(db, `projects/${projectId}/workFiles/${workFileId}`);
    try {
      // 1. Delete from Storage
      const storageRef = ref(storage, `workFiles/${projectId}/${workFileId}`);
      try {
        const listResult = await listAll(storageRef);
        const deletePromises = listResult.items.map(item => deleteObject(item));
        await Promise.all(deletePromises);
      } catch (storageErr) {
        console.warn('[DEBUG] Failed to delete Storage files for WorkFile (might not exist):', storageErr);
      }
      
      // 2. Delete versions subcollection (Best effort, usually functions handle this, but let's delete up to 50 versions)
      try {
        const versionsQ = query(collection(db, `projects/${projectId}/workFiles/${workFileId}/versions`), limit(50));
        const vSnap = await getDocs(versionsQ);
        const batch = writeBatch(db);
        vSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (e) {
        console.warn('[DEBUG] Failed to delete versions subcollection:', e);
      }

      // 3. Delete from Firestore and touch project
      const batch = writeBatch(db);
      batch.delete(docRef);
      batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });
      await batch.commit();
    } catch (e) {
      console.error('[DEBUG] Failed to delete WorkFile:', e);
      throw e;
    }
  },

  /**
   * Log a recent activity to the project workspace
   */
  async logActivity(activity: Omit<ProjectActivity, 'id' | 'createdAt'>): Promise<void> {
    const parentRef = collection(db, `projects/${activity.projectId}/activities`);
    const newId = doc(parentRef).id;
    const ref = doc(db, `projects/${activity.projectId}/activities/${newId}`);
    
    const finalDoc: ProjectActivity = {
      ...activity,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(ref, finalDoc);
    } catch (e) {
      console.error('[DEBUG] Failed to log ProjectActivity:', e);
    }
  }
};
