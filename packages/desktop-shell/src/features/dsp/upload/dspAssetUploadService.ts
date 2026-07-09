import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../../lib/firebase/client';
import { projectAssetsApi } from '../../projects/api/projectAssetsApi';
import { v4 as uuidv4 } from 'uuid';

export const dspAssetUploadService = {
  /**
   * Uploads a local file to Firebase Storage and creates a corresponding Project Asset.
   * Returns the asset ID, download URL, and other metadata for 3DSP usage.
   */
  async uploadLocalImage(projectId: string, file: File, userId: string): Promise<{ assetId: string, src: string, storagePath: string, mimeType: string, name: string }> {
    if (!projectId || !file) {
      throw new Error('Project ID and file are required.');
    }

    const assetId = uuidv4();
    const ext = file.name.split('.').pop() || 'png';
    // Use the standard project assets path in storage
    const storagePath = `projects/${projectId}/assets/${assetId}/primary.${ext}`;
    const storageRef = ref(storage, storagePath);

    // Upload to Firebase Storage
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        originalName: file.name,
        uploaderId: userId,
        projectId
      }
    });

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Progress can be monitored here if needed
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`[dspAssetUploadService] Upload is ${progress}% done`);
        },
        (error) => {
          console.error('[dspAssetUploadService] Upload failed:', error);
          reject(error);
        },
        async () => {
          try {
            // Upload completed successfully
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

            // Create Project Asset Reference in Firestore using existing projectAssetsApi
            const assetData = {
              itemType: 'image',
              name: file.name,
              thumbnailUrl: downloadUrl, // Image itself acts as thumbnail
              modelUrl: downloadUrl, // Primary source
              entityId: assetId,
              sourceModelId: assetId,
              addedBy: userId,
              createdBy: userId,
              status: 'active',
              metadata: {
                sourceType: 'local_upload',
                size: file.size,
                ext,
                format: file.type,
                storagePath
              }
            };

            await projectAssetsApi.createAsset(projectId, assetData as any);

            resolve({
              assetId,
              src: downloadUrl,
              storagePath,
              mimeType: file.type,
              name: file.name
            });
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  }
};
