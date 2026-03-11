import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    serverTimestamp,
    onSnapshot,
    updateDoc,
    query,
    where,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * 左サイドバーに“現在表示中”のボードだけ取得 (Unified Single Read)
 * 対象: boards
 * 返却: { myBoards, teamBoards, all }
 */
export const fetchSidebarBoards = async (uid) => {
    const boardsCol = collection(db, "boards");

    const ownerQ = query(boardsCol, where("ownerId", "==", uid));
    const memberQ = query(boardsCol, where("memberIds", "array-contains", uid));

    let ownerSnap, memberSnap;
    try {
        ownerSnap = await getDocs(ownerQ);
    } catch (e) {
        console.error("[fetchSidebarBoards] owner fetch error:", e);
    }
    
    try {
        memberSnap = await getDocs(memberQ);
    } catch (e) {
        console.error("[fetchSidebarBoards] member fetch error:", e);
    }

    const mergedMap = new Map();
    if (ownerSnap) ownerSnap.docs.forEach(d => mergedMap.set(d.id, { id: d.id, boardId: d.id, ...d.data() }));
    if (memberSnap) memberSnap.docs.forEach(d => mergedMap.set(d.id, { id: d.id, boardId: d.id, ...d.data() }));
    
    // Filter out boards that shouldn't be in sidebar
    const allBoards = Array.from(mergedMap.values()).filter(b => b.showInSidebar !== false);

    const myBoards = allBoards.filter(b => b.boardType !== "teamBoards");
    const teamBoards = allBoards.filter(b => b.boardType === "teamBoards");

    return { myBoards, teamBoards, all: allBoards };
};


/**
 * ✅ ボード変更を監視 (Unified Single Read)
 */
export const subscribeUserBoards = (userId, callback, boardType) => {
    const boardsCol = collection(db, "boards");
    const q = boardType === "myBoards"
        ? query(boardsCol, where("ownerId", "==", userId))
        : query(boardsCol, where("memberIds", "array-contains", userId));

    return onSnapshot(q, (snapshot) => {
        const boards = snapshot.docs.map(d => ({ id: d.id, boardId: d.id, ...d.data() }));
        const filtered = boards.filter(b => boardType === "myBoards" ? b.boardType !== "teamBoards" : b.boardType === "teamBoards");
        callback(filtered);
    });
};

/**
 * ✅ マイボード専用サイドバー表示切替
 */
export const toggleMyBoardShowInSidebar = async (userId, boardId, currentValue) => {
    const ref = doc(db, "boards", boardId);
    // ないと update で落ちるので保険
    const s = await getDoc(ref);
    if (!s.exists()) {
        await setDoc(ref, { showInSidebar: !currentValue, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
        return;
    }
    await updateDoc(ref, { showInSidebar: !currentValue, updatedAt: serverTimestamp() });
};