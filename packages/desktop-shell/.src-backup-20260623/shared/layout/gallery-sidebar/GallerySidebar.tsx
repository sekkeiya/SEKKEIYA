import React from 'react';
import { Box, Typography, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import ChairRoundedIcon from '@mui/icons-material/ChairRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import { BRAND } from '../../../styles/theme';
import { useGalleryStore } from '../../../features/gallery/useGalleryStore';
import { KIND_META, type GalleryKind } from '../../../features/gallery/galleryTypes';

const KIND_ICON: Record<GalleryKind, React.ReactElement> = {
  model: <ViewInArRoundedIcon fontSize="small" />,
  layout: <GridViewRoundedIcon fontSize="small" />,
  presentation: <PresentToAllRoundedIcon fontSize="small" />,
  furniture: <ChairRoundedIcon fontSize="small" />,
  diagram: <AccountTreeRoundedIcon fontSize="small" />,
};

const NAV: { value: GalleryKind | 'all'; label: string; icon: React.ReactElement; color: string }[] = [
  { value: 'all', label: 'すべて', icon: <AppsRoundedIcon fontSize="small" />, color: '#5dade2' },
  ...(Object.keys(KIND_META) as GalleryKind[]).map(k => ({
    value: k, label: KIND_META[k].label, icon: KIND_ICON[k], color: KIND_META[k].color,
  })),
];

export const GallerySidebar: React.FC = () => {
  const { kind, scope, setKind, setScope } = useGalleryStore();

  return (
    <Box sx={{ width: 240, height: '100%', bgcolor: BRAND.bg, borderRight: `1px solid ${BRAND.line}`, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {/* ヘッダー */}
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <CollectionsRoundedIcon sx={{ color: '#5dade2' }} />
        <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '1.05rem', letterSpacing: 0.5 }}>Gallery</Typography>
      </Stack>

      {/* 種別ナビ */}
      <Typography sx={{ px: 2.5, color: BRAND.sub2, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, mb: 1 }}>
        種別
      </Typography>
      <Stack sx={{ px: 1.5, gap: 0.25 }}>
        {NAV.map(n => {
          const active = kind === n.value;
          return (
            <Box
              key={n.value}
              onClick={() => setKind(n.value)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1, borderRadius: 2, cursor: 'pointer',
                color: active ? '#fff' : BRAND.sub,
                bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                borderLeft: `3px solid ${active ? n.color : 'transparent'}`,
                transition: 'all 0.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' },
              }}
            >
              <Box sx={{ color: active ? n.color : 'inherit', display: 'flex' }}>{n.icon}</Box>
              <Typography sx={{ fontSize: '0.88rem', fontWeight: active ? 700 : 500 }}>{n.label}</Typography>
            </Box>
          );
        })}
      </Stack>

      {/* スコープ */}
      <Typography sx={{ px: 2.5, color: BRAND.sub2, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 1.5, mt: 3, mb: 1 }}>
        表示範囲
      </Typography>
      <Box sx={{ px: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={scope}
          onChange={(_e, v) => { if (v) setScope(v); }}
          sx={{
            '& .MuiToggleButton-root': {
              color: BRAND.sub, borderColor: BRAND.line, textTransform: 'none', py: 0.75,
              '&.Mui-selected': { color: '#fff', bgcolor: 'rgba(93,173,226,0.18)' },
            },
          }}
        >
          <ToggleButton value="all">全体</ToggleButton>
          <ToggleButton value="following">フォロー中</ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </Box>
  );
};
