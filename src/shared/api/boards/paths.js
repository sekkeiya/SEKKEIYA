// utils/services/boards/paths.js

/* =========================
 *  Public ID 生成・分解
 * ========================= */

/** boardsPublic の publicId を決定的に生成 */
export const publicIdFromSource = ({ boardType, ownerId, boardId }) => {
    if (boardType === "myBoards") {
        // 将来もこれを“正”とする
        return `${ownerId}__my__${boardId}`;
    }
    // teamBoards 側はチームIDだけ（既存運用に合わせる）
    return `${boardId}`;
};

/** publicId を分解（必要なら） */
export const parsePublicId = (publicId = "") => {
    if (publicId.startsWith("team__")) {
        return { boardType: "teamBoards", ownerId: null, boardId: publicId.slice("team__".length) };
    }
    const [ownerId, kind, boardId] = publicId.split("__");
    if (kind === "my") return { boardType: "myBoards", ownerId, boardId };
    return { boardType: null, ownerId: null, boardId: null };
};

/* =========================
 *  コレクション/ドキュメント パス
 * ========================= */

// MyBoards 本体 / モデル
export const pathMyBoardsCol = (uid) => `users/${uid}/myBoards`;
export const pathMyBoard = (uid, boardId) => `users/${uid}/myBoards/${boardId}`;
export const pathMyBoardModelsCol = (uid, boardId) => `users/${uid}/myBoards/${boardId}/models`;
export const pathMyBoardModel = (uid, boardId, mid) => `users/${uid}/myBoards/${boardId}/models/${mid}`;

// TeamBoards 本体 / モデル
export const pathTeamBoardsCol = () => `teamBoards`;
export const pathTeamBoard = (boardId) => `teamBoards/${boardId}`;
export const pathTeamBoardModelsCol = (boardId) => `teamBoards/${boardId}/models`;
export const pathTeamBoardModel = (boardId, mid) => `teamBoards/${boardId}/models/${mid}`;

// boardsPublic 本体 / モデル
export const pathPublicBoardsCol = () => `boardsPublic`;
export const pathPublicBoard = (publicId) => `boardsPublic/${publicId}`;
export const pathPublicBoardModelsCol = (publicId) => `boardsPublic/${publicId}/models`;
export const pathPublicBoardModel = (publicId, mid) => `boardsPublic/${publicId}/models/${mid}`;

/* =========================
 *  モデル正規パス（modelRef 用）
 * ========================= */

// 例：グローバル models か、ユーザー配下 models を使う運用のどちらでもOK。
// ここはあなたの実装に合わせて統一（下はユーザー配下例）。
export const pathUserModel = (ownerId, modelId) => `users/${ownerId}/models/${modelId}`;

/* =========================
 *  Source Board の正規化
 * ========================= */

/** 既存の関数を保持しつつ、nullを返さない薄いラッパも用意 */
export const normalizeSourceBoardPath = (pub) => {
    if (typeof pub?.sourceBoardPath === "string" && pub.sourceBoardPath.trim()) {
        return pub.sourceBoardPath.trim();
    }
    if (pub?.boardType && pub?.sourceBoardId) {
        return `${pub.boardType}/${pub.sourceBoardId}`;
    }
    return null;
};

/** boardType/ids から Source Board パスを生成（決定的） */
export const sourceBoardPathFrom = ({ boardType, ownerId, boardId }) => {
    if (boardType === "myBoards") return pathMyBoard(ownerId, boardId);
    if (boardType === "teamBoards") return pathTeamBoard(boardId);
    throw new Error(`[sourceBoardPathFrom] unsupported boardType: ${boardType}`);
};

/* =========================
 *  パス種別の判定（ユーティリティ）
 * ========================= */

export const isMyBoardsPath = (p = "") => p.startsWith("users/") && p.includes("/myBoards/");
export const isTeamBoardsPath = (p = "") => p.startsWith("teamBoards/");
export const isPublicBoardsPath = (p = "") => p.startsWith("boardsPublic/");

/* =========================
 *  boardType をキーに汎用パスを返すヘルパ
 * ========================= */

/** ボード本体パスを boardType で切替 */
export const pathBoard = ({ boardType, ownerId, boardId }) => {
    return boardType === "myBoards"
        ? pathMyBoard(ownerId, boardId)
        : pathTeamBoard(boardId);
};

/** ボード配下 models のコレクションパス */
export const pathBoardModelsCol = ({ boardType, ownerId, boardId }) => {
    return boardType === "myBoards"
        ? pathMyBoardModelsCol(ownerId, boardId)
        : pathTeamBoardModelsCol(boardId);
};

/** ボード配下 models のドキュメントパス */
export const pathBoardModel = ({ boardType, ownerId, boardId, modelId }) => {
    return boardType === "myBoards"
        ? pathMyBoardModel(ownerId, boardId, modelId)
        : pathTeamBoardModel(boardId, modelId);
};
