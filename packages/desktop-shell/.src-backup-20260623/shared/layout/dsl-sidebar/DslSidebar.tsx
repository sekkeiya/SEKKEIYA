import React, { useState, useMemo } from 'react';
import { Box, Typography, CardActionArea, IconButton, InputBase, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Divider } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import { useAppStore, type DslScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Menu, MenuItem, Collapse, CircularProgress } from '@mui/material';
import { useWorkspaceLayouts } from '../../../features/dsl/layout/hooks/useWorkspaces';
import { useDslWorkspaceContextStore, dslWorkspaceContextKey } from '../../../features/dsl/layout/store/useDslWorkspaceContextStore';

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (e?: React.MouseEvent) => void;
  color?: string;
  onRenameClick?: () => void;
  onDeleteClick?: () => void;
  rightIcon?: React.ReactNode;
  renderActions?: React.ReactNode;
  hasToggle?: boolean;
  expanded?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
}

function ScopeItem({ 
  icon, label, active, onClick, color, onRenameClick, onDeleteClick, rightIcon, renderActions, hasToggle, expanded, onToggle,
  isRenaming = false, renameValue = "", onRenameChange, onRenameSubmit, onRenameCancel
}: ScopeItemProps & { isRenaming?: boolean; renameValue?: string; onRenameChange?: (v: string) => void; onRenameSubmit?: () => void; onRenameCancel?: () => void; }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  return (
    <Box 
      sx={{ 
        position: "relative", mx: 1.5, my: 0.5,
        "&:hover .scope-actions": { opacity: 1 }
      }}
    >
      <Box
        onClick={!isRenaming ? onClick : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          cursor: isRenaming ? "default" : "pointer",
          bgcolor: active ? (color ? `${color}26` : "rgba(255,255,255,0.12)") : "transparent",
          border: active ? `1px solid ${color ? `${color}40` : "rgba(255,255,255,0.2)"}` : "1px solid transparent",
          "&:hover": { bgcolor: active ? (color ? `${color}33` : "rgba(255,255,255,0.18)") : "rgba(255,255,255,0.06)" },
        }}
      >
        {/* Toggle Button */}
        {hasToggle !== undefined && (
          hasToggle && !isRenaming ? (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggle?.(e); }}
              sx={{ color: "rgba(255,255,255,0.5)", p: 0.25, mr: 0.5, "&:hover": { color: "#fff" } }}
            >
              <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </IconButton>
          ) : (
            <Box sx={{ width: 24, height: 24, mr: 0.5 }} />
          )
        )}

        <Box sx={{ 
          width: 20, height: 20, borderRadius: 1.5, 
          bgcolor: color || "rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? "#fff" : "rgba(255,255,255,0.7)" } })}
        </Box>
        
        {isRenaming ? (
          <Box sx={{ flex: 1, display: "flex", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange && onRenameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onRenameSubmit && onRenameSubmit();
                if (e.key === "Escape") onRenameCancel && onRenameCancel();
              }}
              onBlur={() => onRenameSubmit && onRenameSubmit()}
              style={{
                width: "100%",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid #00BFFF",
                backgroundColor: "rgba(0,0,0,0.4)",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
              }}
            />
          </Box>
        ) : (
          <Typography sx={{ 
            color: active ? "#ffffff" : "rgba(255,255,255,0.7)", 
            fontSize: 12, fontWeight: active ? 600 : 500,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
          }}>
            {label}
          </Typography>
        )}
        {!isRenaming && rightIcon}
      </Box>

      {!isRenaming && (onRenameClick || onDeleteClick) && (
        <>
          <IconButton 
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            size="small"
            sx={{ 
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              opacity: 0, transition: "opacity 0.2s",
              ".MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded='true']": { opacity: 1 },
              color: "rgba(255,255,255,0.5)", "&:hover": { color: "#fff" }
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
            PaperProps={{ sx: { bgcolor: "#1a1e27", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2 } }}
          >
            {onRenameClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(); }} sx={{ color: "#fff", fontSize: 13 }}>
                名前を変更
              </MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(); }} sx={{ color: "#ff4d4f", fontSize: 13 }}>
                プロジェクトを削除
              </MenuItem>
            )}
          </Menu>
        </>
      )}

      {!isRenaming && renderActions && (
        <Box
            className="scope-actions"
            sx={{ 
              position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
              opacity: 0, transition: "opacity 0.2s",
              display: "flex", gap: 0.5,
              "&:hover": { opacity: 1 },
            }}
            onClick={(e) => { e.stopPropagation(); }}
        >
          {renderActions}
        </Box>
      )}
    </Box>
  );
}

