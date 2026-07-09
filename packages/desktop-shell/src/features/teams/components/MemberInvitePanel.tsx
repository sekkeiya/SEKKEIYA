import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, Box, Typography, TextField,
  Avatar, IconButton, Button, Chip, CircularProgress, Divider,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useAuthStore } from '../../../store/useAuthStore';
import { fetchMutualFollows, fetchPendingInvitations, sendInvitation, cancelInvitation } from '../api/teamsApi';
import type { MutualFollowUser, TeamInvitation, Team } from '../api/teamsApi';
import { BRAND } from '../../../styles/theme';

const planMemberLimits: Record<string, number> = { free: 5, standard: 20, premium: Infinity };

interface Props {
  open: boolean;
  onClose: () => void;
  team: Team;
}

export const MemberInvitePanel: React.FC<Props> = ({ open, onClose, team }) => {
  const currentUser = useAuthStore(s => s.currentUser);
  const [mutuals, setMutuals] = useState<MutualFollowUser[]>([]);
  const [pending, setPending] = useState<TeamInvitation[]>([]);
  const [search, setSearch] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingUid, setSendingUid] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const userPlan = (currentUser as any)?.plan ?? 'free';
  const memberLimit = planMemberLimits[userPlan] ?? 5;
  const memberCount = team.memberIds.length;
  const atLimit = memberCount >= memberLimit;

  useEffect(() => {
    if (!open || !currentUser) return;
    let active = true;
    setLoading(true);
    Promise.all([
      fetchMutualFollows(currentUser.uid),
      fetchPendingInvitations(team.id),
    ]).then(([m, p]) => {
      if (!active) return;
      setMutuals(m);
      setPending(p);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [open, currentUser, team.id]);

  const pendingUids = new Set(pending.map(p => p.inviteeUid).filter(Boolean));
  const memberSet = new Set(team.memberIds);

  const filteredMutuals = mutuals.filter(u =>
    u.displayName.toLowerCase().includes(search.toLowerCase())
  );

  const handleInviteUid = async (user: MutualFollowUser) => {
    if (!currentUser || atLimit) return;
    setSendingUid(user.uid);
    try {
      await sendInvitation({
        teamId: team.id,
        teamName: team.name,
        invitedBy: currentUser.uid,
        invitedByName: currentUser.displayName || currentUser.email || 'ユーザー',
        inviteeUid: user.uid,
        inviteeEmail: null,
      });
      const refreshed = await fetchPendingInvitations(team.id);
      setPending(refreshed);
    } finally {
      setSendingUid(null);
    }
  };

  const handleInviteEmail = async () => {
    if (!currentUser || !emailInput.trim() || atLimit) return;
    setSendingEmail(true);
    try {
      await sendInvitation({
        teamId: team.id,
        teamName: team.name,
        invitedBy: currentUser.uid,
        invitedByName: currentUser.displayName || currentUser.email || 'ユーザー',
        inviteeUid: null,
        inviteeEmail: emailInput.trim(),
      });
      setEmailInput('');
      const refreshed = await fetchPendingInvitations(team.id);
      setPending(refreshed);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCancel = async (inv: TeamInvitation) => {
    setCancellingId(inv.id);
    try {
      await cancelInvitation(team.id, inv.id);
      setPending(p => p.filter(i => i.id !== inv.id));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
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
      <DialogTitle
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${BRAND.line}`, py: 2, px: 3,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: BRAND.text }}>
            メンバーを招待
          </Typography>
          <Typography sx={{ fontSize: 12, color: BRAND.sub2, mt: 0.3 }}>
            {memberCount} / {memberLimit === Infinity ? '無制限' : `${memberLimit}名`}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: BRAND.sub2 }}>
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        {atLimit && (
          <Box sx={{ mx: 3, mt: 2, px: 2, py: 1.5, bgcolor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 2 }}>
            <Typography sx={{ fontSize: 12, color: '#ef4444' }}>
              メンバー上限（{memberLimit}名）に達しています。プランをアップグレードすると追加招待できます。
            </Typography>
          </Box>
        )}

        {/* 相互フォローから招待 */}
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: BRAND.sub, letterSpacing: '0.06em', mb: 1.5 }}>
            相互フォロー
          </Typography>
          <TextField
            size="small"
            placeholder="名前で検索..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            fullWidth
            sx={{
              mb: 1.5,
              '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 2 },
              '& .MuiInputBase-input': { color: BRAND.text, fontSize: 13 },
            }}
          />
        </Box>

        <Box sx={{ maxHeight: 220, overflowY: 'auto', px: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={22} sx={{ color: '#3498db' }} />
            </Box>
          ) : filteredMutuals.length === 0 ? (
            <Typography sx={{ fontSize: 13, color: BRAND.sub2, py: 2, textAlign: 'center' }}>
              相互フォロー中のユーザーがいません
            </Typography>
          ) : (
            filteredMutuals.map(user => {
              const isMember = memberSet.has(user.uid);
              const isInvited = pendingUids.has(user.uid);
              const isSending = sendingUid === user.uid;
              return (
                <Box
                  key={user.uid}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, py: 1.2,
                    borderBottom: `1px solid ${BRAND.line}`,
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Avatar src={user.photoURL} sx={{ width: 36, height: 36, bgcolor: '#3498db', fontSize: 13 }}>
                    {user.displayName.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: BRAND.text }}>
                      {user.displayName}
                    </Typography>
                    {user.bio && (
                      <Typography sx={{ fontSize: 11, color: BRAND.sub2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.bio}
                      </Typography>
                    )}
                  </Box>
                  {isMember ? (
                    <Chip label="参加中" size="small" sx={{ fontSize: 11, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: BRAND.sub }} />
                  ) : isInvited ? (
                    <Chip label="招待済" size="small" sx={{ fontSize: 11, bgcolor: 'rgba(52,152,219,0.15)', color: '#3498db' }} />
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={atLimit || isSending}
                      onClick={() => handleInviteUid(user)}
                      startIcon={isSending ? <CircularProgress size={12} color="inherit" /> : <PersonAddRoundedIcon sx={{ fontSize: '14px !important' }} />}
                      sx={{
                        fontSize: 12, textTransform: 'none', borderRadius: 2,
                        borderColor: 'rgba(52,152,219,0.5)', color: '#3498db',
                        '&:hover': { borderColor: '#3498db', bgcolor: 'rgba(52,152,219,0.08)' },
                      }}
                    >
                      招待
                    </Button>
                  )}
                </Box>
              );
            })
          )}
        </Box>

        <Divider sx={{ mx: 3, my: 2, borderColor: BRAND.line }} />

        {/* メールで招待 */}
        <Box sx={{ px: 3, pb: 2 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: BRAND.sub, letterSpacing: '0.06em', mb: 1.5 }}>
            メールアドレスで招待
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="user@example.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInviteEmail()}
              type="email"
              sx={{
                flex: 1,
                '& .MuiInputBase-root': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', borderRadius: 2 },
                '& .MuiInputBase-input': { color: BRAND.text, fontSize: 13 },
              }}
            />
            <Button
              variant="contained"
              disabled={!emailInput.trim() || atLimit || sendingEmail}
              onClick={handleInviteEmail}
              sx={{
                bgcolor: '#3498db', color: 'var(--brand-fg)', fontWeight: 700, fontSize: 12,
                textTransform: 'none', borderRadius: 2, px: 2, whiteSpace: 'nowrap',
                '&:hover': { bgcolor: '#2980b9' },
              }}
            >
              {sendingEmail ? <CircularProgress size={14} color="inherit" /> : '送信'}
            </Button>
          </Box>
        </Box>

        {/* 保留中の招待 */}
        {pending.length > 0 && (
          <>
            <Divider sx={{ mx: 3, borderColor: BRAND.line }} />
            <Box sx={{ px: 3, py: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: BRAND.sub, letterSpacing: '0.06em', mb: 1.5 }}>
                保留中の招待 ({pending.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {pending.map(inv => (
                  <Box
                    key={inv.id}
                    sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      px: 1.5, py: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderRadius: 2,
                    }}
                  >
                    <Typography sx={{ fontSize: 12, color: BRAND.sub }}>
                      {inv.inviteeEmail || inv.inviteeUid || '不明'}
                    </Typography>
                    <Button
                      size="small"
                      variant="text"
                      disabled={cancellingId === inv.id}
                      onClick={() => handleCancel(inv)}
                      sx={{ fontSize: 11, color: BRAND.sub2, textTransform: 'none', minWidth: 0 }}
                    >
                      {cancellingId === inv.id ? <CircularProgress size={12} color="inherit" /> : '取消'}
                    </Button>
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
