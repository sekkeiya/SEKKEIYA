import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, CardActionArea, IconButton, InputBase,
  Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Menu, MenuItem, Collapse, CircularProgress,
} from '@mui/material';
import WbSunnyRoundedIcon from '@mui/icons-material/WbSunnyRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';
import { useAppStore, type DsdScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDsdStore } from '../../../features/dsd/store/useDsdStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#aed581';

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDsdDiagrams(projectId: string | null) {
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId) { setDiagrams([]); return; }
    setLoading(true);

    const q = query(
      collection(db, `projects/${projectId}/workFiles`),
      where('appScope', '==', '3dsd'),
      where('type', '==', 'diagram-state'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDiagrams(items);
      setLoading(false);
    }, (err) => {
      console.error('[useDsdDiagrams]', err);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  return { diagrams, loading };
}

// ─── ScopeItem ────────────────────────────────────────────────────────────────

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: (e?: React.MouseEvent) => void;
  color?: string;
  onRenameClick?: () => void;
  onDeleteClick?: () => void;
  renderActions?: React.ReactNode;
  hasToggle?: boolean;
  expanded?: boolean;
  onToggle?: (e: React.MouseEvent) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
}

function ScopeItem({
  icon, label, active, onClick, color,
  onRenameClick, onDeleteClick, renderActions,
  hasToggle, expanded, onToggle,
  isRenaming = false, renameValue = '', onRenameChange, onRenameSubmit, onRenameCancel,
}: ScopeItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5, '&:hover .scope-actions': { opacity: 1 } }}>
      <Box
        onClick={!isRenaming ? onClick : undefined}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.75, borderRadius: 2,
          cursor: isRenaming ? 'default' : 'pointer',
          bgcolor: active ? (color ? `color-mix(in srgb, ${color} 15%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.12)') : 'transparent',
          border: active ? `1px solid ${color ? `color-mix(in srgb, ${color} 25%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.2)'}` : '1px solid transparent',
          '&:hover': { bgcolor: active ? (color ? `color-mix(in srgb, ${color} 20%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.18)') : 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        {hasToggle !== undefined && (
          hasToggle && !isRenaming ? (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onToggle?.(e); }}
              sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.25, mr: 0.5, '&:hover': { color: 'var(--brand-fg)' } }}
            >
              <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </IconButton>
          ) : (
            <Box sx={{ width: 24, height: 24, mr: 0.5 }} />
          )
        )}

        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || 'rgb(var(--brand-fg-rgb) / 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          mr: 1, flexShrink: 0,
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, {
            sx: { fontSize: 14, color: color ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)' },
          })}
        </Box>

        {isRenaming ? (
          <Box sx={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => onRenameChange?.(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRenameSubmit?.();
                if (e.key === 'Escape') onRenameCancel?.();
              }}
              onBlur={() => onRenameSubmit?.()}
              style={{
                width: '100%', padding: '2px 6px', borderRadius: '4px',
                border: `1px solid ${ACCENT}`, backgroundColor: 'rgba(0,0,0,0.4)',
                color: 'var(--brand-fg)', fontSize: '12px', outline: 'none',
              }}
            />
          </Box>
        ) : (
          <Typography sx={{
            color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
            fontSize: 12, fontWeight: active ? 600 : 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            {label}
          </Typography>
        )}
      </Box>

      {!isRenaming && (onRenameClick || onDeleteClick) && (
        <>
          <IconButton
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
            size="small"
            sx={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              opacity: 0, transition: 'opacity 0.2s',
              color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' },
              '&[aria-expanded="true"]': { opacity: 1 },
            }}
            className="scope-actions"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
            PaperProps={{ sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 2 } }}
          >
            {onRenameClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(); }} sx={{ color: 'var(--brand-fg)', fontSize: 13 }}>
                名前を変更
              </MenuItem>
            )}
            {onDeleteClick && (
              <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(); }} sx={{ color: '#ff4d4f', fontSize: 13 }}>
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
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            opacity: 0, transition: 'opacity 0.2s',
            display: 'flex', gap: 0.5,
            '&:hover': { opacity: 1 },
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderActions}
        </Box>
      )}
    </Box>
  );
}

// ─── ProjectDiagramAccordion ──────────────────────────────────────────────────

function ProjectDiagramAccordion({
  project,
  active,
  expanded,
  onSelect,
  onRenameClick,
  onDeleteClick,
  onDiagramSelect,
  isRenaming = false,
  renameValue = '',
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  project: any;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
  onRenameClick: () => void;
  onDeleteClick: () => void;
  onDiagramSelect: (diagramId: string, diagramData: any) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
}) {
  const [isProjectExpanded, setIsProjectExpanded] = useState(expanded);
  const { activeDiagramId } = useAppStore();

  const { diagrams, loading } = useDsdDiagrams(isProjectExpanded ? project.id : null);

  const [renameDiagramId, setRenameDiagramId] = useState<string | null>(null);
  const [renameDiagramValue, setRenameDiagramValue] = useState('');
  const [deleteDiagramId, setDeleteDiagramId] = useState<string | null>(null);
  const [deleteDiagramName, setDeleteDiagramName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggleProject = (e?: any) => {
    e?.stopPropagation();
    setIsProjectExpanded(prev => !prev);
  };

  const handleCreateDiagram = async (e: any) => {
    e.stopPropagation();
    if (creating || isProcessing) return;
    setCreating(true);
    try {
      // Switch to editor with a new blank diagram (no existing id)
      useAppStore.getState().setActiveDiagramId(null);
      useAppStore.getState().setActiveProjectId(project.id);
      useAppStore.getState().setDsdScope('project_diagrams');
      useAppStore.getState().setActiveWorkspaceId('diagram');
      // Open dashboard so user can pick template via the new-diagram dialog
      useAppStore.getState().setDsdShellMode('dashboard');
    } finally {
      setCreating(false);
    }
  };

  const handleRenameDiagramSubmit = async () => {
    if (!renameDiagramId || !renameDiagramValue.trim() || isProcessing) return;
    setIsProcessing(true);
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      const ref = doc(db, `projects/${project.id}/workFiles`, renameDiagramId);
      await setDoc(ref, { diagramTitle: renameDiagramValue.trim() }, { merge: true });
      setRenameDiagramId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteDiagramSubmit = async () => {
    if (!deleteDiagramId || isProcessing) return;
    setIsProcessing(true);
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../../lib/firebase/client');
      await deleteDoc(doc(db, `projects/${project.id}/workFiles`, deleteDiagramId));
      if (activeDiagramId === deleteDiagramId) {
        useAppStore.getState().setActiveDiagramId(null);
        useAppStore.getState().setDsdShellMode('dashboard');
      }
      setDeleteDiagramId(null);
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
          {/* Vertical connector line */}
          <Box sx={{ position: 'absolute', left: 23, top: 0, bottom: 12, width: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
              {[1, 2].map(i => (
                <Box key={i} sx={{ position: 'relative', mb: 0.5, display: 'flex', alignItems: 'center', px: 1.25, py: 0.75 }}>
                  <Box sx={{ position: 'absolute', left: -1, top: 16, width: 8, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }} />
                  <Box sx={{ width: 20, height: 20, borderRadius: 1.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', mr: 1 }} />
                  <Box sx={{ height: 12, width: '60%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 1 }} />
                </Box>
              ))}
            </Box>
          ) : (
            <>
              {diagrams.map((diagram: any) => {
                const isDiagramActive = activeDiagramId === diagram.id;
                return (
                  <Box key={diagram.id} sx={{ position: 'relative', mb: 0.5 }}>
                    <Box sx={{ position: 'absolute', left: -1, top: 16, width: 8, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                    <ScopeItem
                      icon={<WbSunnyRoundedIcon />}
                      label={diagram.diagramTitle || 'Untitled Diagram'}
                      active={isDiagramActive}
                      onClick={(e) => {
                        e?.stopPropagation();
                        onDiagramSelect(diagram.id, diagram);
                      }}
                      color={ACCENT}
                      isRenaming={renameDiagramId === diagram.id}
                      renameValue={renameDiagramValue}
                      onRenameChange={setRenameDiagramValue}
                      onRenameSubmit={handleRenameDiagramSubmit}
                      onRenameCancel={() => setRenameDiagramId(null)}
                      renderActions={
                        <>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameDiagramValue(diagram.diagramTitle || '');
                              setRenameDiagramId(diagram.id);
                            }}
                            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}
                          >
                            <EditRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteDiagramName(diagram.diagramTitle || 'このダイアグラム');
                              setDeleteDiagramId(diagram.id);
                            }}
                            sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#ff4d4f' } }}
                          >
                            <DeleteRoundedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </>
                      }
                    />
                  </Box>
                );
              })}

              {/* + 新規ダイアグラム追加 */}
              <Box sx={{ position: 'relative', mt: 0.5 }}>
                <Box sx={{ position: 'absolute', left: -1, top: '50%', width: 8, height: '1px', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' }} />
                <CardActionArea
                  onClick={handleCreateDiagram}
                  disabled={creating}
                  sx={{
                    display: 'flex', alignItems: 'center', py: 0.75, px: 1, ml: 1, borderRadius: 1.5,
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' }, opacity: creating ? 0.5 : 1,
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 14, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mr: 1 }} />
                  <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 500 }}>
                    新規ダイアグラム追加
                  </Typography>
                </CardActionArea>
              </Box>
            </>
          )}
        </Box>
      </Collapse>

      {/* Delete Diagram Dialog */}
      {deleteDiagramId && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>削除の確認</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 3, fontSize: 14 }}>
              「{deleteDiagramName}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setDeleteDiagramId(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteDiagramSubmit} sx={{ color: '#ff4d4f', fontSize: 13, cursor: isProcessing ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ─── DsdSidebar ───────────────────────────────────────────────────────────────

export const DsdSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    isProjectSidebarOpen,
    dsdScope,
    setDsdScope,
    setActiveWorkspaceId,
    setActiveDiagramId,
  } = useAppStore();
  const { loadState, setCurrentTemplate } = useDsdStore();
  const setDsdShellMode = useAppStore(s => s.setDsdShellMode);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createProjectType, setCreateProjectType] = useState<'my' | 'team'>('my');
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim()) return;
    try {
      setIsProcessing(true);
      await renameProject(activeRenameProject.id, renameValue);
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (e) {
      console.error('Failed to rename project:', e);
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
      console.error('Failed to delete project:', e);
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
      setDsdScope('project_diagrams');
      setActiveWorkspaceId('diagram');
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

  const handleScopeSelect = (scope: DsdScope) => {
    setDsdScope(scope);
    setActiveWorkspaceId('diagram');
    setDsdShellMode('dashboard');
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDsdScope(isTeam ? 'team_project_diagrams' : 'project_diagrams');
    setActiveProjectId(projectId);
    setActiveWorkspaceId('diagram');
    setDsdShellMode('dashboard');
  };

  const handleDiagramSelect = async (diagramId: string, diagramData: any, projectId: string, isTeam: boolean) => {
    // Set the project context
    setActiveProjectId(projectId);
    setDsdScope(isTeam ? 'team_project_diagrams' : 'project_diagrams');
    setActiveWorkspaceId('diagram');

    // Load the saved state into the store
    loadState({
      currentTemplate: diagramData.currentTemplate,
      diagramTitle: diagramData.diagramTitle,
      style: diagramData.style,
      presetShape: diagramData.presetShape,
      customPolygon: diagramData.customPolygon ?? [],
      buildingWidth: diagramData.buildingWidth,
      buildingDepth: diagramData.buildingDepth,
      buildingHeight: diagramData.buildingHeight,
      northAngle: diagramData.northAngle,
      month: diagramData.month,
      timeHour: diagramData.timeHour,
      latitude: diagramData.latitude,
      layoutMode: diagramData.layoutMode,
      zones: diagramData.zones ?? [],
      flows: diagramData.flows ?? [],
      siteBoundaryW: diagramData.siteBoundaryW,
      siteBoundaryH: diagramData.siteBoundaryH,
      siteNorthAngle: diagramData.siteNorthAngle,
      siteElements: diagramData.siteElements ?? [],
      siteAccesses: diagramData.siteAccesses ?? [],
      windDirection: diagramData.windDirection,
      windSpeed: diagramData.windSpeed,
      envLayer: diagramData.envLayer,
      noiseSources: diagramData.noiseSources ?? [],
      thermalSeason: diagramData.thermalSeason,
      windViewCx: diagramData.windViewCx,
      windViewCy: diagramData.windViewCy,
      windViewW: diagramData.windViewW,
      windViewH: diagramData.windViewH,
      annotations: diagramData.annotations ?? [],
    });

    if (diagramData.currentTemplate) {
      setCurrentTemplate(diagramData.currentTemplate);
    }

    setActiveDiagramId(diagramId);
    setDsdShellMode('editor');
  };

  return (
    <Box sx={{
      width: '100%',
      height: '100%',
      bgcolor: BRAND.panel,
      borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
      display: 'flex', flexDirection: 'column',
      py: isProjectSidebarOpen ? 2 : 0,
      overflowY: 'auto', overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
    }}>
      <Box sx={{ px: 2, mb: 1 }}>
        {/* Header */}
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', mb: 1.5 }}>
          3D SHAPE DIAGRAM
        </Typography>

        {/* Search */}
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
            label="Diagrams"
            active={dsdScope === 'global_diagrams'}
            onClick={() => handleScopeSelect('global_diagrams')}
            color="#aed581"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dsdScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem
            icon={<PublicRoundedIcon />}
            label="Public Diagrams"
            active={dsdScope === 'my_public_diagrams'}
            onClick={() => handleScopeSelect('my_public_diagrams')}
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Diagrams"
            active={dsdScope === 'my_private_diagrams'}
            onClick={() => handleScopeSelect('my_private_diagrams')}
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              My Projects
            </Typography>
          </Box>
          {myProjects.map(p => (
            <ProjectDiagramAccordion
              key={p.id}
              project={p}
              active={p.id === activeProjectId && dsdScope === 'project_diagrams'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, false)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onDiagramSelect={(diagramId, data) => handleDiagramSelect(diagramId, data, p.id, false)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              Team Projects
            </Typography>
          </Box>
          {teamProjects.map(p => (
            <ProjectDiagramAccordion
              key={p.id}
              project={p}
              active={p.id === activeProjectId && dsdScope === 'team_project_diagrams'}
              expanded={p.id === activeProjectId}
              onSelect={() => handleProjectSelect(p.id, true)}
              onRenameClick={() => { setActiveRenameProject(p); setRenameValue(p.name); }}
              onDeleteClick={() => setActiveDeleteProject(p)}
              onDiagramSelect={(diagramId, data) => handleDiagramSelect(diagramId, data, p.id, true)}
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
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained" sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#c5e1a5' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Project Dialog */}
      {activeRenameProject && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase fullWidth autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} disabled={isProcessing}
              sx={{ bgcolor: 'light-dark(rgba(15,23,42,0.07), rgba(0,0,0,0.2))', color: 'var(--brand-fg)', px: 2, py: 1, borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', mb: 3 }} />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: 'var(--brand-fg)' } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: ACCENT, fontSize: 13, cursor: isProcessing || !renameValue.trim() ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* Delete Project Dialog */}
      {activeDeleteProject && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: 'var(--brand-surface2)', p: 4, borderRadius: 3, border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)' }}>
            <Typography variant="h6" sx={{ color: 'var(--brand-fg)', mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 3, fontSize: 14 }}>「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。</Typography>
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
