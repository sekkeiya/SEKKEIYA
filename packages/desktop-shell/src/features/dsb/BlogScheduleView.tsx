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
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { BlogSchedule } from './types';

const ACCENT = '#e57373';

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    color: '#fff',
    '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
    '&.Mui-focused fieldset': { borderColor: ACCENT },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiInputLabel-root.Mui-focused': { color: ACCENT },
};

const selectMenuProps = {
  MenuProps: { PaperProps: { sx: { bgcolor: '#1a1c22', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.12)' } } },
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
  title: string;
  category: string;
  note: string;
}

export const BlogScheduleView: React.FC = () => {
  const { schedules, categories, loading, loadSchedules, addSchedule, updateSchedule, removeSchedule } = useDsbStore();
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);

  useEffect(() => { if (uid) loadSchedules(uid); }, [uid, loadSchedules]);

  const [dialog, setDialog] = useState<DraftSchedule | null>(null);

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
  const upcoming = schedules.filter((s) => s.status === 'planned' && s.date >= today).length;

  const openNew = () => setDialog({ date: today, title: '', category: '', note: '' });
  const openEdit = (s: BlogSchedule) => setDialog({ id: s.id, date: s.date, title: s.title, category: s.category || '', note: s.note || '' });

  const submit = async () => {
    if (!uid || !dialog || !dialog.title.trim() || !dialog.date) return;
    if (dialog.id) {
      await updateSchedule(uid, dialog.id, { date: dialog.date, title: dialog.title.trim(), category: dialog.category || undefined, note: dialog.note || undefined });
    } else {
      await addSchedule(uid, { date: dialog.date, title: dialog.title.trim(), category: dialog.category || undefined, note: dialog.note || undefined });
    }
    setDialog(null);
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <EventNoteRoundedIcon sx={{ color: ACCENT, fontSize: 28 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>投稿スケジュール</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            いつ・どんなテーマを出すか計画して投稿戦略を立てる{upcoming > 0 ? `（今後の予定 ${upcoming} 件）` : ''}
          </Typography>
        </Box>
        <Button onClick={openNew} variant="contained" startIcon={<AddRoundedIcon />}
          sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#ef9a9a' } }}>
          予定を追加
        </Button>
      </Box>

      {loading && schedules.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
      ) : schedules.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: 'rgba(255,255,255,0.4)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 2 }}>
          <EventNoteRoundedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ mb: 2 }}>まだ投稿予定がありません。テーマと日付を決めて計画を立てましょう。</Typography>
          <Button onClick={openNew} variant="outlined" sx={{ color: ACCENT, borderColor: `${ACCENT}77`, textTransform: 'none' }}>
            最初の予定を追加
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {grouped.map(([month, items]) => (
            <Box key={month}>
              <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: 700, mb: 1 }}>{monthLabel(month + '-01')}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {items.map((s) => {
                  const done = s.status === 'done';
                  const overdue = !done && s.date < today;
                  return (
                    <Box key={s.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.25, borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                      '&:hover .sch-actions': { opacity: 1 },
                    }}>
                      <Tooltip title={done ? '予定に戻す' : '公開済みにする'}>
                        <IconButton size="small" onClick={() => uid && updateSchedule(uid, s.id, { status: done ? 'planned' : 'done' })}
                          sx={{ color: done ? '#81c784' : 'rgba(255,255,255,0.4)', '&:hover': { color: done ? '#81c784' : ACCENT } }}>
                          {done ? <CheckCircleRoundedIcon fontSize="small" /> : <RadioButtonUncheckedRoundedIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Box sx={{ width: 92, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: overdue ? '#ef9a9a' : 'rgba(255,255,255,0.85)' }}>{dayLabel(s.date)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: 14, fontWeight: 600, color: done ? 'rgba(255,255,255,0.5)' : '#fff', textDecoration: done ? 'line-through' : 'none' }}>
                          {s.title}
                        </Typography>
                        {s.note && <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{s.note}</Typography>}
                      </Box>
                      {s.category && (
                        <Chip size="small" label={s.category} sx={{ height: 20, fontSize: 10, bgcolor: `${ACCENT}26`, color: '#f3c0c0' }} />
                      )}
                      {overdue && <Chip size="small" label="期限超過" sx={{ height: 20, fontSize: 10, bgcolor: 'rgba(239,68,68,0.18)', color: '#ef9a9a' }} />}
                      <Box className="sch-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
                        <Tooltip title="編集"><IconButton size="small" onClick={() => openEdit(s)} sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fff' } }}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
                        <Tooltip title="削除"><IconButton size="small" onClick={() => uid && removeSchedule(uid, s.id)} sx={{ color: 'rgba(255,255,255,0.45)', '&:hover': { color: '#fa9bb4' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
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
        PaperProps={{ sx: { bgcolor: '#13151b', backgroundImage: 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, minWidth: 420 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{dialog?.id ? '予定を編集' : '投稿予定を追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="投稿予定日" type="date" value={dialog?.date || ''}
            onChange={(e) => setDialog((d) => d && { ...d, date: e.target.value })}
            fullWidth size="small" sx={fieldSx} InputLabelProps={{ shrink: true }}
          />
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
          <Button onClick={() => setDialog(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={submit} disabled={!dialog?.title.trim() || !dialog?.date} variant="contained"
            sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, '&:hover': { bgcolor: '#ef9a9a' } }}>
            {dialog?.id ? '保存' : '追加'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
