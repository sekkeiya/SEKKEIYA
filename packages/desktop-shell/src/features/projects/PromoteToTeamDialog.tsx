import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  Radio, RadioGroup, FormControlLabel, Select, MenuItem, FormControl, Typography, Box, CircularProgress,
} from '@mui/material';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { BRAND } from '../../styles/theme';
import { fetchMyTeams, type Team } from '../teams/api/teamsApi';
import { promoteProjectToTeam } from './api/promoteProjectToTeam';
import type { DesktopProject } from './types';

interface Props {
  open: boolean;
  project: DesktopProject;
  uid: string;
  ownerName?: string;
  onClose: () => void;
  onDone: () => void;   // 昇格成功後（再読み込み用）
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'var(--brand-fg)',
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#00BFFF' },
  },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.7)' },
} as const;

export const PromoteToTeamDialog: React.FC<Props> = ({ open, project, uid, ownerName, onClose, onDone }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [newTeamName, setNewTeamName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setNewTeamName('');
    setLoadingTeams(true);
    fetchMyTeams(uid)
      .then(t => {
        setTeams(t);
        if (t.length > 0) { setMode('existing'); setSelectedTeamId(t[0].id); }
        else setMode('new');
      })
      .catch(e => { console.error('[PromoteToTeamDialog] fetchMyTeams failed', e); setMode('new'); })
      .finally(() => setLoadingTeams(false));
  }, [open, uid]);

  const canSubmit = mode === 'existing' ? !!selectedTeamId : newTeamName.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await promoteProjectToTeam({
        projectId: project.id,
        actingUserId: uid,
        ownerName,
        target: mode === 'existing'
          ? { kind: 'existing', teamId: selectedTeamId }
          : { kind: 'new', name: newTeamName.trim(), visibility: 'private' },
      });
      onDone();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? '昇格に失敗しました。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()}
      PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 460, borderRadius: 3, backgroundImage: 'none' } }}>
      <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
        <GroupsRoundedIcon sx={{ color: '#00BFFF' }} /> チームに昇格
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.85rem', mb: 2 }}>
          「{project.name}」をチームプロジェクトに昇格します。チームメンバーがアクセスできるようになります（既定ロール: 編集者）。<br />
          ※ この操作は元に戻せません（チーム→個人には戻せません）。
        </Typography>

        {loadingTeams ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} sx={{ color: '#00BFFF' }} /></Box>
        ) : (
          <RadioGroup value={mode} onChange={e => setMode(e.target.value as 'existing' | 'new')}>
            <FormControlLabel
              value="existing" disabled={teams.length === 0}
              control={<Radio sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-checked': { color: '#00BFFF' } }} />}
              label={<Typography sx={{ fontSize: '0.88rem', color: teams.length === 0 ? 'rgb(var(--brand-fg-rgb) / 0.3)' : 'var(--brand-fg)' }}>既存のチームを選択{teams.length === 0 ? '（所属チームなし）' : ''}</Typography>}
            />
            {mode === 'existing' && teams.length > 0 && (
              <FormControl size="small" sx={{ ml: 4, mb: 1, ...inputSx }}>
                <Select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
                  sx={{ color: 'var(--brand-fg)', minWidth: 280, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                  MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}>
                  {teams.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.85rem' }}>{t.name}（{t.memberIds.length}名）</MenuItem>)}
                </Select>
              </FormControl>
            )}
            <FormControlLabel
              value="new"
              control={<Radio sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-checked': { color: '#00BFFF' } }} />}
              label={<Typography sx={{ fontSize: '0.88rem' }}>新しいチームを作成</Typography>}
            />
            {mode === 'new' && (
              <TextField size="small" autoFocus placeholder="チーム名" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
                disabled={submitting} onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
                sx={{ ml: 4, mb: 1, minWidth: 280, ...inputSx }} />
            )}
          </RadioGroup>
        )}

        {error && <Typography sx={{ color: 'light-dark(#a50832, #fa9bb4)', fontSize: '0.8rem', mt: 1 }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={onClose} disabled={submitting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
        <Button onClick={handleSubmit} disabled={submitting || !canSubmit} variant="contained"
          sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 800, '&:hover': { bgcolor: '#4facfe' }, '&.Mui-disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
          {submitting ? '昇格中...' : 'チームに昇格'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
