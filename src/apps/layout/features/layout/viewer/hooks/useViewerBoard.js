// src/features/layout/LayoutViewer/hooks/useViewerBoard.js
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Firestore
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "@layout/shared/lib/firebase/config";

// auth（あなたのプロジェクトに合わせて import を調整してください）
import { useAuth } from "@layout/features/auth/AuthContext";

/** boardType 正規化 */
function normalizeBoardType(v) {
    const t = String(v || "").trim().toLowerCase();
    if (t === "team") return "team";
    if (t === "my") return "my";
    return null;
}

function sortByOrder(arr, getOrderKey = (x) => x.order) {
    return [...arr].sort((a, b) => (getOrderKey(a) ?? 9999) - (getOrderKey(b) ?? 9999));
}

export function useViewerBoard({ boardId }) {
    const [searchParams] = useSearchParams();
    const { user } = useAuth?.() || {};
    const uid = user?.uid || null;

    const boardTypeParam = normalizeBoardType(searchParams.get("boardType"));
    const ownerUidParam = searchParams.get("ownerUid");

    const boardType = boardTypeParam || "team"; // 共有は team が多い想定でデフォルト team
    const ownerUid = boardType === "my" ? (ownerUidParam || uid) : null;

    const [state, setState] = useState({
        loading: true,
        error: null,
        board: null,
        bases: [],
        plansByBase: {},
        viewerConfig: {
            curated: false,
            items: [],
            allowBrowseAll: true,
        },
    });

    const refs = useMemo(() => {
        if (!boardId) return null;

        if (boardType === "team") {
            const boardRef = doc(db, "teamBoards", boardId);
            const basesCol = collection(db, "teamBoards", boardId, "bases");
            return { boardRef, basesCol, basePlansCol: (baseId) => collection(db, "teamBoards", boardId, "bases", baseId, "plans") };
        }

        // my
        if (!ownerUid) return null;
        const boardRef = doc(db, "users", ownerUid, "myBoards", boardId);
        const basesCol = collection(db, "users", ownerUid, "myBoards", boardId, "bases");
        return { boardRef, basesCol, basePlansCol: (baseId) => collection(db, "users", ownerUid, "myBoards", boardId, "bases", baseId, "plans") };
    }, [boardId, boardType, ownerUid]);

    useEffect(() => {
        if (!refs) {
            setState((s) => ({
                ...s,
                loading: false,
                error: new Error("Viewer URL パラメータが不足しています（my の場合 ownerUid が必要です）"),
            }));
            return;
        }

        let unsubBoard = null;
        let unsubBases = null;
        const unsubsPlans = new Map();

        setState((s) => ({ ...s, loading: true, error: null }));

        unsubBoard = onSnapshot(
            refs.boardRef,
            (snap) => {
                const board = snap.exists() ? { id: snap.id, ...snap.data() } : null;
                const viewerConfig = board?.viewerConfig || {
                    curated: false,
                    items: [],
                    allowBrowseAll: true,
                };
                setState((s) => ({ ...s, board, viewerConfig }));
            },
            (error) => setState((s) => ({ ...s, error, loading: false }))
        );

        unsubBases = onSnapshot(
            refs.basesCol,
            (snap) => {
                const bases = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const basesSorted = sortByOrder(bases, (x) => x.order ?? x.createdAt?.seconds ?? 9999);

                // bases 更新
                setState((s) => ({ ...s, bases: basesSorted }));

                // bases の plans 購読（base ごと）
                // 既存購読に無い base は追加、消えた base は解除
                const baseIds = new Set(basesSorted.map((b) => b.id));

                // remove
                for (const [baseId, unsub] of unsubsPlans.entries()) {
                    if (!baseIds.has(baseId)) {
                        unsub?.();
                        unsubsPlans.delete(baseId);
                        setState((s) => {
                            const next = { ...(s.plansByBase || {}) };
                            delete next[baseId];
                            return { ...s, plansByBase: next };
                        });
                    }
                }

                // add
                for (const base of basesSorted) {
                    if (unsubsPlans.has(base.id)) continue;
                    const unsub = onSnapshot(
                        refs.basePlansCol(base.id),
                        (psnap) => {
                            const plans = psnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                            const plansSorted = sortByOrder(plans, (x) => x.order ?? x.createdAt?.seconds ?? 9999);
                            setState((s) => ({
                                ...s,
                                plansByBase: { ...(s.plansByBase || {}), [base.id]: plansSorted },
                                loading: false,
                            }));
                        },
                        (error) => setState((s) => ({ ...s, error, loading: false }))
                    );
                    unsubsPlans.set(base.id, unsub);
                }

                setState((s) => ({ ...s, loading: false }));
            },
            (error) => setState((s) => ({ ...s, error, loading: false }))
        );

        return () => {
            unsubBoard?.();
            unsubBases?.();
            for (const unsub of unsubsPlans.values()) unsub?.();
            unsubsPlans.clear();
        };
    }, [refs]);

    return {
        loading: state.loading,
        error: state.error,
        boardType,
        ownerUid,
        board: state.board,
        bases: state.bases,
        plansByBase: state.plansByBase,
        viewerConfig: state.viewerConfig,
    };
}
