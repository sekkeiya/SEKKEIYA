import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import CollectionsRoundedIcon from '@mui/icons-material/CollectionsRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PresentToAllRoundedIcon from '@mui/icons-material/PresentToAllRounded';
import ChairRoundedIcon from '@mui/icons-material/ChairRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { BRAND } from '../../../styles/theme';
import { useGalleryStore } from '../../../features/gallery/useGalleryStore';
import { KIND_META, type GalleryKind } from '../../../features/gallery/galleryTypes';

const KIND_ICON: Record<GalleryKind, React.ReactElement> = {
  model:        <ViewInArRoundedIcon sx={{ fontSize: 16 }} />,
  layout:       <GridViewRoundedIcon sx={{ fontSize: 16 }} />,
  presentation: <PresentToAllRoundedIcon sx={{ fontSize: 16 }} />,
  furniture:    <ChairRoundedIcon sx={{ fontSize: 16 }} />,
  diagram:      <AccountTreeRoundedIcon sx={{ fontSize: 16 }} />,
  image:        <ImageRoundedIcon sx={{ fontSize: 16 }} />,
  portfolio:    <MenuBookRoundedIcon sx={{ fontSize: 16 }} />,
};

const NAV: { value: GalleryKind | 'all'; label: string; icon: React.ReactElement; color: string }[] = [
  { value: 'all', label: 'すべて', icon: <AppsRoundedIcon sx={{ fontSize: 16 }} />, color: 'light-dark(#1a6393, #5dade2)' },
  ...(Object.keys(KIND_META) as GalleryKind[]).map(k => ({
    value: k, label: KIND_META[k].label, icon: KIND_ICON[k], color: KIND_META[k].color,
  })),
];

export const GallerySidebar: React.FC = () => {
  const { kind, scope, setKind, setScope } = useGalleryStore();

  return (
    <Box sx={{
      width: 240, height: '100%', bgcolor: BRAND.bg,
      borderRight: `1px solid ${BRAND.line}`,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      {/* ヘッダー */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 2.5, pb: 2 }}>
        <CollectionsRoundedIcon sx={{ fontSize: 16, color: 'light-dark(#1a6393, #5dade2)' }} />
        <Typography sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.8rem', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Gallery
        </Typography>
      </Stack>

      {/* 種別ナビ */}
      <Typography sx={{ px: 2, color: BRAND.sub2, fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.5, mb: 0.5 }}>
        種別
      </Typography>

      <Stack sx={{ px: 1.5 }}>
        {NAV.map(n => {
          const active = kind === n.value;
          return (
            <Box
              key={n.value}
              onClick={() => setKind(n.value)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1.25, py: 0.7,
                borderRadius: 1.5, cursor: 'pointer',
                // 選択: アイコンカラー化 + 極薄背景のみ（borderLeft なし）
                color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)',
                bgcolor: active ? `color-mix(in srgb, ${n.color} 9%, transparent)` : 'transparent',
                transition: 'all 0.12s ease',
                '&:hover': {
                  bgcolor: active ? `color-mix(in srgb, ${n.color} 13%, transparent)` : 'rgb(var(--brand-fg-rgb) / 0.04)',
                  color: 'var(--brand-fg)',
                },
              }}
            >
              <Box sx={{ color: active ? n.color : 'rgb(var(--brand-fg-rgb) / 0.4)', display: 'flex', flexShrink: 0, transition: 'color 0.12s' }}>
                {n.icon}
              </Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: active ? 600 : 400, lineHeight: 1, letterSpacing: 0.2 }}>
                {n.label}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      {/* スコープ */}
      <Typography sx={{ px: 2, color: BRAND.sub2, fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1.5, mt: 2.5, mb: 0.75 }}>
        表示範囲
      </Typography>
      <Stack direction="row" sx={{ px: 1.5, gap: 0.5 }}>
        {(['all', 'following'] as const).map(v => {
          const active = scope === v;
          const label  = v === 'all' ? '全体' : 'フォロー中';
          return (
            <Box
              key={v}
              onClick={() => setScope(v)}
              sx={{
                flex: 1, textAlign: 'center',
                py: 0.65, borderRadius: 1.5, cursor: 'pointer',
                fontSize: 12, fontWeight: active ? 600 : 400,
                color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                bgcolor: active ? 'rgba(93,173,226,0.15)' : 'transparent',
                border: `1px solid ${active ? 'rgba(93,173,226,0.35)' : BRAND.line}`,
                transition: 'all 0.12s ease',
                '&:hover': { bgcolor: active ? 'rgba(93,173,226,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.04)', color: 'var(--brand-fg)' },
              }}
            >
              {label}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
};
