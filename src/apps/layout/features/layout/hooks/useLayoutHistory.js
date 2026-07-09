// src/features/layout/hooks/useLayoutHistory.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function cloneLayout(layout) {
    // 深いコピーが必要（items配列やtransformも）
    return JSON.parse(JSON.stringify(layout ?? { items: [] }));
}
// ±約 0.001 (1mm) 程度の浮動小数点誤差を無視して比較する
function isFloatEqual(a, b, epsilon = 0.001) {
    if (typeof a !== 'number' || typeof b !== 'number') return a === b;
    return Math.abs(a - b) < epsilon;
}

function areTransformsClose(t1, t2) {
    if (!t1 && !t2) return true;
    if (!t1 || !t2) return false;

    for (const key of ['position', 'rotation', 'scale']) {
        const a1 = t1[key], a2 = t2[key];
        if (!a1 && !a2) continue;
        if (!a1 || !a2) return false;

        // 配列 (通常 [x,y,z])
        if (a1.length !== a2.length) return false;
        for (let i = 0; i < a1.length; i++) {
            if (!isFloatEqual(a1[i], a2[i])) return false;
        }
    }
    return true;
}

function areLayoutsCloseEnough(layout1, layout2) {
    if (!layout1 && !layout2) return true;
    if (!layout1 || !layout2) return false;

    // items配列の長さチェック
    const items1 = layout1.items || [];
    const items2 = layout2.items || [];
    if (items1.length !== items2.length) return false;

    // 個々のitem比較（IDやTransformなど）
    for (let i = 0; i < items1.length; i++) {
        const item1 = items1[i];
        const item2 = items2[i];
        if (item1.id !== item2.id) return false;
        if (item1.modelId !== item2.modelId) return false;
        // Transformの誤差許容チェック
        if (!areTransformsClose(item1.transform, item2.transform)) return false;
    }
    return true;
}

export function useLayoutHistory({ optionDoc, optionDocLoading, setDirty, historyLimit = 100 }) {
    const initial = useMemo(() => optionDoc?.layout ?? { items: [] }, [optionDoc?.layout]);

    const [layoutDraft, setLayoutDraft] = useState(initial);

    const undoStackRef = useRef([]); // [{ before, after }]
    const redoStackRef = useRef([]);

    // ✅ batch
    const batchingRef = useRef(false);
    const batchBeforeRef = useRef(null);

    useEffect(() => {
        if (optionDocLoading) return;
        setLayoutDraft(initial);
        undoStackRef.current = [];
        redoStackRef.current = [];
        batchingRef.current = false;
        batchBeforeRef.current = null;
    }, [initial, optionDocLoading]);

    const pushHistory = useCallback((before, after) => {
        // 変化がないなら積まない
        if (!before || !after) return;

        // JSONの完全一致ではなく、浮動小数点の微小な差を許容する比較
        if (areLayoutsCloseEnough(before, after)) return;

        console.log("[useLayoutHistory] PUSHING HISTORY:", { before, after });

        undoStackRef.current.push({ before, after });
        if (undoStackRef.current.length > historyLimit) {
            undoStackRef.current.shift();
        }
        redoStackRef.current = [];
    }, [historyLimit]);

    const beginBatch = useCallback(() => {
        if (batchingRef.current) return;
        batchingRef.current = true;

        setLayoutDraft((currentLayout) => {
            batchBeforeRef.current = cloneLayout(currentLayout);
            return currentLayout;
        });
    }, []);

    const endBatch = useCallback(() => {
        if (!batchingRef.current) return;
        batchingRef.current = false;

        setLayoutDraft((currentLayout) => {
            const before = batchBeforeRef.current;
            batchBeforeRef.current = null;

            if (before) {
                const after = cloneLayout(currentLayout);
                pushHistory(before, after);
            }
            return currentLayout;
        });
    }, [pushHistory]);

    const cancelBatch = useCallback(() => {
        batchingRef.current = false;
        batchBeforeRef.current = null;
    }, []);

    const applyLayoutDraft = useCallback((nextOrUpdater, opts = {}) => {
        const {
            markDirty = false,
            pushToHistory = true, // ✅ default true
        } = opts;

        setLayoutDraft((prev) => {
            const before = cloneLayout(prev);
            const next =
                typeof nextOrUpdater === "function"
                    ? nextOrUpdater(prev)
                    : nextOrUpdater;

            const after = cloneLayout(next);

            // ✅ バッチ中は push しない（確定時にまとめて 1回）
            if (!batchingRef.current && pushToHistory) {
                pushHistory(before, after);
            }
            return next;
        });

        if (markDirty) setDirty?.(true);
    }, [pushHistory, setDirty]);

    const handleUndo = useCallback(() => {
        const op = undoStackRef.current.pop();
        if (!op) return;
        redoStackRef.current.push(op);
        setLayoutDraft(op.before);
        setDirty?.(true);
    }, [setDirty]);

    const handleRedo = useCallback(() => {
        const op = redoStackRef.current.pop();
        if (!op) return;
        undoStackRef.current.push(op);
        setLayoutDraft(op.after);
        setDirty?.(true);
    }, [setDirty]);

    return {
        layoutDraft,
        applyLayoutDraft,
        handleUndo,
        handleRedo,
        beginBatch,
        endBatch,
        cancelBatch,
    };
}