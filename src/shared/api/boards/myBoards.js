// utils/services/boards/myBoards.js
// 役割: users/{uid}/myBoards/* と配下 models/* に対する "単発CRUDのみ" を提供。
// boardsPublic/* など他コレクションの調停は actions.js 側で実施する。

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
    writeBatch,
    deleteDoc,
    increment,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

// （あれば paths を使う／無ければフォールバック）
let paths = {};
try { paths = await import("./paths"); } catch { /* optional */ }

const pathMyBoard = (uid, bid) =>
    paths?.pathMyBoard ? paths.pathMyBoard(uid, bid) : `users/${uid}/myBoards/${bid}`;
const pathMyBoardModelsCol = (uid, bid) =>
    paths?.pathMyBoardModelsCol ? paths.pathMyBoardModelsCol(uid, bid) : `users/${uid}/myBoards/${bid}/models`;
const pathMyBoardModel = (uid, bid, mid) =>
    paths?.pathMyBoardModel ? paths.pathMyBoardModel(uid, bid, mid) : `users/${uid}/myBoards/${bid}/models/${mid}`;

const splitPath = (p) => String(p || "").split("/").filter(Boolean);

/** サブコレを chunk 削除 */
async function deleteCollectionByChunks(collRef, perBatch = 450) {
    while (true) {
        const snap = await getDocs(collRef);
        if (snap.empty) break;

        const docs = snap.docs.slice(0, perBatch);
        const batch = writeBatch(db);
        docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        if (snap.size <= perBatch) break;
    }
}

/* ============================== C: Create ============================== */

/** @や空白を取り除いたハンドルを返す（なければ null） */
const normalizeHandle = (raw) => {
    if (!raw) return null;
    const h = String(raw).trim().replace(/^@+/, "");
    return h || null;
};

/** 新規作成（常に公開で作る／派生フィールドは書かない） */
export const createMyBoard = async ({ userId, data = {} }) => {
    if (!userId) throw new Error("createMyBoard: userId が必要です");

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("ユーザーデータが存在しません");
    const u = userSnap.data() || {};

    const handle =
        normalizeHandle(u.handle) ||
        normalizeHandle(u.handleLower) ||
        normalizeHandle(u.ownerHandle) ||
        normalizeHandle(u.ownerHandleLower) ||
        normalizeHandle(u.username) ||
        normalizeHandle(u.displayName) ||
        "";

    const sanitized = Object.fromEntries(
        Object.entries(data).filter(
            ([k]) => !["visibility", "isPublic", "isPrivate", "owner", "ownerId", "publicMode"].includes(k)
        )
    );

    const timestamp = serverTimestamp();
    const unifiedColRef = collection(db, "boards");
    const unifiedRef = doc(unifiedColRef);
    const newBoardId = unifiedRef.id;

    const unifiedPayload = {
        ...sanitized,
        visibility: "public",
        boardType: "myBoards",
        ownerId: userId,
        ownerName: handle,
        memberIds: [],
        sourceApp: "sekkeiya",
        schemaVersion: 2,
        itemCount: 0,
        coverThumbnailUrl: null,
        coverItemId: null,
        lastActivityAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await setDoc(unifiedRef, unifiedPayload);

    try {
        await updateDoc(userRef, { myBoardCreateCount: increment(1) });
    } catch {
        /* ignore */
    }

    return { id: newBoardId, ...unifiedPayload };
};

/* ============================== R: Read ============================== */
/** 単一取得 */
export const getMyBoardById = async (userId, boardId) => {
    if (!userId || !boardId) return null;
    const ref = doc(db, "boards", boardId);
    const snap = await getDoc(ref);
    return snap.exists()
        ? { id: snap.id, ...snap.data() }
        : null;
};

/* ============================== U: Update ============================== */
/** 情報更新（name / description など任意フィールド） */
export const updateMyBoardInfo = async (userId, boardId, updatedFields) => {
    const unifiedBoardRef = doc(db, "boards", boardId);
    const sanitized = Object.fromEntries(
        Object.entries(updatedFields || {}).filter(
            ([k]) => !["visibility", "owner", "ownerId", "isPublic", "isPrivate", "publicMode"].includes(k)
        )
    );
    await updateDoc(unifiedBoardRef, { ...sanitized, updatedAt: serverTimestamp() });
};

/**
 * 可視性更新（visibility のみ）
 * - nextVisibility: "public" | "private" | boolean（true=public/false=private）
 * - 非公開化にする際は myPrivateBoardLimit を満たす必要あり
 *   ※ privateStorageLimitBytes（非公開モデル容量）はモデル側で管理する想定のため、ここでは参照しません
 */
export const updateMyBoardVisibility = async ({
    userId,
    myBoardId,
    nextVisibility,
    planId = "free",
}) => {
    throw new Error("Visibility update is not supported directly from this UI in Sekkeiya yet. Use 3DSS settings.");
};

/* ============================== D: Delete ============================== */
/**
 * マイボード削除（配下 models/* のみ掃除）
 * - boardsPublic/* には触れない（公開ミラーの削除は actions.deleteBoardAndModels で実施）
 */
export const deleteMyBoardAndModels = async (userId, boardId) => {
    if (!userId || !boardId) throw new Error("userId/boardId が必要です");

    const unifiedBoardRef = doc(db, "boards", boardId);
    const exists = (await getDoc(unifiedBoardRef)).exists();
    if (!exists) return;

    // 1) Unified Items サブコレ削除
    await deleteCollectionByChunks(
        collection(db, "boards", boardId, "items"),
        450
    );

    // 2) 本体削除
    await deleteDoc(unifiedBoardRef);

    // 3) 任意: 作成カウンタのデクリメント（0 未満防止）
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const currentCount = Number(userSnap.data()?.myBoardCreateCount ?? 0);
        if (currentCount > 0) {
            await updateDoc(userRef, { myBoardCreateCount: increment(-1) });
        }
    }
};

