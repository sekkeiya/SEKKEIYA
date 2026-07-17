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
import { db } from "../../../../lib/firebase/client";

function safeStr(v, fb = "") {
    return typeof v === "string" && v.trim() ? v : fb;
}

// assets コレクションには 3Dモデル以外（画像/レンダー/ブログカバー等）も混在するため、
// 家具ライブラリには 3Dモデルのみを通す。type=='3d-model' を基本とし、
// type が無い旧データは GLB/GLTF を指す URL の有無でフォールバック判定する。
function isThreeDModel(a) {
    if (!a) return false;
    const t = String(a.type || "").toLowerCase();
    if (t === "3d-model" || t === "model" || t.includes("3d")) return true;
    if (t) return false; // 画像/動画/ブログ等の明示 type は除外
    const g = a.glbUrl || a.downloadUrl || a.url || a.files?.glb?.url || a.files?.glb?.downloadUrl;
    return !!g && /\.(glb|gltf)(\?|#|$)/i.test(String(g));
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
                        // 家具サムネはモデル固有の thumbUrl / thumbnailUrl のみ。
                        // coverUrl はブログ/記事カバー用フィールドで、混入すると
                        // 無関係な画像（例: 赤い内観レンダー）がタイルに出るため使わない。
                        thumbUrl: safeStr(data.thumbUrl || data.thumbnailUrl, ""),
                        updatedAt: data.updatedAt || data.createdAt || null,
                        raw: data,
                    };
                }).filter(isThreeDModel);
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
