import { doc, collection, query, where } from "firebase/firestore";
import { getBoardDocRef, getBoardItemsColRef, getBoardItemDocRef } from "@layout/shared/utils/boardUtils";


/**
 * URLから projectId を取得し、それに応じて動的にboardのDocumentReferenceを生成する。
 * （Unified v3 schema 対応用ヘルパー）
 */
export const getBoardDocRef = (db, boardId) => {
    if (!boardId) return null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get("projectId");
        if (projectId) {
            return doc(db, "projects", projectId, "boards", boardId);
        }
    } catch (e) {
        /* window not defined etc */
    }
    // Fallback to legacy board collection (v2)
    const colName = "boards";
    return doc(db, colName, boardId);
};

export const getBoardItemsColRef = (db, boardId) => {
    if (!boardId) return null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get("projectId");
        if (projectId) {
            return collection(db, "projects", projectId, "boards", boardId, "items");
        }
    } catch (e) {
        /* window not defined etc */
    }
    // Fallback to legacy
    const colName = "boards";
    return collection(db, colName, boardId, "items");
};

export const getBoardItemDocRef = (db, boardId, itemId) => {
    if (!boardId || !itemId) return null;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get("projectId");
        if (projectId) {
            return doc(db, "projects", projectId, "boards", boardId, "items", itemId);
        }
    } catch (e) {
        /* window not defined etc */
    }
    // Fallback to legacy
    const colName = "boards";
    return doc(db, colName, boardId, "items", itemId);
};

export const getProjectIdFromUrl = () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get("projectId") || null;
    } catch(e) { return null; }
};

export const getBoardIdFromUrl = () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get("boardId") || null;
    } catch(e) { return null; }
};

export const getItemsColRef = (db, projectId) => {
    if (!projectId) return null;
    return collection(db, "projects", projectId, "items");
};

export const getItemsByBoardQuery = (db, projectId, boardId) => {
    if (!projectId) return null;
    const colRef = getItemsColRef(db, projectId);
    if (!boardId) return colRef;
    return query(colRef, where("boardId", "==", boardId));
};
