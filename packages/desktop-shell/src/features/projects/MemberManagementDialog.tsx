import React, { useEffect, useState, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem,
  Typography, Box, CircularProgress, IconButton, Tooltip, Avatar, TextField, Divider,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { BRAND } from '../../styles/theme';
import type { DesktopProject, ProjectRole } from './types';
import { deriveRoles, ROLE_LABELS, ROLE_ORDER } from './roles';
import { setProjectRole, transferOwnership, removeProjectMember } from './api/projectRoles';

interface Props {
  open: boolean;
  project: DesktopProject;
  uid: string;            // 現在ユーザー（owner 前提で開く）
  onClose: () => void;
  onChanged: () => void;  // 変更後の再読み込み
}

interface MemberRow {
  uid: string;
  role: ProjectRole;
  displayName: string;
  photoURL?: string;
}

export const MemberManagementDialog: React.FC<Props> = ({ open, project, uid, onClose, onChanged }) => {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roles = deriveRoles({ roles: project.roles, ownerId: project.ownerId, memberIds: project.memberIds });
      const uids = Object.keys(roles);
      const profiles = await Promise.all(
        uids.map(async memberUid => {
          try {
            const snap = await getDoc(doc(db, 'users', memberUid));
            const d = snap.exists() ? snap.data() : null;
            return { uid: memberUid, displayName: d?.displayName || memberUid.slice(0, 6), photoURL: d?.photoURL };
          } catch {
            return { uid: memberUid, displayName: memberUid.slice(0, 6) };
          }
        })
      );
      const merged: MemberRow[] = profiles.map(p => ({ ...p, role: roles[p.uid] }));
      merged.sort((a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
        || (a.uid === uid ? -1 : b.uid === uid ? 1 : 0)
      );
      setRows(merged);
    } finally {
      setLoading(false);
    }
  }, [project, uid]);

  useEffect(() => {
    if (open) { loadMembers(); setInviteEmail(''); setInviteError(null); }
  }, [open, loadMembers]);

  const run = async (memberUid: string, fn: () => Promise<void>) => {
    setBusyUid(memberUid);
    setError(null);
    try {
      await fn();
      onChanged();
      await loadMembers();
    } catch (e: any) {
      setError(e?.message ?? '操作に失敗しました。');
    } finally {
      setBusyUid(null);
    }
  };

  const onRoleChange = (memberUid: string, role: ProjectRole) =>
    run(memberUid, () => setProjectRole({ projectId: project.id, actingUserId: uid, targetUid: memberUid, role }));
  const onTransfer = (memberUid: string) =>
    run(memberUid, () => transferOwnership({ projectId: project.id, actingUserId: uid, toUid: memberUid }));
  const onRemove = (memberUid: string) =>
    run(memberUid, () => removeProjectMember({ projectId: project.id, actingUserId: uid, targetUid: memberUid }));

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', email));
      const snap = await getDocs(q);
      if (snap.empty) {
        setInviteError(`「${email}」のアカウントが見つかりませんでした。`);
        return;
      }
      const targetUid = snap.docs[0].id;
      const currentRoles = deriveRoles({ roles: project.roles, ownerId: project.ownerId, memberIds: project.memberIds });
      if (currentRoles[targetUid]) {
        setInviteError('このユーザーはすでにメンバーです。');
        return;
      }
      await setProjectRole({ projectId: project.id, actingUserId: uid, targetUid, role: 'editor' });
      setInviteEmail('');
      onChanged();
      await loadMembers();
    } catch (e: any) {
      setInviteError(e?.message ?? '追加に失敗しました。');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busyUid && !inviting && onClose()}
      PaperProps={{ sx: { bgcolor: '#0e121c', color: '#fff', border: `1px solid ${BRAND.line}`, minWidth: 520, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsRoundedIcon sx={{ color: '#00BFFF' }} /> メンバー管理
        <Typography component="span" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 500 }}>— {project.name}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} sx={{ color: '#00BFFF' }} /></Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {rows.map(m => {
              const isSelf = m.uid === uid;
              const busy = busyUid === m.uid;
              return (
                <Box key={m.uid} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 1, borderRadius: 1.5, '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}>
                  <Avatar src={m.photoURL} sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'rgba(0,191,255,0.2)' }}>{m.displayName.slice(0, 1)}</Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 600, color: '#fff' }}>
                      {m.displayName}{isSelf && <Box component="span" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>（自分）</Box>}
                    </Typography>
                  </Box>

                  {busy ? <CircularProgress size={18} sx={{ color: '#00BFFF', mr: 1 }} /> : (
                    <>
                      <Select size="small" value={m.role} disabled={busy}
                        onChange={e => onRoleChange(m.uid, e.target.value as ProjectRole)}
                        sx={{ minWidth: 110, color: '#fff', fontSize: '0.8rem', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.18)' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } }}
                        MenuProps={{ slotProps: { paper: { sx: { bgcolor: '#1a1f2a', color: '#fff' } } } }}>
                        {ROLE_ORDER.map(r => <MenuItem key={r} value={r} sx={{ fontSize: '0.8rem' }}>{ROLE_LABELS[r]}</MenuItem>)}
                      </Select>
                      {m.role !== 'owner' && (
                        <Tooltip title="オーナーを譲渡">
                          <span><IconButton size="small" disabled={busy} onClick={() => onTransfer(m.uid)} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#f6c453' } }}><StarRoundedIcon sx={{ fontSize: '1.1rem' }} /></IconButton></span>
                        </Tooltip>
                      )}
                      {!isSelf && (
                        <Tooltip title="プロジェクトから除外">
                          <span><IconButton size="small" disabled={busy} onClick={() => onRemove(m.uid)} sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fa9bb4' } }}><PersonRemoveRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton></span>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
        {error && <Typography sx={{ color: '#fa9bb4', fontSize: '0.8rem', mt: 1.5 }}>{error}</Typography>}
        <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', mt: 2, mb: 1.5 }}>
          オーナー = 設定・削除・公開・メンバー管理 / 編集者 = 編集 / 閲覧者 = 閲覧のみ。オーナーは最低 1 名必要です。
        </Typography>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 1.5 }} />

        <Typography sx={{ fontSize: '0.76rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', mb: 1 }}>
          メンバーを追加
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="メールアドレスで検索..."
            type="email"
            value={inviteEmail}
            onChange={e => { setInviteEmail(e.target.value); setInviteError(null); }}
            onKeyDown={e => { if (e.key === 'Enter' && inviteEmail.trim()) handleInvite(); }}
            disabled={inviting}
            sx={{
              flex: 1,
              '& .MuiOutlinedInput-root': {
                color: '#fff', fontSize: '0.85rem',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
                '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
              },
            }}
          />
          <Button
            variant="contained"
            disabled={!inviteEmail.trim() || inviting}
            onClick={handleInvite}
            startIcon={inviting ? <CircularProgress size={14} color="inherit" /> : <PersonAddRoundedIcon sx={{ fontSize: '1rem !important' }} />}
            sx={{
              bgcolor: '#00BFFF', color: '#000', fontWeight: 700, fontSize: '0.8rem',
              textTransform: 'none', borderRadius: 1.5, whiteSpace: 'nowrap',
              '&:hover': { bgcolor: '#4facfe' },
              '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' },
            }}
          >
            追加
          </Button>
        </Box>
        {inviteError && <Typography sx={{ color: '#fa9bb4', fontSize: '0.78rem', mt: 0.75 }}>{inviteError}</Typography>}
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', mt: 0.75 }}>
          追加されたユーザーのデフォルトロールは「編集者」です。
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={onClose} disabled={!!busyUid || inviting} sx={{ color: 'rgba(255,255,255,0.7)' }}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};
