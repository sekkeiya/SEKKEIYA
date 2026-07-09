// src/features/layout/hooks/useUndoRedoShortcuts.js
import { useEffect } from "react";

export function useUndoRedoShortcuts({ onUndo, onRedo, enabled = true }) {
    useEffect(() => {
        if (!enabled) return;

        const handler = (e) => {
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
            const mod = isMac ? e.metaKey : e.ctrlKey;
            if (!mod) return;

            // 押しっぱなしで連打扱いになるのを防ぐ（好みで外してOK）
            if (e.repeat) return;

            const k = String(e.key || "").toLowerCase();
            if (k === "z") {
                e.preventDefault();
                e.stopPropagation();
                if (e.shiftKey) onRedo?.();
                else onUndo?.();
            } else if (k === "y") {
                e.preventDefault();
                e.stopPropagation();
                onRedo?.();
            }
        };

        window.addEventListener("keydown", handler, { capture: true });
        return () => window.removeEventListener("keydown", handler, { capture: true });
    }, [enabled, onUndo, onRedo]);
}