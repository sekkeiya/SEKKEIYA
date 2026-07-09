import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MovieRoundedIcon from '@mui/icons-material/MovieRounded';
import { DslRenderCard } from './DslRenderCard';
import type { RenderWithContext } from './hooks/useDslRendersForScope';

const GAP = 12;

interface DslRendersGridProps {
  items: RenderWithContext[];
  cardSize: number;
  selectedItemId: string | null;
  onSelectRender: (item: RenderWithContext) => void;
  isLoading?: boolean;
  contentType?: 'Image' | 'Movie' | 'ALL';
  emptyMessage?: string;
  currentUserId?: string | null;
  onDeleteRender?: (item: RenderWithContext) => Promise<void>;
  onSetHeroRender?: (item: RenderWithContext) => Promise<void>;
  onVisibilityToggleRender?: (item: RenderWithContext) => Promise<void>;
}

export const DslRendersGrid: React.FC<DslRendersGridProps> = ({
  items,
  cardSize,
  selectedItemId,
  onSelectRender,
  isLoading,
  contentType = 'ALL',
  emptyMessage,
  currentUserId,
  onDeleteRender,
  onSetHeroRender,
  onVisibilityToggleRender,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      const colW = Math.max(140, cardSize);
      setCols(Math.max(1, Math.floor((w + GAP) / (colW + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardSize]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, py: 8 }}>
        <CircularProgress sx={{ color: '#00BFFF' }} size={28} />
      </Box>
    );
  }

  if (items.length === 0) {
    const Icon = contentType === 'Movie' ? MovieRoundedIcon : ImageRoundedIcon;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, py: 8, gap: 1.5 }}>
        <Icon sx={{ fontSize: 48, color: 'rgba(0,191,255,0.18)' }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 600 }}>
          {emptyMessage ?? (contentType === 'Movie' ? '動画がありません' : contentType === 'Image' ? '静止画がありません' : 'レンダリング画像がありません')}
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, textAlign: 'center', maxWidth: 320 }}>
          3DSL エディターでレンダリングして保存すると表示されます
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{ width: '100%', height: '100%', overflowY: 'auto', p: 2, boxSizing: 'border-box' }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${cardSize}px)`,
          gap: `${GAP}px`,
        }}
      >
        {items.map((item) => (
          <DslRenderCard
            key={`${item.planId}-${item.id}`}
            item={item}
            cardSize={cardSize}
            isSelected={selectedItemId === item.id}
            onSelect={onSelectRender}
            isOwner={Boolean(currentUserId && (item as any).createdBy === currentUserId)}
            onDelete={onDeleteRender}
            onSetHero={onSetHeroRender}
            onVisibilityToggle={onVisibilityToggleRender}
          />
        ))}
      </Box>
    </Box>
  );
};
