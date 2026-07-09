// src/utils/services/boards/teamBoards.js
// 役割: teamBoards/* と配下 models/* への "単発 CRUD のみ" を提供。
// projectShares/* など他コレクションの調停は actions.js 側で行う。

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    updateDoc,
    increment,
    query as fsQuery,
    where,
    writeBatch,
    limit as fsLimit,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { planLimits } from "../../constants/planLimits";
import { canOwnMorePrivateTeamBoards } from "../../utils/planLimitCheckers";
import { getGlobalDb } from "../firebaseDb";
import { ensureProjectForBoard } from "../projects.js";

const splitPath = (p) => String(p || "").split("/").filter(Boolean);

/* ───────────────────────── helpers ───────────────────────── */

// 実体/プレビュー/画像配列からサムネURLを抽出（キー揺れ吸収）
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

/** @や空白を取り除いたハンドルを返す（なければ null） */
const normalizeHandle = (raw) => {
    if (!raw) return null;
    const h = String(raw).trim().replace(/^@+/, "");
    return h || null;
};

/** 受け取った preview と modelRef の参照先ドキュメントから、保存用のプレビューを構築 */
async function buildPreviewPayload({ preview = {}, modelRef }) {
    const base = {
        id: preview?.id ?? modelRef?.id ?? null,
        title: preview?.title ?? preview?.name ?? null,
        brand: preview?.brand ?? null,
        author: preview?.author ?? null,
        thumbnailUrl: preview?.thumbnailUrl ?? preview?.thumbUrl ?? null,
    };

    // 足りない項目がある場合のみ、参照先を1回だけ読む
    if (!base.title || !base.thumbnailUrl || base.brand == null || !base.author) {
        try {
            const seg = splitPath(modelRef?.path);
            if (seg.length % 2 === 0) {
                const snap = await getDoc(doc(getGlobalDb(), ...seg));
                if (snap.exists()) {
                    const m = { id: snap.id, ...snap.data() };

                    base.title =
                        base.title ??
                        m.title ??
                        m.name ??
                        m.preview?.title ??
                        "Model";

                    base.author =
                        base.author ??
                        m.author ??
                        m.createdByName ??
                        m.ownerName ??
                        m.createdBy ??
                        m.preview?.author ??
                        "";

                    base.brand =
                        base.brand ??
                        m.brand ??
                        (Array.isArray(m.brands) ? m.brands[0] : null) ??
                        m.preview?.brand ??
                        null;

                    base.thumbnailUrl = base.thumbnailUrl ?? (getThumbFromModelLike(m) || null);
                }
            }
        } catch {
            // 読み失敗時は無理に詰めない（nullのまま）
        }
    }

    return {
        id: base.id,
        title: base.title ?? null,
        brand: base.brand ?? null,
        author: base.author ?? null,
        thumbnailUrl: base.thumbnailUrl ?? null,
    };
}

/** クライアント側でコレクションを安全に分割削除 */
async function deleteCollectionByChunks(collRef, perBatch = 450) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const page = await getDocs(fsQuery(collRef, fsLimit(perBatch)));
        if (page.empty) break;

        const batch = writeBatch(getGlobalDb());
        page.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        await new Promise((r) => setTimeout(r, 10));
    }
}

