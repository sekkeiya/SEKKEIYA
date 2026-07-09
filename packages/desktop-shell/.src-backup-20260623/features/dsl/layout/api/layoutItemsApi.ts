import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@desktop/lib/firebase/client';
import type { LayoutItemDoc, ProjectAssetDoc } from '@desktop/features/projects/types';
import { 
  getLayoutItemsColRef, 
  getLayoutItemRef,
  getProjectAssetsColRef 
} from '@desktop/features/dsl/layout/paths/workspacePaths';

/**
 * 3DSL Layout Items CRUD API
 * Handles lightweight placement instances within a layout plan.
 */
export const layoutItemsApi = {
  /**
   * Fetch all layout instances for a specific plan
   */
  async getItems(projectId: string, workspaceId: string, planId: string): Promise<(LayoutItemDoc & { id: string })[]> {
    const colRef = getLayoutItemsColRef({ projectId, workspaceId, planId });
    if (!colRef) return [];

    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...(doc.data() as LayoutItemDoc)
    }));
  },

  /**
   * Create a layout instance (referencing an existing Project Asset)
   */
  async createItem(
    projectId: string, 
    workspaceId: string, 
    planId: string, 
    itemData: Omit<LayoutItemDoc, 'createdAt'>
  ): Promise<string> {
    const colRef = getLayoutItemsColRef({ projectId, workspaceId, planId });
    if (!colRef) throw new Error("Invalid parameters for layout item");

    const newDocRef = doc(colRef);
    const payload: LayoutItemDoc = {
      ...itemData,
      createdAt: new Date().toISOString()
    };

    await setDoc(newDocRef, {
      ...payload,
      createdAt: serverTimestamp()
    });

    return newDocRef.id;
  },

  /**
   * Update the spatial transform of an existing layout item
   */
  async updateItemTransform(
    projectId: string, 
    workspaceId: string, 
    planId: string, 
    itemId: string, 
    transform: LayoutItemDoc['transform']
  ): Promise<void> {
    const docRef = getLayoutItemRef({ projectId, workspaceId, planId, itemId });
    if (!docRef) throw new Error("Invalid parameters for layout item update");

    await updateDoc(docRef, { transform });
  },

  /**
   * Delete a layout instance
   * Safe to delete hard, as it doesn't affect the original Project Asset.
   */
  async deleteItem(
    projectId: string, 
    workspaceId: string, 
    planId: string, 
    itemId: string
  ): Promise<void> {
    const docRef = getLayoutItemRef({ projectId, workspaceId, planId, itemId });
    if (!docRef) throw new Error("Invalid parameters for layout item deletion");

    await deleteDoc(docRef);
  },

  /**
   * [Phase 12 Sync]
   * Batch Operation: Register an entirely new external model to the Project Asset Library, 
   * and immediately spawn a layout instance of it.
   */
  async addExternalModelToLayoutBatch({
    projectId,
    workspaceId,
    planId,
    assetData,
    transform,
    userId
  }: {
    projectId: string;
    workspaceId: string;
    planId: string;
    assetData: Omit<ProjectAssetDoc, 'createdAt' | 'addedBy'>;
    transform: LayoutItemDoc['transform'];
    userId: string;
  }): Promise<{ assetId: string; itemId: string }> {
    const assetsColRef = getProjectAssetsColRef({ projectId });
    const itemsColRef = getLayoutItemsColRef({ projectId, workspaceId, planId });

    if (!assetsColRef || !itemsColRef) {
      throw new Error("Invalid project/workspace paths for batch operation");
    }

    const batch = writeBatch(db);

    // 1. Prepare new Asset Doc
    const assetRef = doc(assetsColRef);
    const assetPayload: ProjectAssetDoc = {
      ...assetData,
      addedBy: userId,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    
    // Server timestamps for safety
    batch.set(assetRef, {
      ...assetPayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    // 2. Prepare new Layout Item Doc
    const itemRef = doc(itemsColRef);
    const itemPayload: LayoutItemDoc = {
      itemType: assetData.itemType,
      assetId: assetRef.id,
      transform,
      visible: true,
      addedBy: userId,
      pinnedVersion: 1,
      createdAt: new Date().toISOString()
    };

    batch.set(itemRef, {
      ...itemPayload,
      createdAt: serverTimestamp()
    });

    // 3. Commit atomically
    await batch.commit();

    return {
      assetId: assetRef.id,
      itemId: itemRef.id
    };
  }
};
