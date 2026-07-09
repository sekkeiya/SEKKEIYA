/**
 * OfficialTopicQueue — 公式ブログの「記事ネタ（作成待ち）」。
 * 記事作成の入り口。狙うキーワード/テーマを積み、⚡でAIがSEO記事を下書き生成 → レビュー・公開へ。
 * スケジュール画面のカレンダー右側レール等で使う自己完結コンポーネント（自前でtopicQueueを読み書き）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Chip, IconButton, CircularProgress, Tooltip,
  Drawer, MenuItem, Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/client';
import { fetchCategoryNames } from './api/officialCategoriesApi';

const ACCENT = '#38bdf8';
const CATEGORY_FALLBACK = ['トレンド', 'Tips / Learn', 'SEKKEIYA', 'S.Layout', 'S.Model', 'S.Slide', 'AI News', 'Workflow', 'Desktop', 'お知らせ'];

const TOPIC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: '待機中', color: 'rgb(var(--brand-fg-rgb) / 0.65)', bg: 'rgb(var(--slate-ink-rgb) / 0.1)' },
  generating: { label: 'AI生成中', color: 'light-dark(#054ea8, #60a5fa)', bg: 'rgba(96,165,250,0.12)' },
  interview: { label: '取材待ち', color: 'light-dark(#aa4e03, #fb923c)', bg: 'rgba(251,146,60,0.12)' },
  review: { label: 'レビュー待ち', color: 'light-dark(#5704a9, #c084fc)', bg: 'rgba(192,132,252,0.12)' },
};

interface Topic {
  id: string; keyword: string; category: string; targetWeekOffset: number;
  targetWeekLabel?: string; note?: string; status: string; generatedArticleId?: string; [k: string]: unknown;
}

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  const mon = new Date(d); mon.setDate(d.getDate() - d.getDay() + 1);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()}〜${sun.getMonth() + 1}/${sun.getDate()}`;
}
function getWeekStart(offsetWeeks = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 + offsetWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface OfficialTopicQueueProps {
  /** 記事を開く（生成完了・生成済みトピック → 公式エディタ） */
  onOpenArticle?: (id: string) => void;
  /** キューや記事に変化があったとき（親のカレンダー等を再読込するため） */
  onChanged?: () => void;
}

