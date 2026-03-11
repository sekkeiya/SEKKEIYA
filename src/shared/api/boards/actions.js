// utils/services/boards/actions.js
// role: ユースケース（オーケストレーション）専用。
// 重要: boardsPublic/* の作成・更新・削除は Cloud Functions 側が単一ソース。
// ここ（クライアント）では boardsPublic を一切書かない。

import { serverTimestamp, doc, writeBatch, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

// パス/ID計算
import { publicIdFromSource } from "./paths";

// 単発CRUD & 読み取り
import {
    getMyBoardById,
    deleteMyBoardAndModels,
    addModelToMyBoard,
    removeModelFromMyBoard,
    createMyBoard,
    updateMyBoardVisibility,
} from "./myBoards";

import {
    getTeamBoardById,
    deleteTeamBoardIfOwner,
    addModelToTeamBoard,
    removeModelFromTeamBoard,
    createTeamBoard,
    updateTeamBoardVisibility,
    leaveTeamBoard,
} from "./teamBoards";

import { getModelByRefPath } from "./read";

// 権限（公開切替の前に最低限チェック）
import { canPublishMyBoard, canPublishTeamBoard } from "./guards";

/* ───────────────────────── internal helpers ───────────────────────── */

/** モデル（実体 or UI）から最も適切なサムネURLを取得 */
const getThumbFromModel = (m = {}) =>
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

/** UI入力 & DB実体 から preview を構築（UI > DB の優先順位） */
const buildPreviewFrom = ({ ui = {}, db = {} } = {}) => {
    const title =
        ui?.preview?.title ??
        ui?.title ??
        ui?.name ??
        db?.title ??
        db?.name ??
        db?.preview?.title ??
        "Model";

    const author =
        ui?.preview?.author ??
        ui?.author ??
        db?.author ??
        db?.createdByName ??
        db?.ownerName ??
        db?.createdBy ??
        db?.preview?.author ??
        "";

    const brand =
        ui?.preview?.brand ??
        ui?.brand ??
        db?.brand ??
        (Array.isArray(db?.brands) ? db.brands[0] : undefined) ??
        db?.preview?.brand ??
        null;

    const thumb =
        ui?.preview?.thumbnailUrl ??
        ui?.preview?.thumbUrl ??
        ui?.thumbnailUrl ??
        ui?.thumbUrl ??
        (getThumbFromModel(db) || null);

    return {
        id: ui?.modelId ?? ui?.id ?? db?.id ?? null,
        title,
        author,
        brand: brand ?? null,
        thumbnailUrl: thumb ?? null,
        createdBy: db?.createdBy ?? ui?.createdBy ?? ui?.userId ?? null,
    };
};

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
 * - ここでは boardsPublic を一切触らない。visibility を "public" にし、CF の onWrite に任せる。
 * - 戻り値として決定的 publicId を返す（UI用途）。
 */
export async function publishBoard({
    boardType,      // "myBoards" | "teamBoards"
    ownerId,        // myBoards の uid / teamBoards のオーナー uid（あれば）
    boardId,
    actor,          // { uid }
}) {
    if (!boardType || !boardId) throw new Error("publishBoard: invalid args");

    const srcBoard =
        boardType === "myBoards" ? await getMyBoardById(ownerId, boardId) : await getTeamBoardById(boardId);
    if (!srcBoard) throw new Error("元ボードが見つかりません");

    const ok =
        boardType === "myBoards"
            ? canPublishMyBoard(actor, srcBoard)
            : canPublishTeamBoard(actor, srcBoard);
    if (!ok) throw new Error("公開権限がありません");

    if (boardType === "myBoards") {
        await updateMyBoardVisibility({ userId: ownerId ?? actor?.uid, myBoardId: boardId, nextVisibility: "public" });
    } else {
        await updateTeamBoardVisibility({ userId: actor?.uid, teamBoardId: boardId, nextVisibility: "public" });
    }

    // 触って再集計を促す（CF の onWrite を確実に走らせたい場合）
    try {
        const ref = boardType === "myBoards"
            ? doc(db, "users", ownerId ?? actor?.uid, "myBoards", boardId)
            : doc(db, "teamBoards", boardId);
        await updateDoc(ref, { updatedAt: serverTimestamp() });
    } catch { /* noop */ }

    const publicId = publicIdFromSource({ boardType, ownerId: ownerId ?? srcBoard.ownerId ?? actor?.uid, boardId });
    return { publicId };
}

/**
 * 非公開化（idempotent）
 * - ここでも boardsPublic は一切触らない。visibility を "private" に変更するだけ。
 * - CF が boardsPublic の消去を担当。
 */
export async function unpublishBoard({ boardType, ownerId, boardId, actor }) {
    if (!boardType || !boardId) throw new Error("unpublishBoard: invalid args");

    if (boardType === "myBoards") {
        await updateMyBoardVisibility({ userId: ownerId ?? actor?.uid, myBoardId: boardId, nextVisibility: "private" });
    } else {
        await updateTeamBoardVisibility({ userId: actor?.uid, teamBoardId: boardId, nextVisibility: "private" });
    }

    try {
        const ref = boardType === "myBoards"
            ? doc(db, "users", ownerId ?? actor?.uid, "myBoards", boardId)
            : doc(db, "teamBoards", boardId);
        await updateDoc(ref, { updatedAt: serverTimestamp() });
    } catch { /* noop */ }

    const publicId = publicIdFromSource({ boardType, ownerId: ownerId ?? actor?.uid, boardId });
    return { publicId };
}

/* ──────────────── 2) モデルの保存/削除（ソースのみ） ──────────────── */

/** 参照保存（myBoards / teamBoards） */
export async function saveModelToBoard({
    boardType, ownerId, boardId, actor, model,
}) {
    const { modelRef, referent, sourceUserId } =
        await resolveModelRefAndDoc({ model, actor, ownerId });
    const modelId = modelRef.id;

    // プレビュー（UI > DB実体）。実体からサムネを確実に拾う。
    const preview = buildPreviewFrom({
        ui: { ...model, id: modelId, userId: sourceUserId },
        db: { ...(referent || {}), id: modelId },
    });

    // myBoards の保存先 owner は明示
    const ownerForMy = boardType === "myBoards" ? (ownerId || actor?.uid || sourceUserId) : null;
    if (boardType === "myBoards" && !ownerForMy) {
        throw new Error("saveModelToBoard: cannot resolve myBoards owner uid");
    }

    // ---- TeamBoard の場合: Private モデルをチームメンバーに共有する ----
    if (boardType === "teamBoards" && modelRef?.path && sourceUserId && actor?.uid === sourceUserId) {
        try {
            // ボード情報を取得して members を拾う
            const teamBoard = await getTeamBoardById(boardId);
            const members = Array.isArray(teamBoard?.members) ? teamBoard.members : [];

            // sharedUserIds に追加する UID（自分以外）
            const sharedUids = members.filter((uid) => uid && uid !== sourceUserId);

            if (sharedUids.length) {
                const segments = String(modelRef.path).split("/").filter(Boolean);
                if (segments.length % 2 === 0) {
                    const mDocRef = doc(db, ...segments);
                    await updateDoc(mDocRef, {
                        sharedUserIds: arrayUnion(...sharedUids),
                    });
                }
            }
        } catch (e) {
            console.warn("[saveModelToBoard] failed to update sharedUserIds:", e);
        }
    }

    if (boardType === "myBoards") {
        await addModelToMyBoard({ uid: ownerForMy, boardId, modelRef, preview });
    } else {
        await addModelToTeamBoard({ boardId, modelRef, preview });
    }
}

/** 参照削除（my/team） */
export async function deleteModelFromBoard({ boardType, ownerId, boardId, modelId }) {
    if (!modelId) throw new Error("deleteModelFromBoard: modelId required");

    if (boardType === "myBoards") {
        await removeModelFromMyBoard({ uid: ownerId, boardId, modelId });
    } else {
        await removeModelFromTeamBoard({ boardId, modelId });
    }
}

/* ───────────────────────── 3) 再同期ユースケース（poke のみ） ───────────────────────── */

/**
 * boardsPublic のメタだけ再同期を促す。
 * 実処理は CF に任せ、ここでは source ボードの updatedAt を更新するだけ。
 */
export async function syncPublicBoardMeta({ boardType, ownerId, boardId }) {
    const ref = boardType === "myBoards"
        ? doc(db, "users", ownerId, "myBoards", boardId)
        : doc(db, "teamBoards", boardId);
    await updateDoc(ref, { updatedAt: serverTimestamp() });
    const publicId = publicIdFromSource({ boardType, ownerId, boardId });
    return { publicId };
}

/**
 * boardsPublic/models の再構築を促す。
 * 重いことはしない。updatedAt を触って CF の再集計を期待するだけ。
 */
export async function syncPublicBoardModels({ boardType, ownerId, boardId }) {
    const ref = boardType === "myBoards"
        ? doc(db, "users", ownerId, "myBoards", boardId)
        : doc(db, "teamBoards", boardId);
    await updateDoc(ref, { updatedAt: serverTimestamp() });
    const publicId = publicIdFromSource({ boardType, ownerId, boardId });
    return { publicId };
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

export async function createUserBoard(userId, boardData = {}, boardType = "myBoards") {
    if (boardType === "teamBoards") {
        return createTeamBoard({ userId, name: boardData.name ?? "", members: boardData.members });
    }
    return createMyBoard({ userId, data: boardData });
}

export async function deleteBoardAndModels({ userId, board }) {
    if (!board) return;

    // ---- マイボード ----
    if (board.boardType === "myBoards") {
        // ここは今までどおり
        // await deleteMyBoardAndModels({ userId, boardId: board.id });
        // みたいな既存処理をそのまま
        // ...
        return;
    }

    // ---- チームボード ----
    if (board.boardType === "teamBoards") {
        const ownerId =
            board.ownerId ||
            board.owner ||
            board.createdBy ||
            null;

        // 自分がオーナーなら「本当に削除」
        if (userId && ownerId && userId === ownerId) {
            await deleteTeamBoardIfOwner(userId, board.id);
        } else {
            // オーナーじゃなければ「退出」だけする
            await leaveTeamBoard(userId, board.id);
        }
        return;
    }

    // 万が一 boardType が入ってないときのフォールバック
    // （myBoardsとして消す、とかでもよい）
}

/**
 * 旧 actions.updateBoardOptions 互換:
 * boardOptions の差分を見て各ボードへ参照保存/削除し、
 * 自分の models/{id} に boardOptions を保存する。
 */
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
            boardType: b.boardType,
            ownerId: b.boardType === "myBoards" ? (b.ownerId ?? userId) : b.ownerId,
            boardId: b.id,
            actor: { uid: userId },
            model: { modelId, createdBy: modelUserId },
        });
    }

    for (const boardName of removed) {
        const b = boards?.find((x) => x.name === boardName);
        if (!b) continue;
        await deleteModelFromBoard({
            boardType: b.boardType,
            ownerId: b.boardType === "myBoards" ? (b.ownerId ?? userId) : b.ownerId,
            boardId: b.id,
            modelId,
        });
    }

    if (canWriteUserModel && modelUserId === userId) {
        const ref = doc(db, "users", modelUserId, "models", modelId);
        await setDoc(ref, { boardOptions: newBoardOptions, updatedAt: serverTimestamp() }, { merge: true });
    }
}
