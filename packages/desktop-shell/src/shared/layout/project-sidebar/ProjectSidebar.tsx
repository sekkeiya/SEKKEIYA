import React, { useState, useMemo, useEffect } from 'react';
import {
  Box, Typography, CardActionArea, IconButton, Menu, MenuItem,
  InputBase, Tooltip, Avatar, CircularProgress,
} from '@mui/material';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useTeamsStore } from '../../../store/useTeamsStore';
import { fetchUserProjects } from '../../../features/projects/api/fetchProjects';
import { renameProject } from '../../../features/projects/api/updateProject';
import { deleteProject } from '../../../features/projects/api/deleteProject';
import { fetchAllTeamProjectsForUser } from '../../../features/teams/api/teamsApi';
import { BRAND } from '../../../styles/theme';
import type { Team } from '../../../features/teams/api/teamsApi';
import { ProjectIcon } from '../../../features/projects/components/ProjectIcon';
import { ProjectIconPicker } from '../../../features/projects/components/ProjectIconPicker';

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
  const [iconAnchor, setIconAnchor] = useState<null | HTMLElement>(null);
  const hue = projectHue(project.name);
  const hasCustom = !!(project.iconUrl || project.iconEmoji);

  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setIconAnchor(e.currentTarget); }}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        <ProjectIcon
          iconUrl={project.iconUrl}
          iconEmoji={project.iconEmoji}
          size={20}
          radius={1.5}
          fallbackBg={`hsl(${hue}, 50%, 40%)`}
          fallbackContent={<FolderRoundedIcon sx={{ fontSize: 14, color: '#fff' }} />}
          sx={{ mr: 1 }}
        />
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
        <MenuItem onClick={(e) => { e.stopPropagation(); const el = anchorEl; setAnchorEl(null); setIconAnchor(el); }} sx={{ color: '#fff', fontSize: 13 }}>
          アイコンを変更
        </MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onRenameClick(project); }} sx={{ color: '#fff', fontSize: 13 }}>
          名前を変更
        </MenuItem>
        <MenuItem onClick={(e) => { e.stopPropagation(); setAnchorEl(null); onDeleteClick(project); }} sx={{ color: '#ff4d4f', fontSize: 13 }}>
          プロジェクトを削除
        </MenuItem>
      </Menu>

      <ProjectIconPicker
        anchorEl={iconAnchor}
        projectId={iconAnchor ? project.id : null}
        hasCustomIcon={hasCustom}
        onClose={() => setIconAnchor(null)}
      />
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
  const [iconAnchor, setIconAnchor] = useState<null | HTMLElement>(null);
  const hue = [...(project.name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  const hasCustom = !!(project.iconUrl || project.iconEmoji);
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.25, pl: 1 }}>
      <CardActionArea
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setIconAnchor(e.currentTarget); }}
        sx={{
          display: 'flex', alignItems: 'center',
          px: 1.25, py: 0.6, borderRadius: 2,
          bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        <ProjectIcon
          iconUrl={project.iconUrl}
          iconEmoji={project.iconEmoji}
          size={16}
          radius={1}
          fallbackBg={`hsl(${hue}, 50%, 35%)`}
          fallbackContent={<FolderRoundedIcon sx={{ fontSize: 10, color: '#fff' }} />}
          emojiFontSize={11}
          sx={{ mr: 1 }}
        />
        <Typography sx={{
          color: active ? '#fff' : 'rgba(255,255,255,0.65)',
          fontSize: 12, fontWeight: active ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
        }}>
          {project.name}
        </Typography>
      </CardActionArea>

      <ProjectIconPicker
        anchorEl={iconAnchor}
        projectId={iconAnchor ? project.id : null}
        hasCustomIcon={hasCustom}
        onClose={() => setIconAnchor(null)}
      />
    </Box>
  );
}

// ── セクションヘッダー ─────────────────────────
function SectionHeader({ label, onAdd, addTitle }: { label: string; onAdd?: () => void; addTitle?: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.5 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      {onAdd && (
        <Tooltip title={addTitle ?? ''} placement="top">
          <IconButton
            size="small"
            onClick={onAdd}
            sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }, width: 20, height: 20 }}
          >
            <AddRoundedIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      )}
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

  const { teams, activeTeamId, isLoading: teamsLoading, loadTeams, setActiveTeamId } = useTeamsStore();

  const [searchQuery, setSearchQuery] = useState('');

  // Project dialogs
  const [activeRenameProject, setActiveRenameProject] = useState<any>(null);
  const [activeDeleteProject, setActiveDeleteProject] = useState<any>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Team project map: teamId → project[]
  const [teamProjectsMap, setTeamProjectsMap] = useState<Record<string, any[]>>({});
  const teamIds = useMemo(() => teams.map(t => t.id).join(','), [teams]);

  useEffect(() => {
    if (!currentUser) { setTeamProjectsMap({}); return; }
    fetchAllTeamProjectsForUser(currentUser.uid)
      .then(setTeamProjectsMap)
      .catch(() => setTeamProjectsMap({}));
  }, [currentUser?.uid, teamIds]);

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

        {/* ダッシュボード（＝アカウントサイト／マイページ） */}
        <CardActionArea
          onClick={() => { setActiveProjectId(null, 'home'); setCurrentMainView('my-site'); }}
          sx={{
            display: 'flex', alignItems: 'center',
            px: 1.25, py: 0.75, borderRadius: 2,
            bgcolor: currentMainView === 'my-site' ? 'rgba(255,255,255,0.08)' : 'transparent',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' }, mb: 2,
          }}
        >
          <Box sx={{ width: 20, height: 20, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0 }}>
            <DashboardRoundedIcon sx={{ fontSize: 16, color: currentMainView === 'my-site' ? '#3498db' : 'rgba(255,255,255,0.5)' }} />
          </Box>
          <Typography sx={{
            color: currentMainView === 'my-site' ? '#ffffff' : 'rgba(255,255,255,0.7)',
            fontSize: 12, fontWeight: currentMainView === 'my-site' ? 600 : 500,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
          }}>
            ダッシュボード
          </Typography>
        </CardActionArea>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {/* MY PROJECTS */}
        <Box sx={{ mb: 2, minWidth: 200 }}>
          <SectionHeader label="My Projects" />
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
          <SectionHeader label="Team Projects" />
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
