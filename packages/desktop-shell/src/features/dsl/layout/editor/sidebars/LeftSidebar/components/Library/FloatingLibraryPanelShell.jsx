import React, { useState, useMemo, useCallback, useEffect } from "react";
import { 
  Paper, Box, CircularProgress, alpha, useTheme, 
  List, ListItemButton, ListItemIcon, ListItemText, Collapse,
  Typography, TextField, InputAdornment, ButtonGroup, Button, IconButton,
  Select, MenuItem, FormControl, InputLabel, ToggleButton, ToggleButtonGroup
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import GridViewIcon from '@mui/icons-material/GridView';

import LibraryAssetGrid from "./LibraryAssetGrid";
import LightingLibraryContent from "./LightingLibraryContent";
import EnvironmentLibraryContent from "./EnvironmentLibraryContent";

import { usePublicModels } from "../../../../../hooks/usePublicModels";
import { useProjectDssModels } from "../../../../../hooks/useProjectDssModels";
import { useWorkspaceModelRefs } from "../../../../../hooks/useWorkspaceModelRefs";
import { useModelTitleMap } from "../../../../../hooks/useModelTitleMap";
import { getItemDisplayLabel } from "../../../../../utils/labels/itemLabelUtils";
import { ROOT_CATEGORIES, getIconForGroup } from "./LibraryConstants";
import { useWorkspaceStructureStore } from "../../../../../store/useWorkspaceStructureStore";
import { useUserSettingsStore } from "../../../../../../../../store/useUserSettingsStore";
import { BRAND } from "../../../../../../../../styles/theme";

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

// 正典（DEFAULT_CATEGORY_MAP）の3階層 macroCategory / mainCategory / subCategory で分類する。
// 旧モデル（macroCategory 未保存）は legacy フィールドからマクロを推定する。
function getModelMacro(m) {
  const mc = safeStr(m?.macroCategory, "");
  if (mc) return mc;
  const hay = [m?.type, m?.modelType, m?.categoryType, m?.mainCategory, m?.category]
    .map((v) => safeStr(v).toLowerCase()).join(" ");
  if (hay.includes("architecture") || hay.includes("建築") || hay.includes("建具") || hay.includes("構造") || hay.includes("躯体") || hay.includes("外構")) return "建築・空間";
  if (hay.includes("造作")) return "家具 (造作)";
  if (hay.includes("照明") || hay.includes("設備") || hay.includes("家電") || hay.includes("水回り")) return "設備・備品";
  if (hay.includes("グリーン") || hay.includes("観葉") || hay.includes("植")) return "グリーン";
  if (hay.includes("小物") || hay.includes("ファブリック") || hay.includes("装飾") || hay.includes("カーテン") || hay.includes("ラグ")) return "インテリア小物";
  return "家具 (既製品)";
}

function getModelMain(m) {
  return safeStr(m?.mainCategory, "") || safeStr(m?.subType, "");
}

function getModelDetail(m) {
  return safeStr(m?.subCategory, "") || safeStr(m?.userCategory, "") || safeStr(m?.group, "");
}

// Extract tags across all models
function getUniqueTags(models) {
  const tags = new Set();
  models.forEach(m => {
    safeArray(m.tags).forEach(t => {
      const clean = safeStr(t).trim();
      if (clean) tags.add(clean);
    });
  });
  return Array.from(tags).sort();
}

export default function FloatingLibraryPanelShell({ projectId, workspaceId, planId }) {
  const theme = useTheme();

  // Base/Plan で表示カテゴリを切替（context: 'plan'=家具配置時 / 'base'=躯体時 / 'both'=両方）
  const selectedPlanId = useWorkspaceStructureStore((s) => s.selectedPlanId);
  const selectedOptionId = useWorkspaceStructureStore((s) => s.selectedOptionId);
  const isPlanContext = !!selectedPlanId || !!selectedOptionId;
  const visibleRootCategories = useMemo(() => (
    ROOT_CATEGORIES.filter((c) => {
      if (c.context === "both") return true;
      return isPlanContext ? c.context === "plan" : c.context === "base";
    })
  ), [isPlanContext]);

  // 正典カテゴリマップ（S.Model Settings と同一ソース）。Firestore 同期を購読して再計算。
  const systemCategories = useUserSettingsStore((s) => s.systemCategories);
  const hiddenCats = useUserSettingsStore((s) => s.hiddenSystemDetailedCategories);
  const getMergedCategoryMap = useUserSettingsStore((s) => s.getMergedCategoryMap);
  const categoryMap = useMemo(
    () => getMergedCategoryMap(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [systemCategories, hiddenCats, getMergedCategoryMap]
  );

  // State
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [cardSize, setCardSize] = useState("default");
  
  // activeFolder looks like: { level: 0 } (all), { level: 1, type, subType, label }, { level: 2, type, subType, groupLabel }
  const [activeFolder, setActiveFolder] = useState({ level: 0 });
  const [expandedRoots, setExpandedRoots] = useState({});

  // Fetching Data
  const { models: publicModels, loading: publicLoading } = usePublicModels({ enabled: true, limit: 1000 });
  const { models: projectModels, loading: projectLoading } = useProjectDssModels({ projectId, enabled: Boolean(projectId), limit: 1000 });
  const { planModelIds } = useWorkspaceModelRefs({ projectId, workspaceId, planId, enabled: Boolean(projectId && workspaceId) });
  
  const planIds = useMemo(() => safeSet(planModelIds), [planModelIds]);
  const loadingAny = publicLoading || projectLoading;

  const modelsByTab = useMemo(() => {
    return tab === "project" ? safeArray(projectModels) : safeArray(publicModels);
  }, [publicModels, projectModels, tab]);

  const neededModelIds = useMemo(() => {
    const set = new Set();
    for (const m of modelsByTab) {
      if (m?.id) set.add(m.id);
    }
    return Array.from(set);
  }, [modelsByTab]);

  const modelTitleMap = useModelTitleMap(neededModelIds);
  const availableTags = useMemo(() => ["ALL", ...getUniqueTags(modelsByTab)], [modelsByTab]);

  const makeSearchText = useCallback((m) => {
    const modelId = safeStr(m?.id, "");
    const displayName = getItemDisplayLabel({ id: modelId, modelId, name: m?.name, title: m?.title }, modelTitleMap);
    const parts = [
      displayName, m?.brand, m?.ownerHandle, modelId,
      m?.macroCategory, m?.mainCategory, m?.subCategory, m?.userCategory,
      m?.type, m?.subType, m?.group, m?.categoryGroup, m?.category, ...safeArray(m?.tags)
    ].filter(Boolean).map(s => safeStr(s).toLowerCase());
    return parts.join(" ");
  }, [modelTitleMap]);

  // Filtered Models
  const filteredModels = useMemo(() => {
    let list = modelsByTab;

    if (q) {
      const s = String(q).trim().toLowerCase();
      list = list.filter((m) => makeSearchText(m).includes(s));
    }
    
    if (selectedTag && selectedTag !== "ALL") {
      list = list.filter(m => safeArray(m.tags).some(t => safeStr(t) === selectedTag));
    }

    if (activeFolder.level > 0 && activeFolder.macro) {
      list = list.filter(m => {
        // マクロ（家具既製品 / 建築・空間 等）で一致
        if (getModelMacro(m) !== activeFolder.macro) return false;
        // サブグループ（mainCategory）指定時はそれも一致（ALL は全件）
        if (activeFolder.level === 2 && activeFolder.main && activeFolder.main !== "ALL") {
          const mm = getModelMain(m);
          if (!mm || (mm !== activeFolder.main && !mm.includes(activeFolder.main) && !activeFolder.main.includes(mm))) return false;
        }
        return true;
      });
    }

    return list.slice(0, 240); // Cap for UI performance
  }, [modelsByTab, q, selectedTag, activeFolder, makeSearchText]);

  // Handlers
  const toggleRoot = (rootId) => {
    setExpandedRoots(prev => ({ ...prev, [rootId]: !prev[rootId] }));
  };

  const handleRootClick = (rootNode) => {
    setActiveFolder({ level: 1, id: rootNode.id, macro: rootNode.macro, label: rootNode.label });
    toggleRoot(rootNode.id);
  };

  const handleSubgroupClick = (rootNode, main) => {
    setActiveFolder({ level: 2, id: rootNode.id, macro: rootNode.macro, main });
  };

  const isSelected = (level, idOrLabel) => {
    if (level === 0 && activeFolder.level === 0) return true;
    if (level === 1 && activeFolder.level === 1 && activeFolder.label === idOrLabel) return true;
    if (level === 2 && activeFolder.level === 2 && activeFolder.main === idOrLabel) return true;
    return false;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'transparent' }}>
      
      {/* HEADER TOOLBAR */}
      <Box sx={{ 
        display: 'flex', alignItems: 'center', p: 1, 
        borderBottom: `1px solid ${alpha('#fff', 0.1)}`, 
        bgcolor: 'transparent',
        gap: 2
      }}>
        {/* Search */}
        <TextField
          size="small"
          placeholder="Search models..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          sx={{ flex: 1, maxWidth: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 18 }} />
              </InputAdornment>
            ),
            sx: { height: 32, fontSize: 13, borderRadius: 1.5, bgcolor: BRAND.bg }
          }}
        />

        {/* Tab Switch */}
        <ToggleButtonGroup
          color="primary"
          value={tab}
          exclusive
          onChange={(e, val) => val && setTab(val)}
          size="small"
          sx={{ height: 32, bgcolor: BRAND.bg }}
        >
          <ToggleButton value="all" sx={{ px: 2, fontSize: 12, textTransform: 'none' }}>ALL MODELS</ToggleButton>
          <ToggleButton value="project" sx={{ px: 2, fontSize: 12, textTransform: 'none' }}>Project Models</ToggleButton>
        </ToggleButtonGroup>

        {/* Tag Filter */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            displayEmpty
            sx={{ height: 32, fontSize: 12, borderRadius: 1.5, bgcolor: BRAND.bg }}
          >
            {availableTags.map(tag => (
              <MenuItem key={tag} value={tag} sx={{ fontSize: 12 }}>
                {tag === "ALL" ? "All Tags" : tag}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Box sx={{ flex: 1 }} />
        
        {/* Size Switch */}
        <ToggleButtonGroup
          color="primary"
          value={cardSize}
          exclusive
          onChange={(e, val) => val && setCardSize(val)}
          size="small"
          sx={{ height: 32, bgcolor: BRAND.bg }}
        >
          <ToggleButton value="compact" sx={{ px: 1 }} title="Compact"><ViewCompactIcon sx={{ fontSize: 16 }} /></ToggleButton>
          <ToggleButton value="default" sx={{ px: 1 }} title="Default"><ViewModuleIcon sx={{ fontSize: 16 }} /></ToggleButton>
          <ToggleButton value="large" sx={{ px: 1 }} title="Large"><GridViewIcon sx={{ fontSize: 16 }} /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* TWO-COLUMN CONTENT */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* LEFT COLUMN: Folders */}
        <Box sx={{ 
           width: 240, 
           flexShrink: 0, 
           borderRight: `1px solid ${alpha('#fff', 0.1)}`,
           bgcolor: 'light-dark(rgba(15,23,42,0.03), rgba(0,0,0,0.1))',
           overflowY: 'auto'
        }}>
          <List component="nav" disablePadding sx={{ pt: 1 }}>
            
            <ListItemButton 
              onClick={() => setActiveFolder({ level: 0 })}
              selected={isSelected(0, null)}
              sx={{ py: 0.5, opacity: isSelected(0, null) ? 1 : 0.7 }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}><FolderIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} /></ListItemIcon>
              <ListItemText primary="All Library" primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} />
            </ListItemButton>

            {visibleRootCategories.map(root => {
              const isOpen = expandedRoots[root.id];
              // サブグループ = 正典マップのマクロ配下キー（mainCategory）。特殊パネル(macro=null)は空。
              const subgroups = root.macro ? Object.keys(categoryMap[root.macro] || {}) : [];

              const isRootSelected = isSelected(1, root.label);
              
              return (
                <React.Fragment key={root.id}>
                  <ListItemButton 
                    onClick={() => handleRootClick(root)}
                    selected={isRootSelected}
                    sx={{ py: 0.5, pl: 2, mt: 0.5, opacity: isRootSelected ? 1 : 0.8 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      {isOpen ? <FolderOpenIcon sx={{ fontSize: 16 }} /> : <FolderIcon sx={{ fontSize: 16 }} />}
                    </ListItemIcon>
                    <ListItemText primary={root.label} primaryTypographyProps={{ fontSize: 13 }} />
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleRoot(root.id); }} sx={{ p: 0.25 }}>
                      {isOpen ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
                    </IconButton>
                  </ListItemButton>
                  
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      <ListItemButton 
                        onClick={() => handleSubgroupClick(root, "ALL")}
                        selected={isSelected(2, "ALL") && activeFolder.type === root.type && activeFolder.subType === root.subType}
                        sx={{ pl: 5, py: 0.25 }}
                      >
                        <ListItemText primary="ALL" primaryTypographyProps={{ fontSize: 12, opacity: 0.7 }} />
                      </ListItemButton>
                      
                      {subgroups.map(sg => {
                        const isSgSelected = isSelected(2, sg);
                        return (
                          <ListItemButton 
                            key={sg}
                            onClick={() => handleSubgroupClick(root, sg)}
                            selected={isSgSelected}
                            sx={{ pl: 5, py: 0.25, bgcolor: isSgSelected ? alpha(theme.palette.primary.main, 0.1) : 'transparent' }}
                          >
                            <ListItemIcon sx={{ minWidth: 24, opacity: isSgSelected ? 1 : 0.5 }}>
                              {getIconForGroup(sg)}
                            </ListItemIcon>
                            <ListItemText primary={sg} primaryTypographyProps={{ fontSize: 12, opacity: isSgSelected ? 1 : 0.7 }} />
                          </ListItemButton>
                        )
                      })}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        </Box>

        {/* MAIN AREA: Models Grid */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1, position: 'relative' }}>
          {activeFolder.id === "environment" ? (
            <EnvironmentLibraryContent />
          ) : activeFolder.id === "lighting" ? (
            <LightingLibraryContent />
          ) : loadingAny ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="100%">
              <CircularProgress size={32} sx={{ color: "color-mix(in srgb, var(--brand-fg) 30%, transparent)" }} />
            </Box>
          ) : (
            filteredModels.length === 0 ? (
              <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                <Typography sx={{ opacity: 0.4, fontSize: 14 }}>No models found</Typography>
              </Box>
            ) : (
              <LibraryAssetGrid
                models={filteredModels}
                modelTitleMap={modelTitleMap}
                planIds={planIds}
                tab={tab}
                cardSize={cardSize}
              />
            )
          )}
        </Box>
        
      </Box>
    </Box>
  );
}
