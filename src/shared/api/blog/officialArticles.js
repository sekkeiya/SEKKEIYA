// utils/services/blog/officialArticles.js
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    limit as fsLimit,
    startAfter as fsStartAfter,
} from "firebase/firestore";
import { db } from "@/shared/config/firebase";

const COL = "officialArticles";

/* ------------------------------
 * helpers
 * ----------------------------*/
const normStr = (v) => (typeof v === "string" ? v.trim() : "");
const normSlug = (v) =>
    normStr(v)
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
        .replace(/(^-|-$)/g, "");

const normTags = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (const raw of arr) {
        const t = normStr(raw);
        if (!t) continue;
        const key = t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(t);
    }
    return out;
};

const toLowerArray = (arr) =>
    Array.isArray(arr) ? arr.map((s) => String(s).toLowerCase()).filter(Boolean) : [];

const normCategory = (cat) => {
    // 受け取り形式：
    // - { slug, name }
    // - null/undefined
    if (!cat) return null;
    const slug = normSlug(cat.slug || "");
    const name = normStr(cat.name || "");
    if (!slug && !name) return null;
    return { slug, name: name || slug };
};

const normSubCategory = (sub) => {
    if (!sub) return null;
    const slug = normSlug(sub.slug || "");
    const name = normStr(sub.name || "");
    if (!slug && !name) return null;
    return { slug, name: name || slug };
};

/* ------------------------------
 * 管理者：全件（下書き含む）更新日の新しい順
 * ----------------------------*/
export async function fetchAllArticlesForAdmin() {
    const q = query(collection(db, COL), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ------------------------------
 * 公開一覧（トップ/Blog）+ オプションフィルタ
 *   - options.categorySlug
 *   - options.tag
 *   - options.limit (既定 24)
 *   - options.startAfter (ページネーション用：直前のドキュメントの publishedAt 値)
 * ----------------------------*/
export async function fetchPublishedArticles(options = {}) {
    const { categorySlug, tag, limit = 24, startAfter } = options;

    const clauses = [where("status", "==", "published")];

    if (categorySlug) {
        clauses.push(where("category.slug", "==", normSlug(categorySlug)));
    }
    if (tag) {
        // 小文字で揃えた tagsLower を検索する
        clauses.push(where("tagsLower", "array-contains", normStr(tag).toLowerCase()));
    }

    // 並びは基本 publishedAt desc
    const base = [
        collection(db, COL),
        ...clauses,
        orderBy("publishedAt", "desc"),
    ];

    // ページネーション（publishedAt に対して）
    if (startAfter) {
        base.push(fsStartAfter(startAfter));
    }

    base.push(fsLimit(Math.max(1, Math.min(100, limit))));

    const q = query(...base);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* 便利ラッパ：カテゴリ別 */
export async function fetchPublishedByCategory(categorySlug, limit) {
    return fetchPublishedArticles({ categorySlug, limit });
}

/* 便利ラッパ：タグ別 */
export async function fetchPublishedByTag(tag, limit) {
    return fetchPublishedArticles({ tag, limit });
}

/* ------------------------------
 * 単体取得
 * ----------------------------*/
export async function getArticleById(id) {
    const s = await getDoc(doc(db, COL, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function getArticleBySlug(slug) {
    if (!slug) return null;
    const q = query(
        collection(db, COL),
        where("status", "==", "published"),
        where("slug", "==", normSlug(slug)),
        fsLimit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
}

/* ------------------------------
 * 作成（draft or published）
 *  - publishedAt は初回公開時のみ自動付与
 *  - category / subCategory / tags を正規化
 *  - 検索用に tagsLower も保持
 * ----------------------------*/
export async function createArticle(payload, author = {}) {
    const now = serverTimestamp();
    const status = payload.status === "published" ? "published" : "draft";

    const tags = normTags(payload.tags);
    const base = {
        title: normStr(payload.title || ""),
        slug: normSlug(payload.slug || payload.title || ""),
        excerpt: normStr(payload.excerpt || ""),
        coverUrl: normStr(payload.coverUrl || ""),
        body: normStr(payload.body || ""),
        tags,
        tagsLower: toLowerArray(tags),
        status,
        category: normCategory(payload.category),
        subCategory: normSubCategory(payload.subCategory),
        createdAt: now,
        updatedAt: now,
        publishedAt: status === "published" ? now : null,
        author: {
            uid: author.uid || null,
            displayName: normStr(author.displayName || ""),
        },
    };

    return await addDoc(collection(db, COL), base);
}

/* ------------------------------
 * 更新
 *  - 公開切替時：既存に publishedAt が無ければセット
 *  - draft に戻しても publishedAt は保持（履歴として）
 *  - 検索用に tagsLower も更新
 * ----------------------------*/
export async function updateArticle(id, payload) {
    const ref = doc(db, COL, id);

    // 既存を見て publishedAt の有無を判断
    const currentSnap = await getDoc(ref);
    const current = currentSnap.exists() ? currentSnap.data() : {};

    const nextStatus = payload.status === "published" ? "published" : "draft";

    const tags = normTags(payload.tags);
    const patch = {
        title: normStr(payload.title),
        slug: normSlug(payload.slug || payload.title || current.slug || ""),
        excerpt: normStr(payload.excerpt),
        coverUrl: normStr(payload.coverUrl),
        body: normStr(payload.body),
        tags,
        tagsLower: toLowerArray(tags),
        status: nextStatus,
        category: normCategory(payload.category),
        subCategory: normSubCategory(payload.subCategory),
        updatedAt: serverTimestamp(),
    };

    // 初めて公開状態になるタイミングで publishedAt を付与
    const hadPublishedAt = !!current.publishedAt;
    if (nextStatus === "published" && !hadPublishedAt) {
        patch.publishedAt = serverTimestamp();
    }

    await updateDoc(ref, patch);
}

/* ------------------------------
 * 削除
 * ----------------------------*/
export async function deleteArticle(id) {
    await deleteDoc(doc(db, COL, id));
}
