// utils/services/auth/googleAuth.js
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    getRedirectResult,
    fetchSignInMethodsForEmail,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
} from "firebase/auth";
import { ensureUserDocForProviderSignIn } from "./auth";

/** 簡易UA判定 */
const isMobile = () =>
    /iphone|ipad|ipod|android/i.test(navigator.userAgent || "");

const isInAppBrowser = () => {
    const ua = (navigator.userAgent || "").toLowerCase();
    // 代表的なアプリ内ブラウザ
    return (
        ua.includes("instagram") ||
        ua.includes("line/") ||
        ua.includes("fb_iab") ||
        ua.includes("twitter") ||
        ua.includes("micromessenger")
    );
};

/** 永続化をローカル優先→ダメならセッションにフォールバック */
async function ensurePersistence(auth) {
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch {
        await setPersistence(auth, browserSessionPersistence);
    }
}

/**
 * Google でログイン/サインアップ
 * PC: popup -> 失敗時 redirect
 * Mobile: 最初から redirect
 *
 * ※ 成功時は必ず ensureUserDocForProviderSignIn を呼び、
 *    Firestore の username を上書きしない（非破壊）ようにする。
 */
export async function continueWithGoogle(auth) {
    await ensurePersistence(auth);

    const provider = new GoogleAuthProvider();
    provider.addScope("email");
    provider.addScope("profile");
    provider.setCustomParameters({ prompt: "select_account" });

    // アプリ内ブラウザはログインが壊れがちなので警告
    if (isInAppBrowser()) {
        return {
            ok: false,
            message:
                "アプリ内ブラウザではGoogleログインできない場合があります。右上のメニューから“外部ブラウザで開く”を選んでください。",
            code: "in-app-browser",
        };
    }

    // モバイルは最初から redirect（ポップアップを使わない）
    if (isMobile()) {
        await signInWithRedirect(auth, provider);
        return { ok: false, message: "redirect" };
    }

    // PC は popup → ダメなら redirect にフォールバック
    try {
        const res = await signInWithPopup(auth, provider);
        // ✅ Firestore の整備（非破壊：username は触らない）
        await ensureUserDocForProviderSignIn(res.user);
        return { ok: true, user: res.user };
    } catch (e) {
        if (e.code === "auth/account-exists-with-different-credential") {
            const email = e.customData?.email;
            if (!email) return { ok: false, message: "このメールは既に登録されています。" };
            const methods = await fetchSignInMethodsForEmail(auth, email);
            if (methods.includes("password")) {
                return {
                    ok: false,
                    message:
                        "このメールは既にメール/パスワードで登録済みです。いったんメールでログイン後、設定からGoogle連携してください。",
                };
            }
            return {
                ok: false,
                message: `このメールは ${methods.join(", ")} で登録済みです。そちらでログインしてください。`,
            };
        }

        if (e.code === "auth/popup-blocked" || e.code === "auth/popup-closed-by-user") {
            await signInWithRedirect(auth, provider);
            return { ok: false, message: "redirect" };
        }

        return { ok: false, message: `Googleログインに失敗しました: ${e.message}` };
    }
}

/** signInWithRedirect の復帰時に結果を回収 */
export async function handleGoogleRedirectResult(auth) {
    try {
        await ensurePersistence(auth);
        const res = await getRedirectResult(auth);
        if (res?.user) {
            // ✅ redirect 復帰時も同様に非破壊 ensure
            await ensureUserDocForProviderSignIn(res.user);
            return { ok: true, user: res.user };
        }
        return { ok: false };
    } catch (e) {
        return { ok: false, message: e.message };
    }
}
