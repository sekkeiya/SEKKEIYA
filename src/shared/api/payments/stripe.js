// shared/api/payments/stripe.js
//
// 決済は Firebase 拡張機能 `invertase/firestore-stripe-payments`（asia-northeast1）方式。
// クライアントは Firestore にドキュメントを書き、拡張機能が Stripe と通信して結果を書き戻す。
//   - サブスク/寄付の開始 : customers/{uid}/checkout_sessions に doc 作成 → url を待って遷移
//   - 解約/支払い方法変更 : callable ext-firestore-stripe-payments-createPortalLink
//   - 加入状態           : customers/{uid}/subscriptions（拡張機能が書込み）
//   - 寄付の決済記録      : customers/{uid}/payments（拡張機能が書込み、metadata 保持）
//   - 商品/価格          : products / products/{id}/prices（Stripe から同期）
//
// 設定の実値は extensions/firestore-stripe-payments.env を参照。

import { getApp } from "firebase/app";
import { auth, db } from "@/shared/config/firebase";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

const CUSTOMERS = "customers";
const PRODUCTS = "products";
const PLANS = "plans";
// 拡張機能のデプロイ先リージョン（callable はここを向く必要がある）
const EXT_REGION = "asia-northeast1";

function requireUid() {
  const user = auth.currentUser;
  if (!user) throw new Error("ログインが必要です。");
  return user.uid;
}

/**
 * checkout_sessions ドキュメントに url（または error）が書き戻されるのを待つ。
 * 既定では取得した url へ自動遷移する。
 */
function waitForCheckoutUrl(ref, { redirect = true, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error("決済ページの生成がタイムアウトしました。時間をおいて再度お試しください。"));
    }, timeoutMs);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data();
        if (!data) return;
        const { error, url } = data;
        if (error) {
          clearTimeout(timer);
          unsub();
          reject(new Error(error.message || "決済の開始に失敗しました。"));
          return;
        }
        if (url) {
          clearTimeout(timer);
          unsub();
          if (redirect) window.location.assign(url);
          resolve(url);
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      }
    );
  });
}

/* -------------------- サブスクリプション購入 -------------------- */
/**
 * Stripe Checkout（サブスク）を開始する。
 * @param {string} priceId  Stripe の price ID（例: price_xxx）
 * @param {{successUrl?:string, cancelUrl?:string, redirect?:boolean}} [opts]
 * @returns {Promise<string>} Checkout URL
 */
export async function startSubscriptionCheckout(priceId, opts = {}) {
  const uid = requireUid();
  if (!priceId || !String(priceId).startsWith("price_")) {
    throw new Error("不正な price ID です。");
  }
  const origin = window.location.origin;
  const ref = await addDoc(
    collection(db, CUSTOMERS, uid, "checkout_sessions"),
    {
      mode: "subscription",
      price: priceId,
      allow_promotion_codes: true,
      success_url: opts.successUrl || `${origin}/workspace?checkout=success`,
      cancel_url: opts.cancelUrl || `${origin}/workspace?checkout=cancel`,
    }
  );
  return waitForCheckoutUrl(ref, { redirect: opts.redirect !== false });
}

/* -------------------- 寄付（単発・任意額） -------------------- */
/**
 * Stripe Checkout（単発決済＝寄付）を開始する。任意額・コメント付き。
 * コメントは metadata 経由で決済記録(payments)に残り、Cloud Function が
 * donationComments へ転記する。
 * @param {{amount:number, currency?:string, comment?:string, name?:string,
 *          showAmount?:boolean, successUrl?:string, cancelUrl?:string,
 *          redirect?:boolean}} params
 * @returns {Promise<string>} Checkout URL
 */
export async function startDonationCheckout(params = {}) {
  const uid = requireUid();
  const currency = (params.currency || "jpy").toLowerCase();
  // JPY はゼロ小数通貨なので unit_amount = 円の値そのまま。
  const amount = Math.floor(Number(params.amount));
  if (!Number.isFinite(amount) || amount < 100) {
    throw new Error("寄付額は100円以上で入力してください。");
  }
  const origin = window.location.origin;
  const ref = await addDoc(
    collection(db, CUSTOMERS, uid, "checkout_sessions"),
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: amount,
            product_data: { name: "SEKKEIYA への寄付" },
          },
          quantity: 1,
        },
      ],
      // metadata は拡張機能が PaymentIntent.metadata にコピーする
      metadata: {
        kind: "donation",
        donationComment: String(params.comment || "").slice(0, 500),
        donorName: String(params.name || "").slice(0, 60),
        showAmount: params.showAmount === false ? "false" : "true",
      },
      billing_address_collection: "auto",
      success_url: params.successUrl || `${origin}/?donation=success`,
      cancel_url: params.cancelUrl || `${origin}/?donation=cancel`,
    }
  );
  return waitForCheckoutUrl(ref, { redirect: params.redirect !== false });
}

