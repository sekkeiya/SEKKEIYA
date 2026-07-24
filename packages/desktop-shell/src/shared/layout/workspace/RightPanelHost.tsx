import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Accordion, AccordionSummary, AccordionDetails, Divider, TextField, Chip, Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch, useMediaQuery } from '@mui/material';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../../store/useAppStore';
import { WorkspaceItemRepository } from '../../../features/workspace/WorkspaceItemRepository';
import { DssRightPanel } from '../../../features/dss/components/DssRightPanel';
import { DscRightPanel } from '../../../features/dsc/components/DscRightPanel';
import { DsdRightPanel } from '../../../features/dsd/components/DsdRightPanel';
import { updateLayoutInfo } from '../../../features/dsl/layout/utils/workspaceStubs';
import { updateRenderDoc } from '../../../features/dsl/layout/api/layoutRendersApi';

import { useUiRightSidebarStore } from '../../../features/dsl/layout/store/uiRightSidebarStore';
import { useDspStore } from '../../../features/dsp/store/useDspStore';
import { DslFilterPanel } from '../../../features/dsl/DslFilterPanel';
import { useDslFilterStore } from '../../../features/dsl/store/useDslFilterStore';
import { usePlanOptions } from '../../../features/dsl/layout/hooks/usePlanOptions';
import { useBasePlans } from '../../../features/dsl/layout/hooks/useBasePlans';
import { useWorkspaceStructureStore } from '../../../features/dsl/layout/store/useWorkspaceStructureStore';
import { useDslWorkspaceContextStore } from '../../../features/dsl/layout/store/useDslWorkspaceContextStore';

