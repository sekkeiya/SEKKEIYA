// src/shared/api/boards/crud.js
// 役割: 新しい unified `boards` コレクションに対する直接的な CRUD 操作を提供。

import {
    collection,
    collectionGroup, // added
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
    limit as fsLimit
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/** @や空白を取り除いたハンドルを返す（なければ null） */
const normalizeHandle = (raw) => {
    if (!raw) return null;
    const h = String(raw).trim().replace(/^@+/, "");
    return h || null;
};

/** サブコレを chunk 削除 */
async function deleteCollectionByChunks(collRef, perBatch = 450) {
    while (true) {
        const snap = await getDocs(query(collRef, fsLimit(perBatch)));
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        if (snap.size < perBatch) break;
    }
}

/* ============================== C: Create ============================== */
/** 新規作成（Unified format） */
export const createBoard = async ({ userId, data = {} }) => {
    if (!userId) throw new Error("createBoard: userId が必要です");

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

    // メンバーがいる場合はそのメンバー、いない場合は自分のみ
    const memberIds = Array.isArray(data.members) && data.members.length > 0 
        ? data.members 
        : [userId];

    const sanitized = Object.fromEntries(
        Object.entries(data).filter(
            ([k]) => !["visibility", "isPublic", "isPrivate", "owner", "ownerId", "publicMode", "members", "boardType"].includes(k)
        )
    );

    const timestamp = serverTimestamp();
    const unifiedColRef = collection(db, "projects");
    const unifiedRef = doc(unifiedColRef);
    const newBoardId = unifiedRef.id;

    const unifiedPayload = {
        ...sanitized,
        visibility: "public",
        ownerId: userId,
        ownerName: handle,
        memberIds: memberIds,
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
    return { id: newBoardId, ...unifiedPayload };
};

/* ============================== R: Read ============================== */
/** 単一取得 (Unified v3 / v2 Fallback) */
export const getBoardById = async (boardId) => {
    if (!boardId) return null;

    const ref = doc(db, "projects", boardId);
    const rootSnap = await getDoc(ref);
    if (rootSnap.exists()) {
        return { 
            id: rootSnap.id, 
            ...rootSnap.data(), 
            _ref: rootSnap.ref,
            projectId: rootSnap.id
        };
    }

    return null;
};

/* ============================== U: Update ============================== */
/** 情報更新（name / description など任意フィールド） */
export const updateBoardInfo = async (boardId, updatedFields) => {
    const board = await getBoardById(boardId);
    if (!board || !board._ref) return;

    const sanitized = Object.fromEntries(
        Object.entries(updatedFields || {}).filter(
            ([k]) => !["visibility", "owner", "ownerId", "isPublic", "isPrivate", "publicMode", "boardType"].includes(k)
        )
    );
    if (!Object.keys(sanitized).length) return;
    await updateDoc(board._ref, { ...sanitized, updatedAt: serverTimestamp() });
};

/** メンバーから自身を削除（脱退） */
export const leaveBoard = async (userId, boardId) => {
    if (!userId || !boardId) return;
    const board = await getBoardById(boardId);
    if (!board || !board._ref) return;

    try {
        const curMembers = Array.isArray(board.memberIds) ? board.memberIds : [];
        const nextMembers = curMembers.filter((m) => m !== userId);
        
        await updateDoc(board._ref, {
            memberIds: nextMembers,
            updatedAt: serverTimestamp(),
        });
    } catch (e) {
        console.warn("[leaveBoard] update memberIds failed:", e);
    }
};

/* ============================== D: Delete ============================== */
/**
 * ボード削除
 */
export const deleteBoardAndItems = async (userId, boardId) => {
    if (!userId || !boardId) throw new Error("userId/boardId が必要です");

    const board = await getBoardById(boardId);
    if (!board || !board._ref) return;

    const ownerUid = board.ownerId;
    if (ownerUid !== userId) throw new Error("この操作はオーナーのみ実行可能です");

    // Items サブコレ削除
    await deleteCollectionByChunks(collection(db, `${board._ref.path}/workspaces/main/items`), 450);

    // 本体削除
    await deleteDoc(board._ref);
};

/* ============ Models under Board (単発参照の追加/削除) ============ */

const getThumbFromModelLike = (m = {}) =>
    m.thumbnailUrl ||
    m.thumbUrl ||
    m.thumbnail ||
    m.image ||
    m.thumbnailFile?.url ||
    m.thumbnailFilePath?.url ||
    (Array.isArray(m.images) && (m.images[0]?.img || (typeof m.images[0] === "string" ? m.images[0] : ""))) ||
    m.preview?.thumbnailUrl ||
    m.preview?.thumbUrl ||
    "";

async function buildPreviewPayload({ preview = {}, modelRef }) {
    const base = {
        id: preview?.id ?? modelRef?.id ?? null,
        title: preview?.title ?? preview?.name ?? null,
        brand: preview?.brand ?? null,
        author: preview?.author ?? null,
        thumbnailUrl: preview?.thumbnailUrl ?? preview?.thumbUrl ?? null,
    };

    if (!base.title || !base.thumbnailUrl || base.brand == null || !base.author) {
        try {
            const seg = String(modelRef?.path || "").split("/").filter(Boolean);
            if (seg.length % 2 === 0) {
                const snap = await getDoc(doc(db, ...seg));
                if (snap.exists()) {
                    const m = { id: snap.id, ...snap.data() };
                    base.title = base.title ?? m.title ?? m.name ?? m.preview?.title ?? "Model";
                    base.author = base.author ?? m.author ?? m.createdByName ?? m.ownerName ?? m.createdBy ?? m.preview?.author ?? "";
                    base.brand = base.brand ?? m.brand ?? (Array.isArray(m.brands) ? m.brands[0] : null) ?? m.preview?.brand ?? null;
                    base.thumbnailUrl = base.thumbnailUrl ?? (getThumbFromModelLike(m) || null);
                }
            }
        } catch { } // ignore errors
    }

    return {
        id: base.id,
        title: base.title ?? null,
        brand: base.brand ?? null,
        author: base.author ?? null,
        thumbnailUrl: base.thumbnailUrl ?? null,
    };
}

export const addModelToBoard = async ({
    userId, boardId, modelRef, preview = {},
}) => {
    if (!userId || !boardId || !modelRef?.id || !modelRef?.path) {
        throw new Error("addModelToBoard: 引数不足");
    }
    const modelId = modelRef.id;

    const board = await getBoardById(boardId);
    if (!board || !board._ref) throw new Error("addModelToBoard: ボードが存在しません");

    const unifiedItemsColRef = collection(db, `${board._ref.path}/workspaces/main/items`);
    const unifiedItemRef = doc(unifiedItemsColRef);

    const timestamp = serverTimestamp();
    const batch = writeBatch(db);
    
    const previewPayload = await buildPreviewPayload({ preview: { ...preview, id: modelId }, modelRef });

    batch.set(
        unifiedItemRef,
        {
            boardId,
            itemType: "model",
            entityId: modelId,
            itemRef: modelRef.path || `models/${modelId}`,
            addedBy: userId,
            sortOrder: 0,
            schemaVersion: 2,
            snapshot: {
                title: previewPayload.title || previewPayload.name || null,
                thumbnailUrl: previewPayload.thumbnailUrl || previewPayload.thumbUrl || null,
                previewType: "3d",
            },
            createdAt: timestamp,
            updatedAt: timestamp,
        },
        { merge: true }
    );

    batch.set(
        board._ref,
        {
            itemCount: increment(1),
            coverThumbnailUrl: previewPayload.thumbnailUrl || previewPayload.thumbUrl || null,
            coverItemId: modelId,
            lastActivityAt: timestamp,
            updatedAt: timestamp,
        },
        { merge: true }
    );

    await batch.commit();
};

export const removeModelFromBoard = async ({ boardId, modelId }) => {
    if (!boardId || !modelId) throw new Error("removeModelFromBoard: 引数不足");

    const board = await getBoardById(boardId);
    if (!board || !board._ref) return;

    let unifiedItemDocs = [];
    try {
        const q = query(
            collection(db, `${board._ref.path}/workspaces/main/items`),
            where("entityId", "==", modelId),
            where("itemType", "==", "model")
        );
        const snap = await getDocs(q);
        unifiedItemDocs = snap.docs;
    } catch { /* ignore */ }

    const batch = writeBatch(db);
    unifiedItemDocs.forEach(d => batch.delete(d.ref));
    
    batch.set(
        board._ref,
        {
            updatedAt: serverTimestamp(),
            itemCount: increment(-1),
        },
        { merge: true }
    );

    await batch.commit();
};
