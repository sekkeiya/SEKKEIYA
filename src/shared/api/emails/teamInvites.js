import { getDocs, collection, doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";

// 関係のあったユーザーの email を取得
export const fetchInviteCandidateEmails = async (currentUserId) => {
    const emailSet = new Set();

    // 🔹 自分が参加した teamBoards を取得
    const teamBoardsSnap = await getDocs(collection(db, "users", currentUserId, "teamBoards"));
    for (const docSnap of teamBoardsSnap.docs) {
        const boardId = docSnap.id;

        // グローバル teamBoard を参照
        const globalBoardRef = doc(db, "teamBoards", boardId);
        const globalBoardSnap = await getDoc(globalBoardRef);
        const members = globalBoardSnap?.data()?.members || [];

        // メンバー一覧を取得（UID → email）
        for (const memberUid of members) {
            const userDocSnap = await getDoc(doc(db, "users", memberUid));
            const email = userDocSnap?.data()?.email;
            if (email) emailSet.add(email);
        }
    }

    return [...emailSet]; // Autocomplete に渡す形式
};
