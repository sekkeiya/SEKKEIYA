import { useState, useEffect } from "react";
import { getDocs, query, orderBy } from "firebase/firestore";
import {
  getLayoutPlansColRef,
  getLayoutItemsColRef,
} from "../../dsl/layout/paths/workspacePaths";
import { useAppStore } from "../../../store/useAppStore";

/**
 * 3DSS のプロジェクト内 Asset 使用状況を一括集計する
 * 
 * 戻り値 usageMap:
 * {
 *   [assetId]: {
 *     totalCount: number,
 *     locations: [
 *        { optionId, pathName: 'Base A / Plan 1 / Option A', count }
 *     ]
 *   }
 * }
 */
export function useProjectAssetUsage({ projectId, workspaceId = "layout" }) {
  const [usageMap, setUsageMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function fetchUsage() {
      if (!projectId || !workspaceId) return;
      setLoading(true);
      setError(null);

      try {
        const plansCol = getLayoutPlansColRef({ projectId, workspaceId });
        if (!plansCol) throw new Error("Invalid project/workspace");

        // 全planを取得
        const snap = await getDocs(query(plansCol, orderBy("sortOrder", "asc")));
        const allPlans = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const planMap = new Map(allPlans.map((p) => [p.id, p]));

        // Option(末端レイアウト) のみを対象にする
        const optionPlans = allPlans.filter((p) => p.planType === "option");

        // 一時的な集計オブジェクト
        // assetId -> { totalCount, locationsMap: { optionId -> { pathName, count } } }
        const rawMap = {};

        // パス名復元ヘルパー
        const getParentPath = (optId) => {
          const opt = planMap.get(optId);
          if (!opt) return optId;
          const prop = planMap.get(opt.parentPlanId);
          const base = prop ? planMap.get(prop.parentPlanId) : null;

          const baseName = base ? base.name || "Unknown Base" : "Unknown Base";
          const propName = prop ? prop.name || "Unknown Plan" : "Unknown Plan";
          const optName = opt.name || "Unknown Option";

          return `${baseName} / ${propName} / ${optName}`;
        };

        // 各 Option の items を並列取得
        await Promise.all(
          optionPlans.map(async (opt) => {
            const itemsCol = getLayoutItemsColRef({
              projectId,
              workspaceId,
              planId: opt.id,
            });
            const itemSnap = await getDocs(itemsCol);
            const items = itemSnap.docs.map((d) => d.data());

            // assetId ごとにアイテム数を集計
            const optAssetCounts = {};
            items.forEach((item) => {
              const assetId = item.assetId || item?.assetData?.id;
              if (assetId) {
                optAssetCounts[assetId] = (optAssetCounts[assetId] || 0) + 1;
              }
            });

            const pathName = getParentPath(opt.id);

            // rawMap に合算
            for (const [aId, count] of Object.entries(optAssetCounts)) {
              if (!rawMap[aId]) {
                rawMap[aId] = { totalCount: 0, locationsMap: {} };
              }
              rawMap[aId].totalCount += count;
              rawMap[aId].locationsMap[opt.id] = { optionId: opt.id, pathName, count };
            }
          })
        );

        if (!active) return;

        // 使いやすいように locationsMap を配列に変換してソート
        const finalMap = {};
        const availablePathsSet = new Set();
        for (const [aId, data] of Object.entries(rawMap)) {
          finalMap[aId] = {
            totalCount: data.totalCount,
            locations: Object.values(data.locationsMap).sort((a, b) =>
              a.pathName.localeCompare(b.pathName)
            ),
          };
          Object.values(data.locationsMap).forEach(loc => availablePathsSet.add(loc.pathName));
        }

        const availablePaths = Array.from(availablePathsSet).sort((a, b) => a.localeCompare(b));
        useAppStore.getState().setAvailableLayoutPaths(availablePaths);
        
        setUsageMap(finalMap);
      } catch (err) {
        console.error("useProjectAssetUsage fetch error:", err);
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchUsage();

    return () => {
      active = false;
    };
  }, [projectId, workspaceId]);

  // Refetch用に再取得できる関数を返す場合はここで定義してもよい
  return { usageMap, loading, error };
}
