// utils/services/boards/likes.js
import { db } from "@/shared/config/firebase";
import { doc, runTransaction, serverTimestamp, increment } from "firebase/firestore";

/**
 * 公開ボードのいいねトグル（後方互換: publicBoards / boardsPublic 両対応）
 * @param {object} params
 * @param {string} params.publicBoardId - 公開ボードID（boardsPublic の doc id）
 * @param {string} params.userId - 操作者の uid
 * @param {boolean} params.next - 付けたい状態（true: いいね, false: 解除）
 */
export async function toggleBoardLike({ publicBoardId, userId, next }) {
    if (!publicBoardId || !userId || typeof next !== "boolean") {
        throw new Error("toggleBoardLike: 引数が不足しています");
    }

    const roots = ["publicBoards", "boardsPublic"];
    let ok = false;

    for (const root of roots) {
        try {
            const boardRef = doc(db, root, publicBoardId);
            const likeRef = doc(db, root, publicBoardId, "likes", userId);

            await runTransaction(db, async (tx) => {
                const likeSnap = await tx.get(likeRef);
                const already = likeSnap.exists();

                if (already === next) return; // 変化なし

                if (next) {
                    tx.set(likeRef, { userId, createdAt: serverTimestamp() });
                    tx.update(boardRef, { likesCount: increment(1) });
                } else {
                    tx.delete(likeRef);
                    tx.update(boardRef, { likesCount: increment(-1) });
                }
            });

            ok = true;
            break;
        } catch (e) {
            // 片方の root で失敗したらもう一方で再試行
            if (import.meta?.env?.DEV) console.warn(`[LIKE] try root=${root} failed`, e);
        }
    }

    if (!ok) throw new Error("like toggle failed on both roots");
}
