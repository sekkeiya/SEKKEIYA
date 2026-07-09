import { collection, query, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

export interface WorkspaceItemSummary {
  modelCount: number;
  layoutCount: number;
  documentCount: number;
}

// In unified schema v2, items belong to /projects/{projectId}/workspaces/main/items
export const fetchWorkspaceItemsSummary = async (projectId: string): Promise<WorkspaceItemSummary> => {
  try {
    const targetPath = `projects/${projectId}/workspaces/main/items`;
    console.log(`[Summary API] Fetching item counts for dashboard via: ${targetPath}`);
    const q = query(
      collection(db, targetPath),
      limit(50) // Sample limit for lightweight meta checks
    );
    const snapshot = await getDocs(q);
    
    let modelCount = 0;
    let layoutCount = 0;
    let documentCount = 0;

    snapshot.forEach(doc => {
      const type = doc.data()?.itemType;
      if (type === 'model') modelCount++;
      if (type === 'layout') layoutCount++;
      if (type === 'document' || type === 'req') documentCount++;
    });

    return { modelCount, layoutCount, documentCount };
  } catch (err) {
    // Expected during dev or restricted security rules - returning zeroes degrades gracefully
    console.warn(`[fetchWorkspaceItemsSummary] Failed to fetch items for project ${projectId}. Relying on fallback.`, err);
    return { modelCount: 0, layoutCount: 0, documentCount: 0 };
  }
};
