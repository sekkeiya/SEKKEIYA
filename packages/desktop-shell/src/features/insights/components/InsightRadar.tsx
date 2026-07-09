// 多視点スコアのレーダーチャート（6軸）。依存追加を避けた自己完結の SVG。
// テーマは brand CSS 変数で追従。ArticleInsightPanel から使う。

import React from 'react';
import { SCORE_KEYS, SCORE_LABELS, type InsightScores } from '../articleInsightTypes';

const ACCENT = '#b39ddb';

interface Props {
  scores: InsightScores;
  size?: number;
}

export const InsightRadar: React.FC<Props> = ({ scores, size = 300 }) => {
  const cx = size / 2;
  const cy = size / 2 + 6;
  const r = size * 0.32; // ラベル分の余白を残す
  const n = SCORE_KEYS.length;

  const angleAt = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, radius: number) => {
    const a = angleAt(i);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const dataPoints = SCORE_KEYS.map((k, i) => pt(i, r * Math.max(0.02, scores[k])));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z';

  return (
    <svg viewBox={`0 0 ${size} ${size + 12}`} width="100%" style={{ display: 'block' }}>
      {/* グリッド（同心多角形） */}
      {rings.map((ring) => {
        const path = SCORE_KEYS.map((_, i) => {
          const p = pt(i, r * ring);
          return `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`;
        }).join(' ') + 'Z';
        return <path key={ring} d={path} fill="none" stroke="rgb(var(--brand-fg-rgb) / 0.12)" strokeWidth={1} />;
      })}

      {/* 軸 */}
      {SCORE_KEYS.map((_, i) => {
        const p = pt(i, r);
        return <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="rgb(var(--brand-fg-rgb) / 0.12)" strokeWidth={1} />;
      })}

      {/* データ多角形 */}
      <path d={dataPath} fill={`${ACCENT}40`} stroke={ACCENT} strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.6} fill={ACCENT} />
      ))}

      {/* ラベル */}
      {SCORE_KEYS.map((k, i) => {
        const p = pt(i, r + 20);
        const a = angleAt(i);
        const anchor = Math.abs(Math.cos(a)) < 0.3 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
        return (
          <text key={k} x={p[0]} y={p[1]} textAnchor={anchor} dominantBaseline="middle"
            fontSize={10.5} fill="rgb(var(--brand-fg-rgb) / 0.7)">
            {SCORE_LABELS[k]}
            <tspan dx={4} fontSize={9.5} fill={ACCENT} fontWeight={700}>{Math.round(scores[k] * 100)}</tspan>
          </text>
        );
      })}
    </svg>
  );
};
