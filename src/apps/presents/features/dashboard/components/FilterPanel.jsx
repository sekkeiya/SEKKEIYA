import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { tokens } from '../../../shared/theme/tokens';

export const FilterPanel = () => {
  return (
    <Box sx={{ 
      width: 320, 
      height: '100%', 
      bgcolor: tokens.background.panel, 
      backdropFilter: 'blur(12px)',
      borderLeft: tokens.border.subtle, 
      p: 3, 
      overflowY: 'auto',
      boxShadow: tokens.glow.subtle
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ display:'flex', alignItems:'center', gap: 1 }}>
           <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', boxShadow: tokens.glow.primary }} />
           SEARCH / FILTER
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, borderBottom: tokens.border.subtle, pb: 1 }}>
        <Typography variant="overline" fontWeight="bold" sx={{ display: 'block', fontSize: '0.8rem', color: 'text.secondary' }}>Filters</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
          ↺ RESET ALL
        </Typography>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>CATEGORIES</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>カテゴリ</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
          <Chip label="ALL" size="small" sx={{ bgcolor: 'rgba(0,160,233,0.15)', color: 'primary.main', border: tokens.border.glow }} />
          <Chip label="Proposal" size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', '&:hover': {borderColor:'rgba(255,255,255,0.3)', color:'white'} }} />
          <Chip label="Report" size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', '&:hover': {borderColor:'rgba(255,255,255,0.3)', color:'white'} }} />
        </Stack>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>FORMATS</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>ファイル形式</Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
          <Chip label="PDF" size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', '&:hover': {borderColor:'rgba(255,255,255,0.3)', color:'white'} }} />
          <Chip label="Web" size="small" variant="outlined" sx={{ color: 'text.secondary', borderColor: 'rgba(255,255,255,0.1)', '&:hover': {borderColor:'rgba(255,255,255,0.3)', color:'white'} }} />
        </Stack>
      </Box>

      <Box sx={{ mb: 4 }}>
        <Typography variant="caption" fontWeight="bold" sx={{ display: 'block', mb: 0.5 }}>TAGS</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>タグ</Typography>
        <Box sx={{ p: 1.5, border: tokens.border.subtle, borderRadius: 1.5, bgcolor: 'rgba(0,0,0,0.3)', '&:hover': { borderColor: 'rgba(255,255,255,0.2)' }, cursor: 'text' }}>
          <Typography variant="caption" color="text.secondary">タグを追加 (例: 建築, 3D)</Typography>
        </Box>
      </Box>
    </Box>
  );
};
