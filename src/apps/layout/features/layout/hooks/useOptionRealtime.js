// src/features/layout/hooks/useOptionRealtime.js
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where } from "firebase/firestore";
import { getPlansColRef } from "@layout/shared/api/workspaces/workspaces";

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
    defaultOptionId = "A-1",
}) {
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [remoteOptions, setRemoteOptions] = useState(null);
    const [selectedOptionId, setSelectedOptionId] = useState(defaultOptionId);

    // Reset selection when plan changes
    useEffect(() => {
        setSelectedOptionId(defaultOptionId);
    }, [baseId, planId, defaultOptionId]);

    useEffect(() => {
        if (!projectId || !workspaceId || !planId) {
            setRemoteOptions([]);
            setOptionsLoading(false);
            return;
        }

        setOptionsLoading(true);
        setRemoteOptions(null);

        const colRef = getPlansColRef(projectId, workspaceId);
        // An option is a plan whose parent is the selected proposal plan
        const q = query(
            colRef, 
            where("parentPlanId", "==", planId),
            where("planType", "==", "option")
        );

        const unsub = onSnapshot(
            q,
            (snap) => {
                const list = snap.docs.map((d) => {
                    const data = d.data() || {};
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
                setOptionsLoading(false);
            },
            (err) => {
                console.warn("[useOptionRealtime] options snapshot error:", err);
                setRemoteOptions([]);
                setOptionsLoading(false);
            }
        );

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

    // Keep selection valid
    useEffect(() => {
        if (!options.length) return;
        if (!options.some((o) => o.id === selectedOptionId)) {
            setSelectedOptionId(options[0].id);
        }
    }, [options, selectedOptionId]);

    // Helper to generate next Option ID (A-1, A-2 etc)
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
        optionsLoading,
        selectedOptionId,
        setSelectedOptionId,
        nextAIdFromOptions,
    };
}
