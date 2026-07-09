// src/features/layout/hooks/useWorkspaceSync.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { getWorkspaceDocRef, getPlansColRef } from "../utils/workspaceStubs";

export function useWorkspaceSync({
    uid,
    projectId,
    workspaceId,
    initialBaseId: selectedBaseId = null,
    initialPlanId: selectedPlanId = null,
}) {
    const [bases, setBases] = useState([]);
    const [proposals, setProposals] = useState([]); // All proposal plans
    const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
    const [fetchedWorkspaceId, setFetchedWorkspaceId] = useState(null);

    const effectiveLoading = isWorkspaceLoading || (workspaceId !== fetchedWorkspaceId);
    
    // We no longer keep local state for selectedBaseId. 
    // We treat initial props as truth because they are synced via Zustand.

    // 1) Subscribe to ALL plans in this workspace
    useEffect(() => {
        if (!projectId || !workspaceId) {
            setBases([]);
            setProposals([]);
            return;
        }

        const q = query(
            getPlansColRef(projectId, workspaceId),
            where("planType", "in", ["base", "proposal"])
        );
        
        const unsub = onSnapshot(q, (snap) => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Sort by order -> createdAt string/ms fallback
            all.sort((a, b) => {
                const ao = a.order || a.sortOrder || 999999;
                const bo = b.order || b.sortOrder || 999999;
                if (ao !== bo) return ao - bo;
                const ac = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
                const bc = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
                return ac - bc;
            });

            setBases(all.filter(p => p.planType === "base"));
            setProposals(all.filter(p => p.planType === "proposal"));
            setFetchedWorkspaceId(workspaceId);
            setIsWorkspaceLoading(false);
        }, (err) => {
            console.error("useWorkspaceSync onSnapshot error", err);
            setFetchedWorkspaceId(workspaceId);
            setIsWorkspaceLoading(false);
        });

        return () => unsub();
    }, [projectId, workspaceId]);

    // 2) Derive proposals for the currently selected base
    const plansOfSelectedBase = useMemo(() => {
        if (!selectedBaseId) return [];
        return proposals.filter(p => p.parentPlanId === selectedBaseId || p.rootBaseId === selectedBaseId);
    }, [proposals, selectedBaseId]);

    // 3) Auto-select removed: Let users see the Base Dashboard if nothing is selected.
    // useEffect(() => {
    //     if (!bases.length) return;
    //     if (!selectedBaseId || !bases.some(b => b.id === selectedBaseId)) {
    //         setSelectedBaseId(bases[0].id);
    //         setSelectedPlanId(null);
    //     }
    // }, [bases, selectedBaseId]);

    // 4) Auto-select removed: We want to show the Plan Dashboard if a user selects a base.
    // Instead of auto-selecting the first proposal, we leave selectedPlanId as null
    // so that the dashboard handles user selection.

    // 5) Sync selected state to Workspace Doc (currentBaseId / currentPlanId)
    const syncWorkspaceCurrent = useCallback(async ({ baseId, planId }) => {
        if (!projectId || !workspaceId) return;
        try {
            await updateDoc(getWorkspaceDocRef(projectId, workspaceId), {
                currentBaseId: baseId || null,
                currentPlanId: planId || null,
                updatedAt: serverTimestamp()
            });
        } catch (e) {
            console.warn("Failed to sync workspace current ids", e);
        }
    }, [projectId, workspaceId]);

    // Handlers
    const onSelectBase = useCallback(async (baseId) => {
        if (!baseId) return;
        await syncWorkspaceCurrent({ baseId, planId: null });
    }, [syncWorkspaceCurrent]);

    const onSelectPlan = useCallback(async (...args) => {
        let planId = null;
        let baseId = selectedBaseId;

        if (args.length >= 2) {
            baseId = args[0];
            planId = args[1];
        } else {
            planId = args[0];
        }

        if (!baseId || !planId) return;
        await syncWorkspaceCurrent({ baseId, planId });
    }, [selectedBaseId, syncWorkspaceCurrent]);

    return {
        bases,
        plansOfSelectedBase,
        isWorkspaceLoading: effectiveLoading,

        selectedBaseId,
        selectedPlanId,
        
        onSelectBase,
        onSelectPlan,
        syncWorkspaceCurrent,
    };
}
