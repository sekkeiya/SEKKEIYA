import React from 'react';
import { Box, Typography, Button, Divider, Chip, TextField, MenuItem, ToggleButtonGroup, ToggleButton } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';

const ACCENT = '#4db6ac';

/** Tauri デスクトップ webview では window.open は機能しないため、plugin-opener 経由で外部ブラウザを開く（Web では window.open にフォールバック） */
const openExternal = (url?: string) => {
  if (!url) return;
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => {
      if (openUrl) openUrl(url);
      else window.open(url, '_blank');
    })
    .catch(() => window.open(url, '_blank'));
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
    <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, color: 'var(--brand-fg)', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</Typography>
  </Box>
);

interface DsrRightPanelProps {
  item: any | null;
  /** 移動先候補のセット一覧 */
  sets?: any[];
  /** 図面を別セットへ移動（null でセットから外す） */
  onMove?: (item: any, newSetId: string | null) => void;
  /** 公開可視性の切り替え */
  onSetVisibility?: (item: any, visibility: 'public' | 'private') => void;
  /** アプリ内ビューアで開く */
  onOpen?: (item: any) => void;
}

export const DsrRightPanel: React.FC<DsrRightPanelProps> = ({ item, sets = [], onMove, onSetVisibility, onOpen }) => {
  if (!item) {
    return (
      <Box sx={{ p: 3, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 12 }}>
        図面を選択すると詳細が表示されます
      </Box>
    );
  }

  const created = item.createdAt
    ? new Date(typeof item.createdAt === 'number' ? item.createdAt : item.createdAt?.toMillis?.() ?? item.createdAt).toLocaleDateString('ja-JP')
    : undefined;

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-fg)', mb: 1.5 }}>図面情報</Typography>

      {item.category && (
        <Chip size="small" label={item.category} sx={{ alignSelf: 'flex-start', mb: 1.5, height: 20, color: 'var(--brand-fg)', bgcolor: `${ACCENT}33`, border: `1px solid ${ACCENT}55` }} />
      )}

      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-fg)', mb: 1, wordBreak: 'break-word' }}>{item.title || item.name}</Typography>

      <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.08)', my: 1 }} />

      <Row label="形式" value={item.format ? String(item.format).toUpperCase() : undefined} />
      <Row label="サイズ" value={formatBytes(item.sizeBytes)} />
      <Row label="作成日" value={created} />

      {onMove && (
        <Box sx={{ mt: 1.5 }}>
          <TextField
            select size="small" fullWidth label="セット" variant="outlined"
            value={item.parentSetId ?? ''}
            onChange={(e) => onMove(item, e.target.value || null)}
            InputProps={{ style: { color: 'var(--brand-fg)', fontSize: 13 } }}
            InputLabelProps={{ style: { color: 'rgb(var(--brand-fg-rgb) / 0.6)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' },
                '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
              '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)' },
            }}
          >
            <MenuItem value="">（セットなし）</MenuItem>
            {sets.map(s => <MenuItem key={s.id} value={s.id}>{s.title || 'セット'}</MenuItem>)}
          </TextField>
        </Box>
      )}

      {onSetVisibility && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 0.5 }}>公開設定</Typography>
          <ToggleButtonGroup
            exclusive size="small" fullWidth
            value={item.visibility === 'public' ? 'public' : 'private'}
            onChange={(_, v) => { if (v) onSetVisibility(item, v); }}
            sx={{
              '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', fontSize: 12, textTransform: 'none', py: 0.5 },
              '& .Mui-selected': { color: '#000 !important', bgcolor: `${ACCENT} !important` },
            }}
          >
            <ToggleButton value="private"><LockRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />非公開</ToggleButton>
            <ToggleButton value="public"><PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />公開</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {item.downloadUrl && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          <Button
            fullWidth size="small" variant="contained" startIcon={<OpenInNewRoundedIcon />}
            onClick={() => (onOpen ? onOpen(item) : openExternal(item.downloadUrl))}
            sx={{ bgcolor: ACCENT, color: '#000', '&:hover': { bgcolor: '#80cbc4' } }}
          >
            開く
          </Button>
          <Button
            fullWidth size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
            onClick={() => openExternal(item.downloadUrl)}
            sx={{ color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: ACCENT } }}
          >
            ダウンロード
          </Button>
        </Box>
      )}
    </Box>
  );
};
