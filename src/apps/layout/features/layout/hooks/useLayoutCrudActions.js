// src/features/layout/hooks/useLayoutCrudActions.js
import { useCallback, useState } from "react";
import { getDocs, query, where } from "firebase/firestore";
import { getPlansColRef, createPlan, clonePlan, deletePlan } from "@layout/shared/api/workspaces/workspaces";
import { getStorage, ref as sRef, deleteObject } from "firebase/storage";
import { fetchPlanLayoutShareId, deleteLayoutThumbIfExists, deleteViewerShareIfExists } from "@layout/features/layout/utils/layoutShareUtils";

/**
 * useLayoutCrudActions (Workspace-based SSOT Schema)
 * - Base/Plan(Proposal)/Option の作成・削除・複製 (すべて Plan コレクションで管理)
 */
export function useLayoutCrudActions({
    uid,
    projectId,
    workspaceId,

    bases = [],               // plans with planType === 'base'
    plansOfSelectedBase = [], // proposals under selected base
    options = [],             // options under selected proposal

    selectedBaseId,
    selectedPlanId,

    setSelectedBaseId,
    setSelectedPlanId,
    setSelectedOptionId,

    bumpBaseVersion,
}) {

    const [creatingBase, setCreatingBase] = useState(false);
    const [creatingPlan, setCreatingPlan] = useState(false);
    const [creatingOption, setCreatingOption] = useState(false);

    const [deletingBase, setDeletingBase] = useState(false);
    const [deletingPlan, setDeletingPlan] = useState(false);
    const [deletingOption, setDeletingOption] = useState(false);

    const [duplicatingPlan, setDuplicatingPlan] = useState(false);
    const [duplicatingOption, setDuplicatingOption] = useState(false);

    const safeArray = (arr) => Array.isArray(arr) ? arr : [];

    // -------------------------
    // Helpers
    // -------------------------
    const getNextName = (list, prefix) => {
        const nums = safeArray(list)
            .map((o) => String(o?.name || ""))
            .map((s) => {
                const m = s.match(new RegExp(`^${prefix}(\\d+)$`, "i")) || s.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
                return m ? Number(m[1]) : NaN;
            })
            .filter((n) => Number.isFinite(n));
        const max = nums.length ? Math.max(...nums) : 0;
        return `${prefix}${prefix.endsWith('-') ? '' : ' '}${max + 1}`;
    };

    // -------------------------
    // CASCADE DELETE Helper
    // -------------------------
    const deletePlanWithCascade = async (targetPlanId) => {
        if (!projectId || !workspaceId || !targetPlanId) return;

        // 1) Find all children (proposals, options)
        const colRef = getPlansColRef(projectId, workspaceId);
        const childrenSnap = await getDocs(query(colRef, where("parentPlanId", "==", targetPlanId)));
        
        // Recursively delete children
        for (const childDoc of childrenSnap.docs) {
            await deletePlanWithCascade(childDoc.id);
        }

        // 2) Delete shares/thumbs
        try {
            const shareId = await fetchPlanLayoutShareId({
                ownerUid: uid,
                projectId,
                workspaceId,
                planId: targetPlanId,
            });
            if (shareId) {
                await deleteLayoutThumbIfExists({
                    ownerUid: uid,
                    projectId,
                    workspaceId,
                    planId: targetPlanId,
                    shareId,
                });
                await deleteViewerShareIfExists(shareId);
            }
        } catch (err) {
            console.warn("Failed to cleanup shares for", targetPlanId, err);
        }

        // 3) Delete the actual plan + items
        await deletePlan(projectId, workspaceId, targetPlanId);
    };

    const deleteStoragePathIfExists = async (path) => {
        if (!path) return;
        try {
            const storage = getStorage();
            await deleteObject(sRef(storage, path));
        } catch (e) {
            if (e?.code !== "storage/object-not-found") {
                console.warn("[deleteStoragePathIfExists] failed:", e);
            }
        }
    };


    // -------------------------
    // Base: Create
    // -------------------------
    const createBase = useCallback(async () => {
        if (!projectId || !workspaceId || !uid) return;
        if (creatingBase) return;

        setCreatingBase(true);
        try {
            const baseName = getNextName(bases, "Base");

            // 1. Create Base Plan
            const newBase = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: baseName,
                planType: "base",
                parentPlanId: null,
            });

            // 2. Create Initial Proposal (Plan 1)
            const newProposal = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: "Plan 1",
                planType: "proposal",
                parentPlanId: newBase.id,
                rootBaseId: newBase.id,
            });

            // 3. Create Initial Option (A-1)
            const newOption = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: "A-1",
                planType: "option",
                parentPlanId: newProposal.id,
                rootBaseId: newBase.id,
            });

            setSelectedBaseId?.(newBase.id);
            setSelectedPlanId?.(newProposal.id);
            setSelectedOptionId?.(newOption.id);
            bumpBaseVersion?.();
        } catch (e) {
            console.warn("[useLayoutCrudActions] createBase failed:", e);
            alert(`Base作成に失敗: ${e?.message}`);
        } finally {
            setCreatingBase(false);
        }
    }, [projectId, workspaceId, uid, creatingBase, bases, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId, bumpBaseVersion]);

    // -------------------------
    // Plan(Proposal): Create
    // -------------------------
    const createPlanAction = useCallback(async (baseId) => {
        if (!projectId || !workspaceId || !uid || !baseId) return;
        if (creatingPlan) return;

        setCreatingPlan(true);
        try {
            const planName = getNextName(plansOfSelectedBase, "Plan");

            // 1. Create Proposal
            const newProposal = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: planName,
                planType: "proposal",
                parentPlanId: baseId,
                rootBaseId: baseId,
            });

            // 2. Create Initial Option
            const newOption = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: "A-1",
                planType: "option",
                parentPlanId: newProposal.id,
                rootBaseId: baseId,
            });

            setSelectedBaseId?.(baseId);
            setSelectedPlanId?.(newProposal.id);
            setSelectedOptionId?.(newOption.id);
        } catch (e) {
            console.warn("[useLayoutCrudActions] createPlan failed:", e);
            alert(`Plan作成に失敗: ${e?.message}`);
        } finally {
            setCreatingPlan(false);
        }
    }, [projectId, workspaceId, uid, creatingPlan, plansOfSelectedBase, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId]);

    // -------------------------
    // Option: Create
    // -------------------------
    const createOptionAction = useCallback(async ({ baseId, planId }) => {
        if (!projectId || !workspaceId || !uid || !baseId || !planId) return;
        if (creatingOption) return;

        setCreatingOption(true);
        try {
            const nextOptionName = getNextName(options, "A-");
            
            const newOption = await createPlan({
                projectId,
                workspaceId,
                userId: uid,
                name: nextOptionName,
                planType: "option",
                parentPlanId: planId,
                rootBaseId: baseId,
            });

            setSelectedOptionId?.(newOption.id);
        } catch (e) {
            console.warn("[useLayoutCrudActions] createOption failed:", e);
            alert(`Option作成に失敗: ${e?.message}`);
        } finally {
            setCreatingOption(false);
        }
    }, [projectId, workspaceId, uid, creatingOption, options, setSelectedOptionId]);

    // -------------------------
    // Option: Delete
    // -------------------------
    const deleteOptionAction = useCallback(async (optionId) => {
        if (!projectId || !workspaceId || !optionId) return;
        if (deletingOption) return;

        setDeletingOption(true);
        try {
            await deletePlanWithCascade(optionId);
        } catch (e) {
            console.warn("[useLayoutCrudActions] deleteOption failed:", e);
            alert(`Option削除に失敗: ${e?.message}`);
        } finally {
            setDeletingOption(false);
        }
    }, [projectId, workspaceId, deletingOption, uid]);

    // -------------------------
    // Plan(Proposal): Delete
    // -------------------------
    const deletePlanAction = useCallback(async (planId) => {
        if (!projectId || !workspaceId || !planId) return;
        if (deletingPlan) return;

        setDeletingPlan(true);
        try {
            await deletePlanWithCascade(planId);

            if (selectedPlanId === planId) {
                setSelectedPlanId?.(null);
                setSelectedOptionId?.(null);
            }
        } catch (e) {
            console.warn("[useLayoutCrudActions] deletePlan failed:", e);
            alert(`Plan削除に失敗: ${e?.message}`);
        } finally {
            setDeletingPlan(false);
        }
    }, [projectId, workspaceId, deletingPlan, selectedPlanId, setSelectedPlanId, setSelectedOptionId, uid]);

    // -------------------------
    // Base: Delete
    // -------------------------
    const deleteBaseAction = useCallback(async (baseId) => {
        if (!projectId || !workspaceId || !baseId) return;
        if (deletingBase) return;

        setDeletingBase(true);
        try {
            // Find base to get glb path if it exists
            const baseObj = bases.find(b => b.id === baseId);
            const glbUrl = baseObj?.glbUrl;

            await deletePlanWithCascade(baseId);

            if (glbUrl) {
                // If the base had a 3D model path, delete it from storage
                await deleteStoragePathIfExists(glbUrl);
            }

            if (selectedBaseId === baseId) {
                setSelectedBaseId?.(null);
                setSelectedPlanId?.(null);
                setSelectedOptionId?.(null);
            }

            bumpBaseVersion?.();
        } catch (e) {
            console.warn("[useLayoutCrudActions] deleteBase failed:", e);
            alert(`Base削除に失敗: ${e?.message}`);
        } finally {
            setDeletingBase(false);
        }
    }, [projectId, workspaceId, deletingBase, bases, selectedBaseId, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId, bumpBaseVersion, uid]);

    // -------------------------
    // Option: Duplicate
    // -------------------------
    const duplicateOptionAction = useCallback(async ({ baseId, planId, optionId }) => {
        if (!projectId || !workspaceId || !uid || !optionId) return;
        if (duplicatingOption) return;

        setDuplicatingOption(true);
        try {
            const srcOption = options.find(o => o.id === optionId);
            const parentId = srcOption?.parentPlanId || planId;

            const nextOptionName = getNextName(options, "A-");
            
            const clonedOption = await clonePlan({
                projectId,
                workspaceId,
                sourcePlanId: optionId,
                userId: uid,
                newName: nextOptionName,
                parentPlanIdOverride: parentId, // Create as sibling
                planTypeOverride: "option"
            });

            setSelectedOptionId?.(clonedOption.id);
        } catch (e) {
            console.warn("[useLayoutCrudActions] duplicateOption failed:", e);
            alert(`Option複製に失敗: ${e?.message}`);
        } finally {
            setDuplicatingOption(false);
        }
    }, [projectId, workspaceId, uid, duplicatingOption, options, setSelectedOptionId]);

    // -------------------------
    // Plan(Proposal): Duplicate
    // -------------------------
    const duplicatePlanAction = useCallback(async (baseId, planId) => {
        if (!projectId || !workspaceId || !uid || !planId) return;
        if (duplicatingPlan) return;

        setDuplicatingPlan(true);
        try {
            const srcPlan = plansOfSelectedBase.find(p => p.id === planId);
            const parentId = srcPlan?.parentPlanId || baseId;
            const planName = srcPlan ? `${srcPlan.name} (Copy)` : getNextName(plansOfSelectedBase, "Plan");

            // Clone the proposal itself (creates as sibling)
            const clonedPlan = await clonePlan({
                projectId,
                workspaceId,
                sourcePlanId: planId,
                userId: uid,
                newName: planName,
                parentPlanIdOverride: parentId,
                planTypeOverride: "proposal"
            });

            // Clone child options
            const colRef = getPlansColRef(projectId, workspaceId);
            const childrenSnap = await getDocs(query(colRef, where("parentPlanId", "==", planId)));
            
            let firstNewOptionId = null;
            for (const childDoc of childrenSnap.docs) {
                const clonedOption = await clonePlan({
                    projectId,
                    workspaceId,
                    sourcePlanId: childDoc.id,
                    userId: uid,
                    newName: childDoc.data()?.name || "A-1",
                    parentPlanIdOverride: clonedPlan.id, // Reparent to new proposal
                    planTypeOverride: "option"
                });
                if (!firstNewOptionId) firstNewOptionId = clonedOption.id;
            }
            
            setSelectedPlanId?.(clonedPlan.id);
            if (firstNewOptionId) {
                setSelectedOptionId?.(firstNewOptionId);
            }
        } catch (e) {
            console.warn("[useLayoutCrudActions] duplicatePlan failed:", e);
            alert(`Plan複製に失敗: ${e?.message}`);
        } finally {
            setDuplicatingPlan(false);
        }
    }, [projectId, workspaceId, uid, duplicatingPlan, plansOfSelectedBase, setSelectedBaseId, setSelectedPlanId, setSelectedOptionId]);

    // Export with legacy names for compatibility
    return {
        createBase,
        createPlan: createPlanAction,
        createOption: createOptionAction,
        deleteOption: deleteOptionAction,
        deletePlan: deletePlanAction,
        deleteBase: deleteBaseAction,
        duplicateOption: duplicateOptionAction,
        duplicatePlan: duplicatePlanAction,

        creatingBase,
        creatingPlan,
        creatingOption,
        deletingBase,
        deletingPlan,
        deletingOption,
        duplicatingPlan,
        duplicatingOption,
    };
}
