import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Tabs, Tab, Avatar, Chip, Button, IconButton,
  TextField, Select, MenuItem, FormControl, InputLabel, Divider,
  CircularProgress, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import ExitToAppRoundedIcon from '@mui/icons-material/ExitToAppRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { useTeamsStore } from '../../store/useTeamsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MemberInvitePanel } from './components/MemberInvitePanel';
import { fetchTeam } from './api/teamsApi';
import type { Team } from './api/teamsApi';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { BRAND } from '../../styles/theme';
import { useAppStore } from '../../store/useAppStore';

const teamColor = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffff;
  return `hsl(${h % 360}, 60%, 45%)`;
};

const MemberRow: React.FC<{
  uid: string;
  isOwner: boolean;
  canRemove: boolean;
  onRemove: () => void;
}> = ({ uid, isOwner, canRemove, onRemove }) => {
  const [profile, setProfile] = useState<{ displayName: string; photoURL: string } | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then(s => {
      if (s.exists()) {
        const d = s.data();
        setProfile({ displayName: d.displayName || 'ユーザー', photoURL: d.photoURL || '' });
      }
    });
  }, [uid]);

  return (
    <Box
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
        borderBottom: `1px solid ${BRAND.line}`,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Avatar src={profile?.photoURL} sx={{ width: 38, height: 38, bgcolor: '#3498db', fontSize: 14 }}>
        {profile?.displayName?.charAt(0)?.toUpperCase() ?? '?'}
      </Avatar>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
          {profile?.displayName ?? uid.slice(0, 8) + '...'}
        </Typography>
        {isOwner && (
          <Typography sx={{ fontSize: 11, color: '#3498db' }}>オーナー</Typography>
        )}
      </Box>
      {canRemove && (
        <Tooltip title="削除">
          <IconButton size="small" onClick={onRemove} sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}>
            <DeleteRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export const TeamDetailPage: React.FC = () => {
  const currentUser = useAuthStore(s => s.currentUser);
  const { teams, activeTeamId, setActiveTeamId, editTeam, removeTeam, kickMember, exitTeam } = useTeamsStore();
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  const [tab, setTab] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [saving, setSaving] = useState(false);

  const team = teams.find(t => t.id === activeTeamId);

  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');

  useEffect(() => {
    if (team) {
      setEditName(team.name);
      setEditDesc(team.description);
      setEditVisibility(team.visibility);
    }
  }, [team]);

  if (!team) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#3498db' }} />
      </Box>
    );
  }

  const isOwner = team.ownerId === currentUser?.uid;
  const color = teamColor(team.name);

  const handleSave = async () => {
    setSaving(true);
    try {
      await editTeam(team.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        visibility: editVisibility,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisband = async () => {
    await removeTeam(team.id);
    setConfirmDisband(false);
    setCurrentMainView('my-site');
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    await exitTeam(team.id, currentUser.uid);
    setConfirmLeave(false);
    setCurrentMainView('my-site');
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
      {/* Header */}
      <Box
        sx={{
          px: 4, py: 3,
          borderBottom: `1px solid ${BRAND.line}`,
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >
        <IconButton
          onClick={() => setActiveTeamId(null)}
          sx={{ color: BRAND.sub, mr: 0.5 }}
        >
          <ArrowBackRoundedIcon />
        </IconButton>
        <Avatar
          sx={{
            width: 52, height: 52, bgcolor: color,
            fontSize: 20, fontWeight: 700, borderRadius: 2,
          }}
        >
          {team.name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 700, color: BRAND.text }}>
              {team.name}
            </Typography>
            <Chip
              icon={team.visibility === 'public' ? <PublicRoundedIcon sx={{ fontSize: '13px !important' }} /> : <LockRoundedIcon sx={{ fontSize: '13px !important' }} />}
              label={team.visibility === 'public' ? '公開' : '非公開'}
              size="small"
              sx={{
                fontSize: 11, bgcolor: 'rgba(255,255,255,0.08)', color: BRAND.sub,
                '& .MuiChip-icon': { color: BRAND.sub },
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 13, color: BRAND.sub2, mt: 0.3 }}>
            {team.description || '説明なし'} · <GroupsRoundedIcon sx={{ fontSize: 13, verticalAlign: 'middle' }} /> {team.memberIds.length}名
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          px: 4,
          borderBottom: `1px solid ${BRAND.line}`,
          '& .MuiTab-root': { color: BRAND.sub, fontSize: 13, fontWeight: 600, textTransform: 'none', minWidth: 80 },
          '& .Mui-selected': { color: '#3498db' },
          '& .MuiTabs-indicator': { bgcolor: '#3498db' },
        }}
      >
        <Tab label="メンバー" />
        <Tab label="設定" />
      </Tabs>

      <Box sx={{ px: 4, py: 3, maxWidth: 680, width: '100%', mx: 'auto' }}>
        {/* Members Tab */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text }}>
                メンバー ({team.memberIds.length}名)
              </Typography>
              {isOwner && (
                <Button
                  variant="outlined"
                  startIcon={<PersonAddRoundedIcon />}
                  onClick={() => setInviteOpen(true)}
                  size="small"
                  sx={{
                    borderColor: 'rgba(52,152,219,0.5)', color: '#3498db', fontSize: 12,
                    textTransform: 'none', borderRadius: 2,
                    '&:hover': { borderColor: '#3498db', bgcolor: 'rgba(52,152,219,0.08)' },
                  }}
                >
                  招待する
                </Button>
              )}
            </Box>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2, border: `1px solid ${BRAND.line}`, px: 2 }}>
              {team.memberIds.map(uid => (
                <MemberRow
                  key={uid}
                  uid={uid}
                  isOwner={uid === team.ownerId}
                  canRemove={isOwner && uid !== team.ownerId && uid !== currentUser?.uid}
                  onRemove={() => kickMember(team.id, uid)}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Settings Tab */}
        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: BRAND.text, mb: 2 }}>
                チーム情報
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="チーム名"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  disabled={!isOwner}
                  size="small"
                  fullWidth
                  sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
                />
                <TextField
                  label="説明"
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  disabled={!isOwner}
                  size="small"
                  fullWidth
                  multiline
                  rows={2}
                  sx={{ '& .MuiInputBase-input': { color: BRAND.text }, '& .MuiInputLabel-root': { color: BRAND.sub } }}
                />
                <FormControl size="small" disabled={!isOwner}>
                  <InputLabel sx={{ color: BRAND.sub }}>公開設定</InputLabel>
                  <Select
                    value={editVisibility}
                    label="公開設定"
                    onChange={e => setEditVisibility(e.target.value as 'public' | 'private')}
                    sx={{ color: BRAND.text }}
                  >
                    <MenuItem value="public">公開</MenuItem>
                    <MenuItem value="private">非公開</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              {isOwner && (
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving || !editName.trim()}
                  sx={{
                    mt: 2, bgcolor: '#3498db', color: '#fff', fontWeight: 700,
                    textTransform: 'none', borderRadius: 2,
                    '&:hover': { bgcolor: '#2980b9' },
                  }}
                >
                  {saving ? <CircularProgress size={16} color="inherit" /> : '保存する'}
                </Button>
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(239,68,68,0.2)', borderStyle: 'dashed' }} />

            <Box>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#ef4444', mb: 2 }}>
                危険な操作
              </Typography>
              {isOwner ? (
                <Button
                  variant="outlined"
                  startIcon={<DeleteRoundedIcon />}
                  onClick={() => setConfirmDisband(true)}
                  sx={{
                    borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444', fontSize: 13,
                    textTransform: 'none', borderRadius: 2,
                    '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
                  }}
                >
                  チームを解散する
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<ExitToAppRoundedIcon />}
                  onClick={() => setConfirmLeave(true)}
                  sx={{
                    borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444', fontSize: 13,
                    textTransform: 'none', borderRadius: 2,
                    '&:hover': { borderColor: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
                  }}
                >
                  チームから退出する
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Invite Panel */}
      <MemberInvitePanel
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        team={team}
      />

      {/* Confirm Disband */}
      <Dialog open={confirmDisband} onClose={() => setConfirmDisband(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none' } }}
      >
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700 }}>チームを解散しますか？</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: BRAND.sub, fontSize: 13 }}>
            「{team.name}」を解散します。この操作は取り消せません。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDisband(false)} sx={{ color: BRAND.sub, textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleDisband} sx={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>解散する</Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Leave */}
      <Dialog open={confirmLeave} onClose={() => setConfirmLeave(false)}
        PaperProps={{ sx: { bgcolor: 'rgba(14,18,28,0.98)', border: `1px solid ${BRAND.line}`, borderRadius: 3, backgroundImage: 'none' } }}
      >
        <DialogTitle sx={{ color: BRAND.text, fontWeight: 700 }}>チームから退出しますか？</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: BRAND.sub, fontSize: 13 }}>
            「{team.name}」から退出します。再参加するには再度招待が必要です。
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmLeave(false)} sx={{ color: BRAND.sub, textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleLeave} sx={{ color: '#ef4444', fontWeight: 700, textTransform: 'none' }}>退出する</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
