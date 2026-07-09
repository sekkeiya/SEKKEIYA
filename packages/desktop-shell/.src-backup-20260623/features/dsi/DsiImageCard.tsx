import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import PlayCircleOutlineRoundedIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

const ACCENT = '#ec407a';

const CATEGORY_COLOR: Record<string, string> = {
  '静止画': '#ec407a',
  '動画': '#7e57c2',
  'AIレンダー': '#26a69a',
};

const SOURCE_LABEL: Record<string, string> = {
  'layout-render': 'S.Layout',
  'ai-render': 'AI Render',
};

export interface DsiCardProps {
  item: any;
  variant: 'set' | 'image';
  active?: boolean;
  /** セットの子枚数（グリッド側で計算した実数。未指定なら item.childCount） */
  childCount?: number;
  onClick?: () => void;
  onDelete?: () => void;
}

export const DsiImageCard: React.FC<DsiCardProps> = ({ item, variant, active, childCount, onClick, onDelete }) => {
  const setCount = childCount ?? item.childCount ?? 0;
  const title = item.title || item.name || (variant === 'set' ? 'Untitled Set' : 'Untitled');
  const category = item.category as string | undefined;
  const isVideo = item.mediaType === 'video';
  const isLinked = item.sourceType === 'layout-render' || item.sourceType === 'ai-render';

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.08)'}`,
        boxShadow: active ? `0 0 0 1px ${ACCENT}` : 'none',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: 'rgba(255,255,255,0.25)', transform: 'translateY(-2px)', '& .dsi-card-actions': { opacity: 1 } },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{
        aspectRatio: '4 / 3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.25)',
        position: 'relative',
      }}>
        {variant === 'set' ? (
          <FolderRoundedIcon sx={{ fontSize: 48, color: ACCENT, opacity: 0.85 }} />
        ) : isVideo ? (
          item.downloadUrl ? (
            <>
              <Box component="video" src={item.downloadUrl} muted preload="metadata"
                sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <PlayCircleOutlineRoundedIcon sx={{ position: 'absolute', fontSize: 40, color: 'rgba(255,255,255,0.9)', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }} />
            </>
          ) : (
            <MovieRoundedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.4)' }} />
          )
        ) : (item.thumbnailUrl || item.downloadUrl) ? (
          <Box component="img" src={item.thumbnailUrl || item.downloadUrl} alt={title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <ImageRoundedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.4)' }} />
        )}

        {/* Badges (top-left) */}
        <Box sx={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 0.5 }}>
          {variant === 'set' ? (
            <Chip size="small" label={`${setCount} 点`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff' }} />
          ) : isLinked ? (
            <Chip size="small" icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 11, color: '#fff !important' }} />} label={SOURCE_LABEL[item.sourceType] || 'リンク'}
              sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', '& .MuiChip-label': { pl: 0.5 } }} />
          ) : null}
        </Box>

        {/* Delete */}
        {onDelete && (
          <Box className="dsi-card-actions" sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.15s' }}>
            <Tooltip title="削除" placement="top">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.8)', '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(0,0,0,0.7)' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Meta */}
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography noWrap sx={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>{title}</Typography>
        {category && (
          <Chip size="small" label={category}
            sx={{ mt: 0.5, height: 18, fontSize: 10, color: '#fff', bgcolor: `${CATEGORY_COLOR[category] || 'rgba(255,255,255,0.15)'}33`, border: `1px solid ${CATEGORY_COLOR[category] || 'rgba(255,255,255,0.2)'}55` }} />
        )}
      </Box>
    </Box>
  );
};
