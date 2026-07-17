// S.Blog 投稿スケジュール（コンテンツカレンダー）。
// 「いつ・どんなテーマを出すか」を計画し、投稿戦略を立てるための画面。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, Chip, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase/client';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { BlogMonthCalendar, type CalEvent } from './BlogMonthCalendar';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { draftFromTheme } from './lib/blogWriteFlow';
import type { BlogSchedule } from './types';

// AI投稿計画の提案1件（planBlogContent の topics）
interface PlanProposal { topic: string; category: string; kind: string; angle: string; rationale: string; }
const KIND_LABEL: Record<string, string> = { promo: '宣伝/実績', howto: '使い方', notice: 'お知らせ' };

const ACCENT = '#e57373';

// カテゴリ名から安定した色相（カレンダーのイベント色）。
const hueOf = (s: string) => [...(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const catColor = (cat?: string) => (cat ? `hsl(${hueOf(cat)},60%,58%)` : ACCENT);

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: 'var(--brand-fg)',
    '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.18)' },
    '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgb(var(--brand-fg-rgb) / 0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

const selectMenuProps = {
  MenuProps: { PaperProps: { sx: { bgcolor: 'var(--brand-surface2)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)' } } },
} as const;

const monthLabel = (d: string) => {
  const [y, m] = d.split('-');
  return y && m ? `${y}年${Number(m)}月` : d;
};
const dayLabel = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  const wd = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()] ?? '';
  return `${Number(d.split('-')[2])}日 (${wd})`;
};
const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};

interface DraftSchedule {
  id?: string;
  date: string;
  time: string;
  title: string;
  category: string;
  note: string;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export const BlogScheduleView: React.FC = () => {
  const { schedules, categories, loading, loadSchedules, addSchedule, updateSchedule, removeSchedule, startNew, startEdit, updateDraft } = useDsbStore();
  const displayName = useAuthStore((s: any) => s.currentUser?.displayName as string | undefined);

  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);

  // 🤖 AI投稿計画: AIが「自分の状況（実績・専門性・カテゴリの空白）」を分析して記事案を提案し、
  // 選んだ案を希望曜日・時刻に自動でスケジュールへ載せる。
  const [autoPlanning, setAutoPlanning] = useState(false);          // 予定への書き込み中
  const [aiThinking, setAiThinking] = useState(false);              // AIが計画を考え中
  const [planConfig, setPlanConfig] = useState<{ weekdays: Set<number>; time: string } | null>(null);
  const [proposals, setProposals] = useState<PlanProposal[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // 「AIに投稿計画を作ってもらう」: 状況分析→提案→ダイアログで確認
  const handleAutoPlan = async () => {
    if (aiThinking) return;
    setAiThinking(true);
    // 曜日・時刻の既定（Global Settings > S.Blog）
    let cfg = { weekdays: new Set([2, 5]), time: '20:00' };
    if (uid) {
      try {
        const { loadBlogPrefs } = await import('./api/blogApi');
        const p = await loadBlogPrefs(uid);
        cfg = { weekdays: new Set(p.planWeekdays), time: p.planTime };
      } catch { /* 既定のまま */ }
    }
    try {
      const fn = httpsCallable(functions, 'planBlogContent');
      const r: any = await fn({ scope: 'account', count: 6 });
      if (r.data?.success && Array.isArray(r.data.topics) && r.data.topics.length) {
        setProposals(r.data.topics);
        setSelected(new Set(r.data.topics.map((_: unknown, i: number) => i)));
        setPlanConfig(cfg);
      } else {
        setProposals([]);
        setPlanConfig(cfg);
      }
    } catch (e) {
      console.error('[BlogScheduleView] AI plan failed', e);
      setProposals([]);
      setPlanConfig(cfg);
    } finally {
      setAiThinking(false);
    }
  };

  // 希望曜日に沿って明日以降の日付を count 件生成（既存予定日は避ける）。
  const nextDates = (weekdays: number[], count: number): string[] => {
    const out: string[] = [];
    const used = new Set(schedules.map((s) => s.date));
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    let guard = 0;
    while (out.length < count && guard < 400) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (weekdays.includes(d.getDay()) && !used.has(ds)) { out.push(ds); used.add(ds); }
      d.setDate(d.getDate() + 1); guard++;
    }
    return out;
  };

