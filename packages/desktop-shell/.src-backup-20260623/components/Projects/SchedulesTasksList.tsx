import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Chip, IconButton, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Select,
  MenuItem, FormControl, InputLabel, Tooltip, CircularProgress,
} from '@mui/material';
import AddRoundedIcon              from '@mui/icons-material/AddRounded';
import EditRoundedIcon              from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon            from '@mui/icons-material/DeleteRounded';
import CheckCircleRoundedIcon       from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import ChevronLeftRoundedIcon       from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon      from '@mui/icons-material/ChevronRightRounded';
import AutoAwesomeRoundedIcon       from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon            from '@mui/icons-material/PersonRounded';
import FactCheckRoundedIcon         from '@mui/icons-material/FactCheckRounded';
import AccessAlarmsRoundedIcon      from '@mui/icons-material/AccessAlarmsRounded';
import ViewListRoundedIcon          from '@mui/icons-material/ViewListRounded';
import ViewKanbanRoundedIcon        from '@mui/icons-material/ViewKanbanRounded';
import CalendarMonthRoundedIcon     from '@mui/icons-material/CalendarMonthRounded';
import CalendarViewWeekRoundedIcon  from '@mui/icons-material/CalendarViewWeekRounded';
import CalendarViewDayRoundedIcon   from '@mui/icons-material/CalendarViewDayRounded';
import CloseRoundedIcon             from '@mui/icons-material/CloseRounded';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query,
} from 'firebase/firestore';
import { db } from '../../lib/firebase/client';
import { useAuthStore } from '../../store/useAuthStore';
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

interface ScheduleItem {
  id: string;
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
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  createdBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS  = ['月','火','水','木','金','土','日'];
const MONTH_NAMES = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const HOUR_HEIGHT = 44;
const CAL_START   = 8;
const CAL_END     = 20;
const TIME_SLOTS  = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);

const SCHEDULE_TYPES: Record<ScheduleType, { label: string; color: string; bg: string }> = {
  meeting:    { label: '会議',     color: '#43e97b', bg: 'rgba(67,233,123,0.22)'  },
  deadline:   { label: '締め切り', color: '#fa709a', bg: 'rgba(250,112,154,0.22)' },
  submission: { label: '提出',     color: '#f6d365', bg: 'rgba(246,211,101,0.22)' },
  other:      { label: 'その他',   color: '#a0aab4', bg: 'rgba(160,170,180,0.15)' },
};

const TASK_TYPES: Record<TaskType, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  ai:     { label: 'AI タスク', color: '#00BFFF', bg: 'rgba(0,191,255,0.14)',   Icon: AutoAwesomeRoundedIcon },
  manual: { label: '自分で実行', color: '#a18cd1', bg: 'rgba(161,140,209,0.14)', Icon: PersonRoundedIcon },
  review: { label: '確認事項',  color: '#f6d365', bg: 'rgba(246,211,101,0.14)', Icon: FactCheckRoundedIcon },
};

const PRIORITY_CFG: Record<TaskPriority, { label: string; color: string }> = {
  high:   { label: '高', color: '#fa709a' },
  medium: { label: '中', color: '#f6d365' },
  low:    { label: '低', color: '#a0aab4' },
};

const STATUS_CFG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: '未着手', color: 'rgba(255,255,255,0.5)' },
  in_progress: { label: '進行中', color: '#00BFFF' },
  done:        { label: '完了',   color: '#43e97b' },
};

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const KANBAN_COLS: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo',        label: 'TO DO', color: 'rgba(255,255,255,0.5)' },
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

