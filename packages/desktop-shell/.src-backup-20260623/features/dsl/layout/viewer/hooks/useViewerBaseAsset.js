// src/features/layout/LayoutViewer/hooks/useViewerBaseAsset.js
import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { useAuth } from "@desktop/features/dsl/layout/hooks/useAuthProxy";
import { doc } from "firebase/firestore";
import { db } from "@desktop/lib/firebase/client";

function normalizeBoardType(boardType) {
    const t = String(boardType || "").trim().toLowerCase();
    if (t === "team") return "team";
    if (t === "my" || t === "myboard" || t === "myboards") return "my";
    if (t === "teamboard" || t === "teamboards") return "team";
    return "my";
}

function getBaseDocRef({ uid, boardType, boardId, baseId }) {
    const t = normalizeBoardType(boardType);
    if (!boardId || !baseId) return null;
    if (t === "team") {
        return doc(db, "teamBoards", boardId, "bases", baseId);
    }
    if (!uid) return null;
    return doc(db, "users", uid, "myBoards", boardId, "bases", baseId);
}
import { useResolvedUrl } from "@desktop/features/dsl/layout/hooks/useResolvedUrl.js";

function pickFirstString(...candidates) {
    for (const v of candidates) {
        if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
}

export function useViewerBaseAsset({ boardType, ownerUid, boardId, baseId }) {
    const { user } = useAuth();
    const uid = user?.uid || null;

    const boardTypeN = normalizeBoardType(boardType);
    const uidForMy = ownerUid || uid;

    const baseRef = useMemo(() => {
        if (!boardId || !baseId) return null;

        if (boardTypeN === "team") {
            return getBaseDocRef({ uid: null, boardType: "team", boardId, baseId });
        }
        if (!uidForMy) return null;
        return getBaseDocRef({ uid: uidForMy, boardType: "my", boardId, baseId });
    }, [boardTypeN, uidForMy, boardId, baseId]);

    const [baseDoc, setBaseDoc] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!baseRef) {
            setBaseDoc(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsub = onSnapshot(
            baseRef,
            (snap) => {
                setBaseDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
                setLoading(false);
            },
            () => {
                setBaseDoc(null);
                setLoading(false);
            }
        );
        return () => unsub();
    }, [baseRef]);

    const baseGlbUrlRaw = useMemo(() => {
        return pickFirstString(
            baseDoc?.asset?.glbUrl,
            baseDoc?.glbUrl,
            baseDoc?.viewerGlbUrl,
            baseDoc?.modelGlbUrl,
            baseDoc?.asset?.viewerGlbUrl,
            baseDoc?.asset?.glbPath,
            baseDoc?.glbPath,
            baseDoc?.files?.glb?.path,
            baseDoc?.files?.glb?.fullPath,
            baseDoc?.files?.glb?.storagePath
        );
    }, [baseDoc]);

    const [version, setVersion] = useState(0);
    const baseGlbUrlResolved = useResolvedUrl(baseGlbUrlRaw, version);

    return {
        loading,
        baseDoc,
        baseGlbUrlRaw,
        baseGlbUrlResolved,
        bump: () => setVersion((v) => v + 1),
    };
}
