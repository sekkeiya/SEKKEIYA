// src/features/layout/hooks/useOptionRealtime.js
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { getPlansColRef } from "../utils/workspaceStubs";

function sortByOrderThenId(a, b) {
    const ao = typeof a?.order === "number" ? a?.order : (a?.sortOrder || 999999);
    const bo = typeof b?.order === "number" ? b?.order : (b?.sortOrder || 999999);
    if (ao !== bo) return ao - bo;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function useOptionRealtime({
    uid,
    projectId,
    workspaceId,
    baseId,
    planId,
    initialOptionId,
    defaultOptionId = "A-1",
}) {
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [remoteOptions, setRemoteOptions] = useState(null);
    const [selectedOptionId, setSelectedOptionId] = useState(initialOptionId || null);
    const [fetchedPlanId, setFetchedPlanId] = useState(null);

    // Derive loading synchronously to prevent flashing old/empty data when switching plans
    const effectiveOptionsLoading = optionsLoading || (planId !== fetchedPlanId);

    // Reset selection when plan changes, but respect initialOptionId if coming from props
    useEffect(() => {
        setSelectedOptionId(initialOptionId || null);
    }, [baseId, planId, initialOptionId]);

    useEffect(() => {
        if (!projectId || !workspaceId || !planId) {
            setRemoteOptions([]);
            setOptionsLoading(false);
            return;
        }

        setOptionsLoading(true);

        const q = query(
            getPlansColRef(projectId, workspaceId),
            where("planType", "==", "option"),
            where("parentPlanId", "==", planId)
        );

        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    name: String(data.name ?? d.id),
                    memo: String(data.memo ?? ""),
                    order: typeof data.order === "number" ? data.order : (data.sortOrder || 9999),
                    createdAt: data.createdAt || null,
                };
            });
            list.sort(sortByOrderThenId);
            setRemoteOptions(list);
            setFetchedPlanId(planId);
            setOptionsLoading(false);
        }, (err) => {
            console.error("useOptionRealtime onSnapshot error", err);
            setFetchedPlanId(planId);
            setOptionsLoading(false);
        });

        return () => unsub();
    }, [projectId, workspaceId, planId]);

    const defaultOptions = useMemo(
        () => [{ id: defaultOptionId, name: defaultOptionId, memo: "基本案", order: 10 }],
        [defaultOptionId]
    );

    const options = useMemo(() => {
        if (Array.isArray(remoteOptions) && remoteOptions.length > 0) return remoteOptions;
        return defaultOptions;
    }, [remoteOptions, defaultOptions]);

    // 3) Auto-select or validate (Removed to prevent aggressive nullification when planId is undefined)
    // We trust that if an optionId is selected via props/Zustand, it should remain selected.
    // If the document doesn't exist, useOptionDoc will handle its creation.
    
    // 4) Compute the next index for A-#
    const nextAIdFromOptions = useMemo(() => {
        if (!options || !options.length) return "A-1";
        const nums = options
            .map((o) => String(o?.id || o?.name || ""))
            .map((s) => {
                const m = s.match(/^A-(\d+)$/i);
                return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n));
        const max = nums.length ? Math.max(...nums) : 0;
        return `A-${max + 1}`;
    }, [options]);

    return {
        options,
        optionsLoading: effectiveOptionsLoading,
        selectedOptionId,
        setSelectedOptionId,
        nextAIdFromOptions,
    };
}
