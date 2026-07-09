// src/features/dsl/layout/hooks/useLayoutCrudActions.js
import { useCallback, useState } from "react";
import {
    createLayout,
    cloneLayout,
    deleteLayout as deleteLayoutStub,
    createStructureNode,
    cloneStructureNode,
    clonePlanCascade,
    deleteStructureCascade,
} from "@desktop/features/dsl/layout/utils/workspaceStubs";

/**
 * useLayoutCrudActions
 * Base / Plan / Option CRUD over the flat `layouts` collection.
 * Hierarchy is expressed via planType ('base'|'plan'|'option'), rootBaseId, parentPlanId.
 * Also keeps the legacy flat Layout API for back-compat.
 */
export function useLayoutCrudActions({
    uid,
    projectId,
    workspaceId,

    // structure context
    bases = [],
    plansOfSelectedBase = [],
    options = [],

    selectedBaseId,
    selectedPlanId,

    setSelectedBaseId,
    setSelectedPlanId,
    setSelectedOptionId,

    bumpBaseVersion,

    // legacy flat context (optional)
    layouts = [],
    selectedLayoutId,
    setSelectedLayoutId,
}) {
    const [creatingBase, setCreatingBase] = useState(false);
    const [creatingPlan, setCreatingPlan] = useState(false);
    const [creatingOption, setCreatingOption] = useState(false);
    const [deletingBase, setDeletingBase] = useState(false);
    const [deletingPlan, setDeletingPlan] = useState(false);
    const [deletingOption, setDeletingOption] = useState(false);
    const [duplicatingBase, setDuplicatingBase] = useState(false);
    const [duplicatingPlan, setDuplicatingPlan] = useState(false);
    const [duplicatingOption, setDuplicatingOption] = useState(false);

    const [creatingLayout, setCreatingLayout] = useState(false);
    const [deletingLayout, setDeletingLayout] = useState(false);
    const [duplicatingLayout, setDuplicatingLayout] = useState(false);

    const safeArray = (arr) => (Array.isArray(arr) ? arr : []);

    const getNextName = (list, prefix) => {
        const nums = safeArray(list)
            .map((o) => String(o?.name || ""))
            .map((s) => {
                const m =
                    s.match(new RegExp(`^${prefix}\\s*(\\d+)$`, "i")) ||
                    s.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
                return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n));
        const max = nums.length ? Math.max(...nums) : 0;
        return `${prefix} ${max + 1}`;
    };

    const baseNameOf = (list, id, fallback) =>
        safeArray(list).find((x) => x?.id === id)?.name || fallback;

    const stripCopySuffix = (name) => {
        const m = String(name || "").match(/^(.*?)(?:\s*copy\s*\d*|\s*\(\d+\))?$/i);
        return (m ? m[1] : String(name || "")).trim() || "Untitled";
    };

    // =====================================================
    // CREATE
    // =====================================================
    const createBase = useCallback(async () => {
        if (!projectId || !workspaceId || !uid || creatingBase) return null;
        setCreatingBase(true);
        try {
            // 1. Create the base node (named "Layout N" to match the default sidebar convention)
            const baseNode = await createStructureNode({
                projectId,
                workspaceId,
                userId: uid,
                name: getNextName(bases, "Layout"),
                planType: "base",
            });

            // 2. Auto-create "Plan 1" under the new base.
            // Options are NOT auto-created: a Plan is itself an editable layout
            // (furniture saves to the Plan doc via effectiveLayoutId). Options are
            // created only when the user starts a material-study variation.
            const planNode = await createStructureNode({
                projectId,
                workspaceId,
                userId: uid,
                name: "Plan 1",
                planType: "plan",
                rootBaseId: baseNode.id,
            });

            setSelectedBaseId?.(baseNode.id);
            setSelectedPlanId?.(planNode.id);
            setSelectedOptionId?.(null);
            return baseNode;
        } catch (e) {
            console.error("createBase failed:", e);
            throw e;
        } finally {
            setCreatingBase(false);
        }
    }, [projectId, workspaceId, uid, bases, creatingBase, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId]);

    const createPlan = useCallback(async (baseId) => {
        const targetBaseId = baseId || selectedBaseId;
        if (!projectId || !workspaceId || !uid || !targetBaseId || creatingPlan) return null;
        setCreatingPlan(true);
        try {
            // Plan を作成（Option は自動作成しない。Plan 自体が編集可能なレイアウト）
            const planNode = await createStructureNode({
                projectId,
                workspaceId,
                userId: uid,
                name: getNextName(plansOfSelectedBase, "Plan"),
                planType: "plan",
                rootBaseId: targetBaseId,
            });

            setSelectedPlanId?.(planNode.id);
            setSelectedOptionId?.(null);
            return planNode;
        } catch (e) {
            console.error("createPlan failed:", e);
            throw e;
        } finally {
            setCreatingPlan(false);
        }
    }, [projectId, workspaceId, uid, selectedBaseId, plansOfSelectedBase, creatingPlan, setSelectedPlanId, setSelectedOptionId]);

    const createOption = useCallback(async (payload) => {
        const baseId = payload?.baseId || selectedBaseId;
        const planId = payload?.planId || selectedPlanId;
        if (!projectId || !workspaceId || !uid || !baseId || !planId || creatingOption) return null;
        setCreatingOption(true);
        try {
            // Clone the parent Plan's current layout into the new Option so it starts
            // as a material-study variation of the Plan (rather than an empty room).
            const node = await cloneStructureNode({
                projectId,
                workspaceId,
                sourceId: planId,
                userId: uid,
                newName: getNextName(options, "Option"),
                overrides: { planType: "option", rootBaseId: baseId, parentPlanId: planId },
            });
            setSelectedOptionId?.(node.id);
            return node;
        } catch (e) {
            console.error("createOption failed:", e);
            throw e;
        } finally {
            setCreatingOption(false);
        }
    }, [projectId, workspaceId, uid, selectedBaseId, selectedPlanId, options, creatingOption, setSelectedOptionId]);

    // =====================================================
    // DUPLICATE
    // =====================================================
    const duplicateBase = useCallback(async (baseId) => {
        if (!projectId || !workspaceId || !uid || !baseId || duplicatingBase) return null;
        setDuplicatingBase(true);
        try {
            const newName = getNextName(bases, `${stripCopySuffix(baseNameOf(bases, baseId, "Base"))} copy`);
            const node = await cloneStructureNode({
                projectId, workspaceId, sourceId: baseId, userId: uid, newName,
                overrides: { planType: "base" },
            });
            setSelectedBaseId?.(node.id);
            return node;
        } catch (e) {
            console.error("duplicateBase failed:", e);
            throw e;
        } finally {
            setDuplicatingBase(false);
        }
    }, [projectId, workspaceId, uid, bases, duplicatingBase, setSelectedBaseId]);

    const duplicatePlan = useCallback(async (planId) => {
        if (!projectId || !workspaceId || !uid || !planId || duplicatingPlan) return null;
        setDuplicatingPlan(true);
        try {
            const newName = getNextName(plansOfSelectedBase, `${stripCopySuffix(baseNameOf(plansOfSelectedBase, planId, "Plan"))} copy`);
            // clonePlanCascade copies the Plan doc + its items AND all child Options (+ their items)
            const { plan: newPlan, options: newOptions } = await clonePlanCascade({
                projectId,
                workspaceId,
                sourcePlanId: planId,
                userId: uid,
                newPlanName: newName,
                rootBaseId: selectedBaseId || undefined,
            });
            setSelectedPlanId?.(newPlan.id);
            // Select the first cloned Option so furniture placement works immediately
            const firstOption = newOptions[0];
            if (firstOption) setSelectedOptionId?.(firstOption.id);
            return newPlan;
        } catch (e) {
            console.error("duplicatePlan failed:", e);
            throw e;
        } finally {
            setDuplicatingPlan(false);
        }
    }, [projectId, workspaceId, uid, selectedBaseId, plansOfSelectedBase, duplicatingPlan, setSelectedPlanId, setSelectedOptionId]);

    const duplicateOption = useCallback(async (optionId) => {
        if (!projectId || !workspaceId || !uid || !optionId || duplicatingOption) return null;
        setDuplicatingOption(true);
        try {
            const newName = getNextName(options, `${stripCopySuffix(baseNameOf(options, optionId, "Option"))} copy`);
            const node = await cloneStructureNode({
                projectId, workspaceId, sourceId: optionId, userId: uid, newName,
                overrides: { planType: "option" },
            });
            setSelectedOptionId?.(node.id);
            return node;
        } catch (e) {
            console.error("duplicateOption failed:", e);
            throw e;
        } finally {
            setDuplicatingOption(false);
        }
    }, [projectId, workspaceId, uid, options, duplicatingOption, setSelectedOptionId]);

    // =====================================================
    // DELETE
    // =====================================================
    const deleteBase = useCallback(async (baseId) => {
        if (!projectId || !workspaceId || !baseId || deletingBase) return;
        setDeletingBase(true);
        try {
            await deleteStructureCascade(projectId, workspaceId, baseId, "base");
            if (selectedBaseId === baseId) {
                const next = safeArray(bases).find((b) => b.id !== baseId)?.id || null;
                setSelectedBaseId?.(next);
                setSelectedPlanId?.(null);
                setSelectedOptionId?.(null);
            }
        } catch (e) {
            console.error("deleteBase failed:", e);
            throw e;
        } finally {
            setDeletingBase(false);
        }
    }, [projectId, workspaceId, selectedBaseId, bases, deletingBase, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId]);

    const deletePlan = useCallback(async (planId) => {
        if (!projectId || !workspaceId || !planId || deletingPlan) return;
        setDeletingPlan(true);
        try {
            await deleteStructureCascade(projectId, workspaceId, planId, "plan");
            if (selectedPlanId === planId) {
                const next = safeArray(plansOfSelectedBase).find((p) => p.id !== planId)?.id || null;
                setSelectedPlanId?.(next);
                setSelectedOptionId?.(null);
            }
        } catch (e) {
            console.error("deletePlan failed:", e);
            throw e;
        } finally {
            setDeletingPlan(false);
        }
    }, [projectId, workspaceId, selectedPlanId, plansOfSelectedBase, deletingPlan, setSelectedPlanId, setSelectedOptionId]);

    const deleteOption = useCallback(async (optionId) => {
        if (!projectId || !workspaceId || !optionId || deletingOption) return;
        setDeletingOption(true);
        try {
            await deleteLayoutStub(projectId, workspaceId, optionId);
            setSelectedOptionId?.(safeArray(options).find((o) => o.id !== optionId)?.id || null);
        } catch (e) {
            console.error("deleteOption failed:", e);
            throw e;
        } finally {
            setDeletingOption(false);
        }
    }, [projectId, workspaceId, options, deletingOption, setSelectedOptionId]);

    // =====================================================
    // LEGACY flat Layout API (back-compat)
    // =====================================================
    const createNewLayout = useCallback(async () => {
        if (!projectId || !workspaceId || !uid || creatingLayout) return null;
        setCreatingLayout(true);
        try {
            const node = await createLayout({
                projectId, workspaceId, userId: uid, name: getNextName(layouts, "Layout"),
            });
            setSelectedLayoutId?.(node.id);
            return node;
        } finally {
            setCreatingLayout(false);
        }
    }, [projectId, workspaceId, uid, layouts, creatingLayout, setSelectedLayoutId]);

    const duplicateLayout = useCallback(async (targetId) => {
        if (!projectId || !workspaceId || !uid || !targetId || duplicatingLayout) return null;
        setDuplicatingLayout(true);
        try {
            const newName = getNextName(layouts, `${stripCopySuffix(baseNameOf(layouts, targetId, "Layout"))} copy`);
            const node = await cloneLayout({
                projectId, workspaceId, sourceLayoutId: targetId, userId: uid, newName,
            });
            setSelectedLayoutId?.(node.id);
            return node;
        } finally {
            setDuplicatingLayout(false);
        }
    }, [projectId, workspaceId, uid, layouts, duplicatingLayout, setSelectedLayoutId]);

    const deleteLayout = useCallback(async (targetId) => {
        if (!projectId || !workspaceId || !targetId || deletingLayout) return;
        setDeletingLayout(true);
        try {
            await deleteLayoutStub(projectId, workspaceId, targetId);
            if (selectedLayoutId === targetId) {
                setSelectedLayoutId?.(safeArray(layouts).find((l) => l.id !== targetId)?.id || null);
            }
        } finally {
            setDeletingLayout(false);
        }
    }, [projectId, workspaceId, selectedLayoutId, layouts, deletingLayout, setSelectedLayoutId]);

    return {
        // structure crud
        createBase,
        createPlan,
        createOption,
        deleteBase,
        deletePlan,
        deleteOption,
        duplicateBase,
        duplicatePlan,
        duplicateOption,

        // structure busy flags
        creatingBase,
        creatingPlan,
        creatingOption,
        deletingBase,
        deletingPlan,
        deletingOption,
        duplicatingBase,
        duplicatingPlan,
        duplicatingOption,

        // legacy flat
        createLayout: createNewLayout,
        deleteLayout,
        duplicateLayout,
        creatingLayout,
        deletingLayout,
        duplicatingLayout,
    };
}