export const RightPanelHost: React.FC = () => {
  const activeProjectId = useAppStore((s: any) => s.activeProjectId);
  const activeWorkspaceId = useAppStore((s: any) => s.activeWorkspaceId);
  const lastActiveAppScope = useAppStore((s: any) => s.lastActiveAppScope);
  // 全幅ヘッダー化: デスクトップの S.Model(3dss) は右の Search & Filter / Model Info を
  // DssDashboard 内へ埋め込むため、外部の右パネルは出さない（モバイルは従来どおり）。
  const isMobileRightPanel = useMediaQuery('(max-width:768px)');
  const selectedItem = useAppStore((s: any) => activeWorkspaceId ? s.panelSelections[activeWorkspaceId] : null);
  const setPanelSelection = useAppStore((s: any) => s.setPanelSelection);
  const panelSelections = useAppStore((s: any) => s.panelSelections);
  const selectedLayoutId = panelSelections?.['layout']?.selectedLayoutId || panelSelections?.['layout']?.optionId || panelSelections?.['layout']?.planId;

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({ name: '', type: '', category: '', tags: [], visibility: 'private' });
  const [tagInput, setTagInput] = useState('');
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  // Sync editData when selection changes
  useEffect(() => {
    if (selectedItem) {
      setEditData({
        name: selectedItem.title || selectedItem.name || 'Untitled',
        type: selectedItem.type || selectedItem.itemType || 'Unknown',
        category: selectedItem.mainCategory || (Array.isArray(selectedItem.categoryPath) ? selectedItem.categoryPath[0] : '') || '',
        tags: Array.isArray(selectedItem.tags) ? [...selectedItem.tags] : [],
        visibility: selectedItem.visibility || 'private'
      });
      setIsEditing(false); // reset on selection change
      setTagInput('');
    }
  }, [selectedItem]);

  const handleSave = async () => {
    if (!selectedItem) return;
    const activeScope = activeWorkspaceId ? lastActiveAppScope : 'sekkeiya';
    const isGlobalAsset = activeScope === '3dss' && !selectedItem.assetRef;
    
    try {
      if (isGlobalAsset) {
        await WorkspaceItemRepository.updateGlobalAsset(selectedItem.id, {
          title: editData.name,
          name: editData.name,
          type: editData.type,
          mainCategory: editData.category,
          tags: editData.tags,
          visibility: editData.visibility
        });
      } else {
        if (!activeProjectId || !activeWorkspaceId) throw new Error("Missing project context for item update.");
        await WorkspaceItemRepository.updateItem(activeProjectId, activeWorkspaceId, selectedItem.id, {
          title: editData.name,
          name: editData.name,
          type: editData.type
        });
      }
      setIsEditing(false);
    } catch (err) {
      alert('Failed to update item: ' + err);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    const confirm = window.confirm('Are you sure you want to delete this item?');
    if (!confirm) return;
    
    const activeScope = activeWorkspaceId ? lastActiveAppScope : 'sekkeiya';
    const isGlobalAsset = activeScope === '3dss' && !selectedItem.assetRef;
    const targetWorkspaceId = activeWorkspaceId || 'global';
    
    try {
      if (isGlobalAsset) {
        await WorkspaceItemRepository.deleteGlobalAsset(selectedItem.id);
      } else {
        if (!activeProjectId || !activeWorkspaceId) throw new Error("Missing project context for item deletion.");
        await WorkspaceItemRepository.deleteItem(activeProjectId, activeWorkspaceId, selectedItem.id);
      }
      setPanelSelection(targetWorkspaceId, null);
    } catch (err) {
      alert('Failed to delete item: ' + err);
    }
  };

  const handleOpenMasterViewer = () => {
    window.alert('Initializing Master Viewer (Native WebGL). \n\n[Mock Preview]: The selected asset would now load in a high-performance 3D environment for inspection or Rhinoceros sync.');
  };

  // Map workspace ID to App Scope reliably
  let computedScope = lastActiveAppScope || 'sekkeiya';
  if (!activeWorkspaceId) computedScope = 'sekkeiya';
  else if (activeWorkspaceId === 'layout') computedScope = '3dsl';
  else if (activeWorkspaceId === 'share') computedScope = '3dss';
  else if (activeWorkspaceId === 'presents') computedScope = '3dsp';
  else if (activeWorkspaceId === 'canvas') computedScope = 'canvas';
  else if (activeWorkspaceId === 'create') computedScope = '3dsc';
  else if (activeWorkspaceId === 'diagram') computedScope = '3dsd';
  else if (activeWorkspaceId === 'movie') computedScope = '3dsm';

  const scope = String(computedScope).toLowerCase();

  const dslVisibleSections = useUiRightSidebarStore((s: any) => s.visibleSections);
  const hasDslPanels = dslVisibleSections && dslVisibleSections.length > 0;

  const showDspRightSidebar = useDspStore((s) => s.showRightSidebar);
  const dspActiveTab = useDspStore((s) => s.inspectorActiveTopTab);
  const dspScope = useAppStore((s: any) => s.dspScope);
  const dscShellMode = useAppStore((s: any) => s.dscShellMode);
  // NOTE: these hooks MUST be called before any early return to avoid React hooks count mismatch.
  const dsdShellMode = useAppStore((s: any) => s.dsdShellMode);
  const dssShellMode = useAppStore((s: any) => s.dssShellMode);
  const isDslDashboard = scope === '3dsl' && !selectedLayoutId;
  const is3dslWorkspace = scope === '3dsl' && !isDslDashboard;

  const isVisible = scope !== 'sekkeiya'
    && (!is3dslWorkspace || hasDslPanels)
    && (scope !== '3dsp' || showDspRightSidebar)
    && (scope !== '3dsp' || isMobileRightPanel) // デスクトップの S.Slide は右パネルを DspDashboard 内へ埋め込むため外部は非表示
    && (scope !== '3dsc' || dscShellMode === 'dashboard')
    && (scope !== '3dsc' || isMobileRightPanel) // デスクトップの S.Create は右パネルを DscDashboard 内へ埋め込むため外部は非表示
    && (scope !== '3dsd' || dsdShellMode === 'dashboard') // エディタ中は非表示
    && (scope !== '3dsd' || isMobileRightPanel) // デスクトップの S.Diagram は右パネルを DsdDashboard 内へ埋め込むため外部は非表示
    && (scope !== '3dss' || dssShellMode === 'dashboard') // S.Model エディタ中は Search & Filter を非表示
    && (scope !== '3dss' || isMobileRightPanel) // デスクトップの S.Model は右パネルを DssDashboard 内へ埋め込むため外部は非表示
    && (scope !== '3dsl' || isMobileRightPanel) // デスクトップの S.Layout は右パネルを中央(DslDashboard/LayoutShell)内へ埋め込むため外部は非表示
    && scope !== '3dsi' // S.Image は自前の詳細パネルを持つため汎用プロパティは非表示
    && scope !== '3dsf' // S.Portfolio も自前の詳細パネル（ポートフォリオ情報）を持つため非表示
    && scope !== '3dsr' // S.Drawing も自前の図面情報パネルを持つため汎用プロパティは不要
    && scope !== '3dsq' // S.Quest は学習カタログのため汎用プロパティは不要
    && scope !== '3dsk' // S.Library も自前の詳細パネル（要約・紐付け）を持つため汎用プロパティは不要
    && scope !== '3dsb' // S.Blog はエディタ内に自前の記事設定サイドバーを持つため汎用プロパティは不要
    && scope !== '3dsm' // S.Movie も自前のプロパティ／シーケンス情報パネルを持つため汎用プロパティは不要
    && scope !== '3dsmt'; // S.Material も自前の素材情報パネルをダッシュボード内に持つため不要

  const setAiTaskInnerRight = useAppStore((s: any) => s.setAiTaskInnerRight);
  useEffect(() => {
    // isVisible=false のときは触らない（各サブアプリのダッシュボードが自身の幅を登録する）
    if (!isVisible) return;
    setAiTaskInnerRight(320);
    return () => setAiTaskInnerRight(0);
  }, [isVisible, setAiTaskInnerRight]);

  // If we are on the project overview, hide the right panel.
  if (scope === 'sekkeiya') {
    return null;
  }

  const renderSectionHeader = (title: string) => (
    <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block', mb: 1 }}>
      {title}
    </Typography>
  );
  const is3dss = scope === '3dss';
  const is3dsd = scope === '3dsd';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ width: 0, opacity: 0, x: 20 }}
          animate={{ width: 320, opacity: 1, x: 0 }}
          exit={{ width: 0, opacity: 0, x: 30 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          style={{ 
            flexShrink: 0, 
            backgroundColor: 'light-dark(rgba(255, 255, 255, 0.85), rgba(10, 15, 25, 0.6))',
            borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
          {is3dss ? (
            <Box sx={{ p: 2 }}>
              <DssRightPanel />
            </Box>
          ) : is3dsd ? (
            <>
              <Box sx={{ px: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  S.Diagram プロパティ
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
                <DsdRightPanel />
              </Box>
            </>
          ) : scope === '3dsl' && !isDslDashboard ? (
            <>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  S.Layout Workspace
                </Typography>
              </Box>
              <Box
                id="dsl-right-sidebar-portal"
                ref={(el) => useUiRightSidebarStore.getState().setPortalElement(el as HTMLElement | null)}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {/* Fallback styling when portal is empty */}
                <style>{`
                  #dsl-right-sidebar-portal:empty::before {
                    content: "S.Layout Workspace";
                    display: block;
                    padding: 16px;
                    color: light-dark(#742e7f, #ce93d8);
                    font-size: 0.75rem;
                  }
                  #dsl-right-sidebar-portal:empty::after {
                    content: "Loading layout tools or fallback properties...";
                    display: block;
                    padding: 0 16px;
                    color: rgb(var(--brand-fg-rgb) / 0.5);
                    font-size: 0.875rem;
                  }
                `}</style>
              </Box>
            </>
          ) : scope === '3dsp' ? (
            <>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {dspScope === 'my_templates' ? 'テンプレート詳細' : dspActiveTab === 'properties' ? 'プロパティ' : dspActiveTab === 'deck' ? 'デッキテンプレート' : dspActiveTab === 'parts' ? 'パーツテンプレート' : 'レイヤー'}
                </Typography>
              </Box>
              <Box 
                id="dsp-right-sidebar-portal" 
                sx={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  minHeight: 0,
                  overflow: 'hidden',
                  position: 'relative'
                }} 
              >
                {/* Fallback styling when portal is empty */}
                <style>{`
                  #dsp-right-sidebar-portal:empty::before {
                    content: "S.Slide ワークスペース";
                    display: block;
                    padding: 16px;
                    color: light-dark(#0775a6, #29b6f6);
                    font-size: 0.75rem;
                  }
                  #dsp-right-sidebar-portal:empty::after {
                    content: "要素を選択するとプロパティが表示されます...";
                    display: block;
                    padding: 0 16px;
                    color: rgb(var(--brand-fg-rgb) / 0.5);
                    font-size: 0.875rem;
                  }
                `}</style>
              </Box>
            </>
          ) : scope === '3dsc' ? (
            <>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  S.Create プロパティ
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'hidden', overflowY: 'auto' }}>
                <DscRightPanel />
              </Box>
            </>
          ) : scope === '3dsl' && isDslDashboard ? (
            <DslDashboardRightPanel
              selectedItem={panelSelections['layout']}
              updatingVisibility={updatingVisibility}
              setUpdatingVisibility={setUpdatingVisibility}
              setPanelSelection={setPanelSelection}
            />
          ) : (
            <>
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {scope} プロパティ
                </Typography>
              </Box>

      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {selectedItem ? (
          <>
            {/* General Info Section */}
            <Box>
              {renderSectionHeader('基本情報')}
              <Box sx={{ p: 2, bgcolor: 'rgba(144,202,249,0.05)', borderRadius: 2, border: '1px solid rgba(144,202,249,0.1)' }}>
                {isEditing ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 1 }}>
                    <TextField 
                      label="Name" 
                      variant="outlined" 
                      size="small" 
                      fullWidth 
                      value={editData.name}
                      onChange={e => setEditData({ ...editData, name: e.target.value })}
                      InputProps={{ sx: { color: 'var(--brand-fg)' } }}
                      InputLabelProps={{ sx: { color: 'text.secondary' } }}
                    />
                    <TextField 
                      label="Type" 
                      variant="outlined" 
                      size="small" 
                      fullWidth 
                      value={editData.type}
                      onChange={e => setEditData({ ...editData, type: e.target.value })}
                      InputProps={{ sx: { color: 'var(--brand-fg)' } }}
                      InputLabelProps={{ sx: { color: 'text.secondary' } }}
                    />

                    {scope === '3dss' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                        <FormControl fullWidth size="small" variant="outlined">
                          <InputLabel sx={{ color: 'text.secondary' }}>Category</InputLabel>
                          <Select
                            value={editData.category}
                            label="Category"
                            onChange={e => setEditData({ ...editData, category: e.target.value })}
                            sx={{ color: 'var(--brand-fg)', '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}
                          >
                            <MenuItem value="">Uncategorized</MenuItem>
                            <MenuItem value="Furniture">Furniture</MenuItem>
                            <MenuItem value="Lighting">Lighting</MenuItem>
                            <MenuItem value="Decor">Decor</MenuItem>
                            <MenuItem value="Avatar">Avatar</MenuItem>
                            <MenuItem value="Architecture">Architecture</MenuItem>
                          </Select>
                        </FormControl>

                        <Box>
                          <TextField 
                            label="Add Tag (Press Enter)" 
                            variant="outlined" 
                            size="small" 
                            fullWidth 
                            value={tagInput}
                            onChange={e => setTagInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                e.preventDefault();
                                if (!editData.tags.includes(tagInput.trim())) {
                                  setEditData({ ...editData, tags: [...editData.tags, tagInput.trim()] });
                                }
                                setTagInput('');
                              }
                            }}
                            InputProps={{ sx: { color: 'var(--brand-fg)' } }}
                            InputLabelProps={{ sx: { color: 'text.secondary' } }}
                          />
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                            {editData.tags.map((tag: string) => (
                              <Chip 
                                key={tag} 
                                label={tag} 
                                size="small" 
                                onDelete={() => setEditData({ ...editData, tags: editData.tags.filter((t: string) => t !== tag) })}
                                sx={{ height: 24, fontSize: 11, bgcolor: 'rgba(156,39,176,0.3)', color: 'light-dark(#742e7f, #ce93d8)' }} 
                              />
                            ))}
                          </Box>
                        </Box>

                        <FormControlLabel
                          control={
                            <Switch 
                              size="small" 
                              checked={editData.visibility === 'public'} 
                              onChange={e => setEditData({ ...editData, visibility: e.target.checked ? 'public' : 'private' })}
                              color="secondary"
                            />
                          }
                          label={<Typography variant="body2" color="text.secondary">Public Visibility</Typography>}
                          sx={{ m: 0 }}
                        />
                      </Box>
                    )}
                  </Box>
                ) : (
                  <>
                    <Typography variant="subtitle1" color="text.primary" sx={{ mb: 1, fontWeight: 600 }}>
                      {selectedItem.title || selectedItem.name || (selectedItem.props ? `Canvas Item (${selectedItem.type})` : 'Untitled')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      <b>ID:</b> {selectedItem.id}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                      <b>Type:</b> {selectedItem.type || selectedItem.itemType || 'Unknown'}
                    </Typography>
                    
                    {/* Render Canvas Shape Props (Read-only) */}
                    {scope === 'canvas' && selectedItem.props && (
                      <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Shape Properties</Typography>
                        {Object.entries(selectedItem.props).map(([k, v]) => (
                          <Typography key={k} variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                            <b>{k}:</b> {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : JSON.stringify(v)}
                          </Typography>
                        ))}
                      </Box>
                    )}

                    {selectedItem.createdAt && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                        <b>Created:</b> {new Date(selectedItem.createdAt).toLocaleString()}
                      </Typography>
                    )}
                    {selectedItem.updatedAt && (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        <b>Updated:</b> {new Date(selectedItem.updatedAt).toLocaleString()}
                      </Typography>
                    )}

                    {/* Version Info for Pinned Items */}
                    {selectedItem.pinnedVersion && (
                      <Box sx={{ mt: 1.5, p: 1.5, bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <b>Version:</b> 
                          <Chip size="small" label={`v${selectedItem.pinnedVersion}`} sx={{ height: 20, fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' }} />
                        </Typography>
                        {selectedItem.isOutdated && (
                          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="caption" sx={{ color: 'light-dark(#ad6700, #ffb74d)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <span style={{ fontSize: 16 }}>⚠️</span> 最新バージョン (v{selectedItem.latestVersion}) が利用可能です
                            </Typography>
                            <Button 
                              size="small" 
                              variant="contained" 
                              fullWidth
                              sx={{ bgcolor: '#ff9800', color: '#000', '&:hover': { bgcolor: '#f57c00' }, fontSize: 11, fontWeight: 600 }}
                              onClick={async () => {
                                if (!activeProjectId || !activeWorkspaceId) return;
                                try {
                                  await WorkspaceItemRepository.updateItem(activeProjectId, activeWorkspaceId, selectedItem.id, {
                                    pinnedVersion: selectedItem.latestVersion
                                  });
                                  alert('最新バージョンに更新しました');
                                } catch (e) {
                                  alert('更新に失敗しました: ' + e);
                                }
                              }}
                            >
                              最新版に更新する
                            </Button>
                          </Box>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </Box>

            {/* 3DSS Specific Metadata Section */}
            {scope === '3dss' && (
              <Box>
                {renderSectionHeader('Model Details')}
                <Box sx={{ p: 2, bgcolor: 'rgba(156,39,176,0.05)', borderRadius: 2, border: '1px solid rgba(156,39,176,0.1)' }}>
                  {/* Tags */}
                  {Array.isArray(selectedItem.tags) && selectedItem.tags.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Tags</Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {selectedItem.tags.map((t: string) => (
                          <Chip key={t} label={t} size="small" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(156,39,176,0.15)', color: 'light-dark(#742e7f, #ce93d8)' }} />
                        ))}
                      </Box>
                    </Box>
                  )}
                  {/* Category */}
                  {(selectedItem.mainCategory || (Array.isArray(selectedItem.categoryPath) && selectedItem.categoryPath.length > 0)) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Category</Typography>
                      <Typography variant="body2" sx={{ color: 'light-dark(#742e7f, #ce93d8)' }}>
                        {Array.isArray(selectedItem.categoryPath) ? selectedItem.categoryPath.join(' > ') : selectedItem.mainCategory}
                      </Typography>
                    </Box>
                  )}
                  {/* Geometry Stats */}
                  {(selectedItem.metadata?.vertices || selectedItem.vertices || selectedItem.metadata?.triangles || selectedItem.triangles) && (
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>Geometry</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {(selectedItem.metadata?.vertices || selectedItem.vertices) && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Vertices: <span style={{ color: 'light-dark(#742e7f, #ce93d8)' }}>{selectedItem.metadata?.vertices || selectedItem.vertices}</span>
                          </Typography>
                        )}
                        {(selectedItem.metadata?.triangles || selectedItem.triangles) && (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Triangles: <span style={{ color: 'light-dark(#742e7f, #ce93d8)' }}>{selectedItem.metadata?.triangles || selectedItem.triangles}</span>
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )}
                  {/* No specific metadata fallback */}
                  {(!selectedItem.tags?.length && !selectedItem.mainCategory && !selectedItem.categoryPath?.length && !selectedItem.vertices && !selectedItem.triangles && !selectedItem.metadata?.vertices) && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      No extended metadata available.
                    </Typography>
                  )}
                </Box>
              </Box>
            )}

            {/* Asset Linkages Section */}
            {selectedItem.assetRef && (
              <Box>
                {renderSectionHeader('Asset Linkages')}
                <Box sx={{ p: 2, bgcolor: 'rgba(76,175,80,0.05)', borderRadius: 2, border: '1px solid rgba(76,175,80,0.1)' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                    <b>Linked Asset:</b><br />
                    <span style={{ color: 'light-dark(#357838, #81c784)' }}>{selectedItem.assetRef}</span>
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Actions Section */}
            <Box>
              {renderSectionHeader('Actions')}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {isEditing ? (
                  <>
                    <Button variant="contained" color="primary" size="small" fullWidth onClick={handleSave}>
                      Save Changes
                    </Button>
                    <Button variant="outlined" size="small" fullWidth onClick={() => setIsEditing(false)} sx={{ color: 'text.secondary', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="outlined" size="small" fullWidth onClick={() => setIsEditing(true)} sx={{ justifyContent: 'flex-start', color: 'light-dark(#095fa5, #90caf9)', borderColor: 'rgba(144,202,249,0.3)' }}>
                    Edit Properties
                  </Button>
                )}
                
                {scope === '3dss' && !isEditing && (
                  <Button variant="outlined" size="small" fullWidth onClick={handleOpenMasterViewer} sx={{ justifyContent: 'flex-start', color: 'light-dark(#742e7f, #ce93d8)', borderColor: 'rgba(206,147,216,0.3)' }}>
                    Open in Master Viewer
                  </Button>
                )}
                
                {scope === '3dsl' && !isEditing && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    fullWidth 
                    onClick={() => useAppStore.getState().setDslShellMode('canvas')}
                    sx={{ justifyContent: 'flex-start', color: 'light-dark(#a80637, #fa709a)', borderColor: 'rgba(250,112,154,0.3)' }}
                  >
                    Open in Native Canvas
                  </Button>
                )}

                {scope === '3dsp' && !isEditing && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    fullWidth 
                    onClick={() => useAppStore.getState().setDspShellMode('editor')}
                    sx={{ justifyContent: 'flex-start', color: 'light-dark(#0775a6, #29b6f6)', borderColor: 'rgba(41, 182, 246, 0.3)' }}
                  >
                    スライドエディタで開く
                  </Button>
                )}

                {!isEditing && (
                  <Button variant="outlined" color="error" size="small" fullWidth onClick={handleDelete} sx={{ justifyContent: 'flex-start', opacity: 0.8 }}>
                    アイテムを削除
                  </Button>
                )}
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

            {/* Raw Data Section */}
            <Box>
              <Accordion sx={{ bgcolor: 'transparent', boxShadow: 'none', '&:before': { display: 'none' } }}>
                <AccordionSummary sx={{ p: 0, minHeight: 'auto', '& .MuiAccordionSummary-content': { my: 1 } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'underline', cursor: 'pointer' }}>
                    開発者用生データを表示
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <Box component="pre" sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.4)', borderRadius: 1, fontSize: 11, color: 'light-dark(#095fa5, #90caf9)', overflowX: 'auto', maxHeight: 250 }}>
                    {JSON.stringify(selectedItem, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', mb: 2 }}>
              アイテムを選択するとプロパティが表示されます。
            </Typography>
            
            {scope === '3dss' && (
              <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)' }}>
                <Typography variant="caption" color="primary">S.Model ワークスペース</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>プロジェクトを選択するとモデルと関連情報がここに表示されます。</Typography>
              </Box>
            )}

            {/* 3dsl fallback is now handled via top-level shortcircuit */}

            {scope === '3dsp' && (
              <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)' }}>
                <Typography variant="caption" color="info.main">S.Slide Workspace</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Slide transitions, camera angles, and presentation script controls.</Typography>
              </Box>
            )}

            {scope === '3dsc' && (
              <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)' }}>
                <Typography variant="caption" color="warning.main">S.Create Workspace</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Generative parameters, style prompts, and mesh exports.</Typography>
              </Box>
            )}

            {scope === 'canvas' && (
              <Box sx={{ p: 2, bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 1, border: '1px dashed rgb(var(--brand-fg-rgb) / 0.1)' }}>
                <Typography variant="caption" sx={{ color: 'light-dark(#009cad, #00e5ff)' }}>AI Canvas</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>Select a shape, image, or zone on the canvas to view and edit its properties.</Typography>
              </Box>
            )}
          </>
        )}
      </Box>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ── 3DSL ダッシュボード右パネル ──────────────────────────────────────
export function DslDashboardRightPanel({
  selectedItem,
  updatingVisibility,
  setUpdatingVisibility,
  setPanelSelection,
}: {
  selectedItem: any;
  updatingVisibility: boolean;
  setUpdatingVisibility: (v: boolean) => void;
  setPanelSelection: (key: string, val: any) => void;
}) {
  const { selectedRender, setSelectedRender } = useDslFilterStore();
  const [renderUpdating, setRenderUpdating] = useState(false);

  // 選択中アイテムが Plan の場合、その配下の Option を購読して一覧表示する。
  const selectedType = selectedItem ? (selectedItem.planType ?? selectedItem.type) : null;
  const isPlanSelected = selectedType === 'plan';
  // Base（躯体）選択中：base / layout（旧形式）/ planType 未設定はすべて Base 扱い。
  const isBaseSelected = !!selectedItem && (selectedType === 'base' || selectedType === 'layout' || !selectedType);
  const { options: planOptions } = usePlanOptions(
    selectedItem?.projectId,
    selectedItem?.workspaceId || 'layout',
    isPlanSelected ? selectedItem?.id : null,
    isPlanSelected && !selectedRender,
  );
  // Base 選択中：その Base 配下の Plan（インテリア）を購読して一覧表示する。
  const { plans: basePlans } = useBasePlans(
    selectedItem?.projectId,
    selectedItem?.workspaceId || 'layout',
    isBaseSelected ? selectedItem?.id : null,
    isBaseSelected && !selectedRender,
  );

  const handleOpenPlan = (baseId: string, planId: string) => {
    if (!baseId || !planId) return;
    // クリックした Plan を「最後の Plan」に記録 → openLayout がその Plan を開く
    useDslWorkspaceContextStore.getState().setLastPlanForBase(baseId, planId);
    if (selectedItem?.projectId) useAppStore.getState().setActiveProjectId(selectedItem.projectId);
    useWorkspaceStructureStore.getState().openLayout(baseId);
  };

  // レンダリング選択中
  if (selectedRender) {
    const isCycles = selectedRender.quality === 'cycles';
    const isVideo = selectedRender.type === 'video';
    const isPublic = selectedRender.visibility === 'public';

    const handleVisibilityToggle = async (checked: boolean) => {
      const newVis = checked ? 'public' : 'private';
      if (!selectedRender.projectId || !selectedRender.workspaceId || !selectedRender.planId || !selectedRender.id) return;
      setRenderUpdating(true);
      try {
        await updateRenderDoc(
          { projectId: selectedRender.projectId, workspaceId: selectedRender.workspaceId, planId: selectedRender.planId },
          selectedRender.id,
          { visibility: newVis },
        );
        setSelectedRender({ ...selectedRender, visibility: newVis });
      } catch (err) {
        console.error('[DSL] render visibility update failed:', err);
      } finally {
        setRenderUpdating(false);
      }
    };

    return (
      <>
        <Box sx={{ px: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
            {isVideo ? '動画情報' : '静止画情報'}
          </Typography>
        </Box>
        <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {/* Thumbnail */}
          <Box sx={{ width: '100%', aspectRatio: '16/9', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', overflow: 'hidden' }}>
            {selectedRender.url
              ? <img src={selectedRender.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.2)', fontSize: 11 }}>No Preview</Typography>
                </Box>}
          </Box>

          <Box>
            <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.7)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', mb: 0.5 }}>Shot</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-fg)' }}>{selectedRender.shotName || selectedRender.id}</Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Quality</Typography>
              <Box sx={{ px: 1, py: 0.25, borderRadius: 0.75, background: isCycles ? 'rgba(167,139,250,0.2)' : 'rgba(108,135,255,0.18)' }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: isCycles ? 'light-dark(#2705a9, #c4b5fd)' : 'light-dark(#0029ad, #9db4ff)' }}>{isCycles ? 'Cycles' : '標準'}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>解像度</Typography>
              <Typography sx={{ fontSize: 12, color: 'light-dark(rgba(31,41,55,0.7), rgba(229,231,235,0.7))' }}>{selectedRender.width}×{selectedRender.height}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>レイアウト</Typography>
              <Typography sx={{ fontSize: 12, color: '#00BFFF', textAlign: 'right', maxWidth: 140 }}>{selectedRender.planName}</Typography>
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />

          {/* 公開設定 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.25 }}>公開設定</Typography>
              <Typography sx={{ fontSize: 12, color: isPublic ? 'light-dark(#a80637, #fa709a)' : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                {isPublic ? '公開中' : '非公開'}
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={isPublic}
              disabled={renderUpdating}
              onChange={(e) => handleVisibilityToggle(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: 'light-dark(#a80637, #fa709a)' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(250,112,154,0.5)' },
              }}
            />
          </Box>
        </Box>
      </>
    );
  }

  // レイアウト選択中
  if (selectedItem) {
    return (
      <>
        <Box sx={{ px: 2, display: 'flex', alignItems: 'center', height: 48, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', flexShrink: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
            レイアウト情報
          </Typography>
        </Box>
        <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Thumbnail */}
          <Box sx={{ width: '100%', aspectRatio: '1 / 1', bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', mb: 2 }}>
            {selectedItem.thumbnailUrl
              ? <img src={selectedItem.thumbnailUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: 11, fontWeight: 500 }}>No Preview Available</Typography>}
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', display: 'block', mb: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>名前</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: 'var(--brand-fg)', lineHeight: 1.4 }}>{selectedItem.title || selectedItem.name || 'Untitled Layout'}</Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

          {selectedItem.updatedAt && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>更新日時</Typography>
              <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                {new Date(selectedItem.updatedAt?.toDate ? selectedItem.updatedAt.toDate() : selectedItem.updatedAt).toLocaleDateString('ja-JP')}
              </Typography>
            </Box>
          )}

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>公開設定</Typography>
              <Typography sx={{ fontSize: 12, color: selectedItem.visibility === 'public' ? 'light-dark(#a80637, #fa709a)' : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                {selectedItem.visibility === 'public' ? '公開中' : '非公開'}
              </Typography>
            </Box>
            <Switch
              size="small"
              checked={selectedItem.visibility === 'public'}
              disabled={updatingVisibility}
              onChange={async (e) => {
                const newVis = e.target.checked ? 'public' : 'private';
                const pid = selectedItem.projectId;
                const wid = selectedItem.workspaceId || 'layout';
                if (!pid || !wid) return;
                setUpdatingVisibility(true);
                try {
                  await updateLayoutInfo(pid, wid, selectedItem.id, { visibility: newVis });
                  setPanelSelection('layout', { ...selectedItem, projectId: pid, workspaceId: wid, visibility: newVis });
                } catch (err) {
                  console.error('[DSL] visibility update failed:', err);
                } finally {
                  setUpdatingVisibility(false);
                }
              }}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: 'light-dark(#a80637, #fa709a)' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: 'rgba(250,112,154,0.5)' },
              }}
            />
          </Box>

          <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />

          {/* プラン一覧（Base 選択中のみ）。この躯体で作成したインテリア案をサムネ付きで表示 */}
          {isBaseSelected && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  プラン
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.5)' }}>{basePlans.length}</Typography>
              </Box>
              {basePlans.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.45)', lineHeight: 1.5, mb: 2 }}>
                  プランはまだありません。エディタで家具を配置するとプランが作成されます。
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
                  {basePlans.map((plan) => (
                    <Box
                      key={plan.id}
                      onClick={() => handleOpenPlan(selectedItem.id, plan.id)}
                      title={plan.name || plan.title || plan.id}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.25,
                        p: 0.75, borderRadius: 1.5, cursor: 'pointer',
                        border: '1px solid rgba(0,191,255,0.18)',
                        bgcolor: 'rgba(0,191,255,0.04)',
                        transition: 'border-color 0.15s, background 0.15s',
                        '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' },
                      }}
                    >
                      {/* サムネイル */}
                      <Box sx={{ position: 'relative', width: 64, height: 40, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
                        {plan.thumbnailUrl
                          ? <Box component="img" src={plan.thumbnailUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ fontSize: 8, color: 'rgb(var(--slate-ink-rgb) / 0.45)' }}>No Image</Typography>
                            </Box>}
                      </Box>
                      {/* 名前・更新日時 */}
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plan.name || plan.title || 'Untitled Plan'}
                        </Typography>
                        {(plan.updatedAt || plan.createdAt) && (
                          <Typography sx={{ fontSize: 10, color: 'rgb(var(--slate-ink-rgb) / 0.5)', mt: '1px' }}>
                            {new Date((plan.updatedAt ?? plan.createdAt)?.toDate
                              ? (plan.updatedAt ?? plan.createdAt).toDate()
                              : (plan.updatedAt ?? plan.createdAt)).toLocaleDateString('ja-JP')}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />
            </>
          )}

          {/* オプション一覧（Plan 選択中のみ）。マテリアル検討などのバリエーション */}
          {isPlanSelected && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  オプション
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.5)' }}>{planOptions.length}</Typography>
              </Box>
              {planOptions.length === 0 ? (
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.45)', lineHeight: 1.5, mb: 2 }}>
                  オプションはまだありません。エディタでマテリアルなどの検討を始めると追加できます。
                </Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.75, mb: 2 }}>
                  {planOptions.map((opt) => (
                    <Box
                      key={opt.id}
                      title={opt.name || opt.title || opt.id}
                      sx={{
                        borderRadius: 1, overflow: 'hidden', border: '1px solid rgba(244,114,182,0.25)',
                        bgcolor: 'rgba(244,114,182,0.05)',
                      }}
                    >
                      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))' }}>
                        {opt.thumbnailUrl
                          ? <Box component="img" src={opt.thumbnailUrl} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ fontSize: 9, color: 'light-dark(rgba(161,13,90,0.5), rgba(244,114,182,0.5))' }}>Option</Typography>
                            </Box>}
                      </Box>
                      <Typography sx={{ px: 0.75, py: 0.5, fontSize: 10, fontWeight: 600, color: 'light-dark(#a10d5a, #f472b6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.name || opt.title || 'Option'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />
            </>
          )}

          {/* このレイアウトの画像・動画（生成物）。管理は S.Image に集約しているため、ここは“このレイアウト由来の一覧” */}
          {Array.isArray(selectedItem.dslRenders) && selectedItem.dslRenders.length > 0 && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 10, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  画像・動画
                </Typography>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--slate-ink-rgb) / 0.5)' }}>{selectedItem.dslRenders.length}</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75, mb: 2 }}>
                {selectedItem.dslRenders.map((r: any) => (
                  <Box
                    key={r.id}
                    onClick={() => setSelectedRender(r)}
                    title={r.shotName || r.id}
                    sx={{
                      position: 'relative', aspectRatio: '1 / 1', borderRadius: 1, overflow: 'hidden', cursor: 'pointer',
                      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', bgcolor: 'light-dark(rgba(15,23,42,0.1), rgba(0,0,0,0.3))',
                      '&:hover': { borderColor: '#00BFFF' },
                    }}
                  >
                    {r.url
                      ? <Box component="img" src={r.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : null}
                    {r.type === 'video' && (
                      <PlayCircleOutlineRoundedIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 20, color: 'rgb(var(--brand-fg-rgb) / 0.9)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
                    )}
                  </Box>
                ))}
              </Box>
              <Button
                variant="text" size="small" fullWidth
                onClick={() => {
                  const app = useAppStore.getState();
                  if (selectedItem.projectId) { app.setActiveProjectId(selectedItem.projectId); app.setDsiScope('project_images'); }
                  app.setLastActiveAppScope('3dsi');
                  app.setActiveWorkspaceId('image');
                  app.setCurrentMainView('workspace');
                }}
                sx={{ justifyContent: 'center', color: 'rgba(236,64,122,0.9)', fontSize: 11, mb: 2, '&:hover': { color: '#ec407a', background: 'rgba(236,64,122,0.08)' } }}
              >
                S.Image で画像・動画を管理
              </Button>
              <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }} />
            </>
          )}

        </Box>
      </>
    );
  }

  // 未選択 → フィルターパネル
  return <DslFilterPanel />;
}
