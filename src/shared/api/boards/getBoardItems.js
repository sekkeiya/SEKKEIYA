import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  limit
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * Fetches items from a specific board collection path without applying any 
 * client-side adapter logic yet.
 * 
 * @param {string} boardType - e.g. "myBoards", "teamBoards", "boardsPublic"
 * @param {string} boardId - The document ID of the board
 * @param {string} ownerId - Required if boardType === "myBoards"
 * @param {string} itemCollection - e.g. "models", "drawings", "articles"
 */
export async function getBoardItems({ boardType, boardId, ownerId, itemCollection = "models" }) {
  if (!boardType || !boardId || !itemCollection) return [];

  let colRef = null;

  if (boardType === "myBoards") {
    if (!ownerId) throw new Error("ownerId is required for myBoards");
    colRef = collection(db, "users", ownerId, "myBoards", boardId, itemCollection);
  } else if (boardType === "teamBoards") {
    colRef = collection(db, "teamBoards", boardId, itemCollection);
  } else if (boardType === "boardsPublic") {
    colRef = collection(db, "boardsPublic", boardId, itemCollection);
  } else {
    throw new Error(`Unknown boardType: ${boardType}`);
  }

  const q = query(colRef, orderBy("updatedAt", "desc"), limit(100)); // Cap for initial viewer
  
  try {
    console.log(`[getBoardItems] Fetching old items for type: ${boardType}, boardId: ${boardId}, owner: ${ownerId}, collection: ${itemCollection}`);

    const snap = await getDocs(q);
    console.log(`[getBoardItems] Found ${snap.docs.length} raw links`);
    const linkDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Dereference model links. 3DSS stores a `modelRef` which points to the actual item.
    if (itemCollection === "models") {
      const resolvedDocs = await Promise.all(
        linkDocs.map(async (m) => {
          if (m?.modelRef?.path) {
             const paths = [];

             // Try exact path
             const primaryPath = String(m.modelRef.path).replace(/^\/+/, "");
             paths.push(primaryPath);

             // Try user path fallback
             const ownerUid =
               m?.preview?.createdBy ||
               m?.preview?.ownerId ||
               m?.preview?.userId ||
               m?.userId ||
               m?.createdBy ||
               null;

             const modelId = m.modelRef.id || m.id;
             if (ownerUid && modelId) {
               paths.push(`users/${ownerUid}/models/${modelId}`);
             }

             for (const p of paths) {
               try {
                 const seg = String(p).split("/").filter(Boolean);
                 if (seg.length % 2 !== 0) continue; 
                 // We require db from firebase/firestore which is actually from doc
                 // we imports doc and getDoc below
                 const ref = doc(db, ...seg);
                 const s = await getDoc(ref);
                 if (s.exists()) {
                   return { id: s.id, ...s.data(), _sourceLinkRef: m };
                 }
               } catch (e) {
                  // Ignore perms
               }
             }
             return null;
          }
          // If no modelRef, assume it IS the model
          return m;
        })
      );
      return resolvedDocs.filter(Boolean);
    }

    return linkDocs;
  } catch (err) {
    console.error(`[getBoardItems] Failed to fetch ${itemCollection}:`, err);
    throw err;
  }
}
