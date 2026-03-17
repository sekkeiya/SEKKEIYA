// utils/services/search/publicSearch.js
import {
    collectionGroup,
    getDocs,
    query,
    where,
    orderBy,
    startAt,
    endAt,
    limit as qLimit,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

/** 共有: 公開モデルを “なるべく新しい順” で上限 max 件取得 */
async function fetchAllPublicBasic(max = 200) {
    const base = collectionGroup(db, "models");

    // 1) updatedAt DESC
    try {
        const q1 = query(
            base,
            where("isCanonical", "==", true),
            where("visibility", "==", "public"),
            orderBy("updatedAt", "desc"),
            qLimit(Math.min(max, 500))
        );
        const s1 = await getDocs(q1);
        return s1.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (_) { }

    // 2) createdAt DESC
    try {
        const q2 = query(
            base,
            where("isCanonical", "==", true),
            where("visibility", "==", "public"),
            orderBy("createdAt", "desc"),
            qLimit(Math.min(max, 500))
        );
        const s2 = await getDocs(q2);
        return s2.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (_) { }

    // 3) 並びなし（最終フォールバック）
    try {
        const q3 = query(base, where("isCanonical", "==", true), where("visibility", "==", "public"), qLimit(Math.min(max, 500)));
        const s3 = await getDocs(q3);
        return s3.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (_) {
        return [];
    }
}

/** 文字列の安全 toLowerCase */
const S = (v) => String(v ?? "").toLowerCase();

/** クライアント側の簡易スコアリング（関連性） */
function score(model, kw) {
    const kwL = S(kw);
    const title = S(model?.title || model?.name || "");
    const desc = S(model?.description || model?.about || model?.desc || "");
    const handle = S(
        model?.author ||
        model?.ownerUsername ||
        model?.handle ||
        model?.handleLower ||
        model?.ownerHandleLower ||
        ""
    );
    const tags = Array.isArray(model?.tags) ? model.tags.map((t) => S(t?.slug || t?.label || t?.name || t)) : [];
    const brands = Array.isArray(model?.brands) ? model.brands.map(S) : [];

    let s = 0;
    if (!kwL) s += 1;
    if (title === kwL) s += 15;
    if (title.startsWith(kwL)) s += 10;
    if (title.includes(kwL)) s += 6;

    if (handle === kwL) s += 8;
    if (handle.includes(kwL)) s += 4;

    if (tags.includes(kwL)) s += 6;
    if (tags.some((t) => t.includes(kwL))) s += 3;

    if (brands.includes(kwL)) s += 5;

    if (desc.includes(kwL)) s += 2;

    // いいね等
    const fav = Array.isArray(model?.favorites) ? model.favorites.length : (model?.likeCount ?? model?.likes ?? 0);
    s += Math.min(5, Number(fav) || 0);

    // 更新の新しさ（だいたいの重み）
    const ts =
        (model?.updatedAt?.toMillis?.() || 0) ||
        (model?.updatedAt?._seconds ? model.updatedAt._seconds * 1000 : 0) ||
        (model?.createdAt?.toMillis?.() || 0) ||
        (model?.createdAt?._seconds ? model.createdAt._seconds * 1000 : 0) ||
        0;
    s += ts ? Math.floor(ts / 1e12) : 0; // 2025年で約2

    return s;
}

/**
 * 既存フィールドのみで検索（追加フィールド不要）
 * - キーワード空   : 公開モデルの新着を返す
 * - キーワードあり : タイトルprefix/完全一致/array-contains を試行
 *   → 0件 or インデックス不足時は公開モデルをまとめて取得してクライアント側で部分一致
 */
export async function fetchPublicModelsByKeywordExisting(rawKeyword, limit = 60) {
    const kwRaw = (rawKeyword || "").trim();

    // キーワード空：新着返す
    if (!kwRaw) {
        const all = await fetchAllPublicBasic(limit);
        return all.slice(0, limit);
    }

    const base = collectionGroup(db, "models");
    const out = new Map();

    // --- 1) タイトル prefix（複合インデックスが無ければ catch）
    const tryTitlePrefix = async (v) => {
        try {
            const q1 = query(
                base,
                where("isCanonical", "==", true),
                where("visibility", "==", "public"),
                orderBy("title"),
                startAt(v),
                endAt(v + "\uf8ff"),
                qLimit(limit)
            );
            const s1 = await getDocs(q1);
            s1.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
        } catch (_) { }
    };

    await tryTitlePrefix(kwRaw);

    // 大文字小文字の揺れ
    const variants = new Set([
        kwRaw.toLowerCase(),
        kwRaw.toUpperCase(),
        kwRaw.charAt(0).toUpperCase() + kwRaw.slice(1).toLowerCase(),
    ]);
    for (const v of variants) {
        if (v !== kwRaw) await tryTitlePrefix(v);
    }

    // --- 2) 完全一致系（type / mainCategory / subCategory / subType / author / title / ownerUsername 等）
    const eqFields = [
        "type",
        "mainCategory",
        "subCategory",
        "subType",
        "author",
        "title",
        "ownerUsername",
        "handleLower",
        "ownerHandleLower",
    ];
    for (const f of eqFields) {
        try {
            const q2 = query(
                base,
                where("isCanonical", "==", true),
                where("visibility", "==", "public"),
                where(f, "==", kwRaw),
                qLimit(limit)
            );
            const s2 = await getDocs(q2);
            s2.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
        } catch (_) { }
    }

    // --- 3) 配列 contains（brands / tags）
    try {
        const q3 = query(
            base,
            where("isCanonical", "==", true),
            where("visibility", "==", "public"),
            where("brands", "array-contains", kwRaw),
            qLimit(limit)
        );
        const s3 = await getDocs(q3);
        s3.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
    } catch (_) { }

    try {
        const q4 = query(
            base,
            where("isCanonical", "==", true),
            where("visibility", "==", "public"),
            where("tags", "array-contains", kwRaw),
            qLimit(limit)
        );
        const s4 = await getDocs(q4);
        s4.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
    } catch (_) { }

    // ここまででヒットしていれば返す（軽く関連性順に）
    if (out.size > 0) {
        const arr = Array.from(out.values());
        arr.sort((a, b) => {
            const sb = score(b, kwRaw);
            const sa = score(a, kwRaw);
            return sb - sa;
        });
        return arr.slice(0, limit);
    }

    // --- 4) 0件 or インデックス不足 → 全件取得してクライアント部分一致
    const all = await fetchAllPublicBasic(Math.max(limit * 5, 200));
    if (!Array.isArray(all) || all.length === 0) return [];

    const kwL = kwRaw.toLowerCase();
    const filtered = all.filter((m) => {
        const title = (m?.title || m?.name || "").toString().toLowerCase();
        const desc = (m?.description || m?.about || m?.desc || "").toString().toLowerCase();
        const handle = (
            m?.author ||
            m?.ownerUsername ||
            m?.handle ||
            m?.handleLower ||
            m?.ownerHandleLower ||
            ""
        )
            .toString()
            .toLowerCase();
        const tags = (Array.isArray(m?.tags) ? m.tags : [])
            .map((t) => (t?.slug || t?.label || t?.name || t)?.toString?.().toLowerCase?.() || "")
            .filter(Boolean);
        const brands = (Array.isArray(m?.brands) ? m.brands : []).map((b) => b?.toString?.().toLowerCase?.() || "");

        return (
            title.includes(kwL) ||
            desc.includes(kwL) ||
            handle.includes(kwL) ||
            tags.some((t) => t.includes(kwL)) ||
            brands.some((b) => b.includes(kwL))
        );
    });

    filtered.sort((a, b) => {
        const sb = score(b, kwRaw);
        const sa = score(a, kwRaw);
        return sb - sa;
    });

    return filtered.slice(0, limit);
}
