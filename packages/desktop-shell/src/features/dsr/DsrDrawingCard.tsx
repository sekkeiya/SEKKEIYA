import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useCoverThumbnail } from '../dsf/lib/useCoverThumbnail';

const ACCENT = '#4db6ac';

const CATEGORY_COLOR: Record<string, string> = {
  '設計図書': '#4db6ac',
  '家具図': '#ba68c8',
  '参考図面': '#ffb74d',
};

export interface DsrCardProps {
  item: any;
  variant: 'set' | 'drawing';
  active?: boolean;
  /** セットの子図面数（グリッド側で計算した実数。未指定なら item.childCount） */
  childCount?: number;
  onClick?: () => void;
  onDelete?: () => void;
}

const isImage = (format?: string) => ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes((format || '').toLowerCase());

export const DsrDrawingCard: React.FC<DsrCardProps> = ({ item, variant, active, childCount, onClick, onDelete }) => {
  const setCount = childCount ?? item.childCount ?? 0;
  const title = item.title || item.name || (variant === 'set' ? 'Untitled Set' : 'Untitled Drawing');
  const category = item.category as string | undefined;
  // PDF は 1 ページ目をサムネ化（保存はしない: persist=false）
  const cover = useCoverThumbnail(variant === 'drawing' ? item : null, false);

  return (
    <Box
      onClick={onClick}
      sx={{
        position: 'relative',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'pointer',
        bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)',
        border: `1px solid ${active ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
        boxShadow: active ? `0 0 0 1px ${ACCENT}` : 'none',
        transition: 'border-color 0.15s, transform 0.15s',
        '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.25)', transform: 'translateY(-2px)', '& .dsr-card-actions': { opacity: 1 } },
      }}
    >
      {/* Thumbnail */}
      <Box sx={{
        aspectRatio: '4 / 3',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))',
        position: 'relative',
      }}>
        {variant === 'set' ? (
          <FolderRoundedIcon sx={{ fontSize: 48, color: ACCENT, opacity: 0.85 }} />
        ) : isImage(item.format) && item.downloadUrl ? (
          <Box component="img" src={item.downloadUrl} alt={title}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (item.format || '').toLowerCase() === 'pdf' ? (
          cover ? (
            <Box component="img" src={cover} alt={title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
          ) : (
            <PictureAsPdfRoundedIcon sx={{ fontSize: 44, color: '#ef5350', opacity: 0.85 }} />
          )
        ) : (
          <ImageRoundedIcon sx={{ fontSize: 44, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
        )}

        {/* Format / child-count badge */}
        <Box sx={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 0.5 }}>
          {variant === 'set' ? (
            <Chip size="small" label={`${setCount} 枚`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)' }} />
          ) : item.format ? (
            <Chip size="small" label={String(item.format).toUpperCase()} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(0,0,0,0.6)', color: 'var(--brand-fg)' }} />
          ) : null}
        </Box>

        {/* Delete */}
        {onDelete && (
          <Box className="dsr-card-actions" sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, transition: 'opacity 0.15s' }}>
            <Tooltip title="削除" placement="top">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}
                sx={{ bgcolor: 'rgba(0,0,0,0.55)', color: 'rgb(var(--brand-fg-rgb) / 0.8)', '&:hover': { color: '#ff4d4f', bgcolor: 'rgba(0,0,0,0.7)' } }}>
                <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Meta */}
      <Box sx={{ px: 1.25, py: 1 }}>
        <Typography noWrap sx={{ color: 'var(--brand-fg)', fontSize: 12.5, fontWeight: 600 }}>{title}</Typography>
        {category && (
          <Chip size="small" label={category}
            sx={{ mt: 0.5, height: 18, fontSize: 10, color: 'var(--brand-fg)', bgcolor: `${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.15)'}33`, border: `1px solid ${CATEGORY_COLOR[category] || 'rgb(var(--brand-fg-rgb) / 0.2)'}55` }} />
        )}
      </Box>
    </Box>
  );
};
