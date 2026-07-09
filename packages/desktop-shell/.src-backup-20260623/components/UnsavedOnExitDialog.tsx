import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Checkbox, ToggleButtonGroup, ToggleButton, CircularProgress, Divider,
} from '@mui/material';
import { useAppStore, type WorkingFileInfo } from '../store/useAppStore';
import { commitWorkingFile, type Visibility } from '../shared/services/workFileCommit';

const SCOPE_LABEL: Record<string, string> = {
  '3dss': 'S.Models', '3dsl': 'S.Layout', '3dsp': 'S.Presentations',
  '3dsc': 'S.Create', '3dsd': 'S.Diagram', '3dsr': 'S.Drawing',
};
const DIRTY_COLOR = '#ffb300';

interface Props {
  open: boolean;
  /** 終了をやめる */
  onCancel: () => void;
  /** ウィンドウを実際に閉じる */
  onProceedClose: () => void;
}

export const UnsavedOnExitDialog: React.FC<Props> = ({ open, onCancel, onProceedClose }) => {
  const workingFiles = useAppStore(s => s.workingFiles);
  const projects = useAppStore(s => s.projects);
  const setWorkingFile = useAppStore(s => s.setWorkingFile);

  const entries = useMemo(() => Object.entries(workingFiles) as [string, WorkingFileInfo][], [workingFiles]);

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [visByKey, setVisByKey] = useState<Record<string, Visibility>>({});
  const [saving, setSaving] = useState(false);

  // ダイアログを開くたびに全チェック（既定で保存対象）
  React.useEffect(() => {
    if (open) {
      const init: Record<string, boolean> = {};
      entries.forEach(([k]) => { init[k] = true; });
      setChecked(init);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id;
  const visOf = (key: string) => visByKey[key] ?? 'private';

  const handleSaveAndQuit = async () => {
    setSaving(true);
    try {
      for (const [key, info] of entries) {
        if (!checked[key]) continue; // 未チェックはローカル保持（次回再開）
        try {
          // eslint-disable-next-line no-await-in-loop
          await commitWorkingFile(info, { visibility: visOf(key) });
          setWorkingFile(key, null);
        } catch (e) {
          console.error('[ExitDialog] commit failed', info, e);
        }
      }
    } finally {
      setSaving(false);
      onProceedClose();
    }
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth
      slotProps={{ paper: { sx: { bgcolor: '#1a1c22', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } } }}>
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 700 }}>
        未保存のファイルがあります
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 2 }}>
          チェックした項目をクラウドに保存して終了します。新規ファイルは公開設定を選べます（既定は非公開）。
          チェックを外した項目はローカルに保存され、次回起動時に作業中データから再開できます。
        </Typography>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1 }} />
        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {entries.map(([key, info]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.75 }}>
              <Checkbox
                size="small" checked={!!checked[key]}
                onChange={(e) => setChecked(prev => ({ ...prev, [key]: e.target.checked }))}
                sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: DIRTY_COLOR }, p: 0.5 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{info.name}</Typography>
                <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                  {SCOPE_LABEL[info.scope] || info.scope} ・ {projectName(info.projectId)}{info.isNew ? ' ・ 新規' : ''}
                </Typography>
                {info.isNew && checked[key] && (
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>公開設定:</Typography>
                    <ToggleButtonGroup
                      size="small" exclusive value={visOf(key)}
                      onChange={(_, v) => v && setVisByKey(prev => ({ ...prev, [key]: v }))}
                      sx={{ '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', py: 0.1, px: 1, borderColor: 'rgba(255,255,255,0.15)' }, '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgba(255,179,0,0.25) !important' } }}
                    >
                      <ToggleButton value="private">非公開</ToggleButton>
                      <ToggleButton value="public">公開</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onCancel} disabled={saving} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>
          キャンセル
        </Button>
        <Button onClick={onProceedClose} disabled={saving} sx={{ color: 'rgba(255,255,255,0.7)', textTransform: 'none' }}>
          保存せずに終了
        </Button>
        <Button onClick={handleSaveAndQuit} disabled={saving} variant="contained"
          startIcon={saving ? <CircularProgress size={14} sx={{ color: '#1a1c22' }} /> : undefined}
          sx={{ bgcolor: DIRTY_COLOR, color: '#1a1c22', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#ffc233' } }}>
          保存して終了
        </Button>
      </DialogActions>
    </Dialog>
  );
};
