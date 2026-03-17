// utils/services/models/crud/fetch.js
import { doc, getDoc, collectionGroup, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * users/{uid}/models コレクションから1件を取得（Unified Schema v2対応）
 * ownerIdが分かっている場合は高速に取得、分からない場合はcollectionGroupで検索する。
 */
export const fetchModelDetail = async (modelId, ownerId = null) => {
    if (!modelId) return null;

    if (ownerId) {
        const modelRef = doc(db, "users", ownerId, "models", modelId);
        const snap = await getDoc(modelRef);
        if (snap.exists()) {
            return { id: snap.id, ...snap.data(), refPath: snap.ref.path };
        }
    }

    // ownerId不明、または直接取得に失敗した場合はcollectionGroup検索
    const qId = query(
        collectionGroup(db, "models"),
        where("id", "==", modelId),
        where("isCanonical", "==", true),
        limit(1)
    );
    const snapId = await getDocs(qId);
    if (!snapId.empty) {
        const docSnap = snapId.docs[0];
        return { id: docSnap.id, ...docSnap.data(), refPath: docSnap.ref.path };
    }

    const qEntity = query(
        collectionGroup(db, "models"),
        where("entityId", "==", modelId),
        where("isCanonical", "==", true),
        limit(1)
    );
    const snapEntity = await getDocs(qEntity);
    if (!snapEntity.empty) {
        const docSnap = snapEntity.docs[0];
        return { id: docSnap.id, ...docSnap.data(), refPath: docSnap.ref.path };
    }

    console.warn(`Canonical Model not found: ${modelId}`);
    return null;
};
