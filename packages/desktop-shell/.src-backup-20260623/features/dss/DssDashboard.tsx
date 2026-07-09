import React, { useState, useMemo, useCallback } from 'react';
import { Box, Button, ButtonGroup, Typography, Dialog, Chip, Switch, Modal } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SortRoundedIcon from '@mui/icons-material/SortRounded';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
// @ts-ignore
import UploadModalContent from './upload/modal/UploadModalContent';
import { DssModelsGrid } from './DssModelsGrid';
import { DssProjectsGrid } from './DssProjectsGrid';
import { DssGroupedModelsGrid } from './DssGroupedModelsGrid';
import { buildDedupedAssetsView, buildGroupedLayoutUsageView } from './utils/dashboardViewUtils';
import { useAppStore } from '../../store/useAppStore';
import { useRhinoDragImport } from './hooks/useRhinoDragImport';
import RhinoDropZone from './components/RhinoDropZone';
import { SaveToProjectDialog } from './components/SaveToProjectDialog';
import { UserProfileDialog } from './components/UserProfileDialog';
import { DssShareDialog } from './components/DssShareDialog';
import { DssDeleteConfirmDialog } from './components/DssDeleteConfirmDialog';
import { WorkspaceItemRepository } from '../workspace/WorkspaceItemRepository';
import { DssModelDetailView } from './components/DssModelDetailView';
import { projectAssetsApi } from '../projects/api/projectAssetsApi';
import { useProjectAssetUsage } from './hooks/useProjectAssetUsage';
import { DssSetFurnitureGrid } from './components/DssSetFurnitureGrid';

const DENSITY_PRESETS = [
  { key: 'compact', label: 'Compact', value: 168 },
  { key: 'default', label: 'Default', value: 210 },
  { key: 'large', label: 'Large', value: 246 },
];