/* -------------------- 追加クレジット購入 (top-up) -------------------- */
/**
 * 追加クレジットパック（原価の2〜3倍マージン）。creditModel と同値に保つ。docs/17。
 */
export const TOPUP_PACKS = [
  { credits: 100, priceJpy: 1200 },
  { credits: 300, priceJpy: 3000 },
  { credits: 1000, priceJpy: 8800 },
];

/**
 * 追加クレジットを都度払い(mode:"payment")で購入する。決済成功で
 * Cloud Function grantTopupOnPayment が credits.topupBalance に付与する。
 * @param {{credits:number, priceJpy:number}} pack
 */
export async function startTopupCheckout(pack, opts = {}) {
  const uid = requireUid();
  const credits = Math.floor(Number(pack?.credits));
  const amount = Math.floor(Number(pack?.priceJpy)); // JPY はゼロ小数通貨
  if (!Number.isFinite(credits) || credits <= 0 || !Number.isFinite(amount) || amount < 100) {
    throw new Error("不正なクレジットパックです。");
  }
  const origin = window.location.origin;
  const ref = await addDoc(collection(db, CUSTOMERS, uid, "checkout_sessions"), {
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "jpy",
          unit_amount: amount,
          product_data: { name: `SEKKEIYA クレジット +${credits.toLocaleString("ja-JP")}` },
        },
        quantity: 1,
      },
    ],
    // 拡張機能が PaymentIntent.metadata にコピー → grantTopupOnPayment が読む
    metadata: { kind: "topup", credits: String(credits) },
    success_url: opts.successUrl || `${origin}/pricing?topup=success`,
    cancel_url: opts.cancelUrl || `${origin}/pricing?topup=cancel`,
  });
  return waitForCheckoutUrl(ref, { redirect: opts.redirect !== false });
}

/* -------------------- 顧客ポータル（解約・変更） -------------------- */
/**
 * Stripe カスタマーポータルを開く。
 * @param {string} [returnUrl] 戻り先 URL
 * @returns {Promise<string|undefined>}
 */
export async function openBillingPortal(returnUrl) {
  requireUid();
  const functions = getFunctions(getApp(), EXT_REGION);
  const createPortalLink = httpsCallable(
    functions,
    "ext-firestore-stripe-payments-createPortalLink"
  );
  const { data } = await createPortalLink({
    returnUrl: returnUrl || `${window.location.origin}/workspace`,
  });
  if (data?.url) window.location.assign(data.url);
  return data?.url;
}

/* -------------------- 加入状態の取得 -------------------- */
/** active / trialing のサブスクを取得（1回） */
export async function getActiveSubscriptions() {
  const uid = requireUid();
  const snap = await getDocs(
    query(
      collection(db, CUSTOMERS, uid, "subscriptions"),
      where("status", "in", ["trialing", "active"])
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** active / trialing のサブスクを購読（リアルタイム）。解除関数を返す。 */
export function watchActiveSubscriptions(callback) {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    callback([]);
    return () => {};
  }
  return onSnapshot(
    query(
      collection(db, CUSTOMERS, uid, "subscriptions"),
      where("status", "in", ["trialing", "active"])
    ),
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

/* -------------------- 商品/価格（料金表示用） -------------------- */
/** active な商品＋その active な価格を取得 */
export async function getActiveProductsWithPrices() {
  const prodSnap = await getDocs(
    query(collection(db, PRODUCTS), where("active", "==", true))
  );
  const products = [];
  for (const p of prodSnap.docs) {
    const priceSnap = await getDocs(
      query(collection(p.ref, "prices"), where("active", "==", true))
    );
    products.push({
      id: p.id,
      ...p.data(),
      prices: priceSnap.docs.map((pr) => ({ id: pr.id, ...pr.data() })),
    });
  }
  return products;
}

/* -------------------- プランカタログ（既存 plans コレクション） -------------------- */
/**
 * 料金表示用に plans コレクションを取得する。
 * 各 doc: { name, pricePerMonth(円), description, stripePriceId, allowApiAccess, *Limit... }
 * 拡張機能の products 同期に依存せず、既存 SSOT をそのまま使う。
 */
export async function getPlansCatalog() {
  const snap = await getDocs(collection(db, PLANS));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* -------------------- 寄付コメント（LP公開用） -------------------- */
/** 承認済み寄付コメントを新しい順に取得 */
export async function getApprovedDonations(max = 50) {
  const snap = await getDocs(
    query(
      collection(db, "donationComments"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    )
  );
  return snap.docs.slice(0, max).map((d) => ({ id: d.id, ...d.data() }));
}
