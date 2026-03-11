// src/utils/services/models/favorite.js
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * いいね（favorites）をトグルする（グローバル＋ユーザーモデル）
 */
export const toggleFavoriteModelEverywhere = async ({ modelId, userId, isCurrentlyFavorited }) => {
    if (!userId) throw new Error("toggleFavorite: userId is empty");
    if (!modelId) throw new Error("toggleFavorite: modelId is empty");

    const updateFn = isCurrentlyFavorited ? arrayRemove : arrayUnion;

    // 1) グローバル models
    const globalRef = doc(db, "models", modelId);
    try {
        console.log("[fav] try global:", globalRef.path, isCurrentlyFavorited ? "REMOVE" : "ADD", userId);
        await updateDoc(globalRef, { favorites: updateFn(userId) });
        console.log("[fav] ok global:", globalRef.path);
    } catch (e) {
        console.error("[fav] FAIL global:", globalRef.path, e);
        throw e;
    }

    // 2) users/{createdBy}/models/{modelId}
    try {
        const snap = await getDoc(globalRef);
        const createdBy = snap.data()?.createdBy;
        if (!createdBy) {
            console.warn("[fav] createdBy missing on", globalRef.path);
            return;
        }

        const userModelRef = doc(db, "users", createdBy, "models", modelId);
        const userModelSnap = await getDoc(userModelRef);
        console.log("[fav] userModel exists?", userModelSnap.exists(), userModelRef.path);

        if (userModelSnap.exists()) {
            console.log("[fav] try userModel:", userModelRef.path, isCurrentlyFavorited ? "REMOVE" : "ADD", userId);
            await updateDoc(userModelRef, { favorites: updateFn(userId) });
            console.log("[fav] ok userModel:", userModelRef.path);
        }
    } catch (e) {
        console.error("[fav] FAIL userModel:", e);
        throw e;
    }
};
