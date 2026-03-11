// utils/services/models/crud/images.js
import { doc, getDoc, updateDoc, serverTimestamp, arrayRemove } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * 公開モデルの images から1件削除
 */
export async function deleteImageFromModel({ modelId, image, useArrayRemove = true }) {
    const modelRef = doc(db, "models", modelId);

    if (useArrayRemove) {
        await updateDoc(modelRef, {
            images: arrayRemove(image),
            updatedAt: serverTimestamp(),
        });
        return;
    }

    // 差し替え方式（保険）
    const snap = await getDoc(modelRef);
    if (!snap.exists()) return;
    const cur = snap.data()?.images || [];
    const next = cur.filter((x) => x !== image);
    await updateDoc(modelRef, { images: next, updatedAt: serverTimestamp() });
}

/**
 * ユーザーモデル側の images から削除
 */
export async function deleteImageFromUserModel({ userId, modelId, image, useArrayRemove = true }) {
    const ref = doc(db, "users", userId, "models", modelId);

    if (useArrayRemove) {
        await updateDoc(ref, {
            images: arrayRemove(image),
            updatedAt: serverTimestamp(),
        });
        return;
    }

    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const cur = snap.data()?.images || [];
    const next = cur.filter((x) => x !== image);
    await updateDoc(ref, { images: next, updatedAt: serverTimestamp() });
}
