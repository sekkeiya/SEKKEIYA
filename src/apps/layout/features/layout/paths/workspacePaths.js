// src/features/layout/paths/workspacePaths.js
import { doc, collection } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

/**
 * Workspace Collection Ref
 * projects/{projectId}/workspaces
 */
export function getWorkspacesColRef({ projectId }) {
    if (!projectId) return null;
    return collection(db, "projects", projectId, "workspaces");
}

/**
 * Workspace Doc Ref
 * projects/{projectId}/workspaces/{workspaceId}
 */
export function getWorkspaceDocRef({ projectId, workspaceId }) {
    if (!projectId || !workspaceId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId);
}

/**
 * Plans Collection Ref (Flattened)
 * projects/{projectId}/workspaces/{workspaceId}/plans
 */
export function getPlansColRef({ projectId, workspaceId }) {
    if (!projectId || !workspaceId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "plans");
}

/**
 * Plan Doc Ref (Applies to Base, Proposal, Option)
 * projects/{projectId}/workspaces/{workspaceId}/plans/{planId}
 */
export function getPlanDocRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "plans", planId);
}

/**
 * Items Collection Ref
 * projects/{projectId}/workspaces/{workspaceId}/plans/{planId}/items
 */
export function getItemsColRef({ projectId, workspaceId, planId }) {
    if (!projectId || !workspaceId || !planId) return null;
    return collection(db, "projects", projectId, "workspaces", workspaceId, "plans", planId, "items");
}

/**
 * Item Doc Ref
 * projects/{projectId}/workspaces/{workspaceId}/plans/{planId}/items/{itemId}
 */
export function getItemDocRef({ projectId, workspaceId, planId, itemId }) {
    if (!projectId || !workspaceId || !planId || !itemId) return null;
    return doc(db, "projects", projectId, "workspaces", workspaceId, "plans", planId, "items", itemId);
}
