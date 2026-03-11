// utils/services/models/crud/delete.js
import { doc, getDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { ref, listAll, deleteObject } from "firebase/storage";
import { storage } from "@/shared/config/firebase";

export async function deleteAllFilesInFolder(folderPath) {
    try {
        const folderRef = ref(storage, folderPath);
        const res = await listAll(folderRef);
        for (const fileRef of res.items) await deleteObject(fileRef);
    } catch (e) {
        console.warn("[storage] skip clean:", folderPath, e?.message || e);
    }
}

async function isOwnerOfPublicModel(modelId, uid) {
    const pubRef = doc(db, "models", modelId);
    const snap = await getDoc(pubRef);
    if (!snap.exists()) return { exists: false, isOwner: false };
    const d = snap.data() || {};
    const owner =
        d.createdBy ?? d.createdByUid ?? d.ownerId ?? d.owner ?? d.author ?? d.authorUid ?? d.userId ?? d.uid ?? null;
    return { exists: true, isOwner: owner === uid };
}

export async function deleteModelFromFirestore({
    userId,
    modelId,
    boardId = null,
    selectedPage,
    boardType = null,
}) {
    if (!userId || !modelId) throw new Error("userIdまたはmodelIdが不正です");

    // boardspage: ボード中の参照だけ削除
    if (selectedPage === "boardspage" && boardId && boardType) {
        const boardModelRef =
            boardType === "myBoards"
                ? doc(db, "users", userId, "myBoards", boardId, "models", modelId)
                : doc(db, "teamBoards", boardId, "models", modelId);
        try {
            await deleteDoc(boardModelRef);
            console.log("[delete] board model deleted:", boardType, boardId, modelId);
        } catch (e) {
            console.error("[delete] board model FAILED:", boardType, boardId, modelId, e);
            throw e;
        }
        return;
    }

    // 1) ユーザー配下
    const userModelRef = doc(db, "users", userId, "models", modelId);
    try {
        const userModelSnap = await getDoc(userModelRef);
        if (userModelSnap.exists()) {
            await deleteAllFilesInFolder(`models/${userId}/${modelId}`);
            await deleteDoc(userModelRef);
            console.log("[delete] user model deleted:", userId, modelId);
        } else {
            console.log("[delete] user model not found:", userId, modelId);
        }
    } catch (e) {
        console.error("[delete] user model FAILED:", userId, modelId, e);
        throw e; // ここで権限エラーなら rules の users/{uid}/models を疑う
    }

    // 2) 公開側（ダッシュボード等からのみ、かつオーナーのときだけ）
    if (selectedPage === "openmodelspage" || selectedPage === "dashboard") {
        try {
            const { exists, isOwner } = await isOwnerOfPublicModel(modelId, userId);
            if (exists && isOwner) {
                await deleteDoc(doc(db, "models", modelId));
                console.log("[delete] public model deleted:", modelId);
            } else {
                console.log("[delete] public model skipped (not owner or not exists):", modelId);
            }
        } catch (e) {
            console.error("[delete] public model FAILED:", modelId, e);
            throw e; // ここで権限エラーなら /models の rules を疑う
        }
    }
}
