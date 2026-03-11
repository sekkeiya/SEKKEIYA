// utils/services/models/crud/utils.js
import { setDoc, serverTimestamp } from "firebase/firestore";

/**
 * 小文字化などの正規化
 */
function normalizeForSearch(model) {
    const titleLower = (model.title || "").toLowerCase();
    const keywordsLower = (model.keywords || [])
        .map((k) => String(k || "").toLowerCase())
        .filter(Boolean);

    const desc = (model.description || "").toLowerCase();
    const descriptionTokensLower = Array.from(
        new Set(desc.split(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]+/g).filter((t) => t.length >= 2))
    );

    return { titleLower, keywordsLower, descriptionTokensLower };
}

/**
 * 受け取った data を正規化して setDoc する共通関数
 */
export async function writeModelDoc(docRef, data) {
    const norm = normalizeForSearch(data);
    await setDoc(docRef, {
        ...data,
        ...norm,
        visibility: data.visibility ?? "private",
        updatedAt: serverTimestamp(),
    });
}
