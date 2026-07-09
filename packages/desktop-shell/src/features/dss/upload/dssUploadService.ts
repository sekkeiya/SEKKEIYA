import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { WorkspaceItemRepository } from '../../workspace/WorkspaceItemRepository';

// Basic utility to get file extension
const getExt = (filename: string) => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

export interface DssUploadMetadata {
  title: string;
  type: string;
  category: string;
  subCategory?: string;
  tags: string[];
  dimensions?: { width: number; depth: number; height: number; } | null;
  buildingTypes?: string[];
  rooms?: string[];
  zones?: string[];
  companionClasses?: string[];
}

export const dssUploadService = {
  /**
   * Orchestrates the upload of a 3D model to Firebase Storage and registers it in Firestore
   */
  async processDesktopUpload(
    file: File,
    metadata: DssUploadMetadata,
    projectId: string,
    workspaceId: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const ext = getExt(file.name);
    // Generate a unique ID for the model (assetId and itemId)
    const modelId = crypto.randomUUID();
    
    // 1. Upload file to Storage
    const storagePath = `projects/${projectId}/assets/${modelId}/${file.name}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) onProgress(progress);
        },
        (error) => reject(error),
        () => resolve()
      );
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // 2. Create Asset Document
    await WorkspaceItemRepository.createAsset(projectId, modelId, {
      id: modelId,
      name: metadata.title,
      type: '3d-model',
      format: ext,
      sizeBytes: file.size,
      storagePath,
      downloadUrl,
      latestVersion: 1,
      versions: {
        "1": {
          downloadUrl,
          glbUrl: "",
          thumbnailUrl: "",
          createdAt: Date.now()
        }
      },
      modelType: metadata.type,
      category: metadata.category,
      subCategory: metadata.subCategory || '',
      tags: metadata.tags || [],
      dimensions: metadata.dimensions || null,
      buildingTypes: metadata.buildingTypes || [],
      rooms: metadata.rooms || [],
      zones: metadata.zones || [],
      companionClasses: metadata.companionClasses || [],
    });

    await WorkspaceItemRepository.createItem(projectId, workspaceId, modelId, {
      id: modelId,
      itemType: '3DSS',
      modelType: metadata.type,
      category: metadata.category,
      subCategory: metadata.subCategory || '',
      tags: metadata.tags || [],
      buildingTypes: metadata.buildingTypes || [],
      rooms: metadata.rooms || [],
      zones: metadata.zones || [],
      companionClasses: metadata.companionClasses || [],
      dimensions: metadata.dimensions || null,
      assetId: modelId,
      title: metadata.title,
      // For fallback compat
      name: metadata.title,
      pinnedVersion: 1,
    });

    // --- Inject 3DSS Logging here ---
    try {
      const { useAiProfileStore } = await import('../../../store/useAiProfileStore');
      useAiProfileStore.getState().logSaveDataEvent({
        userId: 'local-user',
        actionType: 'MODEL_UPLOADED_TO_WORKSPACE',
        context: {
          workspaceId: workspaceId,
          projectId: projectId,
          targetId: modelId,
          targetType: '3dss-model',
          source: 'user',
          payload: {
            targetModelName: metadata.title,
            targetCategory: metadata.category,
            targetFormat: ext
          }
        }
      });
    } catch (e) {
      console.error('Failed to log event', e);
    }
    // ---------------------------------
    return modelId;
  },

  /**
   * Pushes a new version of an existing global 3DSS asset to Firestore.
   */
  async pushNewVersion(
    assetId: string,
    file: File,
    companionGlbFile: File | null,
    thumbnailFile: File | null,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const { doc, getDoc } = await import('firebase/firestore');
    
    // 1. Fetch current asset
    const assetRef = doc(storage.app ? await import('../../../lib/firebase/client').then(m => m.db) : require('../../../lib/firebase/client').db, 'assets', assetId);
    let assetSnap;
    try {
      const { db } = await import('../../../lib/firebase/client');
      assetSnap = await getDoc(doc(db, 'assets', assetId));
    } catch(e) {
       console.error("Failed to fetch asset", e);
       throw e;
    }

    if (!assetSnap?.exists()) throw new Error('Asset not found');
    const assetData = assetSnap.data();

    // Determine new version number
    const newVersionNum = (assetData.latestVersion || 1) + 1;
    const storageDir = `assets/${assetId}/v${newVersionNum}`;
    
    // 🔥 Firebase Storage Rules (`assets/{assetId}/**`) requires `ownerId` in metadata!
    const auth = await import('firebase/auth').then(m => m.getAuth());
    const ownerId = auth.currentUser?.uid || assetData.authorId || assetData.ownerId;
    const uploadMetadata: any = { customMetadata: { parentAsset: assetId, version: String(newVersionNum), ownerId } };

    // 2. Upload primary file
    const primaryStoragePath = `${storageDir}/${file.name}`;
    const primaryStorageRef = ref(storage, primaryStoragePath);
    const primaryUploadTask = uploadBytesResumable(primaryStorageRef, file, uploadMetadata);

    await new Promise<void>((resolve, reject) => {
      primaryUploadTask.on(
        'state_changed',
        (snap) => { if (onProgress) onProgress((snap.bytesTransferred / snap.totalBytes) * 40); },
        reject,
        resolve
      );
    });
    const primaryDownloadUrl = await getDownloadURL(primaryStorageRef);

    // 3. Upload GLB if present
    let uploadedGlbUrl = assetData.glbUrl || ""; // default to keep old if not provided
    if (companionGlbFile) {
      const glbPath = `${storageDir}/${companionGlbFile.name}`;
      const glbRef = ref(storage, glbPath);
      const glbTask = uploadBytesResumable(glbRef, companionGlbFile, uploadMetadata);
      await new Promise<void>((resolve, reject) => glbTask.on('state_changed', (snap) => { if(onProgress) onProgress(40 + (snap.bytesTransferred/snap.totalBytes)*30) }, reject, resolve));
      uploadedGlbUrl = await getDownloadURL(glbRef);
    }

    // 4. Upload Thumbnail if present
    let uploadedThumbUrl = assetData.thumbnailUrl || "";
    if (thumbnailFile) {
      const thumbPath = `${storageDir}/${thumbnailFile.name}`;
      const thumbRef = ref(storage, thumbPath);
      const thumbTask = uploadBytesResumable(thumbRef, thumbnailFile, uploadMetadata);
      await new Promise<void>((resolve, reject) => thumbTask.on('state_changed', (snap) => { if(onProgress) onProgress(70 + (snap.bytesTransferred/snap.totalBytes)*30) }, reject, resolve));
      uploadedThumbUrl = await getDownloadURL(thumbRef);
    }

    // 5. Update Firestore
    const existingVersions = assetData.versions || { "1": { downloadUrl: assetData.downloadUrl, glbUrl: assetData.glbUrl, thumbnailUrl: assetData.thumbnailUrl, createdAt: assetData.createdAt } };
    if (existingVersions["1"] && existingVersions["1"].thumbnailUrl === undefined) {
      existingVersions["1"].thumbnailUrl = assetData.thumbnailUrl || "";
    }

    const newVersionsMap = {
      ...existingVersions,
      [String(newVersionNum)]: {
        downloadUrl: primaryDownloadUrl,
        glbUrl: uploadedGlbUrl,
        thumbnailUrl: uploadedThumbUrl,
        createdAt: Date.now()
      }
    };

    await WorkspaceItemRepository.updateGlobalAsset(assetId, {
      latestVersion: newVersionNum,
      versions: newVersionsMap,
      // For backwards compatibility:
      downloadUrl: primaryDownloadUrl,
      storagePath: primaryStoragePath,
      glbUrl: uploadedGlbUrl,
      thumbnailUrl: uploadedThumbUrl,
      sizeBytes: file.size,
      sizeGlb: companionGlbFile ? companionGlbFile.size : assetData.sizeGlb
    });
  },

  async deleteVersion(assetId: string, versionId: number): Promise<void> {
    const { doc, getDoc, updateDoc, deleteField } = await import('firebase/firestore');
    const { db } = await import('../../../lib/firebase/client');
    const assetRef = doc(db, 'assets', assetId);
    
    const snap = await getDoc(assetRef);
    if (!snap.exists()) throw new Error("Asset not found");
    const data = snap.data();
    
    const versionsMap = data.versions || {};
    const versionKeys = Object.keys(versionsMap).map(Number);
    
    if (versionKeys.length <= 1) {
      throw new Error("最後のバージョンは削除できません。モデル自体を削除してください。");
    }

    const versionData = versionsMap[versionId];

    const updates: any = {
      [`versions.${versionId}`]: deleteField()
    };

    // If deleting the latestVersion, we must pick the new highest version
    if (data.latestVersion === versionId || !data.latestVersion) {
      const remainingKeys = versionKeys.filter(k => k !== versionId);
      const newLatest = Math.max(...remainingKeys);
      updates.latestVersion = newLatest;
      
      const newLatestData = versionsMap[newLatest];
      if (newLatestData) {
        if (newLatestData.downloadUrl) updates.downloadUrl = newLatestData.downloadUrl;
        if (newLatestData.glbUrl) updates.glbUrl = newLatestData.glbUrl;
        if (newLatestData.thumbnailUrl) updates.thumbnailUrl = newLatestData.thumbnailUrl;
      }
    }

    await updateDoc(assetRef, updates);

    // After successful Firestore update, delete the associated files from Firebase Storage
    if (versionData) {
      const urlsToDelete = [versionData.downloadUrl, versionData.glbUrl, versionData.thumbnailUrl].filter(Boolean);
      for (const url of urlsToDelete) {
        try {
          // Firebase Storage ref() supports taking a full HTTPS download URL
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
          console.log(`[Storage] Deleted file for version ${versionId}:`, url);
        } catch (e) {
          console.warn(`[Storage] Failed to delete file for version ${versionId} at ${url}:`, e);
        }
      }
    }
  },

  async deleteVersions(assetId: string, versionIds: number[]): Promise<void> {
    if (!versionIds.length) return;
    
    const { doc, getDoc, updateDoc, deleteField } = await import('firebase/firestore');
    const { db } = await import('../../../lib/firebase/client');
    const assetRef = doc(db, 'assets', assetId);
    
    const snap = await getDoc(assetRef);
    if (!snap.exists()) throw new Error("Asset not found");
    const data = snap.data();
    
    const versionsMap = data.versions || {};
    let versionKeys = Object.keys(versionsMap).map(Number);
    
    // Ensure we don't delete all versions
    const remainingKeys = versionKeys.filter(k => !versionIds.includes(k));
    if (remainingKeys.length === 0) {
      throw new Error("すべてのバージョンを削除することはできません。モデル自体を削除してください。");
    }

    const updates: any = {};
    const deletedVersionsData: any[] = [];

    for (const vid of versionIds) {
      if (versionsMap[vid]) {
        updates[`versions.${vid}`] = deleteField();
        deletedVersionsData.push({ versionId: vid, data: versionsMap[vid] });
      }
    }

    // If deleting the latestVersion, we must pick the new highest version from remaining
    if (!data.latestVersion || versionIds.includes(data.latestVersion)) {
      const newLatest = Math.max(...remainingKeys);
      updates.latestVersion = newLatest;
      
      const newLatestData = versionsMap[newLatest];
      if (newLatestData) {
        if (newLatestData.downloadUrl) updates.downloadUrl = newLatestData.downloadUrl;
        if (newLatestData.glbUrl) updates.glbUrl = newLatestData.glbUrl;
        if (newLatestData.thumbnailUrl) updates.thumbnailUrl = newLatestData.thumbnailUrl;
      }
    }

    // Update Firestore
    await updateDoc(assetRef, updates);

    // After successful Firestore update, delete associated files from Firebase Storage concurrently
    const { deleteObject } = await import('firebase/storage');
    
    const deletePromises = deletedVersionsData.flatMap((item) => {
      const urlsToDelete = [item.data.downloadUrl, item.data.glbUrl, item.data.thumbnailUrl].filter(Boolean);
      return urlsToDelete.map(async (url) => {
        try {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
          console.log(`[Storage] Deleted file for version ${item.versionId}:`, url);
        } catch (e) {
          console.warn(`[Storage] Failed to delete file for version ${item.versionId} at ${url}:`, e);
        }
      });
    });

    await Promise.allSettled(deletePromises);
  }
};
