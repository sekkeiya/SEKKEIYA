// utils/services/boards/public.js
// 目的: boardsPublic/* と boardsPublic/*/models/* に対する "単発CRUDのみ" を提供。
// 集計/分岐/同期の調停は actions.js 側で行う。

import {
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    collection,
    getDocs,
    serverTimestamp,
    writeBatch,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import {
    publicIdFromSource,
    pathPublicBoard,
    pathPublicBoardModel,
    pathPublicBoardModelsCol,
} from "./paths";

/* =========
 * Helpers
 * ========= */

function parseFromSourcePath(path = "") {
    // users/{uid}/myBoards/{bid} or teamBoards/{bid}
    const seg = String(path).split("/").filter(Boolean);
    if (seg[0] === "users" && seg[2] === "myBoards") {
        return { boardType: "myBoards", ownerId: seg[1], boardId: seg[3] };
    }
    if (seg[0] === "teamBoards") {
        return { boardType: "teamBoards", ownerId: undefined, boardId: seg[1] };
    }
    return {};
}

function computeCanonicalPublicId({ incomingId, data }) {
    // ownerId / boardId / boardType を data からできるだけ抽出
    const s = data?.source || {};
    const fromPath = parseFromSourcePath(s.path);

    const ownerId =
        data?.sourceOwnerId || data?.ownerId || s.ownerId || fromPath.ownerId || "";
    const boardId = data?.sourceBoardId || s.boardId || fromPath.boardId || "";
    const boardType = data?.boardType || s.boardType || fromPath.boardType || "myBoards";

    if (!ownerId && boardType === "myBoards") return { canonicalId: incomingId }; // 足りない場合は諦め

    const canonicalId = publicIdFromSource({ boardType, ownerId, boardId });
    return { canonicalId, ownerId, boardId, boardType };
}

/* =========
 * Boards (本体)
 * ========= */

/** Source({ boardType, ownerId?, boardId }) から publicId を決定的に返す */
export const getPublicIdBySource = ({ boardType, ownerId, boardId }) => {
    return publicIdFromSource({ boardType, ownerId, boardId });
};

/**
 * boardsPublic/{publicId} を idempotent に upsert。
 * 受け取った publicId が旧式でも、正規 publicId に“矯正”して保存し、旧式 doc は掃除する。
 */
export const upsertPublicBoard = async ({ publicId, data }) => {
    if (!publicId) throw new Error("[upsertPublicBoard] publicId required");

    // 1) 正規IDへ矯正
    const { canonicalId, ownerId, boardId } = computeCanonicalPublicId({
        incomingId: publicId,
        data,
    });
    const targetId = canonicalId || publicId;

    // 2) 本体 upsert（必ず visibility/public & updatedAt を持たせる）
    const ref = doc(db, pathPublicBoard(targetId));
    await setDoc(
        ref,
        {
            visibility: "public",
            updatedAt: serverTimestamp(),
            // 逆引き/重複抑止用のメタをできるだけ残す
            sourceBoardId: data?.sourceBoardId ?? data?.source?.boardId ?? boardId ?? null,
            sourceOwnerId: data?.sourceOwnerId ?? data?.ownerId ?? data?.source?.ownerId ?? ownerId ?? null,
            ...data, // name, description, ownerId, ownerName, coverImageUrl, source:{...}, publishedAt など
            publicId: targetId,
        },
        { merge: true }
    );

    // 3) もし旧式IDで来ていたら、旧 doc を削除（サブコレ含め）
    if (publicId !== targetId) {
        try {
            await deletePublicBoard({ publicId }); // 旧ID
        } catch {
            /* noop */
        }
    }

    return targetId;
};

/** boardsPublic/{publicId} を削除（サブコレ models も一括削除） */
export const deletePublicBoard = async ({ publicId }) => {
    if (!publicId) throw new Error("[deletePublicBoard] publicId required");
    const col = collection(db, pathPublicBoardModelsCol(publicId));
    const snap = await getDocs(col);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, pathPublicBoard(publicId)));
    await batch.commit();
};

/** boardsPublic/{publicId} が存在するか取得 */
export const getPublicBoard = async ({ publicId }) => {
    const ref = doc(db, pathPublicBoard(publicId));
    const snap = await getDoc(ref);
    return { exists: snap.exists(), data: snap.exists() ? snap.data() : null, ref };
};

/* =========
 * Models (サブコレ)
 * ========= */

/** boardsPublic/{publicId}/models/{modelId} を upsert */
export const upsertPublicBoardModel = async ({
    publicId,
    modelId,
    modelRef, // { id, path }
    addedBy,  // uid
    savedAt,  // optional
    summary = {}, // {title, thumbnailUrl ...}
}) => {
    if (!publicId || !modelId || !modelRef?.id || !modelRef?.path) {
        throw new Error("[upsertPublicBoardModel] invalid args");
    }
    const ref = doc(db, pathPublicBoardModel(publicId, modelId));
    await setDoc(
        ref,
        {
            modelRef,
            addedBy: addedBy || null,
            savedAt: savedAt || serverTimestamp(),
            ...summary,
        },
        { merge: true }
    );
};

/** boardsPublic/{publicId}/models/{modelId} を削除 */
export const deletePublicBoardModel = async ({ publicId, modelId }) => {
    if (!publicId || !modelId) throw new Error("[deletePublicBoardModel] invalid args");
    await deleteDoc(doc(db, pathPublicBoardModel(publicId, modelId)));
};

/** boardsPublic/{publicId} の publicModelCount をサブコレ件数で再集計 */
export const recountPublicModelCount = async ({ publicId }) => {
    const col = collection(db, pathPublicBoardModelsCol(publicId));
    const snap = await getDocs(col);
    const count = snap.size;
    await setDoc(
        doc(db, pathPublicBoard(publicId)),
        { publicModelCount: count, updatedAt: serverTimestamp() },
        { merge: true }
    );
    return count;
};

/* =========
 * 既存互換: 柔軟削除
 * ========= */

export const removeFromBoardsPublicBySource = async ({ publicId, boardType, sourceBoardId, ownerId }) => {
    if (publicId) {
        await deletePublicBoard({ publicId });
        return 1;
    }
    // 決定的IDで一意に到達
    try {
        const pid = getPublicIdBySource({ boardType, ownerId, boardId: sourceBoardId });
        const { exists } = await getPublicBoard({ publicId: pid });
        if (exists) {
            await deletePublicBoard({ publicId: pid });
            return 1;
        }
        // 旧式ID（ownerId_boardId）も念のため掃除
        const legacy = `${ownerId}_${sourceBoardId}`;
        const { exists: exLegacy } = await getPublicBoard({ publicId: legacy });
        if (exLegacy) {
            await deletePublicBoard({ publicId: legacy });
            return 1;
        }
        return 0;
    } catch {
        return 0;
    }
};

/* =========
 * compat proxies for old imports
 * ========= */
// 既存コードが public.js から publishBoard/unpublishBoard を import しても動くようにする。
// 実体は actions.js の実装を動的 import して呼び出す。
export async function publishBoard(params) {
    const mod = await import("./actions");
    return mod.publishBoard(params);
}

export async function unpublishBoard(params) {
    const mod = await import("./actions");
    return mod.unpublishBoard(params);
}
