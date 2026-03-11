import { normalizeDate } from '@/shared/utils/normalizeDate';
import { extractFileType } from '@/shared/utils/extractFileType';
// import { UnifiedBoard, UnifiedBoardItem } from '@/shared/types/unifiedBoardTypes'; // (JSDoc Type Hints)

/**
 * 旧 myBoard や teamBoard のドキュメントデータを UnifiedBoard に変換するアダプター。
 * 
 * @param {Object} docData - Firestoreドキュメントの.data()
 * @param {string} docId - FirestoreドキュメントのID
 * @param {boolean} [isTeamBoard=false] - 旧teamBoardsから取得したかどうか
 * @returns {import('../types/unifiedBoardTypes').UnifiedBoard}
 */
export function normalizeToUnifiedBoard(docData, docId, isTeamBoard = false) {
  if (!docData) throw new Error(`[Adapter Error] No data for board ${docId}`);

  // すでに新スキーマ(v2)の場合はそのまま返す
  if (docData.schemaVersion === 2) {
    return { id: docId, ...docData };
  }

  // ==== 旧データの正規化 (Phase 1/2 用) ====

  // 1. ownerIdの揺れを吸収
  const ownerId = docData.ownerId || docData.owner || docData.createdBy || docData.userId || null;

  // 2. membersの揺れを吸収 (Mapや配列が混在)
  let memberIds = [];
  if (isTeamBoard) {
    if (Array.isArray(docData.memberIds)) {
      memberIds = docData.memberIds;
    } else if (Array.isArray(docData.members)) {
      memberIds = docData.members;
    } else if (docData.members && typeof docData.members === 'object') {
      memberIds = Object.keys(docData.members);
    }
  }

  // 3. visibilityの揺れを吸収
  let visibility = docData.visibility || "private";
  if (docData.isPublic && !docData.isPrivate) visibility = "public";

  // 4. itemCount, URLs, dates
  const itemCount = typeof docData.itemCount === 'number' ? docData.itemCount : 0;
  const coverThumbnailUrl = docData.coverThumbnailUrl || docData.thumbnailUrl || docData.imageUrl || null;
  const createdAt = normalizeDate(docData.createdAt);
  const updatedAt = normalizeDate(docData.updatedAt);
  // lastActivityAt がなければ updatedAt で代用
  const lastActivityAt = normalizeDate(docData.lastActivityAt) || updatedAt;

  return {
    id: docId,
    name: docData.name || docData.title || "Untitled Board",
    boardType: isTeamBoard ? 'team' : 'personal',
    ownerId,
    memberIds,
    visibility,
    itemCount,
    coverThumbnailUrl,
    lastActivityAt,
    createdAt,
    updatedAt,
    sourceApp: docData.sourceApp || '3dss',
    schemaVersion: 1, // 旧データであることを明示
    // デバッグ/マイグレーション用のメタメタデータ
    _originalPath: isTeamBoard ? `teamBoards/${docId}` : `users/${ownerId}/myBoards/${docId}`
  };
}

/**
 * 旧 models / items サブコレクションを UnifiedBoardItem に変換するアダプター。
 * 
 * @param {Object} docData - Firestoreドキュメントの.data()
 * @param {string} docId - FirestoreドキュメントのID
 * @param {string} boardId - 親ボードのID
 * @param {string} [boardOwnerId] - フォールバック用(省略可)
 * @returns {import('../types/unifiedBoardTypes').UnifiedBoardItem}
 */
export function normalizeToUnifiedBoardItem(docData, docId, boardId, boardOwnerId = null) {
   if (!docData) throw new Error(`[Adapter Error] No data for item ${docId}`);

   if (docData.schemaVersion === 2) {
     return { id: docId, boardId, ...docData };
   }

   // 1. 基本となるエンティティ種類の特定
   const itemType = docData.itemType || 'model';
   const entityType = docData.entityType || itemType;
   // id が散らばっているので収集
   const entityId = docData.entityId || docData.modelId || docData.id || docId;
   
   // 2. 実体パスの解決
   const itemRef = docData.itemRef || docData.modelRef || `models/${entityId}`;

   // 3. addedByの推定
   const addedBy = docData.addedBy || docData.ownerId || docData.owner || docData.createdBy || boardOwnerId || null;

   // 4. その他のメタ情報
   const sortOrder = typeof docData.sortOrder === 'number' ? docData.sortOrder : (docData.index || 0);
   const fileType = extractFileType(docData) || 'UNKNOWN';

   return {
     id: docId,
     boardId,
     itemType,
     entityType,
     entityId,
     itemRef,
     addedBy,
     sortOrder,
     schemaVersion: 1,
     createdAt: normalizeDate(docData.createdAt),
     updatedAt: normalizeDate(docData.updatedAt),
     sourceApp: docData.sourceApp || '3dss',
     snapshot: {
       title: docData.name || docData.title || 'Untitled',
       thumbnailUrl: docData.thumbnailUrl || docData.imageUrl || null,
       fileType,
       previewType: itemType === 'model' ? '3d' : 'image',
       subtitle: docData.subtitle || null
     }
   };
}
