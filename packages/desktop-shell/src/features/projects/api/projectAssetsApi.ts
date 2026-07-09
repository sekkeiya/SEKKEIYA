import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import type { ProjectAssetDoc } from '../types';
import { getProjectAssetsColRef, getProjectAssetRef } from '../../dsl/layout/paths/workspacePaths';
import { getDownloadUrlForModel } from '../../dss/utils/modelUtils';

/**
 * 3DSS Assets CRUD API
 * Handles the unified project assets library (Phase 12 Architecture)
 */

export const projectAssetsApi = {
  /**
   * Fetch all active assets for a project
   */
  async getAssets(projectId: string): Promise<(ProjectAssetDoc & { id: string })[]> {
    const colRef = getProjectAssetsColRef({ projectId });
    if (!colRef) return [];

    const q = query(colRef, where('status', '!=', 'archived'));
    const snapshot = await getDocs(q);

    const assets = snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as ProjectAssetDoc)
    }));
    
    // Resolve missing thumbnails dynamically
    const enrichedAssets = await Promise.all(assets.map(async (asset) => {
      const hasThumb = asset.thumbnailUrl || asset.metadata?.thumbnailUrl || (asset as any).thumbUrl || (asset as any).coverUrl;
      if (!hasThumb && asset.entityId) {
        try {
          const globalAssetSnap = await getDoc(doc(db, "assets", asset.entityId));
          if (globalAssetSnap.exists()) {
            const data = globalAssetSnap.data();
            return {
              ...asset,
              thumbnailUrl: data.thumbUrl || data.coverUrl || data.thumbnailUrl || ''
            };
          }
        } catch (e) {
          console.warn("[projectAssetsApi] Failed to resolve global asset for thumbnail:", e);
        }
      }
      return asset;
    }));

    return enrichedAssets;
  },

  /**
   * Create a new project asset
   */
  async createAsset(projectId: string, assetData: Omit<ProjectAssetDoc, 'createdAt'>): Promise<string> {
    const colRef = getProjectAssetsColRef({ projectId });
    if (!colRef) throw new Error("Invalid project ID");

    const newDocRef = doc(colRef);
    const payload: ProjectAssetDoc = {
      ...assetData,
      status: assetData.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(newDocRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return newDocRef.id;
  },

  /**
   * Find an existing project asset by its original source model ID
   * Used to prevent duplicating public models in the project library
   */
  async findAssetBySourceModelId(projectId: string, sourceModelId: string): Promise<{id: string, status: string} | null> {
    const colRef = getProjectAssetsColRef({ projectId });
    if (!colRef) return null;

    const q = query(colRef, where('metadata.sourceModelId', '==', sourceModelId), limit(1));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      status: doc.data().status || 'active'
    };
  },

  /**
   * Update an existing project asset
   */
  async updateAsset(projectId: string, assetId: string, updates: Partial<ProjectAssetDoc>): Promise<void> {
    const docRef = getProjectAssetRef({ projectId, assetId });
    if (!docRef) throw new Error("Invalid project or asset ID");

    const payload = {
      ...updates,
      updatedAt: serverTimestamp()
    };

    await updateDoc(docRef, payload);
  },

  /**
   * Soft delete an asset (sets status to archived)
   * We avoid hard deletes to preserve integrity for existing layouts
   */
  async softDeleteAsset(projectId: string, assetId: string): Promise<void> {
    const docRef = getProjectAssetRef({ projectId, assetId });
    if (!docRef) throw new Error("Invalid project or asset ID");

    await updateDoc(docRef, {
      status: 'archived',
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Hard Delete (Only use if verified no layouts are using this asset)
   */
  async hardDeleteAsset(projectId: string, assetId: string): Promise<void> {
    const docRef = getProjectAssetRef({ projectId, assetId });
    if (!docRef) throw new Error("Invalid project or asset ID");
    
    await deleteDoc(docRef);
  },

  /**
   * Save a global model/asset into a project check-and-create style.
   * Prevents duplicates by checking sourceModelId first.
   */
  async saveAssetToProject(projectId: string, model: any, userId: string = 'unknown'): Promise<string> {
    const existingAsset = await this.findAssetBySourceModelId(projectId, model.id);
    
    let resolvedModelUrl = getDownloadUrlForModel(model, 'glb') || model.modelUrl || model.metadata?.modelUrl || '';
    let targetFiles = model.files || model.metadata?.files || null;

    let sourceAsset = model;
    try {
      const sourceDoc = await getDoc(doc(db, 'assets', model.id));
      if (sourceDoc.exists()) {
        sourceAsset = sourceDoc.data();
      }
    } catch (e) {
      console.warn('Failed to fetch source asset for metadata copying:', e);
    }

    if (existingAsset) {
      const finalAssetId = existingAsset.id;
      if (!resolvedModelUrl && existingAsset.modelUrl) {
        resolvedModelUrl = existingAsset.modelUrl;
      }
      
      const dims = model.dimensions || model.metadata?.dimensions || existingAsset.metadata?.dimensions;

      const thumbnailUrl =
        model?.metadata?.thumbnailFilePath?.url ||
        model?.metadata?.thumbnailUrl ||
        model?.metadata?.thumbnail?.url ||
        model?.thumbnailFilePath?.url ||
        model?.thumbnailUrl ||
        model?.thumbnail?.url ||
        model?.imageUrl ||
        model?.previewUrl ||
        model?.thumbUrl ||
        model?.coverUrl ||
        '';

      const updatedMetadata = {
        ...(existingAsset.metadata || {}),
        size: model.size || model.sizeBytes || model.originalFileSize || existingAsset.metadata?.size || null,
        files: targetFiles || existingAsset.metadata?.files || null,
        size3dm: model.size3dm || existingAsset.metadata?.size3dm || null,
        sizeGlb: model.sizeGlb || existingAsset.metadata?.sizeGlb || null,
        sizeBlend: model.sizeBlend || existingAsset.metadata?.sizeBlend || null,
        ext: model.ext || existingAsset.metadata?.ext || null,
        format: model.format || existingAsset.metadata?.format || null,
      };
      
      if (dims) {
        updatedMetadata.dimensions = dims;
      }

      const updatePayload: any = { 
        modelUrl: resolvedModelUrl,
        thumbnailUrl: thumbnailUrl || existingAsset.thumbnailUrl || '',
        metadata: updatedMetadata,
        updatedAt: new Date().toISOString(),
        extendedMetadata: sourceAsset.extendedMetadata ?? null,
        buildingTypes: sourceAsset.buildingTypes ?? [],
        rooms: sourceAsset.rooms ?? [],
        zones: sourceAsset.zones ?? [],
        tags: sourceAsset.tags ?? [],
      };
      if (existingAsset.status === 'archived') {
        updatePayload.status = 'active';
      }
      await this.updateAsset(projectId, finalAssetId, updatePayload);
      return finalAssetId;
    } else {
      const thumbnailUrl =
        model?.metadata?.thumbnailFilePath?.url ||
        model?.metadata?.thumbnailUrl ||
        model?.metadata?.thumbnail?.url ||
        model?.thumbnailFilePath?.url ||
        model?.thumbnailUrl ||
        model?.thumbnail?.url ||
        model?.imageUrl ||
        model?.previewUrl ||
        model?.thumbUrl ||
        model?.coverUrl ||
        '';

      const assetData: any = {
        itemType: model.category || 'model',
        name: model.title || model.name || 'Untitled',
        modelUrl: resolvedModelUrl,
        thumbnailUrl: thumbnailUrl,
        entityId: model.id,
        sourceModelId: model.id,
        metadata: {
          sourceModelId: model.id,
          sourceType: '3dss',
          size: model.size || model.sizeBytes || model.originalFileSize || null,
          files: targetFiles,
          size3dm: model.size3dm || null,
          sizeGlb: model.sizeGlb || null,
          sizeBlend: model.sizeBlend || null,
          ext: model.ext || null,
          format: model.format || null,
        },
        addedBy: userId,
        createdBy: userId,
        status: 'active',
        extendedMetadata: sourceAsset.extendedMetadata ?? null,
        buildingTypes: sourceAsset.buildingTypes ?? [],
        rooms: sourceAsset.rooms ?? [],
        zones: sourceAsset.zones ?? [],
        tags: sourceAsset.tags ?? [],
      };
      
      const dims = model.dimensions || model.metadata?.dimensions;
      if (dims) {
        assetData.metadata.dimensions = dims;
      }

      const newAssetId = await this.createAsset(projectId, assetData);
      return newAssetId;
    }
  }
};
