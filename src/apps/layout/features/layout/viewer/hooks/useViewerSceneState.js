// src/features/layout/LayoutViewer/hooks/useViewerSceneState.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

function pick(v) {
    const s = typeof v === "string" ? v.trim() : "";
    return s || null;
}

function firstPlanId(plansByBase, baseId) {
    const arr = plansByBase?.[baseId] || [];
    return arr[0]?.id || null;
}

export function useViewerSceneState({ boardId, bases, plansByBase, viewerConfig }) {
    const [searchParams, setSearchParams] = useSearchParams();

    const urlBase = pick(searchParams.get("base"));
    const urlPlan = pick(searchParams.get("plan"));
    const urlOption = pick(searchParams.get("option")); // ✅ 追加

    const [selected, setSelected] = useState({
        baseId: null,
        planId: null,
        optionId: "A-1", // ✅ デフォルト
        selectedObject: null,
    });

    const curatedItems = viewerConfig?.items || [];
    const allowBrowseAll = viewerConfig?.allowBrowseAll ?? true;

    const baseIds = useMemo(() => new Set((bases || []).map((b) => b.id)), [bases]);

    const isValidBase = useCallback((id) => !!id && baseIds.has(id), [baseIds]);

    const isValidPlan = useCallback(
        (baseId, planId) => {
            if (!baseId || !planId) return false;
            const arr = plansByBase?.[baseId] || [];
            return arr.some((p) => p.id === planId);
        },
        [plansByBase]
    );

    // 初期選択を決める
    useEffect(() => {
        if (!boardId) return;

        const optionId = urlOption || "A-1";

        // 1) URL優先
        if (isValidBase(urlBase)) {
            const baseId = urlBase;
            const planId = isValidPlan(baseId, urlPlan) ? urlPlan : firstPlanId(plansByBase, baseId);
            setSelected((s) => ({ ...s, baseId, planId, optionId }));
            return;
        }

        // 2) curated があれば先頭
        if (curatedItems.length > 0) {
            const item0 = curatedItems[0];
            const baseId = item0.baseId;
            const planId = item0.planId;
            if (isValidBase(baseId)) {
                const finalPlan = isValidPlan(baseId, planId) ? planId : firstPlanId(plansByBase, baseId);
                setSelected((s) => ({ ...s, baseId, planId: finalPlan, optionId }));

                const next = new URLSearchParams(searchParams);
                next.set("base", baseId);
                if (finalPlan) next.set("plan", finalPlan);
                next.set("option", optionId);
                setSearchParams(next, { replace: true });
                return;
            }
        }

        // 3) bases 先頭
        const baseId = bases?.[0]?.id || null;
        if (!baseId) return;
        const planId = firstPlanId(plansByBase, baseId);

        setSelected((s) => ({ ...s, baseId, planId, optionId }));

        const next = new URLSearchParams(searchParams);
        next.set("base", baseId);
        if (planId) next.set("plan", planId);
        next.set("option", optionId);
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardId, bases, plansByBase, viewerConfig]);

    // ✅ optionId も扱えるように
    const setSelection = useCallback(
        ({ baseId, planId, optionId }) => {
            setSelected((s) => ({
                ...s,
                baseId: baseId ?? s.baseId,
                planId: planId ?? s.planId,
                optionId: optionId ?? s.optionId,
            }));

            const next = new URLSearchParams(searchParams);
            if (baseId) next.set("base", baseId);
            if (planId) next.set("plan", planId);
            next.set("option", optionId || selected.optionId || "A-1");
            setSearchParams(next, { replace: false });
        },
        [searchParams, setSearchParams, selected.optionId]
    );

    const setSelectedObject = useCallback((obj) => {
        setSelected((s) => ({ ...s, selectedObject: obj }));
    }, []);

    return {
        selected,
        setSelection,
        setSelectedObject,
        curatedItems,
        allowBrowseAll,
    };
}