function ProjectLayoutAccordion({ 
  project, 
  active, 
  expanded,
  onSelect,
  onRenameClick,
  onDeleteClick,
  onLayoutSelect,
  isRenaming = false,
  renameValue = "",
  onRenameChange,
  onRenameSubmit,
  onRenameCancel
}: { 
  project: any, active: boolean, expanded: boolean, onSelect: () => void, 
  onRenameClick: () => void, onDeleteClick: () => void, 
  onLayoutSelect: (layoutId: string) => void,
  isRenaming?: boolean, renameValue?: string, onRenameChange?: (v: string) => void, onRenameSubmit?: () => void, onRenameCancel?: () => void
}) {
  const { currentUser } = useAuthStore();
  const { panelSelections } = useAppStore();
  const activeDslLayoutId = panelSelections?.layout?.selectedLayoutId || panelSelections?.layout?.optionId || panelSelections?.layout?.planId;
  // 作業中コンテキスト（このプロジェクトの layout ワークスペース）
  const workCtx = useDslWorkspaceContextStore((s) => s.byWorkspace[dslWorkspaceContextKey(project.id, 'layout')]);
  const workingBaseId = workCtx?.baseId ?? null;

  const [isProjectExpanded, setIsProjectExpanded] = useState(expanded);

  const toggleProject = (e?: any) => {
    e?.stopPropagation();
    setIsProjectExpanded(prev => !prev);
  }

  // Fetch only if expanded to save Firestore reads
  const { layouts: allLayouts, loading } = useWorkspaceLayouts(isProjectExpanded ? project.id : null, isProjectExpanded ? 'layout' : null);

  // The flat `layouts` collection also contains Plan/Option docs. The project
  // navigation tree only shows up to Base level; Plan/Option are managed in the
  // dedicated dashboard inside the 3DSL editor.
  const layouts = useMemo(
    () => (allLayouts || []).filter((l: any) => {
      const t = l?.planType;
      return !t || t === 'base' || t === 'layout';
    }),
    [allLayouts]
  );

  const [creating, setCreating] = useState(false);

  // States for rename/delete dialogs
  const [renamePlanId, setRenamePlanId] = useState<string | null>(null);
  const [renamePlanValue, setRenamePlanValue] = useState("");
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null);
  const [deletePlanName, setDeletePlanName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const getNextName = (list: any[], prefix: string) => {
    const nums = list.map((o) => String(o?.name || "")).map((s) => {
        const m = s.match(new RegExp(`^${prefix}(\\d+)$`, "i")) || s.match(new RegExp(`^${prefix} (\\d+)$`, "i")) || s.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
        return m ? Number(m[1]) : NaN;
    }).filter((n) => Number.isFinite(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix} ${max + 1}`;
  };

  const handleCreateLayout = async (e: any) => {
    e.stopPropagation();
    if (!currentUser || creating || isProcessing) return;
    setCreating(true);
    setIsProcessing(true);
    try {
      const layoutName = getNextName(layouts, "Layout");
      const { createStructureNode } = await import('../../../features/dsl/layout/utils/workspaceStubs');

      // 1. Base ノードを作成
      const baseNode = await createStructureNode({
        projectId: project.id,
        workspaceId: 'layout',
        userId: currentUser.uid,
        name: layoutName,
        planType: 'base',
      });

      // 2. Plan 1 を自動作成（Plan 自体が編集可能なレイアウト。Option は手動作成）
      const planNode = await createStructureNode({
        projectId: project.id,
        workspaceId: 'layout',
        userId: currentUser.uid,
        name: 'Plan 1',
        planType: 'plan',
        rootBaseId: baseNode.id,
      });

      // Base を選択状態にし、作業中コンテキストを新しい Base / Plan 1 に設定する
      onLayoutSelect(baseNode.id);
      useDslWorkspaceContextStore.getState().setContext(project.id, 'layout', {
        baseId: baseNode.id,
        planId: planNode.id,
        optionId: null,
        baseName: layoutName,
        planName: 'Plan 1',
        optionName: null,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
      setIsProcessing(false);
    }
  };

  const handleRenamePlanSubmit = async () => {
    if (!renamePlanId || !renamePlanValue.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const { updateLayoutInfo } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await updateLayoutInfo(project.id, 'layout', renamePlanId, { name: renamePlanValue.trim() });
      setRenamePlanId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeletePlanSubmit = async () => {
    if (!deletePlanId || isProcessing) return;
    setIsProcessing(true);
    try {
      const { deleteLayout } = await import('../../../features/dsl/layout/utils/workspaceStubs');
      await deleteLayout(project.id, 'layout', deletePlanId);
      
      if (activeDslLayoutId === deletePlanId) {
        useAppStore.getState().setPanelSelection("layout", null);
        try {
            const { useWorkspaceStructureStore } = await import('../../../features/dsl/layout/store/useWorkspaceStructureStore');
            useWorkspaceStructureStore.getState().setSelectedPlanId(null);
            
            const { useUiSelectionStore } = await import('../../../features/dsl/layout/store/uiSelectionStore');
            useUiSelectionStore.getState().setSelectedItemIds([]);
            useUiSelectionStore.getState().setSelectedItemId(null);
        } catch (e) {
            console.warn("Failed to clear legacy store:", e);
        }
      }

      setDeletePlanId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{ mb: isProjectExpanded ? 1 : 0 }}>
      <ScopeItem 
        icon={<ShapeLineRoundedIcon />} 
        label={project.name} 
        active={active}
        onClick={() => onSelect()} 
        onRenameClick={onRenameClick}
        onDeleteClick={onDeleteClick}
        hasToggle={true}
        expanded={isProjectExpanded}
        onToggle={toggleProject}
        isRenaming={isRenaming}
        renameValue={renameValue}
        onRenameChange={onRenameChange}
        onRenameSubmit={onRenameSubmit}
        onRenameCancel={onRenameCancel}
      />
      <Collapse in={isProjectExpanded}>
        <Box sx={{ pl: 3, pr: 1.5, position: 'relative' }}>
          {/* Vertical line connector */}
          <Box sx={{ position: 'absolute', left: 23, top: 0, bottom: 12, width: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          {loading ? (
             <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
               {[1, 2].map(i => (
                 <Box key={i} sx={{ position: 'relative', mb: 0.5, display: 'flex', alignItems: 'center', px: 1.25, py: 0.75 }}>
                   <Box sx={{ position: 'absolute', left: -1, top: 16, width: 8, height: '1px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                   <Box sx={{ width: 24, height: 24, mr: 0.5 }} />
                   <Box sx={{ width: 20, height: 20, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.05)', mr: 1 }} />
                   <Box sx={{ height: 12, width: '60%', bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 1 }} />
                 </Box>
               ))}
             </Box>
          ) : (
            <>
              {layouts.map((layout: any) => {
                const isWorkingBase = workingBaseId === layout.id;
                const isOptionActive = activeDslLayoutId === layout.id || isWorkingBase;

                return (
                  <Box key={layout.id} sx={{ position: 'relative', mb: 0.5 }}>
                    <Box sx={{ position: 'absolute', left: -1, top: 16, width: 8, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                    <ScopeItem
                      icon={<ShapeLineRoundedIcon />}
                      label={layout.name || 'Untitled Layout'}
                      active={isOptionActive}
                      onClick={(e) => {
                        e?.stopPropagation();
                        onLayoutSelect(layout.id);
                      }}
                      color="#00BFFF"
                      hasToggle={false}
                      isRenaming={renamePlanId === layout.id}
                      renameValue={renamePlanValue}
                      onRenameChange={setRenamePlanValue}
                      onRenameSubmit={handleRenamePlanSubmit}
                      onRenameCancel={() => setRenamePlanId(null)}
                      renderActions={
                        <>
                          <IconButton 
                            size="small" 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setRenamePlanValue(layout.name || ''); 
                              setRenamePlanId(layout.id); 
                            }}
                            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            onClick={(e) => { 
                              e.stopPropagation();
                              setDeletePlanName(layout.name || ''); 
                              setDeletePlanId(layout.id); 
                            }}
                            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#ff4d4f' } }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </>
                      }
                    />
                    {/* 作業中の Plan / Option を表示 */}
                    {isWorkingBase && (workCtx?.planName || workCtx?.optionName) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 4.5, mt: 0.25 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#00BFFF', flexShrink: 0 }} />
                        <Typography
                          sx={{ fontSize: 10, color: 'rgba(0,191,255,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          作業中: {workCtx?.planName || 'Plan'}{workCtx?.optionName ? ` ▸ ${workCtx.optionName}` : ''}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}
              <Box sx={{ position: 'relative', mt: 0.5 }}>
                 <Box sx={{ position: 'absolute', left: -1, top: '50%', width: 8, height: '1px', bgcolor: 'rgba(255,255,255,0.1)' }} />
                 <CardActionArea 
                   onClick={handleCreateLayout}
                   disabled={creating}
                   sx={{ 
                     display: 'flex', alignItems: 'center', py: 0.75, px: 1, ml: 1, borderRadius: 1.5,
                     '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }, opacity: creating ? 0.5 : 1
                   }}

                 >
                   <AddRoundedIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', mr: 1 }} />
                   <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                     新規レイアウト追加
                   </Typography>
                 </CardActionArea>
              </Box>
            </>
          )}
        </Box>
      </Collapse>

      {/* Delete Dialog */}
      {deletePlanId && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>削除の確認</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              「{deletePlanName}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setDeletePlanId(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleDeletePlanSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const DslSidebar: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const { currentUser } = useAuthStore();
  const { 
    projects, 
    setProjects,
    activeProjectId, 
    setActiveProjectId, 
    isProjectSidebarOpen,
    dslScope,
    setDslScope,
    setGlobalDslHub,
    setPanelSelection
  } = useAppStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim()) return;
    try {
      setIsProcessing(true);
      await renameProject(activeRenameProject.id, renameValue);
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (e) {
      console.error("Failed to rename project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeleteProject) return;
    try {
      setIsProcessing(true);
      await deleteProject(activeDeleteProject.id);
      setProjects(projects.filter(p => p.id !== activeDeleteProject.id));
      if (activeProjectId === activeDeleteProject.id) setActiveProjectId(null);
      setActiveDeleteProject(null);
    } catch (e) {
      console.error("Failed to delete project:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
        isTeam: createProjectType === 'team',
      });
      // Update global store
      setProjects([newProject as any, ...projects]);
      
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      
      // Select the new project immediately
      setActiveProjectId(newProject.id);
      setDslScope('project_layouts');

      // Refresh from server to sync 
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const { myProjects, teamProjects } = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !query || p.name?.toLowerCase().includes(query));
    
    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter(p => p.ownerId !== currentUser?.uid || p.isTeam)
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const handleScopeSelect = (scope: DslScope) => {
    setDslScope(scope);
    setGlobalDslHub(); // Switch to Hub view without kicking user to Project Home
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDslScope(isTeam ? 'team_project_layouts' : 'project_layouts');
    setActiveProjectId(projectId);
    setPanelSelection('layout', { baseId: undefined, planId: undefined, optionId: undefined });
  };

  const handleLayoutSelect = (projectId: string, layoutId: string, isTeam: boolean) => {
    setDslScope(isTeam ? 'team_project_layouts' : 'project_layouts');
    setActiveProjectId(projectId);
    // These top-level nav entries are Bases — open the editor at that Base.
    setPanelSelection('layout', { selectedLayoutId: layoutId, baseId: layoutId, planId: undefined, optionId: undefined });

    // 作業中コンテキストへ反映。同じ Base を再選択した場合は Plan/Option を維持し、
    // 別の Base を開く場合はリセットしてエディタ側で先頭 Plan を選ばせる。
    const ctxStore = useDslWorkspaceContextStore.getState();
    const prev = ctxStore.byWorkspace[dslWorkspaceContextKey(projectId, 'layout')];
    if (prev?.baseId === layoutId) {
      ctxStore.setContext(projectId, 'layout', { baseId: layoutId });
    } else {
      ctxStore.setContext(projectId, 'layout', {
        baseId: layoutId, planId: null, optionId: null,
        baseName: null, planName: null, optionName: null,
      });
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid rgba(255,255,255,0.05)` : 'none',
        display: "flex",
        flexDirection: "column",
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
        transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s",
      }}
    >
      <Box sx={{ px: 2, mb: 1 }}>
        {!hideHeader && (
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", mb: 1.5 }}>
            3D SHAPE LAYOUT
          </Typography>
        )}

        {/* Search Input */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgba(255,255,255,0.05)',
          '&:focus-within': { borderColor: 'rgba(255,255,255,0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 1 }} />
          <InputBase 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: '#fff', fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Global Scopes */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Layouts"
            active={dslScope === 'global_layouts' || dslScope === 'global_following_layouts'}
            onClick={() => handleScopeSelect('global_following_layouts')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dslScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem 
            icon={<PublicRoundedIcon />} 
            label="Public Layouts" 
            active={dslScope === 'my_public_layouts'} 
            onClick={() => handleScopeSelect('my_public_layouts')} 
            color="#9b59b6"
          />
          <ScopeItem 
            icon={<LockRoundedIcon />} 
            label="Private Layouts" 
            active={dslScope === 'my_private_layouts'} 
            onClick={() => handleScopeSelect('my_private_layouts')} 
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              My Projects
            </Typography>
            <Tooltip title="Create Project" placement="top">
              <IconButton 
                size="small" 
                onClick={() => { setCreateProjectType('my'); setIsCreateDialogOpen(true); }}
                sx={{ color: "rgba(255,255,255,0.5)", '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, width: 20, height: 20 }}
              >
                <AddRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {myProjects.map(p => (
            <ProjectLayoutAccordion 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId && dslScope === 'project_layouts'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, false)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onLayoutSelect={(layoutId) => handleLayoutSelect(p.id, layoutId, false)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>
              Team Projects
            </Typography>
            <Tooltip title="Create Project" placement="top">
              <IconButton 
                size="small" 
                onClick={() => { setCreateProjectType('team'); setIsCreateDialogOpen(true); }}
                sx={{ color: "rgba(255,255,255,0.5)", '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, width: 20, height: 20 }}
              >
                <AddRoundedIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          {teamProjects.map(p => (
            <ProjectLayoutAccordion 
              key={p.id} 
              project={p} 
              active={p.id === activeProjectId && dslScope === 'team_project_layouts'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, true)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onLayoutSelect={(layoutId) => handleLayoutSelect(p.id, layoutId, true)}
            />
          ))}
        </Box>

      </Box>

      {/* Create Project Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: '#0f172a', backgroundImage: 'none', color: '#fff', border: `1px solid rgba(255,255,255,0.1)`, minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {createProjectType === 'my' ? '新規マイプロジェクト作成' : '新規チームプロジェクト作成'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {createProjectType === 'my' 
              ? '個人用の新しいプロジェクトを作成します。' 
              : 'チームのメンバーと共有するための新しいプロジェクトを作成します。'}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="プロジェクト名"
            type="text"
            fullWidth
            variant="outlined"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            disabled={isCreating}
            InputProps={{ style: { color: '#fff' } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "#1a1e27", p: 4, borderRadius: 3, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Typography variant="h6" sx={{ color: "#fff", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: "rgba(255,255,255,0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "#fff" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
