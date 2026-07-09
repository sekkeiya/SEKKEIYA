// src/features/layout/utils/boardKeyResolvers.js

function parseKeyIndex(key, prefix) {
    const s = String(key || "").trim().toLowerCase();
    if (!s.startsWith(prefix)) return null;
    const n = Number(s.slice(prefix.length));
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
}

function safeArr(v) {
    return Array.isArray(v) ? v : [];
}

function sortByOrderThenUpdatedAt(a, b) {
    const ao = typeof a?.order === "number" ? a.order : 999999;
    const bo = typeof b?.order === "number" ? b.order : 999999;
    if (ao !== bo) return ao - bo;

    const au = typeof a?.updatedAt === "number" ? a.updatedAt : 0;
    const bu = typeof b?.updatedAt === "number" ? b.updatedAt : 0;
    return bu - au; // 新しい順（お好みで逆でもOK）
}

/**
 * meta（boardの集約データ）から baseId を解決
 * meta.bases: [{ id, name, order?, updatedAt? }, ...] を想定
 */
export function resolveBaseByKey(meta, baseKey) {
    const idx = parseKeyIndex(baseKey, "b");
    if (!idx) return null;

    const bases = safeArr(meta?.bases).slice().sort(sortByOrderThenUpdatedAt);
    const base = bases[idx - 1] || null;
    return base ? { id: base.id, name: base.name ?? `Base-${idx}` } : null;
}

/**
 * meta（boardの集約データ）から planId を解決
 * meta.plans: [{ id, name, baseId, order?, updatedAt? }, ...] を想定
 * ※ baseId で絞ってから p1/p2... を振る
 */
export function resolvePlanByKey(meta, baseId, planKey) {
    const idx = parseKeyIndex(planKey, "p");
    if (!idx || !baseId) return null;

    const plansAll = safeArr(meta?.plans);
    const plans = plansAll
        .filter((p) => p?.baseId === baseId)
        .slice()
        .sort(sortByOrderThenUpdatedAt);

    const plan = plans[idx - 1] || null;
    return plan ? { id: plan.id, name: plan.name ?? `Plan-${idx}` } : null;
}
