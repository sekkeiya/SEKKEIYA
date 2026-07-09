// src/features/layout/components/RightSidebar/hooks/useSceneOutlinerTree.js
import { useCallback, useMemo, useState } from "react";

import { useModelTitleMap } from "@desktop/features/dsl/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel, isUuidLike } from "@desktop/features/dsl/layout/utils/labels/itemLabelUtils";
import { useUiVisibilityStore } from "@desktop/features/dsl/layout/store/uiVisibilityStore";
import { useLightingStore } from "@desktop/features/dsl/layout/store/useLightingStore";
import { useEnvironmentStore } from "@desktop/features/dsl/layout/store/useEnvironmentStore";

/**
 * Outliner用の tree を作る
 * - 配置アイテムは item:{id} で統一
 * - Scene/Groups 等は scene:* で衝突回避
 *
 * ✅ 共通化：
 * - 表示名は getItemDisplayLabel(it, modelTitleMap) を使う
 * - modelTitleMap の取得は useModelTitleMap に委譲
 */
export function useSceneOutlinerTree({
    items = [],

    optionDoc,
    optionDocLoading,
    baseDoc,
    baseDocLoading,
    meta,
} = {}) {
    // ✅ 展開状態（デフォルトでSceneとItemsフォルダを開いておく）
    const [expanded, setExpanded] = useState(["scene:root", "scene:items"]);

    // ✅ Lighting store からライトを購読
    const storeLights = useLightingStore((s) => s.lights);

    // ✅ Environment store から Landscape プリセットと可視状態を購読
    const landscape = useEnvironmentStore((s) => s.landscape);
    const flatVisible = useEnvironmentStore((s) => s.flatVisible);
    const setFlatVisible = useEnvironmentStore((s) => s.setFlatVisible);
    const skyVisible = useEnvironmentStore((s) => s.skyVisible);
    const setSkyVisible = useEnvironmentStore((s) => s.setSkyVisible);

    // ✅ 可視状態（Zustand ストア経由：FurnitureItem 側と共有）
    const hiddenNodeIds = useUiVisibilityStore((s) => s.hiddenNodeIds);
    const toggleNodeVisibility = useUiVisibilityStore((s) => s.toggleNodeVisibility);

    const isVisible = useCallback(
        (nodeId) => {
            if (nodeId === "scene:landscape-flat") return flatVisible;
            if (nodeId === "scene:landscape-sky") return skyVisible;
            return !hiddenNodeIds[nodeId];
        },
        [hiddenNodeIds, flatVisible, skyVisible]
    );
    const toggleVisible = useCallback(
        (nodeId) => {
            if (nodeId === "scene:landscape-flat") {
                setFlatVisible(!flatVisible);
                return;
            }
            if (nodeId === "scene:landscape-sky") {
                setSkyVisible(!skyVisible);
                return;
            }
            toggleNodeVisibility(nodeId);
        },
        [toggleNodeVisibility, flatVisible, skyVisible, setFlatVisible, setSkyVisible]
    );

    // --------------------------------------------------
    // ✅ Outlinerに必要な modelId だけ抽出（= Firestore補完対象）
    // --------------------------------------------------
    const neededModelIds = useMemo(() => {
        const set = new Set();

        for (const it of items || []) {
            const modelId = it?.modelId || it?.id;
            if (!modelId) continue;

            const direct =
                it?.title ||
                it?.name ||
                it?.label ||
                it?.modelName ||
                it?.meta?.name ||
                it?.model?.name;

            const directStr = String(direct || "").trim();
            const modelIdStr = String(modelId || "").trim();

            const hasGoodName =
                !!directStr &&
                !isUuidLike(directStr) &&
                directStr !== modelIdStr;

            if (!hasGoodName) set.add(modelIdStr);
        }

        return Array.from(set);
    }, [items]);

    // ✅ Firestoreから title を補完取得（共通hook）
    const modelTitleMap = useModelTitleMap(neededModelIds);

    // --------------------------------------------------
    // ✅ tree生成
    // --------------------------------------------------
    const tree = useMemo(() => {
        const itemNodes = (items || []).map((it) => ({
            id: `item:${it.id}`,
            type: "item",
            label: getItemDisplayLabel(it, modelTitleMap),
            children: [],
            __rawId: it.id,
        }));

        // non-hemisphere lights → tree nodes under Scene root
        const lightNodes = (storeLights || [])
            .filter((l) => l.type !== "hemisphere")
            .map((l) => ({
                id: `light:${l.id}`,
                type: "light",
                lightType: l.type,
                label: l.name,
                children: [],
            }));

        // ✅ Landscape プリセット適用中なら Sky / Flat ノードを追加
        const landscapeNodes = [];
        if (landscape === "flat") {
            landscapeNodes.push({
                id: "scene:landscape-sky",
                type: "landscape-sky",
                label: "Sky",
                children: [],
            });
            landscapeNodes.push({
                id: "scene:landscape-flat",
                type: "landscape-flat",
                label: "Flat",
                children: [],
            });
        }

        return [
            {
                id: "scene:root",
                type: "scene",
                label: "Scene",
                children: [
                    { id: "scene:ambience", type: "ambience", label: "Ambience", children: [] },
                    ...lightNodes,
                    ...landscapeNodes,
                    { id: "scene:base", type: "group", label: "Starting Base", children: [] },
                    { id: "scene:items", type: "group", label: `Items (${itemNodes.length})`, children: itemNodes },
                ],
            },
        ];
    }, [items, modelTitleMap, storeLights, landscape]);

    return {
        tree,
        expanded,
        setExpanded,
        isVisible,
        toggleVisible,

        // ✅ Outliner以外でも必要なら使える
        modelTitleMap,
        neededModelIds,
    };
}
