import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box, Typography, Button, Paper, Chip, IconButton,
  TextField, Select, MenuItem, FormControl, InputLabel, Tooltip, CircularProgress,
  Dialog, DialogContent, Popover,
} from '@mui/material';
import AddRoundedIcon              from '@mui/icons-material/AddRounded';
import HistoryRoundedIcon           from '@mui/icons-material/HistoryRounded';
import EditRoundedIcon              from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon            from '@mui/icons-material/DeleteRounded';
import CheckCircleRoundedIcon       from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ChevronLeftRoundedIcon       from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon      from '@mui/icons-material/ChevronRightRounded';
import AutoAwesomeRoundedIcon       from '@mui/icons-material/AutoAwesomeRounded';
import MicRoundedIcon               from '@mui/icons-material/MicRounded';
import PersonRoundedIcon            from '@mui/icons-material/PersonRounded';
import FactCheckRoundedIcon         from '@mui/icons-material/FactCheckRounded';
import AccessAlarmsRoundedIcon      from '@mui/icons-material/AccessAlarmsRounded';
import ViewListRoundedIcon          from '@mui/icons-material/ViewListRounded';
import ViewKanbanRoundedIcon        from '@mui/icons-material/ViewKanbanRounded';
import CalendarMonthRoundedIcon     from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon  from '@mui/icons-material/CalendarViewWeekRounded';
import CalendarViewDayRoundedIcon   from '@mui/icons-material/CalendarViewDayRounded';
import CloseRoundedIcon             from '@mui/icons-material/CloseRounded';
import TableRowsRoundedIcon         from '@mui/icons-material/TableRowsRounded';
import ViewColumnRoundedIcon        from '@mui/icons-material/ViewColumnRounded';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query, getDocs, limit,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { useCoreOrchestrator } from '../../store/useCoreOrchestrator';
import { useAIChatStore } from '../../store/useAIChatStore';
import type { DesktopProject } from '../../features/projects/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType   = 'meeting' | 'deadline' | 'submission' | 'other';
type ScheduleStatus = 'upcoming' | 'done';
type TaskType       = 'ai' | 'manual' | 'review';
type TaskPriority   = 'high' | 'medium' | 'low';
type TaskStatus     = 'todo' | 'in_progress' | 'done';
type CalView        = 'month' | 'week' | 'day';
type TaskView       = 'list' | 'kanban';
type TaskFilter     = 'all' | 'ai' | 'manual' | 'review' | 'todo' | 'done';
type UserTaskFilter = 'all' | 'todo' | 'in_progress' | 'done';
type AITaskFilter   = 'all' | 'todo' | 'in_progress' | 'done';
type TaskPanelMode  = 'both' | 'user' | 'ai';
type LayoutMode     = 'split' | 'stacked';

type SidePanelState =
  | { kind: 'schedule'; item: ScheduleItem }
  | { kind: 'new-schedule'; date: string; time?: string }
  | { kind: 'task'; item: TaskItem }
  | { kind: 'new-task'; initialType?: TaskType }
  | { kind: 'ai-history' }
  | { kind: 'user-history' }
  | null;

interface ScheduleItem {
  id: string;
  projectId?: string;
  projectName?: string;
  title: string;
  description?: string;
  dueDate: string;
  startTime?: string;
  endTime?: string;
  type: ScheduleType;
  status: ScheduleStatus;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface TaskItem {
  id: string;
  projectId?: string;
  projectName?: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  assigneeUid?: string;
  assigneeName?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
  // interview task specific（AI記者の取材）
  taskKind?: string;
  linkUrl?: string;
  articleId?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS  = ['月','火','水','木','金','土','日'];
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HOUR_HEIGHT    = 44;
const CAL_START      = 0;
const CAL_END        = 24;
const CAL_SCROLL_TO  = 4.5; // 初期スクロール: 4:30 を先頭に → 5:00〜20:00 が視野に入る
const TIME_SLOTS     = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);

const SCHEDULE_TYPES: Record<ScheduleType, { label: string; color: string; bg: string }> = {
  meeting:    { label: '会議',     color: '#43e97b', bg: 'rgba(67,233,123,0.22)'  },
  deadline:   { label: '締め切り', color: 'light-dark(#a80637, #fa709a)', bg: 'rgba(250,112,154,0.22)' },
  submission: { label: '提出',     color: 'light-dark(#a47f0a, #f6d365)', bg: 'rgba(246,211,101,0.22)' },
  other:      { label: 'その他',   color: 'rgb(var(--brand-fg-rgb) / 0.65)', bg: 'rgba(160,170,180,0.15)' },
};

const TASK_TYPES: Record<TaskType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  ai:     { label: 'AI タスク', color: '#00BFFF', bg: 'rgba(0,191,255,0.14)',   Icon: AutoAwesomeRoundedIcon },
  manual: { label: '自分で実行', color: 'light-dark(#48327c, #a18cd1)', bg: 'rgba(161,140,209,0.14)', Icon: PersonRoundedIcon },
  review: { label: '確認事項',  color: 'light-dark(#a47f0a, #f6d365)', bg: 'rgba(246,211,101,0.14)', Icon: FactCheckRoundedIcon },
};

const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  high:   { label: '高', color: 'light-dark(#a80637, #fa709a)' },
  medium: { label: '中', color: 'light-dark(#a47f0a, #f6d365)' },
  low:    { label: '低', color: 'rgb(var(--brand-fg-rgb) / 0.65)' },
};

const STATUS_CFG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: '未着手', color: 'rgb(var(--brand-fg-rgb) / 0.5)' },
  in_progress: { label: '進行中', color: '#00BFFF' },
  done:        { label: '完了',   color: '#43e97b' },
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const KANBAN_COLS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'TO DO', color: 'rgb(var(--brand-fg-rgb) / 0.5)' },
  { id: 'in_progress', label: 'DOING', color: '#00BFFF' },
  { id: 'done',        label: 'DONE',  color: '#43e97b' },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function isToday(d: Date): boolean { return toDateStr(d) === toDateStr(new Date()); }

function formatShort(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr?: string): boolean {
  return !!dateStr && new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}

function getMonthGrid(year: number, month: number): Date[] {
  const first  = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - offset + i));
}

function getWeekDays(ref: Date): Date[] {
  const d   = new Date(ref);
  const dow = d.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d); mon.setDate(d.getDate() + toMon);
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(mon); dd.setDate(mon.getDate() + i); return dd; });
}

function timeToY(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return ((h - CAL_START) + m / 60) * HOUR_HEIGHT;
}

function timeDiffH(s: string, e?: string): number {
  if (!e) return 1;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  return Math.max((eh - sh) + (em - sm) / 60, 0.5);
}

// ─── Shared dialog styles ──────────────────────────────────────────────────────

const dlgPaper  = { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)' };
const fldSx     = { '& label.Mui-focused': { color: '#00BFFF' }, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } };
const lblSx     = { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-focused': { color: '#00BFFF' } };
const inpProp   = { sx: { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } };
const selSx     = { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } };
const menuPpr   = { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' };

// ─── Event Hover Card ─────────────────────────────────────────────────────────

interface EventHoverCardProps {
  ev: ScheduleItem | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const EventHoverCard: React.FC<EventHoverCardProps> = ({ ev, anchorEl, onClose }) => {
  if (!ev) return null;
  const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
  return (
    <Popover
      open={Boolean(anchorEl && ev)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      disableRestoreFocus
      sx={{ pointerEvents: 'none' }}
      PaperProps={{
        sx: {
          bgcolor: 'var(--brand-surface2)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
          borderRadius: 2, p: 1.5, minWidth: 180, maxWidth: 260,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', pointerEvents: 'none',
        },
      }}
    >
      {/* Type badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.62rem', color: t.color, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {t.label}
        </Typography>
        {ev.status === 'done' && (
          <Typography sx={{ fontSize: '0.58rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', ml: 'auto', fontWeight: 600 }}>完了</Typography>
        )}
      </Box>
      {/* Title */}
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand-fg)', lineHeight: 1.3, mb: 0.5,
        textDecoration: ev.status === 'done' ? 'line-through' : 'none',
        opacity: ev.status === 'done' ? 0.55 : 1 }}>
        {ev.title}
      </Typography>
      {/* Time */}
      {(ev.startTime || ev.dueDate) && (
        <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: ev.description ? 0.75 : 0 }}>
          {ev.dueDate.replace(/-/g, '/')}
          {ev.startTime && ` ${ev.startTime}`}
          {ev.endTime   && ` – ${ev.endTime}`}
        </Typography>
      )}
      {/* Description */}
      {ev.description && (
        <Typography sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)', lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {ev.description}
        </Typography>
      )}
      {/* Project */}
      {ev.projectName && (
        <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', mt: 0.5 }}>
          {ev.projectName}
        </Typography>
      )}
    </Popover>
  );
};

// ─── Month View ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  year: number; month: number; schedules: ScheduleItem[];
  onDayClick: (d: Date) => void;
  onDayNumberClick: (d: Date) => void;
  onEventClick: (ev: ScheduleItem) => void;
}

