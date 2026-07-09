// utils/services/boards/actions.js
// role: ユースケース（オーケストレーション）専用。
// 重要: projectShares/* の作成・更新・削除は Cloud Functions 側が単一ソース。
// ここ（クライアント）では projectShares を一切書かない。

import { serverTimestamp, doc, writeBatch, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

// パス/ID計算
import { publicIdFromSource } from "./paths";

// 統合された CRUD API
import {
    getBoardById,
    createBoard,
    deleteBoardAndItems,
    leaveBoard,
    addModelToBoard,
    removeModelFromBoard,
} from "./crud";

import { getModelByRefPath } from "./read";

// 権限（公開切替の前に最低限チェック）
import { canPublishMyBoard, canPublishTeamBoard } from "./guards";

/* ───────────────────────── internal helpers ───────────────────────── */

/** 参照解決（users/{uid}/models, models, publicModels の順で試行） */
async function resolveModelRefAndDoc({ model, actor, ownerId }) {
    const modelId = model?.modelId ?? model?.id;
    if (!modelId) throw new Error("saveModelToBoard: modelId required");

    const sourceUserId = model?.userId ?? model?.createdBy ?? actor?.uid ?? ownerId ?? null;

    const candidates = [];
    if (model?.modelRef?.path) candidates.push(model.modelRef.path);
    if (sourceUserId) candidates.push(`users/${sourceUserId}/models/${modelId}`);
    candidates.push(`models/${modelId}`);
    candidates.push(`publicModels/${modelId}`);

    for (const path of candidates) {
        try {
            const docObj = await getModelByRefPath(path);
            if (docObj) return { modelRef: { id: modelId, path }, referent: docObj, sourceUserId };
        } catch {
            /* try next */
        }
    }

    // 実体が読めなくても参照だけは保存できるようにする
    const fallbackPath = sourceUserId ? `users/${sourceUserId}/models/${modelId}` : `models/${modelId}`;
    return { modelRef: { id: modelId, path: fallbackPath }, referent: null, sourceUserId };
}

/* ───────────────────────── 1) 公開/非公開（可視性だけ変更） ───────────────────────── */

/**
 * 公開（idempotent）
 * - visibility を "public" にし、CF の onWrite に任せる。
 */
export async function publishBoard({
    ownerId,
    boardId,
    actor,
}) {
    if (!boardId) throw new Error("publishBoard: invalid args");

    const srcBoard = await getBoardById(boardId);
    if (!srcBoard) throw new Error("元ボードが見つかりません");

    // Unified guards -> チーム判定は members.length > 1 などになるが、
    // いまは簡略化して無条件か、ownerチェックのみにする
    if (srcBoard.ownerId !== actor?.uid) {
        throw new Error("公開権限がありません (Not Owner)");
    }

    const ref = doc(db, "projects", boardId);
    await updateDoc(ref, { visibility: "public", updatedAt: serverTimestamp() });

    // legacy path fallback:
    const shareId = publicIdFromSource({ boardType: "boards", ownerId: srcBoard.ownerId, boardId });
    return { shareId };
}

/**
 * 非公開化（idempotent）
 */
export async function unpublishBoard({ ownerId, boardId, actor }) {
    if (!boardId) throw new Error("unpublishBoard: invalid args");

    const ref = doc(db, "projects", boardId);
    await updateDoc(ref, { visibility: "private", updatedAt: serverTimestamp() });

    const shareId = publicIdFromSource({ boardType: "boards", ownerId: actor?.uid, boardId });
    return { shareId };
}

/* ──────────────── 2) モデルの保存/削除（ソースのみ） ──────────────── */

/** 参照保存 */
export async function saveModelToBoard({
    ownerId, boardId, actor, model,
}) {
    const { modelRef, referent, sourceUserId } =
        await resolveModelRefAndDoc({ model, actor, ownerId });

    // Unified format: call addModelToBoard directly.
    await addModelToBoard({
        userId: actor?.uid || sourceUserId || ownerId,
        boardId,
        modelRef,
        preview: { ...model, id: modelRef.id, userId: sourceUserId },
    });
}

/** 参照削除 */
export async function deleteModelFromBoard({ boardId, modelId }) {
    if (!modelId || !boardId) throw new Error("deleteModelFromBoard: required args missing");
    await removeModelFromBoard({ boardId, modelId });
}

/* ───────────────────────── 3) 再同期ユースケース（poke のみ） ───────────────────────── */

export async function syncPublicBoardMeta({ ownerId, boardId }) {
    const ref = doc(db, "projects", boardId);
    await updateDoc(ref, { updatedAt: serverTimestamp() });
    return { shareId: boardId };
}

export async function syncPublicBoardModels({ ownerId, boardId }) {
    const ref = doc(db, "projects", boardId);
    await updateDoc(ref, { updatedAt: serverTimestamp() });
    return { shareId: boardId };
}

/* ────────────── 4) モデルの一括 public 化（実体の visibility を変更） ────────────── */

export async function makeBoardModelsPublic({ items }) {
    if (!Array.isArray(items) || !items.length) return 0;
    const batch = writeBatch(db);

    for (const item of items) {
        let targetRef = null;
        if (item?.modelRef?.path) {
            const seg = String(item.modelRef.path).split("/").filter(Boolean);
            if (seg.length % 2 === 0) targetRef = doc(db, ...seg);
        } else if (item?.ownerId && item?.modelId) {
            targetRef = doc(db, "users", item.ownerId, "models", item.modelId);
        } else if (item?.createdBy && item?.modelId) {
            targetRef = doc(db, "users", item.createdBy, "models", item.modelId);
        }
        if (targetRef) batch.update(targetRef, { visibility: "public" });
    }

    await batch.commit();
    return items.length;
}

/* ───────────────────────── 5) 互換APIラッパ ───────────────────────── */

/** 旧 api 互換: boardType 問わず統一された createBoard を呼ぶ */
export async function createUserBoard(userId, boardData = {}, boardType = "myBoards") {
    // boardType is ignored logically, but unified schema creates the board.
    return createBoard({ userId, data: boardData });
}

export async function deleteBoardAndModels({ userId, board }) {
    if (!board) return;

    const ownerId = board.ownerId || board.owner || null;

    if (userId && ownerId && userId === ownerId) {
        await deleteBoardAndItems(userId, board.id);
    } else {
        await leaveBoard(userId, board.id);
    }
}

export async function updateBoardOptions({
    userId,
    selectedCard,
    newBoardOptions,
    boards,
    prevBoardOptions = [],
    canWriteUserModel = true,
}) {
    const modelId = selectedCard?.modelId ?? selectedCard?.id;
    const modelUserId = selectedCard?.createdBy ?? selectedCard?.userId ?? userId;
    if (!modelId) throw new Error("updateBoardOptions: modelId が不明です");

    const nextSet = new Set(newBoardOptions || []);
    const prevSet = new Set(prevBoardOptions || []);
    const added = [...nextSet].filter((b) => !prevSet.has(b));
    const removed = [...prevSet].filter((b) => !nextSet.has(b));

    for (const boardName of added) {
        const b = boards?.find((x) => x.name === boardName);
        if (!b) continue;
        await saveModelToBoard({
            ownerId: b.ownerId,
            boardId: b.id,
            actor: { uid: userId },
            model: { modelId, createdBy: modelUserId },
        });
    }

    for (const boardName of removed) {
        const b = boards?.find((x) => x.name === boardName);
        if (!b) continue;
        await deleteModelFromBoard({
            boardId: b.id,
            modelId,
        });
    }

    if (canWriteUserModel && modelUserId === userId) {
        const ref = doc(db, "users", modelUserId, "models", modelId);
        await setDoc(ref, { boardOptions: newBoardOptions, updatedAt: serverTimestamp() }, { merge: true });
    }
}
