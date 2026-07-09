import React, { useState } from 'react';
import { Box, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import ViewStreamRoundedIcon from '@mui/icons-material/ViewStreamRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SlideshowRoundedIcon from '@mui/icons-material/SlideshowRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

export type ViewMode = 'scroll' | 'book' | 'video';

const MODES: { key: ViewMode; label: string; Icon: React.ElementType }[] = [
  { key: 'scroll', label: 'スクロール', Icon: ViewStreamRoundedIcon },
  { key: 'book', label: 'ブック', Icon: MenuBookRoundedIcon },
  { key: 'video', label: '動画', Icon: SlideshowRoundedIcon },
];

// 表示方法の切替。メニューボタン → 押すとスクロール/ブック/動画を選べる。
export const ViewModeSwitcher: React.FC<{ mode: ViewMode; onChange: (m: ViewMode) => void; accent: string }> = ({ mode, onChange, accent }) => {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = MODES.find(m => m.key === mode) || MODES[0];

  return (
    <>
      <Box
        component="button"
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="表示方法"
        sx={{
          position: 'fixed', top: 16, right: 16, zIndex: 1400,
          display: 'inline-flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
          px: 1.5, py: 0.9, borderRadius: 999, fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700,
          color: 'rgba(255,255,255,0.9)', bgcolor: 'rgba(18,18,22,0.66)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
          transition: 'background 0.15s',
          '&:hover': { bgcolor: 'rgba(28,28,34,0.82)' },
        }}
      >
        <TuneRoundedIcon sx={{ fontSize: '1.1rem' }} />
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>表示</Box>
        <current.Icon sx={{ fontSize: '1rem', opacity: 0.85 }} />
        <ExpandMoreRoundedIcon sx={{ fontSize: '1rem', opacity: 0.7, transform: anchor ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </Box>

      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true }}
        slotProps={{ paper: { sx: { mt: 1, minWidth: 180, bgcolor: 'rgba(20,20,25,0.96)', backdropFilter: 'blur(10px)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 2, backgroundImage: 'none' } } }}
      >
        {MODES.map(({ key, label, Icon }) => {
          const active = key === mode;
          return (
            <MenuItem
              key={key}
              selected={active}
              onClick={() => { onChange(key); setAnchor(null); }}
              sx={{ py: 1, '&.Mui-selected': { bgcolor: `${accent}22` }, '&.Mui-selected:hover': { bgcolor: `${accent}33` }, '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <ListItemIcon sx={{ color: active ? accent : 'rgba(255,255,255,0.7)', minWidth: 32 }}><Icon sx={{ fontSize: '1.2rem' }} /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ sx: { fontSize: '0.85rem', fontWeight: active ? 800 : 600, color: active ? '#fff' : 'rgba(255,255,255,0.85)' } }}>{label}</ListItemText>
              {active && <CheckRoundedIcon sx={{ fontSize: '1rem', color: accent, ml: 1 }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};