const MonthView: React.FC<MonthViewProps> = ({ year, month, schedules, onDayClick, onDayNumberClick, onEventClick }) => {
  const grid  = useMemo(() => getMonthGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m: Record<string, ScheduleItem[]> = {};
    schedules.forEach(s => { if (s.dueDate) { (m[s.dueDate] = m[s.dueDate] || []).push(s); } });
    return m;
  }, [schedules]);
  const [hoverState, setHoverState] = useState<{ ev: ScheduleItem; anchor: HTMLElement } | null>(null);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Day-of-week header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', borderRadius: '8px 8px 0 0', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', borderBottom: 'none' }}>
        {DAY_LABELS.map((d, i) => (
          <Box key={d} sx={{ textAlign: 'center', py: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.5,
              color: i===5 ? 'light-dark(#0875a6, #4fc3f7)' : i===6 ? 'light-dark(#9e103f, #f48fb1)' : 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Day cells */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gridTemplateRows: 'repeat(6,1fr)', flex: 1, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {grid.map((date, idx) => {
          const ds      = toDateStr(date);
          const inMonth = date.getMonth() === month;
          const today   = isToday(date);
          const evs     = byDay[ds] || [];
          const dow     = idx % 7;
          return (
            <Box key={ds} onClick={() => onDayClick(date)}
              sx={{ minHeight: 80, p: '3px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                borderBottom: idx < 35 ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none',
                borderRight:  dow < 6  ? '1px solid rgb(var(--brand-fg-rgb) / 0.06)' : 'none',
                bgcolor: today ? 'rgba(0,191,255,0.04)' : 'transparent',
                opacity: inMonth ? 1 : 0.3,
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' },
              }}>
              {/* 日付バッジ（クリックで日ビューへ） */}
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: '2px' }}>
                <Box onClick={e => { e.stopPropagation(); onDayNumberClick(date); }}
                  sx={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: today ? '#00BFFF' : 'transparent', cursor: 'pointer',
                    '&:hover': { bgcolor: today ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.12)' } }}>
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: today ? 800 : inMonth ? 500 : 400, lineHeight: 1,
                    color: today ? '#000' : dow===5 ? 'light-dark(#0875a6, #4fc3f7)' : dow===6 ? 'light-dark(#9e103f, #f48fb1)' : inMonth ? 'rgb(var(--brand-fg-rgb) / 0.85)' : 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                    {date.getDate()}
                  </Typography>
                </Box>
              </Box>
              {/* イベント（最大3件）*/}
              {evs.slice(0, 3).map(ev => {
                const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                return (
                  <Box key={ev.id}
                    onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    onMouseEnter={e => setHoverState({ ev, anchor: e.currentTarget })}
                    onMouseLeave={() => setHoverState(null)}
                    sx={{ mb: '1px', px: '3px', py: '1px', bgcolor: t.bg, borderRadius: 0.5,
                      borderLeft: `2px solid ${t.color}`, cursor: 'pointer', opacity: ev.status==='done' ? 0.45 : 1,
                      '&:hover': { opacity: 0.75 } }}>
                    <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: t.color, display: 'block',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: ev.status==='done' ? 'line-through' : 'none' }}>
                      {ev.startTime && <span style={{ opacity: 0.7 }}>{ev.startTime} </span>}{ev.title}
                    </Typography>
                  </Box>
                );
              })}
              {evs.length > 3 && (
                <Typography sx={{ fontSize: '0.55rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', pl: '3px', lineHeight: 1.4 }}>
                  +{evs.length - 3} 件
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
      <EventHoverCard ev={hoverState?.ev ?? null} anchorEl={hoverState?.anchor ?? null} onClose={() => setHoverState(null)} />
    </Box>
  );
};

// ─── Week View ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  weekDays: Date[]; schedules: ScheduleItem[];
  onSlotClick: (d: Date, time: string) => void; onEventClick: (ev: ScheduleItem) => void;
}

const WeekView: React.FC<WeekViewProps> = ({ weekDays, schedules, onSlotClick, onEventClick }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ ev: ScheduleItem; anchor: HTMLElement } | null>(null);
  const byDay = useMemo(() => {
    const m: Record<string, ScheduleItem[]> = {};
    schedules.forEach(s => { if (s.dueDate) { (m[s.dueDate] = m[s.dueDate] || []).push(s); } });
    return m;
  }, [schedules]);

  // ── Current time indicator ─────────────────────────────────────────────
  const [nowTime, setNowTime] = useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNowTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const todayStr    = toDateStr(nowTime);
  const todayColIdx = weekDays.findIndex(d => toDateStr(d) === todayStr);
  const nowY        = ((nowTime.getHours() + nowTime.getMinutes() / 60) - CAL_START) * HOUR_HEIGHT;
  const nowInRange  = todayColIdx >= 0 && nowY >= 0 && nowY <= (CAL_END - CAL_START) * HOUR_HEIGHT;
  const nowLabel    = `${String(nowTime.getHours()).padStart(2,'0')}:${String(nowTime.getMinutes()).padStart(2,'0')}`;

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = CAL_SCROLL_TO * HOUR_HEIGHT;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Headers */}
      <Box sx={{ display: 'flex', ml: '48px', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', flexShrink: 0 }}>
        {weekDays.map((d, i) => {
          const today = isToday(d);
          return (
            <Box key={i} sx={{ flex: 1, textAlign: 'center', py: 0.75, bgcolor: today ? 'rgba(0,191,255,0.04)' : 'transparent' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: i===5 ? 'light-dark(#0875a6, #4fc3f7)' : i===6 ? 'light-dark(#9e103f, #f48fb1)' : 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'block' }}>
                {DAY_LABELS[i]}
              </Typography>
              <Box sx={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                bgcolor: today ? '#00BFFF' : 'transparent' }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: today ? 800 : 600,
                  color: today ? '#000' : i===5 ? 'light-dark(#0875a6, #4fc3f7)' : i===6 ? 'light-dark(#9e103f, #f48fb1)' : 'rgb(var(--brand-fg-rgb) / 0.85)' }}>
                  {d.getDate()}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* All-day row */}
      <Box sx={{ display: 'flex', ml: '48px', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.01)', flexShrink: 0, minHeight: 26 }}>
        {weekDays.map((d, i) => {
            const evs = (byDay[toDateStr(d)]||[]).filter(e => !e.startTime);
            return (
              <Box key={i} onClick={() => onSlotClick(d, '')}
                sx={{ flex: 1, px: '2px', py: '3px', minHeight: 26, cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.025)' } }}>
                {evs.map(ev => {
                  const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                  return (
                    <Box key={ev.id} onClick={() => onEventClick(ev)}
                      onMouseEnter={e => setHoverState({ ev, anchor: e.currentTarget })}
                      onMouseLeave={() => setHoverState(null)}
                      sx={{ mb: '2px', px: '4px', py: '1px', bgcolor: t.bg, borderRadius: 0.5, borderLeft: `2px solid ${t.color}`, cursor: 'pointer' }}>
                      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: t.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {ev.title}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            );
          })}
        </Box>

      {/* Time grid */}
      <Box ref={scrollRef} sx={{ display: 'flex', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        {/* Time labels */}
        <Box sx={{ width: 48, flexShrink: 0, position: 'relative' }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', pt: '3px', pr: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500, width: '100%', textAlign: 'right' }}>
                {String(h).padStart(2,'0')}:00
              </Typography>
            </Box>
          ))}
          {/* Current time label — centered on the line */}
          {nowInRange && (
            <Box sx={{ position: 'absolute', top: nowY, right: 2, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 5 }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: '#ff4d4d', whiteSpace: 'nowrap', lineHeight: 1 }}>
                {nowLabel}
              </Typography>
            </Box>
          )}
        </Box>
        {/* Columns */}
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
          {weekDays.map((d, di) => {
            const ds   = toDateStr(d);
            const evs  = (byDay[ds]||[]).filter(e => e.startTime);
            const today = isToday(d);
            return (
              <Box key={di} sx={{ position: 'relative', borderRight: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', bgcolor: today ? 'rgba(0,191,255,0.02)' : 'transparent' }}>
                {TIME_SLOTS.map(h => (
                  <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.04)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.025)' } }}
                    onClick={() => onSlotClick(d, `${String(h).padStart(2,'0')}:00`)} />
                ))}
                {evs.map(ev => {
                  const t   = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                  const top = timeToY(ev.startTime!);
                  const ht  = Math.max(timeDiffH(ev.startTime!, ev.endTime) * HOUR_HEIGHT - 2, 18);
                  if (top < 0 || top > (CAL_END - CAL_START) * HOUR_HEIGHT) return null;
                  return (
                    <Box key={ev.id}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      onMouseEnter={e => setHoverState({ ev, anchor: e.currentTarget })}
                      onMouseLeave={() => setHoverState(null)}
                      sx={{ position: 'absolute', top: top+1, left: 2, right: 2, height: ht, bgcolor: t.bg,
                        borderLeft: `2px solid ${t.color}`, borderRadius: 1, px: '4px', py: '2px',
                        cursor: 'pointer', overflow: 'hidden', zIndex: 1, opacity: ev.status==='done' ? 0.45 : 1,
                        '&:hover': { filter: 'brightness(1.2)' } }}>
                      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: t.color, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>
                        {ev.startTime} {ev.title}
                      </Typography>
                    </Box>
                  );
                })}
                {/* Current time indicator */}
                {di === todayColIdx && nowInRange && (
                  <>
                    <Box sx={{ position: 'absolute', top: nowY - 5, left: -5, width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff4d4d', zIndex: 4, boxShadow: '0 0 6px rgba(255,77,77,0.8)' }}/>
                    <Box sx={{ position: 'absolute', top: nowY, left: 0, right: 0, height: 2, bgcolor: '#ff4d4d', zIndex: 3, boxShadow: '0 0 4px rgba(255,77,77,0.5)' }}/>
                  </>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>
      <EventHoverCard ev={hoverState?.ev ?? null} anchorEl={hoverState?.anchor ?? null} onClose={() => setHoverState(null)} />
    </Box>
  );
};

// ─── Day View ─────────────────────────────────────────────────────────────────

interface DayViewProps {
  date: Date; schedules: ScheduleItem[];
  onSlotClick: (d: Date, time: string) => void; onEventClick: (ev: ScheduleItem) => void;
}

const DayView: React.FC<DayViewProps> = ({ date, schedules, onSlotClick, onEventClick }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState<{ ev: ScheduleItem; anchor: HTMLElement } | null>(null);
  const ds     = toDateStr(date);
  const dayEvs = schedules.filter(s => s.dueDate === ds);
  const timed  = dayEvs.filter(e => e.startTime).sort((a,b) => a.startTime!.localeCompare(b.startTime!));
  const allDay = dayEvs.filter(e => !e.startTime);

  // ── Current time indicator ─────────────────────────────────────────────
  const [nowTime, setNowTime] = useState(() => new Date());
  React.useEffect(() => {
    const id = setInterval(() => setNowTime(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const isCurrentDay = toDateStr(date) === toDateStr(nowTime);
  const nowY         = ((nowTime.getHours() + nowTime.getMinutes() / 60) - CAL_START) * HOUR_HEIGHT;
  const nowInRange   = isCurrentDay && nowY >= 0 && nowY <= (CAL_END - CAL_START) * HOUR_HEIGHT;
  const nowLabel     = `${String(nowTime.getHours()).padStart(2,'0')}:${String(nowTime.getMinutes()).padStart(2,'0')}`;

  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = CAL_SCROLL_TO * HOUR_HEIGHT;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box onClick={() => onSlotClick(date, '')}
        sx={{ mx: 1, mb: 1, p: 1, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', borderRadius: 2, flexShrink: 0, cursor: 'pointer',
          minHeight: 36, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.035)' } }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontWeight: 700, mb: allDay.length ? '4px' : 0, letterSpacing: 0.5 }}>
          {allDay.length ? '終日' : '+ 終日の予定を追加'}
        </Typography>
        {allDay.map(ev => {
          const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
          return (
            <Box key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
              onMouseEnter={e => setHoverState({ ev, anchor: e.currentTarget })}
              onMouseLeave={() => setHoverState(null)}
              sx={{ py: '5px', px: 1.5, mb: '3px', bgcolor: t.bg, borderRadius: 1.5, borderLeft: `3px solid ${t.color}`, cursor: 'pointer' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: t.color, fontSize: '0.82rem' }}>{ev.title}</Typography>
            </Box>
          );
        })}
      </Box>

      <Box ref={scrollRef} sx={{ display: 'flex', overflowY: 'auto', flex: 1, minHeight: 0 }}>
        <Box sx={{ width: 52, flexShrink: 0, position: 'relative' }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', pt: '3px', pr: 1.5 }}>
              <Typography sx={{ fontSize: '0.63rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontWeight: 500, width: '100%', textAlign: 'right' }}>
                {String(h).padStart(2,'0')}:00
              </Typography>
            </Box>
          ))}
          {/* Current time label — centered on the line */}
          {nowInRange && (
            <Box sx={{ position: 'absolute', top: nowY, right: 2, transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 5 }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#ff4d4d', whiteSpace: 'nowrap', lineHeight: 1 }}>
                {nowLabel}
              </Typography>
            </Box>
          )}
        </Box>
        <Box sx={{ flex: 1, position: 'relative', borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', cursor: 'pointer',
              '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}
              onClick={() => onSlotClick(date, `${String(h).padStart(2,'0')}:00`)} />
          ))}
          {timed.map(ev => {
            const t   = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
            const top = timeToY(ev.startTime!);
            const ht  = Math.max(timeDiffH(ev.startTime!, ev.endTime) * HOUR_HEIGHT - 2, 24);
            return (
              <Box key={ev.id} onClick={() => onEventClick(ev)}
                onMouseEnter={e => setHoverState({ ev, anchor: e.currentTarget })}
                onMouseLeave={() => setHoverState(null)}
                sx={{ position: 'absolute', top: top+1, left: 6, right: 6, height: ht, bgcolor: t.bg,
                  borderLeft: `3px solid ${t.color}`, borderRadius: 2, px: 1.5, py: 0.75, cursor: 'pointer',
                  overflow: 'hidden', zIndex: 1, opacity: ev.status==='done' ? 0.45 : 1, '&:hover': { filter: 'brightness(1.2)' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: t.color, fontSize: '0.82rem', mb: '2px' }}>{ev.title}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                  {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                </Typography>
              </Box>
            );
          })}
          {/* Current time indicator */}
          {nowInRange && (
            <>
              <Box sx={{ position: 'absolute', top: nowY - 5, left: -5, width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff4d4d', zIndex: 4, boxShadow: '0 0 6px rgba(255,77,77,0.8)' }}/>
              <Box sx={{ position: 'absolute', top: nowY, left: 0, right: 0, height: 2, bgcolor: '#ff4d4d', zIndex: 3, boxShadow: '0 0 4px rgba(255,77,77,0.5)' }}/>
            </>
          )}
        </Box>
      </Box>
      <EventHoverCard ev={hoverState?.ev ?? null} anchorEl={hoverState?.anchor ?? null} onClose={() => setHoverState(null)} />
    </Box>
  );
};

// ─── Task List View ───────────────────────────────────────────────────────────

const EMPTY_SET = new Set<string>();

interface TaskListViewProps {
  tasks: TaskItem[];
  onEdit: (t: TaskItem) => void;
  onDelete: (t: TaskItem) => void;
  onCycleStatus: (t: TaskItem) => void;
  onExecute?: (t: TaskItem) => void;
  executingIds?: Set<string>;
  showProject?: boolean;
}

const TaskListView: React.FC<TaskListViewProps> = ({ tasks, onEdit, onDelete, onCycleStatus, onExecute, executingIds = EMPTY_SET, showProject }) => (
  <Box>
    {tasks.map(task => {
      const tp      = TASK_TYPES[task.type]       ?? TASK_TYPES.manual;
      const pri     = PRIORITY_CFG[task.priority]  ?? PRIORITY_CFG.medium;
      const ov      = isOverdue(task.dueDate) && task.status !== 'done';
      const done    = task.status === 'done';
      const isAi    = task.type === 'ai';
      const running = executingIds.has(task.id);
      return (
        <Box key={task.id} onClick={() => onEdit(task)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.875,
            borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', opacity: done ? 0.5 : 1,
            transition: 'background 0.15s', cursor: 'pointer',
            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', '& .row-act': { opacity: 1 } },
          }}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); onCycleStatus(task); }}
            sx={{ p: '2px', color: done ? '#43e97b' : 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { color: '#43e97b' } }}>
            {done
              ? <CheckCircleRoundedIcon sx={{ fontSize: 18 }}/>
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18 }}/>}
          </IconButton>
          {/* タイトル + メタ情報を縦2行に分ける */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.375 }}>
            {/* 1行目: タイトル */}
            <Typography variant="body2"
              sx={{ fontWeight: 600, fontSize: '0.83rem',
                color: done ? 'rgb(var(--brand-fg-rgb) / 0.35)' : 'var(--brand-fg)',
                textDecoration: done ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Box component="span" sx={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', bgcolor: pri.color, mr: 0.75, mb: '1px', verticalAlign: 'middle' }}/>
              {task.title}
            </Typography>
            {/* 2行目: ラベル・日付・ステータス */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Chip label={tp.label} size="small"
                sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, color: tp.color, bgcolor: tp.bg }}/>
              {showProject && task.projectName && (
                <Chip label={task.projectName} size="small"
                  sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', maxWidth: 100 }}/>
              )}
              {task.assigneeName && (
                <Chip label={`@${task.assigneeName}`} size="small"
                  sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600, color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.12)', maxWidth: 100 }}/>
              )}
              {task.dueDate && (
                <Typography sx={{ fontSize: '0.68rem', whiteSpace: 'nowrap',
                  color: ov ? 'light-dark(#a80637, #fa709a)' : 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: ov ? 700 : 500 }}>
                  {formatShort(task.dueDate)}
                </Typography>
              )}
              {isAi && task.startTime && !done && (
                <Typography sx={{ fontSize: '0.62rem', whiteSpace: 'nowrap', color: 'rgba(0,191,255,0.6)', fontWeight: 600 }}>
                  {task.startTime}
                </Typography>
              )}
              <Chip label={STATUS_CFG[task.status]?.label ?? '未着手'} size="small"
                onClick={e => { e.stopPropagation(); onCycleStatus(task); }}
                sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer',
                  color: STATUS_CFG[task.status]?.color ?? 'rgb(var(--brand-fg-rgb) / 0.5)',
                  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)' } }}/>
            </Box>
          </Box>
          {isAi && !done && (
            <Button size="small" disabled={running}
              onClick={e => { e.stopPropagation(); onExecute(task); }}
              startIcon={running
                ? <CircularProgress size={11} sx={{ color: '#00BFFF' }}/>
                : <AutoAwesomeRoundedIcon sx={{ fontSize: 13 }}/>}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '0.7rem',
                px: 1, py: 0.375, color: '#00BFFF',
                bgcolor: running ? 'rgba(0,191,255,0.12)' : 'transparent',
                border: '1px solid rgba(0,191,255,0.3)', borderRadius: 1.5,
                '&:hover:not(:disabled)': { bgcolor: 'rgba(0,191,255,0.15)' },
                '&.Mui-disabled': { color: '#00BFFF', border: '1px solid rgba(0,191,255,0.2)' } }}>
              {running ? '実行中…' : '実行'}
            </Button>
          )}
          {task.taskKind === 'interview' && !done && (
            <Button size="small"
              onClick={async e => {
                e.stopPropagation();
                const url = task.linkUrl || (task.articleId ? `https://sekkeiya.com/admin/articles/${task.articleId}/edit` : '');
                if (!url) return;
                try { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
                catch { try { window.open(url, '_blank'); } catch { /* noop */ } }
              }}
              startIcon={<MicRoundedIcon sx={{ fontSize: 13 }}/>}
              sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 700, fontSize: '0.7rem',
                px: 1, py: 0.375, color: '#000', bgcolor: '#fb923c',
                borderRadius: 1.5, '&:hover': { bgcolor: '#f97316' } }}>
              取材を開始
            </Button>
          )}
        </Box>
      );
    })}
  </Box>
);

// ─── Kanban View ──────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: TaskItem[];
  onEdit: (t: TaskItem) => void;
  onDelete: (t: TaskItem) => void;
  onCycleStatus: (t: TaskItem) => void;
  onExecute?: (t: TaskItem) => void;
  executingIds?: Set<string>;
  onInlineSave: (title: string, type: TaskType, status: TaskStatus) => void;
  showProject?: boolean;
}

const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onEdit, onDelete, onExecute, executingIds = EMPTY_SET, onInlineSave, showProject }) => {
  const [inlineCol,   setInlineCol]   = useState<TaskStatus | null>(null);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineType,  setInlineType]  = useState<TaskType>('manual');

  const commitInline = (colId: TaskStatus) => {
    if (!inlineTitle.trim()) return;
    onInlineSave(inlineTitle.trim(), inlineType, colId);
    setInlineCol(null); setInlineTitle(''); setInlineType('manual');
  };
  const cancelInline = () => { setInlineCol(null); setInlineTitle(''); setInlineType('manual'); };

  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, px: '2px' }}>
      {KANBAN_COLS.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);
        return (
          <Box key={col.id} sx={{ flex: '0 0 200px', minWidth: 200 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 1, color: col.color }}>
                {col.label}
              </Typography>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontWeight: 700 }}>
                  {colTasks.length}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875, minHeight: 60 }}>
              {colTasks.map(task => {
                const tp      = TASK_TYPES[task.type]       ?? TASK_TYPES.manual;
                const pri     = PRIORITY_CFG[task.priority]  ?? PRIORITY_CFG.medium;
                const ov      = isOverdue(task.dueDate) && task.status !== 'done';
                const isAi    = task.type === 'ai';
                const running = executingIds.has(task.id);
                return (
                  <Paper key={task.id} onClick={() => onEdit(task)}
                    sx={{ p: 1.25, cursor: 'pointer',
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)',
                      borderRadius: 2, transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', transform: 'translateY(-1px)', '& .kact': { opacity: 1 } },
                    }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.625 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, flex: 1, minWidth: 0 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: pri.color, flexShrink: 0, mt: '4px' }}/>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.8rem', lineHeight: 1.3 }}>
                          {task.title}
                        </Typography>
                      </Box>
                      <Box className="kact" sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, ml: 0.5, display: 'flex', gap: '2px' }}>
                        {isAi && task.status !== 'done' && (
                          <Tooltip title={running ? '実行中…' : 'AIに実行させる'}>
                            <span>
                              <IconButton size="small" disabled={running} onClick={e => { e.stopPropagation(); onExecute(task); }}
                                sx={{ p: '2px', color: running ? '#00BFFF' : 'rgba(0,191,255,0.7)',
                                  '&:hover:not(:disabled)': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.12)' },
                                  '&.Mui-disabled': { color: '#00BFFF' } }}>
                                {running
                                  ? <CircularProgress size={10} sx={{ color: '#00BFFF' }}/>
                                  : <AutoAwesomeRoundedIcon sx={{ fontSize: 12 }}/>}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        <IconButton size="small"
                          onClick={e => { e.stopPropagation(); onDelete(task); }}
                          sx={{ p: '2px', color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'light-dark(#a80637, #fa709a)' } }}>
                          <DeleteRoundedIcon sx={{ fontSize: 12 }}/>
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip label={tp.label} size="small"
                        sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, color: tp.color, bgcolor: tp.bg }}/>
                      {showProject && task.projectName && (
                        <Chip label={task.projectName} size="small"
                          sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600, color: 'rgb(var(--brand-fg-rgb) / 0.6)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', maxWidth: 90 }}/>
                      )}
                      {task.assigneeName && (
                        <Chip label={`@${task.assigneeName}`} size="small"
                          sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600, color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.12)', maxWidth: 90 }}/>
                      )}
                      {task.dueDate && (
                        <Typography sx={{ fontSize: '0.62rem', ml: 'auto',
                          color: ov ? 'light-dark(#a80637, #fa709a)' : 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: ov ? 700 : 500 }}>
                          {formatShort(task.dueDate)}
                        </Typography>
                      )}
                    </Box>
                    {isAi && task.status !== 'done' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 10, color: '#00BFFF' }}/>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(0,191,255,0.7)', fontWeight: 600 }}>
                          {task.startTime ? `${task.dueDate ? task.dueDate.slice(5) + ' ' : ''}${task.startTime} 自動実行` : 'AI自動実行予定'}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                );
              })}

              {/* Inline add card */}
              {inlineCol === col.id ? (
                <Box sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', border: '1px solid rgba(0,191,255,0.25)', borderRadius: 2, p: 1.125 }}>
                  <TextField
                    autoFocus
                    value={inlineTitle}
                    onChange={e => setInlineTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && inlineTitle.trim()) commitInline(col.id);
                      if (e.key === 'Escape') cancelInline();
                    }}
                    placeholder="タスク名を入力..."
                    size="small" fullWidth multiline maxRows={3}
                    InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: '0.8rem', fontWeight: 600, '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' } } }}
                  />
                  <FormControl size="small" variant="outlined" sx={{ mt: 0.75, minWidth: 100 }}>
                    <Select value={inlineType} onChange={e => setInlineType(e.target.value as TaskType)}
                      sx={{ height: 22, fontSize: '0.63rem', fontWeight: 700, color: TASK_TYPES[inlineType].color, bgcolor: TASK_TYPES[inlineType].bg, borderRadius: 1, '& fieldset': { borderColor: 'transparent' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 14 } }}
                      MenuProps={{ PaperProps: { sx: menuPpr } }}>
                      {(Object.entries(TASK_TYPES) as [TaskType, typeof TASK_TYPES[TaskType]][]).map(([k, v]) => (
                        <MenuItem key={k} value={k} sx={{ fontSize: '0.72rem', color: v.color, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{v.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={cancelInline}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', py: 0.25, px: 0.75, '&:hover': { color: 'var(--brand-fg)' } }}>
                      キャンセル
                    </Button>
                    <Button size="small" onClick={() => commitInline(col.id)} disabled={!inlineTitle.trim()}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.68rem', bgcolor: 'rgba(0,191,255,0.15)', color: '#00BFFF', py: 0.25, px: 0.75, borderRadius: 1,
                        '&:hover': { bgcolor: 'rgba(0,191,255,0.25)' }, '&:disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)', bgcolor: 'transparent' } }}>
                      追加
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 13 }}/>}
                  onClick={() => { setInlineCol(col.id); setInlineTitle(''); setInlineType('manual'); }}
                  sx={{ justifyContent: 'flex-start', color: 'rgb(var(--brand-fg-rgb) / 0.35)', textTransform: 'none',
                    fontWeight: 600, fontSize: '0.75rem', py: 0.625,
                    '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
                  カードを追加
                </Button>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

// ─── Inline Add Row (list view) ───────────────────────────────────────────────

interface InlineAddRowProps {
  onSave: (title: string, type: TaskType) => void;
  onCancel: () => void;
}

const InlineAddRow: React.FC<InlineAddRowProps> = ({ onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [type,  setType]  = useState<TaskType>('manual');

  const commit = () => {
    if (!title.trim()) return;
    onSave(title.trim(), type);
    setTitle(''); setType('manual');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.875,
      borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)',
      bgcolor: 'rgba(0,191,255,0.04)', borderLeft: '3px solid rgba(0,191,255,0.4)' }}>
      {/* Unchecked circle */}
      <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgb(var(--brand-fg-rgb) / 0.25)', flexShrink: 0 }}/>
      {/* Priority dot (default medium) */}
      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: PRIORITY_CFG.medium.color, flexShrink: 0 }}/>
      {/* Title input */}
      <TextField
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && title.trim()) commit();
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="タスク名を入力... (Enter で保存)"
        variant="standard"
        size="small"
        sx={{ flex: 1,
          '& input': { color: 'var(--brand-fg)', fontSize: '0.83rem', fontWeight: 600, py: 0 },
          '& .MuiInput-underline:before': { borderBottomColor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
          '& .MuiInput-underline:after':  { borderBottomColor: '#00BFFF' },
        }}
      />
      {/* Type selector */}
      <FormControl size="small" variant="standard" sx={{ flexShrink: 0, minWidth: 88 }}>
        <Select value={type} onChange={e => setType(e.target.value as TaskType)} disableUnderline
          sx={{ fontSize: '0.68rem', fontWeight: 700, color: TASK_TYPES[type].color,
            bgcolor: TASK_TYPES[type].bg, borderRadius: 1, px: 0.75, py: '2px',
            '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 14 } }}
          MenuProps={{ PaperProps: { sx: menuPpr } }}>
          {(Object.entries(TASK_TYPES) as [TaskType, typeof TASK_TYPES[TaskType]][]).map(([k, v]) => (
            <MenuItem key={k} value={k} sx={{ fontSize: '0.72rem', color: v.color, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{v.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {/* Close */}
      <IconButton size="small" onClick={onCancel}
        sx={{ p: '2px', color: 'rgb(var(--brand-fg-rgb) / 0.25)', '&:hover': { color: 'light-dark(#a80637, #fa709a)' }, flexShrink: 0 }}>
        <CloseRoundedIcon sx={{ fontSize: 15 }}/>
      </IconButton>
    </Box>
  );
};

// ─── Schedule Side Panel ─────────────────────────────────────────────────────

type ScheduleFormData = Omit<ScheduleItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'projectId' | 'projectName'>;

const BLANK_SCH: ScheduleFormData = { title: '', description: '', dueDate: '', startTime: '', endTime: '', type: 'meeting', status: 'upcoming' };

interface ScheduleSidePanelProps {
  initial: ScheduleItem | null;
  defaultDate?: string;
  defaultTime?: string;
  onClose: () => void;
  onSave: (f: ScheduleFormData) => void;
  onDelete?: () => void;
}

const ScheduleSidePanel: React.FC<ScheduleSidePanelProps> = ({ initial, defaultDate, defaultTime, onClose, onSave, onDelete }) => {
  const [f, setF] = useState<ScheduleFormData>(BLANK_SCH);
  useEffect(() => {
    if (initial) {
      const { id: _, createdBy: _cb, createdAt: _ca, updatedAt: _ua, projectId: _pi, projectName: _pn, ...rest } = initial as any;
      setF({ ...BLANK_SCH, ...rest });
    } else {
      setF({ ...BLANK_SCH, dueDate: defaultDate ?? toDateStr(new Date()), startTime: defaultTime ?? '' });
    }
  }, [initial, defaultDate, defaultTime]);
  const set = (k: keyof ScheduleFormData) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setF(p => ({ ...p, [k]: (e.target as any).value }));
  const valid = f.title.trim() && f.dueDate;
  const t = SCHEDULE_TYPES[f.type] ?? SCHEDULE_TYPES.other;

  return (
    <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: t.color, flexShrink: 0 }}/>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-fg)', flex: 1 }}>
          {initial ? '予定を編集' : '予定を追加'}
        </Typography>
        {initial && onDelete && (
          <Tooltip title="削除">
            <IconButton size="small" onClick={onDelete} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'light-dark(#a80637, #fa709a)' } }}>
              <DeleteRoundedIcon sx={{ fontSize: 14 }}/>
            </IconButton>
          </Tooltip>
        )}
        <IconButton size="small" onClick={onClose} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon sx={{ fontSize: 16 }}/>
        </IconButton>
      </Box>

      {/* Form */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="タイトル *" value={f.title} onChange={set('title')} fullWidth size="small" autoFocus
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
        <TextField label="日付 *" type="date" value={f.dueDate} onChange={set('dueDate')} fullWidth size="small"
          InputLabelProps={{ shrink: true, sx: lblSx }}
          InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label="開始時刻" type="time" value={f.startTime ?? ''} onChange={set('startTime')} fullWidth size="small"
            InputLabelProps={{ shrink: true, sx: lblSx }}
            InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
          <TextField label="終了時刻" type="time" value={f.endTime ?? ''} onChange={set('endTime')} fullWidth size="small"
            InputLabelProps={{ shrink: true, sx: lblSx }}
            InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
        </Box>
        <FormControl size="small" fullWidth>
          <InputLabel sx={lblSx}>種別</InputLabel>
          <Select value={f.type} onChange={set('type') as any} label="種別" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
            {(Object.entries(SCHEDULE_TYPES) as [ScheduleType, typeof SCHEDULE_TYPES[ScheduleType]][]).map(([k, v]) => (
              <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth>
          <InputLabel sx={lblSx}>ステータス</InputLabel>
          <Select value={f.status} onChange={set('status') as any} label="ステータス" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
            <MenuItem value="upcoming" sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>予定</MenuItem>
            <MenuItem value="done"     sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>完了</MenuItem>
          </Select>
        </FormControl>
        <TextField label="詳細・メモ" value={f.description ?? ''} onChange={set('description')} fullWidth size="small" multiline minRows={4}
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', gap: 1, justifyContent: 'flex-end', flexShrink: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}>
          キャンセル
        </Button>
        <Button onClick={() => onSave(f)} disabled={!valid} variant="contained"
          sx={{ bgcolor: '#43e97b', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, fontSize: '0.78rem',
            '&:hover': { bgcolor: '#57f788' }, '&:disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
          {initial ? '保存' : '追加'}
        </Button>
      </Box>
    </Box>
  );
};

// ─── Task Side Panel ──────────────────────────────────────────────────────────

type TaskFormData = Omit<TaskItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'projectId' | 'projectName'>;

const BLANK_TASK: TaskFormData = { title: '', description: '', type: 'manual', priority: 'medium', status: 'todo', dueDate: '', startTime: '', endTime: '' };

interface TaskSidePanelProps {
  initial: TaskItem | null;
  onClose: () => void;
  onSave: (f: TaskFormData, projectId?: string) => void;
  onDelete?: () => void;
  /** allMode の新規作成時のみ渡す。パネル内でプロジェクトを選択させる。 */
  projectOptions?: { id: string; name: string }[];
  /** 新規作成時のタスク種別プリセット */
  initialType?: TaskType;
}

const TaskSidePanel: React.FC<TaskSidePanelProps> = ({ initial, onClose, onSave, onDelete, projectOptions, initialType }) => {
  const [f, setF] = useState<TaskFormData>(BLANK_TASK);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const uid = useAuthStore(s => s.currentUser?.uid);

  useEffect(() => {
    if (initial) {
      const { id: _, createdBy: _cb, createdAt: _ca, updatedAt: _ua, projectId: _pi, projectName: _pn, ...rest } = initial as any;
      setF({ ...BLANK_TASK, ...rest });
    } else {
      setF({ ...BLANK_TASK, type: initialType ?? 'manual' });
      setSelectedProjectId(projectOptions?.[0]?.id ?? '');
    }
  }, [initial, projectOptions, initialType]);

  // 新規作成時のみ履歴サジェストをロード
  useEffect(() => {
    if (initial || !uid) return;
    const histCol = (initialType === 'ai') ? 'aiTaskHistory' : 'userTaskHistory';
    getDocs(query(collection(db, 'users', uid, histCol), orderBy('createdAt', 'desc'), limit(50)))
      .then(snap => {
        const freq = new Map<string, number>();
        for (const d of snap.docs) {
          const t = (d.data().title as string) || '';
          freq.set(t, (freq.get(t) ?? 0) + 1);
        }
        setSuggestions([...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t));
      })
      .catch(() => {});
  }, [initial, uid, initialType]);

  const set = (k: keyof TaskFormData) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setF(p => ({ ...p, [k]: (e.target as any).value }));
  const needsProject = !initial && !!projectOptions;
  const valid = f.title.trim() && (!needsProject || !!selectedProjectId);
  const tp = TASK_TYPES[f.type] ?? TASK_TYPES.manual;

  const isAiTask = f.type === 'ai';
  const accentColor = initialType === 'ai' ? '#00BFFF' : '#a18cd1';
  const headerColor = initial ? tp.color : accentColor;
  const headerTitle = initial
    ? 'タスクを編集'
    : initialType === 'ai' ? 'AIタスク追加' : 'ユーザータスク追加';

  const visibleSuggestions = suggestions.filter(s =>
    !f.title.trim() || s.toLowerCase().includes(f.title.trim().toLowerCase())
  );

  return (
    <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: headerColor, flexShrink: 0 }}/>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-fg)', flex: 1 }}>
          {headerTitle}
        </Typography>
        {initial && onDelete && (
          <Tooltip title="削除">
            <IconButton size="small" onClick={onDelete} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&:hover': { color: 'light-dark(#a80637, #fa709a)' } }}>
              <DeleteRoundedIcon sx={{ fontSize: 14 }}/>
            </IconButton>
          </Tooltip>
        )}
        <IconButton size="small" onClick={onClose} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon sx={{ fontSize: 16 }}/>
        </IconButton>
      </Box>

      {/* Form */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {needsProject && (
          <FormControl size="small" fullWidth>
            <InputLabel sx={lblSx}>プロジェクト *</InputLabel>
            <Select value={selectedProjectId} onChange={e => setSelectedProjectId(e.target.value as string)}
              label="プロジェクト *" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
              {projectOptions!.map(p => (
                <MenuItem key={p.id} value={p.id} sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Box>
          <TextField label="タイトル *" value={f.title} onChange={set('title')} fullWidth size="small" autoFocus
            InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
          {!initial && visibleSuggestions.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
              {visibleSuggestions.map(s => (
                <Box key={s} onClick={() => setF(p => ({ ...p, title: s }))}
                  sx={{ fontSize: '0.68rem', px: 0.875, py: 0.25, borderRadius: 10,
                    border: `1px solid color-mix(in srgb, ${accentColor} 27%, transparent)`, color: `color-mix(in srgb, ${accentColor} 80%, transparent)`,
                    bgcolor: `color-mix(in srgb, ${accentColor} 5%, transparent)`, cursor: 'pointer', userSelect: 'none',
                    whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
                    '&:hover': { bgcolor: `color-mix(in srgb, ${accentColor} 10%, transparent)`, color: accentColor } }}>
                  {s}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* 優先度 / ステータス (共通) */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={lblSx}>優先度</InputLabel>
            <Select value={f.priority} onChange={set('priority') as any} label="優先度" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
              {(Object.entries(PRIORITY_CFG) as [TaskPriority, typeof PRIORITY_CFG[TaskPriority]][]).map(([k, v]) => (
                <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel sx={lblSx}>ステータス</InputLabel>
            <Select value={f.status} onChange={set('status') as any} label="ステータス" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
              {(Object.entries(STATUS_CFG) as [TaskStatus, typeof STATUS_CFG[TaskStatus]][]).map(([k, v]) => (
                <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* AIタスク: 開始日時（任意） */}
        {isAiTask ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600, letterSpacing: 0.3 }}>
              開始日時（任意）
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField type="date" value={f.dueDate ?? ''} onChange={set('dueDate')} fullWidth size="small"
                InputLabelProps={{ shrink: true, sx: lblSx }}
                InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
              <TextField type="time" value={f.startTime ?? ''} onChange={set('startTime')} fullWidth size="small"
                InputLabelProps={{ shrink: true, sx: lblSx }}
                InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
            </Box>
          </Box>
        ) : (
          /* ユーザータスク: 期限（任意） */
          <TextField label="期限（任意）" type="date" value={f.dueDate ?? ''} onChange={set('dueDate')} fullWidth size="small"
            InputLabelProps={{ shrink: true, sx: lblSx }}
            InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
        )}

        <TextField label="詳細・メモ" value={f.description ?? ''} onChange={set('description')} fullWidth size="small" multiline minRows={4}
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
      </Box>

      {/* Footer */}
      <Box sx={{ px: 2.5, py: 1.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', gap: 1, justifyContent: 'flex-end', flexShrink: 0 }}>
        <Button onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem' }}>
          キャンセル
        </Button>
        <Button onClick={() => onSave(f, needsProject ? selectedProjectId : undefined)} disabled={!valid} variant="contained"
          sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, fontSize: '0.78rem',
            '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
          {initial ? '保存' : '追加'}
        </Button>
      </Box>
    </Box>
  );
};

// ─── AI Task History Panel ───────────────────────────────────────────────────

interface AiHistoryPanelProps {
  uid: string;
  projectOptions?: { id: string; name: string }[];
  defaultProjectId?: string;
  onClose: () => void;
  onRunNow: (title: string) => void;
  onAddTask: (title: string, projectId: string) => void;
}

const AiHistoryPanel: React.FC<AiHistoryPanelProps> = ({ uid, projectOptions, defaultProjectId, onClose, onRunNow, onAddTask }) => {
  const [history, setHistory] = useState<{ title: string; projectId: string; count: number; hasChat: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPid, setSelectedPid] = useState(defaultProjectId ?? projectOptions?.[0]?.id ?? '');

  useEffect(() => {
    getDocs(query(collection(db, 'users', uid, 'aiTaskHistory'), orderBy('createdAt', 'desc'), limit(200)))
      .then(snap => {
        const freq = new Map<string, { projectId: string; count: number; hasChat: boolean }>();
        for (const d of snap.docs) {
          const { title, projectId, source } = d.data() as { title: string; projectId: string; source?: string };
          const prev = freq.get(title);
          freq.set(title, {
            projectId: prev?.projectId ?? projectId,
            count: (prev?.count ?? 0) + 1,
            hasChat: (prev?.hasChat ?? false) || source === 'chat',
          });
        }
        setHistory([...freq.entries()]
          .map(([title, v]) => ({ title, ...v }))
          .sort((a, b) => b.count - a.count));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <HistoryRoundedIcon sx={{ fontSize: 14, color: '#00BFFF' }}/>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-fg)', flex: 1 }}>AIタスク履歴</Typography>
        <IconButton size="small" onClick={onClose} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon sx={{ fontSize: 16 }}/>
        </IconButton>
      </Box>

      {/* プロジェクト選択（追加先） */}
      {projectOptions && projectOptions.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', mb: 0.5 }}>追加先プロジェクト</Typography>
          <Box
            component="select"
            value={selectedPid}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPid(e.target.value)}
            sx={{ width: '100%', fontSize: 12, color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.14)', borderRadius: '6px', px: 1, py: 0.5, outline: 'none', '& option': { bgcolor: 'var(--brand-surface2)' } }}
          >
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: '#00BFFF' }}/>
          </Box>
        )}
        {!loading && history.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)', textAlign: 'center', py: 4 }}>
            履歴がありません
          </Typography>
        )}
        {history.map((item, i) => (
          <Box key={i} sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.78rem', color: 'var(--brand-fg)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                  {item.title}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>
                    {item.count}回
                  </Typography>
                  {item.hasChat && (
                    <Tooltip title="チャットから実行された記録があります" placement="top">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.125, borderRadius: 1, bgcolor: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)' }}>
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 8, color: 'rgba(0,191,255,0.7)' }}/>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(0,191,255,0.7)', lineHeight: 1 }}>Chat</Typography>
                      </Box>
                    </Tooltip>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
                <Button size="small" variant="outlined"
                  onClick={() => onRunNow(item.title)}
                  sx={{ fontSize: '0.62rem', textTransform: 'none', py: 0.25, px: 0.75, minWidth: 0, borderColor: 'rgba(0,191,255,0.4)', color: '#00BFFF', '&:hover': { borderColor: '#00BFFF', bgcolor: 'rgba(0,191,255,0.08)' } }}>
                  今すぐ実行
                </Button>
                <Button size="small" variant="outlined"
                  onClick={() => onAddTask(item.title, selectedPid)}
                  sx={{ fontSize: '0.62rem', textTransform: 'none', py: 0.25, px: 0.75, minWidth: 0, borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)', color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.5)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)' } }}>
                  タスクに追加
                </Button>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ─── User Task History Panel ─────────────────────────────────────────────────

interface UserHistoryPanelProps {
  uid: string;
  projectOptions?: { id: string; name: string }[];
  defaultProjectId?: string;
  onClose: () => void;
  onAddTask: (title: string, projectId: string) => void;
}

const UserHistoryPanel: React.FC<UserHistoryPanelProps> = ({ uid, projectOptions, defaultProjectId, onClose, onAddTask }) => {
  const [history, setHistory] = useState<{ title: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPid, setSelectedPid] = useState(defaultProjectId ?? projectOptions?.[0]?.id ?? '');

  useEffect(() => {
    getDocs(query(collection(db, 'users', uid, 'userTaskHistory'), orderBy('createdAt', 'desc'), limit(100)))
      .then(snap => {
        const freq = new Map<string, number>();
        for (const d of snap.docs) {
          const t = (d.data().title as string) || '';
          freq.set(t, (freq.get(t) ?? 0) + 1);
        }
        setHistory([...freq.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [uid]);

  return (
    <Box sx={{ width: 320, flexShrink: 0, borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.08)', bgcolor: 'var(--brand-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <HistoryRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#48327c, #a18cd1)' }}/>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--brand-fg)', flex: 1 }}>ユーザータスク履歴</Typography>
        <IconButton size="small" onClick={onClose} sx={{ p: '4px', color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}>
          <CloseRoundedIcon sx={{ fontSize: 16 }}/>
        </IconButton>
      </Box>

      {projectOptions && projectOptions.length > 0 && (
        <Box sx={{ px: 2, py: 1, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)' }}>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', mb: 0.5 }}>追加先プロジェクト</Typography>
          <Box
            component="select"
            value={selectedPid}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPid(e.target.value)}
            sx={{ width: '100%', fontSize: 12, color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.14)', borderRadius: '6px', px: 1, py: 0.5, outline: 'none', '& option': { bgcolor: 'var(--brand-surface2)' } }}
          >
            {projectOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Box>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} sx={{ color: 'light-dark(#48327c, #a18cd1)' }}/>
          </Box>
        )}
        {!loading && history.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.3)', textAlign: 'center', py: 4 }}>
            履歴がありません
          </Typography>
        )}
        {history.map((item, i) => (
          <Box key={i} sx={{ px: 2, py: 1.25, borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', display: 'flex', alignItems: 'center', gap: 1, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'var(--brand-fg)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                {item.title}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', mt: 0.25 }}>
                {item.count}回作成
              </Typography>
            </Box>
            <Button size="small" variant="outlined"
              onClick={() => onAddTask(item.title, selectedPid)}
              sx={{ fontSize: '0.62rem', textTransform: 'none', py: 0.25, px: 0.75, minWidth: 0, flexShrink: 0, borderColor: 'rgba(161,140,209,0.4)', color: 'light-dark(#48327c, #a18cd1)', '&:hover': { borderColor: '#a18cd1', bgcolor: 'rgba(161,140,209,0.08)' } }}>
              タスクに追加
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ─── Split Resize Handle (vertical bar, left/right) ─────────────────────────

const SplitResizeHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void; isDragging: boolean }> = ({ onMouseDown, isDragging }) => {
  const [hovered, setHovered] = useState(false);
  const active = hovered || isDragging;
  return (
    <Box
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ width: 12, flexShrink: 0, cursor: 'col-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', position: 'relative' }}
    >
      <Box sx={{
        width: active ? 3 : 2,
        alignSelf: 'stretch',
        backgroundColor: active ? 'rgba(0,191,255,0.55)' : 'rgb(var(--brand-fg-rgb) / 0.07)',
        borderRadius: 1,
        transition: 'all 0.12s',
      }}/>
      {active && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', gap: '4px', pointerEvents: 'none' }}>
          {[0,1,2].map(i => (
            <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(0,191,255,0.9)', boxShadow: '0 0 4px rgba(0,191,255,0.6)' }}/>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Stacked Resize Handle (horizontal bar, top/bottom) ──────────────────────

const StackedResizeHandle: React.FC<{ onMouseDown: (e: React.MouseEvent) => void; isDragging: boolean }> = ({ onMouseDown, isDragging }) => {
  const [hovered, setHovered] = useState(false);
  const active = hovered || isDragging;
  return (
    <Box
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{ height: 12, flexShrink: 0, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', position: 'relative' }}
    >
      <Box sx={{
        height: active ? 3 : 2,
        alignSelf: 'stretch',
        width: '100%',
        backgroundColor: active ? 'rgba(0,191,255,0.55)' : 'rgb(var(--brand-fg-rgb) / 0.07)',
        borderRadius: 1,
        transition: 'all 0.12s',
      }}/>
      {active && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'row', gap: '4px', pointerEvents: 'none' }}>
          {[0,1,2].map(i => (
            <Box key={i} sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: 'rgba(0,191,255,0.9)', boxShadow: '0 0 4px rgba(0,191,255,0.6)' }}/>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface SchedulesTasksListProps {
  project: DesktopProject | null;
}

export const SchedulesTasksList: React.FC<SchedulesTasksListProps> = ({ project }) => {
  const { currentUser } = useAuthStore.getState();
  const isAllMode = project === null;
  const projectId = project?.id ?? '';
  const allProjects = useAppStore(s => s.projects);

  // ── Layout mode ───────────────────────────────────────────────────────────
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');

  // ── Split panel width (calendar %) ────────────────────────────────────────
  const [calWidth, setCalWidth]           = useState(55);
  const [isDraggingDiv, setIsDraggingDiv] = useState(false);
  const splitContainerRef  = useRef<HTMLDivElement>(null);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDiv(true);
    const startX     = e.clientX;
    const startWidth = calWidth;
    document.body.style.cursor = 'col-resize';

    const onMouseMove = (ev: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const containerWidth = splitContainerRef.current.offsetWidth;
      const delta = ev.clientX - startX;
      const deltaPercent = (delta / containerWidth) * 100;
      setCalWidth(Math.min(Math.max(startWidth + deltaPercent, 20), 80));
    };

    const onMouseUp = () => {
      setIsDraggingDiv(false);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [calWidth]);

  // ── Stacked panel height (calendar %) ────────────────────────────────────
  const [calHeight, setCalHeight]           = useState(62);
  const [isDraggingRow, setIsDraggingRow]   = useState(false);
  const stackedContainerRef = useRef<HTMLDivElement>(null);

  const handleRowDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRow(true);
    const startY      = e.clientY;
    const startHeight = calHeight;
    document.body.style.cursor = 'row-resize';

    const onMouseMove = (ev: MouseEvent) => {
      if (!stackedContainerRef.current) return;
      const containerHeight = stackedContainerRef.current.offsetHeight;
      const delta = ev.clientY - startY;
      const deltaPercent = (delta / containerHeight) * 100;
      setCalHeight(Math.min(Math.max(startHeight + deltaPercent, 20), 80));
    };

    const onMouseUp = () => {
      setIsDraggingRow(false);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [calHeight]);

  // ── Project filter (account/all mode only) ────────────────────────────────
  // null = すべて、string = 特定 projectId でフィルタ
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  // ── Calendar state ────────────────────────────────────────────────────────
  const [calView, setCalView] = useState<CalView>('month');
  const [calDate, setCalDate] = useState<Date>(new Date());

  const year     = calDate.getFullYear();
  const month    = calDate.getMonth();
  const weekDays = useMemo(() => getWeekDays(calDate), [calDate]);

  const navigateCal = (dir: number) => {
    setCalDate(d => {
      const nd = new Date(d);
      if (calView === 'month') nd.setMonth(nd.getMonth() + dir);
      if (calView === 'week')  nd.setDate(nd.getDate() + dir * 7);
      if (calView === 'day')   nd.setDate(nd.getDate() + dir);
      return nd;
    });
  };

  const calLabel = useMemo(() => {
    if (calView === 'month') return `${year}年 ${MONTH_NAMES[month]}`;
    if (calView === 'week') {
      const ws = weekDays[0], we = weekDays[6];
      return `${ws.getFullYear()}年 ${MONTH_NAMES[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}日`;
    }
    return `${year}年 ${MONTH_NAMES[month]} ${calDate.getDate()}日（${DAY_LABELS[(calDate.getDay()+6)%7]}）`;
  }, [calView, year, month, calDate, weekDays]);

  // ── Task state ────────────────────────────────────────────────────────────
  const [taskView,        setTaskView]        = useState<TaskView>('list');
  const [taskPanelMode,   setTaskPanelMode]   = useState<TaskPanelMode>('both');
  const [userTaskFilter,  setUserTaskFilter]  = useState<UserTaskFilter>('all');
  const [aiTaskFilter,    setAiTaskFilter]    = useState<AITaskFilter>('all');
  const [taskPanelHeight, setTaskPanelHeight] = useState(55);
  const [isDraggingTP,    setIsDraggingTP]    = useState(false);
  const taskAreaRef = useRef<HTMLDivElement>(null);

  // ── Task panel divider — row-resize (split) or col-resize (stacked) ──────
  const handleTaskPanelDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTP(true);
    const isHoriz    = layoutMode === 'stacked';
    const startPos   = isHoriz ? e.clientX : e.clientY;
    const startRatio = taskPanelHeight;
    document.body.style.cursor = isHoriz ? 'col-resize' : 'row-resize';

    const onMouseMove = (ev: MouseEvent) => {
      if (!taskAreaRef.current) return;
      const size  = isHoriz ? taskAreaRef.current.offsetWidth : taskAreaRef.current.offsetHeight;
      const delta = (isHoriz ? ev.clientX : ev.clientY) - startPos;
      setTaskPanelHeight(Math.min(Math.max(startRatio + (delta / size) * 100, 20), 80));
    };
    const onMouseUp = () => {
      setIsDraggingTP(false);
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [taskPanelHeight, layoutMode]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [tasks,     setTasks]     = useState<TaskItem[]>([]);
  const [loadingS,  setLoadingS]  = useState(true);
  const [loadingT,  setLoadingT]  = useState(true);

  // Single-project subscription
  useEffect(() => {
    if (isAllMode || !projectId) return;
    const unsubS = onSnapshot(
      query(collection(db, 'projects', projectId, 'schedules'), orderBy('dueDate', 'asc')),
      snap => { setSchedules(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleItem))); setLoadingS(false); },
      err  => { console.error('[schedules]', err); setLoadingS(false); }
    );
    const unsubT = onSnapshot(
      query(collection(db, 'projects', projectId, 'tasks'), orderBy('createdAt', 'asc')),
      snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as TaskItem))); setLoadingT(false); },
      err  => { console.error('[tasks]', err); setLoadingT(false); }
    );
    return () => { unsubS(); unsubT(); };
  }, [projectId, isAllMode]);

  // All-projects subscription (account site mode)
  useEffect(() => {
    if (!isAllMode || !allProjects.length) {
      if (isAllMode) { setLoadingS(false); setLoadingT(false); }
      return;
    }
    const schedMap: Record<string, ScheduleItem[]> = {};
    const taskMap:  Record<string, TaskItem[]>     = {};
    setLoadingS(true); setLoadingT(true);

    const unsubs = allProjects.flatMap(p => [
      onSnapshot(
        query(collection(db, 'projects', p.id, 'schedules'), orderBy('dueDate', 'asc')),
        snap => {
          schedMap[p.id] = snap.docs.map(d => ({ id: d.id, projectId: p.id, projectName: p.name, ...d.data() } as ScheduleItem));
          setSchedules(Object.values(schedMap).flat().sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')));
          setLoadingS(false);
        },
        err => { console.error('[all-schedules]', err); setLoadingS(false); }
      ),
      onSnapshot(
        query(collection(db, 'projects', p.id, 'tasks'), orderBy('createdAt', 'asc')),
        snap => {
          taskMap[p.id] = snap.docs.map(d => ({ id: d.id, projectId: p.id, projectName: p.name, ...d.data() } as TaskItem));
          setTasks(Object.values(taskMap).flat());
          setLoadingT(false);
        },
        err => { console.error('[all-tasks]', err); setLoadingT(false); }
      ),
    ]);
    return () => unsubs.forEach(u => u());
  }, [isAllMode, allProjects]);

  // ── Side panel state ──────────────────────────────────────────────────────
  const [sidePanel, setSidePanel] = useState<SidePanelState>(null);

  const setAiTaskInnerRight = useAppStore(s => s.setAiTaskInnerRight);
  useEffect(() => {
    setAiTaskInnerRight(sidePanel !== null ? 320 : 0);
    return () => setAiTaskInnerRight(0);
  }, [sidePanel, setAiTaskInnerRight]);

  // FloatingBatchGenPanel 等から新規タスク作成を起動する
  const pendingOpenNewTask = useAppStore(s => s.pendingOpenNewTask);
  const setPendingOpenNewTask = useAppStore(s => s.setPendingOpenNewTask);
  useEffect(() => {
    if (!pendingOpenNewTask) return;
    setSidePanel({ kind: 'new-task', initialType: pendingOpenNewTask as TaskType });
    setPendingOpenNewTask(null);
  }, [pendingOpenNewTask, setPendingOpenNewTask]);

  // ── 削除確認ダイアログ state ──────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'task';     item: TaskItem }
    | { kind: 'schedule'; item: ScheduleItem }
    | null
  >(null);

  // ── Inline add state (list view, single-project mode only) ───────────────
  const [inlineListAdd, setInlineListAdd] = useState(false);

  const openNewSchedule = useCallback((date?: Date, time?: string) => {
    setSidePanel({ kind: 'new-schedule', date: date ? toDateStr(date) : toDateStr(new Date()), time: time || undefined });
  }, []);
  const openEditSchedule = useCallback((ev: ScheduleItem) => { setSidePanel({ kind: 'schedule', item: ev }); }, []);
  const openEditTask = useCallback((t: TaskItem) => { setSidePanel({ kind: 'task', item: t }); }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const uid = currentUser?.uid ?? 'unknown';

  const saveSch = useCallback(async (f: ScheduleFormData) => {
    if (sidePanel?.kind === 'schedule') {
      const pid = isAllMode ? (sidePanel.item.projectId ?? '') : projectId;
      if (!pid) return;
      await updateDoc(doc(db, 'projects', pid, 'schedules', sidePanel.item.id), { ...f, updatedAt: serverTimestamp(), updatedBy: uid });
    } else {
      if (!projectId) return;
      await addDoc(collection(db, 'projects', projectId, 'schedules'), { ...f, createdAt: serverTimestamp(), createdBy: uid });
    }
    setSidePanel(null);
  }, [sidePanel, isAllMode, projectId, uid]);

  const deleteSch = useCallback(async (item: ScheduleItem) => {
    setDeleteTarget({ kind: 'schedule', item });
  }, []);

  const confirmDeleteSch = useCallback(async (item: ScheduleItem) => {
    const pid = isAllMode ? (item.projectId ?? '') : projectId;
    if (!pid) return;
    await deleteDoc(doc(db, 'projects', pid, 'schedules', item.id));
    setSidePanel(null);
  }, [isAllMode, projectId]);

  const saveTask = useCallback(async (f: TaskFormData, overrideProjectId?: string) => {
    if (sidePanel?.kind === 'task') {
      const pid = isAllMode ? (sidePanel.item.projectId ?? '') : projectId;
      if (!pid) return;
      await updateDoc(doc(db, 'projects', pid, 'tasks', sidePanel.item.id), { ...f, updatedAt: serverTimestamp(), updatedBy: uid });
    } else {
      const pid = overrideProjectId || projectId;
      if (!pid || !uid) return;
      const histCol = f.type === 'ai' ? 'aiTaskHistory' : 'userTaskHistory';
      await Promise.all([
        addDoc(collection(db, 'projects', pid, 'tasks'), { ...f, createdAt: serverTimestamp(), createdBy: uid }),
        addDoc(collection(db, 'users', uid, histCol), { title: f.title.trim(), projectId: pid, createdAt: serverTimestamp() }),
      ]);
    }
    setSidePanel(null);
  }, [sidePanel, isAllMode, projectId, uid]);

  // ── Inline task save (no dialog) ──────────────────────────────────────────
  const saveInlineTask = useCallback(async (title: string, type: TaskType, status: TaskStatus = 'todo') => {
    await addDoc(collection(db, 'projects', projectId, 'tasks'), {
      title, type, priority: 'medium' as TaskPriority, status, dueDate: '', description: '',
      createdAt: serverTimestamp(), createdBy: uid,
    });
    setInlineListAdd(false);
  }, [projectId, uid]);

  const deleteTask = useCallback(async (item: TaskItem) => {
    setDeleteTarget({ kind: 'task', item });
  }, []);

  const confirmDeleteTask = useCallback(async (item: TaskItem) => {
    const pid = isAllMode ? (item.projectId ?? '') : projectId;
    if (!pid) return;
    await deleteDoc(doc(db, 'projects', pid, 'tasks', item.id));
    setSidePanel(null);
  }, [isAllMode, projectId]);

  // ── ユーザータスク履歴: タスクに追加 ──────────────────────────────────────
  const handleUserHistoryAddTask = useCallback(async (title: string, pid: string) => {
    if (!pid || !uid) return;
    await Promise.all([
      addDoc(collection(db, 'projects', pid, 'tasks'), {
        title, type: 'manual', priority: 'medium', status: 'todo', dueDate: '', description: '',
        createdAt: serverTimestamp(), createdBy: uid,
      }),
      addDoc(collection(db, 'users', uid, 'userTaskHistory'), { title, projectId: pid, createdAt: serverTimestamp() }),
    ]);
    setSidePanel(null);
  }, [uid]);

  // ── 履歴パネル: 今すぐ実行 ─────────────────────────────────────────────────
  const handleHistoryRunNow = useCallback(async (title: string) => {
    setSidePanel(null);
    const msg = [
      `【AIタスク実行】${title}`,
      `プロジェクトID: ${isAllMode ? '' : (projectId ?? '')}`,
      `このタスクを実行してください。`,
    ].filter(Boolean).join('\n');
    try {
      const { useCoreOrchestrator } = await import('../../store/useCoreOrchestrator');
      useCoreOrchestrator.getState().sendMessageToOrchestrator(msg);
      useAppStore.getState().setAIChatOpen(true);
    } catch (e) { console.error('[historyRunNow]', e); }
  }, [isAllMode, projectId]);

  // ── 履歴パネル: タスクに追加 ───────────────────────────────────────────────
  const handleHistoryAddTask = useCallback(async (title: string, pid: string) => {
    if (!pid || !uid) return;
    await addDoc(collection(db, 'users', uid, 'aiTaskHistory'), { title, projectId: pid, createdAt: serverTimestamp() });
    await addDoc(collection(db, 'projects', pid, 'tasks'), {
      title, type: 'ai', priority: 'medium', status: 'todo', dueDate: '', description: '',
      createdAt: serverTimestamp(), createdBy: uid,
    });
    setSidePanel(null);
  }, [uid]);

  const cycleStatus = useCallback(async (item: TaskItem) => {
    const pid = isAllMode ? (item.projectId ?? '') : projectId;
    if (!pid) return;
    await updateDoc(doc(db, 'projects', pid, 'tasks', item.id),
      { status: STATUS_CYCLE[item.status] ?? 'todo', updatedAt: serverTimestamp() });
  }, [isAllMode, projectId]);

  // ── AI タスク実行（手動「実行」ボタン用） ─────────────────────────────────
  // 開始時刻による自動実行はグローバル常駐の FloatingBatchGenPanel に一本化した
  // （以前はここにも 1 分毎タイマーがあり二重実行の恐れがあった）。
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());

  const executeAiTask = useCallback(async (item: TaskItem) => {
    const pid = isAllMode ? (item.projectId ?? '') : projectId;
    if (!pid || executingIds.has(item.id)) return;

    setExecutingIds(prev => new Set(prev).add(item.id));

    // in_progress に更新
    await updateDoc(doc(db, 'projects', pid, 'tasks', item.id),
      { status: 'in_progress', updatedAt: serverTimestamp() });

    // Chat セッションを確保してメッセージ送信
    const aiChatStore = useAIChatStore.getState();
    let sessionId = aiChatStore.activeSessionId;
    if (!sessionId && pid) {
      sessionId = aiChatStore.createSession(pid);
    }

    const msg = [
      `【AIタスク実行】${item.title}`,
      item.description ? `内容: ${item.description}` : '',
      `プロジェクトID: ${pid}`,
      `タスクID: ${item.id}`,
      `このタスクを実行し、完了したら task_update ツールで status を "done" に更新してください。`,
    ].filter(Boolean).join('\n');

    try {
      await useCoreOrchestrator.getState().sendMessageToOrchestrator(msg, {
        source: 'task_auto_execute',
        sessionId: sessionId ?? undefined,
      });
    } catch (e) {
      console.error('[executeAiTask]', e);
      await updateDoc(doc(db, 'projects', pid, 'tasks', item.id),
        { status: 'todo', updatedAt: serverTimestamp() });
    } finally {
      setExecutingIds(prev => { const s = new Set(prev); s.delete(item.id); return s; });
    }
  }, [isAllMode, projectId, executingIds]);

  // ── Project-filtered base sets (account mode only) ───────────────────────
  const visibleSchedules = useMemo(() =>
    isAllMode && projectFilter ? schedules.filter(s => s.projectId === projectFilter) : schedules,
  [schedules, isAllMode, projectFilter]);

  const visibleTasks = useMemo(() =>
    isAllMode && projectFilter ? tasks.filter(t => t.projectId === projectFilter) : tasks,
  [tasks, isAllMode, projectFilter]);

  // ── Split by panel type ───────────────────────────────────────────────────
  const userTasks = useMemo(() => visibleTasks.filter(t => t.type !== 'ai'), [visibleTasks]);
  const aiTasks   = useMemo(() => visibleTasks.filter(t => t.type === 'ai'),  [visibleTasks]);

  const sortByDate = (a: TaskItem, b: TaskItem): number => {
    const aDate = a.dueDate ?? '';
    const bDate = b.dueDate ?? '';
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    const aTime = a.startTime ?? '';
    const bTime = b.startTime ?? '';
    if (!aTime && !bTime) return 0;
    if (!aTime) return 1;
    if (!bTime) return -1;
    return aTime < bTime ? -1 : 1;
  };

  const filteredUserTasks = useMemo(() => userTasks.filter(t => {
    if (userTaskFilter === 'all')         return true;
    if (userTaskFilter === 'todo')        return t.status === 'todo';
    if (userTaskFilter === 'in_progress') return t.status === 'in_progress';
    if (userTaskFilter === 'done')        return t.status === 'done';
    return true;
  }).sort(sortByDate), [userTasks, userTaskFilter]);

  const filteredAiTasks = useMemo(() => aiTasks.filter(t => {
    if (aiTaskFilter === 'all') return true;
    return t.status === aiTaskFilter;
  }).sort(sortByDate), [aiTasks, aiTaskFilter]);

  const aiWaiting  = aiTasks.filter(t => t.status !== 'done').length;
  const aiRunning  = aiTasks.filter(t => t.status === 'in_progress').length;
  const overdueN   = visibleTasks.filter(t => isOverdue(t.dueDate) && t.status !== 'done').length;
  const pendingN   = userTasks.filter(t => t.status !== 'done').length;

  // ── Reusable calendar panel ───────────────────────────────────────────────
  const calendarPanel = (
    <Paper sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Calendar header label */}
      <Box sx={{ px: 2, pt: 1.25, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <CalendarMonthRoundedIcon sx={{ fontSize: 14, color: '#43e97b' }}/>
        <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 1, color: '#43e97b', textTransform: 'uppercase' }}>
          スケジュール（予定）
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', ml: 0.5 }}>
          日付・時間が確定したイベント
        </Typography>
      </Box>

      {/* Calendar toolbar — 1行 */}
      <Box sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.04)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.75, gap: 1, flexWrap: 'nowrap' }}>
        {/* ビュー切替 */}
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', flexShrink: 0 }}>
          {([
            { id: 'month' as CalView, Icon: CalendarMonthRoundedIcon,    label: '月' },
            { id: 'week'  as CalView, Icon: CalendarViewWeekRoundedIcon, label: '週' },
            { id: 'day'   as CalView, Icon: CalendarViewDayRoundedIcon,  label: '日' },
          ]).map(({ id, Icon, label }) => (
            <Button key={id} size="small" startIcon={<Icon sx={{ fontSize: '14px !important' }}/>}
              onClick={() => setCalView(id)}
              sx={{ textTransform: 'none', fontWeight: calView===id ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                color:   calView===id ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                bgcolor: calView===id ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
              {label}
            </Button>
          ))}
        </Box>
        {/* 日付ナビゲーション */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <IconButton onClick={() => navigateCal(-1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', p: 0, width: 20, height: 20, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'transparent' } }}>
            <ChevronLeftRoundedIcon sx={{ fontSize: 16 }}/>
          </IconButton>
          <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--brand-fg)', minWidth: 130, textAlign: 'center', lineHeight: 1 }}>
            {calLabel}
          </Typography>
          <IconButton onClick={() => navigateCal(1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', p: 0, width: 20, height: 20, '&:hover': { color: 'var(--brand-fg)', bgcolor: 'transparent' } }}>
            <ChevronRightRoundedIcon sx={{ fontSize: 16 }}/>
          </IconButton>
          <Button size="small" onClick={() => setCalDate(new Date())}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.63rem', px: 0.75, py: 0, height: 20, minWidth: 0, borderRadius: 1.5,
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', color: 'rgb(var(--brand-fg-rgb) / 0.7)',
              '&:hover': { border: '1px solid rgb(var(--brand-fg-rgb) / 0.35)', color: 'var(--brand-fg)' } }}>
            今日
          </Button>
        </Box>
        {/* 追加ボタン */}
        {!isAllMode ? (
          <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }}/>}
            onClick={() => openNewSchedule(calDate)}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1.25, py: 0.375, flexShrink: 0,
              bgcolor: 'rgba(67,233,123,0.14)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.3)', borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(67,233,123,0.22)' } }}>
            予定を追加
          </Button>
        ) : <Box sx={{ width: 4 }}/>}
      </Box>

      {/* Calendar body */}
      <Box sx={{ p: { xs: 1, md: 1.25 }, flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {loadingS ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress size={24} sx={{ color: '#00BFFF' }}/>
          </Box>
        ) : calView === 'month' ? (
          <MonthView year={year} month={month} schedules={visibleSchedules}
            onDayClick={openNewSchedule}
            onDayNumberClick={d => { setCalDate(d); setCalView('day'); }}
            onEventClick={openEditSchedule}/>
        ) : calView === 'week' ? (
          <WeekView weekDays={weekDays} schedules={visibleSchedules}
            onSlotClick={openNewSchedule}
            onEventClick={openEditSchedule}/>
        ) : (
          <DayView date={calDate} schedules={visibleSchedules}
            onSlotClick={openNewSchedule}
            onEventClick={openEditSchedule}/>
        )}
      </Box>
    </Paper>
  );

  // ── User task panel ───────────────────────────────────────────────────────
  const userTaskPanel = (
    <Paper sx={{ bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 1.25, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonRoundedIcon sx={{ fontSize: 14, color: 'light-dark(#48327c, #a18cd1)' }}/>
        <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 1, color: 'light-dark(#48327c, #a18cd1)', textTransform: 'uppercase' }}>
          ユーザータスク
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', ml: 0.5 }}>
          自分で実行・確認する項目
        </Typography>
        {pendingN > 0 && (
          <Box sx={{ ml: 'auto', px: 1, py: 0.25, bgcolor: 'rgba(161,140,209,0.12)', border: '1px solid rgba(161,140,209,0.25)', borderRadius: 1.5 }}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'light-dark(#48327c, #a18cd1)' }}>{pendingN} 件未完了</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.06)', borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.04)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.75, gap: 1 }}>
        <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', flexShrink: 0 }}>
          {([
            { key: 'all'         as UserTaskFilter, label: 'すべて' },
            { key: 'todo'        as UserTaskFilter, label: '未着手' },
            { key: 'in_progress' as UserTaskFilter, label: '進行中' },
            { key: 'done'        as UserTaskFilter, label: '完了' },
          ]).map(({ key, label }) => (
            <Button key={key} size="small" onClick={() => setUserTaskFilter(key)}
              sx={{ textTransform: 'none', fontWeight: userTaskFilter===key ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                color:   userTaskFilter===key ? 'light-dark(#48327c, #a18cd1)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                bgcolor: userTaskFilter===key ? 'rgba(161,140,209,0.14)' : 'transparent',
                border:  `1px solid ${userTaskFilter===key ? 'rgba(161,140,209,0.35)' : 'transparent'}`,
                '&:hover': { bgcolor: 'rgba(161,140,209,0.08)', color: 'light-dark(#48327c, #a18cd1)' } }}>
              {label}
            </Button>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
          <Tooltip title="ユーザータスクの実行履歴" placement="top">
            <IconButton size="small"
              onClick={() => setSidePanel(sidePanel?.kind === 'user-history' ? null : { kind: 'user-history' })}
              sx={{ color: sidePanel?.kind === 'user-history' ? 'light-dark(#48327c, #a18cd1)' : 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: sidePanel?.kind === 'user-history' ? 'rgba(161,140,209,0.1)' : 'transparent', borderRadius: 1.5, '&:hover': { color: 'light-dark(#48327c, #a18cd1)', bgcolor: 'rgba(161,140,209,0.1)' } }}>
              <HistoryRoundedIcon sx={{ fontSize: 16 }}/>
            </IconButton>
          </Tooltip>
          <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }}/>}
            onClick={() => setSidePanel({ kind: 'new-task', initialType: 'manual' })}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1.25, py: 0.375,
              bgcolor: 'rgba(161,140,209,0.12)', color: 'light-dark(#48327c, #a18cd1)', border: '1px solid rgba(161,140,209,0.3)', borderRadius: 2, flexShrink: 0,
              '&:hover': { bgcolor: 'rgba(161,140,209,0.2)' } }}>
            ユーザータスクを追加
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loadingT ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} sx={{ color: 'light-dark(#48327c, #a18cd1)' }}/></Box>
        ) : filteredUserTasks.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <PersonRoundedIcon sx={{ fontSize: 36, color: 'rgb(var(--brand-fg-rgb) / 0.12)', mb: 1 }}/>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontWeight: 600 }}>
              {userTaskFilter === 'all' ? 'ユーザータスクがありません' : '該当するタスクはありません'}
            </Typography>
          </Box>
        ) : (
          <TaskListView tasks={filteredUserTasks} onEdit={openEditTask} onDelete={deleteTask} onCycleStatus={cycleStatus} onExecute={executeAiTask} executingIds={executingIds} showProject={isAllMode}/>
        )}
      </Box>
    </Paper>
  );

  // ── AI task panel ─────────────────────────────────────────────────────────
  const aiTaskPanel = (
    <Paper sx={{ bgcolor: 'rgba(0,191,255,0.02)', border: '1px solid rgba(0,191,255,0.12)', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ px: 2, pt: 1.25, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: '#00BFFF' }}/>
        <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 1, color: '#00BFFF', textTransform: 'uppercase' }}>
          AIタスク
        </Typography>
        <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', ml: 0.5 }}>
          AIが自動実行する項目
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
          {aiRunning > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, bgcolor: 'rgba(0,191,255,0.15)', border: '1px solid rgba(0,191,255,0.35)', borderRadius: 1.5 }}>
              <CircularProgress size={8} sx={{ color: '#00BFFF' }}/>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#00BFFF' }}>{aiRunning} 件実行中</Typography>
            </Box>
          )}
          {aiWaiting > 0 && aiRunning === 0 && (
            <Box sx={{ px: 1, py: 0.25, bgcolor: 'rgba(0,191,255,0.08)', border: '1px solid rgba(0,191,255,0.2)', borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(0,191,255,0.8)' }}>{aiWaiting} 件待機</Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ borderBottom: '1px solid rgba(0,191,255,0.08)', borderTop: '1px solid rgba(0,191,255,0.05)', bgcolor: 'rgba(0,191,255,0.02)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1, pb: 0.625, gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', flexShrink: 0 }}>
            {([
              { key: 'all'         as AITaskFilter, label: 'すべて' },
              { key: 'todo'        as AITaskFilter, label: '未着手' },
              { key: 'in_progress' as AITaskFilter, label: '進行中' },
              { key: 'done'        as AITaskFilter, label: '完了' },
            ]).map(({ key, label }) => (
              <Button key={key} size="small" onClick={() => setAiTaskFilter(key)}
                sx={{ textTransform: 'none', fontWeight: aiTaskFilter===key ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   aiTaskFilter===key ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: aiTaskFilter===key ? 'rgba(0,191,255,0.14)' : 'transparent',
                  border:  `1px solid ${aiTaskFilter===key ? 'rgba(0,191,255,0.35)' : 'transparent'}`,
                  '&:hover': { bgcolor: 'rgba(0,191,255,0.08)', color: '#00BFFF' } }}>
                {label}
              </Button>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <Tooltip title="AIタスクの実行履歴" placement="top">
              <IconButton size="small"
                onClick={() => setSidePanel(sidePanel?.kind === 'ai-history' ? null : { kind: 'ai-history' })}
                sx={{ color: sidePanel?.kind === 'ai-history' ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.4)', bgcolor: sidePanel?.kind === 'ai-history' ? 'rgba(0,191,255,0.1)' : 'transparent', borderRadius: 1.5, '&:hover': { color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)' } }}>
                <HistoryRoundedIcon sx={{ fontSize: 16 }}/>
              </IconButton>
            </Tooltip>
            <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }}/>}
              onClick={() => setSidePanel({ kind: 'new-task', initialType: 'ai' })}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1.25, py: 0.375,
                bgcolor: 'rgba(0,191,255,0.12)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 2, flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(0,191,255,0.2)' } }}>
              AIタスクを追加
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {loadingT ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={24} sx={{ color: '#00BFFF' }}/></Box>
        ) : filteredAiTasks.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <AutoAwesomeRoundedIcon sx={{ fontSize: 36, color: 'rgba(0,191,255,0.15)', mb: 1 }}/>
            <Typography variant="body2" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.35)', fontWeight: 600 }}>
              {aiTaskFilter === 'all' ? 'AIタスクがありません' : '該当するAIタスクはありません'}
            </Typography>
          </Box>
        ) : (
          <TaskListView tasks={filteredAiTasks} onEdit={openEditTask} onDelete={deleteTask}
            onCycleStatus={cycleStatus} onExecute={executeAiTask} executingIds={executingIds} showProject={isAllMode}/>
        )}
      </Box>
    </Paper>
  );

  // ── Task area composition ─────────────────────────────────────────────────
  // stacked レイアウト時は両パネルを左右に並べる
  const taskPanelHoriz = layoutMode === 'stacked' && taskPanelMode === 'both';
  const taskAreaContent = (
    <Box ref={taskAreaRef} sx={{
      display: 'flex',
      flexDirection: taskPanelHoriz ? 'row' : 'column',
      flex: 1, minHeight: 0,
      userSelect: isDraggingTP ? 'none' : 'auto',
    }}>
      {taskPanelMode !== 'ai' && (
        <Box sx={{
          flex: taskPanelMode === 'both' ? `0 0 ${taskPanelHeight}%` : '1 1 auto',
          minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column',
        }}>
          {userTaskPanel}
        </Box>
      )}
      {taskPanelMode === 'both' && (
        taskPanelHoriz
          ? <SplitResizeHandle onMouseDown={handleTaskPanelDividerMouseDown} isDragging={isDraggingTP}/>
          : <StackedResizeHandle onMouseDown={handleTaskPanelDividerMouseDown} isDragging={isDraggingTP}/>
      )}
      {taskPanelMode !== 'user' && (
        <Box sx={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {aiTaskPanel}
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
    <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 2, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, boxSizing: 'border-box', minHeight: 0, overflow: 'hidden' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1.5, flexWrap: 'wrap', flexShrink: 0, minHeight: 36 }}>

        {/* Left: context label + project filter (account) / project badge (project) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          {isAllMode ? (
            /* ── Account mode: site label + project filter chips ── */
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#a18cd1', flexShrink: 0 }}/>
                <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'uppercase' }}>
                  アカウントサイト
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)', mx: 0.5 }}>／</Typography>
                <Typography sx={{ fontSize: '0.67rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
                  プロジェクト:
                </Typography>
              </Box>
              {/* Filter chips */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  label="すべて"
                  size="small"
                  onClick={() => setProjectFilter(null)}
                  sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                    bgcolor: projectFilter === null ? 'rgba(161,140,209,0.18)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                    color:   projectFilter === null ? 'light-dark(#48327c, #a18cd1)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                    border:  `1px solid ${projectFilter === null ? 'rgba(161,140,209,0.4)' : 'transparent'}`,
                    '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' } }}
                />
                {allProjects.map(p => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    size="small"
                    onClick={() => setProjectFilter(p.id)}
                    sx={{ height: 22, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', maxWidth: 120,
                      bgcolor: projectFilter === p.id ? 'rgba(161,140,209,0.18)' : 'rgb(var(--brand-fg-rgb) / 0.05)',
                      color:   projectFilter === p.id ? 'light-dark(#48327c, #a18cd1)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                      border:  `1px solid ${projectFilter === p.id ? 'rgba(161,140,209,0.4)' : 'transparent'}`,
                      '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' } }}
                  />
                ))}
              </Box>
            </>
          ) : (
            /* ── Project mode: project name badge ── */
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#00BFFF', flexShrink: 0 }}/>
              <Typography sx={{ fontSize: '0.67rem', fontWeight: 800, letterSpacing: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                プロジェクト
              </Typography>
              <Box sx={{ px: 1.25, py: 0.25, bgcolor: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.25)', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#00BFFF', whiteSpace: 'nowrap' }}>
                  {project?.name ?? ''}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Alert pills (inline, after context) */}
          {overdueN > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5,
              bgcolor: 'rgba(250,112,154,0.08)', border: '1px solid rgba(250,112,154,0.2)', borderRadius: 2, flexShrink: 0 }}>
              <AccessAlarmsRoundedIcon sx={{ fontSize: 13, color: 'light-dark(#a80637, #fa709a)' }}/>
              <Typography sx={{ fontSize: '0.7rem', color: 'light-dark(#a80637, #fa709a)', fontWeight: 700 }}>期限超過 {overdueN} 件</Typography>
            </Box>
          )}
          {aiWaiting > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5,
              bgcolor: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.18)', borderRadius: 2, flexShrink: 0 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 13, color: '#00BFFF' }}/>
              <Typography sx={{ fontSize: '0.7rem', color: '#00BFFF', fontWeight: 700 }}>AI {aiWaiting} 件待機</Typography>
            </Box>
          )}
        </Box>

        {/* Right: task panel mode + layout toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          {/* タスクパネル表示モード */}
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.09)' }}>
            <Tooltip title="ユーザー＋AIの両方を表示">
              <Button size="small" startIcon={<TableRowsRoundedIcon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setTaskPanelMode('both')}
                sx={{ textTransform: 'none', fontWeight: taskPanelMode==='both' ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   taskPanelMode==='both' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: taskPanelMode==='both' ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
                両方
              </Button>
            </Tooltip>
            <Tooltip title="ユーザータスクのみ表示">
              <Button size="small" startIcon={<PersonRoundedIcon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setTaskPanelMode('user')}
                sx={{ textTransform: 'none', fontWeight: taskPanelMode==='user' ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   taskPanelMode==='user' ? 'light-dark(#48327c, #a18cd1)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: taskPanelMode==='user' ? 'rgba(161,140,209,0.14)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(161,140,209,0.1)', color: 'light-dark(#48327c, #a18cd1)' } }}>
                ユーザー
              </Button>
            </Tooltip>
            <Tooltip title="AIタスクのみ表示">
              <Button size="small" startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setTaskPanelMode('ai')}
                sx={{ textTransform: 'none', fontWeight: taskPanelMode==='ai' ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   taskPanelMode==='ai' ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: taskPanelMode==='ai' ? 'rgba(0,191,255,0.14)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(0,191,255,0.08)', color: '#00BFFF' } }}>
                AI
              </Button>
            </Tooltip>
          </Box>

          {/* レイアウト切替 */}
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'light-dark(rgba(15,23,42,0.12), rgba(0,0,0,0.35))', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.09)' }}>
            <Tooltip title="左右分割（カレンダー ｜ タスク）">
              <Button size="small" startIcon={<ViewColumnRoundedIcon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setLayoutMode('split')}
                sx={{ textTransform: 'none', fontWeight: layoutMode==='split' ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   layoutMode==='split' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: layoutMode==='split' ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
                分割
              </Button>
            </Tooltip>
            <Tooltip title="上下積み重ね">
              <Button size="small" startIcon={<TableRowsRoundedIcon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setLayoutMode('stacked')}
                sx={{ textTransform: 'none', fontWeight: layoutMode==='stacked' ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   layoutMode==='stacked' ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.45)',
                  bgcolor: layoutMode==='stacked' ? 'rgb(var(--brand-fg-rgb) / 0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'var(--brand-fg)' } }}>
                上下
              </Button>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      {layoutMode === 'split' ? (
        <Box ref={splitContainerRef} sx={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'stretch', userSelect: isDraggingDiv ? 'none' : 'auto' }}>
          <Box sx={{ flex: `0 0 ${calWidth}%`, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{calendarPanel}</Box>
          <SplitResizeHandle onMouseDown={handleDividerMouseDown} isDragging={isDraggingDiv}/>
          <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>{taskAreaContent}</Box>
        </Box>
      ) : (
        <Box ref={stackedContainerRef} sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, userSelect: isDraggingRow ? 'none' : 'auto' }}>
          <Box sx={{ flex: `0 0 ${calHeight}%`, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{calendarPanel}</Box>
          <StackedResizeHandle onMouseDown={handleRowDividerMouseDown} isDragging={isDraggingRow}/>
          <Box sx={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }}>{taskAreaContent}</Box>
        </Box>
      )}

    </Box>

      {/* ── Side panels ──────────────────────────────────────────────────────── */}
      {sidePanel !== null && (sidePanel.kind === 'schedule' || sidePanel.kind === 'new-schedule') && (
        <ScheduleSidePanel
          initial={sidePanel.kind === 'schedule' ? sidePanel.item : null}
          defaultDate={sidePanel.kind === 'new-schedule' ? sidePanel.date : undefined}
          defaultTime={sidePanel.kind === 'new-schedule' ? sidePanel.time : undefined}
          onClose={() => setSidePanel(null)}
          onSave={saveSch}
          onDelete={sidePanel.kind === 'schedule' ? () => deleteSch(sidePanel.item) : undefined}
        />
      )}
      {(sidePanel?.kind === 'task' || sidePanel?.kind === 'new-task') && (
        <TaskSidePanel
          initial={sidePanel.kind === 'task' ? sidePanel.item : null}
          onClose={() => setSidePanel(null)}
          onSave={saveTask}
          onDelete={sidePanel.kind === 'task' ? () => deleteTask(sidePanel.item) : undefined}
          initialType={sidePanel.kind === 'new-task' ? sidePanel.initialType : undefined}
          projectOptions={sidePanel.kind === 'new-task' && isAllMode
            ? allProjects.map(p => ({ id: p.id, name: p.name }))
            : undefined}
        />
      )}
      {sidePanel?.kind === 'ai-history' && uid !== 'unknown' && (
        <AiHistoryPanel
          uid={uid}
          projectOptions={isAllMode ? allProjects.map(p => ({ id: p.id, name: p.name })) : undefined}
          defaultProjectId={projectId ?? undefined}
          onClose={() => setSidePanel(null)}
          onRunNow={handleHistoryRunNow}
          onAddTask={handleHistoryAddTask}
        />
      )}
      {sidePanel?.kind === 'user-history' && uid !== 'unknown' && (
        <UserHistoryPanel
          uid={uid}
          projectOptions={isAllMode ? allProjects.map(p => ({ id: p.id, name: p.name })) : undefined}
          defaultProjectId={projectId ?? undefined}
          onClose={() => setSidePanel(null)}
          onAddTask={handleUserHistoryAddTask}
        />
      )}

      {/* ── 削除確認ダイアログ ──────────────────────────────────────────────── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)', minWidth: 320 } }}
      >
        <DialogContent sx={{ px: 3, pt: 3, pb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'rgba(250,112,154,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.25 }}>
              <DeleteRoundedIcon sx={{ fontSize: 18, color: 'light-dark(#a80637, #fa709a)' }}/>
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--brand-fg)', mb: 0.75 }}>
                {deleteTarget?.kind === 'task' ? 'タスクを削除しますか？' : '予定を削除しますか？'}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.65 }}>
                「{deleteTarget?.kind === 'task'
                  ? deleteTarget.item.title
                  : deleteTarget?.kind === 'schedule'
                    ? deleteTarget.item.title
                    : ''}」を削除します。<br/>この操作は取り消せません。
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => setDeleteTarget(null)}
              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', px: 2, borderRadius: 2,
                '&:hover': { color: 'var(--brand-fg)', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
              キャンセル
            </Button>
            <Button variant="contained" onClick={async () => {
              if (!deleteTarget) return;
              if (deleteTarget.kind === 'task') await confirmDeleteTask(deleteTarget.item);
              else await confirmDeleteSch(deleteTarget.item);
              setDeleteTarget(null);
            }}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', px: 2.5, borderRadius: 2,
                bgcolor: '#fa709a', color: 'var(--brand-fg)', boxShadow: 'none', '&:hover': { bgcolor: '#f04e7a', boxShadow: 'none' } }}>
              削除する
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};
