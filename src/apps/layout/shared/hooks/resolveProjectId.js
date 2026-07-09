import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

/**
 * ID Resolver Pattern
 * Resolves a URL parameter `projectId` (which might be a legacy `boardId`)
 * into the canonical `projectId` for the new Unified Project Schema.
 * 
 * Flow:
 * 1. Checks if it's already a valid Project ID.
 * 2. If not, checks if it maps to a mapped legacyBoardId.
 * 3. Falls back to raw ID (assuming legacy board fallback).
 */
export async function resolveProjectId(rawId) {
    if (!rawId) return null;

    try {
        // 1. Is it exactly a Project?
        const pRef = doc(db, "projects", rawId);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) {
            return rawId;
        }

        // 2. Is it a legacy board that got migrated?
        const q = query(collection(db, "projects"), where("legacyBoardId", "==", rawId), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            return qSnap.docs[0].id; // The new real projectId!
        }

        // 3. Fallback: it's an unmigrated legacy board ID
        return rawId;
    } catch (error) {
        console.warn("[resolveProjectId] Error resolving ID, falling back:", error);
        return rawId; // Fail safe
    }
}

export function useResolveProjectId({ boardType, boardId }) {
    const [projectId, setProjectId] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        if (!boardId) {
            setProjectId(null);
            setLoading(false);
            return;
        }

        async function run() {
            setLoading(true);
            const resolved = await resolveProjectId(boardId);
            if (active) {
                setProjectId(resolved);
                setLoading(false);
            }
        }
        run();

        return () => { active = false; };
    }, [boardType, boardId]);

    return { projectId, loading };
}
