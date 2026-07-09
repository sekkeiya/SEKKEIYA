import React, { useState } from 'react';
import { Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import type { DsmtProduct } from '../types';
import { COMPARE_AXES, normalizedScore, rawAxisValue, overallScore, SERIES_COLORS, type CompareAxisKey } from '../data/manufacturers';

const labelOf = (p: DsmtProduct) => `${p.manufacturer || '—'}・${p.name || '無題'}`;

// ── レーダーチャート（価格スコア・耐久・防火の 3 軸、商品ごとに多角形）──
export const ProductRadarChart: React.FC<{ products: DsmtProduct[] }> = ({ products }) => {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 46;
  const axes = COMPARE_AXES;
  const n = axes.length;

  const angle = (i: number) => (-90 + i * (360 / n)) * (Math.PI / 180);
  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* グリッドリング */}
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon
            key={t}
            points={axes.map((_, i) => { const p = point(i, R * t); return `${p.x},${p.y}`; }).join(' ')}
            fill="none"
            stroke="rgb(var(--brand-fg-rgb) / 0.10)"
            strokeWidth={1}
          />
        ))}
        {/* 軸線＋ラベル */}
        {axes.map((a, i) => {
          const outer = point(i, R);
          const lbl = point(i, R + 22);
          return (
            <g key={a.key}>
              <line x1={cx} y1={cy} x2={outer.x} y2={outer.y} stroke="rgb(var(--brand-fg-rgb) / 0.12)" strokeWidth={1} />
              <text x={lbl.x} y={lbl.y} fill="rgb(var(--brand-fg-rgb) / 0.7)" fontSize={11} textAnchor="middle" dominantBaseline="middle">{a.label}</text>
            </g>
          );
        })}
        {/* 商品ごとの多角形 */}
        {products.map((p, idx) => {
          const color = SERIES_COLORS[idx % SERIES_COLORS.length];
          const pts = axes.map((a, i) => {
            const s = normalizedScore(products, p, a) / 100;
            return point(i, R * s);
          });
          return (
            <g key={p.id}>
              <polygon points={pts.map((q) => `${q.x},${q.y}`).join(' ')} fill={`color-mix(in srgb, ${color} 15%, transparent)`} stroke={color} strokeWidth={1.75} />
              {pts.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={2.5} fill={color} />)}
            </g>
          );
        })}
      </svg>
      {/* 凡例 */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center', mt: 1 }}>
        {products.map((p, idx) => (
          <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: SERIES_COLORS[idx % SERIES_COLORS.length] }} />
            <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.75)' }}>{labelOf(p)}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ── 棒グラフ（軸を選んで商品を横並び比較）──
type BarMetric = CompareAxisKey | 'overall';

const BAR_METRICS: { key: BarMetric; label: string }[] = [
  { key: 'price', label: '価格' },
  { key: 'durability', label: '耐久' },
  { key: 'fireSafety', label: '防火' },
  { key: 'overall', label: '総合' },
];

export const ProductBarChart: React.FC<{ products: DsmtProduct[] }> = ({ products }) => {
  const [metric, setMetric] = useState<BarMetric>('price');

  // 価格は実値（円）で見せる。それ以外はスコア（0–100）。
  const isPrice = metric === 'price';
  const valueOf = (p: DsmtProduct): number => {
    if (metric === 'overall') return overallScore(products, p);
    if (metric === 'price') return rawAxisValue(p, 'price') ?? 0;
    return rawAxisValue(p, metric) ?? 0;
  };
  const max = Math.max(1, ...products.map(valueOf));
  const fmt = (v: number) => (isPrice ? `¥${v.toLocaleString()}` : `${v}`);

  return (
    <Box>
      <ToggleButtonGroup
        exclusive size="small" value={metric}
        onChange={(_, v) => { if (v) setMetric(v); }}
        sx={{ mb: 1.5, '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', fontSize: 11, textTransform: 'none', py: 0.25, px: 1.25 }, '& .Mui-selected': { color: '#fff !important', bgcolor: 'rgba(236,64,122,0.6) !important' } }}
      >
        {BAR_METRICS.map((m) => <ToggleButton key={m.key} value={m.key}>{m.label}</ToggleButton>)}
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {products.map((p, idx) => {
          const v = valueOf(p);
          const pct = Math.max(2, (v / max) * 100);
          const color = SERIES_COLORS[idx % SERIES_COLORS.length];
          return (
            <Box key={p.id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                <Typography noWrap sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.75)', maxWidth: 200 }}>{labelOf(p)}</Typography>
                <Typography sx={{ fontSize: 10.5, color: 'var(--brand-fg)', fontWeight: 600 }}>{v ? fmt(v) : '—'}</Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 4, bgcolor: color, transition: 'width 0.2s' }} />
              </Box>
            </Box>
          );
        })}
      </Box>
      {isPrice && (
        <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 1 }}>
          ※ 棒は実価格。レーダーの「価格」軸は安いほど高スコアに正規化しています。
        </Typography>
      )}
    </Box>
  );
};