export const OfficialTopicQueue: React.FC<OfficialTopicQueueProps> = ({ onOpenArticle, onChanged }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(CATEGORY_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [planMsg, setPlanMsg] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState({ keyword: '', category: 'SEKKEIYA', targetWeekOffset: 0 as number, note: '' });
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void | Promise<void> } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'topicQueue'), orderBy('createdAt', 'desc')));
      const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Topic[];
      // 「作成待ち」= 未公開・未スキップのみ（公開済みはスケジュール/記事一覧で見る）
      setTopics(all.filter((t) => !['published', 'skip'].includes(t.status)));
      try { const names = await fetchCategoryNames({ activeOnly: true }); if (names.length) setCategoryOptions(names); } catch { /* fallback */ }
    } catch (e) { console.warn('[OfficialTopicQueue] load failed', e); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openAdd = () => { setEditTopic(null); setForm({ keyword: '', category: 'SEKKEIYA', targetWeekOffset: 0, note: '' }); setDialogOpen(true); };
  const openEdit = (t: Topic) => {
    setEditTopic(t);
    setForm({ keyword: t.keyword || '', category: t.category || 'SEKKEIYA', targetWeekOffset: t.targetWeekOffset ?? 0, note: t.note || '' });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    const targetWeekStart = getWeekStart(Number(form.targetWeekOffset));
    const payload: any = {
      keyword: form.keyword.trim(), category: form.category, targetWeekOffset: Number(form.targetWeekOffset),
      targetWeekStart, targetWeekLabel: getWeekLabel(targetWeekStart), note: form.note.trim(),
      status: editTopic?.status || 'queued', updatedAt: serverTimestamp(),
    };
    if (editTopic) await updateDoc(doc(db, 'topicQueue', editTopic.id), payload);
    else await addDoc(collection(db, 'topicQueue'), { ...payload, createdAt: serverTimestamp() });
    setDialogOpen(false);
    await load(); onChanged?.();
  };
  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'topicQueue', id));
    setTopics((prev) => prev.filter((t) => t.id !== id));
    onChanged?.();
  };

  // AI投稿計画: SEKKEIYAの状況＋運営戦略を分析し、記事ネタを起こしてキューへ（4週間に分散）。
  const aiPlan = async () => {
    if (planning) return;
    setPlanning(true); setPlanMsg('戦略と状況から記事ネタを作成中…');
    try {
      const plan = httpsCallable(functions, 'planBlogContent');
      const r: any = await plan({ scope: 'official', count: 6 });
      if (r.data?.success && Array.isArray(r.data.topics) && r.data.topics.length) {
        const out: any[] = r.data.topics;
        for (let i = 0; i < out.length; i++) {
          const t = out[i];
          const offset = Math.min(3, Math.floor(i / 2)); // 2件/週で4週に分散
          const start = getWeekStart(offset);
          await addDoc(collection(db, 'topicQueue'), {
            keyword: String(t.topic || '').trim(),
            category: String(t.category || 'SEKKEIYA').trim(),
            targetWeekOffset: offset, targetWeekStart: start, targetWeekLabel: getWeekLabel(start),
            note: [t.angle, t.rationale].filter(Boolean).join(' / '),
            kind: t.kind || 'promo', status: 'queued',
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        setPlanMsg(`✅ ${out.length}件のネタを追加しました。⚡で記事化できます。`);
        await load(); onChanged?.();
      } else {
        setPlanMsg(`⚠️ 計画できませんでした：${r.data?.reason || '不明なエラー'}`);
      }
    } catch (e: any) {
      setPlanMsg(`❌ エラー：${e.message}`);
    } finally {
      setPlanning(false);
    }
  };

  const generateForTopic = async (topic: Topic) => {
    setGeneratingId(topic.id);
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'generating' } : t)));
    try {
      const generate = httpsCallable(functions, 'generateKeywordArticle');
      const r: any = await generate({ topicId: topic.id, keyword: topic.keyword, category: topic.category, note: topic.note || '' });
      if (r.data?.success) {
        await load(); onChanged?.();
        if (r.data.articleId) onOpenArticle?.(r.data.articleId);
      } else {
        setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'queued' } : t)));
      }
    } catch (e) {
      console.warn('[OfficialTopicQueue] generate failed', e);
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'queued' } : t)));
    }
    setGeneratingId(null);
  };

  const drawerField = { '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } } as const;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* ヘッダ */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, flexShrink: 0 }}>
        <EditNoteRoundedIcon sx={{ color: ACCENT, fontSize: 20 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)', fontSize: '0.95rem', lineHeight: 1.2 }}>記事ネタ（作成待ち）</Typography>
          <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>⚡でAIが記事を下書き → レビュー・公開</Typography>
        </Box>
        <Tooltip title="ネタを追加">
          <IconButton size="small" onClick={openAdd} sx={{ color: ACCENT, bgcolor: `${ACCENT}14`, '&:hover': { bgcolor: `${ACCENT}22` } }}>
            <AddRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* AI投稿計画（戦略＋状況からネタを一括で起こす） */}
      <Button fullWidth size="small" variant="outlined" onClick={() => void aiPlan()} disabled={planning}
        startIcon={planning ? <CircularProgress size={14} sx={{ color: 'light-dark(#aa4e03, #fb923c)' }} /> : <AutoAwesomeRoundedIcon />}
        sx={{ mb: 1, flexShrink: 0, color: 'light-dark(#aa4e03, #fb923c)', borderColor: 'rgba(251,146,60,0.4)', textTransform: 'none', borderRadius: 2, fontWeight: 700, justifyContent: 'flex-start', '&:hover': { borderColor: '#fb923c', bgcolor: 'rgba(251,146,60,0.05)' } }}>
        {planning ? '計画を作成中…' : 'AI投稿計画（ネタを起こす）'}
      </Button>
      {planMsg && (
        <Typography sx={{ mb: 1, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)', lineHeight: 1.5, flexShrink: 0 }}>{planMsg}</Typography>
      )}

      {/* リスト */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.08)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress size={22} sx={{ color: ACCENT }} /></Box>
        ) : topics.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.82rem', mb: 1.5 }}>作成待ちのネタはありません</Typography>
            <Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} onClick={openAdd}
              sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2 }}>ネタを追加</Button>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', fontSize: '0.72rem', mt: 1.5, lineHeight: 1.6 }}>
              「戦略」タブの AI投稿計画 でまとめて起こすこともできます。
            </Typography>
          </Box>
        ) : topics.map((topic) => {
          const sc = TOPIC_STATUS[topic.status] || TOPIC_STATUS.queued;
          const generated = typeof topic.generatedArticleId === 'string' && topic.generatedArticleId;
          return (
            <Box key={topic.id} onClick={() => openEdit(topic)}
              sx={{ p: 1.25, cursor: 'pointer', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.05)', '&:last-of-type': { borderBottom: 'none' }, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, fontSize: '0.64rem', height: 18 }} />
                {topic.targetWeekLabel && <Typography sx={{ fontSize: '0.66rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>📅 {topic.targetWeekLabel}</Typography>}
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={0.25} onClick={(e) => e.stopPropagation()}>
                  {generated && (
                    <Tooltip title="生成した記事を開く">
                      <IconButton size="small" onClick={() => onOpenArticle?.(topic.generatedArticleId as string)}
                        sx={{ color: '#4ade80', p: 0.5, bgcolor: 'rgba(74,222,128,0.1)', '&:hover': { bgcolor: 'rgba(74,222,128,0.2)' } }}>
                        <LaunchRoundedIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={generated ? 'このネタで記事を再生成' : 'このネタでSEO記事を生成'}>
                    <span>
                      <IconButton size="small" onClick={() => void generateForTopic(topic)} disabled={generatingId === topic.id || topic.status === 'generating'}
                        sx={{ color: 'light-dark(#5704a9, #c084fc)', p: 0.5, bgcolor: 'rgba(192,132,252,0.1)', '&:hover': { bgcolor: 'rgba(192,132,252,0.2)' } }}>
                        {generatingId === topic.id ? <CircularProgress size={14} sx={{ color: 'light-dark(#5704a9, #c084fc)' }} /> : <BoltRoundedIcon sx={{ fontSize: 15 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => setConfirm({ msg: 'このネタを削除しますか？', onOk: () => handleDelete(topic.id) })}
                      sx={{ color: '#ef4444', p: 0.5, '&:hover': { bgcolor: 'rgba(239,68,68,0.12)' } }}>
                      <DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.35 }}>{topic.keyword}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{topic.category}</Typography>
            </Box>
          );
        })}
      </Box>

      {/* 追加/編集 Drawer */}
      <Drawer anchor="right" open={dialogOpen} onClose={() => setDialogOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'var(--brand-surface)', borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' } }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 800, fontSize: '1.05rem' }}>{editTopic ? 'ネタを編集' : 'ネタを追加'}</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={2.5}>
            <TextField label="キーワード / 記事タイトルイメージ" fullWidth size="small" value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="例: 自動レイアウト カフェ 家具" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} sx={drawerField} />
            <TextField select label="カテゴリ" fullWidth size="small" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} sx={drawerField}>
              {categoryOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="対象週" fullWidth size="small" value={form.targetWeekOffset} onChange={(e) => setForm((f) => ({ ...f, targetWeekOffset: Number(e.target.value) }))}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} sx={drawerField}>
              {[0, 1, 2, 3].map((offset) => <MenuItem key={offset} value={offset}>{offset === 0 ? '今週' : `${offset}週後`}　（{getWeekLabel(getWeekStart(offset))}）</MenuItem>)}
            </TextField>
            <TextField label="メモ（任意）" fullWidth size="small" multiline rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="狙いたい理由、参考URLなど" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} sx={drawerField} />
            {editTopic && (
              <Button onClick={() => { setConfirm({ msg: 'このネタを削除しますか？', onOk: () => handleDelete(editTopic.id) }); setDialogOpen(false); }} startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ef4444', textTransform: 'none', justifyContent: 'flex-start', mt: 1 }}>このネタを削除</Button>
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 2.5, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={!form.keyword.trim()}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>{editTopic ? '更新' : '追加'}</Button>
        </Box>
      </Drawer>

      {/* 削除確認 */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 340, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>確認</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>{confirm?.msg}</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={async () => { const c = confirm; setConfirm(null); await c?.onOk(); }} variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
