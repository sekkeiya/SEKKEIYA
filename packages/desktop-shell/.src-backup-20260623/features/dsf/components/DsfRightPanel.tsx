import React from 'react';
import { Box, Typography, Button, Divider, Chip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { useCoverThumbnail } from '../lib/useCoverThumbnail';

const ACCENT = '#7e57c2';

const formatBytes = (bytes?: number) => {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
};

const Row: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, color: '#fff', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</Typography>
  </Box>
);

interface DsfRightPanelProps {
  item: any | null;
  /** 本ビューアを開く */
  onOpen?: (item: any) => void;
  /** 公開可視性の切り替え */
  onSetVisibility?: (item: any, visibility: 'public' | 'private') => void;
}

export const DsfRightPanel: React.FC<DsfRightPanelProps> = ({ item, onOpen, onSetVisibility }) => {
  // フックは早期 return より前で無条件に呼ぶ（hooks ルール）。item が null でも安全。
  // 表示のみ（バックフィルはグリッドのカード側で実施するため persist=false）。
  const thumb = useCoverThumbnail(item, false);
  if (!item) {
    return (
      <Box sx={{ p: 3, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        ポートフォリオを選択すると詳細が表示されます
      </Box>
    );
  }

  const created = item.createdAt
    ? new Date(typeof item.createdAt === 'number' ? item.createdAt : item.createdAt?.toMillis?.() ?? item.createdAt).toLocaleDateString('ja-JP')
    : undefined;

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mb: 1.5 }}>ポートフォリオ情報</Typography>

      {/* Cover preview */}
      <Box sx={{ aspectRatio: '3 / 4', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'rgba(0,0,0,0.3)', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `3px solid ${ACCENT}` }}>
        {thumb ? (
          <Box component="img" src={thumb} alt={item.title} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <MenuBookRoundedIcon sx={{ fontSize: 40, color: ACCENT, opacity: 0.8 }} />
        )}
      </Box>

      {item.category && (
        <Chip size="small" label={item.category} sx={{ alignSelf: 'flex-start', mb: 1.5, height: 20, color: '#fff', bgcolor: `${ACCENT}33`, border: `1px solid ${ACCENT}55` }} />
      )}

      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1, wordBreak: 'break-word' }}>{item.title || item.name}</Typography>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

      <Row label="形式" value={item.format ? String(item.format).toUpperCase() : 'PDF'} />
      <Row label="サイズ" value={formatBytes(item.sizeBytes)} />
      <Row label="作成日" value={created} />

      {onSetVisibility && (
        <Box sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>公開設定</Typography>
          <ToggleButtonGroup
            exclusive size="small" fullWidth
            value={item.visibility === 'public' ? 'public' : 'private'}
            onChange={(_, v) => { if (v) onSetVisibility(item, v); }}
            sx={{
              '& .MuiToggleButton-root': { color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)', fontSize: 12, textTransform: 'none', py: 0.5 },
              '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT} !important` },
            }}
          >
            <ToggleButton value="private"><LockRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />非公開</ToggleButton>
            <ToggleButton value="public"><PublicRoundedIcon sx={{ fontSize: 14, mr: 0.5 }} />公開</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
        <Button
          fullWidth size="small" variant="contained" startIcon={<MenuBookRoundedIcon />}
          onClick={() => onOpen?.(item)}
          sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: '#9575cd' } }}
        >
          本を開く
        </Button>
        {item.downloadUrl && (
          <Button
            fullWidth size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
            component="a" href={item.downloadUrl} download
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: ACCENT } }}
          >
            ダウンロード
          </Button>
        )}
      </Box>
    </Box>
  );
};