  // 選んだ提案をスケジュールへ載せる
  const runAutoPlan = async () => {
    if (!uid || autoPlanning || !planConfig || planConfig.weekdays.size === 0 || !proposals) return;
    const picks = proposals.filter((_, i) => selected.has(i));
    if (!picks.length) { setProposals(null); setPlanConfig(null); return; }
    setAutoPlanning(true);
    try {
      const dates = nextDates([...planConfig.weekdays], picks.length);
      for (let i = 0; i < picks.length && i < dates.length; i++) {
        const p = picks[i];
        await addSchedule(uid, {
          date: dates[i], time: planConfig.time, title: p.topic, category: p.category || undefined,
          note: [p.angle, p.rationale].filter(Boolean).join(' / '),
        });
      }
      setProposals(null); setPlanConfig(null);
    } catch (e) {
      console.error('[BlogScheduleView] schedule plan failed', e);
    } finally {
      setAutoPlanning(false);
    }
  };

  useEffect(() => { if (uid) loadSchedules(uid); }, [uid, loadSchedules]);

  const [dialog, setDialog] = useState<DraftSchedule | null>(null);
  // 表示切替（月カレンダー / リスト）と表示中の月
  const [calMode, setCalMode] = useState<'month' | 'list'>('month');
  const now = new Date();
  const [ref, setRef] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() });
  const shiftMonth = (delta: number) => setRef((r) => {
    const d = new Date(r.y, r.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() };
  });
  const calEvents = useMemo<CalEvent[]>(() => schedules.map((s) => ({
    id: s.id, date: s.date, title: s.title, time: s.time || undefined,
    color: catColor(s.category), dim: s.status === 'done', sub: s.category || undefined,
  })), [schedules]);

  // 月ごとにグループ化（予定日昇順）。
  const grouped = useMemo(() => {
    const byMonth = new Map<string, BlogSchedule[]>();
    [...schedules].sort((a, b) => a.date.localeCompare(b.date)).forEach((s) => {
      const key = s.date.slice(0, 7);
      (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(s);
    });
    return [...byMonth.entries()];
  }, [schedules]);

  const today = todayStr();

  const openNew = (date?: string) => setDialog({ date: date || today, time: '20:00', title: '', category: '', note: '' });

  // ✨ 予定を実行: 予定のテーマから下書き＋議論の口火を生成 → エディタ（AIと議論）へ。
  const [writingId, setWritingId] = useState<string | null>(null);
  const writeFromSchedule = async (s: BlogSchedule) => {
    if (!uid || writingId) return;
    // 既に記事を書き始めている予定は、その記事を開く（重複下書きを作らない）
    if (s.articleId && useDsbStore.getState().articles.some((a) => a.id === s.articleId)) {
      startEdit(s.articleId); setDialog(null); return;
    }
    setWritingId(s.id);
    try {
      const theme = `${s.title}${s.note ? `（${s.note}）` : ''}`;
      const d = await draftFromTheme(theme, { authorName: displayName, categories });
      startNew(uid, displayName, s.category || undefined);
      updateDraft({
        title: d.title || s.title,
        excerpt: d.excerpt,
        bodyMarkdown: d.bodyMarkdown,
        tags: d.tags,
        ...(d.category ? { category: d.category } : {}),
        aiDialogue: d.aiDialogue,
      });
      // 予定と記事を紐付け（後で公開時などに使える）
      const newId = useDsbStore.getState().draft?.id;
      if (newId) void updateSchedule(uid, s.id, { articleId: newId });
      setDialog(null);
    } catch (e) {
      console.error('[BlogScheduleView] write from schedule failed', e);
    } finally {
      setWritingId(null);
    }
  };
  const openEdit = (s: BlogSchedule) => setDialog({ id: s.id, date: s.date, time: s.time || '', title: s.title, category: s.category || '', note: s.note || '' });

  const submit = async () => {
    if (!uid || !dialog || !dialog.title.trim() || !dialog.date) return;
    if (dialog.id) {
      await updateSchedule(uid, dialog.id, { date: dialog.date, time: dialog.time || null, title: dialog.title.trim(), category: dialog.category || undefined, note: dialog.note || undefined });
    } else {
      await addSchedule(uid, { date: dialog.date, time: dialog.time || null, title: dialog.title.trim(), category: dialog.category || undefined, note: dialog.note || undefined });
    }
    setDialog(null);
  };

  const headerActions = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <ToggleButtonGroup size="small" exclusive value={calMode} onChange={(_e, v) => v && setCalMode(v)}
        sx={{ '& .MuiToggleButton-root': { color: 'rgb(var(--brand-fg-rgb) / 0.6)', borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)', px: 1, py: 0.4 }, '& .Mui-selected': { color: '#fff !important', bgcolor: `${ACCENT}55 !important` } }}>
        <ToggleButton value="month"><CalendarMonthRoundedIcon sx={{ fontSize: 17 }} /></ToggleButton>
        <ToggleButton value="list"><ViewListRoundedIcon sx={{ fontSize: 17 }} /></ToggleButton>
      </ToggleButtonGroup>
      <Button onClick={() => void handleAutoPlan()} variant="outlined" size="small" disabled={aiThinking}
        startIcon={aiThinking ? <CircularProgress size={14} sx={{ color: 'light-dark(#742e7f, #ce93d8)' }} /> : <AutoAwesomeRoundedIcon />}
        sx={{ color: 'light-dark(#742e7f, #ce93d8)', borderColor: 'rgba(206,147,216,0.5)', fontWeight: 700, textTransform: 'none',
          '&:hover': { borderColor: '#ce93d8', bgcolor: 'rgba(206,147,216,0.08)' } }}>
        {aiThinking ? '計画を分析中…' : 'AI投稿計画'}
      </Button>
      <Button onClick={() => openNew()} variant="contained" size="small" startIcon={<AddRoundedIcon />}
        sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
        予定を追加
      </Button>
    </Box>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, px: { xs: 2, md: 4 }, py: 3 }}>
      {/* アクション行（タイトルは全幅ヘッダーバンドへ移設。リスト表示時のみ操作を右寄せで残す） */}
      {calMode === 'list' && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mb: 2, flexShrink: 0 }}>
          {headerActions}
        </Box>
      )}

      {/* 月カレンダー（既定） */}
      {calMode === 'month' ? (
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <BlogMonthCalendar
            year={ref.y} month={ref.m} events={calEvents} accent={ACCENT}
            onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)}
            onToday={() => setRef({ y: now.getFullYear(), m: now.getMonth() })}
            onDayClick={(ds) => openNew(ds)}
            onEventClick={(id) => { const s = schedules.find((x) => x.id === id); if (s) openEdit(s); }}
            headerActions={headerActions}
          />
        </Box>
      ) : loading && schedules.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : schedules.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2 }}>
          <EventNoteRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ mb: 2 }}>まだ投稿予定がありません。テーマと日付を決めて計画を立てましょう。</Typography>
          <Button onClick={() => openNew()} variant="outlined" sx={{ color: ACCENT, borderColor: `${ACCENT}77`, textTransform: 'none' }}>
            最初の予定を追加
          </Button>
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {grouped.map(([month, items]) => (
            <Box key={month}>
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: 13, fontWeight: 700, mb: 1 }}>{monthLabel(month + '-01')}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {items.map((s) => {
                  const done = s.status === 'done';
                  const overdue = !done && s.date < today;
                  return (
                    <Box key={s.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, borderRadius: 2,
                      bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.06)',
                      '&:hover .sch-actions': { opacity: 1 },
                    }}>
                      <Tooltip title={done ? '予定に戻す' : '公開済みにする'}>
                        <IconButton size="small" onClick={() => uid && updateSchedule(uid, s.id, { status: done ? 'planned' : 'done' })}
                          sx={{ color: done ? 'light-dark(#357838, #81c784)' : 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: done ? 'light-dark(#357838, #81c784)' : ACCENT } }}>
                          {done ? <CheckCircleRoundedIcon fontSize="small" /> : <RadioButtonUncheckedRoundedIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Box sx={{ width: 112, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: overdue ? 'light-dark(#961818, #ef9a9a)' : 'rgb(var(--brand-fg-rgb) / 0.85)' }}>{dayLabel(s.date)}</Typography>
                        {s.time && <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{s.time}</Typography>}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: done ? 'rgb(var(--brand-fg-rgb) / 0.5)' : 'var(--brand-fg)', textDecoration: done ? 'line-through' : 'none' }}>
                          {s.title}
                        </Typography>
                        {s.note && <Typography noWrap sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{s.note}</Typography>}
                      </Box>
                      {s.category && (
                        <Chip size="small" label={s.category} sx={{ height: 20, fontSize: 10, bgcolor: `${ACCENT}26`, color: 'var(--brand-fg)' }} />
                      )}
                      {overdue && <Chip size="small" label="期限超過" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(239,68,68,0.18)', color: 'light-dark(#961818, #ef9a9a)' }} />}
                      {!done && (
                        <Button size="small" disabled={writingId === s.id}
                          startIcon={writingId === s.id ? <CircularProgress size={12} sx={{ color: ACCENT }} /> : <EditNoteRoundedIcon sx={{ fontSize: '15px !important' }} />}
                          onClick={() => void writeFromSchedule(s)}
                          sx={{ color: ACCENT, textTransform: 'none', fontSize: 11.5, fontWeight: 700, px: 1, flexShrink: 0,
                            '&:hover': { bgcolor: `${ACCENT}14` } }}>
                          {writingId === s.id ? '準備中…' : s.articleId ? '続きを書く' : 'この予定で書く'}
                        </Button>
                      )}
                      <Box className="sch-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
                        <Tooltip title="編集"><IconButton size="small" onClick={() => openEdit(s)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: 'var(--brand-fg)' } }}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="削除"><IconButton size="small" onClick={() => uid && removeSchedule(uid, s.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: 'light-dark(#a50832, #fa9bb4)' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* 予定の追加 / 編集 */}
      <Dialog open={!!dialog} onClose={() => setDialog(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2, minWidth: 420 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{dialog?.id ? '予定を編集' : '投稿予定を追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <TextField
              label="投稿予定日" type="date" value={dialog?.date || ''}
              onChange={(e) => setDialog((d) => d && { ...d, date: e.target.value })}
              fullWidth size="small" sx={fieldSx} InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="時刻" type="time" value={dialog?.time || ''}
              onChange={(e) => setDialog((d) => d && { ...d, time: e.target.value })}
              size="small" sx={{ ...fieldSx, width: 150, flexShrink: 0 }} InputLabelProps={{ shrink: true }}
            />
          </Box>
          <TextField
            label="タイトル / テーマ" value={dialog?.title || ''}
            onChange={(e) => setDialog((d) => d && { ...d, title: e.target.value })}
            fullWidth size="small" sx={fieldSx} autoFocus
          />
          <TextField
            select label="カテゴリ" value={dialog?.category || ''}
            onChange={(e) => setDialog((d) => d && { ...d, category: e.target.value })}
            fullWidth size="small" sx={fieldSx} SelectProps={selectMenuProps}
          >
            <MenuItem value="">（未分類）</MenuItem>
            {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField
            label="メモ（狙い・構成案など）" value={dialog?.note || ''}
            onChange={(e) => setDialog((d) => d && { ...d, note: e.target.value })}
            fullWidth multiline minRows={2} size="small" sx={fieldSx}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDialog(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Box sx={{ flex: 1 }} />
          {/* 既存の予定なら、その場で「この予定で書く」（テーマから下書き＋議論へ） */}
          {dialog?.id && (() => { const s = schedules.find((x) => x.id === dialog.id); return s ? (
            <Button onClick={() => void writeFromSchedule(s)} disabled={writingId === s.id}
              startIcon={writingId === s.id ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : <EditNoteRoundedIcon />}
              sx={{ color: ACCENT, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: `${ACCENT}14` } }}>
              {writingId === s.id ? '準備中…' : s.articleId ? '続きを書く' : 'この予定で書く'}
            </Button>
          ) : null; })()}
          <Button onClick={submit} disabled={!dialog?.title.trim() || !dialog?.date} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, '&:hover': { bgcolor: '#ef9a9a' } }}>
            {dialog?.id ? '保存' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI投稿計画: 提案の確認 → 曜日/時刻を選んでスケジュールへ */}
      <Dialog open={!!proposals} onClose={() => !autoPlanning && (setProposals(null), setPlanConfig(null))} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', backgroundImage: 'none', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeRoundedIcon sx={{ color: 'light-dark(#742e7f, #ce93d8)', fontSize: 20 }} /> AIの投稿計画
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.55)', mb: 1.5, lineHeight: 1.7 }}>
            あなたの実績・専門性・まだ書いていないテーマをAIが分析して、次に書くべき記事を提案しました。
            載せたい案を選んで、投稿する曜日・時刻を決めるとスケジュールに並びます。
          </Typography>

          {proposals && proposals.length === 0 ? (
            <Typography sx={{ fontSize: 12.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', py: 2, textAlign: 'center' }}>
              提案を作れませんでした。カテゴリや記事を少し用意してから再度お試しください。
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
              {(proposals || []).map((p, i) => {
                const on = selected.has(i);
                return (
                  <Box key={i} onClick={() => setSelected((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })}
                    sx={{ px: 1.5, py: 1, borderRadius: 1.5, cursor: 'pointer',
                      bgcolor: on ? 'rgba(206,147,216,0.1)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                      border: `1.5px solid ${on ? '#ce93d8' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                      '&:hover': { borderColor: '#ce93d8' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-fg)', flex: 1 }}>{p.topic}</Typography>
                      {p.category && <Chip label={p.category} size="small" sx={{ height: 18, fontSize: 9.5, bgcolor: `${ACCENT}22`, color: 'var(--brand-fg)' }} />}
                      <Chip label={KIND_LABEL[p.kind] || p.kind} size="small" sx={{ height: 18, fontSize: 9.5, bgcolor: 'rgba(206,147,216,0.18)', color: 'light-dark(#742e7f, #ce93d8)' }} />
                    </Box>
                    {p.angle && <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)', lineHeight: 1.5 }}>{p.angle}</Typography>}
                    {p.rationale && <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', mt: 0.25 }}>💡 {p.rationale}</Typography>}
                  </Box>
                );
              })}
            </Box>
          )}

          {proposals && proposals.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.7)', mb: 0.75 }}>投稿する曜日</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
                {WEEKDAYS.map((w, i) => {
                  const on = !!planConfig?.weekdays.has(i);
                  return (
                    <Chip key={w} label={w} size="small"
                      onClick={() => setPlanConfig((c) => { if (!c) return c; const next = new Set(c.weekdays); if (next.has(i)) next.delete(i); else next.add(i); return { ...c, weekdays: next }; })}
                      sx={{ cursor: 'pointer', fontWeight: 800, width: 40,
                        bgcolor: on ? '#ce93d8' : 'rgb(var(--brand-fg-rgb) / 0.05)', color: on ? '#2a1233' : 'rgb(var(--brand-fg-rgb) / 0.65)',
                        border: `1px solid ${on ? '#ce93d8' : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
                        '&:hover': { bgcolor: on ? '#ce93d8' : 'rgba(206,147,216,0.15)' } }} />
                  );
                })}
              </Box>
              <TextField label="投稿時刻" type="time" value={planConfig?.time || '20:00'}
                onChange={(e) => setPlanConfig((c) => c && { ...c, time: e.target.value })}
                size="small" sx={{ ...fieldSx, width: 160 }} InputLabelProps={{ shrink: true }} />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => { setProposals(null); setPlanConfig(null); }} disabled={autoPlanning} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          {proposals && proposals.length > 0 && (
            <Button onClick={() => void runAutoPlan()} disabled={autoPlanning || selected.size === 0 || !planConfig || planConfig.weekdays.size === 0} variant="contained"
              startIcon={autoPlanning ? <CircularProgress size={14} sx={{ color: '#2a1233' }} /> : <AutoAwesomeRoundedIcon />}
              sx={{ bgcolor: '#ce93d8', color: '#2a1233', fontWeight: 800, '&:hover': { bgcolor: '#ba68c8' } }}>
              {selected.size}件をスケジュールに追加
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
