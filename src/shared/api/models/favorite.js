// src/utils/services/models/favorite.js
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc, collectionGroup, query, where, getDocs } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * いいね（favorites）をトグルする（ユーザーモデルのみ）
 */
export const toggleFavoriteModelEverywhere = async ({ modelId, userId, isCurrentlyFavorited, ownerId }) => {
    if (!userId) throw new Error("toggleFavorite: userId is empty");
    if (!modelId) throw new Error("toggleFavorite: modelId is empty");

    const updateFn = isCurrentlyFavorited ? arrayRemove : arrayUnion;

    let targetOwnerId = ownerId;

    // もし ownerId が渡されていなければ、collectionGroup で探索する
    if (!targetOwnerId) {
        const q = query(collectionGroup(db, "models"), where("id", "==", modelId));
        const snap = await getDocs(q);
        if (snap.empty) {
            console.warn("[fav] model not found in collectionGroup", modelId);
            return;
        }
        // users/{uid}/models/{modelId} => parent.parent is users/{uid}
        targetOwnerId = snap.docs[0].ref.parent.parent.id;
    }

    if (!targetOwnerId) {
        console.warn("[fav] could not resolve ownerId for model", modelId);
        return;
    }

    const userModelRef = doc(db, "users", targetOwnerId, "models", modelId);
    try {
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
