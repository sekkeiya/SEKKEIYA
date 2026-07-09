import { useMemo, useCallback } from "react";
import { useUiSelectionStore } from "../../../store/uiSelectionStore";
import { useViewportUiStore } from "../../../store/viewportUiStore";
import { useUiPropertiesSelectionStore } from "../../../store/uiPropertiesSelectionStore";

export function useViewportSelection({ materialPicking }) {
    const selectedItemIds = useUiSelectionStore((s) => s.selectedItemIds);
    const setSelectedItemIds = useUiSelectionStore((s) => s.setSelectedItemIds);

    const selectedItemId = useMemo(() => {
        const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
        return ids[0] ?? null;
    }, [selectedItemIds]);

    const focusCommandBar = useCallback(() => {
        if (!useViewportUiStore.getState().commandOpen) return;

        const api = useViewportUiStore.getState?.().toolbarApi;
        if (!api?.focusCommand) return;

        try { api.focusCommand({ select: true }); } catch { }

        try {
            if (typeof queueMicrotask === "function") queueMicrotask(() => api.focusCommand?.({ select: true }));
            else Promise.resolve().then(() => api.focusCommand?.({ select: true }));
        } catch { }

        window.setTimeout(() => api.focusCommand?.({ select: true }), 0);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedItemIds?.([]);
        // ライト・マテリアル等の properties パネル選択も同時にクリアする。
        // これにより余白クリックでライト選択が解除される。
        useUiPropertiesSelectionStore.getState().clearSelection();
    }, [setSelectedItemIds]);

    const applySelectionIds = useCallback(
        (ids, eventLike, source = "click") => {
            const next = Array.isArray(ids) ? ids.filter(Boolean) : [];
            const curr = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
            const currSet = new Set(curr);

            const shift = !!(eventLike?.shiftKey ?? eventLike?.nativeEvent?.shiftKey);

            let out;
            if (shift) {
                for (const id of next) {
                    if (currSet.has(id)) currSet.delete(id);
                    else currSet.add(id);
                }
                out = Array.from(currSet);
            } else {
                out = next;
            }

            setSelectedItemIds?.(out);

            // ✁E選択した瞬間にCommandBarへ�E�EaterialPick中だけ除外！E
            if (!materialPicking) {
                queueMicrotask(() => focusCommandBar());
                window.setTimeout(() => focusCommandBar(), 0);
            }
        },
        [selectedItemIds, setSelectedItemIds, materialPicking, focusCommandBar]
    );

    const selectedSet = useMemo(() => {
        const ids = Array.isArray(selectedItemIds) ? selectedItemIds.filter(Boolean) : [];
        return new Set(ids);
    }, [selectedItemIds]);

    return {
        selectedItemIds,
        selectedItemId,
        selectedSet,
        applySelectionIds,
        clearSelection,
    };
}
