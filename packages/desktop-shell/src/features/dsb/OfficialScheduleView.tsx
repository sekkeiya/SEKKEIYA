/**
 * OfficialScheduleView — 公式ブログの「スケジュール」。
 * 公式記事（公開日）＋ 未着手の投稿計画（トピックキュー・目標週）を月カレンダーに並べる。
 * 記事＝クリックで編集 / トピック＝クリックでAI自動執筆（＝スケジュールから実行）。タスクなし。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/client';
import { useOfficialBlogStore } from './store/useOfficialBlogStore';
import { OFFICIAL_STATUS_META, type OfficialStatus } from './officialTypes';
import { BlogMonthCalendar, type CalEvent } from './BlogMonthCalendar';
import { OfficialTopicQueue } from './OfficialTopicQueue';

const ACCENT = '#38bdf8';

const toYmd = (v: unknown): string | null => {
  try {
    const d = typeof (v as any)?.toDate === 'function' ? (v as any).toDate() : new Date(v as any);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return null; }
};

const statusColor: Record<OfficialStatus, string> = {
  published: '#4ade80', review: '#c084fc', interview: '#fb923c', draft: '#fbbf24',
};

interface QueuedTopic { id: string; keyword: string; category?: string; note?: string; targetWeekStart?: unknown; generatedArticleId?: string }

export const OfficialScheduleView: React.FC = () => {
  const { articles, startEdit, startNew, refresh } = useOfficialBlogStore();
  const now = new Date();
  const [ref, setRef] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() });
  const shiftMonth = (delta: number) => setRef((r) => { const d = new Date(r.y, r.m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  // 未着手の投稿計画（トピックキュー）を読み、カレンダーに載せる（＝スケジュールから実行できるように）
  const [topics, setTopics] = useState<QueuedTopic[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);
  const loadTopics = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'topicQueue'), where('status', 'in', ['queued', 'interview', 'review'])));
      setTopics(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QueuedTopic, 'id'>) })));
    } catch (e) { console.warn('[OfficialScheduleView] load topics failed', e); }
  };
  useEffect(() => { void loadTopics(); }, []);

  const events = useMemo<CalEvent[]>(() => {
    const artEvents = articles.map((a) => {
      const date = toYmd(a.publishedAt) || toYmd(a.updatedAt) || toYmd(a.createdAt);
      if (!date) return null;
      return {
        id: `art:${a.id}`, date, title: a.title || '(無題)',
        color: statusColor[a.status] || ACCENT, dim: a.status === 'published',
        sub: (OFFICIAL_STATUS_META[a.status]?.label || '') + (a.category?.name ? ` / ${a.category.name}` : ''),
      } as CalEvent;
    }).filter((e): e is CalEvent => !!e);
    // トピック（未生成のみ）を目標週の月曜に配置。オレンジで「計画」を示す。
    const topicEvents = topics.filter((t) => !t.generatedArticleId).map((t) => {
      const date = toYmd(t.targetWeekStart) || toYmd(new Date());
      if (!date) return null;
      return { id: `topic:${t.id}`, date, title: `📝 ${t.keyword}`, color: '#fb923c', sub: `投稿計画${t.category ? ` / ${t.category}` : ''} — クリックで記事を生成` } as CalEvent;
    }).filter((e): e is CalEvent => !!e);
    return [...artEvents, ...topicEvents];
  }, [articles, topics]);

  // カレンダーのイベントクリック: 記事→編集 / トピック→AI自動執筆（生成済みなら記事を開く）
  const onEventClick = async (id: string) => {
    if (id.startsWith('art:')) { void startEdit(id.slice(4)); return; }
    if (!id.startsWith('topic:')) return;
    const t = topics.find((x) => x.id === id.slice(6));
    if (!t || busyId) return;
    if (t.generatedArticleId) { void startEdit(t.generatedArticleId); return; }
    setBusyId(t.id);
    setToast({ msg: `「${t.keyword}」の記事を生成中…`, sev: 'info' });
    try {
      const fn = httpsCallable(functions, 'generateKeywordArticle');
      const r: any = await fn({ topicId: t.id, keyword: t.keyword, category: t.category || 'SEKKEIYA', note: t.note || '' });
      if (r.data?.success && r.data.articleId) {
        await refresh();
        await loadTopics();
        setToast({ msg: `✅ 「${r.data.title || t.keyword}」を下書き作成しました。レビューへ。`, sev: 'success' });
        void startEdit(r.data.articleId);
      } else {
        setToast({ msg: `生成できませんでした：${r.data?.reason || '不明なエラー'}`, sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: `エラー：${e.message}`, sev: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const headerActions = (
    <Button onClick={startNew} variant="contained" size="small" startIcon={<AddRoundedIcon />}
      sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0ea5e9' } }}>
      新規記事
    </Button>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, px: { xs: 2, md: 4 }, py: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexShrink: 0 }}>
        <EventNoteRoundedIcon sx={{ color: ACCENT, fontSize: 26 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 19, lineHeight: 1.2 }}>スケジュール</Typography>
          <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 12 }}>
            左＝カレンダー（記事は公開日／📝は投稿計画、クリックで編集・生成）。右＝記事ネタ（作成待ち）から⚡で記事化。
          </Typography>
        </Box>
      </Box>
      {/* カレンダー ＋ 記事ネタ（作成待ち）レール */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
        <Box sx={{ flex: 1, minHeight: { xs: 360, md: 0 } }}>
          <BlogMonthCalendar
            year={ref.y} month={ref.m} events={events} accent={ACCENT}
            onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)}
            onToday={() => setRef({ y: now.getFullYear(), m: now.getMonth() })}
            onEventClick={(id) => void onEventClick(id)}
            headerActions={headerActions}
          />
        </Box>
        <Box sx={{ width: { xs: '100%', md: 340 }, flexShrink: 0, minHeight: { xs: 300, md: 0 }, display: 'flex', flexDirection: 'column' }}>
          <OfficialTopicQueue onOpenArticle={(id) => void startEdit(id)} onChanged={() => { void refresh(); void loadTopics(); }} />
        </Box>
      </Box>
      {busyId && (
        <Typography sx={{ mt: 1, fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>記事を生成しています…（数十秒）</Typography>
      )}
      <Snackbar open={!!toast} autoHideDuration={3500} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
