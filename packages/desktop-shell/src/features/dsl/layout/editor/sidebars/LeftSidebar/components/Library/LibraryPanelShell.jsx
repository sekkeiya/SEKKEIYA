import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Paper, Box, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import LibrarySearchBar from "./LibrarySearchBar";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import LibraryCategoryGrid from "./LibraryCategoryGrid";
import LibraryAssetGrid from "./LibraryAssetGrid";
import PlanFurniturePanel from "./PlanFurniturePanel";

import { usePublicModels } from "../../../../../hooks/usePublicModels";
import { useProjectDssModels } from "../../../../../hooks/useProjectDssModels";
import { useWorkspaceModelRefs } from "../../../../../hooks/useWorkspaceModelRefs";
import { useModelTitleMap } from "../../../../../hooks/useModelTitleMap";
import { getItemDisplayLabel } from "../../../../../utils/labels/itemLabelUtils";
import { getCategoryTree, TYPES, getGroupSlug } from "../../../../../../../../shared/data/Categories";
import { ROOT_CATEGORIES } from "./LibraryConstants";
import { useWorkspaceStructureStore } from "../../../../../store/useWorkspaceStructureStore";
import { useUserSettingsStore } from "../../../../../../../../store/useUserSettingsStore";
import LightingLibraryContent from "./LightingLibraryContent";
import EnvironmentLibraryContent from "./EnvironmentLibraryContent";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
}
function normalizeMacro(s) {
  // 全角括弧→半角・空白除去で表記揺れを吸収
  return safeStr(s).replace(/[（）]/g, (m) => (m === "（" ? "(" : ")")).replace(/\s+/g, "").trim();
}
function safeArray(v) {
  return Array.isArray(v) ? v : [];
}
function safeSet(v) {
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  return new Set();
}

function getModelType(m) {
  const fields = [
    m?.type,
    m?.modelType,
    m?.categoryType,
    m?.mainCategory,
    m?.category,
  ].map((v) => safeStr(v).toLowerCase());

  if (fields.includes(TYPES.ARCHITECTURE) || fields.includes("建築") || fields.includes("パーツ") || fields.includes("外構")) return TYPES.ARCHITECTURE;

  // Default to Furniture so uncategorized models don't disappear from the UI
  return TYPES.FURNITURE;
}

function getModelSubType(m) {
  const st = safeStr(m?.subType, "") || safeStr(m?.archSubType, "") || "";
  // Map DB strings to UI strings
  if (st === "全体") return "建物（本体）";
  if (st === "パーツ") return "建具・部材";
  if (st === "外構") return "外構・周辺";
  if (st === "躯体") return "建物（本体）";
  return st;
}

function getModelGroupLabel(m) {
  return (
    safeStr(m?.group, "") ||
    safeStr(m?.categoryGroup, "") ||
    safeStr(m?.category, "") ||
    ""
  );
}