export const DssDashboard: React.FC<{
  payload: any;
  items: any[];
  isInitializing: boolean;
}> = ({ payload, items, isInitializing }) => {
  const setPanelSelection = useAppStore(s => s.setPanelSelection);
  const modelsScope = useAppStore(s => s.modelsScope);
  const selectedItem = useAppStore(s => payload?.workspaceId ? s.panelSelections[payload.workspaceId] : null);

  const scopeTitle = useMemo(() => {
    switch (modelsScope) {
      case 'global_models': return 'All Public Models';
      case 'global_projects': return 'All Public Projects';
      case 'my_public_models': return 'My Public Models';
      case 'my_private_models': return 'My Private Models';
      case 'project_models': return 'Project 3D Assets';
      case 'team_project_models': return 'Team Project 3D Assets';
      default: return '3D Models';
    }
  }, [modelsScope]);

  const [cardSize, setCardSize] = useState(210);
  const searchFilters = useAppStore(s => s.dssSearchFilters);
  const setSearchFilters = useAppStore(s => s.setDssSearchFilters);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [contentMode, setContentMode] = useState<'furniture' | 'set_furniture'>('furniture');
  const [saveToProjectModel, setSaveToProjectModel] = useState<any | null>(null);
  const [shareModel, setShareModel] = useState<any | null>(null);
  const [authorProfileModel, setAuthorProfileModel] = useState<any | null>(null);
  const [deleteModel, setDeleteModel] = useState<any | null>(null);
  const [detailModel, setDetailModel] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'assets' | 'layout'>('assets');

  // Asset Usage tracking (especially for project_models scope)
  const isProjectModelsScope = modelsScope === 'project_models' || modelsScope === 'team_project_models';
  const { usageMap } = useProjectAssetUsage({
      projectId: isProjectModelsScope ? payload?.projectId : null,
      workspaceId: 'layout'
  });

  // Close detail view when switching scopes in the left sidebar
  React.useEffect(() => {
    setDetailModel(null);
  }, [modelsScope]);

  const cardContext = useMemo(() => {
    if (modelsScope === 'my_public_models') return 'publicModels';
    if (modelsScope === 'my_private_models') return 'privateModels';
    if (modelsScope === 'project_models' || modelsScope === 'team_project_models') return 'boardModels';
    return 'models';
  }, [modelsScope]);


  const handleDeleteConfirm = async (model: any) => {
    try {
      if ((modelsScope === 'project_models' || modelsScope === 'team_project_models') && payload?.projectId) {
        // Phase 12 (SSOT): We delete the asset from the project library instead of workspace items
        await projectAssetsApi.hardDeleteAsset(payload.projectId, model.id);
        console.log('[DssDashboard] Deleted project asset:', model.id);
      } else if (payload?.workspaceId && payload?.projectId) {
        await WorkspaceItemRepository.deleteItem(payload.projectId, payload.workspaceId, model.id);
      } else {
        await WorkspaceItemRepository.deleteGlobalAsset(model.id);
      }
      // Optional: show a success toast here if desired
    } catch (err) {
      console.error('Failed to delete model:', err);
      // Optional: show an error toast here if desired
    }
  };

  // Native Rhino drag-and-drop
  const {
    isDraggingToRhino,
    openRhinoDocs,
    errorMessage,
    handleDropToRhino,
    handleCancelDrop,
    handleCardDragStart,
  } = useRhinoDragImport();

  const densityKey = useMemo(() => {
    let best = DENSITY_PRESETS[1];
    let bestDiff = Infinity;
    for (const p of DENSITY_PRESETS) {
      const d = Math.abs(p.value - cardSize);
      if (d < bestDiff) {
        best = p;
        bestDiff = d;
      }
    }
    return best.key;
  }, [cardSize]);

  const applyDensity = useCallback((key: string) => {
    const preset = DENSITY_PRESETS.find(p => p.key === key) || DENSITY_PRESETS[1];
    setCardSize(preset.value);
  }, []);

  const handleChangeSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value ?? '';
    setSearchFilters({ query: v });
  }, [setSearchFilters]);

  const handleSelectModel = useCallback((model: any) => {
    if (!payload?.workspaceId) return;
    const currentSelected = useAppStore.getState().panelSelections[payload.workspaceId];
    if (currentSelected?.id === model.id) {
      setPanelSelection(payload.workspaceId, null);
    } else {
      setPanelSelection(payload.workspaceId, model);
    }
  }, [payload?.workspaceId, setPanelSelection]);

  const handleClearSelection = useCallback(() => {
    if (payload?.workspaceId) {
      setPanelSelection(payload.workspaceId, null);
    }
  }, [payload?.workspaceId, setPanelSelection]);

  const handleDoubleClickProject = useCallback((project: any) => {
    useAppStore.getState().setViewingPublicProjectId(project.id);
    useAppStore.getState().setModelsScope('view_public_project_models');
  }, []);

  const handleBackgroundPointerDownCapture = useCallback((e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el?.closest?.('[data-right-sidebar="true"]')) return;
    if (el?.closest?.('[data-no-dismiss="true"]')) return;
    if (el?.closest?.('[data-model-card="true"]')) return;
    handleClearSelection();
  }, [handleClearSelection]);

  const handleDoubleClickModel = useCallback((model: any) => {
    setDetailModel(model);
    if (payload?.workspaceId) {
      setPanelSelection(payload.workspaceId, model);
    }
  }, [payload?.workspaceId, setPanelSelection]);

  // Pre-parse filters to avoid expensive array operations inside the loop
  const pFilter = useMemo(() => {
    const s = searchFilters;
    return {
      type: s.type,
      category: s.category,
      subCategory: s.subCategory,
      format: s.format ? String(s.format).toLowerCase() : null,
      wantsReady: s.wantsReady,
      wantsCustom: s.wantsCustom,
      tags: typeof s.tags === 'string' ? s.tags.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      buildingTypes: typeof s.buildingTypes === 'string' ? s.buildingTypes.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      rooms: typeof s.rooms === 'string' ? s.rooms.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      zones: typeof s.zones === 'string' ? s.zones.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      companionClasses: typeof s.companionClasses === 'string' ? s.companionClasses.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      materials: typeof s.materials === 'string' ? s.materials.split(/[\s,]+/).map((t: string) => t.trim().toLowerCase()).filter(Boolean) : null,
      query: s.query && typeof s.query === 'string' ? s.query.toLowerCase().trim() : null,
      layoutPaths: s.layoutPaths || []
    };
  }, [searchFilters]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    
    return items.filter(m => {
      // 0. Base Filter: only show 3D models (hide AI Drive images/PDFs from 3DSS view)
      if (m.type === 'image' || m.type === 'pdf') {
        return false;
      }

      // 1. Primary Category (Macro Category matching e.g. '家具 (既製品)')
      if (pFilter.type && pFilter.type !== 'ALL') {
        if (m.macroCategory) {
          if (m.macroCategory !== pFilter.type) return false;
        } else {
          // Fallback legacy matching
          const mt = m.modelType || (m.type !== '3d-model' ? m.type : 'Furniture');
          const isCustom = m.tags?.includes('造作家具') || m.readyStatus === 'custom';
          let derivedMacro = '家具 (既製品)';
          if (mt === 'Architecture') derivedMacro = '建築・空間';
          else if (isCustom) derivedMacro = '家具 (造作)';
          
          if (pFilter.type === '設備・備品') {
            const catStr = [m.category, m.mainCategory, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])].filter(Boolean).join(" ");
            if (!catStr.includes('設備') && !catStr.includes('備品') && !catStr.includes('機器')) return false;
          } else if (derivedMacro !== pFilter.type) {
            return false;
          }
        }
      }

      // 2. Sub Category (category = 'ソファ' etc.)
      if (pFilter.category && pFilter.category !== 'ALL') {
        const catStr = [m.category, m.mainCategory, m.categoryMain, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])]
          .filter(Boolean).join(" ");
        if (!catStr.includes(pFilter.category)) return false;
      }

      // 3. Detailed Category (subCategory = '応接テーブル' etc.)
      if (pFilter.subCategory && pFilter.subCategory !== 'ALL') {
        const subCatStr = [m.category, m.subCategory, m.userCategory, ...(Array.isArray(m.categoryPath) ? m.categoryPath : [])]
          .filter(Boolean).join(" ");
        if (!subCatStr.includes(pFilter.subCategory)) return false;
      }

      // 4. Format
      if (pFilter.format && pFilter.format !== 'all') {
        const fmtStr = `${m.format} ${m.fileFormat} ${m.metadata?.format}`.toLowerCase();
        const urlStr = `${m.downloadUrl} ${m.storagePath} ${m.downloads?.glb}`.toLowerCase();
        if (!fmtStr.includes(pFilter.format) && !urlStr.includes(`.${pFilter.format}`)) return false;
      }

      // 5. Tags and Ready Status
      const itemTagsStr = (Array.isArray(m.tags) ? m.tags.join(" ") : (m.tags || "")).toLowerCase();
      
      if (pFilter.wantsReady || pFilter.wantsCustom) {
          const hasReady = itemTagsStr.includes('既製品家具') || m.readyStatus === 'ready';
          const hasCustom = itemTagsStr.includes('造作家具') || m.readyStatus === 'custom';
          
          if (pFilter.wantsReady && pFilter.wantsCustom) {
              if (!hasReady && !hasCustom) return false;
          } else if (pFilter.wantsReady) {
              if (!hasReady) return false;
          } else if (pFilter.wantsCustom) {
              if (!hasCustom) return false;
          }
      }

      if (pFilter.tags && pFilter.tags.length > 0) {
        for (const qt of pFilter.tags) {
          if (!itemTagsStr.includes(qt)) return false; // Contains all typed tags
        }
      }

      // Extended Metadata Filters
      if (pFilter.buildingTypes && pFilter.buildingTypes.length > 0) {
        const itemBuildingTypesStr = (Array.isArray(m.buildingTypes) ? m.buildingTypes.join(" ") : (m.buildingTypes || "")).toLowerCase();
        for (const qt of pFilter.buildingTypes) {
          if (!itemBuildingTypesStr.includes(qt)) return false;
        }
      }

      if (pFilter.rooms && pFilter.rooms.length > 0) {
        const itemRoomsStr = (Array.isArray(m.rooms) ? m.rooms.join(" ") : (m.rooms || "")).toLowerCase();
        for (const qt of pFilter.rooms) {
          if (!itemRoomsStr.includes(qt)) return false;
        }
      }

      if (pFilter.zones && pFilter.zones.length > 0) {
        const itemZonesStr = (Array.isArray(m.zones) ? m.zones.join(" ") : (m.zones || "")).toLowerCase();
        for (const qt of pFilter.zones) {
          if (!itemZonesStr.includes(qt)) return false;
        }
      }

      if (pFilter.companionClasses && pFilter.companionClasses.length > 0) {
        const itemCompanionClassesStr = (Array.isArray(m.companionClasses) ? m.companionClasses.join(" ") : (m.companionClasses || "")).toLowerCase();
        for (const qt of pFilter.companionClasses) {
          if (!itemCompanionClassesStr.includes(qt)) return false;
        }
      }

      if (pFilter.materials && pFilter.materials.length > 0) {
        const itemMaterialsStr = (Array.isArray(m.materials) ? m.materials.join(" ") : (m.materials || "")).toLowerCase();
        for (const qt of pFilter.materials) {
          if (!itemMaterialsStr.includes(qt)) return false;
        }
      }

      // 6. Generic Text Query
      if (pFilter.query) {
        const hay = [
          m.title,
          m.name,
          m.brand,
          m.ownerHandle,
          m.ownerName,
          Array.isArray(m.tags) ? m.tags.join(" ") : "",
          Array.isArray(m.categoryPath) ? m.categoryPath.join(" ") : "",
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(pFilter.query)) return false;
      }

      // 7. Layout Paths (from usageMap)
      if (pFilter.layoutPaths.length > 0) {
        const usageData = usageMap ? usageMap[m.id] : null;
        if (!usageData || !usageData.locations || usageData.locations.length === 0) {
          return false; // Not in any layout, or at least not in the selected ones
        }
        
        // Find if this model is within ANY of the selected layoutPaths
        const isSelected = pFilter.layoutPaths.some((pathName: string) => 
          usageData.locations.some((loc: any) => loc.pathName === pathName)
        );
        
        if (!isSelected) {
          return false;
        }
      }

      return true;
    });
  }, [items, pFilter, usageMap]);

  const { dedupedItemsForGrid, aggregatedUsageMap } = useMemo(() => {
    if (!isProjectModelsScope) {
      return { dedupedItemsForGrid: filteredItems, aggregatedUsageMap: usageMap };
    }
    const dedupedAssets = buildDedupedAssetsView(filteredItems, usageMap);
    const aggMap: Record<string, any> = {};
    dedupedAssets.forEach(d => {
      aggMap[d.item.id] = d.usageInfo;
    });
    return {
      dedupedItemsForGrid: dedupedAssets.map(d => d.item),
      aggregatedUsageMap: aggMap
    };
  }, [isProjectModelsScope, filteredItems, usageMap]);

  const groupedLayoutAssets = useMemo(() => {
    if (!isProjectModelsScope) return [];
    return buildGroupedLayoutUsageView(filteredItems, usageMap);
  }, [isProjectModelsScope, filteredItems, usageMap]);

  console.log('[DEBUG Dashboard Layout View]', {
    viewMode,
    isProjectModelsScope,
    groupedLength: groupedLayoutAssets.length,
    groups: groupedLayoutAssets.map(g => ({ title: g.pathName, count: g.items.length }))
  });

  return (
    <Box sx={styles.root}>
      {detailModel ? (
        <DssModelDetailView 
          model={detailModel} 
          allItems={filteredItems}
          onBack={() => setDetailModel(null)} 
          onSelectRelated={(m) => {
            setDetailModel(m);
            if (payload?.workspaceId) {
              setPanelSelection(payload.workspaceId, m);
            }
          }}
          usageMap={usageMap}
        />
      ) : (
        <>
          {/* Sticky Header */}
          <Box sx={styles.stickyHeaderWrap} data-no-dismiss="true">
            <Box component="header" sx={styles.topBar}>
              <Box sx={styles.titleBlock}>
                <Box sx={styles.breadcrumb}>
                  {['global_models', 'global_following_models', 'global_projects', 'my_public_models', 'my_private_models'].includes(modelsScope) 
                    ? 'Global Asset Hub' 
                    : `Project Models / ${payload?.workspaceName || 'Overview'}`}
                </Box>
                
                {['global_models', 'global_following_models', 'global_projects', 'global_following_projects', 'view_public_project_models'].includes(modelsScope) ? (
                  <Box sx={{ display: 'flex', gap: 3, alignItems: 'baseline' }}>
                    <Typography 
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setModelsScope(['global_projects', 'global_following_projects', 'view_public_project_models'].includes(modelsScope) ? 'global_projects' : 'global_models');
                      }}
                      sx={{ 
                        fontSize: 24, fontWeight: 700, cursor: 'pointer', 
                        color: ['global_models', 'global_projects', 'view_public_project_models'].includes(modelsScope) ? '#fff' : 'rgba(255,255,255,0.4)',
                        transition: 'color 0.2s',
                        '&:hover': { color: '#fff' }
                      }}
                    >
                      Explore
                    </Typography>
                    <Typography 
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().setModelsScope(['global_projects', 'global_following_projects', 'view_public_project_models'].includes(modelsScope) ? 'global_following_projects' : 'global_following_models');
                      }}
                      sx={{ 
                        fontSize: 24, fontWeight: 700, cursor: 'pointer',
                        color: ['global_following_models', 'global_following_projects'].includes(modelsScope) ? '#fff' : 'rgba(255,255,255,0.4)',
                        transition: 'color 0.2s',
                        '&:hover': { color: '#fff' }
                      }}
                    >
                      Following
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={styles.pageTitle}>{scopeTitle}</Box>
                )}
              </Box>

              <Box sx={{ flex: 1, minWidth: 12 }} />

              <Box sx={styles.searchWrap}>
                <SearchRoundedIcon sx={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search models..."
                  style={styles.searchInput as React.CSSProperties}
                  value={searchFilters.query}
                  onChange={handleChangeSearch}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              </Box>

              <Box sx={{ flex: 1, minWidth: 12 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {isProjectModelsScope && (
                  <Box sx={styles.viewBlock}>
                    <Box sx={styles.miniLabel}>View Mode</Box>
                    <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                      <Button
                        onClick={() => setViewMode('assets')}
                        sx={viewMode === 'assets' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Assets
                      </Button>
                      <Button
                        onClick={() => setViewMode('layout')}
                        sx={viewMode === 'layout' ? styles.densityBtnActive : styles.densityBtn}
                      >
                        Layout
                      </Button>
                    </ButtonGroup>
                  </Box>
                )}

                <Box sx={styles.viewBlock}>
                  <Box sx={styles.miniLabel}>Density</Box>
                  <ButtonGroup size="small" variant="outlined" sx={styles.densityGroup}>
                  <Button
                    onClick={() => applyDensity('compact')}
                    sx={densityKey === 'compact' ? styles.densityBtnActive : styles.densityBtn}
                  >
                    Compact
                  </Button>
                  <Button
                    onClick={() => applyDensity('default')}
                    sx={densityKey === 'default' ? styles.densityBtnActive : styles.densityBtn}
                  >
                    Default
                  </Button>
                    <Button
                      onClick={() => applyDensity('large')}
                      sx={densityKey === 'large' ? styles.densityBtnActive : styles.densityBtn}
                    >
                      Large
                    </Button>
                  </ButtonGroup>
                </Box>
              </Box>
            </Box>

            {/* Active Filters Display */}
            <Box component="section" sx={{ ...styles.filterRow, minHeight: 40, py: 1 }}>
              {/* Furniture / Set Furniture tabs */}
              <Box sx={{ display: 'flex', mr: 2, borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)', flexShrink: 0 }}>
                <Button
                  size="small"
                  onClick={() => setContentMode('furniture')}
                  sx={{
                    textTransform: 'none', fontSize: 11, px: 1.5, py: 0, borderRadius: 0, height: 28, minWidth: 0,
                    bgcolor: contentMode === 'furniture' ? 'rgba(96,165,250,0.15)' : 'transparent',
                    color: contentMode === 'furniture' ? '#60a5fa' : 'rgba(148,163,184,0.7)',
                    borderRight: '1px solid rgba(148,163,184,0.15)',
                    '&:hover': { bgcolor: contentMode === 'furniture' ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.04)' },
                  }}
                >
                  Furniture
                </Button>
                <Button
                  size="small"
                  onClick={() => setContentMode('set_furniture')}
                  sx={{
                    textTransform: 'none', fontSize: 11, px: 1.5, py: 0, borderRadius: 0, height: 28, minWidth: 0,
                    bgcolor: contentMode === 'set_furniture' ? 'rgba(167,139,250,0.15)' : 'transparent',
                    color: contentMode === 'set_furniture' ? '#a78bfa' : 'rgba(148,163,184,0.7)',
                    '&:hover': { bgcolor: contentMode === 'set_furniture' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)' },
                  }}
                >
                  Set Furniture
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <AnimatePresence mode="popLayout">
                  {(!searchFilters.type || searchFilters.type === 'ALL') && !searchFilters.category && !searchFilters.subCategory && !searchFilters.format && !searchFilters.tags && !searchFilters.wantsReady && !searchFilters.wantsCustom && (
                    <motion.div key="none-applied" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>No filters applied</Typography>
                    </motion.div>
                  )}
                  
                  {searchFilters.type && searchFilters.type !== 'ALL' && (
                    <motion.div key="filter-type" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Primary: ${searchFilters.type}`} onDelete={() => setSearchFilters({type: 'ALL', category: 'ALL', subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.wantsReady && (
                    <motion.div key="filter-wantsReady" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label="既製品家具" onDelete={() => setSearchFilters({wantsReady: false})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.wantsCustom && (
                    <motion.div key="filter-wantsCustom" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label="造作家具" onDelete={() => setSearchFilters({wantsCustom: false})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.category && searchFilters.category !== 'ALL' && (
                    <motion.div key="filter-category" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Category: ${searchFilters.category}`} onDelete={() => setSearchFilters({category: 'ALL', subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.subCategory && searchFilters.subCategory !== 'ALL' && (
                    <motion.div key="filter-subcategory" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Sub: ${searchFilters.subCategory}`} onDelete={() => setSearchFilters({subCategory: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.format && searchFilters.format !== 'ALL' && (
                    <motion.div key="filter-format" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={`Format: ${searchFilters.format}`} onDelete={() => setSearchFilters({format: 'ALL'})} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  )}
                  {searchFilters.tags && typeof searchFilters.tags === 'string' && searchFilters.tags.split(/[\s,]+/).filter(Boolean).map((t: string) => (
                    <motion.div key={`filter-tag-${t}`} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}>
                      <Chip size="small" label={t} onDelete={() => {
                        const newTags = searchFilters.tags.split(/[\s,]+/).filter((tt: string) => tt !== t).join(' ');
                        setSearchFilters({tags: newTags});
                      }} sx={{ bgcolor: 'rgba(165, 214, 167, 0.1)', color: '#a5d6a7', border: '1px solid rgba(165, 214, 167, 0.3)' }} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }} />
              <Box sx={styles.actionsRight}>
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1, fontWeight: 500 }}>
                    詳細表示
                  </Typography>
                  <Switch 
                    size="small" 
                    checked={showDetails} 
                    onChange={(e) => setShowDetails(e.target.checked)} 
                    color="primary"
                  />
                </Box>
                <Button 
                  size="small" 
                  variant="contained" 
                  startIcon={<CloudUploadIcon />} 
                  sx={{ ...styles.actionBtn, bgcolor: '#29b6f6', color: '#fff', '&:hover': { bgcolor: '#0288d1' } }}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload
                </Button>
                <Button size="small" startIcon={<SortRoundedIcon />} sx={styles.actionBtn}>Sort</Button>
              </Box>
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box
            component="main"
            sx={styles.content}
            onPointerDownCapture={handleBackgroundPointerDownCapture}
          >
            <Box sx={styles.pageBodyInner} data-center-page="true">
              {contentMode === 'set_furniture' ? (
                <DssSetFurnitureGrid
                  items={items}
                  payload={payload}
                  modelsScope={modelsScope}
                  canCreate={
                    modelsScope === 'my_public_models' ||
                    modelsScope === 'my_private_models' ||
                    modelsScope === 'project_models' ||
                    modelsScope === 'team_project_models'
                  }
                />
              ) : ['global_projects', 'global_following_projects'].includes(modelsScope) ? (
                <DssProjectsGrid
                  items={filteredItems}
                  cardSize={cardSize}
                  selectedItemId={selectedItem?.id}
                  onSelectProject={handleSelectModel}
                  onDoubleClickProject={handleDoubleClickProject}
                  isInitializing={isInitializing}
                  badgeColor={payload?.themeColor}
                />
              ) : viewMode === 'layout' && isProjectModelsScope ? (
                <DssGroupedModelsGrid
                  groups={groupedLayoutAssets}
                  cardSize={cardSize}
                  selectedItemId={selectedItem?.id}
                  onSelectModel={handleSelectModel}
                  onModelDragStart={handleCardDragStart}
                  badgeColor={payload?.themeColor}
                  showDetails={showDetails}
                  cardContext={cardContext}
                  onSave={(model) => setSaveToProjectModel(model)}
                  onShare={(model) => setShareModel(model)}
                  onDelete={(model) => setDeleteModel(model)}
                  onAuthorClick={(model) => setAuthorProfileModel(model)}
                  onDoubleClick={handleDoubleClickModel}
                />
              ) : (
                <DssModelsGrid
                  items={dedupedItemsForGrid}
                  cardSize={cardSize}
                  selectedItemId={selectedItem?.id}
                  onSelectModel={handleSelectModel}
                  onModelDragStart={handleCardDragStart}
                  isInitializing={isInitializing}
                  showDetails={showDetails}
                  cardContext={cardContext}
                  onSave={(model) => setSaveToProjectModel(model)}
                  onShare={(model) => setShareModel(model)}
                  onDelete={(model) => setDeleteModel(model)}
                  onAuthorClick={(model) => setAuthorProfileModel(model)}
                  onDoubleClick={handleDoubleClickModel}
                  usageMap={aggregatedUsageMap}
                />
              )}
            </Box>
          </Box>
        </>
      )}

      {/* Rhino Drop Zone Overlay */}
      <RhinoDropZone
        open={isDraggingToRhino}
        docs={openRhinoDocs}
        errorMessage={errorMessage}
        onSelectDoc={(docId) => handleDropToRhino({ docId })}
        onClose={handleCancelDrop}
      />

      {/* Upload Dialog */}
      <Modal
        open={uploadDialogOpen}
        onClose={(_any, reason) => {
          if (reason !== 'backdropClick') {
             setUploadDialogOpen(false);
          }
        }}
      >
        <UploadModalContent open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />
      </Modal>

      {/* Save to Project Dialog */}
      <SaveToProjectDialog
        model={saveToProjectModel}
        open={!!saveToProjectModel}
        onClose={() => setSaveToProjectModel(null)}
      />

      {/* User Profile Dialog */}
      <UserProfileDialog
        authorId={authorProfileModel?.ownerId || authorProfileModel?.authorId || authorProfileModel?.id}
        authorName={authorProfileModel?.ownerName || authorProfileModel?.authorName || authorProfileModel?.author || 'Creator'}
        open={!!authorProfileModel}
        onClose={() => setAuthorProfileModel(null)}
      />

      {/* Share Dialog */}
      <DssShareDialog
        model={shareModel}
        open={!!shareModel}
        onClose={() => setShareModel(null)}
      />

      {/* Delete Confirm Dialog */}
      <DssDeleteConfirmDialog
        model={deleteModel}
        open={!!deleteModel}
        onClose={() => setDeleteModel(null)}
        onConfirm={handleDeleteConfirm}
        isBoardModels={modelsScope === 'project_models' || modelsScope === 'team_project_models'}
      />

    </Box>
  );
};

const styles = {
  root: {
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  stickyHeaderWrap: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'rgba(2,6,23,0.92)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(148,163,184,0.18)',
    minWidth: 0,
    flexShrink: 0,
  },
  topBar: {
    minHeight: 58,
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  titleBlock: {
    minWidth: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  breadcrumb: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.85)',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 760,
    letterSpacing: 0.2,
    lineHeight: 1.2,
    color: '#e2e8f0',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    padding: '7px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.30)',
    background: 'rgba(15,23,42,0.62)',
    width: 'min(560px, 100%)',
    minWidth: 220,
  },
  searchIcon: { fontSize: 18, color: 'rgba(148,163,184,0.9)' },
  searchInput: {
    width: '100%',
    minWidth: 0,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#e5e7eb',
    fontSize: 12,
  },
  viewBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  miniLabel: { fontSize: 11, color: 'rgba(148,163,184,0.85)' },
  densityGroup: {
    '& .MuiButton-root': {
      textTransform: 'none',
      borderColor: 'rgba(148,163,184,0.22)',
    },
  },
  densityBtn: {
    color: 'rgba(229,231,235,0.9)',
    background: 'rgba(15,23,42,0.32)',
    borderColor: 'rgba(148,163,184,0.22)',
    padding: '3px 10px',
    fontSize: 11,
  },
  densityBtnActive: {
    color: '#0b1220',
    background: 'rgba(96,165,250,0.9)',
    borderColor: 'rgba(96,165,250,0.9)',
    padding: '3px 10px',
    fontSize: 11,
    '&:hover': { background: 'rgba(96,165,250,0.95)' },
  },
  filterRow: {
    padding: '8px 16px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: 0,
  },
  quickFilters: { display: 'flex', gap: 1, flexWrap: 'wrap' },
  selectFilter: {
    height: 28,
    fontSize: 12,
    color: '#e2e8f0',
    background: 'rgba(15,23,42,0.62)',
    boxShadow: 'none',
    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.22)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(96,165,250,0.6)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(148,163,184,0.45)' },
    '.MuiSvgIcon-root': { color: 'rgba(148,163,184,0.85)' }
  },
  chip: {
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.28)',
    background: 'rgba(15,23,42,0.48)',
    color: '#e5e7eb',
    fontSize: 11,
    height: 28,
    '&:hover': { background: 'rgba(15,23,42,0.62)' },
  },
  dividerV: { borderColor: 'rgba(148,163,184,0.14)', mx: 0.5 },
  actionsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    flexWrap: 'wrap',
  },
  actionBtn: {
    textTransform: 'none',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.22)',
    background: 'rgba(15,23,42,0.52)',
    color: '#e5e7eb',
    fontSize: 11,
    padding: '4px 12px',
    height: 30,
    '&:hover': { background: 'rgba(15,23,42,0.70)' },
  },
  content: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    height: '100%',
  },
  pageBodyInner: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    height: '100%',
  },
};
