import {
    doc,
    getDoc,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/**
 * ✅ ユーザーデータ取得
 */
export const fetchUserData = async (userId) => {
    if (!userId) return null;
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
};

/** ハンドルから uid だけ取得（なければ null） */
export const resolveUidByHandle = async (handle) => {
    const h = String(handle || "").trim().toLowerCase();
    if (!h) return null;
    const mapSnap = await getDoc(doc(db, "usernames", h));
    return mapSnap.exists() ? mapSnap.data()?.uid ?? null : null;
};

/** ハンドルからユーザーデータ取得（なければ null） */
export const fetchUserByHandle = async (handle) => {
    const uid = await resolveUidByHandle(handle);
    if (!uid) return null;
    const userSnap = await getDoc(doc(db, "users", uid));
    return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
};