/* ============ Models under myBoards (単発参照の追加/削除) ============ */
/**
 * 参照保存（idempotent）
 * - /users/{uid}/myBoards/{boardId}/models/{modelId}
 * - 親ボードの modelCount / modelRefs を軽量更新（厳密集計は actions 側）
 */
export const addModelToMyBoard = async ({
    uid, boardId, modelRef, preview = {},
}) => {
    if (!uid || !boardId || !modelRef?.id || !modelRef?.path) {
        throw new Error("addModelToMyBoard: 引数不足");
    }
    const modelId = modelRef.id;

    const unifiedItemsColRef = collection(db, "boards", boardId, "items");
    const unifiedItemRef = doc(unifiedItemsColRef);
    const unifiedBoardRef = doc(db, "boards", boardId);

    const timestamp = serverTimestamp();

    const batch = writeBatch(db);

    batch.set(
        unifiedItemRef,
        {
            boardId,
            itemType: "model",
            entityId: modelId,
            itemRef: modelRef.path || `models/${modelId}`,
            addedBy: uid,
            sortOrder: 0,
            schemaVersion: 2,
            snapshot: {
                title: preview.title || preview.name || null,
                thumbnailUrl: preview.thumbnailUrl || preview.thumbUrl || null,
                previewType: "3d",
            },
            createdAt: timestamp,
            updatedAt: timestamp,
        },
        { merge: true }
    );

    batch.set(
        unifiedBoardRef,
        {
            itemCount: increment(1),
            coverThumbnailUrl: preview.thumbnailUrl || preview.thumbUrl || null,
            coverItemId: modelId,
            lastActivityAt: timestamp,
            updatedAt: timestamp,
        },
        { merge: true }
    );

    await batch.commit();
};

/**
 * 参照削除（idempotent）
 * - /users/{uid}/myBoards/{boardId}/models/{modelId} を消す
 * - 親ボードの軽量更新（modelCount / modelRefs からの削除）を試みる
 */
export const removeModelFromMyBoard = async ({ uid, boardId, modelId }) => {
    if (!uid || !boardId || !modelId) throw new Error("removeModelFromMyBoard: 引数不足");

    const unifiedBoardRef = doc(db, "boards", boardId);

    let unifiedItemDocs = [];
    try {
        const q = query(
            collection(db, "boards", boardId, "items"),
            where("entityId", "==", modelId),
            where("itemType", "==", "model")
        );
        const snap = await getDocs(q);
        unifiedItemDocs = snap.docs;
    } catch { /* ignore */ }

    const batch = writeBatch(db);
    unifiedItemDocs.forEach(d => batch.delete(d.ref));
    
    batch.set(
        unifiedBoardRef,
        {
            updatedAt: serverTimestamp(),
            itemCount: increment(-1),
        },
        { merge: true }
    );

    await batch.commit();
};
