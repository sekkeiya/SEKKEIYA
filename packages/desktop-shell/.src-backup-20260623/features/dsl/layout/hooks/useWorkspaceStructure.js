// src/features/dsl/layout/hooks/useWorkspaceStructure.js
// Loads the flat `layouts` collection and classifies docs into the
// Base → Plan → Option hierarchy via planType / rootBaseId / parentPlanId.
//
// Back-compat: legacy docs created as planType:"layout" (or with no planType)
// are surfaced as Bases so existing data keeps showing until migrated.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceLayouts } from "@desktop/features/dsl/layout/hooks/useWorkspaces";

const isBaseDoc = (d) => {
    const t = d?.planType;
    return t === "base" || t === "layout" || !t;
};
const isPlanDoc = (d) => d?.planType === "plan";
const isOptionDoc = (d) => d?.planType === "option";

export function useWorkspaceStructure({ projectId, workspaceId, initialBaseId, initialPlanId, initialOptionId }) {
    const { layouts, loading } = useWorkspaceLayouts(projectId, workspaceId);

    const [selectedBaseId, setSelectedBaseId] = useState(initialBaseId || null);
    const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId || null);
    const [selectedOptionId, setSelectedOptionId] = useState(initialOptionId || null);

    const bases = useMemo(() => (Array.isArray(layouts) ? layouts.filter(isBaseDoc) : []), [layouts]);

    const plansOfSelectedBase = useMemo(() => {
        if (!selectedBaseId || !Array.isArray(layouts)) return [];
        return layouts.filter((d) => isPlanDoc(d) && d.rootBaseId === selectedBaseId);
    }, [layouts, selectedBaseId]);

    const options = useMemo(() => {
        if (!selectedPlanId || !Array.isArray(layouts)) return [];
        return layouts.filter((d) => isOptionDoc(d) && d.parentPlanId === selectedPlanId);
    }, [layouts, selectedPlanId]);

    // ---- sync explicit selection coming from outside (nav / dashboard) ----
    // A Base is opened only when one is explicitly chosen; otherwise selectedBaseId
    // stays null so the project-level Layout Dashboard remains visible.
    useEffect(() => {
        if (!initialBaseId) return;
        setSelectedBaseId(initialBaseId);
        setSelectedPlanId(initialPlanId || null);
        setSelectedOptionId(initialOptionId || null);
    }, [initialBaseId, initialPlanId, initialOptionId]);

    useEffect(() => {
        if (loading) return;
        if (selectedPlanId && plansOfSelectedBase.some((p) => p.id === selectedPlanId)) return;
        setSelectedPlanId(plansOfSelectedBase[0]?.id || null);
    }, [loading, plansOfSelectedBase, selectedPlanId]);

    useEffect(() => {
        if (loading) return;
        if (selectedOptionId && options.some((o) => o.id === selectedOptionId)) return;
        setSelectedOptionId(options[0]?.id || null);
    }, [loading, options, selectedOptionId]);

    // ---- selection handlers (reset descendants on change) ----
    const onSelectBase = useCallback((id) => {
        setSelectedBaseId(id);
        setSelectedPlanId(null);
        setSelectedOptionId(null);
    }, []);

    const onSelectPlan = useCallback((id) => {
        setSelectedPlanId(id);
        setSelectedOptionId(null);
    }, []);

    return {
        layouts,
        isWorkspaceLoading: loading,
        optionsLoading: loading,

        bases,
        plansOfSelectedBase,
        options,

        selectedBaseId,
        selectedPlanId,
        selectedOptionId,

        setSelectedBaseId,
        setSelectedPlanId,
        setSelectedOptionId,

        onSelectBase,
        onSelectPlan,
    };
}
