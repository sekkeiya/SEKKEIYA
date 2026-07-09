// src/features/layout/utils/labels/itemLabelUtils.js

/**
 * 8-4-4-4-12 のUUID形式っぽいか判定
 */
export function isUuidLike(s) {
    const t = String(s || "").trim();
    if (!t) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

/**
 * ID短縮表示
 */
export function shortId(s, n = 8) {
    const t = String(s || "");
    if (!t) return "";
    return t.length <= n ? t : t.slice(0, n);
}

/**
 * ✅ Layout全体で共通の「アイテム表示名」
 * - item 自体に title/name/label 等があればそれを優先
 * - ただし UUIDっぽい/ modelIdそのもの は「名前なし」とみなす
 * - 名前が無いときは modelTitleMap[modelId]（Firestore補完結果）を使う
 * - 最後は type/subType や短縮IDでフォールバック
 *
 * @param {object} it - placed item / layout item
 * @param {object} modelTitleMap - { [modelId]: "title" }（空文字もあり得る）
 */
export function getItemDisplayLabel(it, modelTitleMap = {}) {
    const modelId = it?.modelId || it?.id;
    const modelIdStr = String(modelId || "").trim();

    const direct =
        it?.title ||
        it?.name ||
        it?.label ||
        it?.modelName ||
        it?.meta?.name ||
        it?.model?.name;

    const directStr = String(direct || "").trim();

    // ✅ uuid / modelIdそのもの / 空 は「名前なし」扱い
    const directIsBad =
        !directStr ||
        isUuidLike(directStr) ||
        (modelIdStr && directStr === modelIdStr);

    if (!directIsBad) return directStr;

    // ✅ Firestore補完（models/{id}.title）
    if (modelIdStr) {
        const t = modelTitleMap?.[modelIdStr];
        if (t && String(t).trim()) return String(t).trim();
    }

    // ✅ type/subType を補助表示
    const t2 = [it?.type, it?.subType].filter(Boolean).join(" / ");
    if (t2) return t2;

    // ✅ 最後の逃げ
    if (modelIdStr) return `Model ${shortId(modelIdStr, 8)}`;
    return `Item ${shortId(it?.id, 8)}`;
}

/**
 * ✅ 検索用のキーワード抽出（任意）
 * Populate/Libraryで検索に使える
 */
export function getItemSearchText(it, modelTitleMap = {}) {
    const title = getItemDisplayLabel(it, modelTitleMap);

    const brand = String(it?.brand || "");
    const type = String(it?.type || "");
    const sub = String(it?.subType || "");
    const modelId = String(it?.modelId || it?.id || "");

    return [title, brand, type, sub, modelId].join(" ").toLowerCase();
}
