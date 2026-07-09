import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import type { EditorialTheme } from './editorialThemes';
import { ChartView, ChartLegend } from './ChartView';
import { useCreatorStats } from './useCreatorStats';
import { useProjectsWithSite } from './useProjectsWithSite';
import { RATIO } from './designTokens';

// スクロールで視界に入ったら 0→value までカウントアップ
const CountUp: React.FC<{ value: number; theme: EditorialTheme }> = ({ value, theme }) => {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    let raf = 0; let started = false;
    const run = () => {
      const dur = 900; const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !started) { started = true; run(); io.disconnect(); }
    }, { threshold: 0.4 });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return (
    <span ref={ref} style={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, color: theme.text, letterSpacing: theme.headingLetterSpacing }}>
      {n}
    </span>
  );
};

// 統計（フォロワー / フォロー中 / 投稿モデル / 公開プロジェクト）
export const ProfileStats: React.FC<{ theme: EditorialTheme }> = ({ theme }) => {
  const { followers, following, models, loading } = useCreatorStats();
  const { items: projectSites } = useProjectsWithSite();
  const stats = [
    { label: '公開プロジェクト', value: projectSites.length },
    { label: '投稿モデル', value: models.length },
    { label: 'フォロワー', value: followers },
    { label: 'フォロー中', value: following },
  ];
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} sx={{ color: theme.accent }} /></Box>;
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: { xs: 2, md: 4 }, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}`, py: { xs: 3, md: 4 } }}>
      {stats.map(s => (
        <Box key={s.label} sx={{ textAlign: 'center' }}>
          <Typography component="div" sx={{ fontSize: { xs: '2rem', md: '3rem' }, lineHeight: 1 }}>
            <CountUp value={s.value} theme={theme} />
          </Typography>
          <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.subtext, mt: 1 }}>{s.label}</Typography>
        </Box>
      ))}
    </Box>
  );
};

// 得意ジャンル（投稿モデルから集計したスキル分布。radar で表現）
export const CreatorGenres: React.FC<{ theme: EditorialTheme }> = ({ theme }) => {
  const { genres, loading } = useCreatorStats();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: theme.accent }} /></Box>;
  if (genres.length === 0) {
    return <Typography sx={{ fontFamily: theme.bodyFamily, color: theme.subtext, fontSize: '0.9rem' }}>モデルを公開すると、得意ジャンルが自動で集計されます。</Typography>;
  }
  const chartType = genres.length >= 3 ? 'radar' : 'bar';
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: { xs: 3, md: 6 }, alignItems: 'center' }}>
      <Box><ChartView type={chartType} data={genres} theme={theme} /></Box>
      <Box><ChartLegend data={genres} theme={theme} unit=" 件" /></Box>
    </Box>
  );
};

// 投稿モデル（公開した 3D モデルのギャラリー）
export const CreatorModels: React.FC<{ theme: EditorialTheme }> = ({ theme }) => {
  const { models, loading } = useCreatorStats();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} sx={{ color: theme.accent }} /></Box>;
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
