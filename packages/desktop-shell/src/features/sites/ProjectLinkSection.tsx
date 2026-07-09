import React from 'react';
import { Box, Typography, Button, Chip } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useAppStore } from '../../store/useAppStore';
import type { SiteProjectRef } from '../projects/types';
import type { EditorialTheme } from './editorialThemes';
import { PAGE_PX, MEASURE, RATIO } from './designTokens';

// アカウントサイトの各プロジェクトページ：そのプロジェクトへの入口（カバー＋開くボタン）。
export const ProjectLinkSection: React.FC<{ theme: EditorialTheme; refData: SiteProjectRef; secPy: any }> = ({ theme, refData, secPy }) => {
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);

  const open = () => {
    setActiveProjectId(refData.projectId, 'home');
    setCurrentMainView('workspace');
  };

  return (
    <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
      <Box
        onClick={open}
        sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.wide, border: `1px solid ${theme.border}`, cursor: 'pointer',
          '&:hover img': { transform: 'scale(1.04)' } }}
      >
        {refData.cover ? (
          <Box component="img" src={refData.cover} alt={refData.name} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}33 0%, ${theme.bg} 55%, ${theme.surface} 100%)` }} />
        )}
        <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 3, md: 5 } }}>
          <Chip label={refData.team ? 'TEAM PROJECT' : 'MY PROJECT'} size="small" sx={{ mb: 1.5, height: 20, fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.12em', bgcolor: 'rgba(255,255,255,0.16)', color: '#fff' }} />
          <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, color: '#fff', fontSize: { xs: '1.8rem', md: '2.8rem' }, lineHeight: 1.1, mb: 2 }}>
            {refData.name}
          </Typography>
          <Button
            variant="contained" onClick={(e) => { e.stopPropagation(); open(); }}
            endIcon={<ArrowForwardRoundedIcon />}
            sx={{ bgcolor: '#fff', color: '#111', fontWeight: 800, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: 'rgba(255,255,255,0.85)' } }}
          >
            プロジェクトを開く
          </Button>
        </Box>
      </Box>
    </Box>
  );
};
