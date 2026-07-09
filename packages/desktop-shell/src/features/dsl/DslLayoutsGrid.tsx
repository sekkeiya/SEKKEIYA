import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { DslLayoutCard } from './DslLayoutCard';

interface DslLayoutsGridProps {
  items: any[];
  cardSize?: number;
  selectedItemId?: string | null;
  onSelectLayout?: (item: any) => void;
  onDoubleClick?: (item: any) => void;
  onDelete?: (item: any) => void;
  isInitializing?: boolean;
  emptyMessage?: string;
  onCreateNew?: () => void;
}

const MIN_COL_WIDTH = 140;

const CreateCard: React.FC<{ cardSize: number; onClick: () => void }> = ({ cardSize, onClick }) => {
  const [hovered, setHovered] = React.useState(false);
  const thumbHeight = Math.round(cardSize / (16 / 9));
  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      sx={{
        width: cardSize,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1.5px dashed ${hovered ? 'rgba(0,191,255,0.6)' : 'rgb(var(--slate-ink-rgb) / 0.2)'}`,
        background: hovered ? 'rgba(0,191,255,0.04)' : 'rgb(var(--slate-panel-rgb) / 0.3)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: thumbHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AddRoundedIcon sx={{ fontSize: Math.round(cardSize * 0.18), color: hovered ? 'rgba(0,191,255,0.7)' : 'rgb(var(--slate-ink-rgb) / 0.25)', transition: 'color 0.15s' }} />
      </Box>
      <Box sx={{ px: 1.25, py: 0.75 }}>
        <Typography sx={{ fontSize: cardSize < 190 ? 11 : 12, fontWeight: 600, color: hovered ? 'rgba(0,191,255,0.8)' : 'rgb(var(--slate-ink-rgb) / 0.35)', transition: 'color 0.15s' }}>
          新規レイアウト追加
        </Typography>
      </Box>
    </Box>
  );
};

export const DslLayoutsGrid: React.FC<DslLayoutsGridProps> = ({
  items,
  cardSize = 210,
  selectedItemId,
  onSelectLayout,
  onDoubleClick,
  onDelete,
  isInitializing,
  emptyMessage = 'レイアウトがありません',
  onCreateNew,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);

  const updateColumns = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth - 32; // account for padding
    const cols = Math.max(1, Math.floor(w / Math.max(MIN_COL_WIDTH, cardSize + 8)));
    setColumns(cols);
  }, [cardSize]);

  useEffect(() => {
    updateColumns();
    const ro = new ResizeObserver(updateColumns);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateColumns]);

  if (isInitializing && items.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, height: '100%' }}>
        <CircularProgress sx={{ color: '#00BFFF' }} />
      </Box>
    );
  }

  if (!isInitializing && items.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', gap: 3, py: 6 }}>
        {onCreateNew && <CreateCard cardSize={210} onClick={onCreateNew} />}
        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500, fontSize: 13 }}>
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        px: 2,
        py: 2,
        opacity: isInitializing ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { background: 'rgb(var(--slate-ink-rgb) / 0.18)', borderRadius: 2 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${cardSize}px)`,
          gap: '12px',
          justifyContent: 'start',
        }}
      >
        {onCreateNew && <CreateCard cardSize={cardSize} onClick={onCreateNew} />}
        {items.map((item) => (
          <DslLayoutCard
            key={item.id}
            item={item}
            cardSize={cardSize}
            isSelected={selectedItemId === item.id}
            onSelect={onSelectLayout}
            onDoubleClick={onDoubleClick}
            onDelete={onDelete}
          />
        ))}
      </Box>
    </Box>
  );
};
