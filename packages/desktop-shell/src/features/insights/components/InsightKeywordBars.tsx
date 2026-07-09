// キーワード頻度のバーチャート（水平バー）。自己完結・テーマ追従。

import React from 'react';
import { Box, Typography } from '@mui/material';
import type { InsightKeyword } from '../articleInsightTypes';

const ACCENT = '#b39ddb';

export const InsightKeywordBars: React.FC<{ keywords: InsightKeyword[]; max?: number }> = ({ keywords, max = 10 }) => {
  const items = keywords.slice(0, max);
  if (items.length === 0) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
      {items.map((kw) => (
        <Box key={kw.term} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography title={kw.term} sx={{ width: 92, flexShrink: 0, fontSize: 11.5, color: 'var(--brand-fg)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
            {kw.term}
          </Typography>
          <Box sx={{ flex: 1, height: 12, borderRadius: 0.5, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.max(6, Math.round(kw.weight * 100))}%`, height: '100%',
              background: `linear-gradient(90deg, ${ACCENT}bb, ${ACCENT})`, borderRadius: 0.5 }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};
