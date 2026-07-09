// src/shared/api/workspaces/workspaces.js
// 役割: projects/{projectId}/workspaces/{workspaceId} と配下への "単発 CRUD" を提供。
// レガシーな myBoards / teamBoards は廃止され、Unified Project Schemaに統合されます。

import {
    doc,
    setDoc,
    getDoc,
    getDocs,
    collection,
    query,
    where,
    orderBy,
    deleteDoc,
    serverTimestamp,
    onSnapshot,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

// --- Path Helpers ---
export const getWorkspaceDocRef = (projectId, workspaceId) => doc(db, "projects", projectId, "workspaces", workspaceId);
export const getPlansColRef = (projectId, workspaceId) => collection(db, "projects", projectId, "workspaces", workspaceId, "plans");
export const getPlanDocRef = (projectId, workspaceId, planId) => doc(db, "projects", projectId, "workspaces", workspaceId, "plans", planId);
export const getItemsColRef = (projectId, workspaceId, planId) => collection(db, "projects", projectId, "workspaces", workspaceId, "plans", planId, "items");


/** ======== Workspace CRUD ======== */

export const createWorkspace = async ({ projectId, userId, name, visibility = "private", defaultPlanId = null }) => {
    if (!projectId || !userId) throw new Error("createWorkspace: projectId & userId required");

    const wColRef = collection(db, "projects", projectId, "workspaces");
    const wDocRef = doc(wColRef);
    const workspaceId = wDocRef.id;

    const timestamp = serverTimestamp();
    const payload = {
        id: workspaceId,
        projectId,
        name: name || "New Workspace",
        visibility,
        defaultPlanId,
        createdBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await setDoc(wDocRef, payload);
    return { id: workspaceId, ...payload };
};

export const getWorkspaceById = async (projectId, workspaceId) => {
    if (!projectId || !workspaceId) return null;
    const snap = await getDoc(getWorkspaceDocRef(projectId, workspaceId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const getWorkspacesForProject = async (projectId) => {
    if (!projectId) return [];
    // Requires index on projects/{projectId}/workspaces order by updatedAt DESC if we want to sort here.
    const q = query(
        collection(db, "projects", projectId, "workspaces")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateWorkspaceInfo = async (projectId, workspaceId, updatedFields) => {
    if (!projectId || !workspaceId) return;
    const ref = getWorkspaceDocRef(projectId, workspaceId);
    await updateDoc(ref, {
        ...updatedFields,
        updatedAt: serverTimestamp()
    });
};

export const deleteWorkspace = async (projectId, workspaceId) => {
    if (!projectId || !workspaceId) return;
    
    // Note: Since everything is nested, we technically need to delete plans and items subcollections.
    // However, keeping this MVP deletion simpler by just marking it deleted or assuming a cloud function cleans it if it gets big.
    // For now we do a shallow delete like we do for projects, or we can recursively delete plans.
    const plansSnap = await getDocs(getPlansColRef(projectId, workspaceId));
    const batch = writeBatch(db);
    plansSnap.docs.forEach(p => {
        // Items must also be deleted
        batch.delete(p.ref);
    });
    batch.delete(getWorkspaceDocRef(projectId, workspaceId));
    await batch.commit();
};


/** ======== Plan CRUD ======== */

export const createPlan = async ({ projectId, workspaceId, userId, name, planType, parentPlanId = null, rootBaseId, glbUrl = null }) => {
    if (!projectId || !workspaceId) throw new Error("createPlan: Missing IDs");
    
    const pColRef = getPlansColRef(projectId, workspaceId);
    const pDocRef = doc(pColRef);
    const planId = pDocRef.id;

    const timestamp = serverTimestamp();
    const payload = {
        id: planId,
        projectId,
        workspaceId,
        name: name || "New Plan",
        planType: planType || "base", // base, proposal, option
        parentPlanId,
        rootBaseId: rootBaseId || planId, // if base, it is its own root
        glbUrl, // mostly for base
        status: "draft",
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await setDoc(pDocRef, payload);
    return { id: planId, ...payload };
};

export const clonePlan = async ({ projectId, workspaceId, sourcePlanId, userId, newName, parentPlanIdOverride, planTypeOverride }) => {
    // 1. Fetch source plan
    const srcDoc = await getDoc(getPlanDocRef(projectId, workspaceId, sourcePlanId));
    if (!srcDoc.exists()) throw new Error("Source plan not found.");
    const srcData = srcDoc.data();

    // 2. Create new plan (Option format)
    const newDocRef = doc(getPlansColRef(projectId, workspaceId));
    const newPlanId = newDocRef.id;
    const timestamp = serverTimestamp();

    let newType = planTypeOverride;
    if (!newType) {
        newType = "option";
        if (srcData.planType === "base") newType = "proposal";
    }

    const newParentId = parentPlanIdOverride !== undefined ? parentPlanIdOverride : sourcePlanId;

    const newPlanData = {
        id: newPlanId,
        projectId,
        workspaceId,
        name: newName || `Copy of ${srcData.name}`,
        planType: newType,
        parentPlanId: newParentId,
        rootBaseId: srcData.rootBaseId,
        glbUrl: srcData.glbUrl || null,
        status: "draft",
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    // 3. Copy ALL items using batched writes
    const srcItemsCol = getItemsColRef(projectId, workspaceId, sourcePlanId);
    const dstItemsCol = getItemsColRef(projectId, workspaceId, newPlanId);
    
    const itemsSnap = await getDocs(srcItemsCol);
    const batch = writeBatch(db);

    batch.set(newDocRef, newPlanData);

    itemsSnap.docs.forEach(docSnap => {
        const itemData = docSnap.data();
        const newTargetRef = doc(dstItemsCol, docSnap.id); // keep same item ID ? Or generate new?
        batch.set(newTargetRef, {
            ...itemData,
            planId: newPlanId, // update planId injected into item
            updatedAt: timestamp
        });
    });

    await batch.commit();

    return { id: newPlanId, ...newPlanData };
};

export const updatePlanInfo = async (projectId, workspaceId, planId, updatedFields) => {
    const ref = getPlanDocRef(projectId, workspaceId, planId);
    await updateDoc(ref, {
        ...updatedFields,
        updatedAt: serverTimestamp()
    });
};

export const deletePlan = async (projectId, workspaceId, planId) => {
    const ref = getPlanDocRef(projectId, workspaceId, planId);
    const itemsSnap = await getDocs(getItemsColRef(projectId, workspaceId, planId));
    
    // Batch delete items and the plan itself
    const batch = writeBatch(db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(ref);
    await batch.commit();
};
