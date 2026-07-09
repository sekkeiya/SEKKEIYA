import React from 'react';
import type { ChartDatum, ChartType } from '../projects/types';
import type { EditorialTheme } from './editorialThemes';

// 依存ゼロの自前 SVG/HTML チャート（recharts は Vite と相性が悪く撤去）。
// donut / bar / radar をテーマ配色で描画する。

interface Props {
  type: ChartType;
  data: ChartDatum[];
  theme: EditorialTheme;
  height?: number;
}

function palette(accent: string, n: number): string[] {
  const alphas = ['ff', 'cc', '99', '73', '55', '40', '2e'];
  return Array.from({ length: n }, (_, i) => `${accent}${alphas[i % alphas.length]}`);
}

const Donut: React.FC<Props> = ({ data, theme, height = 260 }) => {
  const colors = palette(theme.accent, data.length);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cumulative = 0;
  const size = Math.min(height, 260);
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 42 42" width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="21" cy="21" r="15.915" fill="none" stroke={theme.border} strokeWidth="3" />
        {data.map((d, i) => {
          const pct = (d.value / total) * 100;
          const el = (
            <circle
              key={i} cx="21" cy="21" r="15.915" fill="none"
              stroke={colors[i]} strokeWidth="4.2"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={`${(100 - cumulative) % 100}`}
            />
          );
          cumulative += pct;
          return el;
        })}
      </svg>
    </div>
  );
};

const Bars: React.FC<Props> = ({ data, theme, height = 260 }) => {
  const colors = palette(theme.accent, data.length);
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: height - 40 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ fontFamily: theme.kickerFamily, fontSize: 12, fontWeight: 700, color: theme.subtext, marginBottom: 4 }}>{d.value}</div>
            <div style={{ width: '70%', height: `${(d.value / max) * 100}%`, background: colors[i], borderRadius: '3px 3px 0 0', transition: 'height 0.6s cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: theme.bodyFamily, fontSize: 11, color: theme.subtext }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
};

const Radar: React.FC<Props> = ({ data, theme, height = 260 }) => {
  const n = data.length;
  const max = Math.max(...data.map(d => d.value), 1);
  const cx = 50, cy = 50, R = 38;
  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const rings = [0.33, 0.66, 1].map(f => data.map((_, i) => pt(i, R * f).join(',')).join(' '));
  const shape = data.map((d, i) => pt(i, (d.value / max) * R).join(',')).join(' ');
  const size = Math.min(height, 260);
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        {rings.map((r, i) => <polygon key={i} points={r} fill="none" stroke={theme.border} strokeWidth="0.4" />)}
        {data.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={theme.border} strokeWidth="0.4" />; })}
        <polygon points={shape} fill={theme.accent} fillOpacity="0.28" stroke={theme.accent} strokeWidth="0.8" />
        {data.map((d, i) => { const [x, y] = pt(i, R + 7); return <text key={i} x={x} y={y} fontSize="3.4" fill={theme.subtext} textAnchor="middle" dominantBaseline="middle" style={{ fontFamily: theme.kickerFamily }}>{d.label}</text>; })}
      </svg>
    </div>
  );
};

export const ChartView: React.FC<Props> = (props) => {
  if (props.type === 'bar') return <Bars {...props} />;
  if (props.type === 'radar') return <Radar {...props} />;
  return <Donut {...props} />;
};

// 凡例（チャート横に並べる）
export const ChartLegend: React.FC<{ data: ChartDatum[]; theme: EditorialTheme; unit?: string }> = ({ data, theme, unit }) => {
  const colors = palette(theme.accent, data.length);
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${theme.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: theme.bodyFamily, fontSize: 14, color: theme.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
            {d.label}
          </span>
          <span style={{ fontFamily: theme.kickerFamily, fontWeight: 700, fontSize: 13, color: theme.subtext }}>{d.value}{unit ?? '%'}</span>
        </div>
      ))}
    </div>
  );
};
