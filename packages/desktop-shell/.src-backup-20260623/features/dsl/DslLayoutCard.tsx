import React, { useState } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';

interface DslLayoutCardProps {
  item: {
    id: string;
    name?: string;
    title?: string;
    type?: 'base' | 'plan' | 'option';
    thumbnailUrl?: string;
    rendersCount?: number;
    updatedAt?: any;
    createdAt?: any;
    projectId?: string;
    workspaceId?: string;
  };
  cardSize?: number;
  isSelected?: boolean;
  onSelect?: (item: any) => void;
  onDoubleClick?: (item: any) => void;
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const d = ts?.toDate?.() ?? (typeof ts === 'string' ? new Date(ts) : ts instanceof Date ? ts : null);
  if (!d) return '';
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function resolveType(item: { type?: string; planType?: string }): string {
  // planType ('base'|'plan'|'option') is authoritative; fall back to type field
  return item.planType ?? item.type ?? '';
}

function typeLabel(type?: string) {
  switch (type) {
    case 'base': return 'Base';
    case 'option': return 'Option';
    case 'plan': return 'Plan';
    default: return 'Layout';
  }
}

function typeColor(type?: string) {
  switch (type) {
    case 'base': return '#34d399';
    case 'option': return '#f472b6';
    default: return '#00BFFF';
  }
}

export const DslLayoutCard: React.FC<DslLayoutCardProps> = ({
  item,
  cardSize = 210,
  isSelected = false,
  onSelect,
  onDoubleClick,
}) => {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);

  const title = item.name || item.title || 'Untitled Layout';
  const date = formatDate(item.updatedAt ?? item.createdAt);
  const resolvedType = resolveType(item);
  const accentColor = typeColor(resolvedType);
  const thumbAspect = 16 / 9;
  const thumbHeight = Math.round(cardSize / thumbAspect);

  return (
    <Box
      data-model-card="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={() => onSelect?.(item)}
      onDoubleClick={() => onDoubleClick?.(item)}
      sx={{
        width: cardSize,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1.5px solid ${isSelected ? accentColor : hovered ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.12)'}`,
        background: isSelected
          ? `rgba(0,191,255,0.06)`
          : 'rgba(15,23,42,0.55)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: isSelected
          ? `0 0 0 1px rgba(0,191,255,0.25), 0 4px 16px rgba(0,191,255,0.12)`
          : hovered
          ? '0 4px 16px rgba(0,0,0,0.35)'
          : '0 2px 8px rgba(0,0,0,0.2)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Thumbnail */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: thumbHeight,
          background: 'rgba(8,14,28,0.8)',
          overflow: 'hidden',
        }}
      >
        {item.thumbnailUrl && !imgError ? (
          <Box
            component="img"
            src={item.thumbnailUrl}
            onError={() => setImgError(true)}
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
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.75,
              opacity: 0.3,
            }}
          >
            <ShapeLineRoundedIcon sx={{ fontSize: Math.round(cardSize * 0.22), color: accentColor }} />
          </Box>
        )}

        {/* Type badge */}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            px: 0.75,
            py: '1px',
            borderRadius: 999,
            background: 'rgba(0,0,0,0.62)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Typography sx={{ fontSize: 9, fontWeight: 700, color: accentColor, letterSpacing: 0.4 }}>
            {typeLabel(resolvedType)}
          </Typography>
        </Box>

        {/* Renders count badge */}
        {typeof item.rendersCount === 'number' && item.rendersCount > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 6,
              right: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              px: 0.75,
              py: '1px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.62)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <ImageRoundedIcon sx={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }} />
            <Typography sx={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
              {item.rendersCount}
            </Typography>
          </Box>
        )}

        {/* Selection highlight overlay */}
        {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              border: `2px solid ${accentColor}`,
              borderRadius: 'inherit',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>

      {/* Footer */}
      <Box sx={{ px: 1.25, py: 0.75 }}>
        <Typography
          sx={{
            fontSize: cardSize < 190 ? 11 : 12,
            fontWeight: 700,
            color: isSelected ? accentColor : 'rgba(229,231,235,0.92)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.3,
            transition: 'color 0.15s',
          }}
        >
          {title}
        </Typography>
        {date && (
          <Typography
            sx={{
              fontSize: 10,
              color: 'rgba(148,163,184,0.55)',
              mt: '2px',
              lineHeight: 1.2,
            }}
          >
            {date}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
