// src/features/layout/LayoutViewer/hooks/useViewerOptionDoc.js
import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import { useAuth } from "@layout/features/auth/AuthContext";
import { doc } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

function normalizeBoardType(boardType) {
    const t = String(boardType || "").trim().toLowerCase();
    if (t === "team") return "team";
    if (t === "my" || t === "myboard" || t === "myboards") return "my";
    if (t === "teamboard" || t === "teamboards") return "team";
    return "my";
}

function getOptionDocRef({ uid, boardType, boardId, baseId, planId, optionId }) {
    const t = normalizeBoardType(boardType);
    if (!boardId || !baseId || !planId || !optionId) return null;
    if (t === "team") {
        return doc(db, "teamBoards", boardId, "bases", baseId, "plans", planId, "options", optionId);
    }
    if (!uid) return null;
    return doc(db, "users", uid, "myBoards", boardId, "bases", baseId, "plans", planId, "options", optionId);
}

export function useViewerOptionDoc({ boardType, ownerUid, boardId, baseId, planId, optionId }) {
    const { user } = useAuth();
    const uid = user?.uid || null;

    const uidForMy = ownerUid || uid;

    const ref0 = useMemo(() => {
        if (!boardId || !baseId || !planId || !optionId) return null;

        if (boardType === "team") {
            return getOptionDocRef({
                uid: null,
                boardType: "team",
                boardId,
                baseId,
                planId,
                optionId,
            });
        }

        if (!uidForMy) return null;

        return getOptionDocRef({
            uid: uidForMy,
            boardType: "my",
            boardId,
            baseId,
            planId,
            optionId,
        });
    }, [boardType, uidForMy, boardId, baseId, planId, optionId]);

    const [state, setState] = useState({ loading: true, data: null, error: null });

    useEffect(() => {
        if (!ref0) {
            setState({ loading: false, data: null, error: null });
            return;
        }

        setState((s) => ({ ...s, loading: true, error: null }));

        const unsub = onSnapshot(
            ref0,
            (snap) => {
                setState({ loading: false, data: snap.exists() ? { id: snap.id, ...snap.data() } : null, error: null });
            },
            (error) => setState({ loading: false, data: null, error })
        );

        return () => unsub();
    }, [ref0]);

    return { ...state, ref: ref0 };
}
