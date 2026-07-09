import React from 'react';
import { Box, Typography } from '@mui/material';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import type { EditorialTheme } from './editorialThemes';
import type { SiteSection } from './siteTypes';
import { ChartView, ChartLegend } from './ChartView';
import { RATIO } from './designTokens';

// ブック / 動画スライドの「中身」を描く。データ系（統計・グラフ・モデル・Works）は
// 実コンテンツ（自前 SVG チャート / 数値 / サムネグリッド）を描画。それ以外は画像 or 本文。

interface Props {
  section: SiteSection;
  theme: EditorialTheme;
  image: string | null;
  body: string;
  light: boolean;        // true: 明るい地（ブック） / false: 暗い地（動画＝白文字）
  compact?: boolean;     // ブックページなど狭い領域向けに縮小
}

export const SlideContent: React.FC<Props> = ({ section, theme, image, body, light, compact }) => {
  const txt = light ? theme.text : '#fff';
  const sub = light ? theme.subtext : 'rgba(255,255,255,0.72)';
  // チャート/凡例はテーマ配色を使うため、暗地では白系へ差し替えたテーマを渡す。
  const chartTheme: EditorialTheme = light
    ? theme
    : { ...theme, text: '#fff', subtext: 'rgba(255,255,255,0.78)', border: 'rgba(255,255,255,0.28)' };
  const p = section.resolvedProfile;

  // 統計（4 つの数値）
  if (section.type === 'profilestats' && p) {
    const stats = [
      { label: '公開プロジェクト', value: p.publishedProjectCount },
      { label: '投稿モデル', value: p.models.length },
      { label: 'フォロワー', value: p.followers },
      { label: 'フォロー中', value: p.following },
    ];
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(4,1fr)' }, gap: { xs: 2, md: 4 }, width: '100%' }}>
        {stats.map(s => (
          <Box key={s.label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontFamily: theme.displayFamily, fontWeight: theme.headingWeight, color: txt, lineHeight: 1, fontSize: compact ? { xs: '1.8rem', md: '2.4rem' } : { xs: '2.4rem', md: '3.6rem' } }}>{s.value}</Typography>
            <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.62rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: sub, mt: 1 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // 得意ジャンル（グラフ＋凡例）
  if (section.type === 'usergenres' && p?.genres?.length) {
    const type = p.genres.length >= 3 ? 'radar' : 'bar';
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' }, gap: { xs: 2, md: 5 }, alignItems: 'center', width: '100%' }}>
        <Box><ChartView type={type} data={p.genres} theme={chartTheme} height={compact ? 200 : 260} /></Box>
        <Box><ChartLegend data={p.genres} theme={chartTheme} unit=" 件" /></Box>
      </Box>
    );
  }

  // ターゲット等のチャート
  if (section.type === 'target' && section.chartData?.length) {
    const type = section.chartType ?? 'donut';
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.1fr 1fr' }, gap: { xs: 2, md: 5 }, alignItems: 'center', width: '100%' }}>
        <Box><ChartView type={type} data={section.chartData} theme={chartTheme} height={compact ? 200 : 260} /></Box>
        <Box><ChartLegend data={section.chartData} theme={chartTheme} unit={type === 'radar' ? '' : '%'} /></Box>
      </Box>
    );
  }

  // 投稿モデル（サムネイルのグリッド）
  if (section.type === 'usermodels' && p?.models?.length) {
    const items = p.models.slice(0, compact ? 6 : 8);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', md: compact ? 'repeat(3,1fr)' : 'repeat(4,1fr)' }, gap: 1.5, width: '100%' }}>
        {items.map(m => (
          <Box key={m.id}>
            <Box sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: light ? theme.surface : 'rgba(255,255,255,0.06)', border: `1px solid ${light ? theme.border : 'rgba(255,255,255,0.18)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {m.thumb
                ? <Box component="img" src={m.thumb} alt={m.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <ViewInArRoundedIcon sx={{ fontSize: 28, color: sub, opacity: 0.6 }} />}
            </Box>
            <Typography noWrap sx={{ fontFamily: theme.bodyFamily, fontSize: '0.7rem', color: sub, mt: 0.5 }}>{m.name}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // Works（プロジェクトのカバー一覧）
  if (section.type === 'works' && section.resolvedWorks?.length) {
    const items = section.resolvedWorks.slice(0, compact ? 6 : 8);
    return (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', md: 'repeat(3,1fr)' }, gap: 1.5, width: '100%' }}>
        {items.map(w => (
          <Box key={w.id}>
            <Box sx={{ position: 'relative', overflow: 'hidden', aspectRatio: RATIO.card, bgcolor: light ? theme.surface : 'rgba(255,255,255,0.06)', border: `1px solid ${light ? theme.border : 'rgba(255,255,255,0.18)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {w.cover || w.iconUrl
                ? <Box component="img" src={(w.cover || w.iconUrl) as string} alt={w.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Box component="span" sx={{ fontSize: '2rem' }}>{w.iconEmoji || '▦'}</Box>}
            </Box>
            <Typography noWrap sx={{ fontFamily: theme.headingFamily, fontSize: '0.78rem', color: txt, mt: 0.5 }}>{w.name}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // 仕様表（spec / regulation）
  if ((section.type === 'spec' || section.type === 'regulation') && section.specRows?.length) {
    return (
      <Box sx={{ width: '100%', borderTop: `1px solid ${light ? theme.border : 'rgba(255,255,255,0.2)'}` }}>
        {section.specRows.slice(0, compact ? 6 : 10).map((r, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 2, py: 1, borderBottom: `1px solid ${light ? theme.border : 'rgba(255,255,255,0.2)'}` }}>
            <Typography sx={{ fontFamily: theme.kickerFamily, fontSize: '0.72rem', letterSpacing: '0.06em', color: sub, textTransform: 'uppercase' }}>{r.label}</Typography>
            <Typography sx={{ fontFamily: theme.headingFamily, fontSize: '0.95rem', color: txt }}>{r.value}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  // 画像（ギャラリー等）
  if (image) {
    return <Box component="img" src={image} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
  }

  // 本文のみ
  if (body) {
    return (
      <Typography sx={{ fontFamily: theme.bodyFamily, fontSize: compact ? '0.84rem' : { xs: '0.95rem', md: '1.1rem' }, lineHeight: 1.85, color: sub, maxWidth: 720, display: '-webkit-box', WebkitLineClamp: compact ? 8 : 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {body}
      </Typography>
    );
  }
  return null;
};
