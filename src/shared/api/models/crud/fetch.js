// utils/services/models/crud/fetch.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * models コレクションから1件を取得
 */
export const fetchModelDetail = async (modelId) => {
    const modelRef = doc(db, "models", modelId);
    const snap = await getDoc(modelRef);
    if (!snap.exists()) {
        console.warn(`Model not found: ${modelId}`);
        return null;
    }
    return { id: snap.id, ...snap.data() };
};
