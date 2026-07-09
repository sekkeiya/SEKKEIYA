import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Avatar, Chip, IconButton, Tooltip, Button, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  TextField, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, CardActionArea,
} from '@mui/material';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MemberInvitePanel } from './components/MemberInvitePanel';
import { MemberRow } from './components/MemberRow';
import { useAppStore } from '../../store/useAppStore';
import { BRAND } from '../../styles/theme';
import { fetchTeamProjects, type TeamProject } from './api/teamsApi';
import { createProject } from '../projects/api/createProject';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 45%)`;
};

// ── 設定ダイアログ ──────────────────────────────────────
const TeamSettingsDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { teams, activeTeamId, editTeam, removeTeam, kickMember, exitTeam } = useTeamsStore();
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const team = teams.find(t => t.id === activeTeamId);

  const [tab, setTab] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [editVisibility, setEditVisibility] = React.useState<'public' | 'private'>('private');
  const [saving, setSaving] = React.useState(false);
  const [confirmDisband, setConfirmDisband] = React.useState(false);
  const [confirmLeave, setConfirmLeave] = React.useState(false);

  React.useEffect(() => {
    if (team) {
      setEditName(team.name);
      setEditDesc(team.description);
      setEditVisibility(team.visibility);
    }
  }, [team]);

  if (!team) return null;
  const isOwner = team.ownerId === currentUser?.uid;

  const handleSave = async () => {
    setSaving(true);
    try { await editTeam(team.id, { name: editName.trim(), description: editDesc.trim(), visibility: editVisibility }); }
    finally { setSaving(false); }
  };

  const handleDisband = async () => {
    await removeTeam(team.id);
    setConfirmDisband(false);
    onClose();
    setCurrentMainView('app-hub');
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    await exitTeam(team.id, currentUser.uid);
    setConfirmLeave(false);
    onClose();
    setCurrentMainView('app-hub');
  };

  const dialogPaper = {
    bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`,
    borderRadius: 3, backgroundImage: 'none', width: 560, maxHeight: '80vh',
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} PaperProps={{ sx: dialogPaper }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, py: 1.5, px: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: BRAND.text }}>チーム設定</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: BRAND.sub2 }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{
          px: 3, borderBottom: `1px solid ${BRAND.line}`,
          '& .MuiTab-root': { color: BRAND.sub, fontSize: 13, fontWeight: 600, textTransform: 'none', minWidth: 80 },
          '& .Mui-selected': { color: '#3498db' },
          '& .MuiTabs-indicator': { bgcolor: '#3498db' },
        }}>
          <Tab label="メンバー" />
          <Tab label="設定" />
        </Tabs>

        <DialogContent sx={{ p: 3, overflowY: 'auto' }}>
          {/* メンバータブ */}
          {tab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text }}>メンバー ({team.memberIds.length}名)</Typography>
                {isOwner && (
                  <Button variant="outlined" startIcon={<PersonAddRoundedIcon />} onClick={() => setInviteOpen(true)} size="small"
                    sx={{ borderColor: 'rgba(52,152,219,0.5)', color: '#3498db', fontSize: 12, textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#3498db', bgcolor: 'rgba(52,152,219,0.08)' } }}>
                    招待する
                  </Button>
                )}
              </Box>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: `1px solid ${BRAND.line}`, px: 2 }}>
                {team.memberIds.map(uid => (
                  <MemberRow key={uid} uid={uid} isOwner={uid === team.ownerId}
                    canRemove={isOwner && uid !== team.ownerId && uid !== currentUser?.uid}
                    onRemove={() => kickMember(team.id, uid)} />
                ))}
              </Box>
            </Box>
          )}

          {/* 設定タブ */}
          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <TextField label="チーム名" value={editName} onChange={e => setEditName(e.target.value)} disabled={!isOwner} size="small" fullWidth
                sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }} />
              <TextField label="説明" value={editDesc} onChange={e => setEditDesc(e.target.value)} disabled={!isOwner} size="small" fullWidth multiline rows={2}
                sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }} />
              <FormControl size="small" disabled={!isOwner}>
                <InputLabel sx={{ color: BRAND.sub }}>公開設定</InputLabel>
                <Select value={editVisibility} label="公開設定" onChange={e => setEditVisibility(e.target.value as 'public' | 'private')} sx={{ color: BRAND.text }}>
                  <MenuItem value="public">公開</MenuItem>
                  <MenuItem value="private">非公開</MenuItem>
                </Select>
              </FormControl>
              {isOwner && (
                <Button variant="contained" onClick={handleSave} disabled={saving || !editName.trim()}
                  sx={{ alignSelf: 'flex-start', bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}>
                  {saving ? <CircularProgress size={16} color="inherit" /> : '保存する'}
                </Button>
              )}
              <Divider sx={{ borderColor: 'rgba(239,68,68,0.2)', borderStyle: 'dashed', mt: 1 }} />
              {isOwner ? (
                <Button variant="outlined" startIcon={<DeleteRoundedIcon />} onClick={() => setConfirmDisband(true)}
                  sx={{ alignSelf: 'flex-start', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444', textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                  チームを解散する
                </Button>
              ) : (
                <Button variant="outlined" startIcon={<ExitToAppRoundedIcon />} onClick={() => setConfirmLeave(true)}
                  sx={{ alignSelf: 'flex-start', borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444', textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' } }}>
                  チームから退出する
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <MemberInvitePanel open={inviteOpen} onClose={() => setInviteOpen(false)} team={team} />

      {/* 解散確認 */}
      <Dialog open={confirmDisband} onClose={() => setConfirmDisband(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700 }}>チームを解散しますか？</DialogTitle>
        <DialogContent><Typography sx={{ color: BRAND.sub, fontSize: 13 }}>「{team.name}」を解散します。この操作は取り消せません。</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDisband(false)} sx={{ color: BRAND.sub, textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleDisband} sx={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>解散する</Button>
        </DialogActions>
      </Dialog>

      {/* 退出確認 */}
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700 }}>チームから退出しますか？</DialogTitle>
        <DialogContent><Typography sx={{ color: BRAND.sub, fontSize: 13 }}>「{team.name}」から退出します。再参加するには再度招待が必要です。</Typography></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmLeave(false)} sx={{ color: BRAND.sub, textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleLeave} sx={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>退出する</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ── TeamHomePage 本体 ──────────────────────────────────
export const TeamHomePage: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { teams, activeTeamId, setActiveTeamId } = useTeamsStore();
  const { setActiveProjectId, setCurrentMainView } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamProjects, setTeamProjects] = useState<TeamProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [addingProject, setAddingProject] = useState(false);

  const team = teams.find(t => t.id === activeTeamId);

  useEffect(() => {
    if (!team || !currentUser) return;
    setProjectsLoading(true);
    fetchTeamProjects(team.id, currentUser.uid)
      .then(setTeamProjects)
      .catch(err => {
        console.warn('fetchTeamProjects:', err);
        setTeamProjects([]);
      })
      .finally(() => setProjectsLoading(false));
  }, [team?.id, currentUser?.uid]);

  if (!team) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress sx={{ color: '#3498db' }} />
      </Box>
    );
  }

  const color = teamColor(team.name);
  const isOwner = team.ownerId === currentUser?.uid;

  const handleAddProject = async () => {
    if (!currentUser || !newProjectName.trim()) return;
    setAddingProject(true);
    try {
      const proj = await createProject({
        userId: currentUser.uid,
        ownerName: currentUser.email || 'User',
        projectName: newProjectName.trim(),
        isTeam: true,
        teamId: team.id,
        teamMemberIds: team.memberIds,
      });
      setTeamProjects(prev => [...prev, {
        id: proj.id,
        name: proj.name,
        ownerId: proj.ownerId,
        teamId: team.id,
        memberIds: proj.memberIds,
        createdAt: new Date().toISOString(),
      }]);
      setNewProjectName('');
      setAddProjectOpen(false);
    } finally {
      setAddingProject(false);
    }
  };

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId, 'home');
    setCurrentMainView('workspace');
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      {/* ── 戻るリンク ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 2 }}>
        <Button
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => setActiveTeamId(null)}
          size="small"
          sx={{ color: BRAND.sub2, textTransform: 'none', fontSize: 12, fontWeight: 500, px: 0.5, '&:hover': { color: BRAND.sub, bgcolor: 'transparent' } }}
        >
          チーム一覧
        </Button>
      </Box>

      {/* ── ヘッダー ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 1.5, pb: 3, display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
        <Avatar sx={{ width: 56, height: 56, bgcolor: color, fontSize: 22, fontWeight: 700, borderRadius: 2.5, flexShrink: 0 }}>
          {team.name.charAt(0).toUpperCase()}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: BRAND.text, lineHeight: 1.2 }}>
              {team.name}
            </Typography>
            <Chip
              icon={team.visibility === 'public'
                ? <PublicRoundedIcon sx={{ fontSize: '13px !important' }} />
                : <LockRoundedIcon sx={{ fontSize: '13px !important' }} />}
              label={team.visibility === 'public' ? '公開' : '非公開'}
              size="small"
              sx={{ fontSize: 11, bgcolor: 'rgba(255,255,255,0.08)', color: BRAND.sub, '& .MuiChip-icon': { color: BRAND.sub } }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75 }}>
            <Typography sx={{ fontSize: 13, color: BRAND.sub2 }}>
              {team.description || '説明なし'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: BRAND.sub2 }}>
              <GroupsRoundedIcon sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: 13 }}>{team.memberIds.length}名</Typography>
            </Box>
          </Box>
        </Box>

        <Tooltip title="チーム設定">
          <IconButton onClick={() => setSettingsOpen(true)} sx={{ color: BRAND.sub, '&:hover': { color: BRAND.text, bgcolor: 'rgba(255,255,255,0.06)' } }}>
            <SettingsRoundedIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: BRAND.line, mx: { xs: 3, md: 5 } }} />

      {/* ── チームプロジェクト ── */}
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 3, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text }}>チームプロジェクト</Typography>
          <Button
            variant="outlined" size="small" startIcon={<AddRoundedIcon />}
            onClick={() => { setNewProjectName(''); setAddProjectOpen(true); }}
            sx={{ borderColor: 'rgba(52,152,219,0.4)', color: '#3498db', fontSize: 12, textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#3498db', bgcolor: 'rgba(52,152,219,0.08)' } }}
          >
            プロジェクトを追加
          </Button>
        </Box>

        {projectsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#3498db' }} />
          </Box>
        ) : teamProjects.length === 0 ? (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            py: 8, borderRadius: 3, border: `1px dashed rgba(255,255,255,0.12)`,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}>
            <FolderOpenRoundedIcon sx={{ fontSize: 48, color: BRAND.sub2, mb: 1.5 }} />
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: BRAND.sub, mb: 0.5 }}>
              プロジェクトがありません
            </Typography>
            <Typography sx={{ fontSize: 12, color: BRAND.sub2, mb: 2.5, textAlign: 'center', maxWidth: 320 }}>
              チーム専用のプロジェクトを作成して、メンバーと共同作業できます
            </Typography>
            <Button
              variant="contained" size="small" startIcon={<AddRoundedIcon />}
              onClick={() => { setNewProjectName(''); setAddProjectOpen(true); }}
              sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}
            >
              最初のプロジェクトを作成
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
            {teamProjects.map(proj => {
              const hue = [...(proj.name || '')].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
              return (
                <CardActionArea
                  key={proj.id}
                  onClick={() => handleOpenProject(proj.id)}
                  sx={{
                    borderRadius: 2.5, border: `1px solid ${BRAND.line}`,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    p: 2, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  <Box sx={{
                    width: 36, height: 36, borderRadius: 2,
                    bgcolor: `hsl(${hue}, 50%, 35%)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1.5,
                  }}>
                    <FolderRoundedIcon sx={{ fontSize: 18, color: '#fff' }} />
                  </Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text, lineHeight: 1.3 }}>
                    {proj.name}
                  </Typography>
                </CardActionArea>
              );
            })}
          </Box>
        )}
      </Box>

      {/* 設定ダイアログ */}
      <TeamSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* プロジェクト追加ダイアログ */}
      <Dialog
        open={addProjectOpen}
        onClose={() => !addingProject && setAddProjectOpen(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none', minWidth: 360 } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${BRAND.line}`, py: 1.5, px: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: BRAND.text }}>プロジェクトを追加</Typography>
          <IconButton onClick={() => setAddProjectOpen(false)} size="small" sx={{ color: BRAND.sub2 }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important', px: 3 }}>
          <TextField
            label="プロジェクト名" value={newProjectName} onChange={e => setNewProjectName(e.target.value)}
            size="small" fullWidth autoFocus disabled={addingProject}
            onKeyDown={e => { if (e.key === 'Enter' && newProjectName.trim()) handleAddProject(); }}
            sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAddProjectOpen(false)} disabled={addingProject} sx={{ color: BRAND.sub, textTransform: 'none' }}>キャンセル</Button>
          <Button
            onClick={handleAddProject} disabled={!newProjectName.trim() || addingProject} variant="contained"
            sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}
          >
            {addingProject ? <CircularProgress size={16} color="inherit" /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
