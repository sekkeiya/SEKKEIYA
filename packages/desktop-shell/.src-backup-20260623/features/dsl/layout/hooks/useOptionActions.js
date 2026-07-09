import { useCallback } from "react";
import { runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";
import { useLayoutTaskStore } from "@desktop/features/dsl/layout/store/useLayoutTaskStore";

/**
 * OptionDoc の layout.items を安全に更新するためのアクション群
 * - runTransaction で取りこぼし防止
 * - Firestoreに入れられない値（undefined/NaN/Infinity等）を除去
 * - 400の時に「実際に書こうとした payload」をログ
 */

function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
}

function toFiniteNumber(v, fallback = 0) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return fallback;
}

function toVec3(v, fallback) {
    if (!Array.isArray(v) || v.length < 3) return [...fallback];
    return [
        toFiniteNumber(v[0], fallback[0]),
        toFiniteNumber(v[1], fallback[1]),
        toFiniteNumber(v[2], fallback[2]),
    ];
}

function sanitizeForFirestore(value) {
    if (value === undefined) return undefined;
    if (value === null) return null;

    const t = typeof value;

    if (t === "number") return Number.isFinite(value) ? value : 0;
    if (t === "string" || t === "boolean") return value;

    if (Array.isArray(value)) {
        const arr = [];
        for (const v of value) {
            const sv = sanitizeForFirestore(v);
            if (sv !== undefined) arr.push(sv);
        }
        return arr;
    }

    if (isPlainObject(value)) {
        const obj = {};
        for (const [k, v] of Object.entries(value)) {
            const sv = sanitizeForFirestore(v);
            if (sv !== undefined) obj[k] = sv;
        }
        return obj;
    }

    // Date は許可（Timestamp等もSDK側で扱えるケース多いが安全側）
    if (value instanceof Date) return value;

    return undefined;
}

function normalizeItem(raw) {
    const item = isPlainObject(raw) ? raw : {};

    const now = Date.now();

    const id = typeof item.id === "string" && item.id ? item.id : `item_${now}`;
    const type = typeof item.type === "string" && item.type ? item.type : "furniture";
    const label = typeof item.label === "string" && item.label ? item.label : "item";
    const modelId = typeof item.modelId === "string" && item.modelId ? item.modelId : null;

    const tr = isPlainObject(item.transform) ? item.transform : {};
    const position = toVec3(tr.position, [0, 0.3, 0]);
    const rotation = toVec3(tr.rotation, [0, 0, 0]);
    const scale = toVec3(tr.scale, [1, 1, 1]);

    const createdAtMs = toFiniteNumber(item.createdAtMs, now);
    const planningProps = isPlainObject(item.planningProps) ? item.planningProps : {};
    const zoneId = typeof item.zoneId === "string" ? item.zoneId : undefined;

    const normalized = {
        ...item,
        id,
        type,
        label,
        modelId,
        transform: { position, rotation, scale },
        planningProps,
        ...(zoneId !== undefined && { zoneId }),
        createdAtMs,
    };

    return sanitizeForFirestore(normalized);
}

export function useOptionActions(optionRef) {
    const activeZoneId = useLayoutTaskStore(s => s.activeZoneId);

    const addItem = useCallback(
        async (rawItem) => {
            if (!optionRef) {
                console.warn("[useOptionActions:addItem] optionRef is null");
                return;
            }

            const safeItem = normalizeItem(rawItem);
            
            // NOTE: Phase 1 Limitation
            // `zoneId` binding is logical-only. Geometric collision detection and 
            // bounds checking are NOT verified here. Scheduled for Phase 2.
            if (activeZoneId && safeItem.zoneId === undefined) {
                safeItem.zoneId = activeZoneId;
            }

            try {
                await runTransaction(db, async (tx) => {
                    const snap = await tx.get(optionRef);

                    const current = snap.exists() ? snap.data() : {};
                    const layout = isPlainObject(current?.layout) ? current.layout : {};
                    const items = Array.isArray(layout.items) ? layout.items : [];

                    const nextItems = [...items, safeItem];

                    tx.set(
                        optionRef,
                        {
                            layout: { ...layout, items: nextItems },
                            updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                    );
                });
            } catch (e) {
                console.error("[useOptionActions:addItem] failed:", e);
                console.log("[useOptionActions:addItem] safeItem =", safeItem);
                throw e;
            }
        },
        [optionRef]
    );

    const setItems = useCallback(
        async (rawItems) => {
            if (!optionRef) {
                console.warn("[useOptionActions:setItems] optionRef is null");
                return;
            }

            const list = Array.isArray(rawItems) ? rawItems : [];
            const nextItems = list.map((it) => normalizeItem(it)).filter(Boolean);

            try {
                await runTransaction(db, async (tx) => {
                    tx.set(
                        optionRef,
                        {
                            layout: { items: nextItems },
                            updatedAt: serverTimestamp(),
                        },
                        { merge: true }
                    );
                });
            } catch (e) {
                console.error("[useOptionActions:setItems] failed:", e);
                console.log("[useOptionActions:setItems] nextItems =", nextItems);
                throw e;
            }
        },
        [optionRef]
    );

    return { addItem, setItems };
}
