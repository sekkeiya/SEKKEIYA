import React, { useState, useMemo, useCallback } from 'react';
import {
  Box, Typography, CardActionArea, IconButton, InputBase, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button,
  Menu, MenuItem, Collapse, Divider,
} from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDscStore, type DscViewScope } from '../../../features/dsc/store/useDscStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';
import type { DesktopProject } from '../../../features/projects/types';
import { WorkFileRepository } from '../../../features/projects/workFileRepository';

const ACCENT = '#ffa726';

// ─── ScopeItem ───────────────────────────────────────────────────────────────

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
}

function ScopeItem({ icon, label, active, onClick, color, onRenameClick, onDeleteClick, expandIcon, onExpandClick }: ScopeItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
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
          display: 'flex', alignItems: 'center',
          pl: expandIcon ? 3.5 : 1.25, pr: 1.25, py: 0.75,
          borderRadius: 2,
          bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || 'rgb(var(--brand-fg-rgb) / 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: color ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' } })}
        </Box>
        <Typography sx={{
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {label}
        </Typography>
      </CardActionArea>

      {(onRenameClick || onDeleteClick) && (
        <>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            sx={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              opacity: active ? 1 : 0,
              color: 'rgb(var(--brand-fg-rgb) / 0.5)',
              '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
              '.MuiCardActionArea-root:hover + &': { opacity: 1 },
            }}
          >
            <MoreVertIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' } }}
          >
            {onRenameClick && (
              <MenuItem onClick={() => { setAnchorEl(null); onRenameClick(); }} sx={{ fontSize: 13, py: 1 }}>名前を変更</MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={() => { setAnchorEl(null); onDeleteClick(); }} sx={{ fontSize: 13, py: 1, color: '#ff4d4f' }}>削除</MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  );
}

// ─── FurnitureProjectNestingItem ──────────────────────────────────────────────

interface FurnitureProjectNestingItemProps {
  project: DesktopProject;
  active: boolean;
  isTeam: boolean;
  onClick: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
}

function FurnitureProjectNestingItem({ project, active, isTeam, onClick, onRenameClick, onDeleteClick }: FurnitureProjectNestingItemProps) {
  const [expanded, setExpanded] = useState(active);
  const [furnitureItems, setFurnitureItems] = useState<any[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [isProcessingFurniture, setIsProcessingFurniture] = useState(false);

  const { setDscShellMode, setActiveProjectId } = useAppStore();
  const { currentUser } = useAuthStore();
  const savedCount = useDscStore(s => s.savedCount);

  const fetchFurniture = useCallback(() => {
    WorkFileRepository.getWorkFiles(project.id)
      .then(files => setFurnitureItems(files.filter((f: any) => f.appScope === '3dsc')))
      .catch(() => {});
  }, [project.id]);

  React.useEffect(() => {
    if (expanded) fetchFurniture();
  }, [expanded, fetchFurniture, savedCount]);

  React.useEffect(() => {
    if (active && !expanded) setExpanded(true);
  }, [active]);

  const handleFurnitureRenameStart = (f: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(f.id);
    setRenameValue(f.name);
  };

  const handleFurnitureRenameSubmit = async () => {
    if (!renamingId || !renameValue.trim() || isProcessingFurniture) return;
    try {
      setIsProcessingFurniture(true);
      await WorkFileRepository.updateWorkFile(project.id, renamingId, { name: renameValue.trim() } as any);
      setFurnitureItems(prev => prev.map(f => f.id === renamingId ? { ...f, name: renameValue.trim() } : f));
      setRenamingId(null);
    } catch (err) {
      console.error('[DSC] Failed to rename furniture:', err);
    } finally {
      setIsProcessingFurniture(false);
    }
  };

  const handleFurnitureDeleteConfirm = async () => {
    if (!deletingItem || isProcessingFurniture) return;
    try {
      setIsProcessingFurniture(true);
      await WorkFileRepository.deleteWorkFile(project.id, deletingItem.id);
      setFurnitureItems(prev => prev.filter(f => f.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error('[DSC] Failed to delete furniture:', err);
    } finally {
      setIsProcessingFurniture(false);
    }
  };

  const handleOpenFurniture = (f: any) => {
    setActiveProjectId(project.id);
    useDscStore.getState().loadWorkFile(f);
    setDscShellMode('studio');
  };

  const handleNewFurniture = () => {
    if (!currentUser) return;
    setActiveProjectId(project.id);
    useDscStore.getState().setCurrentWorkFileId(null);
    setDscShellMode('studio');
    WorkFileRepository.createWorkFile({
      projectId: project.id,
      name: '新規造作家具',
      appScope: '3dsc',
      createdBy: currentUser.uid,
      updatedBy: currentUser.uid,
      status: 'active',
      thumbnailUrl: null,
      storagePath: null,
    } as any).then(newFile => {
      useDscStore.getState().setCurrentWorkFileId(newFile.id);
      useDscStore.getState().incrementSavedCount();
    }).catch(err => {
      console.error('[DSC] Failed to create initial WorkFile:', err);
    });
  };

  return (
    <Box>
      <ScopeItem
        icon={<FolderRoundedIcon />}
        label={project.name}
        active={active}
        onClick={() => { onClick(); if (!expanded) setExpanded(true); }}
        onRenameClick={onRenameClick}
        onDeleteClick={onDeleteClick}
        expandIcon={expanded
          ? <KeyboardArrowDownRoundedIcon fontSize="small" />
          : <KeyboardArrowRightRoundedIcon fontSize="small" />}
        onExpandClick={(e) => { e.stopPropagation(); setExpanded(prev => !prev); }}
      />
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ pl: 3.5, pr: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {furnitureItems.map(f => (
            <Box
              key={f.id}
              onClick={renamingId !== f.id ? () => handleOpenFurniture(f) : undefined}
              sx={{
                display: 'flex', alignItems: 'center', px: 1, py: 0.5,
                borderRadius: 1.5, cursor: renamingId === f.id ? 'default' : 'pointer',
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
                '&:hover .furn-actions': { opacity: 1 },
              }}
            >
              <ViewInArIcon sx={{ fontSize: 12, mr: 1, color: 'light-dark(rgba(173,103,0,0.6), rgba(255,167,38,0.6))', flexShrink: 0 }} />

              {renamingId === f.id ? (
                <InputBase
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={handleFurnitureRenameSubmit}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleFurnitureRenameSubmit();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  disabled={isProcessingFurniture}
                  sx={{
                    flex: 1, fontSize: 11, color: 'var(--brand-fg)',
                    '& input': { p: 0, py: '1px', px: '4px',
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', borderRadius: 1,
                      border: '1px solid rgba(255,167,38,0.5)' },
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <Typography
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {f.name}
                </Typography>
              )}

              {renamingId !== f.id && (
                <Box
                  className="furn-actions"
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.25, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                >
                  <Tooltip title="名前を変更" placement="top">
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); handleFurnitureRenameStart(f, e); }}
                      sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' } }}
                    >
                      <EditRoundedIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="削除" placement="top">
                    <IconButton
                      size="small"
                      onClick={e => { e.stopPropagation(); setDeletingItem(f); }}
                      sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(255,77,79,0.1)' } }}
                    >
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          ))}

          <Box
            onClick={handleNewFurniture}
            sx={{
              display: 'flex', alignItems: 'center', px: 1, py: 0.75, borderRadius: 1.5, mt: 0.5,
              cursor: 'pointer', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.15)',
              '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' },
            }}
          >
            <AddRoundedIcon sx={{ fontSize: 12, mr: 1, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 11, fontWeight: 500 }}>
              新規造作
            </Typography>
          </Box>
        </Box>
      </Collapse>

      {deletingItem && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.55)', zIndex: 1400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 380, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 1.5, fontWeight: 700, fontSize: 15 }}>造作家具を削除</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 3, fontSize: 13 }}>
              「{deletingItem.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography
                onClick={() => !isProcessingFurniture && setDeletingItem(null)}
                sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}
              >
                キャンセル
              </Typography>
              <Typography
                onClick={handleFurnitureDeleteConfirm}
                sx={{ color: '#ff4d4f', fontSize: 13, cursor: isProcessingFurniture ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessingFurniture ? 0.5 : 1 }}
              >
                {isProcessingFurniture ? '削除中...' : '削除'}
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── DscSidebar ───────────────────────────────────────────────────────────────

export const DscSidebar: React.FC = () => {
  const {
    isProjectSidebarOpen,
    projects,
    activeProjectId,
    setActiveProjectId,
    setProjects,
    setDscShellMode,
    setActiveWorkspaceId,
    setCurrentMainView,
    setLastLaunchPayload,
  } = useAppStore();
  const { currentUser } = useAuthStore();
  const dscViewScope = useDscStore(s => s.dscViewScope);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [activeRenameProject, setActiveRenameProject] = useState<DesktopProject | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeDeleteProject, setActiveDeleteProject] = useState<DesktopProject | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

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
      if (activeProjectId === activeDeleteProject.id) setActiveProjectId(null);
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
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const { myProjects, teamProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !q || p.name?.toLowerCase().includes(q));
    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter(p => p.ownerId !== currentUser?.uid || p.isTeam),
    };
  }, [projects, searchQuery, currentUser?.uid]);

  /** グローバルスコープ選択: projectId 不要でダッシュボードに遷移 */
  const handleGlobalScopeSelect = (scope: DscViewScope) => {
    useDscStore.getState().setDscViewScope(scope);
    setActiveWorkspaceId('create');
    setCurrentMainView('workspace');
    setDscShellMode('dashboard');
  };

  /** プロジェクトスコープ選択: projectId をペイロードにセット */
  const handleProjectSelect = (projectId: string) => {
    setActiveProjectId(projectId);
    setLastLaunchPayload({ projectId, workspaceId: 'create', appScope: '3dsc' });
    useDscStore.getState().setDscViewScope('project');
    setActiveWorkspaceId('create');
    setCurrentMainView('workspace');
    setDscShellMode('dashboard');
  };

  return (
    <Box sx={{
      width: isProjectSidebarOpen ? 240 : 0,
      height: '100%',
      bgcolor: BRAND.panel,
      borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
      display: 'flex', flexDirection: 'column',
      py: isProjectSidebarOpen ? 2 : 0,
      overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
      transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1), padding 0.2s, border 0.2s',
    }}>

      {/* ── Header + Search ── */}
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', mb: 1.5 }}>
          3D SHAPE CREATE
        </Typography>
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

        {/* ── グローバルスコープ (Furniture / Public Projects) ── */}
        <Box sx={{ mb: 0 }}>
          <ScopeItem
            icon={<ViewInArIcon />}
            label="Furniture"
            active={dscViewScope === 'global_following_furniture' || dscViewScope === 'global_furniture'}
            onClick={() => handleGlobalScopeSelect('global_following_furniture')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dscViewScope === 'global_projects'}
            onClick={() => handleGlobalScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* ── パーソナルスコープ (Public Furniture / Private Furniture) ── */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem
            icon={<PublicRoundedIcon />}
            label="Public Furniture"
            active={dscViewScope === 'my_public_furniture'}
            onClick={() => handleGlobalScopeSelect('my_public_furniture')}
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Furniture"
            active={dscViewScope === 'my_private_furniture'}
            onClick={() => handleGlobalScopeSelect('my_private_furniture')}
            color={ACCENT}
          />
        </Box>

        {/* ── My Projects ── */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map(p => (
            <FurnitureProjectNestingItem
              key={p.id}
              project={p}
              isTeam={false}
              active={p.id === activeProjectId && dscViewScope === 'project'}
              onClick={() => handleProjectSelect(p.id)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
            />
          ))}
        </Box>

        {/* ── Team Projects ── */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <FurnitureProjectNestingItem
              key={p.id}
              project={p}
              isTeam={true}
              active={p.id === activeProjectId && dscViewScope === 'project'}
              onClick={() => handleProjectSelect(p.id)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
            />
          ))}
        </Box>
      </Box>

      {/* Create Project Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {createProjectType === 'my' ? '新規マイプロジェクト作成' : '新規チームプロジェクト作成'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {createProjectType === 'my' ? '個人用の新しいプロジェクトを作成します。' : 'チームのメンバーと共有するための新しいプロジェクトを作成します。'}
          </Typography>
          <TextField
            autoFocus margin="dense" label="プロジェクト名" type="text" fullWidth variant="outlined"
            value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} disabled={isCreating}
            InputProps={{ style: { color: 'var(--brand-fg)' } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.7)' } }}
            sx={{ mt: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#fb8c00' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Project Dialog */}
      {activeRenameProject && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase fullWidth autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} disabled={isProcessing}
              sx={{ bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', color: 'var(--brand-fg)', px: 2, py: 1, borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', mb: 3 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSubmit(); }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: ACCENT, fontSize: 13, cursor: isProcessing || !renameValue.trim() ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Project Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: '#ff4d4f', fontSize: 13, cursor: isProcessing ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