const dlgPaper  = { bgcolor: '#131920', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 3, color: '#fff' };
const fldSx     = { '& label.Mui-focused': { color: '#00BFFF' }, '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } };
const lblSx     = { color: 'rgba(255,255,255,0.5)', '&.Mui-focused': { color: '#00BFFF' } };
const inpProp   = { sx: { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } };
const selSx     = { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.5)' } };
const menuPpr   = { bgcolor: '#1a2030', color: '#fff' };

// ─── Month View ───────────────────────────────────────────────────────────────

interface MonthViewProps {
  year: number; month: number; schedules: ScheduleItem[];
  onDayClick: (d: Date) => void; onEventClick: (ev: ScheduleItem) => void;
}

const MonthView: React.FC<MonthViewProps> = ({ year, month, schedules, onDayClick, onEventClick }) => {
  const grid  = useMemo(() => getMonthGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const m: Record<string, ScheduleItem[]> = {};
    schedules.forEach(s => { if (s.dueDate) { (m[s.dueDate] = m[s.dueDate] || []).push(s); } });
    return m;
  }, [schedules]);

  return (
    <Box>
      {/* Day-of-week header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '8px 8px 0 0', border: '1px solid rgba(255,255,255,0.07)', borderBottom: 'none' }}>
        {DAY_LABELS.map((d, i) => (
          <Box key={d} sx={{ textAlign: 'center', py: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.5,
              color: i===5 ? '#4fc3f7' : i===6 ? '#f48fb1' : 'rgba(255,255,255,0.4)' }}>
              {d}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Day cells */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', border: '1px solid rgba(255,255,255,0.07)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
        {grid.map((date, idx) => {
          const ds      = toDateStr(date);
          const inMonth = date.getMonth() === month;
          const today   = isToday(date);
          const evs     = byDay[ds] || [];
          const dow     = idx % 7;
          return (
            <Box key={ds} onClick={() => onDayClick(date)}
              sx={{ minHeight: 80, p: 0.5, cursor: 'pointer', position: 'relative',
                borderBottom: idx < 35 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderRight:  dow < 6  ? '1px solid rgba(255,255,255,0.06)' : 'none',
                bgcolor: today ? 'rgba(0,191,255,0.04)' : 'transparent',
                opacity: inMonth ? 1 : 0.3,
                transition: 'background 0.15s',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.25 }}>
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: today ? '#00BFFF' : 'transparent' }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: today ? 800 : inMonth ? 500 : 400, lineHeight: 1,
                    color: today ? '#000' : dow===5 ? '#4fc3f7' : dow===6 ? '#f48fb1' : inMonth ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)' }}>
                    {date.getDate()}
                  </Typography>
                </Box>
              </Box>
              {evs.slice(0,2).map(ev => {
                const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                return (
                  <Box key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                    sx={{ mb: '2px', px: '4px', py: '1px', bgcolor: t.bg, borderRadius: 0.5,
                      borderLeft: `2px solid ${t.color}`, cursor: 'pointer', opacity: ev.status==='done' ? 0.45 : 1,
                      '&:hover': { opacity: 0.75 } }}>
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: t.color, display: 'block',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: ev.status==='done' ? 'line-through' : 'none' }}>
                      {ev.startTime && <span style={{ opacity: 0.7 }}>{ev.startTime} </span>}{ev.title}
                    </Typography>
                  </Box>
                );
              })}
              {evs.length > 2 && (
                <Typography sx={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)', pl: '4px' }}>
                  +{evs.length-2} more
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

// ─── Week View ────────────────────────────────────────────────────────────────

interface WeekViewProps {
  weekDays: Date[]; schedules: ScheduleItem[];
  onSlotClick: (d: Date, time: string) => void; onEventClick: (ev: ScheduleItem) => void;
}

const WeekView: React.FC<WeekViewProps> = ({ weekDays, schedules, onSlotClick, onEventClick }) => {
  const byDay = useMemo(() => {
    const m: Record<string, ScheduleItem[]> = {};
    schedules.forEach(s => { if (s.dueDate) { (m[s.dueDate] = m[s.dueDate] || []).push(s); } });
    return m;
  }, [schedules]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {/* Headers */}
      <Box sx={{ display: 'flex', ml: '48px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {weekDays.map((d, i) => {
          const today = isToday(d);
          return (
            <Box key={i} sx={{ flex: 1, textAlign: 'center', py: 0.75, bgcolor: today ? 'rgba(0,191,255,0.04)' : 'transparent' }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: i===5 ? '#4fc3f7' : i===6 ? '#f48fb1' : 'rgba(255,255,255,0.5)', display: 'block' }}>
                {DAY_LABELS[i]}
              </Typography>
              <Box sx={{ display: 'inline-flex', width: 24, height: 24, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                bgcolor: today ? '#00BFFF' : 'transparent' }}>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: today ? 800 : 600,
                  color: today ? '#000' : i===5 ? '#4fc3f7' : i===6 ? '#f48fb1' : 'rgba(255,255,255,0.85)' }}>
                  {d.getDate()}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* All-day row */}
      {weekDays.some(d => (byDay[toDateStr(d)]||[]).some(e => !e.startTime)) && (
        <Box sx={{ display: 'flex', ml: '48px', borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.01)' }}>
          {weekDays.map((d, i) => {
            const evs = (byDay[toDateStr(d)]||[]).filter(e => !e.startTime);
            return (
              <Box key={i} sx={{ flex: 1, px: '2px', py: '3px', minHeight: 22 }}>
                {evs.map(ev => {
                  const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                  return (
                    <Box key={ev.id} onClick={() => onEventClick(ev)}
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
      )}

      {/* Time grid */}
      <Box sx={{ display: 'flex', overflowY: 'auto', maxHeight: 300 }}>
        {/* Time labels */}
        <Box sx={{ width: 48, flexShrink: 0 }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', pt: '3px', pr: 1 }}>
              <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, width: '100%', textAlign: 'right' }}>
                {String(h).padStart(2,'0')}:00
              </Typography>
            </Box>
          ))}
        </Box>
        {/* Columns */}
        <Box sx={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          {weekDays.map((d, di) => {
            const ds   = toDateStr(d);
            const evs  = (byDay[ds]||[]).filter(e => e.startTime);
            const today = isToday(d);
            return (
              <Box key={di} sx={{ position: 'relative', borderRight: '1px solid rgba(255,255,255,0.05)', bgcolor: today ? 'rgba(0,191,255,0.02)' : 'transparent' }}>
                {TIME_SLOTS.map(h => (
                  <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.025)' } }}
                    onClick={() => onSlotClick(d, `${String(h).padStart(2,'0')}:00`)} />
                ))}
                {evs.map(ev => {
                  const t   = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
                  const top = timeToY(ev.startTime!);
                  const ht  = Math.max(timeDiffH(ev.startTime!, ev.endTime) * HOUR_HEIGHT - 2, 18);
                  if (top < 0 || top > (CAL_END - CAL_START) * HOUR_HEIGHT) return null;
                  return (
                    <Box key={ev.id} onClick={e => { e.stopPropagation(); onEventClick(ev); }}
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
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Day View ─────────────────────────────────────────────────────────────────

interface DayViewProps {
  date: Date; schedules: ScheduleItem[];
  onSlotClick: (d: Date, time: string) => void; onEventClick: (ev: ScheduleItem) => void;
}

const DayView: React.FC<DayViewProps> = ({ date, schedules, onSlotClick, onEventClick }) => {
  const ds     = toDateStr(date);
  const dayEvs = schedules.filter(s => s.dueDate === ds);
  const timed  = dayEvs.filter(e => e.startTime).sort((a,b) => a.startTime!.localeCompare(b.startTime!));
  const allDay = dayEvs.filter(e => !e.startTime);

  return (
    <Box>
      {allDay.length > 0 && (
        <Box sx={{ mx: 1, mb: 1, p: 1, bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
          <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 700, mb: '4px', letterSpacing: 0.5 }}>終日</Typography>
          {allDay.map(ev => {
            const t = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
            return (
              <Box key={ev.id} onClick={() => onEventClick(ev)}
                sx={{ py: '5px', px: 1.5, mb: '3px', bgcolor: t.bg, borderRadius: 1.5, borderLeft: `3px solid ${t.color}`, cursor: 'pointer' }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: t.color, fontSize: '0.82rem' }}>{ev.title}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', overflowY: 'auto', maxHeight: 340 }}>
        <Box sx={{ width: 52, flexShrink: 0 }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', pt: '3px', pr: 1.5 }}>
              <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, width: '100%', textAlign: 'right' }}>
                {String(h).padStart(2,'0')}:00
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ flex: 1, position: 'relative', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
          {TIME_SLOTS.map(h => (
            <Box key={h} sx={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}
              onClick={() => onSlotClick(date, `${String(h).padStart(2,'0')}:00`)} />
          ))}
          {timed.map(ev => {
            const t   = SCHEDULE_TYPES[ev.type] ?? SCHEDULE_TYPES.other;
            const top = timeToY(ev.startTime!);
            const ht  = Math.max(timeDiffH(ev.startTime!, ev.endTime) * HOUR_HEIGHT - 2, 24);
            return (
              <Box key={ev.id} onClick={() => onEventClick(ev)}
                sx={{ position: 'absolute', top: top+1, left: 6, right: 6, height: ht, bgcolor: t.bg,
                  borderLeft: `3px solid ${t.color}`, borderRadius: 2, px: 1.5, py: 0.75, cursor: 'pointer',
                  overflow: 'hidden', zIndex: 1, opacity: ev.status==='done' ? 0.45 : 1, '&:hover': { filter: 'brightness(1.2)' } }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: t.color, fontSize: '0.82rem', mb: '2px' }}>{ev.title}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
                  {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

// ─── Task List View ───────────────────────────────────────────────────────────

interface TaskListViewProps {
  tasks: TaskItem[];
  onEdit: (t: TaskItem) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (t: TaskItem) => void;
}

const TaskListView: React.FC<TaskListViewProps> = ({ tasks, onEdit, onDelete, onCycleStatus }) => (
  <Box>
    {tasks.map(task => {
      const tp   = TASK_TYPES[task.type]   ?? TASK_TYPES.manual;
      const pri  = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.medium;
      const ov   = isOverdue(task.dueDate) && task.status !== 'done';
      const done = task.status === 'done';
      return (
        <Box key={task.id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 0.875,
            borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: done ? 0.5 : 1,
            transition: 'background 0.15s', cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', '& .row-act': { opacity: 1 } },
          }}>
          <IconButton size="small" onClick={e => { e.stopPropagation(); onCycleStatus(task); }}
            sx={{ p: '2px', color: done ? '#43e97b' : 'rgba(255,255,255,0.25)', '&:hover': { color: '#43e97b' } }}>
            {done
              ? <CheckCircleRoundedIcon sx={{ fontSize: 18 }}/>
              : <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 18 }}/>}
          </IconButton>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: pri.color, flexShrink: 0 }}/>
          <Typography variant="body2" onClick={() => onEdit(task)}
            sx={{ flex: 1, fontWeight: 600, fontSize: '0.83rem',
              color: done ? 'rgba(255,255,255,0.35)' : '#fff',
              textDecoration: done ? 'line-through' : 'none' }}>
            {task.title}
          </Typography>
          <Chip label={tp.label} size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, color: tp.color, bgcolor: tp.bg, flexShrink: 0 }}/>
          {task.dueDate && (
            <Typography sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0,
              color: ov ? '#fa709a' : 'rgba(255,255,255,0.4)', fontWeight: ov ? 700 : 500 }}>
              {formatShort(task.dueDate)}
            </Typography>
          )}
          <Chip label={STATUS_CFG[task.status]?.label ?? '未着手'} size="small"
            onClick={e => { e.stopPropagation(); onCycleStatus(task); }}
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              color: STATUS_CFG[task.status]?.color ?? 'rgba(255,255,255,0.5)',
              bgcolor: 'rgba(255,255,255,0.06)', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } }}/>
          <Box className="row-act" sx={{ opacity: 0, display: 'flex', gap: '2px', transition: 'opacity 0.15s', flexShrink: 0 }}>
            <Tooltip title="編集">
              <IconButton size="small" onClick={() => onEdit(task)}
                sx={{ p: '3px', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#00BFFF' } }}>
                <EditRoundedIcon sx={{ fontSize: 13 }}/>
              </IconButton>
            </Tooltip>
            <Tooltip title="削除">
              <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                sx={{ p: '3px', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fa709a' } }}>
                <DeleteRoundedIcon sx={{ fontSize: 13 }}/>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      );
    })}
  </Box>
);

// ─── Kanban View ──────────────────────────────────────────────────────────────

interface KanbanViewProps {
  tasks: TaskItem[];
  onEdit: (t: TaskItem) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (t: TaskItem) => void;
  onInlineSave: (title: string, type: TaskType, status: TaskStatus) => void;
}

const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onEdit, onDelete, onInlineSave }) => {
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
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                  {colTasks.length}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.875, minHeight: 60 }}>
              {colTasks.map(task => {
                const tp  = TASK_TYPES[task.type]   ?? TASK_TYPES.manual;
                const pri = PRIORITY_CFG[task.priority] ?? PRIORITY_CFG.medium;
                const ov  = isOverdue(task.dueDate) && task.status !== 'done';
                return (
                  <Paper key={task.id} onClick={() => onEdit(task)}
                    sx={{ p: 1.25, cursor: 'pointer',
                      bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 2, transition: 'all 0.15s',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', transform: 'translateY(-1px)', '& .kact': { opacity: 1 } },
                    }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.625 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, flex: 1, minWidth: 0 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: pri.color, flexShrink: 0, mt: '4px' }}/>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem', lineHeight: 1.3 }}>
                          {task.title}
                        </Typography>
                      </Box>
                      <Box className="kact" sx={{ opacity: 0, transition: 'opacity 0.15s', flexShrink: 0, ml: 0.5 }}>
                        <IconButton size="small"
                          onClick={e => { e.stopPropagation(); onDelete(task.id); }}
                          sx={{ p: '2px', color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fa709a' } }}>
                          <DeleteRoundedIcon sx={{ fontSize: 12 }}/>
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip label={tp.label} size="small"
                        sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700, color: tp.color, bgcolor: tp.bg }}/>
                      {task.dueDate && (
                        <Typography sx={{ fontSize: '0.62rem', ml: 'auto',
                          color: ov ? '#fa709a' : 'rgba(255,255,255,0.4)', fontWeight: ov ? 700 : 500 }}>
                          {formatShort(task.dueDate)}
                        </Typography>
                      )}
                    </Box>
                    {task.type === 'ai' && task.status !== 'done' && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                        <AutoAwesomeRoundedIcon sx={{ fontSize: 10, color: '#00BFFF' }}/>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(0,191,255,0.7)', fontWeight: 600 }}>
                          AI自動実行予定
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                );
              })}

              {/* Inline add card */}
              {inlineCol === col.id ? (
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(0,191,255,0.25)', borderRadius: 2, p: 1.125 }}>
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
                    InputProps={{ sx: { color: '#fff', fontSize: '0.8rem', fontWeight: 600, '& fieldset': { borderColor: 'transparent' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.15)' }, '&.Mui-focused fieldset': { borderColor: '#00BFFF' } } }}
                  />
                  <FormControl size="small" variant="outlined" sx={{ mt: 0.75, minWidth: 100 }}>
                    <Select value={inlineType} onChange={e => setInlineType(e.target.value as TaskType)}
                      sx={{ height: 22, fontSize: '0.63rem', fontWeight: 700, color: TASK_TYPES[inlineType].color, bgcolor: TASK_TYPES[inlineType].bg, borderRadius: 1, '& fieldset': { borderColor: 'transparent' }, '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)', fontSize: 14 } }}
                      MenuProps={{ PaperProps: { sx: menuPpr } }}>
                      {(Object.entries(TASK_TYPES) as [TaskType, typeof TASK_TYPES[TaskType]][]).map(([k, v]) => (
                        <MenuItem key={k} value={k} sx={{ fontSize: '0.72rem', color: v.color, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, justifyContent: 'flex-end' }}>
                    <Button size="small" onClick={cancelInline}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', py: 0.25, px: 0.75, '&:hover': { color: '#fff' } }}>
                      キャンセル
                    </Button>
                    <Button size="small" onClick={() => commitInline(col.id)} disabled={!inlineTitle.trim()}
                      sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.68rem', bgcolor: 'rgba(0,191,255,0.15)', color: '#00BFFF', py: 0.25, px: 0.75, borderRadius: 1,
                        '&:hover': { bgcolor: 'rgba(0,191,255,0.25)' }, '&:disabled': { color: 'rgba(255,255,255,0.2)', bgcolor: 'transparent' } }}>
                      追加
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: 13 }}/>}
                  onClick={() => { setInlineCol(col.id); setInlineTitle(''); setInlineType('manual'); }}
                  sx={{ justifyContent: 'flex-start', color: 'rgba(255,255,255,0.35)', textTransform: 'none',
                    fontWeight: 600, fontSize: '0.75rem', py: 0.625,
                    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
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
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      bgcolor: 'rgba(0,191,255,0.04)', borderLeft: '3px solid rgba(0,191,255,0.4)' }}>
      {/* Unchecked circle */}
      <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.25)', flexShrink: 0 }}/>
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
          '& input': { color: '#fff', fontSize: '0.83rem', fontWeight: 600, py: 0 },
          '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.1)' },
          '& .MuiInput-underline:after':  { borderBottomColor: '#00BFFF' },
        }}
      />
      {/* Type selector */}
      <FormControl size="small" variant="standard" sx={{ flexShrink: 0, minWidth: 88 }}>
        <Select value={type} onChange={e => setType(e.target.value as TaskType)} disableUnderline
          sx={{ fontSize: '0.68rem', fontWeight: 700, color: TASK_TYPES[type].color,
            bgcolor: TASK_TYPES[type].bg, borderRadius: 1, px: 0.75, py: '2px',
            '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)', fontSize: 14 } }}
          MenuProps={{ PaperProps: { sx: menuPpr } }}>
          {(Object.entries(TASK_TYPES) as [TaskType, typeof TASK_TYPES[TaskType]][]).map(([k, v]) => (
            <MenuItem key={k} value={k} sx={{ fontSize: '0.72rem', color: v.color, '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {/* Close */}
      <IconButton size="small" onClick={onCancel}
        sx={{ p: '2px', color: 'rgba(255,255,255,0.25)', '&:hover': { color: '#fa709a' }, flexShrink: 0 }}>
        <CloseRoundedIcon sx={{ fontSize: 15 }}/>
      </IconButton>
    </Box>
  );
};

// ─── Schedule Dialog ──────────────────────────────────────────────────────────

type ScheduleFormData = Omit<ScheduleItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

const BLANK_SCH: ScheduleFormData = { title: '', description: '', dueDate: '', startTime: '', endTime: '', type: 'meeting', status: 'upcoming' };

interface ScheduleDialogProps {
  open: boolean; initial?: ScheduleItem | null;
  onClose: () => void; onSave: (f: ScheduleFormData) => void;
}

const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ open, initial, onClose, onSave }) => {
  const [f, setF] = useState<ScheduleFormData>(BLANK_SCH);
  useEffect(() => { if (open) { const { id: _id, createdBy: _cb, createdAt: _ca, updatedAt: _ua, ...rest } = (initial ?? {}) as any; setF({ ...BLANK_SCH, ...rest }); } }, [open, initial]);
  const set = (k: keyof ScheduleFormData) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setF(p => ({ ...p, [k]: (e.target as any).value }));
  const valid = f.title.trim() && f.dueDate;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dlgPaper }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>
        {initial ? '予定を編集' : '予定を追加'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
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
              <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="詳細・メモ" value={f.description ?? ''} onChange={set('description')} fullWidth size="small" multiline minRows={2}
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={() => onSave(f)} disabled={!valid} variant="contained"
          sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2,
            '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
          {initial ? '保存' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Task Dialog ──────────────────────────────────────────────────────────────

type TaskFormData = Omit<TaskItem, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>;

const BLANK_TASK: TaskFormData = { title: '', description: '', type: 'manual', priority: 'medium', status: 'todo', dueDate: '' };

interface TaskDialogProps {
  open: boolean; initial?: TaskItem | null;
  onClose: () => void; onSave: (f: TaskFormData) => void;
}

const TaskDialog: React.FC<TaskDialogProps> = ({ open, initial, onClose, onSave }) => {
  const [f, setF] = useState<TaskFormData>(BLANK_TASK);
  useEffect(() => { if (open) { const { id: _id, createdBy: _cb, createdAt: _ca, updatedAt: _ua, ...rest } = (initial ?? {}) as any; setF({ ...BLANK_TASK, ...rest }); } }, [open, initial]);
  const set = (k: keyof TaskFormData) => (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) =>
    setF(p => ({ ...p, [k]: (e.target as any).value }));
  const valid = f.title.trim();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: dlgPaper }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>
        {initial ? 'タスクを編集' : 'タスクを追加'}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
        <TextField label="タイトル *" value={f.title} onChange={set('title')} fullWidth size="small" autoFocus
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <FormControl size="small" fullWidth>
            <InputLabel sx={lblSx}>種別</InputLabel>
            <Select value={f.type} onChange={set('type') as any} label="種別" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
              {(Object.entries(TASK_TYPES) as [TaskType, typeof TASK_TYPES[TaskType]][]).map(([k, v]) => (
                <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel sx={lblSx}>優先度</InputLabel>
            <Select value={f.priority} onChange={set('priority') as any} label="優先度" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
              {(Object.entries(PRIORITY_CFG) as [TaskPriority, typeof PRIORITY_CFG[TaskPriority]][]).map(([k, v]) => (
                <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <FormControl size="small" fullWidth>
          <InputLabel sx={lblSx}>ステータス</InputLabel>
          <Select value={f.status} onChange={set('status') as any} label="ステータス" sx={selSx} MenuProps={{ PaperProps: { sx: menuPpr } }}>
            {(Object.entries(STATUS_CFG) as [TaskStatus, typeof STATUS_CFG[TaskStatus]][]).map(([k, v]) => (
              <MenuItem key={k} value={k} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' } }}>{v.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField label="期限（任意）" type="date" value={f.dueDate ?? ''} onChange={set('dueDate')} fullWidth size="small"
          InputLabelProps={{ shrink: true, sx: lblSx }}
          InputProps={{ sx: { ...inpProp.sx, colorScheme: 'dark' } }} sx={fldSx}/>
        <TextField label="詳細・メモ" value={f.description ?? ''} onChange={set('description')} fullWidth size="small" multiline minRows={2}
          InputLabelProps={{ sx: lblSx }} InputProps={inpProp} sx={fldSx}/>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
        <Button onClick={() => onSave(f)} disabled={!valid} variant="contained"
          sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2,
            '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' } }}>
          {initial ? '保存' : '追加'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface SchedulesTasksListProps {
  project: DesktopProject;
}

export const SchedulesTasksList: React.FC<SchedulesTasksListProps> = ({ project }) => {
  const { currentUser } = useAuthStore.getState();
  const projectId = project.id;

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
  const [taskView,   setTaskView]   = useState<TaskView>('list');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [tasks,     setTasks]     = useState<TaskItem[]>([]);
  const [loadingS,  setLoadingS]  = useState(true);
  const [loadingT,  setLoadingT]  = useState(true);

  useEffect(() => {
    if (!projectId) return;
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
  }, [projectId]);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [schDlg,   setSchDlg]   = useState(false);
  const [editSch,  setEditSch]  = useState<ScheduleItem | null>(null);
  const [taskDlg,  setTaskDlg]  = useState(false);
  const [editTask, setEditTask] = useState<TaskItem | null>(null);

  // ── Inline add state (list view) ──────────────────────────────────────────
  const [inlineListAdd, setInlineListAdd] = useState(false);

  const openNewSchedule = useCallback((date?: Date, time?: string) => {
    setEditSch({ id: '', dueDate: date ? toDateStr(date) : toDateStr(new Date()), startTime: time ?? '', endTime: '', title: '', type: 'meeting', status: 'upcoming' });
    setSchDlg(true);
  }, []);
  const openEditSchedule = useCallback((ev: ScheduleItem) => { setEditSch(ev); setSchDlg(true); }, []);
  const openEditTask = useCallback((t: TaskItem) => { setEditTask(t); setTaskDlg(true); }, []);

  // ── CRUD ──────────────────────────────────────────────────────────────────
  const uid = currentUser?.uid ?? 'unknown';

  const saveSch = useCallback(async (f: ScheduleFormData) => {
    if (editSch?.id) {
      await updateDoc(doc(db, 'projects', projectId, 'schedules', editSch.id), { ...f, updatedAt: serverTimestamp(), updatedBy: uid });
    } else {
      await addDoc(collection(db, 'projects', projectId, 'schedules'), { ...f, createdAt: serverTimestamp(), createdBy: uid });
    }
    setSchDlg(false); setEditSch(null);
  }, [projectId, editSch, uid]);

  const deleteSch = useCallback(async (id: string) => {
    if (!window.confirm('この予定を削除しますか？')) return;
    await deleteDoc(doc(db, 'projects', projectId, 'schedules', id));
  }, [projectId]);

  const saveTask = useCallback(async (f: TaskFormData) => {
    if (editTask?.id) {
      await updateDoc(doc(db, 'projects', projectId, 'tasks', editTask.id), { ...f, updatedAt: serverTimestamp(), updatedBy: uid });
    } else {
      await addDoc(collection(db, 'projects', projectId, 'tasks'), { ...f, createdAt: serverTimestamp(), createdBy: uid });
    }
    setTaskDlg(false); setEditTask(null);
  }, [projectId, editTask, uid]);

  // ── Inline task save (no dialog) ──────────────────────────────────────────
  const saveInlineTask = useCallback(async (title: string, type: TaskType, status: TaskStatus = 'todo') => {
    await addDoc(collection(db, 'projects', projectId, 'tasks'), {
      title, type, priority: 'medium' as TaskPriority, status, dueDate: '', description: '',
      createdAt: serverTimestamp(), createdBy: uid,
    });
    setInlineListAdd(false);
  }, [projectId, uid]);

  const deleteTask = useCallback(async (id: string) => {
    if (!window.confirm('このタスクを削除しますか？')) return;
    await deleteDoc(doc(db, 'projects', projectId, 'tasks', id));
  }, [projectId]);

  const cycleStatus = useCallback(async (item: TaskItem) => {
    await updateDoc(doc(db, 'projects', projectId, 'tasks', item.id),
      { status: STATUS_CYCLE[item.status] ?? 'todo', updatedAt: serverTimestamp() });
  }, [projectId]);

  // ── Filtered tasks ────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => tasks.filter(t => {
    if (taskFilter === 'all')    return true;
    if (taskFilter === 'done')   return t.status === 'done';
    if (taskFilter === 'todo')   return t.status !== 'done';
    return t.type === taskFilter;
  }), [tasks, taskFilter]);

  const aiWaiting = tasks.filter(t => t.type === 'ai' && t.status !== 'done').length;
  const overdueN  = schedules.filter(s => isOverdue(s.dueDate) && s.status !== 'done').length;
  const pendingN  = tasks.filter(t => t.status !== 'done').length;

  return (
    <Box sx={{ px: { xs: 2, md: 3, lg: 4 }, py: 3, display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 1500, width: '100%', mx: 'auto', boxSizing: 'border-box' }}>

      {/* ── Alert bar ──────────────────────────────────────────────────────── */}
      {(overdueN > 0 || aiWaiting > 0) && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          {overdueN > 0 && (
            <Paper sx={{ px: 2, py: 0.875, bgcolor: 'rgba(250,112,154,0.08)', border: '1px solid rgba(250,112,154,0.25)', borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessAlarmsRoundedIcon sx={{ fontSize: 14, color: '#fa709a' }}/>
              <Typography sx={{ fontSize: '0.75rem', color: '#fa709a', fontWeight: 700 }}>期限超過の予定が {overdueN} 件</Typography>
            </Paper>
          )}
          {aiWaiting > 0 && (
            <Paper sx={{ px: 2, py: 0.875, bgcolor: 'rgba(0,191,255,0.06)', border: '1px solid rgba(0,191,255,0.2)', borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 14, color: '#00BFFF' }}/>
              <Typography sx={{ fontSize: '0.75rem', color: '#00BFFF', fontWeight: 700 }}>AI タスクが {aiWaiting} 件待機中</Typography>
            </Paper>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CALENDAR SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, mb: 2, overflow: 'hidden' }}>
        {/* Calendar toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25,
          borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.02)' }}>

          {/* Left: view tabs */}
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.07)' }}>
            {([
              { id: 'month' as CalView, Icon: CalendarMonthRoundedIcon,    label: '月' },
              { id: 'week'  as CalView, Icon: CalendarViewWeekRoundedIcon, label: '週' },
              { id: 'day'   as CalView, Icon: CalendarViewDayRoundedIcon,  label: '日' },
            ]).map(({ id, Icon, label }) => (
              <Button key={id} size="small" startIcon={<Icon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setCalView(id)}
                sx={{ textTransform: 'none', fontWeight: calView===id ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   calView===id ? '#fff' : 'rgba(255,255,255,0.45)',
                  bgcolor: calView===id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' } }}>
                {label}
              </Button>
            ))}
          </Box>

          {/* Center: nav + label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => navigateCal(-1)} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
              <ChevronLeftRoundedIcon sx={{ fontSize: 18 }}/>
            </IconButton>
            <Typography sx={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', minWidth: 160, textAlign: 'center' }}>
              {calLabel}
            </Typography>
            <IconButton size="small" onClick={() => navigateCal(1)} sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}>
              <ChevronRightRoundedIcon sx={{ fontSize: 18 }}/>
            </IconButton>
            <Button size="small" onClick={() => setCalDate(new Date())}
              sx={{ ml: 0.5, textTransform: 'none', fontWeight: 700, fontSize: '0.72rem', px: 1.25, py: 0.375, borderRadius: 1.5,
                border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)',
                '&:hover': { border: '1px solid rgba(255,255,255,0.35)', color: '#fff' } }}>
              今日
            </Button>
          </Box>

          {/* Right: + New */}
          <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }}/>}
            onClick={() => openNewSchedule(calDate)}
            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5,
              bgcolor: 'rgba(67,233,123,0.14)', color: '#43e97b', border: '1px solid rgba(67,233,123,0.3)', borderRadius: 2,
              '&:hover': { bgcolor: 'rgba(67,233,123,0.22)' } }}>
            予定を追加
          </Button>
        </Box>

        {/* Calendar body */}
        <Box sx={{ p: { xs: 1, md: 1.5 } }}>
          {loadingS ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={24} sx={{ color: '#00BFFF' }}/>
            </Box>
          ) : calView === 'month' ? (
            <MonthView year={year} month={month} schedules={schedules}
              onDayClick={d => { setCalDate(d); setCalView('day'); }}
              onEventClick={openEditSchedule}/>
          ) : calView === 'week' ? (
            <WeekView weekDays={weekDays} schedules={schedules}
              onSlotClick={openNewSchedule}
              onEventClick={openEditSchedule}/>
          ) : (
            <DayView date={calDate} schedules={schedules}
              onSlotClick={openNewSchedule}
              onEventClick={openEditSchedule}/>
          )}
        </Box>
      </Paper>

      {/* ══════════════════════════════════════════════════════════════════════
          TASK SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <Paper sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        {/* Task toolbar */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25,
          borderBottom: '1px solid rgba(255,255,255,0.06)', bgcolor: 'rgba(255,255,255,0.02)', gap: 1.5, flexWrap: 'wrap' }}>

          {/* Left: view toggle */}
          <Box sx={{ display: 'flex', gap: 0.5, p: 0.375, bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            {([
              { id: 'list'   as TaskView, Icon: ViewListRoundedIcon,   label: 'リスト' },
              { id: 'kanban' as TaskView, Icon: ViewKanbanRoundedIcon, label: 'カンバン' },
            ]).map(({ id, Icon, label }) => (
              <Button key={id} size="small" startIcon={<Icon sx={{ fontSize: '14px !important' }}/>}
                onClick={() => setTaskView(id)}
                sx={{ textTransform: 'none', fontWeight: taskView===id ? 700 : 500, fontSize: '0.72rem', px: 1.25, py: 0.375, minWidth: 0, borderRadius: 1.5,
                  color:   taskView===id ? '#fff' : 'rgba(255,255,255,0.45)',
                  bgcolor: taskView===id ? 'rgba(255,255,255,0.1)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)', color: '#fff' } }}>
                {label}
              </Button>
            ))}
          </Box>

          {/* Center: filter chips */}
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
            {([
              { key: 'all'    as TaskFilter, label: 'すべて' },
              { key: 'ai'     as TaskFilter, label: 'AI タスク' },
              { key: 'manual' as TaskFilter, label: '自分で実行' },
              { key: 'review' as TaskFilter, label: '確認事項' },
              { key: 'todo'   as TaskFilter, label: '未完了' },
              { key: 'done'   as TaskFilter, label: '完了済み' },
            ]).map(({ key, label }) => (
              <Chip key={key} label={label} size="small" onClick={() => setTaskFilter(key)}
                sx={{ height: 22, fontSize: '0.67rem', fontWeight: 700, cursor: 'pointer',
                  bgcolor: taskFilter===key ? 'rgba(0,191,255,0.14)' : 'rgba(255,255,255,0.05)',
                  color:   taskFilter===key ? '#00BFFF' : 'rgba(255,255,255,0.5)',
                  border:  `1px solid ${taskFilter===key ? 'rgba(0,191,255,0.4)' : 'transparent'}`,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' } }}/>
            ))}
            {pendingN > 0 && (
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', ml: 0.5 }}>
                {pendingN} 件未完了
              </Typography>
            )}
          </Box>

          {/* Right: + New (list mode: inline row / kanban: each column has own add) */}
          {taskView === 'list' && (
            <Button size="small" startIcon={<AddRoundedIcon sx={{ fontSize: '14px !important' }}/>}
              onClick={() => setInlineListAdd(true)}
              disabled={inlineListAdd}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', px: 1.5, py: 0.5,
                bgcolor: 'rgba(0,191,255,0.12)', color: '#00BFFF', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 2, flexShrink: 0,
                '&:hover': { bgcolor: 'rgba(0,191,255,0.2)' }, '&:disabled': { opacity: 0.4 } }}>
              タスクを追加
            </Button>
          )}
        </Box>

        {/* Task body */}
        <Box sx={{ p: taskView === 'list' ? 0 : 1.5 }}>
          {loadingT ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={24} sx={{ color: '#00BFFF' }}/>
            </Box>
          ) : taskView === 'list' ? (
            <>
              {filteredTasks.length === 0 && !inlineListAdd && (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <FactCheckRoundedIcon sx={{ fontSize: 36, color: 'rgba(255,255,255,0.12)', mb: 1 }}/>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                    {taskFilter === 'all' ? 'タスクがありません' : '該当するタスクはありません'}
                  </Typography>
                  {taskFilter === 'all' && (
                    <Button size="small" startIcon={<AddRoundedIcon/>} onClick={() => setInlineListAdd(true)}
                      sx={{ mt: 1.5, color: '#00BFFF', bgcolor: 'rgba(0,191,255,0.1)', border: '1px solid rgba(0,191,255,0.3)', borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '0.75rem' }}>
                      最初のタスクを追加
                    </Button>
                  )}
                </Box>
              )}
              <TaskListView tasks={filteredTasks} onEdit={openEditTask} onDelete={deleteTask} onCycleStatus={cycleStatus}/>
              {inlineListAdd && (
                <InlineAddRow
                  onSave={(title, type) => saveInlineTask(title, type, 'todo')}
                  onCancel={() => setInlineListAdd(false)}
                />
              )}
            </>
          ) : (
            <KanbanView tasks={filteredTasks} onEdit={openEditTask} onDelete={deleteTask}
              onCycleStatus={cycleStatus} onInlineSave={saveInlineTask}/>
          )}
        </Box>
      </Paper>

      {/* Dialogs */}
      <ScheduleDialog open={schDlg}  initial={editSch}  onClose={() => { setSchDlg(false);  setEditSch(null);  }} onSave={saveSch}/>
      <TaskDialog     open={taskDlg} initial={editTask} onClose={() => { setTaskDlg(false); setEditTask(null); }} onSave={saveTask}/>
    </Box>
  );
};
