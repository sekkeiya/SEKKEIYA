/**
 * DsmSidebar — S.Movie ダッシュボード用左サイドバー（DsiSidebar パターン踏襲）
 *
 * スコープ構成（S.Image 参照）:
 *   Movie / Public Projects / ローカル素材 / Public Movie / Private Movie / My・Team Projects
 *
 * エディター画面では DsmEditorSidebar に切り替わる（MainLayout の dsmShellMode 分岐）。
 */
import React, { useMemo, useState } from 'react';
import { Box, Typography, CardActionArea, InputBase, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import VideoLibraryRoundedIcon from '@mui/icons-material/VideoLibraryRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useAppStore, type DsmScope } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { createProject } from '../../../features/projects/api/createProject';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#C98A4B';

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}

function ScopeItem({ icon, label, active, onClick, color }: ScopeItemProps) {
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: 2,
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
    </Box>
  );
}

export const DsmSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    projects, setProjects, activeProjectId, setActiveProjectId,
    isProjectSidebarOpen, dsmScope, setDsmScope, setActiveWorkspaceId, setDsmShellMode,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { myProjects, teamProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !q || p.name?.toLowerCase().includes(q));
    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
      teamProjects: filtered.filter(p => p.ownerId !== currentUser?.uid || p.isTeam),
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const handleScopeSelect = (scope: DsmScope) => {
    setDsmScope(scope);
    setDsmShellMode('dashboard');
    setActiveWorkspaceId('movie');
    useAppStore.getState().setCurrentMainView('workspace');
    setActiveProjectId(null);
  };

  const handleProjectSelect = (projectId: string, isTeam: boolean) => {
    setDsmScope(isTeam ? 'team_project_movies' : 'project_movies');
    setDsmShellMode('dashboard');
    setActiveProjectId(projectId);
    setActiveWorkspaceId('movie');
    useAppStore.getState().setCurrentMainView('workspace');
  };

  const handleCreateProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    try {
      setIsCreating(true);
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
      });
      setProjects([newProject as any, ...projects]);
      setNewProjectName('');
      setIsCreateDialogOpen(false);
      handleProjectSelect(newProject.id, false);
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
      }}
    >
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'rgb(var(--brand-fg-rgb) / 0.45)', textTransform: 'uppercase', mb: 1.5 }}>
          動画編集 / S.Movie
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
        {/* Global Scopes（DsiSidebar と同構成） */}
        <Box>
          <ScopeItem
            icon={<LanguageRoundedIcon />}
            label="Movie"
            active={dsmScope === 'global_movies'}
            onClick={() => handleScopeSelect('global_movies')}
            color="#2ecc71"
          />
          <ScopeItem
            icon={<FolderRoundedIcon />}
            label="Public Projects"
            active={dsmScope === 'global_projects'}
            onClick={() => handleScopeSelect('global_projects')}
            color="#3498db"
          />
          <ScopeItem
            icon={<VideoLibraryRoundedIcon />}
            label="ローカル素材"
            active={dsmScope === 'local_movies'}
            onClick={() => handleScopeSelect('local_movies')}
            color={ACCENT}
          />
        </Box>

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* Personal Scopes */}
        <Box sx={{ mb: 2 }}>
          <ScopeItem
            icon={<PublicRoundedIcon />}
            label="Public Movie"
            active={dsmScope === 'my_public_movies'}
            onClick={() => handleScopeSelect('my_public_movies')}
            color="#9b59b6"
          />
          <ScopeItem
            icon={<LockRoundedIcon />}
            label="Private Movie"
            active={dsmScope === 'my_private_movies'}
            onClick={() => handleScopeSelect('my_private_movies')}
            color="#e67e22"
          />
        </Box>

        {/* My Projects */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
              My Projects
            </Typography>
            <AddRoundedIcon
              onClick={() => setIsCreateDialogOpen(true)}
              sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.4)', cursor: 'pointer', '&:hover': { color: 'var(--brand-fg)' } }}
            />
          </Box>
          {myProjects.map(p => (
            <ScopeItem
              key={p.id}
              icon={<MovieRoundedIcon />}
              label={p.name}
              active={p.id === activeProjectId && dsmScope === 'project_movies'}
              onClick={() => handleProjectSelect(p.id, false)}
            />
          ))}
        </Box>

        {/* Team Projects */}
        {teamProjects.length > 0 && (
          <Box sx={{ mb: 2, minWidth: 200 }}>
            <Box sx={{ px: 2, py: 0.5 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'uppercase' }}>
                Team Projects
              </Typography>
            </Box>
            {teamProjects.map(p => (
              <ScopeItem
                key={p.id}
                icon={<FolderRoundedIcon />}
                label={p.name}
                active={p.id === activeProjectId && dsmScope === 'team_project_movies'}
                onClick={() => handleProjectSelect(p.id, true)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* フッター: ローカル完結の明示（docs/14 §0.5） */}
      <Box sx={{ px: 2, pt: 1, borderTop: `1px solid ${BRAND.line}` }}>
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', lineHeight: 1.6 }}>
          動画はローカル保存（LocalAssets/Movies）。クラウドへは自動アップロードされません。
        </Typography>
      </Box>

      {/* Create Project Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => !isCreating && setIsCreateDialogOpen(false)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 400 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>新規プロジェクト作成</DialogTitle>
        <DialogContent>
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
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
            キャンセル
          </Button>
          <Button onClick={handleCreateProject} disabled={isCreating || !newProjectName.trim()} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, '&:hover': { bgcolor: '#daa05f' } }}>
            {isCreating ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
