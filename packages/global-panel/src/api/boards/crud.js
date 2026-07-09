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
    limit as fsLimit
} from "firebase/firestore";
import { getGlobalDb } from "../firebaseDb";

const normalizeHandle = (raw) => {
    if (!raw) return null;
    const h = String(raw).trim().replace(/^@+/, "");
    return h || null;
};

async function deleteCollectionByChunks(collRef, perBatch = 450) {
    const db = getGlobalDb();
    while (true) {
        const snap = await getDocs(query(collRef, fsLimit(perBatch)));
        if (snap.empty) break;

        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        if (snap.size < perBatch) break;
    }
}

export const createBoard = async ({ userId, data = {} }) => {
    if (!userId) throw new Error("createBoard: userId が必要です");
    const db = getGlobalDb();

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

    const memberIds = Array.isArray(data.members) && data.members.length > 0 
        ? data.members 
        : [userId];

    const sanitized = Object.fromEntries(
        Object.entries(data).filter(
            ([k]) => !["visibility", "isPublic", "isPrivate", "owner", "ownerId", "publicMode", "members", "boardType"].includes(k)
        )
    );

    const timestamp = serverTimestamp();
    const unifiedColRef = collection(db, "boards");
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

export const updateBoardInfo = async (boardId, updatedFields) => {
    const db = getGlobalDb();
    const unifiedBoardRef = doc(db, "boards", boardId);
    const sanitized = Object.fromEntries(
        Object.entries(updatedFields || {}).filter(
            ([k]) => !["visibility", "owner", "ownerId", "isPublic", "isPrivate", "publicMode", "boardType"].includes(k)
        )
    );
    if (!Object.keys(sanitized).length) return;
    await updateDoc(unifiedBoardRef, { ...sanitized, updatedAt: serverTimestamp() });
};

export const deleteBoardAndItems = async (userId, boardId) => {
    if (!userId || !boardId) throw new Error("userId/boardId が必要です");
    const db = getGlobalDb();

    const unifiedBoardRef = doc(db, "boards", boardId);
    const snap = await getDoc(unifiedBoardRef);
    if (!snap.exists()) return;

    const ownerUid = snap.data()?.ownerId;
    if (ownerUid !== userId) throw new Error("この操作はオーナーのみ実行可能です");

    await deleteCollectionByChunks(collection(db, "boards", boardId, "items"), 450);
    await deleteDoc(unifiedBoardRef);
};
