// src/features/layout/hooks/useWorkspaceModelRefs.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

// ---------------------------
// refs
// ---------------------------
function getWorkspaceModelRefsColRef({ projectId, workspaceId }) {
    if (!projectId || !workspaceId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "workspaceModelRefs");
}

function getWorkspaceModelRefDocRef({ projectId, workspaceId, modelId }) {
    if (!projectId || !workspaceId || !modelId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "workspaceModelRefs", modelId);
}

function getPlanModelRefsColRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "planModelRefs");
}

function getPlanModelRefsDocRef({ projectId, workspaceId, planId, modelId }) {
    if (!projectId || !workspaceId || !planId || !modelId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "planModelRefs", modelId);
}

/**
 * useWorkspaceModelRefs
 * - workspace に追加されたモデル（workspaceModelRefs）を購読
 * - 選択中 plan の「使用中（planModelRefs）」も購読
 */
export function useWorkspaceModelRefs({
    projectId,
    workspaceId,
    planId,
    enabled = true,
} = {}) {
    const [workspaceLoading, setWorkspaceLoading] = useState(true);
    const [planLoading, setPlanLoading] = useState(true);

    const [workspaceModelIds, setWorkspaceModelIds] = useState(() => new Set());
    const [planModelIds, setPlanModelIds] = useState(() => new Set());

    // --------
    // workspaceModelRefs
    // --------
    useEffect(() => {
        if (!enabled) {
            setWorkspaceModelIds(new Set());
            setWorkspaceLoading(false);
            return;
        }

        const colRef = getWorkspaceModelRefsColRef({ projectId, workspaceId });
        if (!colRef) {
            setWorkspaceModelIds(new Set());
            setWorkspaceLoading(false);
            return;
        }

        setWorkspaceLoading(true);
        const unsub = onSnapshot(
            colRef,
            (snap) => {
                const next = new Set(snap.docs.map((d) => d.id));
                setWorkspaceModelIds(next);
                setWorkspaceLoading(false);
            },
            (err) => {
                console.warn("[useWorkspaceModelRefs] workspaceModelRefs snapshot error:", err);
                setWorkspaceModelIds(new Set());
                setWorkspaceLoading(false);
            }
        );

        return () => unsub();
    }, [enabled, projectId, workspaceId]);

    // --------
    // planModelRefs
    // --------
    useEffect(() => {
        if (!enabled) {
            setPlanModelIds(new Set());
            setPlanLoading(false);
            return;
        }

        const colRef = getPlanModelRefsColRef({ projectId, workspaceId, planId });
        if (!colRef) {
            setPlanModelIds(new Set());
            setPlanLoading(false);
            return;
        }

        setPlanLoading(true);
        const unsub = onSnapshot(
            colRef,
            (snap) => {
                const next = new Set(snap.docs.map((d) => d.id));
                setPlanModelIds(next);
                setPlanLoading(false);
            },
            (err) => {
                console.warn("[useWorkspaceModelRefs] planModelRefs snapshot error:", err);
                setPlanModelIds(new Set());
                setPlanLoading(false);
            }
        );

        return () => unsub();
    }, [enabled, projectId, workspaceId, planId]);

    // --------
    // actions
    // --------
    const addToWorkspace = useCallback(
        async (model) => {
            const modelId = typeof model === "string" ? model : model?.id;
            if (!modelId) return;

            const ref = getWorkspaceModelRefDocRef({ projectId, workspaceId, modelId });
            if (!ref) return;

            await setDoc(
                ref,
                {
                    modelId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        },
        [projectId, workspaceId]
    );

    const removeFromWorkspace = useCallback(
        async (modelId) => {
            if (!modelId) return;

            const ref = getWorkspaceModelRefDocRef({ projectId, workspaceId, modelId });
            if (ref) await deleteDoc(ref);

            const pref = getPlanModelRefsDocRef({ projectId, workspaceId, planId, modelId });
            if (pref) await deleteDoc(pref);
        },
        [projectId, workspaceId, planId]
    );

    const setUseInPlan = useCallback(
        async (modelId, next) => {
            if (!modelId) return;

            if (!workspaceModelIds.has(modelId)) return;

            const ref = getPlanModelRefsDocRef({ projectId, workspaceId, planId, modelId });
            if (!ref) return;

            if (next) {
                await setDoc(
                    ref,
                    {
                        modelId,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    },
                    { merge: true }
                );
            } else {
                await deleteDoc(ref);
            }
        },
        [projectId, workspaceId, planId, workspaceModelIds]
    );

    return useMemo(
        () => ({
            workspaceModelIds,
            planModelIds,
            workspaceLoading,
            planLoading,
            addToWorkspace,
            removeFromWorkspace,
            setUseInPlan,
        }),
        [
            workspaceModelIds,
            planModelIds,
            workspaceLoading,
            planLoading,
            addToWorkspace,
            removeFromWorkspace,
            setUseInPlan,
        ]
    );
}
