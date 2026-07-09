import { doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';

export class WorkspaceItemRepository {
  /**
   * Creates a new Master Asset in the global /assets root collection
   */
  static async createGlobalAsset(assetId: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, `assets`, assetId);
      await setDoc(docRef, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`[WorkspaceItemRepository] Created global asset ${assetId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to create global asset ${assetId}:`, err);
      throw err;
    }
  }

  /**
   * Creates a new item in the unified Firestore architecture
   */
  static async createItem(projectId: string, workspaceId: string, itemId: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, `projects/${projectId}/workspaces/${workspaceId}/items`, itemId);
      await setDoc(docRef, {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      console.log(`[WorkspaceItemRepository] Created item ${itemId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to create item ${itemId}:`, err);
      throw err;
    }
  }

  /**
   * Creates a new asset in the project
   */
  static async createAsset(projectId: string, assetId: string, data: any): Promise<void> {
    try {
      const docRef = doc(db, `projects/${projectId}/assets`, assetId);
      await setDoc(docRef, {
        ...data,
        createdAt: new Date().toISOString()
      });
      console.log(`[WorkspaceItemRepository] Created asset ${assetId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to create asset ${assetId}:`, err);
      throw err;
    }
  }

  /**
   * Updates a Master Asset in the global /assets root collection
   */
  static async updateGlobalAsset(assetId: string, data: Partial<any>): Promise<void> {
    try {
      const docRef = doc(db, `assets`, assetId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      console.log(`[WorkspaceItemRepository] Updated global asset ${assetId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to update global asset ${assetId}:`, err);
      throw err;
    }
  }

  /**
   * Deletes a Master Asset from the global /assets root collection
   */
  static async deleteGlobalAsset(assetId: string): Promise<void> {
    try {
      const docRef = doc(db, `assets`, assetId);
      await deleteDoc(docRef);
      console.log(`[WorkspaceItemRepository] Deleted global asset ${assetId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to delete global asset ${assetId}:`, err);
      throw err;
    }
  }

  /**
   * Updates an item's properties in the unified Firestore architecture
   */
  static async updateItem(projectId: string, workspaceId: string, itemId: string, data: Partial<any>): Promise<void> {
    try {
      const docRef = doc(db, `projects/${projectId}/workspaces/${workspaceId}/items`, itemId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      console.log(`[WorkspaceItemRepository] Updated item ${itemId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to update item ${itemId}:`, err);
      throw err;
    }
  }

  /**
   * Deletes an item from the unified Firestore architecture
   */
  static async deleteItem(projectId: string, workspaceId: string, itemId: string): Promise<void> {
    try {
      const docRef = doc(db, `projects/${projectId}/workspaces/${workspaceId}/items`, itemId);
      await deleteDoc(docRef);
      console.log(`[WorkspaceItemRepository] Deleted item ${itemId}`);
    } catch (err) {
      console.error(`[WorkspaceItemRepository] Failed to delete item ${itemId}:`, err);
      throw err;
    }
  }
}
