// utils/services/users/username.js
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/* 予約語（必要に応じて拡張） */
const RESERVED_HANDLES = new Set([
    "dashboard",
    "mypage",
    "boards",
    "models",
    "settings",
    "login",
    "signup",
    "admin",
    "api",
    "public",
    "private",
]);

/** 前後空白を除去して小文字化（ドキュメントID用） */
export const normalizeHandle = (raw = "") => raw.trim().toLowerCase();

/** クライアント側バリデーション */
export const validateHandle = (raw) => {
    const h = normalizeHandle(raw);
    if (!h) return "ユーザーネームを入力してください。";
    if (h.length < 3 || h.length > 30) return "3〜30文字で入力してください。";
    if (!/^[a-z0-9][a-z0-9._]*$/.test(h)) {
        return "英数字・アンダースコア・ドットのみ（先頭は英数字）";
    }
    if (RESERVED_HANDLES.has(h)) return "このユーザーネームは使用できません。";
    return null;
};

/** 空き確認（true=空いている） */
export const checkHandleAvailable = async (handle) => {
    const h = normalizeHandle(handle);
    if (!h) return false;
    const snap = await getDoc(doc(db, "usernames", h));
    return !snap.exists();
};

/** ハンドル → uid 解決（無ければ null） */
export const resolveUidByHandle = async (handle) => {
    const h = normalizeHandle(handle);
    if (!h) return null;
    const map = await getDoc(doc(db, "usernames", h));
    return map.exists() ? map.data()?.uid ?? null : null;
};

/** 余分に残っている自分名義のハンドルを一括掃除（newLower は残す） */
const cleanupExtraHandlesForUid = async (uid, newLower) => {
    const col = collection(db, "usernames");
    const q = query(col, where("uid", "==", uid));
    const snap = await getDocs(q);
    const deletions = [];
    snap.forEach((d) => {
        // newLower が指定されていればそれ以外を削除／未指定なら全削除
        if (!newLower || d.id !== newLower) {
            deletions.push(
                deleteDoc(doc(db, "usernames", d.id))
                    .then(() => console.log("[reserve] cleanup extras: deleted", d.id))
                    .catch(() => console.log("[reserve] cleanup extras: delete failed", d.id))
            );
        }
    });
    if (deletions.length) await Promise.all(deletions);
};

/**
 * 🔑 非トランザクション版の確保フロー（ロールバック＋掃除付き）
 *  1) /usernames/{newLower} を確保（未使用なら create、自分名義で既存なら no-op）
 *  2) /users/{uid} に handle / handleLower を update（失敗時は 1) をロールバック）
 *  3) 旧 /usernames/{oldLower} を自分名義なら delete
 *  4) 念のため、自分名義で残っている他のマッピングも全削除（newLower 以外）
 */
export const reserveHandle = async (uid, newHandle, displayCase = null) => {
    // 0) バリデーション
    const err = validateHandle(newHandle);
    if (err) throw new Error(err);

    const newLower = normalizeHandle(newHandle);
    const handleDisplay = displayCase ?? newHandle;

    // 現在ユーザーを取得（旧 handleLower を知るため）
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("ユーザーが見つかりません。");
    const user = userSnap.data() || {};
    const oldLower = user.handleLower || null;

    // 同一ハンドル（小文字比較）なら表示名だけ更新して終了
    if (oldLower === newLower) {
        console.log("[reserve] same handle, update display only", { oldLower, newLower });
        await updateDoc(userRef, {
            handle: handleDisplay,
            updatedAt: serverTimestamp(),
        });
        console.log("[reserve] done (display updated)");
        return;
    }

    // 1) 新ハンドルの確保
    const newRef = doc(db, "usernames", newLower);
    const newSnap = await getDoc(newRef);

    console.log("[reserve] create mapping", newLower);
    if (newSnap.exists()) {
        const owner = newSnap.data()?.uid;
        console.log("[reserve] mapping exists", { owner, isSelf: owner === uid });
        if (owner !== uid) {
            const e = new Error("このユーザーネームはすでに使われています。");
            e.code = "handle/taken";
            throw e;
        }
        // 自分名義 → create は不要（no-op）
    } else {
        await setDoc(newRef, {
            uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        console.log("[reserve] mapping created", newLower);
    }

    // 2) /users を更新（失敗なら 1) をロールバック）
    const createdNew = !newSnap.exists();
    console.log("[reserve] update /users", newLower);
    try {
        await updateDoc(userRef, {
            handle: handleDisplay,
            handleLower: newLower, // ← ここが肝（ルールがこの値で検証）
            updatedAt: serverTimestamp(),
        });
    } catch (e) {
        console.log("[reserve] update /users failed, rollback mapping if created", { createdNew, newLower });
        if (createdNew) {
            try {
                const check = await getDoc(newRef);
                if (check.exists() && check.data()?.uid === uid) {
                    await deleteDoc(newRef);
                    console.log("[reserve] rollback: mapping deleted", newLower);
                }
            } catch {
                console.log("[reserve] rollback: delete failed (ignored)", newLower);
            }
        }
        throw e;
    }

    // 3) 旧マッピングの解放（自分名義のみ）
    console.log("[reserve] cleanup old", oldLower);
    if (oldLower && oldLower !== newLower) {
        const oldRef = doc(db, "usernames", oldLower);
        const oldSnap = await getDoc(oldRef);
        if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
            try {
                await deleteDoc(oldRef);
                console.log("[reserve] cleanup old: deleted", oldLower);
            } catch {
                console.log("[reserve] cleanup old: delete failed (ignored)", oldLower);
            }
        } else {
            console.log("[reserve] cleanup old: skip (not exists or not owned)", oldLower);
        }
    }

    // 4) 念のため：自分名義の残骸を全削除（newLower を残す）
    console.log("[reserve] cleanup extras");
    await cleanupExtraHandlesForUid(uid, newLower);

    console.log("[reserve] done");
};

/** 任意：ハンドル解除（/usernames を解放し、/users の handle を null に） */
export const releaseHandle = async (uid) => {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const oldLower = userSnap.data()?.handleLower || null;

    if (oldLower) {
        const oldRef = doc(db, "usernames", oldLower);
        const oldSnap = await getDoc(oldRef);
        if (oldSnap.exists() && oldSnap.data()?.uid === uid) {
            try {
                await deleteDoc(oldRef);
                console.log("[release] mapping deleted", oldLower);
            } catch {
                console.log("[release] mapping delete failed (ignored)", oldLower);
            }
        }
    }

    await updateDoc(userRef, {
        handle: null,
        handleLower: null,
        updatedAt: serverTimestamp(),
    });

    // 念のため：自分名義の残骸を全削除
    await cleanupExtraHandlesForUid(uid, null);
    console.log("[release] done");
};

export const resolveHandleByUid = async (uid) => {
    if (!uid) return null;
    // usernames を逆引きしたいが、現行スキーマだと "uid==uid" で検索が必要
    const col = collection(db, "usernames");
    const q = query(col, where("uid", "==", uid));
    const snap = await getDocs(q);
    let handle = null;
    snap.forEach((d) => { handle = d.id; }); // 1件想定
    return handle; // 例: "3dshapeshare"
};