import React, { useState } from 'react';
import { Box, Typography, Button, Divider, Chip, TextField, MenuItem, ToggleButtonGroup, ToggleButton } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { DSI_CATEGORIES, type DsiCategory } from '../store/useDsiStore';

const ACCENT = '#ec407a';
const ACCENT_HOVER = '#f48fb1';

const metaFieldSx = {
  '& .MuiOutlinedInput-root': {
    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
} as const;

const SOURCE_LABEL: Record<string, string> = {
  'manual-upload': '手動アップロード',
  'layout-render': 'S.Layout レンダー',
  'ai-render': 'AI Render 生成',
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
    <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</Typography>
    <Typography sx={{ fontSize: 12, color: '#fff', textAlign: 'right', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ?? '—'}</Typography>
  </Box>
);

interface DsiRightPanelProps {
  item: any | null;
  /** 移動先候補のセット一覧 */
  sets?: any[];
  /** 画像を別セットへ移動（null でセットから外す） */
  onMove?: (item: any, newSetId: string | null) => void;
  /** 公開可視性の切り替え */
  onSetVisibility?: (item: any, visibility: 'public' | 'private') => void;
  /** カテゴリ・タグの更新 */
  onUpdateMeta?: (item: any, fields: { category?: DsiCategory; tags?: string[] }) => void;
}

export const DsiRightPanel: React.FC<DsiRightPanelProps> = ({ item, sets = [], onMove, onSetVisibility, onUpdateMeta }) => {
  const [tagInput, setTagInput] = useState('');

  if (!item) {
    return (
      <Box sx={{ p: 3, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
        画像/動画を選択すると詳細が表示されます
      </Box>
    );
  }

  const created = item.createdAt
    ? new Date(typeof item.createdAt === 'number' ? item.createdAt : item.createdAt?.toMillis?.() ?? item.createdAt).toLocaleDateString('ja-JP')
    : undefined;
  const isVideo = item.mediaType === 'video';
  const url = item.downloadUrl;

  return (
    <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#fff', mb: 1.5 }}>{isVideo ? '動画情報' : '画像情報'}</Typography>

      {/* Preview */}
      {url && (
        <Box sx={{ borderRadius: 1.5, overflow: 'hidden', mb: 1.5, bgcolor: 'rgba(0,0,0,0.3)', aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo ? (
            <Box component="video" src={url} controls sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Box component="img" src={url} alt={item.title} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </Box>
      )}

      {item.category && (
        <Chip size="small" label={item.category} sx={{ alignSelf: 'flex-start', mb: 1.5, height: 20, color: '#fff', bgcolor: `${ACCENT}33`, border: `1px solid ${ACCENT}55` }} />
      )}

      <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#fff', mb: 1, wordBreak: 'break-word' }}>{item.title || item.name}</Typography>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 1 }} />

      <Row label="種別" value={isVideo ? '動画' : '画像'} />
      <Row label="形式" value={item.format ? String(item.format).toUpperCase() : undefined} />
      {item.width && item.height ? <Row label="解像度" value={`${item.width}×${item.height}`} /> : null}
      {item.sizeBytes ? <Row label="サイズ" value={formatBytes(item.sizeBytes)} /> : null}
      <Row label="取得元" value={SOURCE_LABEL[item.sourceType] || '手動アップロード'} />
      <Row label="作成日" value={created} />

      {onMove && (
        <Box sx={{ mt: 1.5 }}>
          <TextField
            select size="small" fullWidth label="セット" variant="outlined"
            value={item.parentSetId ?? ''}
            onChange={(e) => onMove(item, e.target.value || null)}
            InputProps={{ style: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.6)' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: ACCENT },
              },
              '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
            }}
          >
            <MenuItem value="">（セットなし）</MenuItem>
            {sets.map(s => <MenuItem key={s.id} value={s.id}>{s.title || 'セット'}</MenuItem>)}
          </TextField>
        </Box>
      )}

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

      {/* カテゴリ・タグ編集（S.Image の検索に使用） */}
      {onUpdateMeta && (
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
          <TextField
            select size="small" fullWidth label="カテゴリ" variant="outlined"
            value={(DSI_CATEGORIES as readonly string[]).includes(item.category) ? item.category : ''}
            onChange={(e) => onUpdateMeta(item, { category: e.target.value as DsiCategory })}
            InputProps={{ style: { color: '#fff', fontSize: 13 } }}
            InputLabelProps={{ style: { color: 'rgba(255,255,255,0.6)' } }}
            sx={metaFieldSx}
          >
            {DSI_CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>

          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', mt: 1.75, mb: 0.5 }}>タグ</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            {(Array.isArray(item.tags) ? item.tags : []).map((t: string) => (
              <Chip
                key={t} size="small" label={t}
                onDelete={() => onUpdateMeta(item, { tags: (item.tags || []).filter((x: string) => x !== t) })}
                sx={{ height: 22, fontSize: 10, color: '#fff', bgcolor: `${ACCENT}22`, border: `1px solid ${ACCENT}44` }}
              />
            ))}
            <TextField
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = tagInput.trim();
                  if (t && !(item.tags || []).includes(t)) onUpdateMeta(item, { tags: [...(item.tags || []), t] });
                  setTagInput('');
                }
              }}
              size="small" placeholder="＋タグ" variant="standard"
              sx={{ width: 72, '& input': { fontSize: 11, color: '#fff', py: 0.25 }, '& .MuiInput-underline:before': { borderColor: 'rgba(255,255,255,0.2)' } }}
            />
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {url && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          <Button
            fullWidth size="small" variant="contained" startIcon={<OpenInNewRoundedIcon />}
            onClick={() => window.open(url, '_blank')}
            sx={{ bgcolor: ACCENT, color: '#fff', '&:hover': { bgcolor: ACCENT_HOVER } }}
          >
            開く
          </Button>
          <Button
            fullWidth size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
            component="a" href={url} download target="_blank"
            sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', '&:hover': { borderColor: ACCENT } }}
          >
            ダウンロード
          </Button>
        </Box>
      )}
    </Box>
  );
};
