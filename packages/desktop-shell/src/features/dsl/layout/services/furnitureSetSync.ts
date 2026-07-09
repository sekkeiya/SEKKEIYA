/**
 * furnitureSetSync.ts
 * S.Layout の FurnitureSet を S.Model の modelSets コレクションに同期する。
 * doc ID は `dsl_<furnitureSetId>` で一意に管理する（ユーザーが別途作成した modelSet と衝突しない）。
 */

import type { FurnitureSet } from '../types/furnitureSet';
import { FURNITURE_CATEGORIES } from '../constants/furnitureCategoryDefaults';

const MODEL_SET_ID_PREFIX = 'dsl_';

function toModelSetId(furnitureSetId: string): string {
  return `${MODEL_SET_ID_PREFIX}${furnitureSetId}`;
}

/** FurnitureSet → modelSets ドキュメントのデータに変換 */
function convertToModelSetData(set: FurnitureSet, uid: string) {
  const catMap = new Map(FURNITURE_CATEGORIES.map(c => [c.key, c]));

  const placedItems = set.items.map(item => {
    const cat = catMap.get(item.categoryKey);
    return {
      instanceId: item.id,
      assetId: item.entityId ?? '',
      title: item.title,
      thumbnailUrl: item.thumbnailUrl ?? null,
      w: cat?.widthMm ?? 600,
      d: cat?.depthMm ?? 600,
      x: Math.round(item.transform.x * 1000),
      y: Math.round(item.transform.z * 1000),  // DSL の Z (奥行) → modelSet の Y
      z: 0,
      rotation: item.transform.rotationDeg,
    };
  });

  // entityId が設定されているアイテムのみ companionModels に登録（重複排除）
  const seenEntityIds = new Set<string>();
  const companionModels: { id: string; title: string; thumbnailUrl?: string }[] = [];
  for (const item of set.items) {
    if (item.entityId && !seenEntityIds.has(item.entityId)) {
      seenEntityIds.add(item.entityId);
      companionModels.push({
        id: item.entityId,
        title: item.title,
        ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
      });
    }
  }

  return {
    title: set.name,
    ownerId: uid,
    projectId: null,
    visibility: 'private' as const,
    companionModels,
    placedItems,
    ...(set.placementRule ? { placementRule: { ...set.placementRule, maxCount: set.placementRule.maxCount ?? null } } : {}),
    updatedAt: new Date().toISOString(),
  };
}

/** S.Layout の FurnitureSet 保存時に modelSets へ upsert */
export async function syncFurnitureSetToModelSet(uid: string, set: FurnitureSet): Promise<void> {
  try {
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../../../lib/firebase/client');

    const modelSetId = toModelSetId(set.id);
    const ref = doc(db, 'modelSets', modelSetId);

    const existing = await getDoc(ref);
    const data = convertToModelSetData(set, uid);

    if (existing.exists()) {
      await setDoc(ref, data, { merge: true });
    } else {
      await setDoc(ref, { ...data, createdAt: new Date().toISOString() });
    }
  } catch (e) {
    console.warn('[furnitureSetSync] sync failed (non-critical):', e);
  }
}

/** S.Layout の FurnitureSet 削除時に modelSets からも削除 */
export async function deleteSyncedModelSet(furnitureSetId: string): Promise<void> {
  try {
    const { doc, deleteDoc } = await import('firebase/firestore');
    const { db } = await import('../../../../lib/firebase/client');

    const modelSetId = toModelSetId(furnitureSetId);
    await deleteDoc(doc(db, 'modelSets', modelSetId));
  } catch (e) {
    console.warn('[furnitureSetSync] delete sync failed (non-critical):', e);
  }
}
