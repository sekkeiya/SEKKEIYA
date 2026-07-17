import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Typography, CardActionArea, IconButton, InputBase, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Menu, MenuItem, Collapse, Divider } from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import { useAppStore, type DspScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';
import type { DesktopProject } from '../../../features/projects/types';
import { WorkFileRepository } from '../../../features/projects/workFileRepository';
import { TEMPLATES } from '../../../features/dsp/DspDashboard';
import { dspRepository } from '../../../features/dsp/api/dspRepository';
import { useDspStore } from '../../../features/dsp/store/useDspStore';

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  onRenameClick?: () => void;
  onDeleteClick?: () => void;
  expandIcon?: React.ReactNode;
  onExpandClick?: (e: React.MouseEvent) => void;
  /** プロジェクト内に未保存の作業中プレゼンがあるとき amber のドットを表示する。 */
  workingDot?: boolean;
}

function ScopeItem({ icon, label, active, onClick, color, onRenameClick, onDeleteClick, expandIcon, onExpandClick, workingDot }: ScopeItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  return (
    <Box sx={{ position: "relative", mx: 1.5, my: 0.5 }}>
      {expandIcon && (
        <IconButton 
          size="small" 
          onClick={(e) => { e.stopPropagation(); onExpandClick?.(e); }} 
          sx={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 1, p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
        >
          {expandIcon}
        </IconButton>
      )}
      <CardActionArea
        onClick={onClick}
        sx={{
          display: "flex",
          alignItems: "center",
          pl: expandIcon ? 3.5 : 1.25,
          pr: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: active ? "rgb(var(--brand-fg-rgb) / 0.08)" : "transparent",
          "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" },
        }}
      >
        <Box sx={{ 
          width: 20, height: 20, borderRadius: 1.5, 
          bgcolor: color || "rgb(var(--brand-fg-rgb) / 0.1)",
          display: "flex", alignItems: "center", justifyContent: "center", mr: 1,
          flexShrink: 0
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)" } })}
        </Box>
        <Typography sx={{
          color: active ? "var(--brand-fg)" : "rgb(var(--brand-fg-rgb) / 0.7)",
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1
        }}>
          {label}
        </Typography>
        {workingDot && (
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ffb300', flexShrink: 0, ml: 0.75, mr: 0.5, boxShadow: '0 0 4px rgba(255,179,0,0.7)' }} />
        )}
      </CardActionArea>

      {(onRenameClick || onDeleteClick) && (
        <>
          <IconButton 
            size="small"
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            sx={{
              position: "absolute",
              right: 4,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: active ? 1 : 0,
              color: "rgb(var(--brand-fg-rgb) / 0.5)",
              "&:hover": { color: "var(--brand-fg)", bgcolor: "rgb(var(--brand-fg-rgb) / 0.1)" },
              ".MuiCardActionArea-root:hover + &": { opacity: 1 }
            }}
          >
            <MoreVertIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { bgcolor: "var(--brand-surface2)", border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" } }}
          >
            {onRenameClick && (
              <MenuItem onClick={() => { setAnchorEl(null); onRenameClick(); }} sx={{ fontSize: 13, py: 1 }}>名前を変更</MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={() => { setAnchorEl(null); onDeleteClick(); }} sx={{ fontSize: 13, py: 1, color: "#ff4d4f" }}>削除</MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  );
}

import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

interface ProjectNestingItemProps {
  project: DesktopProject;
  active: boolean;
  isTeam: boolean;
  onClick: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
  onCreatePresentationClick: (project: DesktopProject) => void;
}

function ProjectNestingItem({ project, active, isTeam, onClick, onRenameClick, onDeleteClick, onCreatePresentationClick }: ProjectNestingItemProps) {
  const [expanded, setExpanded] = useState(active);
  const [presentations, setPresentations] = useState<any[]>([]);
  
  // Dialog state for Presentation items
  const [activeRenamePres, setActiveRenamePres] = useState<any | null>(null);
  const [activeDeletePres, setActiveDeletePres] = useState<any | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    setPanelSelection,
    setActiveWorkspaceId,
    setCurrentMainView,
    setLastLaunchPayload,
    setDspScope,
    setActiveProjectId,
    panelSelections
  } = useAppStore();
  const dspOpenSession = useAppStore(s => s.dspOpenSession);
  const dspWorkingSessions = useAppStore(s => s.dspWorkingSessions);

  const fetchPresentations = useCallback(() => {
    WorkFileRepository.getWorkFiles(project.id).then(files => {
      setPresentations(files.filter(f => f.appScope === '3dsp' && f.type === 'presentation'));
    }).catch(err => console.error("Failed to load presentations", err));
  }, [project.id]);

  useEffect(() => {
    if (expanded) fetchPresentations();
  }, [expanded, fetchPresentations]);

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail?.projectId === project.id && expanded) {
        fetchPresentations();
      }
    };
    window.addEventListener('dsp-presentations-updated', handleUpdate);
    return () => window.removeEventListener('dsp-presentations-updated', handleUpdate);
  }, [project.id, expanded, fetchPresentations]);

  useEffect(() => {
    if (active && !expanded) {
      setExpanded(true);
    }
  }, [active]);

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  };

  const handleRenameSubmit = async () => {
    if (!activeRenamePres || !renameValue.trim() || isProcessing) return;
    try {
      setIsProcessing(true);
      await WorkFileRepository.updateWorkFile(project.id, activeRenamePres.id, { name: renameValue.trim() });
      setPresentations(prev => prev.map(p => p.id === activeRenamePres.id ? { ...p, name: renameValue.trim() } : p));
      
      // Update global panel selection if viewing this item
      if (panelSelections['presents']?.id === activeRenamePres.id) {
         setPanelSelection('presents', { ...panelSelections['presents'], name: renameValue.trim() });
      }
      
      setActiveRenamePres(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeletePres || isProcessing) return;
    try {
      setIsProcessing(true);
      await WorkFileRepository.deleteWorkFile(project.id, activeDeletePres.id);
      setPresentations(prev => prev.filter(p => p.id !== activeDeletePres.id));

      // 退避済みセッション・作業中マーカーも破棄
      useDspStore.getState().clearSession(activeDeletePres.id);
      useAppStore.getState().setDspWorkingSession(activeDeletePres.id, null);
      if (useAppStore.getState().dspOpenSession?.workFileId === activeDeletePres.id) {
        useAppStore.getState().setDspOpenSession(null);
      }

      // Clear host state if looking at the deleted item
      if (panelSelections['presents']?.id === activeDeletePres.id) {
         // Force clear DspEditor
         setPanelSelection('presents', null);
      }

      setActiveDeletePres(null);
    } catch(err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const currentSelection = panelSelections['presents'];

  const handleCreatePresentation = () => {
    onCreatePresentationClick(project);
  };

  const handleOpenPresentation = (p: any) => {
    setDspScope(isTeam ? 'team_project_presentations' : 'project_presentations');
    setActiveProjectId(project.id);
    setPanelSelection('presents', { id: p.id, name: p.name }); 
    setLastLaunchPayload({
      projectId: project.id,
      workspaceId: 'presents',
      appScope: '3dsp'
    });
    setActiveWorkspaceId('presents');
    setCurrentMainView('workspace');
    useAppStore.getState().setDspShellMode('editor');
  };

  const projectHasWorking = dspOpenSession?.projectId === project.id
    || Object.values(dspWorkingSessions).some(s => s.projectId === project.id);

  return (
    <Box>
      <ScopeItem
        icon={<ShapeLineRoundedIcon />}
        label={project.name}
        active={active}
        workingDot={projectHasWorking && !expanded}
        onClick={() => {
          onClick();
          if (!expanded) setExpanded(true);
        }}
        onRenameClick={onRenameClick}
        onDeleteClick={onDeleteClick}
        expandIcon={expanded ? <KeyboardArrowDownRoundedIcon fontSize="small" /> : <KeyboardArrowRightRoundedIcon fontSize="small" />}
        onExpandClick={handleExpandToggle}
      />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 3.5, pr: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {presentations.map(p => {
             const isOpen = dspOpenSession?.workFileId === p.id;
             const isWorking = !!dspWorkingSessions[p.id];
             const isPresActive = isOpen || (active && currentSelection?.id === p.id);
             return (
               <Box key={p.id} sx={{ position: "relative" }}>
                 <Box
                   onClick={() => handleOpenPresentation(p)}
                   sx={{
                     display: "flex",
                     alignItems: "center",
                     px: 1,
                     py: 0.5,
                     borderRadius: 1.5,
                     cursor: "pointer",
                     bgcolor: isPresActive ? "rgba(41,182,246,0.15)" : "transparent",
                     "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.06)" },
                     "&:hover .pres-actions": { opacity: 1 }
                   }}
                 >
                   <SlideshowRoundedIcon sx={{ fontSize: 12, mr: 1, color: isPresActive ? 'light-dark(#0775a6, #29b6f6)' : 'rgb(var(--brand-fg-rgb) / 0.4)', flexShrink: 0 }} />
                   <Typography sx={{ color: isPresActive ? 'light-dark(#0775a6, #29b6f6)' : 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, fontWeight: isPresActive || isWorking ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pr: 4 }}>
                      {p.name}
                   </Typography>

                   {isWorking && (
                     <Tooltip title="作業中（未保存）" placement="top" arrow>
                       <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ffb300', flexShrink: 0, mr: 0.75, boxShadow: '0 0 4px rgba(255,179,0,0.7)' }} />
                     </Tooltip>
                   )}

                   <Box className="pres-actions" sx={{ position: 'absolute', right: 4, display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.2s', bgcolor: isPresActive ? "rgba(41,182,246,0.2)" : '#1a1e27', borderRadius: 1 }}>
                     <IconButton size="small" onClick={(e) => { e.stopPropagation(); setActiveRenamePres(p); setRenameValue(p.name); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'var(--brand-fg)' } }}>
                        <EditRoundedIcon sx={{ fontSize: 12 }} />
                     </IconButton>
                     <IconButton size="small" onClick={(e) => { e.stopPropagation(); setActiveDeletePres(p); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                     </IconButton>
                   </Box>
                 </Box>
               </Box>
             );
          })}
          
          <Box
            onClick={handleCreatePresentation}
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1,
              py: 0.75,
              borderRadius: 1.5,
              mt: 0.5,
              cursor: "pointer",
              border: '1px dashed rgb(var(--brand-fg-rgb) / 0.15)',
              "&:hover": { bgcolor: "rgb(var(--brand-fg-rgb) / 0.04)", borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 12, mr: 1, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, fontWeight: 500 }}>
               新規プレゼン作成
            </Typography>
          </Box>
        </Box>
      </Collapse>

      {/* Rename Dialog for Presentation */}
      {activeRenamePres && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プレゼンテーション名を変更</Typography>
            <InputBase
              fullWidth
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={isProcessing}
              sx={{ bgcolor: "light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))", color: "var(--brand-fg)", px: 2, py: 1, borderRadius: 2, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", mb: 3 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveRenamePres(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: "light-dark(#0775a6, #29b6f6)", fontSize: 13, cursor: isProcessing || !renameValue.trim() ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Dialog for Presentation */}
      {activeDeletePres && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プレゼンテーションを削除</Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeletePres.name}」を完全に削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeletePres(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export const DspSidebar: React.FC = () => {
  const { 
    isProjectSidebarOpen, 
    projects, 
    activeProjectId, 
    setActiveProjectId, 
    dspScope, 
    setDspScope,
    setGlobalDspHub,
    setProjects,
    setPanelSelection,
    setActiveWorkspaceId,
    setDspShellMode
  } = useAppStore();
  const { currentUser } = useAuthStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Dialogs
  const [activeRenameProject, setActiveRenameProject] = useState<DesktopProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [activeDeleteProject, setActiveDeleteProject] = useState<DesktopProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Template Creation Flow State
  const [activeTemplateDialogProject, setActiveTemplateDialogProject] = useState<DesktopProject | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);
  const [templatePresentationName, setTemplatePresentationName] = useState('');

  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim() || isProcessing) return;
    try {
      setIsProcessing(true);
      await renameProject(activeRenameProject.id, renameValue.trim());
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeleteProject || isProcessing) return;
    try {
      setIsProcessing(true);
      await deleteProject(activeDeleteProject.id);
      setProjects(projects.filter(p => p.id !== activeDeleteProject.id));
      if (activeProjectId === activeDeleteProject.id) {
        setActiveProjectId(null);
        setGlobalDspHub();
      }
      setActiveDeleteProject(null);
    } catch (err) {
      console.error(err);
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
      setProjects([newProject as any, ...projects]);
      
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      
      setActiveProjectId(newProject.id);
      setDspScope('project_presentations');

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

  const handleScopeSelect = (scope: DspScope) => {
    setDspScope(scope);
    setGlobalDspHub(); 
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDspScope(isTeam ? 'team_project_presentations' : 'project_presentations');
    setActiveProjectId(projectId);
    
    // Clear the presentation selection, route to 'presents' workspace, and ensure dashboard layout
    useAppStore.getState().setPanelSelection('presents', null);
    useAppStore.getState().setLastLaunchPayload({
      projectId,
      workspaceId: 'presents',
      appScope: '3dsp'
    });
    useAppStore.getState().setActiveWorkspaceId('presents');
    useAppStore.getState().setCurrentMainView('workspace');
    useAppStore.getState().setDspShellMode('dashboard');
  };

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: "100%",
        bgcolor: BRAND.bg,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
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
        {/* Search Input */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
          '&:focus-within': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' },
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mr: 1 }} />
          <InputBase 
            placeholder="Search projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ color: 'var(--brand-fg)', fontSize: 12, flex: 1 }}
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* Global Scopes */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Presentations"
            active={dspScope === 'global_presentations'}
            onClick={() => handleScopeSelect('global_presentations')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dspScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem 
            icon={<PublicRoundedIcon />} 
            label="Public Presents" 
            active={dspScope === 'my_public_presentations'} 
            onClick={() => handleScopeSelect('my_public_presentations')} 
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Presents"
            active={dspScope === 'my_private_presentations'}
            onClick={() => handleScopeSelect('my_private_presentations')}
            color="#e67e22"
          />
          <ScopeItem
            icon={<DashboardCustomizeRoundedIcon />}
            label="テンプレート"
            active={dspScope === 'my_templates'}
            onClick={() => handleScopeSelect('my_templates')}
            color="#29b6f6"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map(p => (
            <ProjectNestingItem 
              key={p.id} 
              project={p}
              isTeam={false}
              active={p.id === activeProjectId && dspScope === 'project_presentations'}
              onClick={() => handleProjectSelect(p.id, false)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onCreatePresentationClick={(proj) => {
                setActiveTemplateDialogProject(proj);
                setSelectedTemplate(null);
                setTemplatePresentationName('');
              }}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--brand-fg-rgb) / 0.35)", textTransform: "uppercase" }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <ProjectNestingItem 
              key={p.id} 
              project={p}
              isTeam={true}
              active={p.id === activeProjectId && dspScope === 'team_project_presentations'}
              onClick={() => handleProjectSelect(p.id, true)} 
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onCreatePresentationClick={(proj) => {
                setActiveTemplateDialogProject(proj);
                setSelectedTemplate(null);
                setTemplatePresentationName('');
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Create Project Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, minWidth: 400 } }}
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
            InputProps={{ style: { color: 'var(--brand-fg)' } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      {activeRenameProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase
              fullWidth
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              disabled={isProcessing}
              sx={{ bgcolor: "light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))", color: "var(--brand-fg)", px: 2, py: 1, borderRadius: 2, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)", mb: 3 }}
            />
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: "#00BFFF", fontSize: 13, cursor: isProcessing || !renameValue.trim() ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", bgcolor: "rgba(0,0,0,0.5)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Box sx={{ width: 400, bgcolor: "var(--brand-surface2)", p: 4, borderRadius: 3, border: "1px solid rgb(var(--brand-fg-rgb) / 0.1)" }}>
            <Typography variant="h6" sx={{ color: "var(--brand-fg)", mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: "rgb(var(--brand-fg-rgb) / 0.7)", mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: "rgb(var(--brand-fg-rgb) / 0.6)", fontSize: 13, cursor: "pointer", py: 1, '&:hover': { color: "var(--brand-fg)" } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: "#ff4d4f", fontSize: 13, cursor: isProcessing ? "not-allowed" : "pointer", py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    {/* Template Selection Dialog */}
    <Dialog 
      open={!!activeTemplateDialogProject} 
      onClose={() => !isCreating && setActiveTemplateDialogProject(null)}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: `1px solid rgb(var(--brand-fg-rgb) / 0.1)`, minHeight: 400 } }}
    >
      <DialogTitle sx={{ pb: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', mb: 2 }}>
        {!selectedTemplate ? '新しいプレゼンテーションを作成' : 'プレゼンテーションの詳細'}
      </DialogTitle>
      
      <DialogContent>
        {!selectedTemplate ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2, p: 1 }}>
            {TEMPLATES.map(t => (
              <Box
                key={t.id}
                onClick={() => {
                  setSelectedTemplate(t);
                  const dateStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '');
                  setTemplatePresentationName(`${t.title} ${dateStr}`);
                }}
                sx={{
                  bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', borderRadius: 2, p: 3,
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  '&:hover': {
                    bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
                    borderColor: t.color || 'rgb(var(--brand-fg-rgb) / 0.2)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Box sx={{ color: t.color || 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 2 }}>
                  {t.icon}
                </Box>
                <Typography sx={{ fontWeight: 600, fontSize: 14, mb: 1 }}>{t.title}</Typography>
                <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{t.description}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <Box sx={{ color: selectedTemplate.color || 'rgb(var(--brand-fg-rgb) / 0.7)', mr: 2 }}>
                {selectedTemplate.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{selectedTemplate.title}</Typography>
                <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{selectedTemplate.description}</Typography>
              </Box>
            </Box>
            <TextField
              autoFocus
              margin="dense"
              label="プレゼンテーション名"
              type="text"
              fullWidth
              variant="outlined"
              value={templatePresentationName}
              onChange={(e) => setTemplatePresentationName(e.target.value)}
              disabled={isCreating}
              InputProps={{ style: { color: 'var(--brand-fg)' } }}
              InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                  '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                  '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
                }
              }}
            />
          </Box>
        )}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, pt: 0, borderTop: selectedTemplate ? '1px solid rgb(var(--brand-fg-rgb) / 0.05)' : 'none', mt: selectedTemplate ? 2 : 0 }}>
        {selectedTemplate ? (
          <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={() => setSelectedTemplate(null)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
              戻る
            </Button>
            <Box>
              <Button onClick={() => setActiveTemplateDialogProject(null)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mr: 1 }}>
                キャンセル
              </Button>
              <Button 
                onClick={async () => {
                  if (!activeTemplateDialogProject || !selectedTemplate || isCreating) return;
                  setIsCreating(true);
                  try {
                    const wf = await dspRepository.createPresentationWorkFile(
                      activeTemplateDialogProject.id,
                      templatePresentationName || selectedTemplate.title,
                      'user'
                    );
                    
                    setActiveProjectId(activeTemplateDialogProject.id);
                    setDspScope(activeTemplateDialogProject.isTeam ? 'team_project_presentations' : 'project_presentations');
                    
                    const targetWorkspaceId = 'presents';
                    setPanelSelection(targetWorkspaceId, wf);
                    setActiveWorkspaceId(targetWorkspaceId);
                    setDspShellMode('editor');
                    
                    window.dispatchEvent(new CustomEvent('dsp-presentations-updated', { detail: { projectId: activeTemplateDialogProject.id } }));
                    
                    setActiveTemplateDialogProject(null);
                    setSelectedTemplate(null);
                    setTemplatePresentationName('');
                  } catch (e) {
                    console.error('Failed to create presentation:', e);
                  } finally {
                    setIsCreating(false);
                  }
                }} 
                disabled={isCreating || !templatePresentationName.trim()} 
                variant="contained" 
                sx={{ bgcolor: '#00BFFF', color: '#000', '&:hover': { bgcolor: '#4facfe' } }}
              >
                {isCreating ? '作成中...' : '作成'}
              </Button>
            </Box>
          </Box>
        ) : (
          <Button onClick={() => setActiveTemplateDialogProject(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
        )}
      </DialogActions>
    </Dialog>

    </Box>
  );
};
