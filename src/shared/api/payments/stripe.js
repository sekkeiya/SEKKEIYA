// utils/services/payments/stripe.js
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/shared/config/firebase";
import { getAuth } from "firebase/auth";

/** ----------------------------------------------------------------
 * Functions Base
 *  - .env の VITE_FUNCTIONS_BASE を最優先
 *  - 未設定なら本番 Functions を使用（推奨）
 *    例）VITE_FUNCTIONS_BASE=https://asia-northeast1-shapeshare3d.cloudfunctions.net
 * ---------------------------------------------------------------- */
export const BASE =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_FUNCTIONS_BASE) ||
    "https://asia-northeast1-shapeshare3d.cloudfunctions.net";

export const CREATE_CHECKOUT_PROXY = `${BASE}/createCheckoutSessionProxy`;
export const CREATE_PORTAL_PROXY = `${BASE}/createPortalLinkProxy`;
const SYNC_PLAN_PROXY = `${BASE}/syncStripePlan`;

/* -------------------- 共通: Auth ユーティリティ -------------------- */
async function getIdTokenOrThrow(forceRefresh = false) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("ログインが必要です。");
    try {
        return await user.getIdToken(forceRefresh);
    } catch {
        if (!forceRefresh) return getIdTokenOrThrow(true);
        throw new Error("IDトークンの取得に失敗しました。再ログインしてください。");
    }
}

/* -------------------- 共通: fetch ヘルパ -------------------- */
async function postJson(url, body, idToken) {
    let res;
    try {
        res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
            },
            body: JSON.stringify(body ?? {}),
            cache: "no-store",
        });
    } catch (networkErr) {
        throw new Error(`ネットワークエラー: ${(networkErr && networkErr.message) || "接続に失敗しました"}`);
    }

    let payload = null;
    try {
        payload = await res.json();
    } catch {
        // JSONでない応答は無視（Functions は基本 JSON を返す想定）
    }

    if (!res.ok) {
        const msg =
            (payload && (payload.error || payload.message)) ||
            `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return payload;
}

/* -------------------- planKey → priceId 変換 -------------------- */
async function fetchPriceIdFromPlans(planKey) {
    const snap = await getDoc(doc(db, "plans", planKey));
    if (!snap.exists()) throw new Error(`plans/${planKey} が見つかりません`);
    const priceId = snap.data()?.stripePriceId;
    if (!priceId) throw new Error(`plans/${planKey}.stripePriceId が未設定です`);
    return priceId;
}

/* -------------------- Public APIs -------------------- */
/** Stripe Checkout を開始（priceId でも planKey でもOK） */

export const startCheckout = async (priceIdOrPlanKey) => {
    const priceId = String(priceIdOrPlanKey || "").startsWith("price_")
        ? priceIdOrPlanKey
        : await fetchPriceIdFromPlans(priceIdOrPlanKey);

    const idToken = await getIdTokenOrThrow();
    const origin = window.location.origin;
    const uid = getAuth().currentUser?.uid;
    const successUrl = `${origin}/dashboard/setting/${uid}?status=success`;
    const cancelUrl = `${origin}/dashboard/setting/${uid}?status=cancel`;

    const payload = await postJson(
        CREATE_CHECKOUT_PROXY,
        { priceId, successUrl, cancelUrl },
        idToken
    );

    // 新規: Checkout へ
    if (payload?.url) {
        location.href = payload.url;
        return;
    }

    // 既存更新: ここで即同期して画面に反映
    if (payload?.updated) {
        // 任意：claims/Firestore 同期
        try {
            await postJson(`${BASE}/syncStripePlan`, {}, idToken);
            await getAuth().currentUser?.getIdToken(true);
        } catch { }
        return; // 呼び出し元でスナック等を出すならここで終了
    }

    throw new Error("Unexpected response from server.");
};

/** 顧客ポータルを開く（customerId不要／戻り先だけ指定） */
export const openPortal = async () => {
    const idToken = await getIdTokenOrThrow();
    const origin = window.location.origin;
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("ログインが必要です。");

    const returnUrl = `${origin}/dashboard/setting/${uid}?status=portal`;

    const { url } = await postJson(
        CREATE_PORTAL_PROXY,
        { returnUrl },
        idToken
    );
    if (!url) throw new Error("Portal URL が取得できませんでした。");
    location.href = url;
};

/** 任意：claims 即時反映が必要な時用 */
export const refreshClaims = async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    await user.getIdToken(true);
};

/** Stripe 上のサブスク状態 → Firestore/Claims 同期 */
export const syncStripePlan = async () => {
    const user = getAuth().currentUser;
    if (!user) throw new Error("ログインが必要です。");
    const idToken = await user.getIdToken();
    return postJson(SYNC_PLAN_PROXY, {}, idToken); // { ok, plan, priceId, subscriptionStatus, ... }
};
