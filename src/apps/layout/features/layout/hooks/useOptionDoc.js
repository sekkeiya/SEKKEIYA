// src/features/layout/hooks/useOptionDoc.js
import { useCallback, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

import { getPlanDocRef, getItemsColRef } from "@layout/shared/api/workspaces/workspaces";

export function useOptionDoc({ projectId, workspaceId, planId, baseId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const ref = useMemo(() => {
        if (!projectId || !workspaceId || !planId) return null;
        return getPlanDocRef(projectId, workspaceId, planId);
    }, [projectId, workspaceId, planId]);

    const itemsColRef = useMemo(() => {
        if (!projectId || !workspaceId || !planId) return null;
        return getItemsColRef({ projectId, workspaceId, planId });
    }, [projectId, workspaceId, planId]);

    useEffect(() => {
        if (!ref || !itemsColRef) {
            setLoading(false);
            setData(null);
            return;
        }

        setLoading(true);

        // 1. Subscribe to the plan document metadata
        const unsubPlan = onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                setData(null);
                setLoading(false);
                return;
            }
            
            const planData = { id: snap.id, ...snap.data() };

            // 2. Fetch the items subcollection once or listen to it
            // For 3DSL, items are edited locally and saved atomically usually, but listening is safer
            getDocs(itemsColRef).then((itemsSnap) => {
                const items = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setData({ ...planData, layout: { items } });
                setLoading(false);
            }).catch(e => {
                console.warn("[useOptionDoc] Failed to get items", e);
                setData({ ...planData, layout: { items: [] } });
                setLoading(false);
            });
        }, (err) => {
            console.warn("[useOptionDoc] snapshot error:", err);
            setData(null);
            setLoading(false);
        });

        return () => unsubPlan();
    }, [ref, itemsColRef]);

    /**
     * ensureExists: If the option doesn't exist, create it.
     */
    const ensureExists = useCallback(
        async (fallbackMeta = {}) => {
            if (!ref) return;

            const snap = await getDoc(ref);
            if (snap.exists()) return;

            const initial = {
                ...fallbackMeta,
                projectId,
                workspaceId,
                planType: "option",
                parentPlanId: baseId, // In 3DSL, baseId often acts as the parent of options unless it's a proposal
                rootBaseId: baseId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            await setDoc(ref, initial, { merge: true });
            
            // Layout items are empty by default, no need to create subcollection docs explicitly
        },
        [ref, projectId, workspaceId, baseId]
    );

    /**
     * saveLayout: Replaces setDoc(optionRef, { layout: nextLayout }) in LayoutShell.
     * Manages syncing the items array into the subcollection.
     */
    const saveLayout = useCallback(
        async (nextLayout) => {
            if (!ref || !itemsColRef) return;

            const items = Array.isArray(nextLayout.items) ? nextLayout.items : [];
            const itemIdsInNext = new Set(items.map(it => it.id).filter(Boolean));

            const batch = writeBatch(db);

            // 1. Update the plan metadata updatedAt
            batch.update(ref, { updatedAt: serverTimestamp() });

            // 2. Fetch existing items in the subcollection to identify deletions
            const existingItemsSnap = await getDocs(itemsColRef);
            existingItemsSnap.forEach(docSnap => {
                if (!itemIdsInNext.has(docSnap.id)) {
                    batch.delete(docSnap.ref);
                }
            });

            // 3. Set all items in the new layout
            items.forEach(it => {
                if (!it.id) {
                    // Safety check, usually layout items already have random IDs generated in UI
                    it.id = doc(itemsColRef).id;
                }
                const itemRef = doc(itemsColRef, it.id);
                batch.set(itemRef, {
                    ...it,
                    workspaceId,
                    planId,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
            });

            await batch.commit();
        },
        [ref, itemsColRef, workspaceId, planId]
    );

    return { data, loading, ref, ensureExists, saveLayout };
}
