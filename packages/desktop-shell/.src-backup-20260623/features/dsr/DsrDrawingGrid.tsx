import React, { useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import { DsrDrawingCard } from './DsrDrawingCard';
import { useDsrStore } from './store/useDsrStore';

interface DsrDrawingGridProps {
  drawings: any[];
  sets: any[];
  isInitializing?: boolean;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
}

export const DsrDrawingGrid: React.FC<DsrDrawingGridProps> = ({ drawings, sets, isInitializing, onDeleteItem, onSelectItem }) => {
  const categoryFilter = useDsrStore(s => s.categoryFilter);
  const openSetId = useDsrStore(s => s.openSetId);
  const setOpenSetId = useDsrStore(s => s.setOpenSetId);
  const selectedDrawingId = useDsrStore(s => s.selectedDrawingId);
  const setSelectedDrawingId = useDsrStore(s => s.setSelectedDrawingId);

  const matchesCategory = (item: any) => categoryFilter === 'all' || item.category === categoryFilter;

  const { visibleSets, visibleDrawings } = useMemo(() => {
    if (openSetId) {
      // Inside a set: only show child drawings of this set (no nested sets in Phase A/B).
      return {
        visibleSets: [],
        visibleDrawings: drawings.filter(d => d.parentSetId === openSetId && matchesCategory(d)),
      };
    }
    // Top level: standalone drawings (no parent) + set folders.
    return {
      visibleSets: sets.filter(matchesCategory),
      visibleDrawings: drawings.filter(d => !d.parentSetId && matchesCategory(d)),
    };
  }, [drawings, sets, openSetId, categoryFilter]);

  const handleSelect = (item: any) => {
    setSelectedDrawingId(item.id);
    onSelectItem?.(item);
  };

  if (isInitializing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: '#4db6ac' }} />
      </Box>
    );
  }

  const isEmpty = visibleSets.length === 0 && visibleDrawings.length === 0;

  if (isEmpty) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', gap: 1.5 }}>
        <DescriptionRoundedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 14 }}>
          {openSetId ? 'このセットには図面がありません' : '図面がまだありません'}
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
          右上の「アップロード」から PDF / 画像を追加できます
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: 2,
      p: 3,
      overflowY: 'auto',
      alignContent: 'start',
    }}>
      {visibleSets.map(set => (
        <DsrDrawingCard
          key={set.id}
          item={set}
          variant="set"
          childCount={drawings.filter(d => d.parentSetId === set.id).length}
          onClick={() => setOpenSetId(set.id)}
          onDelete={onDeleteItem ? () => onDeleteItem(set) : undefined}
        />
      ))}
      {visibleDrawings.map(d => (
        <DsrDrawingCard
          key={d.id}
          item={d}
          variant="drawing"
          active={selectedDrawingId === d.id}
          onClick={() => handleSelect(d)}
          onDelete={onDeleteItem ? () => onDeleteItem(d) : undefined}
        />
      ))}
    </Box>
  );
};
