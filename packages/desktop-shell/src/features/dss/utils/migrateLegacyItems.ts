import { getDocs, query, collectionGroup, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

/**
 * Migration script to add `pinnedVersion: 1` to all legacy Project Items that are missing it.
 * This prevents unintended auto-updates when master assets get updated.
 * 
 * Target collections:
 * 1. projects/{projectId}/workspaces/{workspaceId}/items (Canvas items)
 * 2. projects/{projectId}/workspaces/{workspaceId}/bases/{baseId}/plans/{planId}/items (Layout items)
 */
export async function migrateLegacyItems() {
  console.log('[Migration] Starting legacy items migration...');
  let totalMigrated = 0;

  try {
    // 1. Migrate Canvas Items (projects/{projectId}/workspaces/{workspaceId}/items)
    const itemsQuery = query(collectionGroup(db, 'items'));
    const itemsSnap = await getDocs(itemsQuery);
    
    let batch = writeBatch(db);
    let count = 0;

    for (const itemDoc of itemsSnap.docs) {
      const data = itemDoc.data();
      // Check if it's an item but missing pinnedVersion
      if (data && data.itemType && data.pinnedVersion === undefined) {
        batch.update(itemDoc.ref, { pinnedVersion: 1 });
        count++;

        if (count >= 500) {
          await batch.commit();
          totalMigrated += count;
          console.log(`[Migration] Committed ${count} item updates.`);
          batch = writeBatch(db);
          count = 0;
        }
      }
    }

    if (count > 0) {
      await batch.commit();
      totalMigrated += count;
      console.log(`[Migration] Committed ${count} item updates.`);
    }

    // Since layout items are embedded in the option layout JSON, migrating them requires
    // reading the layout, updating items, and saving.
    // That's more complex, but we fallback to `item.pinnedVersion || 1` in Adapters,
    // so we don't strictly *need* to touch deep layout JSON until they are re-saved.
    
    console.log(`[Migration] Finished. Total items migrated: ${totalMigrated}`);
    alert(`[終了] ${totalMigrated}件のレガシーアイテムに pinnedVersion: 1 を付与しました。`);
  } catch (error) {
    console.error('[Migration] Failed:', error);
    alert(`エラーが発生しました: ${error.message}`);
  }
}
