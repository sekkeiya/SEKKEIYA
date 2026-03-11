// utils/services/boards/guards.js
// 役割: 権限・状態の "判定" のみ。Firestoreへの write はしない。

/** モデルの公開判定（最小版） */
export const isModelPublic = (m) => {
    const vis = m?.visibility || (m?.publicMode ? (m.publicMode === "all" ? "public" : "private") : "");
    return vis === "public" || m?.isPublic === true;
};

/** マイボードの公開可否（例） */
export const canPublishMyBoard = (actor, board) => {
    if (!actor?.uid || !board) return false;
    // 自分のボード、もしくは board.ownerId が一致
    const ownerId = board.ownerId || board.owner || board.createdBy;
    return ownerId === actor.uid;
};

/** チームボードの公開可否（例） */
export const canPublishTeamBoard = (actor, teamBoard) => {
    if (!actor?.uid || !teamBoard) return false;
    const ownerId = teamBoard.ownerId || teamBoard.owner;
    if (ownerId && ownerId === actor.uid) return true;
    // 必要ならロール/権限を見る
    const roles = teamBoard.roles?.[actor.uid];
    return roles === "owner" || roles === "admin"; // プロジェクトの権限モデルに合わせて
};

/** ボード内の非公開モデルスキャン（読み取りのみ） */
export const scanBoardForPrivateModels = async ({ db, userId, boardId, boardType }) => {
    // ← ここは今の実装を薄めに維持してOK（getDoc/getDocsのみ）。dbは呼び出し側から注入でも良い
    // ※ 既存の実装を移植：Firestore write はしない
};
