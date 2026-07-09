// src/features/layout/hooks/useWorkspaceSync.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { onSnapshot, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { getWorkspaceDocRef, getPlansColRef } from "@layout/shared/api/workspaces/workspaces";

export function useWorkspaceSync({
    uid,
    projectId,
    workspaceId,
    initialBaseId = null,
    initialPlanId = null,
}) {
    const [bases, setBases] = useState([]);
    const [proposals, setProposals] = useState([]); // All proposal plans
    
    // UI selection state
    const [selectedBaseId, setSelectedBaseId] = useState(initialBaseId);
    const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);

    // Sync from props once
    useEffect(() => {
        if (initialBaseId) setSelectedBaseId(initialBaseId);
        if (initialPlanId) setSelectedPlanId(initialPlanId);
    }, [initialBaseId, initialPlanId]);

    // 1) Subscribe to ALL plans in this workspace
    useEffect(() => {
        if (!projectId || !workspaceId) {
            setBases([]);
            setProposals([]);
            return;
        }

        const q = query(getPlansColRef(projectId, workspaceId), where("planType", "in", ["base", "proposal"]));
        
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
        }, (err) => {
            console.error("useWorkspaceSync onSnapshot error", err);
        });

        return () => unsub();
    }, [projectId, workspaceId]);

    // 2) Derive proposals for the currently selected base
    const plansOfSelectedBase = useMemo(() => {
        if (!selectedBaseId) return [];
        return proposals.filter(p => p.parentPlanId === selectedBaseId || p.rootBaseId === selectedBaseId);
    }, [proposals, selectedBaseId]);

    // 3) Auto-select first base if nothing selected
    useEffect(() => {
        if (!bases.length) return;
        if (!selectedBaseId || !bases.some(b => b.id === selectedBaseId)) {
            setSelectedBaseId(bases[0].id);
            setSelectedPlanId(null);
        }
    }, [bases, selectedBaseId]);

    // 4) Auto-select first proposal if base changed
    useEffect(() => {
        if (!selectedBaseId) return;
        if (selectedPlanId && plansOfSelectedBase.some(p => p.id === selectedPlanId)) return;
        if (!plansOfSelectedBase.length) return;
        
        setSelectedPlanId(plansOfSelectedBase[0].id);
    }, [selectedBaseId, selectedPlanId, plansOfSelectedBase]);

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
        setSelectedBaseId(baseId);
        setSelectedPlanId(null);
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
        setSelectedBaseId(baseId);
        setSelectedPlanId(planId);
        await syncWorkspaceCurrent({ baseId, planId });
    }, [selectedBaseId, syncWorkspaceCurrent]);

    return {
        bases,
        plansOfSelectedBase,

        selectedBaseId,
        selectedPlanId,
        
        setSelectedBaseId,
        setSelectedPlanId,

        onSelectBase,
        onSelectPlan,
        syncWorkspaceCurrent,
    };
}
