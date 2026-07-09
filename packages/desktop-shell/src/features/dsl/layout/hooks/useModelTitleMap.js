// src/features/layout/hooks/useModelTitleMap.js
import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, collectionGroup, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";

/**
 * ✅ modelId -> title をFirestoreから補完してキャッシュする共通Hook
 *
 * - 入力：必要な modelIds（配列）
 * - 出力：modelTitleMap（{[modelId]: title}）
 *
 * 仕様：
 * - not-found / title空 は "" をキャッシュ（再取得しない）
 * - permission-denied / unauthenticated は「キャッシュしない」（後で再試行できるように）
 */
export function useModelTitleMap(modelIds = []) {
    const [modelTitleMap, setModelTitleMap] = useState({}); // { [modelId]: string }
    const mapRef = useRef(modelTitleMap);

    // ref を最新化（effect内で stale を避ける）
    useEffect(() => {
        mapRef.current = modelTitleMap;
    }, [modelTitleMap]);

    // ✅ 正規化（trim + 重複排除）
    const normalizedIds = useMemo(() => {
        const set = new Set();
        for (const id of modelIds || []) {
            const t = String(id || "").trim();
            if (t) set.add(t);
        }
        return Array.from(set);
    }, [modelIds]);

    // ✅ 依存キー（順序ブレ対策）
    const depKey = useMemo(() => {
        const a = [...normalizedIds];
        a.sort();
        return a.join("|");
    }, [normalizedIds]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!normalizedIds.length) return;

            // ✅ まだ取得してないものだけ（"" は取得済扱い）
            const missing = normalizedIds.filter((id) => mapRef.current[id] === undefined);
            if (!missing.length) return;

            const results = await Promise.all(
                missing.map(async (modelId) => {
                    try {
                        const q = query(collectionGroup(db, "models"), where("id", "==", modelId), limit(1));
                        const snap = await getDocs(q);

                        if (snap.empty) {
                            // not-found は "" をキャッシュしてOK（再取得不要）
                            return { id: modelId, title: "", shouldCache: true };
                        }

                        const d = snap.docs[0].data();
                        const titleCandidate = (d.title || d.name || "").trim();
                        // title が空でも "" としてキャッシュ（再取得不要）
                        return { id: modelId, title: titleCandidate || "", shouldCache: true };
                    } catch (e) {
                        const code = e?.code || "";
                        // ✅ 権限系はキャッシュしない（後で auth/ルールが整ったら再試行できる）
                        if (code === "permission-denied" || code === "unauthenticated") {
                            console.warn("[useModelTitleMap] denied:", modelId, code);
                            return { id: modelId, title: "", shouldCache: false };
                        }

                        // それ以外は一旦 "" キャッシュ（無限リトライ防止）
                        console.warn("[useModelTitleMap] read failed:", modelId, code || e);
                        return { id: modelId, title: "", shouldCache: true };
                    }
                })
            );

            if (cancelled) return;

            // ✅ shouldCache=true のものだけ反映（denied は map に入れない）
            const toCache = results.filter((x) => x.shouldCache);
            if (!toCache.length) return;

            setModelTitleMap((prev) => {
                const next = { ...prev };
                for (const { id, title } of toCache) next[id] = title;
                return next;
            });
        }

        run();
        return () => {
            cancelled = true;
        };
    }, [depKey, normalizedIds]);

    return modelTitleMap;
}