/**
 * BlogMonthCalendar — S.Blog スケジュール用の月カレンダー（タスクなし）。
 * Schedules & Tasks の月グリッドの見た目を踏襲しつつ、ブログの投稿予定/記事を並べる汎用部品。
 * データ源に依存しないよう CalEvent[] を受け取り、個人（投稿予定）/公式（記事）双方から使う。
 */
import React, { useMemo } from 'react';
import { Box, Typography, Button, Tooltip } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';

export interface CalEvent {
  id: string;
  date: string;      // YYYY-MM-DD
  title: string;
  color: string;     // 表示色（カテゴリ色 / ステータス色）
  time?: string;
  dim?: boolean;     // 完了/公開済みなどで淡く見せる
  sub?: string;      // 補足（カテゴリ名など・ツールチップ）
}

const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => toStr(new Date());

/** 月曜始まりの6週グリッド（前後月の日を含む42日）。 */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const dow = (first.getDay() + 6) % 7; // 月曜=0
  start.setDate(first.getDate() - dow);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}

interface BlogMonthCalendarProps {
  year: number;
  month: number; // 0-11
  events: CalEvent[];
  accent?: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onDayClick?: (dateStr: string) => void;   // 空き部分クリック（予定追加）
  onEventClick?: (id: string) => void;
  /** 右上に置く追加アクション（予定を追加 等） */
  headerActions?: React.ReactNode;
}

export const BlogMonthCalendar: React.FC<BlogMonthCalendarProps> = ({
  year, month, events, accent = '#e57373', onPrev, onNext, onToday, onDayClick, onEventClick, headerActions,
}) => {
  const grid = useMemo(() => monthGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) { if (e.date) (m[e.date] = m[e.date] || []).push(e); }
    for (const list of Object.values(m)) list.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    return m;
  }, [events]);
  const today = todayStr();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダー: 月ナビ + アクション */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="前の月"><Button onClick={onPrev} sx={{ minWidth: 32, p: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}><ChevronLeftRoundedIcon /></Button></Tooltip>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: 'var(--brand-fg)', minWidth: 110, textAlign: 'center' }}>{year}年 {month + 1}月</Typography>
          <Tooltip title="次の月"><Button onClick={onNext} sx={{ minWidth: 32, p: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}><ChevronRightRoundedIcon /></Button></Tooltip>
          <Button onClick={onToday} size="small" variant="outlined"
            sx={{ ml: 0.5, textTransform: 'none', fontSize: 12, color: 'var(--brand-fg)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', '&:hover': { borderColor: accent } }}>今日</Button>
        </Box>
        <Box sx={{ flex: 1 }} />
        {headerActions}
      </Box>

      {/* 曜日ヘッダー */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', borderBottom: 'none', borderRadius: '8px 8px 0 0', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', flexShrink: 0 }}>
        {WEEK.map((d, i) => (
          <Typography key={d} sx={{ textAlign: 'center', py: 0.75, fontSize: 11, fontWeight: 700,
            color: i === 5 ? 'light-dark(#0875a6, #4fc3f7)' : i === 6 ? 'light-dark(#9e103f, #f48fb1)' : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{d}</Typography>
        ))}
      </Box>

      {/* 月グリッド */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridAutoRows: '1fr',
        border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {grid.map((d, i) => {
          const ds = toStr(d);
          const inMonth = d.getMonth() === month;
          const isToday = ds === today;
          const evs = byDay[ds] || [];
          return (
            <Box key={i} onClick={() => onDayClick?.(ds)}
              sx={{ borderRight: (i % 7 !== 6) ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none',
                borderTop: i >= 7 ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none',
                p: 0.5, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0.25, overflow: 'hidden',
                bgcolor: inMonth ? 'transparent' : 'rgb(var(--brand-fg-rgb) / 0.02)',
                cursor: onDayClick ? 'pointer' : 'default',
                '&:hover': onDayClick ? { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' } : {} }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
                <Typography sx={{ fontSize: 11, fontWeight: isToday ? 800 : 500,
                  color: isToday ? '#fff' : inMonth ? 'rgb(var(--brand-fg-rgb) / 0.7)' : 'rgb(var(--brand-fg-rgb) / 0.3)',
                  ...(isToday ? { bgcolor: accent, borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}) }}>
                  {d.getDate()}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {evs.slice(0, 4).map((e) => (
                  <Tooltip key={e.id} title={`${e.time ? e.time + ' ' : ''}${e.title}${e.sub ? ' / ' + e.sub : ''}`}>
                    <Box onClick={(ev) => { ev.stopPropagation(); onEventClick?.(e.id); }}
                      sx={{ px: 0.6, py: 0.15, borderRadius: 0.75, cursor: onEventClick ? 'pointer' : 'default',
                        bgcolor: `${e.color}${e.dim ? '18' : '30'}`, borderLeft: `2px solid ${e.color}`,
                        opacity: e.dim ? 0.6 : 1, '&:hover': { bgcolor: `${e.color}44` } }}>
                      <Typography noWrap sx={{ fontSize: 10, fontWeight: 600, color: 'var(--brand-fg)',
                        textDecoration: e.dim ? 'line-through' : 'none' }}>
                        {e.time ? `${e.time} ` : ''}{e.title}
                      </Typography>
                    </Box>
                  </Tooltip>
                ))}
                {evs.length > 4 && (
                  <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', px: 0.6 }}>+{evs.length - 4}</Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
