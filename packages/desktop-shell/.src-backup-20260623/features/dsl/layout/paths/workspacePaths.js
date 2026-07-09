// src/features/dsl/layout/paths/workspacePaths.js
import { doc, collection } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

/**
 * Project Doc Ref
 * /projects/{projectId}
 */
export function getProjectRef({ projectId }) {
    if (!projectId) return null;
    return doc(db, "projects", projectId);
}

/**
 * Project Assets Collection Ref (3DSS Models)
 * /projects/{projectId}/assets
 */
export function getProjectAssetsColRef({ projectId }) {
    if (!projectId) return null;
    return collection(db, "projects", projectId, "assets");
}

export function getProjectAssetRef({ projectId, assetId }) {
    if (!projectId || !assetId) return null;
    return doc(db, "projects", projectId, "assets", assetId);
}

/**
 * Workspace Collection & Doc Ref
 * /projects/{projectId}/workspaces/{workspaceId}
 */
export function getWorkspacesColRef({ projectId }) {
    if (!projectId) return null;
    return collection(db, "projects", projectId, "workspaces");
}

export function getWorkspaceRef({ projectId, workspaceId }) {
    if (!projectId || !workspaceId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId);
}

/**
 * Plans Collection Ref (Flattened Base/Plan/Option)
 * /projects/{projectId}/workspaces/{workspaceId}/layouts
 */
export function getLayoutPlansColRef({ projectId, workspaceId }) {
    if (!projectId || !workspaceId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "layouts");
}

export function getLayoutPlanRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId);
}

/**
 * Items Collection Ref (Layout Instances)
 * /projects/{projectId}/workspaces/{workspaceId}/layouts/{planId}/items
 */
export function getLayoutItemsColRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "items");
}

export function getLayoutItemRef({ projectId, workspaceId, planId, itemId }) {
    if (!projectId || !workspaceId || !planId || !itemId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "items", itemId);
}

/**
 * Renders Collection Ref (saved still images / videos from a Layout plan)
 * /projects/{projectId}/workspaces/{workspaceId}/layouts/{planId}/renders
 */
export function getLayoutRendersColRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "renders");
}

export function getLayoutRenderRef({ projectId, workspaceId, planId, renderId }) {
    if (!projectId || !workspaceId || !planId || !renderId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "layouts", planId, "renders", renderId);
}
