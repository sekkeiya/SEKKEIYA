import React, { useState, useMemo, useCallback } from "react";
import { Paper, Box, CircularProgress } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import LibrarySearchBar from "./LibrarySearchBar";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import LibraryCategoryGrid from "./LibraryCategoryGrid";
import LibraryAssetGrid from "./LibraryAssetGrid";

import { usePublicModels } from "@desktop/features/dsl/layout/hooks/usePublicModels";
import { useProjectDssModels } from "@desktop/features/dsl/layout/hooks/useProjectDssModels";
import { useWorkspaceModelRefs } from "@desktop/features/dsl/layout/hooks/useWorkspaceModelRefs";
import { useModelTitleMap } from "@desktop/features/dsl/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel } from "@desktop/features/dsl/layout/utils/labels/itemLabelUtils";
import { getCategoryTree, TYPES } from "@desktop/shared/data/Categories";
import { ROOT_CATEGORIES } from "./LibraryConstants";
import LightingLibraryContent from "./LightingLibraryContent";
import EnvironmentLibraryContent from "./EnvironmentLibraryContent";

function safeStr(v, fb = "") {
  return typeof v === "string" && v.trim() ? v : fb;
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
    if (path.length > 0) {
      const rootNode = path[0];
      list = list.filter(m => {
        const t = getModelType(m);
        if (rootNode.type && t !== rootNode.type) return false;
        if (rootNode.subType) {
          const st = getModelSubType(m);
          if (st && st !== rootNode.subType) return false;
        }
        return true;
      });
    }

    if (path.length > 1) {
      const groupNode = path[1];
      if (groupNode.label !== "ALL") {
        list = list.filter(m => {
          const mg = getModelGroupLabel(m);
          return mg && (mg === groupNode.label || mg.includes(groupNode.label) || groupNode.label.includes(mg));
        });
      }
    }

    return list.slice(0, 240);
  }, [modelsByTab, q, path, makeSearchText]);

  // Derived Grid Logic
  const getLevel1Groups = useCallback(() => {
    if (path.length === 0) return [];
    const rootNode = path[0];
    const tree = getCategoryTree(rootNode.type, rootNode.subType || "default");
    const groups = Object.keys(tree || {}).map(g => ({
       id: g, label: g 
    }));
    return [{ id: "ALL", label: "ALL" }, ...groups];
  }, [path]);

  // View Routing
  const currentLevel = path.length;

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
             {q.trim() !== "" ? (
                // If searching, jump straight to asset grid matching
                <LibraryAssetGrid
                  models={filteredModels}
                  modelTitleMap={modelTitleMap}
                  planIds={planIds}
                  tab={tab}
                />
             ) : currentLevel === 0 ? (
                // Level 0: Roots
                <LibraryCategoryGrid
                   items={ROOT_CATEGORIES}
                   columns={2}
                   onClick={(item) => {
                     pushPath({ level: 1, id: item.id, label: item.label, type: item.type, subType: item.subType });
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
