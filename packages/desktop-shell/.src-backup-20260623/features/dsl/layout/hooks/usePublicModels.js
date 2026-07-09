// src/features/layout/hooks/usePublicModels.js
import { useEffect, useMemo, useState } from "react";
import {
    collection,
    limit as fsLimit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

function safeStr(v, fb = "") {
    return typeof v === "string" && v.trim() ? v : fb;
}

/**
 * usePublicModels
 * - 公開モデル一覧を購読（MVP）
 * - ✅ permission-denied を避けるため「公開のみ」に絞る
 * - ✅ orderBy が原因で落ちるケース（updatedAt 未整備など）に備えて fallback する
 *
 * 想定:
 * - models/{modelId}
 * - 公開条件は visibility: "public" に統一するのが一番安全
 */
export function usePublicModels({ enabled = true, limit = 60 } = {}) {
    const [loading, setLoading] = useState(true);
    const [models, setModels] = useState([]);

    useEffect(() => {
        if (!enabled) {
            setModels([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const col = collection(db, "assets");
        const lim = fsLimit(Math.max(1, Number(limit) || 60));

        // In Phase 11, public 3DSS models are located in 'assets' with visibility=='public'
        // Using only equality filter to avoid requiring 'assets' composite indexes for MVP
        const q = query(col, where("visibility", "==", "public"), lim);

        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
                    return {
                        id: d.id,
                        ...data,
                        name: safeStr(data.name, d.id),
                        brand: safeStr(data.brand, ""),
                        ownerHandle: safeStr(data.ownerHandle, ""),
                        thumbUrl: safeStr(data.thumbUrl || data.thumbnailUrl || data.coverUrl, ""),
                        updatedAt: data.updatedAt || data.createdAt || null,
                        raw: data,
                    };
                });
                setModels(list);
                setLoading(false);
            },
            (err) => {
                console.warn("[usePublicModels] snapshot error:", err);
                setModels([]);
                setLoading(false);
            }
        );

        return () => {
            if (typeof unsub === "function") unsub();
        };
    }, [enabled, limit]);

    return useMemo(() => ({ models, loading }), [models, loading]);
}