export default function LibraryPanelShell({ projectId, workspaceId, planId }) {
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);
  const plansOfSelectedBase = useWorkspaceStructureStore((s) => s.plansOfSelectedBase);
  const theme = useTheme();
  
  // State
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  // path: Array of nodes representing the navigation trace
  // [{ level: 1, id: 'furniture', label: 'Furniture', type: '...', subType: '...' }, { level: 2, id: 'group_name', label: 'Group Name' }]
  const [path, setPath] = useState([]);

  // Data Hooks
  const { models: publicModels, loading: publicLoading } = usePublicModels({
    enabled: true,
    limit: 240,
  });

  const { models: projectModels, loading: projectLoading } = useProjectDssModels({
    projectId,
    enabled: Boolean(projectId),
    limit: 240,
  });

  const { planModelIds } = useWorkspaceModelRefs({
    projectId,
    workspaceId,
    planId,
    enabled: Boolean(projectId && workspaceId),
  });

  const planIds = useMemo(() => safeSet(planModelIds), [planModelIds]);

  const loadingAny = publicLoading || projectLoading;

  // Needed Titles
  const modelsByTab = useMemo(() => {
    if (tab === "project") {
      return Array.isArray(projectModels) ? projectModels : [];
    }
    return Array.isArray(publicModels) ? publicModels : [];
  }, [publicModels, projectModels, tab]);

  const neededModelIds = useMemo(() => {
    const set = new Set();
    for (const m of modelsByTab || []) {
      const modelId = String(m?.id || "").trim();
      if (!modelId) continue;
      const directStr = String(m?.name || "").trim();
      if (!directStr || directStr === modelId) set.add(modelId);
    }
    return Array.from(set);
  }, [modelsByTab]);

  const modelTitleMap = useModelTitleMap(neededModelIds);

  const makeSearchText = useCallback(
    (m) => {
      const modelId = safeStr(m?.id, "");
      const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);
      const parts = [
        displayName, m?.brand, m?.ownerHandle, modelId, m?.type, m?.subType, m?.group, m?.categoryGroup, m?.category, ...safeArray(m?.tags)
      ].filter(Boolean).map(s => safeStr(s).toLowerCase());
      return parts.join(" ");
    },
    [modelTitleMap]
  );

  // 正典カテゴリマップ（S.Models Settings と同一）からリーフ→{macro,main}逆引き表を作る。
  // モデルの macroCategory 誤保存（AI生成ドア・窓が家具(造作)等）を mainCategory/subCategory から補正する。
  const systemCategories = useUserSettingsStore((s) => s.systemCategories);
  const getMergedCategoryMap = useUserSettingsStore((s) => s.getMergedCategoryMap);
  const startSystemCategoriesSync = useUserSettingsStore((s) => s.startSystemCategoriesSync);
  useEffect(() => { startSystemCategoriesSync(); }, [startSystemCategoriesSync]);
  const categoryMap = useMemo(() => getMergedCategoryMap(), [systemCategories, getMergedCategoryMap]);
  const leafIndex = useMemo(() => {
    const idx = {};
    for (const macro of Object.keys(categoryMap || {})) {
      for (const main of Object.keys(categoryMap[macro] || {})) {
        if (!idx[normalizeMacro(main)]) idx[normalizeMacro(main)] = { macro, main };
        for (const leaf of categoryMap[macro][main] || []) idx[normalizeMacro(leaf)] = { macro, main };
      }
    }
    return idx;
  }, [categoryMap]);
  const sortedLeafKeys = useMemo(() => Object.keys(leafIndex).sort((a, b) => b.length - a.length), [leafIndex]);
  const matchLeafFromText = useCallback((model) => {
    const text = [model?.title, model?.name, model?.category, model?.group, model?.mainCategory, model?.subCategory, model?.subType]
      .map((s) => normalizeMacro(s)).filter(Boolean).join(" ");
    if (!text) return null;
    for (const key of sortedLeafKeys) {
      if (key.length >= 2 && text.includes(key)) return leafIndex[key];
    }
    return null;
  }, [leafIndex, sortedLeafKeys]);
  // モデルの macro を解決: 明示 macroCategory → mainCategory/subCategory リーフ逆引き → テキスト推定
  const resolveMacroOf = useCallback((model) => {
    const main = normalizeMacro(model?.mainCategory) || normalizeMacro(model?.subType);
    const detail = normalizeMacro(model?.subCategory) || normalizeMacro(model?.group) || normalizeMacro(model?.userCategory);
    const hit = leafIndex[detail] || (main ? leafIndex[main] : null);
    if (hit) return normalizeMacro(hit.macro);
    const explicit = normalizeMacro(model?.macroCategory) || normalizeMacro(model?.macro) || normalizeMacro(model?.categoryMacro);
    if (explicit) return explicit;
    const textHit = matchLeafFromText(model);
    if (textHit) return normalizeMacro(textHit.macro);
    const hay = [model?.type, model?.modelType, model?.category, model?.mainCategory, model?.subType, model?.group]
      .map((v) => safeStr(v).toLowerCase()).join(" ");
    if (hay.includes("architecture") || hay.includes("建築") || hay.includes("建具") || hay.includes("外構") || hay.includes("構造") || hay.includes("躯体")) return normalizeMacro("建築・空間");
    if (hay.includes("造作")) return normalizeMacro("家具 (造作)");
    if (hay.includes("照明") || hay.includes("家電") || hay.includes("設備") || hay.includes("水回り")) return normalizeMacro("設備・備品");
    if (hay.includes("グリーン") || hay.includes("観葉") || hay.includes("植")) return normalizeMacro("グリーン");
    if (hay.includes("小物") || hay.includes("装飾") || hay.includes("ファブリック") || hay.includes("カーテン") || hay.includes("ラグ")) return normalizeMacro("インテリア小物");
    return normalizeMacro("家具 (既製品)");
  }, [leafIndex, matchLeafFromText]);
  // モデルの mainCategory（サブグループ）を解決
  const resolveSubOf = useCallback((model) => {
    const main = normalizeMacro(model?.mainCategory) || normalizeMacro(model?.subType);
    if (main && leafIndex[main]) return normalizeMacro(leafIndex[main].main);
    const detail = normalizeMacro(model?.subCategory) || normalizeMacro(model?.group) || normalizeMacro(model?.userCategory);
    if (detail && leafIndex[detail]) return normalizeMacro(leafIndex[detail].main);
    const textHit = matchLeafFromText(model);
    if (textHit) return normalizeMacro(textHit.main);
    return main;
  }, [leafIndex, matchLeafFromText]);

  // Filter Models down based on Path and Search
  const filteredModels = useMemo(() => {
    let list = modelsByTab;

    // Search filter
    const s = String(q || "").trim().toLowerCase();
    if (s) {
      list = list.filter((m) => makeSearchText(m).includes(s));
    }

    // Since we want search to be global-ish within the library, if we have a search string, 
    // we might want to bypass the path restriction. But let's keep path restriction for now to narrow down.
    // Level 1: マクロ（家具既製品 / 建築・空間 等）で絞る。リーフ逆引きで誤分類を補正。
    if (path.length > 0 && path[0]?.macro) {
      const targetMacro = normalizeMacro(path[0].macro);
      list = list.filter((m) => resolveMacroOf(m) === targetMacro);
    }

    // Level 2: サブグループ（mainCategory）で絞る（ALL は全件）
    if (path.length > 1 && path[1]?.label && path[1].label !== "ALL") {
      const targetSub = normalizeMacro(path[1].label);
      list = list.filter((m) => resolveSubOf(m) === targetSub);
    }

    return list.slice(0, 240);
  }, [modelsByTab, q, path, makeSearchText, resolveMacroOf, resolveSubOf]);

  // Project Models タブ：選択中の Plan に配置済み（選定済み）の家具をフラットに一覧表示。
  // カテゴリ階層ではなく「このプランの家具」を見せる。
  const planFurnitureModels = useMemo(() => {
    const pool = [
      ...(Array.isArray(projectModels) ? projectModels : []),
      ...(Array.isArray(publicModels) ? publicModels : []),
    ];
    const seen = new Set();
    const out = [];
    const s = String(q || "").trim().toLowerCase();
    for (const m of pool) {
      const id = m?.id;
      if (!id || seen.has(id) || !planIds.has(id)) continue;
      if (s && !makeSearchText(m).includes(s)) continue;
      seen.add(id);
      out.push(m);
    }
    return out;
  }, [projectModels, publicModels, planIds, q, makeSearchText]);

  // Derived Grid Logic
  const getLevel1Groups = useCallback(() => {
    if (path.length === 0) return [];
    const rootNode = path[0];
    // 正典マップのマクロ配下キー（mainCategory）をサブグループとして列挙
    const subgroups = rootNode.macro ? Object.keys(categoryMap[rootNode.macro] || {}) : [];
    const groups = subgroups.map((g) => ({ id: g, label: g }));
    return [{ id: "ALL", label: "ALL" }, ...groups];
  }, [path, categoryMap]);

  // View Routing
  const currentLevel = path.length;

  // ライブラリのカテゴリを選択状態で切り替える。
  // - Plan / Option 選択中（インテリア編集）→ Furniture のみ
  // - Base のみ選択中（躯体編集）→ Furniture 以外（Architecture / Parts / Exterior / Lighting / Environment）
  const isPlanContext = !!selectedPlanId || !!selectedOptionId;
  // context: 'base'=躯体(Base)時 / 'plan'=家具配置(Plan/Option)時 / 'both'=両方
  const visibleRootCategories = useMemo(() => {
    return ROOT_CATEGORIES.filter((c) => {
      if (c.context === "both") return true;
      return isPlanContext ? c.context === "plan" : c.context === "base";
    });
  }, [isPlanContext]);

  // （正典ヘルパーは filteredModels より前に定義 — TDZ 回避のため上方へ移動済み）

  // Base⇄Plan の文脈が変わったらドリルダウンを root へ戻す（古いカテゴリ階層を残さない）
  useEffect(() => {
    setPath([]);
  }, [isPlanContext]);

  const navigateToRoot = () => setPath([]);
  const navigateUpTo = (index) => setPath(prev => prev.slice(0, index + 1));
  const pushPath = (node) => setPath(prev => [...prev, node]);

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 0,
        p: 0,
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        background: "transparent",
        borderColor: "transparent",
        boxShadow: "none",
      }}
    >
      <Box 
        sx={{ 
          pt: 1.5, 
          pb: 1, 
          px: 1.5, 
          borderBottom: `1px solid ${alpha("#fff", 0.05)}`,
          background: "transparent",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 2,
        }}
      >
        <LibrarySearchBar q={q} setQ={setQ} tab={tab} setTab={setTab} />
        {currentLevel > 0 && (
          <Box sx={{ mt: 1 }}>
            <LibraryBreadcrumb path={path} onNavigateToRoot={navigateToRoot} onNavigateUpTo={navigateUpTo} />
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", pb: 4 }}>
        {loadingAny ? (
           <Box display="flex" justifyContent="center" py={4}>
             <CircularProgress size={24} sx={{ color: alpha("#fff", 0.3) }} />
           </Box>
        ) : (
           <>
             {tab === "plan" ? (
                // Plan スコープ：選択中プランの選定家具を一覧（削除・他プランへコピー/移動）
                <PlanFurniturePanel
                  models={planFurnitureModels}
                  modelTitleMap={modelTitleMap}
                  planId={planId}
                  plans={plansOfSelectedBase}
                />
             ) : q.trim() !== "" ? (
                // If searching, jump straight to asset grid matching
                <LibraryAssetGrid
                  models={filteredModels}
                  modelTitleMap={modelTitleMap}
                  planIds={planIds}
                  tab={tab}
                />
             ) : currentLevel === 0 ? (
                // Level 0: Roots（Base/Plan で表示カテゴリを切替）
                <LibraryCategoryGrid
                   items={visibleRootCategories}
                   columns={2}
                   onClick={(item) => {
                     pushPath({ level: 1, id: item.id, label: item.label, macro: item.macro, special: item.special });
                   }}
                />
             ) : currentLevel === 1 && path[0]?.id === "lighting" ? (
                // Level 1 special: Lighting → show placeable light types
                <LightingLibraryContent />
             ) : currentLevel === 1 && path[0]?.id === "environment" ? (
                // Level 1 special: Environment → show Landscape presets
                <EnvironmentLibraryContent />
             ) : currentLevel === 1 ? (
                // Level 1: SubGroups
                <LibraryCategoryGrid
                   items={getLevel1Groups()}
                   columns={2}
                   formatLabel={true}
                   onClick={(item) => pushPath({ level: 2, id: item.id, label: item.label })}
                />
             ) : (
                // Level 2: Asset Grid
                <LibraryAssetGrid
                  models={filteredModels}
                  modelTitleMap={modelTitleMap}
                  planIds={planIds}
                  tab={tab}
                  path={path}
                />
             )}
           </>
        )}
      </Box>
    </Paper>
  );
}
