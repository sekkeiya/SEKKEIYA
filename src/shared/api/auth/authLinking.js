// utils/services/auth/authLinking.js
import {
    getAuth,
    EmailAuthProvider,
    linkWithCredential,
    reauthenticateWithPopup,
    GoogleAuthProvider,
    fetchSignInMethodsForEmail,
    updatePassword,
} from "firebase/auth";

/** そのユーザーがすでに password プロバイダを持っているか */
export const hasPasswordProvider = async (email) => {
    if (!email) return false;
    const methods = await fetchSignInMethodsForEmail(getAuth(), email);
    return methods.includes("password");
};

/** Google専用ユーザーに Email/Password をリンクする（“後付けパスワード設定”） */
export const linkPasswordToCurrentUser = async (password) => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user?.email) throw new Error("メールアドレスが見つかりません。");

    const cred = EmailAuthProvider.credential(user.email, password);
    try {
        const res = await linkWithCredential(user, cred);
        return { ok: true, user: res.user };
    } catch (err) {
        // 直近ログインが必要な場合はGoogle再認証してリトライ
        if (err?.code === "auth/requires-recent-login") {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(auth.currentUser, provider);
            const res = await linkWithCredential(auth.currentUser, cred);
            return { ok: true, user: res.user };
        }
        return { ok: false, error: err };
    }
};

/** すでにEmail/Passwordユーザーなら、通常の“パスワード変更” */
export const changeCurrentUserPassword = async (newPassword) => {
    const auth = getAuth();
    const user = auth.currentUser;
    try {
        await updatePassword(user, newPassword);
        return { ok: true };
    } catch (err) {
        if (err?.code === "auth/requires-recent-login") {
            // パスワード変更でも“最近のログイン”が必要ならGoogleで再認証
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(auth.currentUser, provider);
            await updatePassword(auth.currentUser, newPassword);
            return { ok: true };
        }
        return { ok: false, error: err };
    }
};
