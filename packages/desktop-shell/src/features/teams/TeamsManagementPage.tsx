import React, { useState } from 'react';
import {
  Box, Typography, Avatar, Chip, CardActionArea, CircularProgress, Divider,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { BRAND } from '../../styles/theme';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 45%)`;
};

export const TeamsManagementPage: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { teams, isLoading, addTeam, setActiveTeamId } = useTeamsStore();
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>('private');
  const [creating, setCreating] = useState(false);

  const handleTeamClick = (teamId: string) => {
    setActiveTeamId(teamId);
    setCurrentMainView('teams');
  };

  const openCreate = () => {
    setNewName(''); setNewDesc(''); setNewVisibility('private');
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!currentUser || !newName.trim()) return;
    setCreating(true);
    try {
      const team = await addTeam({
        ownerId: currentUser.uid,
        name: newName.trim(),
        description: newDesc.trim(),
        visibility: newVisibility,
      });
      setCreateOpen(false);
      setActiveTeamId(team.id);
      setCurrentMainView('teams' as any);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      <Box sx={{ px: { xs: 3, md: 5 }, pt: 4, pb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <GroupsRoundedIcon sx={{ fontSize: 26, color: '#3498db' }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: BRAND.text }}>チーム管理</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            sx={{
              bgcolor: '#3498db', color: '#fff', fontWeight: 700, fontSize: 13,
              textTransform: 'none', borderRadius: 2,
              '&:hover': { bgcolor: '#2980b9' },
            }}
          >
            新規チームを作成
          </Button>
        </Box>
        <Typography sx={{ fontSize: 13, color: BRAND.sub2 }}>
          参加中のチームを管理します。
        </Typography>
      </Box>

      <Divider sx={{ borderColor: BRAND.line, mx: { xs: 3, md: 5 } }} />

      <Box sx={{ px: { xs: 3, md: 5 }, pt: 3, flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress sx={{ color: '#3498db' }} />
          </Box>
        ) : teams.length === 0 ? (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            py: 10, borderRadius: 3, border: `1px dashed rgba(255,255,255,0.12)`,
            bgcolor: 'rgba(255,255,255,0.02)',
          }}>
            <GroupsRoundedIcon sx={{ fontSize: 56, color: BRAND.sub2, mb: 2 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 600, color: BRAND.sub, mb: 1 }}>
              チームがありません
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={openCreate}
              sx={{
                mt: 1, borderColor: 'rgba(52,152,219,0.4)', color: '#3498db',
                fontWeight: 700, textTransform: 'none', borderRadius: 2,
                '&:hover': { borderColor: '#3498db', bgcolor: 'rgba(52,152,219,0.08)' },
              }}
            >
              最初のチームを作成
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 2 }}>
            {teams.map(team => {
              const color = teamColor(team.name);
              return (
                <CardActionArea
                  key={team.id}
                  onClick={() => handleTeamClick(team.id)}
                  sx={{
                    borderRadius: 3, border: `1px solid ${BRAND.line}`,
                    bgcolor: 'rgba(255,255,255,0.03)', p: 2.5,
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5,
                    '&:hover': { bgcolor: 'rgba(52,152,219,0.06)', borderColor: 'rgba(52,152,219,0.3)' },
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                    <Avatar sx={{
                      width: 44, height: 44, bgcolor: color,
                      fontSize: 18, fontWeight: 700, borderRadius: 2, flexShrink: 0,
                    }}>
                      {team.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, mb: 0.25 }}>
                        {team.name}
                      </Typography>
                      <Chip
                        icon={team.visibility === 'public'
                          ? <PublicRoundedIcon sx={{ fontSize: '11px !important' }} />
                          : <LockRoundedIcon sx={{ fontSize: '11px !important' }} />}
                        label={team.visibility === 'public' ? '公開' : '非公開'}
                        size="small"
                        sx={{
                          fontSize: 10, height: 18,
                          bgcolor: 'rgba(255,255,255,0.08)', color: BRAND.sub,
                          '& .MuiChip-icon': { color: BRAND.sub },
                        }}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: BRAND.sub2 }}>
                    <GroupsRoundedIcon sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontSize: 12 }}>{team.memberIds.length}名のメンバー</Typography>
                  </Box>
                  {team.description && (
                    <Typography sx={{
                      fontSize: 12, color: BRAND.sub2, lineHeight: 1.5,
                      display: '-webkit-box', WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {team.description}
                    </Typography>
                  )}
                </CardActionArea>
              );
            })}
          </Box>
        )}
      </Box>

      <Dialog open={createOpen} onClose={() => !creating && setCreateOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700, fontSize: 15 }}>新しいチームを作成</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label="チーム名" value={newName} onChange={e => setNewName(e.target.value)}
            size="small" fullWidth autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) handleCreate(); }}
            sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
          />
          <TextField
            label="説明（任意）" value={newDesc} onChange={e => setNewDesc(e.target.value)}
            size="small" fullWidth multiline rows={2}
            sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: BRAND.sub }}>公開設定</InputLabel>
            <Select value={newVisibility} label="公開設定" onChange={e => setNewVisibility(e.target.value as 'public' | 'private')} sx={{ color: BRAND.text }}>
              <MenuItem value="public">公開</MenuItem>
              <MenuItem value="private">非公開</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} disabled={creating} sx={{ color: BRAND.sub, textTransform: 'none', fontWeight: 600 }}>キャンセル</Button>
          <Button onClick={handleCreate} disabled={!newName.trim() || creating} variant="contained"
            sx={{ bgcolor: '#3498db', color: '#fff', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#2980b9' } }}>
            {creating ? <CircularProgress size={16} color="inherit" /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
