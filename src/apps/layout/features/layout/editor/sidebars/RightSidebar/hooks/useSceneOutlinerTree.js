// src/features/layout/components/RightSidebar/hooks/useSceneOutlinerTree.js
import { useCallback, useMemo, useState } from "react";

import { useModelTitleMap } from "@layout/features/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel, isUuidLike } from "@layout/features/layout/utils/labels/itemLabelUtils";

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

    // ✅ 可視状態（UI側の👁トグル用）
    const [hiddenMap, setHiddenMap] = useState({}); // { nodeId: true }
    const isVisible = useCallback((nodeId) => !hiddenMap[nodeId], [hiddenMap]);
    const toggleVisible = useCallback((nodeId) => {
        setHiddenMap((m) => ({ ...m, [nodeId]: !m[nodeId] }));
    }, []);

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

        return [
            {
                id: "scene:root",
                type: "scene",
                label: "Scene",
                children: [
                    { id: "scene:ambience", type: "ambience", label: "Ambience", children: [] },
                    { id: "scene:base", type: "group", label: "Starting Base", children: [] },
                    { id: "scene:items", type: "group", label: `Items (${itemNodes.length})`, children: itemNodes },
                ],
            },
        ];
    }, [items, modelTitleMap]);

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
