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
import { db, auth } from "../../../../lib/firebase/client";

// ---- Item normalization helpers (mirror the working editor copy path: copyOps.js) ----
// Generate a fresh, unique item id. Duplicated items MUST NOT reuse the source id:
// the live scene-object registry (sceneObjectRegistryStore) is keyed globally by
// item.id, so colliding ids make the gizmo/registry attach to / overwrite the wrong
// object, producing the flipped + shifted furniture seen after a Plan duplicate.
const createItemId = (prefix = "item") => {
    try {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return `${prefix}_${crypto.randomUUID()}`;
        }
    } catch { /* ignore */ }
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

// position/rotation/scale を有限な [x,y,z] 配列へ正規化（copyOps.js の toVec3Array と同等）
const toVec3Array = (v, fallback = [0, 0, 0]) => {
    if (Array.isArray(v) && v.length >= 3) {
        return [Number(v[0]) || 0, Number(v[1]) || 0, Number(v[2]) || 0];
    }
    return fallback.slice();
};

// 1 つの furniture item を複製用に正規化する。
// - 新しい id を採番（レジストリ衝突の回避）
// - transform を有限な配列へ正規化（raw コピーによる反転/ズレの回避）
// - flipX/flipZ/rotationY 等のその他フィールドはそのまま温存
export const cloneFurnitureItem = (raw) => {
    const item = raw && typeof raw === "object" ? raw : {};
    const t = item.transform && typeof item.transform === "object" ? item.transform : {};
    const newId = createItemId();
    return {
        ...item,
        id: newId,
        transform: {
            ...t,
            position: toVec3Array(t.position, [0, 0, 0]),
            rotation: toVec3Array(t.rotation, [0, 0, 0]),
            scale: toVec3Array(t.scale, [1, 1, 1]),
        },
    };
};

// --- Path Helpers ---
export const getWorkspaceDocRef = (projectId, workspaceId) => doc(db, "projects", projectId, "workspaces", workspaceId);
export const getPlansColRef = (projectId, workspaceId) => collection(db, "projects", projectId, "workspaces", workspaceId, "layouts");
export const getPlanDocRef = (projectId, workspaceId, planId) => doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId);
export const getItemsColRef = (projectId, workspaceId, planId) => collection(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "items");


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

