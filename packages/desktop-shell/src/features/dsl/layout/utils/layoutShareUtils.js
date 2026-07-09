// src/features/layout/utils/layoutShareUtils.js
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    collection,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase/client";
import { getStorage, ref as sRef, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getLayoutPlansColRef, getLayoutPlanRef, getLayoutItemsColRef } from "../paths/workspacePaths";

/**
 * shareId を生成（URLに載せてもOKな短く衝突しにくいID・プレフィックス無し）。
 * crypto があれば優先（64bit相当でほぼ衝突しない）。URL セーフな小文字英数字のみ。
 */
function makeShareId() {
    try {
        const c = globalThis.crypto || (typeof window !== "undefined" ? window.crypto : null);
        if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 16);
        if (c?.getRandomValues) {
            const a = new Uint8Array(12);
            c.getRandomValues(a);
            return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
        }
    } catch { /* noop */ }
    return (Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)).slice(0, 16);
}

/** 共有ビューアの本番オリジン（リンクを知っている人がブラウザで開く先） */
export const LAYOUT_SHARE_ORIGIN = "https://sekkeiya.com";

/** shareId とクエリから共有 URL を組み立てる */
export function buildLayoutShareUrl(shareId, params = {}) {
    const qs = Object.entries(params)
        .filter(([, v]) => v != null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    return `${LAYOUT_SHARE_ORIGIN}/layout/share/${encodeURIComponent(shareId)}${qs ? `?${qs}` : ""}`;
}

/**
 * viewerShares/{shareId}
 */
export function getViewerShareDocRef(shareId) {
    if (!shareId) return null;
    return doc(db, "viewerShares", shareId);
}

/**
 * Helper: Fetch all plans for a workspace and build the nested mapping.
 * In the new unified schema, ALL bases, proposals, and options are stored flat in:
 * projects/{projectId}/workspaces/{workspaceId}/plans
 */
async function buildBaseTree(projectId, workspaceId, filterRootBaseId = null) {
    const plansCol = getLayoutPlansColRef({ projectId, workspaceId });
    if (!plansCol) return [];
    
    // Fetch all plans in the workspace
    const snap = await getDocs(query(plansCol, orderBy("sortOrder", "asc")));
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // If we only want a specific base tree, filter early
    let relevantDocs = allDocs;
    if (filterRootBaseId) {
        relevantDocs = allDocs.filter(d => d.rootBaseId === filterRootBaseId);
    }

    // Resolve items for each plan concurrently
    const plansWithLayouts = await Promise.all(
        relevantDocs.map(async (planData) => {
            const itemsCol = getLayoutItemsColRef({ projectId, workspaceId, planId: planData.id });
            const itemSnap = await getDocs(itemsCol);
            const items = itemSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            return {
                ...planData,
                layout: { items }
            };
        })
    );

    // Build the tree
    const bases = [];
    
    // 1. Identify all Base plans
    const baseDocs = plansWithLayouts.filter(p => !p.parentPlanId || p.planType === 'base');
    
    for (const b of baseDocs) {
        // Find Proposals (child of this base)
        const proposalDocs = plansWithLayouts.filter(p => p.parentPlanId === b.id && p.planType === 'proposal');
        
        const plans = [];
        for (const p of proposalDocs) {
            // Find Options (child of this proposal)
            const optionDocs = plansWithLayouts.filter(o => o.parentPlanId === p.id && o.planType === 'option');
            
            plans.push({
                id: p.id,
                name: p.name || p.id,
                options: optionDocs.map(o => ({
                    id: o.id,
                    name: o.name || o.id,
                    layout: o.layout || { items: [] },
                }))
            });
        }
        
        bases.push({
            id: b.id,
            name: b.name || b.id,
            glbUrl: b.glbUrl || "",
            plans,
        });
    }

    return bases;
}

/**
 * Step 1: Selected Base Catalog
 */
async function buildCatalogForSelectedBase({ projectId, workspaceId, source, snapshot }) {
    const baseId = source?.baseId;
    if (!baseId) throw new Error("buildCatalogForSelectedBase: source.baseId is required");
    
    const bases = await buildBaseTree(projectId, workspaceId, baseId);
    
    // Inject fallback glbUrls if missing but snapshot has it
    for (const b of bases) {
        if (!b.glbUrl && snapshot?.baseGlbUrl) {
            b.glbUrl = snapshot.baseGlbUrl;
        }
    }
    
    return { bases };
}

/**
 * Step 2: All Bases Catalog
 */
async function buildCatalogForAllBases({ projectId, workspaceId, source, snapshot }) {
    const bases = await buildBaseTree(projectId, workspaceId);
    
    // Inject fallback glbUrls if missing but snapshot has it for the active base
    const activeBase = bases.find(b => b.id === source?.baseId);
    if (activeBase && !activeBase.glbUrl && snapshot?.baseGlbUrl) {
        activeBase.glbUrl = snapshot.baseGlbUrl;
    }

    const hasAnyGlb = bases.some((b) => !!b.glbUrl);
    if (!hasAnyGlb) {
        // Depending on requirements, might be optional, but legacy threw an error
        console.warn("buildCatalogForAllBases: no base glbUrl found in allBases catalog");
    }

    return { bases };
}

/**
 * 共有用ドキュメント作成（毎回新規 shareId）
 */
export async function createLayoutShare(args) {
    const {
        projectId,
        workspaceId,
        source,
        snapshot,
        viewerConfig = {},
        visibility = "public",
        catalogScope = "selectedBase",
        catalog: catalogFromArgs = null,
        createdByUid = null,
        ownerUid = null,
    } = args || {};

    if (!projectId || !workspaceId) throw new Error("createLayoutShare: missing unified identifiers");
    if (!source?.baseId) throw new Error("createLayoutShare: source.baseId is required");

    // 所有者 UID は ownerUid / createdByUid のどちらで渡されても揃える（ルールが ownerUid を見るケース対策）。
    const owner = ownerUid || createdByUid || null;

    const shareId = makeShareId();
    const ref = getViewerShareDocRef(shareId);

    let catalog = catalogFromArgs;
    if (!catalog) {
        if (catalogScope === "allBases") {
            catalog = await buildCatalogForAllBases({ projectId, workspaceId, source, snapshot });
        } else {
            catalog = await buildCatalogForSelectedBase({ projectId, workspaceId, source, snapshot });
        }
    }

    const docData = {
        projectId,
        workspaceId,
        source: {
            baseId: source?.baseId || null,
            planId: source?.planId || null,
            optionId: source?.optionId || null, // in new schema, optionId IS planId of type option
        },
        snapshot: snapshot || {},
        catalog: catalog || { bases: [] },
        viewerConfig: viewerConfig || {},
        visibility,
        createdByUid: createdByUid || owner,
        ownerUid: owner,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData, { merge: false });
    return shareId;
}

/**
 * shareId を固定して “更新(Upsert)” する
 */
export async function upsertLayoutShare(args) {
    const {
        shareId: shareIdFromArgs = null,
        projectId,
        workspaceId,
        source,
        snapshot,
        viewerConfig = {},
        visibility = "public",
        catalogScope = "selectedBase",
        catalog: catalogFromArgs = null,
        createdByUid = null,
    } = args || {};

    if (!projectId || !workspaceId) throw new Error("upsertLayoutShare: missing unified identifiers");
    if (!source?.baseId) throw new Error("upsertLayoutShare: source.baseId is required");

    const shareId = shareIdFromArgs || makeShareId();
    const ref = getViewerShareDocRef(shareId);
    if (!ref) throw new Error("upsertLayoutShare: invalid shareId");

    const existingSnap = await getDoc(ref);
    const existsAlready = existingSnap.exists();

    let catalog = catalogFromArgs;
    if (!catalog) {
        if (catalogScope === "allBases") {
            catalog = await buildCatalogForAllBases({ projectId, workspaceId, source, snapshot });
        } else {
            catalog = await buildCatalogForSelectedBase({ projectId, workspaceId, source, snapshot });
        }
    }

    const docData = {
        projectId,
        workspaceId,
        source: {
            baseId: source?.baseId || null,
            planId: source?.planId || null,
            optionId: source?.optionId || null,
        },
        snapshot: snapshot || {},
        catalog: catalog || { bases: [] },
        viewerConfig: viewerConfig || {},
        visibility,

        ...(existsAlready
            ? {}
            : {
                createdByUid: createdByUid || null,
                createdAt: serverTimestamp(),
            }),

        updatedAt: serverTimestamp(),
    };

    await setDoc(ref, docData, { merge: true });
    return shareId;
}

/**
 * shareId から共有ドキュメントを取得
 */
export async function fetchLayoutShare(shareId) {
    const ref = getViewerShareDocRef(shareId);
    if (!ref) return null;

    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    return { id: snap.id, ...snap.data() };
}

/**
 * 互換
 */
export async function fetchViewerShare(shareId) {
    return fetchLayoutShare(shareId);
}

/**
 * Plan の layoutLink.shareId を読む
 */
export async function fetchPlanLayoutShareId({ projectId, workspaceId, planId }) {
    try {
        const ref = getLayoutPlanRef({ projectId, workspaceId, planId });
        if (!ref) return null;

        const snap = await getDoc(ref);
        if (!snap.exists()) return null;

        return snap.data()?.layoutLink?.shareId || null;
    } catch (e) {
        console.warn("[fetchPlanLayoutShareId] failed:", e?.message || e);
        return null;
    }
}

/**
 * Plan に layoutLink を保存（thumbUrl 追加）
 */
export async function saveLayoutLinkToPlan({
    projectId,
    workspaceId,
    planId,
    layoutLink, 
    updatedByUid = null,
}) {
    const ref = getLayoutPlanRef({ projectId, workspaceId, planId });
    if (!ref) throw new Error("saveLayoutLinkToPlan: invalid plan ref");

    const PROD_ORIGIN = "https://sekkeiya.com";
    const shareId = String(layoutLink?.shareId || "").trim();
    const optionKey = String(layoutLink?.optionKey || "").trim();
    const thumbUrl = String(layoutLink?.thumbUrl || "").trim();

    const normalizeToProdUrl = (rawUrl) => {
        const u = String(rawUrl || "").trim();
        if (u) {
            try {
                const parsed = new URL(u);
                return `${PROD_ORIGIN}${parsed.pathname}${parsed.search}${parsed.hash}`;
            } catch {}
        }
        if (!shareId) return "";
        const qs = optionKey ? `?option=${encodeURIComponent(optionKey)}` : "";
        return `${PROD_ORIGIN}/layout/share/${encodeURIComponent(shareId)}${qs}`;
    };

    const prodUrl = normalizeToProdUrl(layoutLink?.url);

    await updateDoc(ref, {
        layoutLink: {
            shareId: shareId || null,
            url: prodUrl,
            optionKey,
            thumbUrl,
            updatedAt: serverTimestamp(),
            updatedBy: updatedByUid || null,
        },
        updatedAt: serverTimestamp(),
    });

    // AI Drive Sync (Using workspace ID instead of board ID)
    try {
        if (!updatedByUid) return true; // Require user to sync to their drive
        const assetId = `3dsl_workspace_${workspaceId}_${planId}`;
        const assetRef = doc(db, "users", updatedByUid, "driveAssets", assetId);

        const snap = await getDoc(ref);
        const planName = snap.exists() ? (snap.data()?.name || planId) : planId;

        const assetData = {
            name: `Layout: ${planName}`,
            ownerId: updatedByUid,
            folderId: "root-3d-models",
            type: "3d_model",
            source: "3dsl",
            sourceId: assetId,
            mimeType: "application/json",
            storagePath: "",
            url: prodUrl,
            thumbUrl: thumbUrl || "",
            sizeBytes: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            createdBy: updatedByUid,
            isDeleted: false,
            projectId: projectId,
            tags: [],
            category: "Models",
            aiAnalyzed: false,
            embeddingStatus: "none"
        };
        await setDoc(assetRef, assetData, { merge: true });
    } catch (e) {
        console.warn("[AI Drive Sync] failed to create driveAsset for 3dsl layout:", e);
    }

    return true;
}

/**
 * Layout のサムネを Storage に保存して downloadURL を返す
 * New Path: mainModels/{uid}/workspaces/{workspaceId}/layoutThumbs/{planId}/{shareId}.jpg
 */
export async function uploadLayoutThumb({
    projectId,
    workspaceId,
    planId,
    shareId,
    dataUrl,
    ownerUid, // Added for path, though projectId could also dictate it
}) {
    if (!dataUrl) return "";
    if (!projectId || !workspaceId || !planId || !shareId || !ownerUid) return "";

    const storage = getStorage();
    const path = `mainModels/${ownerUid}/workspaces/${workspaceId}/layoutThumbs/${planId}/${shareId}.jpg`;
    const r = sRef(storage, path);

    await uploadString(r, dataUrl, "data_url", { contentType: "image/jpeg" });
    return await getDownloadURL(r);
}

/**
 * Layout thumb を Storage から削除
 */
export async function deleteLayoutThumbIfExists({
    projectId,
    workspaceId,
    planId,
    shareId,
    ownerUid,
}) {
    if (!projectId || !workspaceId || !planId || !shareId || !ownerUid) return false;

    const storage = getStorage();
    const path = `mainModels/${ownerUid}/workspaces/${workspaceId}/layoutThumbs/${planId}/${shareId}.jpg`;
    const r = sRef(storage, path);

    try {
        await deleteObject(r);
        return true;
    } catch (e) {
        if (e?.code === "storage/object-not-found") return false;
        console.warn("[deleteLayoutThumbIfExists] failed:", e?.code || e, e?.message || "");
        return false;
    }
}

export async function deleteViewerShareIfExists(shareId) {
    if (!shareId) return false;
    try {
        await deleteDoc(doc(db, "viewerShares", shareId));
        return true;
    } catch (e) {
        console.warn("[deleteViewerShareIfExists] failed:", e?.code || e, e?.message || "");
        return false;
    }
}