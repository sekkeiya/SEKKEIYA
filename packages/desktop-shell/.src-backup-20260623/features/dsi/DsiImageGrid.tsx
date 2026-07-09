import React, { useMemo } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { DsiImageCard } from './DsiImageCard';
import { useDsiStore } from './store/useDsiStore';

interface DsiImageGridProps {
  images: any[];
  sets: any[];
  isInitializing?: boolean;
  onDeleteItem?: (item: any) => void;
  onSelectItem?: (item: any) => void;
}

export const DsiImageGrid: React.FC<DsiImageGridProps> = ({ images, sets, isInitializing, onDeleteItem, onSelectItem }) => {
  const categoryFilter = useDsiStore(s => s.categoryFilter);
  const openSetId = useDsiStore(s => s.openSetId);
  const setOpenSetId = useDsiStore(s => s.setOpenSetId);
  const selectedImageId = useDsiStore(s => s.selectedImageId);
  const setSelectedImageId = useDsiStore(s => s.setSelectedImageId);

  const matchesCategory = (item: any) => categoryFilter === 'all' || item.category === categoryFilter;

  const { visibleSets, visibleImages } = useMemo(() => {
    if (openSetId) {
      return {
        visibleSets: [],
        visibleImages: images.filter(d => d.parentSetId === openSetId && matchesCategory(d)),
      };
    }
    return {
      visibleSets: sets.filter(matchesCategory),
      visibleImages: images.filter(d => !d.parentSetId && matchesCategory(d)),
    };
  }, [images, sets, openSetId, categoryFilter]);

  const handleSelect = (item: any) => {
    setSelectedImageId(item.id);
    onSelectItem?.(item);
  };

  if (isInitializing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress sx={{ color: '#ec407a' }} />
      </Box>
    );
  }

  const isEmpty = visibleSets.length === 0 && visibleImages.length === 0;

  if (isEmpty) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', gap: 1.5 }}>
        <PhotoLibraryRoundedIcon sx={{ fontSize: 48, opacity: 0.5 }} />
        <Typography sx={{ fontSize: 14 }}>
          {openSetId ? 'このセットには画像/動画がありません' : '画像・動画がまだありません'}
        </Typography>
        <Typography sx={{ fontSize: 12, opacity: 0.7 }}>
          右上の「アップロード」から追加、または S.Layout / AI Render の成果物が自動でここに集まります
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
        <DsiImageCard
          key={set.id}
          item={set}
          variant="set"
          childCount={images.filter(d => d.parentSetId === set.id).length}
          onClick={() => setOpenSetId(set.id)}
          onDelete={onDeleteItem ? () => onDeleteItem(set) : undefined}
        />
      ))}
      {visibleImages.map(d => (
        <DsiImageCard
          key={d.id}
          item={d}
          variant="image"
          active={selectedImageId === d.id}
          onClick={() => handleSelect(d)}
          onDelete={onDeleteItem ? () => onDeleteItem(d) : undefined}
        />
      ))}
    </Box>
  );
};