/** projectShares ミラーの削除 */
async function deleteBoardsPublicMirrorForTeamBoard({ boardId, boardSnap }) {
    if (!boardId) return;

    try {
        const data = boardSnap?.data ? boardSnap.data() : boardSnap || {};
        const publicId = data?.publicId || data?.projectSharesId;
        if (publicId) {
            await deleteDoc(doc(getGlobalDb(), "projectShares", publicId));
        }
    } catch {
        /* no-op */
    }

    try {
        const q = fsQuery(
            collection(getGlobalDb(), "projectShares"),
            where("teamBoardId", "==", boardId),
            fsLimit(20)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            const batch = writeBatch(getGlobalDb());
            snap.forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    } catch {
        /* no-op */
    }
}

/* ============================== C: Create ============================== */
export const createTeamBoard = async ({ userId, name, members }) => {
    const userRef = doc(getGlobalDb(), "users", userId);
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

    const timestamp = serverTimestamp();
    const unifiedColRef = collection(getGlobalDb(), "boards");
    const unifiedRef = doc(unifiedColRef);
    const newBoardId = unifiedRef.id;

    const unifiedPayload = {
        name,
        ownerId: userId,
        ownerName: handle,
        memberIds: Array.isArray(members) && members.length ? members : [userId],
        visibility: "public",
        boardType: "teamBoards",
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
        await updateDoc(userRef, { teamBoardCreateCount: increment(1) });
    } catch {
        /* ignore */
    }

    return { id: newBoardId, ...unifiedPayload };
};

/* ============================== R: Read ============================== */
export const getTeamBoardById = async (boardId) => {
    if (!boardId) return null;
    const snap = await getDoc(doc(getGlobalDb(), "boards", boardId));
    if (!snap.exists()) return null;

    const board = { id: snap.id, ...snap.data() };
    if (!board.projectId) {
        board.projectId = await ensureProjectForBoard(board);
    }
    return board;
};

export const subscribeTeamBoard = (teamBoardId, callback) => {
    if (!teamBoardId || typeof callback !== "function") {
        throw new Error("subscribeTeamBoard: teamBoardId/callback が必要です");
    }
    const ref = doc(getGlobalDb(), "boards", teamBoardId);
    return onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
            callback(null);
            return;
        }
        const board = { id: snap.id, ...snap.data() };
        if (!board.projectId) {
            ensureProjectForBoard(board).catch(console.error);
        }
        callback(board);
    });
};

/* ============================== U: Update ============================== */
export const updateTeamBoardName = async (userId, boardId, newName) => {
    const unifiedBoardRef = doc(getGlobalDb(), "boards", boardId);
    await updateDoc(unifiedBoardRef, { name: newName, updatedAt: serverTimestamp() });
};

export const updateTeamBoardInfo = async (boardId, updated) => {
    const payload = Object.fromEntries(
        Object.entries(updated || {}).filter(
            ([k]) => !["visibility", "owner", "ownerId", "isPublic", "isPrivate", "publicMode"].includes(k)
        )
    );
    if (!Object.keys(payload).length) return;
    payload.updatedAt = serverTimestamp();
    await updateDoc(doc(getGlobalDb(), "boards", boardId), payload);
};

export const toggleTeamBoardShowInSidebar = async (userId, _planId, boardId, currentValue) => {
    return { ok: true, changed: false };
};

export const updateTeamBoardVisibility = async ({
    userId,
    teamBoardId,
    nextVisibility,
    planId,
}) => {
    if (!userId || !teamBoardId) throw new Error("userId/teamBoardId が必要です");

    const unifiedBoardRef = doc(getGlobalDb(), "boards", teamBoardId);
    const snap = await getDoc(unifiedBoardRef);
    if (!snap.exists()) throw new Error("ボードが存在しません");
    
    const currentVis = snap.data()?.visibility ?? "public";
    const nextPublic = typeof nextVisibility === "string" ? nextVisibility === "public" : Boolean(nextVisibility);
    const nextVis = nextPublic ? "public" : "private";
    if (currentVis === nextVis) return;

    const ownerUid = snap.data()?.ownerId;
    if (!nextPublic && ownerUid === userId) {
        const ok = await canOwnMorePrivateTeamBoards(userId, String(planId || "free").toLowerCase());
        if (!ok) throw new Error("非公開チームボードの上限に達しています。プランの上限を確認してください。");
    }

    await updateDoc(unifiedBoardRef, { visibility: nextVis, updatedAt: serverTimestamp() });
};

