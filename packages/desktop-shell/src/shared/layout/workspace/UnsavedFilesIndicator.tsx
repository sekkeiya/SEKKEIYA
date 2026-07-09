import React, { useState } from 'react';
import {
  Box, Popover, Typography, Button, IconButton, Tooltip, CircularProgress,
  ToggleButtonGroup, ToggleButton, Divider,
} from '@mui/material';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useAppStore, type WorkingFileInfo } from '../../../store/useAppStore';
import { commitWorkingFile, type Visibility } from '../../services/workFileCommit';

const SCOPE_LABEL: Record<string, string> = {
  '3dss': 'S.Model', '3dsl': 'S.Layout', '3dsp': 'S.Slide',
  '3dsc': 'S.Create', '3dsd': 'S.Diagram', '3dsr': 'S.Drawing',
};

const DIRTY_COLOR = '#ffb300';

export const UnsavedFilesIndicator: React.FC = () => {
  const workingFiles = useAppStore(s => s.workingFiles);
  const projects = useAppStore(s => s.projects);
  const setWorkingFile = useAppStore(s => s.setWorkingFile);

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [visByKey, setVisByKey] = useState<Record<string, Visibility>>({});

  const entries = Object.entries(workingFiles) as [string, WorkingFileInfo][];
  const count = entries.length;
  if (count === 0) return null;

  const projectName = (id: string) => projects.find(p => p.id === id)?.name || id;
  const visOf = (key: string) => visByKey[key] ?? 'private';

  const saveOne = async (key: string, info: WorkingFileInfo) => {
    setSavingKeys(prev => new Set(prev).add(key));
    try {
      await commitWorkingFile(info, { visibility: visOf(key) });
      setWorkingFile(key, null);
    } catch (e) {
      console.error('[UnsavedFiles] save failed', e);
      alert(`「${info.name}」の保存に失敗しました。`);
    } finally {
      setSavingKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const saveAll = async () => {
    for (const [key, info] of entries) {
      // eslint-disable-next-line no-await-in-loop
      await saveOne(key, info);
    }
  };

  return (
    <>
      <Tooltip title={`未保存のファイル: ${count}`} placement="bottom">
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            height: '100%', px: 1, flexShrink: 0, cursor: 'pointer',
            color: DIRTY_COLOR,
            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' },
          }}
        >
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DIRTY_COLOR, boxShadow: `0 0 6px ${DIRTY_COLOR}` }} />
          <Typography variant="caption" sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{count}</Typography>
        </Box>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 340, maxWidth: 420 } } }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>未保存のファイル（{count}）</Typography>
          <Button size="small" variant="contained" startIcon={<SaveRoundedIcon sx={{ fontSize: 14 }} />}
            onClick={saveAll}
            sx={{ textTransform: 'none', fontSize: '0.72rem', bgcolor: DIRTY_COLOR, color: '#1a1c22', '&:hover': { bgcolor: '#ffc233' } }}
          >
            すべて保存
          </Button>
        </Box>
        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)' }} />
        <Box sx={{ maxHeight: 360, overflowY: 'auto', p: 1 }}>
          {entries.map(([key, info]) => {
            const saving = savingKeys.has(key);
            return (
              <Box key={key} sx={{ p: 1, borderRadius: 1, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{info.name}</Typography>
                    <Typography noWrap sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                      {SCOPE_LABEL[info.scope] || info.scope} ・ {projectName(info.projectId)}
                      {info.isNew ? ' ・ 新規' : ''}
                    </Typography>
                  </Box>
                  <IconButton size="small" disabled={saving} onClick={() => saveOne(key, info)} sx={{ color: DIRTY_COLOR }}>
                    {saving ? <CircularProgress size={14} sx={{ color: DIRTY_COLOR }} /> : <SaveRoundedIcon sx={{ fontSize: 16 }} />}
                  </IconButton>
                </Box>
                {info.isNew && (
                  <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>公開設定:</Typography>
                    <ToggleButtonGroup
                      size="small" exclusive value={visOf(key)}
                      onChange={(_, v) => v && setVisByKey(prev => ({ ...prev, [key]: v }))}
                      sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', fontSize: '0.66rem', py: 0.1, px: 1, borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgba(255,179,0,0.25) !important' } }}
                    >
                      <ToggleButton value="private">非公開</ToggleButton>
                      <ToggleButton value="public">公開</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Popover>
    </>
  );
};