export const createLayout = async ({ 
    projectId, 
    workspaceId, 
    userId, 
    name, 
    description = "",
    sourceLayoutId = null,
    layoutGroupId = null,
    buildingVariantKey = null,
    furnitureVariantKey = null,
    materialVariantKey = null,
    thumbnailUrl = null,
    glbUrl = null 
}) => {
    if (!projectId || !workspaceId) throw new Error("createLayout: Missing IDs");
    
    const pColRef = getPlansColRef(projectId, workspaceId);
    const pDocRef = doc(pColRef);
    const planId = pDocRef.id;

    const timestamp = serverTimestamp();
    const payload = {
        id: planId,
        projectId,
        workspaceId,
        name: name || "New Layout",
        description,
        appScope: "3dsl",
        type: "layout",
        planType: "layout", // For backwards compatibility if any legacy code checks it
        sourceLayoutId,
        createdFromLayoutId: sourceLayoutId,
        layoutGroupId: layoutGroupId || workspaceId,
        buildingVariantKey,
        furnitureVariantKey,
        materialVariantKey,
        thumbnailUrl,
        glbUrl,
        status: "draft",
        visibility: "private",
        ownerId: userId,
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await setDoc(pDocRef, payload);
    return { id: planId, ...payload };
};

export const cloneLayout = async ({ projectId, workspaceId, sourceLayoutId, userId, newName }) => {
    // 1. Fetch source layout
    const srcDoc = await getDoc(getPlanDocRef(projectId, workspaceId, sourceLayoutId));
    if (!srcDoc.exists()) throw new Error("Source layout not found.");
    const srcData = srcDoc.data();

    // 2. Create new layout
    const newDocRef = doc(getPlansColRef(projectId, workspaceId));
    const newPlanId = newDocRef.id;
    const timestamp = serverTimestamp();

    const newLayoutData = {
        id: newPlanId,
        projectId,
        workspaceId,
        name: newName || `Copy of ${srcData.name || 'Layout'}`,
        description: srcData.description || "",
        appScope: "3dsl",
        type: "layout",
        planType: "layout",
        sourceLayoutId: sourceLayoutId,
        createdFromLayoutId: sourceLayoutId,
        layoutGroupId: srcData.layoutGroupId || workspaceId,
        buildingVariantKey: srcData.buildingVariantKey || null,
        furnitureVariantKey: srcData.furnitureVariantKey || null,
        materialVariantKey: srcData.materialVariantKey || null,
        thumbnailUrl: srcData.thumbnailUrl || null,
        glbUrl: srcData.glbUrl || null,
        status: "draft",
        visibility: "private",
        ownerId: userId,
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    // 3. Copy ALL items using batched writes
    const srcItemsCol = getItemsColRef(projectId, workspaceId, sourceLayoutId);
    const dstItemsCol = getItemsColRef(projectId, workspaceId, newPlanId);
    
    const itemsSnap = await getDocs(srcItemsCol);
    const batch = writeBatch(db);

    batch.set(newDocRef, newLayoutData);

    itemsSnap.docs.forEach(docSnap => {
        const itemData = docSnap.data();
        const newTargetRef = doc(dstItemsCol, docSnap.id); // keep same item ID
        batch.set(newTargetRef, {
            ...itemData,
            planId: newPlanId, // update planId injected into item
            updatedAt: timestamp
        });
    });

    await batch.commit();

    return { id: newPlanId, ...newLayoutData };
};

/** ======== Base / Plan / Option structure CRUD ========
 * The hierarchy is stored flat in the `layouts` collection, distinguished by:
 *   - planType: 'base' | 'plan' | 'option'
 *   - rootBaseId: the owning Base doc id (a Base points at itself)
 *   - parentPlanId: for options, the owning Plan doc id
 * Base holds architecture/zones; Plan & Option hold furniture items.
 */

export const createStructureNode = async ({
    projectId,
    workspaceId,
    userId,
    name,
    planType,            // 'base' | 'plan' | 'option'
    rootBaseId = null,
    parentPlanId = null,
    description = "",
}) => {
    if (!projectId || !workspaceId) throw new Error("createStructureNode: Missing IDs");
    if (!planType) throw new Error("createStructureNode: planType required");

    const pColRef = getPlansColRef(projectId, workspaceId);
    const pDocRef = doc(pColRef);
    const id = pDocRef.id;

    const timestamp = serverTimestamp();
    const payload = {
        id,
        projectId,
        workspaceId,
        name: name || "Untitled",
        description,
        appScope: "3dsl",
        type: "layout",
        planType,
        rootBaseId: rootBaseId || (planType === "base" ? id : null),
        parentPlanId: parentPlanId || null,
        status: "draft",
        visibility: "private",
        ownerId: userId,
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    await setDoc(pDocRef, payload);
    return { id, ...payload };
};

export const cloneStructureNode = async ({
    projectId,
    workspaceId,
    sourceId,
    userId,
    newName,
    overrides = {},      // e.g. { planType, rootBaseId, parentPlanId }
}) => {
    const srcDoc = await getDoc(getPlanDocRef(projectId, workspaceId, sourceId));
    if (!srcDoc.exists()) throw new Error("cloneStructureNode: source not found.");
    const srcData = srcDoc.data();

    const newDocRef = doc(getPlansColRef(projectId, workspaceId));
    const newId = newDocRef.id;
    const timestamp = serverTimestamp();

    const planType = overrides.planType || srcData.planType || "plan";

    // The editor renders furniture from the embedded `layout.items` array on the
    // plan/option doc (see useOptionDoc → readItemsFromSnap), NOT from the items
    // subcollection. A raw `{ ...srcData }` spread copies that array verbatim,
    // keeping every source item id and raw transform. Rebuild it with fresh ids +
    // normalized transforms so duplicated furniture renders correctly.
    const srcLayout = srcData.layout && typeof srcData.layout === "object" ? srcData.layout : null;
    const srcItems = srcLayout && Array.isArray(srcLayout.items) ? srcLayout.items : null;
    const clonedLayout = srcItems
        ? { ...srcLayout, items: srcItems.map(cloneFurnitureItem) }
        : srcData.layout;

    const newData = {
        ...srcData,
        ...(clonedLayout !== undefined ? { layout: clonedLayout } : {}),
        id: newId,
        projectId,
        workspaceId,
        name: newName || `Copy of ${srcData.name || "Layout"}`,
        planType,
        rootBaseId: overrides.rootBaseId !== undefined
            ? overrides.rootBaseId
            : (planType === "base" ? newId : (srcData.rootBaseId || null)),
        parentPlanId: overrides.parentPlanId !== undefined
            ? overrides.parentPlanId
            : (srcData.parentPlanId || null),
        sourceLayoutId: sourceId,
        createdFromLayoutId: sourceId,
        status: "draft",
        ownerId: userId,
        sortOrder: Date.now(),
        createdBy: userId,
        updatedBy: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
    };

    const srcItemsCol = getItemsColRef(projectId, workspaceId, sourceId);
    const dstItemsCol = getItemsColRef(projectId, workspaceId, newId);
    const itemsSnap = await getDocs(srcItemsCol);

    const batch = writeBatch(db);
    batch.set(newDocRef, newData);
    itemsSnap.docs.forEach((docSnap) => {
        const itemData = docSnap.data();
        // Mirror the embedded-array handling: fresh id + normalized transform so the
        // subcollection copy never shares item ids with the source either.
        const cloned = cloneFurnitureItem(itemData);
        const newItemRef = doc(dstItemsCol, cloned.id);
        batch.set(newItemRef, {
            ...cloned,
            planId: newId,
            updatedAt: timestamp,
        });
    });
    await batch.commit();

    return { id: newId, ...newData };
};

/**
 * Clone a Plan (+ its items subcollection) and ALL child Options (+ each Option's items).
 * Used by duplicatePlan so that furniture placed in each Option is fully preserved.
 *
 * @returns {{ plan: node, options: node[] }}
 */
export const clonePlanCascade = async ({
    projectId,
    workspaceId,
    sourcePlanId,
    userId,
    newPlanName,
    rootBaseId = null,
}) => {
    if (!projectId || !workspaceId || !sourcePlanId)
        throw new Error("clonePlanCascade: Missing IDs");

    // 1. Clone the Plan document + its own items
    const newPlanNode = await cloneStructureNode({
        projectId,
        workspaceId,
        sourceId: sourcePlanId,
        userId,
        newName: newPlanName,
        overrides: {
            planType: "plan",
            parentPlanId: null,
            ...(rootBaseId != null ? { rootBaseId } : {}),
        },
    });

    // 2. Collect all Options that belong to the source Plan
    const allSnap = await getDocs(getPlansColRef(projectId, workspaceId));
    const sourceOptions = allSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((d) => d.planType === "option" && d.parentPlanId === sourcePlanId)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    // 3. Clone each Option with parentPlanId pointing to the new Plan
    const newOptions = [];
    for (const srcOption of sourceOptions) {
        const newOptionNode = await cloneStructureNode({
            projectId,
            workspaceId,
            sourceId: srcOption.id,
            userId,
            newName: srcOption.name,
            overrides: {
                planType: "option",
                parentPlanId: newPlanNode.id,
                rootBaseId: rootBaseId ?? srcOption.rootBaseId ?? null,
            },
        });
        newOptions.push(newOptionNode);
    }

    return { plan: newPlanNode, options: newOptions };
};

/**
 * Delete a structure node and all its descendants.
 * - base   → deletes the base + every doc whose rootBaseId === id (plans & options)
 * - plan   → deletes the plan + every option whose parentPlanId === id
 * - option → deletes just the option
 * Reuses deleteLayout per-doc so storage/shares/items cleanup is consistent.
 */
export const deleteStructureCascade = async (projectId, workspaceId, nodeId, planType) => {
    if (!projectId || !workspaceId || !nodeId) return;

    const allSnap = await getDocs(getPlansColRef(projectId, workspaceId));
    const all = allSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    let descendantIds = [];
    if (planType === "base") {
        // Plans of this base (rootBaseId === base). Options usually carry rootBaseId too,
        // but legacy/edge docs may only have parentPlanId — so also sweep options whose
        // parent Plan belongs to this base to avoid orphans.
        const planIds = new Set(
            all.filter((d) => d.planType === "plan" && d.rootBaseId === nodeId).map((d) => d.id)
        );
        descendantIds = all
            .filter((d) => d.id !== nodeId && (
                d.rootBaseId === nodeId || (d.parentPlanId && planIds.has(d.parentPlanId))
            ))
            .map((d) => d.id);
    } else if (planType === "plan") {
        descendantIds = all
            .filter((d) => d.parentPlanId === nodeId)
            .map((d) => d.id);
    }

    for (const childId of descendantIds) {
        await deleteLayout(projectId, workspaceId, childId);
    }
    await deleteLayout(projectId, workspaceId, nodeId);
};


/**
 * Lazy migration: a legacy flat "Layout" doc (planType 'layout'|'base'|none) holds
 * its furniture directly in its own items subcollection. The Base/Plan/Option model
 * keeps architecture (glbUrl + spaceProgram zones) on the Base and furniture on a
 * Plan/Option. This moves legacy furniture down into a default "Plan 1 / Option 1".
 *
 * Idempotent & conservative:
 *   - No-op if the base already has any plan (rootBaseId === baseId && planType === 'plan').
 *   - No-op if the base has no furniture items (a freshly created empty Base is left
 *     untouched so the user can register plans manually).
 *   - Architecture items (type === 'architecture') and zones stay on the Base.
 * Returns { planId, optionId } when it migrated, otherwise null.
 */
export const migrateLegacyBaseToPlanOption = async ({ projectId, workspaceId, baseId, userId }) => {
    if (!projectId || !workspaceId || !baseId) return null;

    // Idempotent guard: skip if this base already owns a plan.
    const allSnap = await getDocs(getPlansColRef(projectId, workspaceId));
    const alreadyMigrated = allSnap.docs.some((d) => {
        const data = d.data();
        return data?.planType === "plan" && data?.rootBaseId === baseId;
    });
    if (alreadyMigrated) return null;

    // Only migrate when the base actually carries legacy furniture.
    const baseItemsCol = getItemsColRef(projectId, workspaceId, baseId);
    const itemsSnap = await getDocs(baseItemsCol);
    const furnitureDocs = itemsSnap.docs.filter((d) => d.data()?.type !== "architecture");
    if (furnitureDocs.length === 0) return null;

    // Create the default Plan 1 / Option 1 under this base.
    const plan = await createStructureNode({
        projectId, workspaceId, userId, name: "Plan 1", planType: "plan", rootBaseId: baseId,
    });
    const option = await createStructureNode({
        projectId, workspaceId, userId, name: "Option 1", planType: "option",
        rootBaseId: baseId, parentPlanId: plan.id,
    });

    // Move furniture down into the Option; architecture/zones remain on the Base.
    const optItemsCol = getItemsColRef(projectId, workspaceId, option.id);
    const timestamp = serverTimestamp();
    const batch = writeBatch(db);
    furnitureDocs.forEach((d) => {
        batch.set(doc(optItemsCol, d.id), { ...d.data(), planId: option.id, updatedAt: timestamp });
        batch.delete(d.ref);
    });
    await batch.commit();

    return { planId: plan.id, optionId: option.id };
};


export const updateLayoutInfo = async (projectId, workspaceId, layoutId, updatedFields) => {
    const ref = getPlanDocRef(projectId, workspaceId, layoutId);
    await updateDoc(ref, {
        ...updatedFields,
        updatedAt: serverTimestamp()
    });
};

export const deleteLayout = async (projectId, workspaceId, layoutId) => {
    if (!projectId || !workspaceId || !layoutId) return;

    // We no longer have children plans to cascade into. Just delete this layout and its direct assets.
    const uid = auth.currentUser?.uid;

    // Delete shares/thumbs
    try {
        const { fetchPlanLayoutShareId, deleteLayoutThumbIfExists, deleteViewerShareIfExists } = await import('./layoutShareUtils');
        const shareId = await fetchPlanLayoutShareId({
            ownerUid: uid,
            projectId,
            workspaceId,
            planId: layoutId,
        });
        if (shareId) {
            await deleteLayoutThumbIfExists({
                ownerUid: uid,
                projectId,
                workspaceId,
                planId: layoutId,
                shareId,
            });
            await deleteViewerShareIfExists(shareId);
        }
    } catch (err) {
        console.warn("Failed to cleanup shares for", layoutId, err);
    }

    // Delete associated Storage files
    const layoutRef = getPlanDocRef(projectId, workspaceId, layoutId);
    const layoutSnap = await getDoc(layoutRef);
    if (layoutSnap.exists()) {
        const data = layoutSnap.data();
        const potentialUrls = [
            data.glbPath,
            data.asset?.glbPath,
            data.glbUrl,
            data.asset?.glbUrl,
            data.thumbnailUrl
        ].filter(Boolean); // Filter out null/undefined

        // ONLY delete storage objects that belong specifically to this layout.
        // If a layout references a shared WorkFile or Library model, its path won't contain the layoutId.
        // Also skip Storage deletion entirely for Work File-sourced base models:
        // the converted GLB belongs to the Work File lifecycle, not this layout document.
        const isWorkFileSource = data.sourceRef?.sourceType === 'workFile';
        const urlsToDelete = isWorkFileSource
            ? []
            : potentialUrls.filter(url => typeof url === 'string' && url.includes(layoutId));

        if (urlsToDelete.length > 0) {
            try {
                const { storage } = await import("../../../../lib/firebase/client");
                const { ref: storageRef, deleteObject } = await import("firebase/storage");

                // glbPath / glbUrl は同じファイルを指すことが多い（パス形式と gs:// 形式）。
                // ref.fullPath で正規化し、同一オブジェクトの二重削除（→ 404 ノイズ）を防ぐ。
                const refsByPath = new Map();
                for (const urlOrPath of urlsToDelete) {
                    try {
                        // Firebase storage ref() can handle both paths and full HTTP download URLs
                        const r = storageRef(storage, urlOrPath);
                        if (!refsByPath.has(r.fullPath)) refsByPath.set(r.fullPath, r);
                    } catch (err) {
                        console.warn("Invalid storage reference, skipping", urlOrPath, err);
                    }
                }

                for (const [fullPath, r] of refsByPath) {
                    try {
                        await deleteObject(r);
                        console.log(`Successfully deleted storage object: ${fullPath}`);
                    } catch (err) {
                        // Ignore object-not-found errors as it might have been deleted already
                        if (err?.code !== 'storage/object-not-found') {
                            console.warn("Failed to delete object from storage", fullPath, err);
                        }
                    }
                }
            } catch (err) {
                console.warn("Storage deletion process failed", err);
            }
        }
    }

    // Delete items subcollection
    const itemsCol = getItemsColRef(projectId, workspaceId, layoutId);
    const itemsSnap = await getDocs(itemsCol);
    
    // Batch delete items and the layout itself
    const batch = writeBatch(db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(getPlanDocRef(projectId, workspaceId, layoutId));
    await batch.commit();
};
