import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, CardActionArea, IconButton, Menu, MenuItem,
  InputBase, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, Select, FormControl, InputLabel, Avatar,
  CircularProgress,
} from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTeamsStore } from '../../../store/useTeamsStore';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { createProject } from '../../../features/projects/api/createProject';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { fetchAllTeamProjectsForUser } from '../../../features/teams/api/teamsApi';
import { BRAND } from '../../../styles/theme';
import type { Team } from '../../../features/teams/api/teamsApi';
import FolderSpecialRoundedIcon from '@mui/icons-material/FolderSpecialRounded';

// ── ユーティリティ ──────────────────────────────
const projectHue = (name: string) =>
  [...(name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 42%)`;
};

// ── プロジェクト行 ─────────────────────────────
interface ProjectListItemProps {
  project: any;
  active: boolean;
  onClick: () => void;
  onRenameClick: (p: any) => void;
  onDeleteClick: (p: any) => void;
}

function ProjectListItem({ project, active, onClick, onRenameClick, onDeleteClick }: ProjectListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const hue = projectHue(project.name);

  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: `hsl(${hue}, 50%, 40%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          <FolderRoundedIcon sx={{ fontSize: 14, color: '#fff' }} />
        </Box>
        <Typography sx={{
          color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
          fontSize: 12, fontWeight: active ? 600 : 500,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {project.name}
        </Typography>
      </CardActionArea>

      <IconButton
        onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}
        size="small"
        sx={{
          position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
          opacity: 0, transition: 'opacity 0.2s',
          '.MuiCardActionArea-root:hover ~ &, &:hover, &[aria-expanded="true"]': { opacity: 1 },
          color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={(e: any) => { e?.stopPropagation(); setAnchorEl(null); }}
        PaperProps={{ sx: { bgcolor: '#1a1e27', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 2 } }}
      >
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(project); }} sx={{ color: '#fff', fontSize: 13 }}>
          名前を変更
        </MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(project); }} sx={{ color: '#ff4d4f', fontSize: 13 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>
    </Box>
  );
}

// ── チームヘッダー行 ──────────────────────────
function TeamHeaderRow({ team, active, onClick }: { team: Team; active: boolean; onClick: () => void }) {
  const color = teamColor(team.name);
  return (
    <Box sx={{ mx: 1.5, mt: 1.5, mb: 0.25 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.5, borderRadius: 1.5,
          bgcolor: active ? 'rgba(52,152,219,0.1)' : 'transparent',
          '&:hover': { bgcolor: active ? 'rgba(52,152,219,0.14)' : 'rgba(255,255,255,0.05)' },
        }}
      >
        <Avatar sx={{
          width: 16, height: 16, borderRadius: 0.75, bgcolor: color,
          fontSize: 9, fontWeight: 700, mr: 1, flexShrink: 0,
        }}>
          {team.name.charAt(0).toUpperCase()}
        </Avatar>
        <Typography sx={{
          color: active ? '#3498db' : 'rgba(255,255,255,0.5)',
          fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {team.name}
        </Typography>
      </CardActionArea>
    </Box>
  );
}

// ── チームプロジェクト行 ───────────────────────
function TeamProjectListItem({ project, active, onClick }: { project: any; active: boolean; onClick: () => void }) {
  const hue = [...(project.name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.25, pl: 1 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.6, borderRadius: 2,
          bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        <Box sx={{
          width: 16, height: 16, borderRadius: 1,
          bgcolor: `hsl(${hue}, 50%, 35%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          <FolderRoundedIcon sx={{ fontSize: 10, color: '#fff' }} />
        </Box>
        <Typography sx={{
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          fontSize: 12, fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {project.name}
        </Typography>
      </CardActionArea>
    </Box>
  );
}

// ── セクションヘッダー ─────────────────────────
function SectionHeader({ label, onAdd, addTitle }: { label: string; onAdd: () => void; addTitle: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Tooltip title={addTitle} placement="top">
        <IconButton
          size="small"
          onClick={onAdd}
          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, width: 20, height: 20 }}
        >
          <AddRoundedIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// ── ProjectSidebar 本体 ────────────────────────
export const ProjectSidebar: React.FC = () => {
  const { currentUser } = useAuthStore();
  const {
    projects, activeProjectId, setActiveProjectId, setProjects,
    isProjectSidebarOpen, currentMainView, setCurrentMainView,
  } = useAppStore();

  const { teams, activeTeamId, isLoading: teamsLoading, loadTeams, addTeam, setActiveTeamId } = useTeamsStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Project dialogs
  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Team project map: teamId → project[]
  const [teamProjectsMap, setTeamProjectsMap] = useState<Record<string, any[]>>({});
  const teamIds = useMemo(() => teams.map(t => t.id).join(','), [teams]);

  useEffect(() => {
    if (!currentUser) { setTeamProjectsMap({}); return; }
    fetchAllTeamProjectsForUser(currentUser.uid)
      .then(setTeamProjectsMap)
      .catch(() => setTeamProjectsMap({}));
  }, [currentUser?.uid, teamIds]);

  // Team create dialog (2-step wizard)
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [teamCreateStep, setTeamCreateStep] = useState<1 | 2>(1);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [newTeamVisibility, setNewTeamVisibility] = useState<'public' | 'private'>('private');
  const [newTeamProjectName, setNewTeamProjectName] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Load projects
  useEffect(() => {
    if (currentUser) {
      fetchUserProjects(currentUser.uid).then(setProjects);
    } else {
      setProjects([]);
    }
  }, [currentUser, setProjects]);

  // Load teams
  useEffect(() => {
    if (currentUser) loadTeams(currentUser.uid);
  }, [currentUser]);

  const { myProjects } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = projects.filter(p => !q || p.name?.toLowerCase().includes(q));
    return {
      myProjects: filtered.filter(p => p.ownerId === currentUser?.uid && !p.isTeam),
    };
  }, [projects, searchQuery, currentUser?.uid]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return q ? teams.filter(t => t.name.toLowerCase().includes(q)) : teams;
  }, [teams, searchQuery]);

  // ── ハンドラ ──────────────────────────────
  const handleCreateProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
      });
      setProjects([newProject as any, ...projects]);
      setNewProjectName('');
      setIsCreateProjectOpen(false);
      setActiveProjectId(newProject.id, 'home');
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleOpenCreateTeam = () => {
    setTeamCreateStep(1);
    setNewTeamName('');
    setNewTeamDesc('');
    setNewTeamVisibility('private');
    setNewTeamProjectName('');
    setIsCreateTeamOpen(true);
  };

  const handleCreateTeam = async () => {
    if (!currentUser || !newTeamName.trim() || !newTeamProjectName.trim()) return;
    setIsCreatingTeam(true);
    try {
      const team = await addTeam({
        ownerId: currentUser.uid,
        name: newTeamName.trim(),
        description: newTeamDesc.trim(),
        visibility: newTeamVisibility,
      });
      await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newTeamProjectName.trim(),
        isTeam: true,
        teamId: team.id,
        teamMemberIds: team.memberIds,
      });
      setIsCreateTeamOpen(false);
      setActiveTeamId(team.id);
      setCurrentMainView('teams');
    } finally {
      setIsCreatingTeam(false);
    }
  };

  const handleTeamClick = (team: Team) => {
    setActiveTeamId(team.id);
    setCurrentMainView('teams');
  };


  const handleRenameSubmit = async () => {
    if (!activeRenameProject || !renameValue.trim()) return;
    setIsProcessing(true);
    try {
      await renameProject(activeRenameProject.id, renameValue);
      setProjects(projects.map(p => p.id === activeRenameProject.id ? { ...p, name: renameValue.trim() } : p));
      setActiveRenameProject(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!activeDeleteProject) return;
    setIsProcessing(true);
    try {
      await deleteProject(activeDeleteProject.id);
      setProjects(projects.filter(p => p.id !== activeDeleteProject.id));
      if (activeProjectId === activeDeleteProject.id) setActiveProjectId(null);
      setActiveDeleteProject(null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{
      width: '100%', height: '100%',
      bgcolor: BRAND.panel,
      borderRight: isProjectSidebarOpen ? '1px solid rgba(255,255,255,0.05)' : 'none',
      display: 'flex', flexDirection: 'column',
      py: isProjectSidebarOpen ? 2 : 0,
      overflowY: 'auto', overflowX: 'hidden',
      flexShrink: 0,
      transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
    }}>
      <Box sx={{ px: 2, mb: 2 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', mb: 1.5 }}>
          Projects
        </Typography>

        {/* 検索 */}
        <Box sx={{
          display: 'flex', alignItems: 'center',
          bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, px: 1.5, py: 0.5,
          border: '1px solid rgba(255,255,255,0.05)',
          '&:focus-within': { borderColor: 'rgba(255,255,255,0.15)' }, mb: 2,
        }}>
          <SearchRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', mr: 1 }} />
          <InputBase
            placeholder="プロジェクトを検索..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ color: '#fff', fontSize: 12, flex: 1 }}
          />
        </Box>

        {/* ダッシュボード */}
        <CardActionArea
          onClick={() => { setActiveProjectId(null, 'home'); setCurrentMainView('app-hub'); }}
          sx={{
            display: 'flex', alignItems: 'center',
            px: 1.25, py: 0.75, borderRadius: 2,
            bgcolor: currentMainView === 'app-hub' ? 'rgba(255,255,255,0.08)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }, mb: 2,
          }}
        >
          <Box sx={{ width: 20, height: 20, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0 }}>
            <DashboardRoundedIcon sx={{ fontSize: 16, color: currentMainView === 'app-hub' ? '#3498db' : 'rgba(255,255,255,0.5)' }} />
          </Box>
          <Typography sx={{
            color: currentMainView === 'app-hub' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            fontSize: 12, fontWeight: currentMainView === 'app-hub' ? 600 : 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            ダッシュボード
          </Typography>
        </CardActionArea>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* MY PROJECTS */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <SectionHeader
            label="My Projects"
            addTitle="プロジェクトを作成"
            onAdd={() => setIsCreateProjectOpen(true)}
          />
          {myProjects.length === 0 ? (
            <Typography sx={{ px: 3, py: 1, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              プロジェクトがありません
            </Typography>
          ) : (
            myProjects.map(p => (
              <ProjectListItem
                key={p.id}
                project={p}
                active={p.id === activeProjectId && currentMainView !== 'app-hub' && currentMainView !== 'teams'}
                onClick={() => { setActiveProjectId(p.id, 'home'); setCurrentMainView('workspace'); }}
                onRenameClick={proj => { setActiveRenameProject(proj); setRenameValue(proj.name); }}
                onDeleteClick={proj => setActiveDeleteProject(proj)}
              />
            ))
          )}
        </Box>

        {/* TEAM PROJECTS */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <SectionHeader
            label="Team Projects"
            addTitle="チームを作成"
            onAdd={handleOpenCreateTeam}
          />
          {teamsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
              <CircularProgress size={16} sx={{ color: '#3498db' }} />
            </Box>
          ) : filteredTeams.length === 0 ? (
            <Typography sx={{ px: 3, py: 1, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              チームがありません
            </Typography>
          ) : (
            filteredTeams.map(team => {
              const projs = teamProjectsMap[team.id] ?? [];
              const isTeamActive = team.id === activeTeamId && currentMainView === 'teams';
              return (
                <Box key={team.id}>
                  <TeamHeaderRow
                    team={team}
                    active={isTeamActive}
                    onClick={() => handleTeamClick(team)}
                  />
                  {projs.length === 0 ? (
                    <Typography sx={{ pl: 4, py: 0.5, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                      プロジェクトなし
                    </Typography>
                  ) : (
                    projs.map((proj: any) => (
                      <TeamProjectListItem
                        key={proj.id}
                        project={proj}
                        active={proj.id === activeProjectId}
                        onClick={() => { setActiveProjectId(proj.id, 'home'); setCurrentMainView('workspace'); }}
                      />
                    ))
                  )}
                </Box>
              );
            })
          )}
        </Box>

        {/* 検索結果なし */}
        {searchQuery && myProjects.length === 0 && filteredTeams.length === 0 && (
          <Typography sx={{ textAlign: 'center', mt: 2, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            一致するプロジェクトがありません
          </Typography>
        )}
      </Box>

      {/* ── ダイアログ群 ─────────────────────── */}

      {/* プロジェクト作成 */}
      <Dialog
        open={isCreateProjectOpen}
        onClose={() => !isCreatingProject && setIsCreateProjectOpen(false)}
        PaperProps={{ sx: { bgcolor: '#1a1e27', color: '#fff', minWidth: 400, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, fontSize: 16, fontWeight: 700 }}>
          <FolderRoundedIcon sx={{ color: '#90caf9' }} />
          新規プロジェクトを作成
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 2, fontSize: 13 }}>
            個人用の新しいプロジェクトを作成します。
          </Typography>
          <TextField
            autoFocus margin="dense" label="プロジェクト名" type="text" fullWidth variant="outlined"
            value={newProjectName} onChange={e => setNewProjectName(e.target.value)} disabled={isCreatingProject}
            InputProps={{ sx: { color: '#fff', fontSize: 14, borderRadius: 2 } }}
            InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
            sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' }, '&.Mui-focused fieldset': { borderColor: '#90caf9' } } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setIsCreateProjectOpen(false)} disabled={isCreatingProject} sx={{ color: 'rgba(255,255,255,0.6)' }}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreateProject} disabled={!newProjectName.trim() || isCreatingProject} variant="contained"
            sx={{ bgcolor: '#90caf9', color: '#000', fontWeight: 600, '&:hover': { bgcolor: '#64b5f6' } }}
          >
            {isCreatingProject ? '作成中...' : '作成'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* チーム作成（2ステップウィザード） */}
      <Dialog
        open={isCreateTeamOpen}
        onClose={() => !isCreatingTeam && setIsCreateTeamOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { bgcolor: '#1a1e27', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', backgroundImage: 'none' } }}
      >
        <DialogTitle sx={{ pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <GroupsRoundedIcon sx={{ color: '#3498db' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>新しいチームを作成</Typography>
          </Box>
          {/* ステップインジケーター */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: '#3498db', color: '#fff',
              }}>1</Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: teamCreateStep === 1 ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                チーム情報
              </Typography>
            </Box>
            <Box sx={{ flex: 1, height: 1, bgcolor: teamCreateStep === 2 ? '#3498db' : 'rgba(255,255,255,0.15)', mx: 1.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: teamCreateStep === 2 ? '#3498db' : 'rgba(255,255,255,0.15)',
                color: teamCreateStep === 2 ? '#fff' : 'rgba(255,255,255,0.4)',
              }}>2</Box>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: teamCreateStep === 2 ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                最初のプロジェクト
              </Typography>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          {teamCreateStep === 1 ? (
            <>
              <TextField
                label="チーム名" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                size="small" fullWidth autoFocus disabled={isCreatingTeam}
                onKeyDown={e => { if (e.key === 'Enter' && newTeamName.trim()) setTeamCreateStep(2); }}
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#3498db' } } }}
              />
              <TextField
                label="説明（任意）" value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)}
                size="small" fullWidth multiline rows={2} disabled={isCreatingTeam}
                InputProps={{ sx: { color: '#fff' } }}
                InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#3498db' } } }}
              />
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.5)' }}>公開設定</InputLabel>
                <Select
                  value={newTeamVisibility} label="公開設定"
                  onChange={e => setNewTeamVisibility(e.target.value as 'public' | 'private')}
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' } }}
                >
                  <MenuItem value="public">公開</MenuItem>
                  <MenuItem value="private">非公開</MenuItem>
                </Select>
              </FormControl>
            </>
          ) : (
            <>
              <Box sx={{ bgcolor: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.2)', borderRadius: 2, p: 1.5 }}>
                <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', mb: 0.25 }}>チーム</Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{newTeamName}</Typography>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <FolderSpecialRoundedIcon sx={{ fontSize: 18, color: '#3498db' }} />
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                    最初のチームプロジェクトを作成します
                  </Typography>
                </Box>
                <TextField
                  label="プロジェクト名" value={newTeamProjectName} onChange={e => setNewTeamProjectName(e.target.value)}
                  size="small" fullWidth autoFocus disabled={isCreatingTeam}
                  onKeyDown={e => { if (e.key === 'Enter' && newTeamProjectName.trim()) handleCreateTeam(); }}
                  InputProps={{ sx: { color: '#fff' } }}
                  InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}
                  sx={{ '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }, '&.Mui-focused fieldset': { borderColor: '#3498db' } } }}
                />
                <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', mt: 1 }}>
                  後からプロジェクトを追加することもできます
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          {teamCreateStep === 1 ? (
            <>
              <Button onClick={() => setIsCreateTeamOpen(false)} disabled={isCreatingTeam} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 600 }}>
                キャンセル
              </Button>
              <Button
                onClick={() => setTeamCreateStep(2)} disabled={!newTeamName.trim()} variant="contained"
                sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}
              >
                次へ
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setTeamCreateStep(1)} disabled={isCreatingTeam} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 600 }}>
                戻る
              </Button>
              <Button
                onClick={handleCreateTeam} disabled={!newTeamProjectName.trim() || isCreatingTeam} variant="contained"
                sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}
              >
                {isCreatingTeam ? <CircularProgress size={16} color="inherit" /> : 'チームを作成'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* プロジェクト名変更 */}
      {activeRenameProject && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: '#1a1e27', p: 4, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2, fontWeight: 700 }}>プロジェクト名を変更</Typography>
            <InputBase
              fullWidth autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} disabled={isProcessing}
              sx={{ bgcolor: 'rgba(0,0,0,0.2)', color: '#fff', px: 2, py: 1, borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)', mb: 3 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setActiveRenameProject(null)} sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: '#fff' } }}>キャンセル</Typography>
              <Typography onClick={handleRenameSubmit} sx={{ color: '#00BFFF', fontSize: 13, cursor: isProcessing || !renameValue.trim() ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing || !renameValue.trim() ? 0.5 : 1 }}>保存</Typography>
            </Box>
          </Box>
        </Box>
      )}

      {/* プロジェクト削除 */}
      {activeDeleteProject && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: 400, bgcolor: '#1a1e27', p: 4, borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="h6" sx={{ color: '#fff', mb: 2, fontWeight: 700 }}>プロジェクトを削除</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', mb: 3, fontSize: 14 }}>
              「{activeDeleteProject.name}」を削除しますか？この操作は元に戻せません。
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Typography onClick={() => setActiveDeleteProject(null)} sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer', py: 1, '&:hover': { color: '#fff' } }}>キャンセル</Typography>
              <Typography onClick={handleDeleteSubmit} sx={{ color: '#ff4d4f', fontSize: 13, cursor: isProcessing ? 'not-allowed' : 'pointer', py: 1, fontWeight: 600, opacity: isProcessing ? 0.5 : 1 }}>削除</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