/* ============================== D: Delete ============================== */
export const deleteTeamBoardIfOwner = async (userId, boardId) => {
    const unifiedBoardRef = doc(getGlobalDb(), "boards", boardId);
    const snap = await getDoc(unifiedBoardRef);
    if (!snap.exists()) throw new Error("ボードが存在しません");
    
    const ownerUid = snap.data()?.ownerId;
    if (ownerUid !== userId) throw new Error("この操作はオーナーのみ実行可能です");

    await updateDoc(unifiedBoardRef, {
        deleted: true,
        deletedBy: userId,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });

    await deleteCollectionByChunks(collection(getGlobalDb(), "boards", boardId, "items"), 450);

    await deleteBoardsPublicMirrorForTeamBoard({ boardId, boardSnap: snap });

    let deletedGlobally = false;
    try {
        await deleteDoc(unifiedBoardRef);
        deletedGlobally = true;
    } catch (e) {
        console.warn("[deleteTeamBoardIfOwner] global delete skipped (members remain?):", e);
    }

    try {
        await updateDoc(doc(getGlobalDb(), "users", userId), { teamBoardCreateCount: increment(-1) });
    } catch {
        /* ignore */
    }

    return { ok: true, deletedGlobally };
};

/* ============ Models under teamBoards ============ */
export const addModelToTeamBoard = async ({
    boardId,
    modelRef,
    preview = {},
}) => {
    if (!boardId || !modelRef?.id || !modelRef?.path) throw new Error("addModelToTeamBoard: 引数不足");
    const modelId = modelRef.id;

    const unifiedItemsColRef = collection(getGlobalDb(), "boards", boardId, "items");
    const unifiedItemRef = doc(unifiedItemsColRef);
    const unifiedBoardRef = doc(getGlobalDb(), "boards", boardId);

    const previewPayload = await buildPreviewPayload({ preview: { ...preview, id: modelId }, modelRef });
    const timestamp = serverTimestamp();

    const batch = writeBatch(getGlobalDb());

    batch.set(
        unifiedItemRef,
        {
            boardId,
            itemType: "model",
            entityId: modelId,
            itemRef: modelRef.path || `models/${modelId}`,
            addedBy: previewPayload.createdBy || previewPayload.userId || null,
            sortOrder: 0,
            schemaVersion: 2,
            snapshot: {
                title: previewPayload.title || previewPayload.name || null,
                thumbnailUrl: previewPayload.thumbnailUrl || previewPayload.thumbUrl || null,
                previewType: "3d"
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
            coverThumbnailUrl: previewPayload.thumbnailUrl || previewPayload.thumbUrl || null,
            coverItemId: modelId,
            lastActivityAt: timestamp,
            updatedAt: timestamp,
        },
        { merge: true }
    );

    await batch.commit();

};

export const removeModelFromTeamBoard = async ({ boardId, modelId }) => {
    if (!boardId || !modelId) throw new Error("removeModelFromTeamBoard: 引数不足");
    const unifiedBoardRef = doc(getGlobalDb(), "boards", boardId);

    let unifiedItemDocs = [];
    try {
        const q = fsQuery(
            collection(getGlobalDb(), "boards", boardId, "items"),
            where("entityId", "==", modelId),
            where("itemType", "==", "model")
        );
        const snap = await getDocs(q);
        unifiedItemDocs = snap.docs;
    } catch { /* ignore */ }

    const batch = writeBatch(getGlobalDb());
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

/* ============================== Membership ============================== */
export const leaveTeamBoard = async (userId, boardId) => {
    if (!userId || !boardId) return;

    const boardRef = doc(getGlobalDb(), "boards", boardId);

    try {
        const snap = await getDoc(boardRef);
        if (snap.exists()) {
            const data = snap.data() || {};
            const curMembers = Array.isArray(data.memberIds) ? data.memberIds : [];
            const nextMembers = curMembers.filter((m) => m !== userId);
            
            await updateDoc(boardRef, {
                memberIds: nextMembers,
                updatedAt: serverTimestamp(),
            });
        }
    } catch (e) {
        console.warn("[leaveTeamBoard] update memberIds failed:", e);
    }

    try {
        await updateDoc(doc(getGlobalDb(), "users", userId), {
            teamBoardJoinCount: increment(-1),
        });
    } catch { /* ignore */ }
};

/* ============================== Invitations ============================== */
export const createTeamBoardInvitation = async ({
    teamBoardId,
    teamBoardName,
    inviteeEmail,
    inviteeUid,
    invitedBy,
    inviterName,
    inviterEmail,
}) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("ログインが必要です");

    if (!teamBoardId) throw new Error("teamBoardId is required");

    const inviterUid = invitedBy || currentUser.uid;
    const globalRef = doc(collection(getGlobalDb(), "teamBoardInvitations"));
    const invitationId = globalRef.id;

    const basePayload = {
        id: invitationId,
        teamBoardId,
        teamBoardName: teamBoardName ?? "",
        invitedBy: inviterUid,
        inviterId: inviterUid,
        inviterName: inviterName || currentUser.displayName || "",
        inviterEmail: inviterEmail || currentUser.email || "",
        status: "pending",
        createdAt: serverTimestamp(),
    };

    if (inviteeUid) {
        const payload = { ...basePayload, inviteeUid };
        const userMirrorRef = doc(getGlobalDb(), "users", inviteeUid, "teamBoardInvitations", invitationId);
        await setDoc(userMirrorRef, payload);
        await setDoc(globalRef, payload);
        return invitationId;
    }

    const email = String(inviteeEmail || "").trim();
    if (!email) throw new Error("inviteeUid か inviteeEmail のどちらかが必要です");
    
    const emailLower = email.toLowerCase();
    const payload = {
        ...basePayload,
        inviteeEmail: email,
        inviteeEmailLower: emailLower,
    };

    await setDoc(globalRef, payload);
    return invitationId;
};

export const acceptTeamBoardInvitation = async ({ invitationId }) => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("ログインが必要です");

    const invRef = doc(getGlobalDb(), "teamBoardInvitations", invitationId);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) throw new Error("招待情報が存在しません");
    const invData = invSnap.data() || {};
    const teamBoardId = invData.teamBoardId;
    if (!teamBoardId) throw new Error("teamBoardId が取得できませんでした");

    const userRef = doc(getGlobalDb(), "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("ユーザーデータが存在しません");
    const userData = userSnap.data() || {};
    const planId = (userData.plan || "free").toLowerCase();
    const limit = planLimits[planId]?.teamBoardJoinLimit;
    const current = userData.teamBoardJoinCount ?? 0;
    if (limit != null && current >= limit) {
        throw new Error(`このプランでは参加上限（${limit}件）に達しています`);
    }

    await updateDoc(invRef, {
        status: "accepted",
        acceptedBy: userId,
        acceptedAt: serverTimestamp(),
    });

    if (invData.inviteeUid) {
        const userMirrorRef = doc(getGlobalDb(), "users", invData.inviteeUid, "teamBoardInvitations", invitationId);
        try {
            await updateDoc(userMirrorRef, {
                status: "accepted",
                acceptedBy: userId,
                acceptedAt: serverTimestamp(),
            });
        } catch {}
    }
};

export const declineTeamBoardInvitation = async (invitationId) => {
    const auth = getAuth();
    const userId = auth.currentUser?.uid;

    const invRef = doc(getGlobalDb(), "teamBoardInvitations", invitationId);
    const invSnap = await getDoc(invRef);
    if (!invSnap.exists()) {
        if (userId) {
            try {
                await deleteDoc(doc(getGlobalDb(), "users", userId, "teamBoardInvitations", invitationId));
            } catch {}
        }
        return;
    }
    const invData = invSnap.data() || {};

    await updateDoc(invRef, { status: "declined" });

    if (invData.inviteeUid) {
        try {
            await updateDoc(
                doc(getGlobalDb(), "users", invData.inviteeUid, "teamBoardInvitations", invitationId),
                { status: "declined" }
            );
        } catch {}
    }
};
