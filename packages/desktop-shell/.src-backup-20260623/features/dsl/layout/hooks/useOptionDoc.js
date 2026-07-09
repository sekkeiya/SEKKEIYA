// src/features/layout/hooks/useOptionDoc.js
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

import { getPlanDocRef, getItemsColRef } from "@desktop/features/dsl/layout/utils/workspaceStubs";
import { getProjectAssetsColRef, getProjectAssetRef } from "@desktop/features/dsl/layout/paths/workspacePaths";

export function useOptionDoc({ projectId, workspaceId, planId, baseId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Manage synced items separately for cost-free deletion diffing
    const lastSyncedItemsRef = useRef([]);

    const ref = useMemo(() => {
        if (!projectId || !workspaceId || !planId) return null;
        return getPlanDocRef(projectId, workspaceId, planId);
    }, [projectId, workspaceId, planId]);

    const itemsColRef = useMemo(() => {
        if (!projectId || !workspaceId || !planId) return null;
        return getItemsColRef(projectId, workspaceId, planId);
    }, [projectId, workspaceId, planId]);

    useEffect(() => {
        if (!ref || !itemsColRef) {
            setLoading(false);
            setData(null);
            lastSyncedItemsRef.current = [];
            return;
        }

        setLoading(true);

        let planData = null;
        let itemsData = null;
        
        let planLoaded = false;
        let itemsLoaded = false;

        const checkLoaded = () => {
            if (planLoaded && itemsLoaded) {
                if (!planData) {
                    setData(null);
                    lastSyncedItemsRef.current = [];
                } else {
                    const items = itemsData || [];
                    setData({ ...planData, layout: { items } });
                    lastSyncedItemsRef.current = items;
                }
                setLoading(false);
            }
        };

        // 1. Subscribe to the plan document metadata
        const unsubPlan = onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                planData = null;
            } else {
                planData = { id: snap.id, ...snap.data() };
            }
            planLoaded = true;
            checkLoaded();
        }, (err) => {
            console.warn("[useOptionDoc] plan snapshot error:", err);
            planData = null;
            planLoaded = true;
            checkLoaded();
        });

        // 2. Subscribe to items collection instead of getDocs to minimize read costs
        const unsubItems = onSnapshot(itemsColRef, (snap) => {
            itemsData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            itemsLoaded = true;
            checkLoaded();
        }, (err) => {
            console.warn("[useOptionDoc] items snapshot error:", err);
            itemsData = [];
            itemsLoaded = true;
            checkLoaded();
        });

        return () => {
            unsubPlan();
            unsubItems();
        };
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
     * Manages syncing the items array into the subcollection and synchronizes 3DSS Assets if in draft via _assetDraft.
     */
    const saveLayout = useCallback(
        async (nextLayout, options = {}) => {
            if (!ref || !itemsColRef) return;

            const items = Array.isArray(nextLayout.items) ? nextLayout.items : [];
            const itemIdsInNext = new Set(items.map(it => it.id).filter(Boolean));

            const batch = writeBatch(db);
            const { uid } = options;

            // 1. Process draft assets from dropping models before item processing
            items.forEach(it => {
                if (it._assetDraft && typeof it._assetDraft === 'object') {
                    const draft = it._assetDraft;
                    const assetsColRef = getProjectAssetsColRef({ projectId });
                    
                    if (draft.type === 'new') {
                        // Create a newly generated id
                        const newAssetRef = doc(assetsColRef);
                        const newAssetId = newAssetRef.id;
                        it.assetId = newAssetId; // link immediately to layout item
                        
                        batch.set(newAssetRef, {
                            projectId,
                            itemType: it.type === "architecture" ? "architecture" : "furniture",
                            name: it.title,
                            title: it.title,
                            description: "",
                            thumbnailUrl: it.thumbUrl || null,
                            modelFormat: "glb",
                            glbUrl: draft.glbRaw,
                            status: 'active',
                            tags: [it.group, it.subType].filter(Boolean),
                            metadata: {
                                sourceModelId: draft.payload.modelId,
                                brand: it.brand,
                                category: it.type,
                                subType: it.subType
                            },
                            addedBy: uid || 'anonymous',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                    } else if (draft.type === 'existing') {
                        // Already exists, just ensure it tracks the correct id from payload
                        it.assetId = draft.assetId;
                    } else if (draft.type === 'revive') {
                        // Reactivate an archived asset
                        it.assetId = draft.assetId;
                        const reviveAssetRef = getProjectAssetRef({ projectId, assetId: draft.assetId });
                        if (reviveAssetRef) {
                            batch.update(reviveAssetRef, { 
                                status: 'active', 
                                updatedAt: serverTimestamp() 
                            });
                        }
                    }
                    
                    // Consume the draft marker so it doesn't get saved to items collection
                    delete it._assetDraft;
                }
            });

            // 2. Update the plan metadata updatedAt
            batch.update(ref, { updatedAt: serverTimestamp() });
            batch.update(doc(db, `projects/${projectId}`), { updatedAt: serverTimestamp() });

            // 3. Identify deletions by comparing next draft with lastSyncedItemsRef
            const currentItemIds = lastSyncedItemsRef.current.map(it => it.id).filter(Boolean);
            currentItemIds.forEach(id => {
                if (!itemIdsInNext.has(id)) {
                    batch.delete(doc(itemsColRef, id));
                }
            });

            // 4. Set all items in the new layout
            items.forEach(it => {
                if (!it.id) {
                    // Safety check, usually layout items already have random IDs generated in UI
                    it.id = doc(itemsColRef).id;
                }
                const itemRef = doc(itemsColRef, it.id);
                // remove internal references before save
                const savePayload = { ...it, workspaceId, planId, updatedAt: serverTimestamp() };
                batch.set(itemRef, savePayload, { merge: true });
            });

            await batch.commit();
        },
        [ref, itemsColRef, workspaceId, planId, projectId]
    );

    return { data, loading, ref, ensureExists, saveLayout };
}
