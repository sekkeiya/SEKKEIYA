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

import { usePublicModels } from "@desktop/features/dsl/layout/hooks/usePublicModels";
import { useProjectDssModels } from "@desktop/features/dsl/layout/hooks/useProjectDssModels";
import { useWorkspaceModelRefs } from "@desktop/features/dsl/layout/hooks/useWorkspaceModelRefs";
import { useModelTitleMap } from "@desktop/features/dsl/layout/hooks/useModelTitleMap";
import { getItemDisplayLabel } from "@desktop/features/dsl/layout/utils/labels/itemLabelUtils";
import { getCategoryTree, TYPES } from "@desktop/shared/data/Categories";
import { ROOT_CATEGORIES, getIconForGroup } from "./LibraryConstants";
import { BRAND } from "@desktop/styles/theme";

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
  return TYPES.FURNITURE;
}

function getModelSubType(m) {
  const st = safeStr(m?.subType, "") || safeStr(m?.archSubType, "") || "";
  if (st === "全体") return "建物（本体）";
  if (st === "パーツ") return "建具・部材";
  if (st === "外構") return "外構・周辺";
  if (st === "躯体") return "建物（本体）";
  return st;
}

function getModelGroupLabel(m) {
  return safeStr(m?.group, "") || safeStr(m?.categoryGroup, "") || safeStr(m?.category, "") || "";
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
      displayName, m?.brand, m?.ownerHandle, modelId, m?.type, m?.subType, m?.group, m?.categoryGroup, m?.category, ...safeArray(m?.tags)
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

    if (activeFolder.level > 0) {
      list = list.filter(m => {
        const t = getModelType(m);
        if (activeFolder.type && t !== activeFolder.type) return false;
        
        if (activeFolder.subType) {
          const st = getModelSubType(m);
          if (st && st !== activeFolder.subType) return false;
        }
        
        if (activeFolder.level === 2 && activeFolder.groupLabel && activeFolder.groupLabel !== "ALL") {
          const mg = getModelGroupLabel(m);
          if (!mg || (!mg.includes(activeFolder.groupLabel) && !activeFolder.groupLabel.includes(mg))) return false;
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
    setActiveFolder({ level: 1, id: rootNode.id, type: rootNode.type, subType: rootNode.subType, label: rootNode.label });
    toggleRoot(rootNode.id);
  };

  const handleSubgroupClick = (rootNode, groupLabel) => {
    setActiveFolder({ level: 2, type: rootNode.type, subType: rootNode.subType, groupLabel });
  };

  const isSelected = (level, idOrLabel) => {
    if (level === 0 && activeFolder.level === 0) return true;
    if (level === 1 && activeFolder.level === 1 && activeFolder.label === idOrLabel) return true;
    if (level === 2 && activeFolder.level === 2 && activeFolder.groupLabel === idOrLabel) return true;
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
                <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }} />
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
           bgcolor: 'rgba(0,0,0,0.1)',
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

            {ROOT_CATEGORIES.map(root => {
              const isOpen = expandedRoots[root.id];
              const tree = getCategoryTree(root.type, root.subType || "default");
              const subgroups = Object.keys(tree || {});
              
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
              <CircularProgress size={32} sx={{ color: alpha("#fff", 0.3) }} />
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
