import React from 'react';
import { Box, Typography } from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import { useAppStore } from '../../store/useAppStore';
import type { EditorialTheme } from './editorialThemes';
import { RATIO } from './designTokens';

// アカウントサイトの Works セクション：プロジェクトをカード一覧（scope で My/Team を絞り込み）。
// 空のプロジェクトもカードで並び、クリックでそのプロジェクト（サイト作成画面）へ。
export const WorksGrid: React.FC<{ theme: EditorialTheme; scope?: 'my' | 'team' | 'all' }> = ({ theme, scope = 'all' }) => {
  const projects = useAppStore(s => s.projects);
  const setActiveProjectId = useAppStore(s => s.setActiveProjectId);
  const setCurrentMainView = useAppStore(s => s.setCurrentMainView);
  const items = (scope === 'my' ? projects.filter(p => !p.isTeam) : scope === 'team' ? projects.filter(p => p.isTeam) : projects)
    .map(p => ({ id: p.id, name: p.name, cover: p.coverThumbnailUrl, isTeam: p.isTeam, iconEmoji: p.iconEmoji, iconUrl: p.iconUrl }));

  const open = (id: string) => {
    setActiveProjectId(id, 'home');
    setCurrentMainView('workspace');
  };

  if (items.length === 0) {
    const label = scope === 'team' ? 'チームプロジェクト' : scope === 'my' ? 'マイプロジェクト' : 'プロジェクト';
    return (
      <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.border}`, color: theme.subtext, borderRadius: 0.5 }}>
        <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.9rem' }}>まだ{label}がありません。＋ から作成すると、ここにカードで並びます。</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2.5, md: 3 } }}>
      {items.map(p => (
        <Box
          key={p.id}
          onClick={() => open(p.id)}
          sx={{ cursor: 'pointer', '&:hover .work-cover img': { transform: 'scale(1.05)' }, '&:hover .work-arrow': { opacity: 1, transform: 'translate(2px,-2px)' } }}
        >
          <Box className="work-cover" sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
            {p.cover || p.iconUrl ? (
              <Box component="img" src={p.cover || p.iconUrl} alt={p.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
            ) : (
              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${theme.accent}26 0%, ${theme.surface} 60%)` }}>
                {p.iconEmoji && <Box component="span" sx={{ fontSize: '3.2rem', lineHeight: 1 }}>{p.iconEmoji}</Box>}
              </Box>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 1.25, gap: 1 }}>
            <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.05rem', color: theme.text, letterSpacing: theme.headingLetterSpacing }}>{p.name}</Typography>
            <ArrowOutwardRoundedIcon className="work-arrow" sx={{ fontSize: '1rem', color: theme.accent, opacity: 0.5, transition: 'opacity 0.2s, transform 0.2s' }} />
          </Box>
          {p.isTeam && <Typography noWrap sx={{ fontFamily: theme.kickerFamily, fontSize: '0.62rem', letterSpacing: '0.1em', color: theme.subtext, mt: 0.25, textTransform: 'uppercase' }}>Team Project</Typography>}
        </Box>
      ))}
    </Box>
  );
};
