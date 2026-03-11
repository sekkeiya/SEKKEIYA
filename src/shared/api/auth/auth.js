// utils/services/auth/auth.js
import { auth, db } from "@/shared/config/firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    deleteUser,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    setPersistence,
    browserLocalPersistence,
    getIdToken,
    reauthenticateWithPopup,
    GoogleAuthProvider,
    fetchSignInMethodsForEmail,
    sendEmailVerification, // ✅ 追加
    reauthenticateWithRedirect,
} from "firebase/auth";
import {
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    serverTimestamp,
} from "firebase/firestore";
import { toSekkeiyaLogoutUrl } from "@/shared/utils/urls/sekkeiyaUrls";


/* ---------------- helpers (ログ) ---------------- */
const logSuccess = (message, data) =>
    console.log(`✅ ${message}:`, data ?? "");
const logError = (message, error) =>
    console.error(`❌ ${message}:`, error?.message ?? error);

/* ---------------- Firestore: users/{uid} を用意（非破壊） ----------------
   既存ドキュメントがある場合は、既存値を尊重し「未設定の項目だけ」補完します。
   特に username は一度ユーザーが変更したら上書きしません。
----------------------------------------------------------------------- */
const ensureUserDoc = async (uid, values = {}) => {
    const ref = doc(db, "users", uid);
    const nowPatch = { updatedAt: serverTimestamp() };

    const snap = await getDoc(ref);

    if (!snap.exists()) {
        // 新規作成：初期値をセット
        await setDoc(
            ref,
            {
                plan: "free",
                privateStorageUsedBytes: 0,
                myBoardCreateCount: 0,
                teamBoardCreateCount: 0,
                teamBoardJoinCount: 0,
                createdAt: serverTimestamp(),
                ...values, // email / 初期 username など
                ...nowPatch,
            },
            { merge: true }
        );
        return;
    }

    // 既存あり：未設定だけ埋める（非破壊）
    const cur = snap.data() || {};
    const patch = { ...nowPatch };

    // email/plan は未設定時のみ補完
    if (!cur.email && values.email) patch.email = values.email;
    if (!cur.plan) patch.plan = cur.plan ?? "free";

    // username：空/未定義/空白のみ のときだけ補完
    const hasUsername =
        typeof cur.username === "string" && cur.username.trim().length > 0;
    if (!hasUsername && typeof values.username === "string") {
        patch.username = values.username;
    }

    // 例: 初回だけ photoURL を補完したい場合
    if (!cur.photoURL && values.photoURL) {
        patch.photoURL = values.photoURL;
    }

    if (Object.keys(patch).length > 1 /* updatedAt 以外がある */) {
        await setDoc(ref, patch, { merge: true });
    } else {
        await setDoc(ref, nowPatch, { merge: true });
    }
};



/* =========================
 * ✅ ログアウト
 * ========================= */
export const logout = async () => {
    try {
        await signOut(auth);
        window.location.assign("/login");
    } catch (e) {
        console.error(e);
        window.location.assign("/login");
    }
};

/* =========================
 * ✅ アカウント削除（要再認証）
 *  - currentPassword を渡したらパスワードで再認証
 *  - 未指定ならサインイン方法を調べて Google なら popup で再認証
 * ========================= */
export const deleteAccount = async (currentPassword) => {
    const user = auth.currentUser;
    if (!user) throw new Error("ユーザーがログインしていません");

    const email = user.email || "";
    let methods = [];

    try {
        if (email) methods = await fetchSignInMethodsForEmail(auth, email);
    } catch (e) {
        console.warn("fetchSignInMethodsForEmail failed:", e);
    }
    if (methods.length === 0) {
        methods = user.providerData.map((p) => p.providerId).filter(Boolean);
    }

    try {
        // 1) パスワード再認証
        if (currentPassword) {
            const cred = EmailAuthProvider.credential(email, currentPassword);
            await reauthenticateWithCredential(user, cred);
        } else {
            // 2) Google ログイン再認証
            if (methods.includes("google.com")) {
                const provider = new GoogleAuthProvider();
                try {
                    await reauthenticateWithPopup(user, provider);
                } catch (e) {
                    // ポップアップが使えない場合はリダイレクトへフォールバック
                    if (
                        e.code === "auth/popup-blocked" ||
                        e.code === "auth/popup-closed-by-user" ||
                        e.code === "auth/operation-not-supported-in-this-environment"
                    ) {
                        await reauthenticateWithRedirect(user, provider);
                        return { ok: false, redirect: true };
                    }
                    throw e;
                }
            } else if (methods.includes("password")) {
                const err = new Error("このアカウントはパスワードで登録されています。パスワードを入力してください。");
                err.code = "needs-password";
                throw err;
            } else {
                throw new Error(`対応していない認証方法です: ${methods.join(",")}`);
            }
        }

        // Firestore → Auth の順で削除
        await deleteDoc(doc(db, "users", user.uid));
        await deleteUser(user);

        return { ok: true };
    } catch (err) {
        console.error("アカウント削除失敗:", err);
        throw err;
    }
};

/* =========================
 * ✅ ユーザー名取得（Firestore優先）
 * ========================= */
export const fetchUsername = async (userId) => {
    try {
        const snap = await getDoc(doc(db, "users", userId));
        if (snap.exists()) {
            return snap.data().username || "匿名ユーザー";
        }
    } catch (e) {
        console.warn("fetchUsername failed:", e);
    }
    return "匿名ユーザー";
};
