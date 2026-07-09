// src/features/layout/hooks/usePublicModels.js
import { useEffect, useMemo, useState } from "react";
import {
    collectionGroup,
    limit as fsLimit,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

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

        const col = collectionGroup(db, "models");
        const lim = fsLimit(Math.max(1, Number(limit) || 60));

        // ✅ primary: canonical + public + updatedAt desc
        const q1 = query(
            col,
            where("isCanonical", "==", true),
            where("visibility", "==", "public"),
            orderBy("updatedAt", "desc"),
            lim
        );

        // ✅ fallback: canonical + public (without ordering)
        const q2 = query(col, where("isCanonical", "==", true), where("visibility", "==", "public"), lim);

        let unsub = null;

        // onSnapshot は try/catch では拾えないことがあるので、まず q1 で購読して
        // permission-denied / failed-precondition などが来たら q2 に切り替える
        const subscribe = (q) =>
            onSnapshot(
                q,
                (snap) => {
                    const list = snap.docs.map((d) => {
                        const data = d.data() || {};
                        return {
                            id: d.id,
                            name: safeStr(data.name, d.id),
                            brand: safeStr(data.brand, ""),
                            ownerHandle: safeStr(data.ownerHandle, ""),
                            thumbUrl: safeStr(data.thumbUrl || data.thumbnailUrl || data.coverUrl, ""),
                            // ここは表示用途
                            updatedAt: data.updatedAt || data.createdAt || null,
                            raw: data,
                        };
                    });
                    setModels(list);
                    setLoading(false);
                },
                (err) => {
                    // ✅ q1 が落ちた場合だけ q2 に切り替える（無限ループ防止）
                    const code = String(err?.code || "");
                    console.warn("[usePublicModels] snapshot error:", err);

                    if (q === q1 && (code.includes("failed-precondition") || code.includes("permission-denied"))) {
                        if (typeof unsub === "function") unsub();
                        unsub = subscribe(q2);
                        return;
                    }

                    setModels([]);
                    setLoading(false);
                }
            );

        unsub = subscribe(q1);

        return () => {
            if (typeof unsub === "function") unsub();
        };
    }, [enabled, limit]);

    return useMemo(() => ({ models, loading }), [models, loading]);
}
