// src/utils/routeKeys.js

// ✅ URLキーの区切り：アンダーバー2つに統一
export const KEY_SEP = "__";

export function extractSlugFromKey(key) {
    const s = String(key ?? "").trim();
    if (!s) return "";
    const idx = s.indexOf(KEY_SEP);
    if (idx > 0) return s.slice(idx + KEY_SEP.length);
    return "";
}

export function extractIdFromKey(key) {
    const s = String(key ?? "").trim();
    if (!s) return null;
    const idx = s.indexOf(KEY_SEP);
    if (idx > 0) return s.slice(0, idx);
    return s; // slug無しならそのままID
}

/** ざっくりslug化（日本語も残してOK。URL安全化を優先） */
export function slugify(input, fallback = "untitled") {
    const s = String(input ?? "").trim();
    if (!s) return fallback;

    const out = s
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}_-]+/gu, "") // 文字/数字/_/-
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");

    return out || fallback;
}

/**
 * ✅ id + slug を結合してURL用キーを作る
 * 例: buildKey("base-xxx", "Base-A") => "base-xxx__base-a"
 */
export function buildKey(id, nameOrSlug) {
    const _id = String(id ?? "").trim();
    if (!_id) return "";
    const slug = slugify(nameOrSlug, "untitled");
    return `${_id}${KEY_SEP}${slug}`;
}
