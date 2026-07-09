import React from 'react';
import { Box, Typography } from '@mui/material';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import { Link } from 'react-router-dom';
import type { EditorialTheme } from './editorialThemes';
import type { ResolvedWork, ResolvedProfile, SiteProjectRef } from './siteTypes';
import { ChartView, ChartLegend } from './ChartView';
import { PAGE_PX, MEASURE, RATIO } from './designTokens';

// 公開サイト用の動的セクション。デスクトップの live store/hook 版と異なり、
// 公開時に焼き込まれた resolvedWorks / resolvedProfile / projectRef.publishedSlug を描画する。

// works カードのラッパ：公開済みならそのプロジェクトサイトへ Link、未公開なら静的。
const WorkCardWrap: React.FC<{ work: ResolvedWork; children: React.ReactNode }> = ({ work, children }) => {
  if (work.publishedSlug) {
    return <Box component={Link} to={`/${work.publishedSlug}`} sx={{ textDecoration: 'none', display: 'block' }}>{children}</Box>;
  }
  return <Box sx={{ cursor: 'default' }}>{children}</Box>;
};

export const WebWorksGrid: React.FC<{ theme: EditorialTheme; works: ResolvedWork[] }> = ({ theme, works }) => {
  if (!works || works.length === 0) {
    return (
      <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${theme.border}`, color: theme.subtext, borderRadius: 0.5 }}>
        <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: '0.9rem' }}>まだプロジェクトがありません。</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 2.5, md: 3 } }}>
      {works.map(p => (
        <WorkCardWrap key={p.id} work={p}>
          <Box sx={{ cursor: p.publishedSlug ? 'pointer' : 'default', '&:hover .work-cover img': { transform: 'scale(1.05)' }, '&:hover .work-arrow': { opacity: 1, transform: 'translate(2px,-2px)' } }}>
            <Box className="work-cover" sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: theme.surface, border: `1px solid ${theme.border}` }}>
              {p.cover || p.iconUrl ? (
                <Box component="img" src={(p.cover || p.iconUrl) as string} alt={p.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
              ) : (
                <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${theme.accent}26 0%, ${theme.surface} 60%)` }}>
                  {p.iconEmoji && <Box component="span" sx={{ fontSize: '3.2rem', lineHeight: 1 }}>{p.iconEmoji}</Box>}
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 1.25, gap: 1 }}>
              <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontWeight: theme.headingWeight, fontSize: '1.05rem', color: theme.text, letterSpacing: theme.headingLetterSpacing }}>{p.name}</Typography>
              {p.publishedSlug && <ArrowOutwardRoundedIcon className="work-arrow" sx={{ fontSize: '1rem', color: theme.accent, opacity: 0.5, transition: 'opacity 0.2s, transform 0.2s' }} />}
            </Box>
            {p.isTeam && <Typography noWrap sx={{ fontFamily: theme.kickerFamily, fontSize: '0.62rem', letterSpacing: '0.1em', color: theme.subtext, mt: 0.25, textTransform: 'uppercase' }}>Team Project</Typography>}
          </Box>
        </WorkCardWrap>
      ))}
    </Box>
  );
};

export const WebProfileStats: React.FC<{ theme: EditorialTheme; profile: ResolvedProfile }> = ({ theme, profile }) => {
  const stats = [
    { label: '公開プロジェクト', value: profile.publishedProjectCount },
    { label: '投稿モデル', value: profile.models.length },
    { label: 'フォロワー', value: profile.followers },
    { label: 'フォロー中', value: profile.following },
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: { xs: 2, md: 4 }, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, py: { xs: 3, md: 4 } }}>
      {stats.map(s => (
        <Box key={s.label} sx={{ textAlign: 'center' }}>
          <Typography component="div" sx={{ fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1, fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, color: theme.text, letterSpacing: theme.headingLetterSpacing }}>
            {s.value}
          </Typography>
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.subtext, mt: 1 }}>{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
};

export const WebProfileGenres: React.FC<{ theme: EditorialTheme; profile: ResolvedProfile }> = ({ theme, profile }) => {
  const genres = profile.genres ?? [];
  if (genres.length === 0) {
    return <Typography sx={{ fontFamily: theme.bodyFamily, color: theme.subtext, fontSize: '0.9rem' }}>得意ジャンルはまだありません。</Typography>;
  }
  const chartType = genres.length >= 3 ? 'radar' : 'bar';
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center' }}>
      <Box><ChartView type={chartType} data={genres} theme={theme} /></Box>
      <Box><ChartLegend data={genres} theme={theme} unit=" 件" /></Box>
    </Box>
  );
};

export const WebProfileModels: React.FC<{ theme: EditorialTheme; profile: ResolvedProfile }> = ({ theme, profile }) => {
  const models = profile.models ?? [];
  if (models.length === 0) {
    return <Typography sx={{ fontFamily: theme.bodyFamily, color: theme.subtext, fontSize: '0.9rem' }}>まだ公開した 3D モデルがありません。</Typography>;
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
      {models.map(m => (
        <Box key={m.id} sx={{ '&:hover img': { transform: 'scale(1.05)' } }}>
          <Box sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: theme.surface, border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {m.thumb
              ? <Box component="img" src={m.thumb} alt={m.name} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
              : <ViewInArRoundedIcon sx={{ fontSize: 32, color: theme.subtext, opacity: 0.5 }} />}
          </Box>
          <Typography noWrap sx={{ fontFamily: theme.bodyFamily, fontSize: '0.74rem', color: theme.subtext, mt: 0.75 }}>{m.name}</Typography>
        </Box>
      ))}
    </Box>
  );
};

// projectlink: 公開済みプロジェクトへのカード（カバー＋開くリンク）。
export const WebProjectLink: React.FC<{ theme: EditorialTheme; refData: SiteProjectRef; secPy: any }> = ({ theme, refData, secPy }) => {
  const inner = (
    <Box sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.wide, border: `1px solid ${theme.border}`, cursor: refData.publishedSlug ? 'pointer' : 'default', '&:hover img': { transform: 'scale(1.04)' } }}>
      {refData.cover ? (
        <Box component="img" src={refData.cover} alt={refData.name} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
      ) : (
        <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${theme.accent}33 0%, ${theme.bg} 55%, ${theme.surface} 100%)` }} />
      )}
      <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.66) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, p: { xs: 3, md: 5 } }}>
        <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, letterSpacing: theme.headingLetterSpacing, color: '#fff', fontSize: { xs: '1.8rem', md: '2.8rem' }, lineHeight: 1.1, mb: refData.publishedSlug ? 2 : 0 }}>
          {refData.name}
        </Typography>
        {refData.publishedSlug && (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, bgcolor: '#fff', color: '#111', fontWeight: 800, px: 2, py: 1, borderRadius: 2 }}>
            プロジェクトを見る <ArrowForwardRoundedIcon sx={{ fontSize: '1.1rem' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
  return (
    <Box sx={{ px: PAGE_PX, py: secPy, maxWidth: MEASURE.wide, mx: 'auto' }}>
      {refData.publishedSlug
        ? <Box component={Link} to={`/${refData.publishedSlug}`} sx={{ textDecoration: 'none', display: 'block' }}>{inner}</Box>
        : inner}
    </Box>
  );
};
