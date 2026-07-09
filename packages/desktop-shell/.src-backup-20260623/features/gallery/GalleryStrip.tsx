import React from 'react';
import { Box, Typography, Stack, Avatar, Chip, Button, CircularProgress } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import { BRAND } from '../../styles/theme';
import { useAppStore } from '../../store/useAppStore';
import { useGalleryFeed } from './useGalleryFeed';
import { openGalleryItem } from './openGalleryItem';
import { KIND_META, type GalleryItem } from './galleryTypes';

/**
 * ランディングに「滲ませる」発見の帯。
 * 公開成果物の先頭数件を横スクロールで見せ、「もっと見る」で Gallery 全画面へ。
 */
export const GalleryStrip: React.FC<{ count?: number }> = ({ count = 8 }) => {
  const { items, loading } = useGalleryFeed({ kind: 'all', scope: 'all' });
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} sx={{ color: BRAND.sub2 }} />
      </Box>
    );
  }
  if (items.length === 0) return null;

  return (
    <Box sx={{ width: '100%', mt: 6 }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
        <CollectionsRoundedIcon sx={{ color: '#5dade2', mr: 1, fontSize: 20 }} />
        <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>注目の公開作品</Typography>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={() => setCurrentMainView('gallery')}
          sx={{ color: BRAND.sub, textTransform: 'none', '&:hover': { color: '#fff' } }}
        >
          もっと見る
        </Button>
      </Stack>

      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { height: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: BRAND.line, borderRadius: 3 } }}>
        {items.slice(0, count).map(item => (
          <StripCard key={item.id} item={item} onClick={() => openGalleryItem(item)} />
        ))}
      </Box>
    </Box>
  );
};

const StripCard: React.FC<{ item: GalleryItem; onClick: () => void }> = ({ item, onClick }) => {
  const meta = KIND_META[item.kind];
  return (
    <Box
      onClick={onClick}
      sx={{
        flex: '0 0 auto', width: 180, bgcolor: BRAND.panel, borderRadius: 2.5,
        border: `1px solid ${BRAND.line}`, overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.18s', '&:hover': { transform: 'translateY(-3px)', borderColor: 'rgba(255,255,255,0.22)' },
      }}
    >
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', bgcolor: '#0e131c' }}>
        {item.thumbnailUrl ? (
          <Box component="img" src={item.thumbnailUrl} alt={item.title} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CollectionsRoundedIcon sx={{ fontSize: 32, color: 'rgba(255,255,255,0.12)' }} />
          </Box>
        )}
        <Chip label={meta.label} size="small" sx={{ position: 'absolute', top: 6, left: 6, height: 20, bgcolor: 'rgba(11,15,22,0.72)', color: meta.color, fontWeight: 700, fontSize: 10, border: `1px solid ${meta.color}55` }} />
      </Box>
      <Box sx={{ p: 1.25 }}>
        <Typography noWrap sx={{ fontWeight: 700, color: '#fff', fontSize: '0.82rem', mb: 0.75 }}>{item.title}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Avatar src={item.author.photoURL || undefined} sx={{ width: 18, height: 18, fontSize: 10, bgcolor: 'primary.main' }}>
            {(item.author.displayName || 'U')[0]?.toUpperCase()}
          </Avatar>
          <Typography noWrap sx={{ color: BRAND.sub2, fontSize: '0.72rem' }}>{item.author.displayName || '不明なユーザー'}</Typography>
        </Stack>
      </Box>
    </Box>
  );
};
