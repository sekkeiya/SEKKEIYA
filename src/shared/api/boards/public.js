// utils/services/boards/public.js
// 目的: projectShares/* と projectShares/*/models/* に対する "単発CRUDのみ" を提供。
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

/** Source({ boardType, ownerId?, boardId }) から shareId を決定的に返す */
export const getPublicIdBySource = ({ boardType, ownerId, boardId }) => {
    return publicIdFromSource({ boardType, ownerId, boardId });
};

/**
 * projectShares/{shareId} を idempotent に upsert。
 * 受け取った shareId が旧式でも、正規 shareId に“矯正”して保存し、旧式 doc は掃除する。
 */
export const upsertPublicBoard = async ({ shareId, data }) => {
    if (!shareId) throw new Error("[upsertPublicBoard] shareId required");

    // 1) 正規IDへ矯正
    const { canonicalId, ownerId, boardId } = computeCanonicalPublicId({
        incomingId: shareId,
        data,
    });
    const targetId = canonicalId || shareId;

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
            shareId: targetId,
        },
        { merge: true }
    );

    // 3) もし旧式IDで来ていたら、旧 doc を削除（サブコレ含め）
    if (shareId !== targetId) {
        try {
            await deletePublicBoard({ shareId }); // 旧ID
        } catch {
            /* noop */
        }
    }

    return targetId;
};

/** projectShares/{shareId} を削除（サブコレ models も一括削除） */
export const deletePublicBoard = async ({ shareId }) => {
    if (!shareId) throw new Error("[deletePublicBoard] shareId required");
    const col = collection(db, pathPublicBoardModelsCol(shareId));
    const snap = await getDocs(col);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, pathPublicBoard(shareId)));
    await batch.commit();
};

/** projectShares/{shareId} が存在するか取得 */
export const getPublicBoard = async ({ shareId }) => {
    const ref = doc(db, pathPublicBoard(shareId));
    const snap = await getDoc(ref);
    return { exists: snap.exists(), data: snap.exists() ? snap.data() : null, ref };
};

/* =========
 * Models (サブコレ)
 * ========= */

/** projectShares/{shareId}/models/{modelId} を upsert */
export const upsertPublicBoardModel = async ({
    shareId,
    modelId,
    modelRef, // { id, path }
    addedBy,  // uid
    savedAt,  // optional
    summary = {}, // {title, thumbnailUrl ...}
}) => {
    if (!shareId || !modelId || !modelRef?.id || !modelRef?.path) {
        throw new Error("[upsertPublicBoardModel] invalid args");
    }
    const ref = doc(db, pathPublicBoardModel(shareId, modelId));
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

/** projectShares/{shareId}/models/{modelId} を削除 */
export const deletePublicBoardModel = async ({ shareId, modelId }) => {
    if (!shareId || !modelId) throw new Error("[deletePublicBoardModel] invalid args");
    await deleteDoc(doc(db, pathPublicBoardModel(shareId, modelId)));
};

/** projectShares/{shareId} の publicModelCount をサブコレ件数で再集計 */
export const recountPublicModelCount = async ({ shareId }) => {
    const col = collection(db, pathPublicBoardModelsCol(shareId));
    const snap = await getDocs(col);
    const count = snap.size;
    await setDoc(
        doc(db, pathPublicBoard(shareId)),
        { publicModelCount: count, updatedAt: serverTimestamp() },
        { merge: true }
    );
    return count;
};

/* =========
 * 既存互換: 柔軟削除
 * ========= */

export const removeFromBoardsPublicBySource = async ({ shareId, boardType, sourceBoardId, ownerId }) => {
    if (shareId) {
        await deletePublicBoard({ shareId });
        return 1;
    }
    // 決定的IDで一意に到達
    try {
        const pid = getPublicIdBySource({ boardType, ownerId, boardId: sourceBoardId });
        const { exists } = await getPublicBoard({ shareId: pid });
        if (exists) {
            await deletePublicBoard({ shareId: pid });
            return 1;
        }
        // 旧式ID（ownerId_boardId）も念のため掃除
        const legacy = `${ownerId}_${sourceBoardId}`;
        const { exists: exLegacy } = await getPublicBoard({ shareId: legacy });
        if (exLegacy) {
            await deletePublicBoard({ shareId: legacy });
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
