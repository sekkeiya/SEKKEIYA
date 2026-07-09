import React, { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { RenderWithContext } from './hooks/useDslRendersForScope';

const DSL_ACCENT = '#00BFFF';

function toMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'string') return new Date(val).getTime();
  if (val?.seconds) return val.seconds * 1000;
  if (val?.toMillis) return val.toMillis();
  return 0;
}

function formatDate(createdAt: any): string {
  const ms = toMs(createdAt);
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

interface DslRenderCardProps {
  item: RenderWithContext;
  cardSize: number;
  isSelected: boolean;
  onSelect: (item: RenderWithContext) => void;
  isOwner?: boolean;
  onDelete?: (item: RenderWithContext) => void;
  onSetHero?: (item: RenderWithContext) => void;
  onVisibilityToggle?: (item: RenderWithContext) => void;
}

export const DslRenderCard: React.FC<DslRenderCardProps> = ({
  item,
  cardSize,
  isSelected,
  onSelect,
  isOwner = false,
  onDelete,
  onSetHero,
  onVisibilityToggle,
}) => {
  const isVideo = item.type === 'video';
  const isCycles = item.quality === 'cycles';
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [acting, setActing] = useState(false);

  const isPublic = (item as any).visibility === 'public';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      // Auto-cancel confirm state after 3s
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    setActing(true);
    try {
      await onDelete?.(item);
    } finally {
      setActing(false);
      setConfirmDelete(false);
    }
  };

  const handleSetHero = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (acting) return;
    setActing(true);
    try {
      await onSetHero?.(item);
    } finally {
      setActing(false);
    }
  };

  const handleVisibilityToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (acting) return;
    setActing(true);
    try {
      await onVisibilityToggle?.(item);
    } finally {
      setActing(false);
    }
  };

  const handleOpenInNew = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) window.open(item.url, '_blank');
  };

  return (
    <Box
      data-model-card="true"
      onPointerDown={() => onSelect(item)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      sx={{
        width: cardSize,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden',
        border: `1.5px solid ${isSelected ? DSL_ACCENT : hovered ? 'rgb(var(--brand-fg-rgb) / 0.22)' : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
        background: isSelected ? alpha(DSL_ACCENT, 0.06) : 'rgb(var(--brand-fg-rgb) / 0.02)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: isSelected
          ? `0 0 0 1px ${alpha(DSL_ACCENT, 0.25)}, 0 4px 16px ${alpha(DSL_ACCENT, 0.12)}`
          : hovered
          ? '0 4px 16px rgba(0,0,0,0.45)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Thumbnail */}
      <Box
        sx={{
          position: 'relative',
          aspectRatio: '16/9',
          background: 'rgba(0,0,0,0.4)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {item.url ? (
          <Box
            component="img"
            src={item.url}
            alt={item.shotName}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform 0.25s',
              transform: hovered ? 'scale(1.04)' : 'scale(1)',
            }}
          />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isVideo
              ? <MovieRoundedIcon sx={{ fontSize: 28, opacity: 0.2 }} />
              : <ImageRoundedIcon sx={{ fontSize: 28, opacity: 0.2 }} />}
          </Box>
        )}

        {/* Type badge */}
        <Box sx={{ position: 'absolute', top: 5, left: 5 }}>
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.4,
              px: 0.75, py: 0.25, borderRadius: 0.75,
              background: "color-mix(in srgb, var(--brand-bg) 65%, transparent)", backdropFilter: 'blur(4px)',
            }}
          >
            {isVideo
              ? <MovieRoundedIcon sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)" }} />
              : <ImageRoundedIcon sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)" }} />}
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: "color-mix(in srgb, var(--brand-fg) 85%, transparent)", lineHeight: 1 }}>
              {isVideo ? 'Movie' : 'Image'}
            </Typography>
          </Box>
        </Box>

        {/* Quality badge */}
        <Box sx={{ position: 'absolute', top: 5, right: 5 }}>
          <Box
            sx={{
              px: 0.75, py: 0.25, borderRadius: 0.75,
              background: isCycles ? alpha('#a78bfa', 0.8) : alpha('#6c87ff', 0.7),
              backdropFilter: 'blur(4px)',
            }}
          >
            <Typography sx={{ fontSize: 9, fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1 }}>
              {isCycles ? 'Cycles' : '標準'}
            </Typography>
          </Box>
        </Box>

        {/* Duration badge (video) */}
        {isVideo && item.durationSec != null && (
          <Box sx={{ position: 'absolute', bottom: 5, right: 5 }}>
            <Box sx={{ px: 0.75, py: 0.25, borderRadius: 0.75, background: "color-mix(in srgb, var(--brand-bg) 72%, transparent)" }}>
              <Typography sx={{ fontSize: 10, fontWeight: 600, color: 'var(--brand-fg)', lineHeight: 1 }}>
                {formatDuration(item.durationSec)}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Hover action overlay (top-right quick actions) */}
        <Box
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            display: 'flex',
            gap: 0.4,
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.15s, transform 0.15s',
            pointerEvents: hovered ? 'auto' : 'none',
            zIndex: 5,
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Open in new tab */}
          {item.url && (
            <Tooltip title="フルサイズで開く" placement="top">
              <IconButton
                size="small"
                onClick={handleOpenInNew}
                sx={{
                  width: 26, height: 26,
                  background: 'rgb(var(--slate-panel-rgb) / 0.85)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
                  '&:hover': { background: 'rgb(var(--slate-800-rgb) / 0.95)' },
                }}
              >
                <OpenInNewRoundedIcon sx={{ fontSize: 13, color: 'var(--brand-fg)' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Selection highlight */}
        {isSelected && (
          <Box
            sx={{
              position: 'absolute', inset: 0,
              border: `2px solid ${DSL_ACCENT}`,
              borderRadius: 'inherit',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* Info + Action bar */}
      <Box
        sx={{
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.25,
          position: 'relative',
        }}
      >
        <Typography sx={{
          fontSize: 12, fontWeight: 700, color: 'var(--brand-fg)',
          lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.shotName || item.id}
        </Typography>
        <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 38%, transparent)", lineHeight: 1.2 }}>
          {item.width}×{item.height} px
        </Typography>
        <Typography sx={{
          fontSize: 10, color: alpha(DSL_ACCENT, 0.7), lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.planName}
        </Typography>
        <Typography sx={{ fontSize: 10, color: "color-mix(in srgb, var(--brand-fg) 28%, transparent)", lineHeight: 1.2, mt: 0.25 }}>
          {formatDate(item.createdAt)}
        </Typography>

        {/* Owner action bar — appears on hover */}
        {isOwner && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 0.4,
              px: 0.75,
              background: 'linear-gradient(to top, rgb(var(--slate-deep-rgb) / 0.96) 70%, rgb(var(--slate-deep-rgb) / 0))',
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
              pointerEvents: hovered ? 'auto' : 'none',
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Visibility toggle */}
            <Tooltip title={isPublic ? '非公開にする' : '公開する'} placement="top">
              <IconButton
                size="small"
                onClick={handleVisibilityToggle}
                disabled={acting}
                sx={{
                  width: 28, height: 28,
                  background: 'rgb(var(--slate-panel-rgb) / 0.8)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  '&:hover': { background: 'rgb(var(--slate-800-rgb) / 0.95)' },
                }}
              >
                {isPublic
                  ? <PublicRoundedIcon sx={{ fontSize: 14, color: '#34d399' }} />
                  : <LockRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#aa7c03, #fbbf24)' }} />}
              </IconButton>
            </Tooltip>

            {/* Set as hero thumbnail */}
            <Tooltip title="レイアウトのサムネに設定" placement="top">
              <IconButton
                size="small"
                onClick={handleSetHero}
                disabled={acting || !!(item as any).isHero}
                sx={{
                  width: 28, height: 28,
                  background: 'rgb(var(--slate-panel-rgb) / 0.8)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
                  '&:hover': { background: 'rgb(var(--slate-800-rgb) / 0.95)' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                <StarRoundedIcon sx={{ fontSize: 14, color: (item as any).isHero ? '#f59e0b' : 'rgb(var(--brand-fg-rgb) / 0.65)' }} />
              </IconButton>
            </Tooltip>

            {/* Delete */}
            <Tooltip
              title={confirmDelete ? '本当に削除しますか？もう一度クリック' : '削除'}
              placement="top"
            >
              <IconButton
                size="small"
                onClick={handleDelete}
                disabled={acting}
                sx={{
                  width: 28, height: 28,
                  background: confirmDelete ? 'rgba(239,68,68,0.25)' : 'rgb(var(--slate-panel-rgb) / 0.8)',
                  border: `1px solid ${confirmDelete ? 'rgba(239,68,68,0.5)' : 'rgb(var(--brand-fg-rgb) / 0.08)'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                  '&:hover': {
                    background: confirmDelete ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.2)',
                    borderColor: 'rgba(239,68,68,0.5)',
                  },
                }}
              >
                {confirmDelete
                  ? <WarningAmberRoundedIcon sx={{ fontSize: 14, color: '#ef4444' }} />
                  : <DeleteOutlineRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#a50808, #f87171)' }} />}
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );
};
