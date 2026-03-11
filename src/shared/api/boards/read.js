// src/utils/services/boards/read.js
import {
    doc, getDoc, query, where, collection, getDocs,
    orderBy, limit, startAfter,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

// （あれば使う）paths ヘルパ。未実装でも動くようにフォールバックします。
let paths = {};
try {
    paths = await import("./paths");
} catch { /* optional */ }

const pathMyBoard = (uid, bid) =>
    paths?.pathMyBoard ? paths.pathMyBoard(uid, bid) : `users/${uid}/myBoards/${bid}`;
const pathTeamBoard = (bid) =>
    paths?.pathTeamBoard ? paths.pathTeamBoard(bid) : `teamBoards/${bid}`;
const pathBoardModelsCol = ({ boardType, ownerId, boardId }) => {
    if (paths?.pathBoardModelsCol) return paths.pathBoardModelsCol({ boardType, ownerId, boardId });
    return boardType === "myBoards"
        ? `users/${ownerId}/myBoards/${boardId}/models`
        : `teamBoards/${boardId}/models`;
};

/* ----------------------------------------------------------------------------
 * 公開ボード一覧
 * --------------------------------------------------------------------------*/
/**
 * 公開ボード一覧
 * - where: visibility == public, publicModelCount >= 0
 * - sortKey: "latest" | "models" | "name"
 * - cursor: Firestore の docSnapshot（前ページの最後の doc）
 */
export const getPublicBoards = async ({ pageSize = 24, cursor = null, sortKey = "latest" }) => {
    const col = collection(db, "boardsPublic");

    // 不等号フィルタがあるので最初の orderBy は publicModelCount に合わせる
    const filters = [
        where("visibility", "==", "public"),
        where("publicModelCount", ">=", 0), // 緩和
    ];

    const buildIndexedQuery = () => {
        let orders;
        if (sortKey === "models") {
            // モデル数順（同率安定のため updatedAt を第2キー）
            orders = [orderBy("publicModelCount", "desc"), orderBy("updatedAt", "desc")];
        } else if (sortKey === "name") {
            // 名前順（不等号の制約で publicModelCount を最初に）
            orders = [orderBy("publicModelCount", "asc"), orderBy("name", "asc"), orderBy("updatedAt", "desc")];
        } else {
            // 新着順（同上の理由で publicModelCount を最初に）
            orders = [orderBy("publicModelCount", "asc"), orderBy("updatedAt", "desc")];
        }

        let q = query(col, ...filters, ...orders, limit(pageSize));
        if (cursor) q = query(col, ...filters, ...orders, startAfter(cursor), limit(pageSize));
        return q;
    };

    // フォールバック：インデックス未準備（failed-precondition）の時だけ使う
    const buildFallbackQuery = () => {
        let q = query(col, ...filters, orderBy("publicModelCount", "desc"), limit(pageSize));
        if (cursor) q = query(col, ...filters, orderBy("publicModelCount", "desc"), startAfter(cursor), limit(pageSize));
        return q;
    };

    try {
        const snap = await getDocs(buildIndexedQuery());
        const items = snap.docs.map(d => ({ id: d.id, ...d.data(), __snap: d }));
        const nextCursor = snap.docs.at(-1) ?? null;
        return { items, nextCursor };
    } catch (e) {
        if (String(e?.code) !== "failed-precondition") throw e;

        const snap = await getDocs(buildFallbackQuery());
        let items = snap.docs.map(d => ({ id: d.id, ...d.data(), __snap: d }));

        // クライアント側で最終ソート
        if (sortKey === "latest") {
            items.sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
        } else if (sortKey === "models") {
            items.sort((a, b) =>
                (b.publicModelCount ?? 0) - (a.publicModelCount ?? 0) ||
                (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0)
            );
        } else if (sortKey === "name") {
            items.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
        }

        const nextCursor = snap.docs.at(-1) ?? null;
        return { items, nextCursor };
    }
};

/* ----------------------------------------------------------------------------
 * 単一ボード取得
 * --------------------------------------------------------------------------*/

/** users/{uid}/myBoards/{boardId} を1件取得（存在しなければ null） */
export const getMyBoardById = async (uid, boardId) => {
    if (!uid || !boardId) return null;
    const snap = await getDoc(doc(db, ...pathMyBoard(uid, boardId).split("/")));
    return snap.exists() ? { id: snap.id, ...snap.data(), boardType: "myBoards", ownerId: uid } : null;
};

/** teamBoards/{boardId} を1件取得（存在しなければ null） */
export const getTeamBoardById = async (boardId) => {
    if (!boardId) return null;
    const snap = await getDoc(doc(db, ...pathTeamBoard(boardId).split("/")));
    return snap.exists() ? { id: snap.id, ...snap.data(), boardType: "teamBoards" } : null;
};

/* ----------------------------------------------------------------------------
 * ボード配下モデルの一覧（参照レコード）※“参照”のみ。元モデルの中身は別APIで取る
 * --------------------------------------------------------------------------*/
/**
 * listBoardModels
 * - 返すのは「ボード配下の参照ドキュメント」の配列
 * - 元モデルの詳細は `getModelByRefPath(path)` で必要時に取得
 */
export const listBoardModels = async ({ boardType, ownerId, boardId }) => {
    if (!boardType || !boardId) return [];
    const colPath = pathBoardModelsCol({ boardType, ownerId, boardId });
    const snap = await getDocs(collection(db, ...colPath.split("/")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/* ----------------------------------------------------------------------------
 * 参照パスから元モデルを取得（存在しなければ null）
 * --------------------------------------------------------------------------*/
export const getModelByRefPath = async (path) => {
    if (!path || typeof path !== "string") return null;
    const seg = path.split("/").filter(Boolean);
    if (seg.length % 2 !== 0) return null; // ドキュメントパスでない
    const snap = await getDoc(doc(db, ...seg));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/* ----------------------------------------------------------------------------
 * 既存の補助関数（そのまま/一部流用）
 * --------------------------------------------------------------------------*/
export const fetchUserBoards = async (userId, boardType = "myBoards") => {
    if (boardType === "teamBoards") {
        const q = query(collection(db, "teamBoards"), where("members", "array-contains", userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id, ...docSnap.data(), boardType: "teamBoards",
        }));
    } else {
        const snapshot = await getDocs(collection(db, "users", userId, "myBoards"));
        return snapshot.docs.map((docSnap) => ({
            id: docSnap.id, owner: userId, ...docSnap.data(), boardType: "myBoards",
        }));
    }
};

export const fetchAllUserBoards = async (userId) => {
    const mySnap = await getDocs(collection(db, "users", userId, "myBoards"));
    const myBoards = mySnap.docs.map((d) => ({
        id: d.id, boardType: "myBoards", ...d.data(),
    }));

    const linkSnap = await getDocs(collection(db, "users", userId, "teamBoards"));
    const linkMap = new Map(linkSnap.docs.map((d) => [d.id, d.data()]));
    const globalSnaps = await Promise.all(
        [...linkMap.keys()].map((id) => getDoc(doc(db, "teamBoards", id)))
    );

    const teamBoards = globalSnaps
        .filter((s) => s.exists())
        .map((s) => {
            const id = s.id;
            const global = s.data();
            const link = linkMap.get(id) || {};
            return {
                id, boardType: "teamBoards",
                ...global,
                showInSidebar: link.showInSidebar ?? false,
            };
        });

    return [...myBoards, ...teamBoards];
};

/**
 * 互換: こちらは“元モデルまで解決して返す”実装。
 * actions の設計では listBoardModels + getModelByRefPath を推奨。
 */
export const fetchModelsForBoard = async (board, userId) => {
    if (!board || !board.id || !board.boardType) return [];
    let modelsRef;

    if (board.boardType === "myBoards") {
        modelsRef = collection(db, "users", userId, "myBoards", board.id, "models");
    } else if (board.boardType === "teamBoards") {
        modelsRef = collection(db, "teamBoards", board.id, "models");
    } else {
        return [];
    }

    const snapshot = await getDocs(modelsRef);
    const models = [];

    for (const docSnap of snapshot.docs) {
        const data = docSnap.data() || {};
        const savedDocId = docSnap.id;

        // 参照先モデルを解決できるなら使う
        if (data?.modelRef?.path) {
            try {
                const seg = data.modelRef.path.split("/").filter(Boolean);
                if (seg.length % 2 === 0) {
                    const origSnap = await getDoc(doc(db, ...seg));
                    if (origSnap.exists()) {
                        const originalData = origSnap.data();
                        models.push({
                            id: origSnap.id,
                            savedDocId,
                            title: originalData.title || originalData.name || "Untitled",
                            thumbnailFilePath: originalData.thumbnailFilePath || null,
                            ...originalData,
                            boardOptions: data.boardOptions ?? [],
                            savedAt: data.savedAt,
                            modelRef: data.modelRef,
                        });
                        continue;
                    }
                }
            } catch {
                // 読めない（非公開/権限）→ フォールバックへ
            }

            // ★ フォールバック：参照先が読めなくても行は返す
            models.push({
                id: data.modelRef.id || savedDocId,
                savedDocId,
                title: data.title || data.name || "非公開（閲覧権限なし）",
                thumbnailFilePath: null,
                boardOptions: data.boardOptions ?? [],
                savedAt: data.savedAt,
                modelRef: data.modelRef,
                _unavailable: true,
            });
            continue;
        }

        // 古い形式（modelRef なし）はそのまま返す
        models.push({ id: savedDocId, ...data });
    }

    return models;
};