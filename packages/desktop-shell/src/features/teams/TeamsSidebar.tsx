import React, { useEffect, useState } from 'react';
import {
  Box, Typography, IconButton, Tooltip, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Button, CircularProgress,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { BRAND } from '../../styles/theme';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 45%)`;
};

export const TeamsSidebar: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { teams, activeTeamId, isLoading, loadTeams, addTeam, setActiveTeamId } = useTeamsStore();
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newVisibility, setNewVisibility] = useState<'public' | 'private'>('private');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentUser) loadTeams(currentUser.uid);
  }, [currentUser]);

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
      setNewName('');
      setNewDesc('');
      setNewVisibility('private');
      setActiveTeamId(team.id);
      setCurrentMainView('teams' as any);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectTeam = (teamId: string) => {
    setActiveTeamId(teamId);
    setCurrentMainView('teams' as any);
  };

  return (
    <Box
      sx={{
        width: 220,
        height: '100%',
        bgcolor: BRAND.bg,
        borderRight: `1px solid ${BRAND.line}`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2, py: 1.5,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${BRAND.line}`,
        }}
      >
        <Typography
          sx={{
            fontSize: 11, fontWeight: 700, color: BRAND.sub2,
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          TEAMS
        </Typography>
        <Tooltip title="新しいチームを作成" placement="right">
          <IconButton size="small" onClick={() => setCreateOpen(true)} sx={{ color: BRAND.sub2, '&:hover': { color: BRAND.text } }}>
            <AddRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Team List */}
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
            <CircularProgress size={20} sx={{ color: '#3498db' }} />
          </Box>
        ) : teams.length === 0 ? (
          <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
            <GroupsRoundedIcon sx={{ fontSize: 32, color: BRAND.sub2, mb: 1 }} />
            <Typography sx={{ fontSize: 12, color: BRAND.sub2, lineHeight: 1.5 }}>
              チームがありません{'\n'}
              「+」から作成できます
            </Typography>
          </Box>
        ) : (
          teams.map(team => {
            const color = teamColor(team.name);
            const isActive = team.id === activeTeamId;
            return (
              <Box
                key={team.id}
                onClick={() => handleSelectTeam(team.id)}
                sx={{
                  mx: 1, mb: 0.5, px: 1.5, py: 1,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  borderRadius: 1.5,
                  cursor: 'pointer',
                  bgcolor: isActive ? 'rgba(52,152,219,0.12)' : 'transparent',
                  '&:hover': { bgcolor: isActive ? 'rgba(52,152,219,0.15)' : 'rgb(var(--brand-fg-rgb) / 0.04)' },
                  transition: 'background-color 0.15s',
                }}
              >
                <Avatar
                  sx={{
                    width: 28, height: 28, bgcolor: color,
                    fontSize: 11, fontWeight: 700, borderRadius: 1, flexShrink: 0,
                  }}
                >
                  {team.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    noWrap
                    sx={{
                      fontSize: 13, fontWeight: isActive ? 700 : 500,
                      color: isActive ? '#3498db' : BRAND.text,
                    }}
                  >
                    {team.name}
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: BRAND.sub2 }}>
                    {team.memberIds.length}名
                  </Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Create Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(14,18,28,0.98)',
            border: `1px solid ${BRAND.line}`,
            borderRadius: 3,
            backgroundImage: 'none',
          },
        }}
      >
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700, fontSize: 15 }}>
          新しいチームを作成
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <TextField
            label="チーム名"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            size="small"
            fullWidth
            autoFocus
            sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
          />
          <TextField
            label="説明（任意）"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
            sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
          />
          <FormControl size="small" fullWidth>
            <InputLabel sx={{ color: BRAND.sub }}>公開設定</InputLabel>
            <Select
              value={newVisibility}
              label="公開設定"
              onChange={e => setNewVisibility(e.target.value as 'public' | 'private')}
              sx={{ color: BRAND.text }}
            >
              <MenuItem value="public">公開</MenuItem>
              <MenuItem value="private">非公開</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setCreateOpen(false)}
            sx={{ color: BRAND.sub, textTransform: 'none', fontWeight: 600 }}
          >
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            variant="contained"
            sx={{
              bgcolor: '#3498db', color: 'var(--brand-fg)', fontWeight: 700,
              textTransform: 'none', borderRadius: 2,
              '&:hover': { bgcolor: '#2980b9' },
            }}
          >
            {creating ? <CircularProgress size={16} color="inherit" /> : '作成'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
