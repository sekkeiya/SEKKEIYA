// src/features/dsl/layout/hooks/useWorkspaceStructure.js
// Loads the flat `layouts` collection and classifies docs into the
// Base → Plan → Option hierarchy via planType / rootBaseId / parentPlanId.
//
// Back-compat: legacy docs created as planType:"layout" (or with no planType)
// are surfaced as Bases so existing data keeps showing until migrated.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspaceLayouts } from "./useWorkspaces";

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

    // Base 選択時は Plan を自動選択しない（Base＝躯体のみを表示）。
    // ただし、選択中の Plan が現在の Base 配下に存在しなくなった場合のみクリアする。
    useEffect(() => {
        if (loading) return;
        if (!selectedPlanId) return;
        if (plansOfSelectedBase.some((p) => p.id === selectedPlanId)) return;
        setSelectedPlanId(null);
    }, [loading, plansOfSelectedBase, selectedPlanId]);

    // Option も同様に自動選択しない。選択中の Option が現在の Plan 配下に
    // 存在しなくなった場合のみクリアする。
    useEffect(() => {
        if (loading) return;
        if (!selectedOptionId) return;
        if (options.some((o) => o.id === selectedOptionId)) return;
        setSelectedOptionId(null);
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
