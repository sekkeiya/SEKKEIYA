import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ShapeLineRoundedIcon from '@mui/icons-material/ShapeLineRounded';
import { DslLayoutCard } from './DslLayoutCard';

interface DslLayoutsGridProps {
  items: any[];
  cardSize?: number;
  selectedItemId?: string | null;
  onSelectLayout?: (item: any) => void;
  onDoubleClick?: (item: any) => void;
  isInitializing?: boolean;
  emptyMessage?: string;
}

const MIN_COL_WIDTH = 140;

export const DslLayoutsGrid: React.FC<DslLayoutsGridProps> = ({
  items,
  cardSize = 210,
  selectedItemId,
  onSelectLayout,
  onDoubleClick,
  isInitializing,
  emptyMessage = 'レイアウトがありません',
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
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%', gap: 1.5, py: 6 }}>
        <ShapeLineRoundedIcon sx={{ fontSize: 48, color: 'rgba(0,191,255,0.2)', mb: 0.5 }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
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
        '&::-webkit-scrollbar-thumb': { background: 'rgba(148,163,184,0.18)', borderRadius: 2 },
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
        {items.map((item) => (
          <DslLayoutCard
            key={item.id}
            item={item}
            cardSize={cardSize}
            isSelected={selectedItemId === item.id}
            onSelect={onSelectLayout}
            onDoubleClick={onDoubleClick}
          />
        ))}
      </Box>
    </Box>
  );
};
