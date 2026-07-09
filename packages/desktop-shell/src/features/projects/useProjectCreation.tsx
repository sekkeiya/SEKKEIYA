import { useState } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, MenuItem, Select, FormControl, InputLabel, CircularProgress, Avatar,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';

import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useTeamsStore } from '../../store/useTeamsStore';
import { createProject } from './api/createProject';
import { fetchUserProjects } from './api/fetchProjects';
import { UNNAMED_PROJECT } from '../sites/onboardingScript';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 42%)`;
};

/**
 * プロジェクト作成フロー（ミニサイドバー / アカウントサイト左サイドバー 共通）。
 * 方針: 名前入力ダイアログは挟まず、仮称で即作成 →「プロジェクトサイトを作成」対話画面へ。
 *   - My  : 即作成して対話へ
 *   - Team: チーム選択シートを 1 枚挟む（既存チーム選択 or 新規チーム作成）→ 作成して対話へ
 * 戻り値の teamSheet を任意の場所にレンダーする。
 */
export function useProjectCreation() {
  const currentUser = useAuthStore(s => s.currentUser);
  const projects = useAppStore(s => s.projects);
  const setProjects = useAppStore(s => s.setProjects);
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const setActiveWorkspaceId = useAppStore(s => s.setActiveWorkspaceId);
  const setAIDriveOpen = useAppStore(s => s.setAIDriveOpen);
  const setAIRenderOpen = useAppStore(s => s.setAIRenderOpen);
  const setAI3DCreateOpen = useAppStore(s => s.setAI3DCreateOpen);

  const teams = useTeamsStore(s => s.teams);
  const loadTeams = useTeamsStore(s => s.loadTeams);
  const addTeam = useTeamsStore(s => s.addTeam);

  const [isCreating, setIsCreating] = useState(false);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [newTeamMode, setNewTeamMode] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamVisibility, setNewTeamVisibility] = useState<'public' | 'private'>('private');

  // 作成したプロジェクトを開いて「サイトを作成」対話画面へ
  const openProjectSite = async (newProjectId: string) => {
    setAIDriveOpen(false); setAIRenderOpen(false); setAI3DCreateOpen(false);
    setActiveProjectId(newProjectId, 'home');
    setActiveWorkspaceId(null);
    setCurrentMainView('workspace');
    if (currentUser) {
      const fetched = await fetchUserProjects(currentUser.uid);
      setProjects(fetched);
    }
  };

  const createMyProject = async () => {
    if (!currentUser || isCreating) return;
    setIsCreating(true);
    try {
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: UNNAMED_PROJECT,
      });
      setProjects([newProject as any, ...projects]);
      await openProjectSite(newProject.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const openTeamSheet = () => {
    if (currentUser) loadTeams(currentUser.uid);
    setSelectedTeamId(null);
    setNewTeamMode(teams.length === 0);
    setNewTeamName('');
    setNewTeamVisibility('private');
    setTeamSheetOpen(true);
  };

  /** scope に応じて作成フローを開始する（＋ボタンのメニュー用）。 */
  const startCreate = (scope: 'my' | 'team') => {
    if (scope === 'team') openTeamSheet();
    else createMyProject();
  };

  const createTeamProject = async () => {
    if (!currentUser || isCreating) return;
    setIsCreating(true);
    try {
      let team = teams.find(t => t.id === selectedTeamId) || null;
      if (newTeamMode) {
        if (!newTeamName.trim()) { setIsCreating(false); return; }
        team = await addTeam({
          ownerId: currentUser.uid,
          name: newTeamName.trim(),
          description: '',
          visibility: newTeamVisibility,
        });
      }
      if (!team) { setIsCreating(false); return; }
      const newProject = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: UNNAMED_PROJECT,
        isTeam: true,
        teamId: team.id,
        teamMemberIds: team.memberIds,
      });
      setTeamSheetOpen(false);
      await openProjectSite(newProject.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const teamSheet = (
    <Dialog
      open={teamSheetOpen}
      onClose={() => !isCreating && setTeamSheetOpen(false)}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { bgcolor: '#1a1e27', color: '#fff', borderRadius: 3, border: '1px solid rgba(255,255,255,0.1)', backgroundImage: 'none' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, fontSize: 16, fontWeight: 700 }}>
        <GroupsRoundedIcon sx={{ color: '#3498db' }} />
        どのチームに作成しますか？
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 2, fontSize: 12.5 }}>
          チームを選ぶと、その配下に新しいプロジェクトを作成し、続けて「プロジェクトサイトを作成」対話画面が開きます。
        </Typography>

        {teams.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
            {teams.map(team => {
              const selected = !newTeamMode && selectedTeamId === team.id;
              return (
                <Box
                  key={team.id}
                  onClick={() => { setNewTeamMode(false); setSelectedTeamId(team.id); }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25,
                    borderRadius: 2, cursor: 'pointer',
                    bgcolor: selected ? 'rgba(52,152,219,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    '&:hover': { bgcolor: selected ? 'rgba(52,152,219,0.22)' : 'rgba(255,255,255,0.06)' },
                  }}
                >
                  <Avatar sx={{ width: 28, height: 28, bgcolor: teamColor(team.name), fontSize: 13, fontWeight: 700 }}>
                    {team.name.trim().charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, minWidth: 0 }} noWrap>{team.name}</Typography>
                </Box>
              );
            })}
          </Box>
        )}

        <Box
          onClick={() => setNewTeamMode(true)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: 2, cursor: 'pointer',
            bgcolor: newTeamMode ? 'rgba(52,152,219,0.18)' : 'transparent',
            border: `1px dashed ${newTeamMode ? 'rgba(52,152,219,0.5)' : 'rgba(255,255,255,0.2)'}`,
            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
          }}
        >
          <AddRoundedIcon sx={{ fontSize: 20, color: '#3498db' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>新しいチームを作成</Typography>
        </Box>

        {newTeamMode && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
            <TextField
              label="チーム名" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              size="small" fullWidth autoFocus disabled={isCreating}
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
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
        <Button onClick={() => setTeamSheetOpen(false)} disabled={isCreating} sx={{ color: 'rgba(255,255,255,0.6)', textTransform: 'none', fontWeight: 600 }}>
          キャンセル
        </Button>
        <Button
          onClick={createTeamProject}
          disabled={isCreating || (newTeamMode ? !newTeamName.trim() : !selectedTeamId)}
          variant="contained"
          sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}
        >
          {isCreating ? <CircularProgress size={16} color="inherit" /> : '作成して対話へ'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { isCreating, startCreate, createMyProject, openTeamSheet, teamSheet };
}
