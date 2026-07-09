// 公式ブログの Content Strategy（Web admin AdminStrategyPage の移植）。
// 投稿トピックキュー・専門AI記者・AI記者トリガー（Cloud Functions）・AIモデル設定・4週間カレンダー。
// データ: topicQueue / officialArticles / reporters / config/aiModels（Web と同一コレクション）。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Chip, IconButton, CircularProgress,
  Drawer, MenuItem, Tooltip, Stack, Snackbar, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, getDocs, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/client';
import { fetchCategoryNames } from './api/officialCategoriesApi';

const ACCENT = '#38bdf8';

type Sev = 'success' | 'error' | 'info';

const TOPIC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: '待機中', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  generating: { label: 'AI生成中', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  interview: { label: '取材待ち', color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  review: { label: 'レビュー待ち', color: '#c084fc', bg: 'rgba(192,132,252,0.12)' },
  published: { label: '公開済み', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  skip: { label: 'スキップ', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const CATEGORY_OPTIONS_FALLBACK = ['トレンド', 'Tips / Learn', 'SEKKEIYA', 'S.Layout', 'S.Models', 'S.Presentations', 'AI News', 'Workflow', 'Desktop'];

const TEXT_MODELS = [
  { key: 'gemini-2.5-flash', provider: 'gemini', model: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（高速・低コスト）' },
  { key: 'claude-sonnet-4-6', provider: 'claude', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6（バランス）' },
  { key: 'claude-opus-4-8', provider: 'claude', model: 'claude-opus-4-8', label: 'Claude Opus 4.8（最高品質）' },
];
const IMAGE_MODELS = [
  { key: 'nanobanana', provider: 'gemini', model: 'nanobanana', label: 'nanobanana（Gemini 画像）' },
  { key: 'gpt-image-1', provider: 'openai', model: 'gpt-image-1', label: 'GPT Image（OpenAI）' },
  { key: 'none', provider: 'none', model: '', label: '画像生成なし' },
];

interface Topic {
  id: string; keyword: string; category: string; targetWeekOffset: number;
  targetWeekLabel?: string; note?: string; reporterId?: string | null; reporterName?: string | null;
  status: string; [k: string]: unknown;
}
interface Reporter {
  id: string; name?: string; displayName?: string; expertise?: string; tone?: string;
  categories?: string[]; emoji?: string; active?: boolean;
}
interface ArticleLite { id: string; title?: string; status?: string; publishedAt?: any; updatedAt?: any; }

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
const tsToDate = (v: any): Date | null => {
  if (!v) return null;
  try { const d = typeof v?.toDate === 'function' ? v.toDate() : new Date(v); return isNaN(d.getTime()) ? null : d; } catch { return null; }
};

interface OfficialContentStrategyProps {
  onOpenArticle?: (id: string) => void; // カレンダーの記事クリック → 公式エディタを開く
}

export const OfficialContentStrategy: React.FC<OfficialContentStrategyProps> = ({ onOpenArticle }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [articles, setArticles] = useState<ArticleLite[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(CATEGORY_OPTIONS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [aiRunning, setAiRunning] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [aiLog, setAiLog] = useState('');
  const [modelText, setModelText] = useState('gemini-2.5-flash');
  const [modelImage, setModelImage] = useState('nanobanana');
  const [savingModels, setSavingModels] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [reporterDialogOpen, setReporterDialogOpen] = useState(false);
  const [editReporter, setEditReporter] = useState<Reporter | null>(null);
  const [reporterForm, setReporterForm] = useState({ name: '', displayName: '', expertise: '', tone: '', categories: [] as string[], emoji: '📝', active: true });
  const [form, setForm] = useState({ keyword: '', category: 'SEKKEIYA', targetWeekOffset: 0 as number, note: '', reporterId: '' });
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void | Promise<void> } | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: Sev } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicSnap, articleSnap, reporterSnap] = await Promise.all([
        getDocs(query(collection(db, 'topicQueue'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'officialArticles'), orderBy('updatedAt', 'desc'))),
        getDocs(query(collection(db, 'reporters'), orderBy('createdAt', 'desc'))).catch(() => ({ docs: [] as any[] })),
      ]);
      setTopics(topicSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setArticles(articleSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setReporters(reporterSnap.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      try { const names = await fetchCategoryNames({ activeOnly: true }); if (names.length) setCategoryOptions(names); } catch { /* fallback */ }
      try {
        const cfgSnap = await getDoc(doc(db, 'config', 'aiModels'));
        const cfg: any = cfgSnap.exists() ? cfgSnap.data() : {};
        if (cfg.textModel) setModelText(cfg.textModel);
        if (cfg.imageKey) setModelImage(cfg.imageKey); else if (cfg.imageModel) setModelImage(cfg.imageModel);
      } catch { /* defaults */ }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  // ── トピック CRUD ──
  const openAdd = () => { setEditTopic(null); setForm({ keyword: '', category: 'SEKKEIYA', targetWeekOffset: 0, note: '', reporterId: '' }); setDialogOpen(true); };
  const openEdit = (t: Topic) => {
    setEditTopic(t);
    setForm({ keyword: t.keyword || '', category: t.category || 'SEKKEIYA', targetWeekOffset: t.targetWeekOffset ?? 0, note: t.note || '', reporterId: t.reporterId || '' });
    setDialogOpen(true);
  };
  const handleSave = async () => {
    const targetWeekStart = getWeekStart(Number(form.targetWeekOffset));
    const rep = reporters.find((r) => r.id === form.reporterId);
    const payload: any = {
      keyword: form.keyword.trim(), category: form.category, targetWeekOffset: Number(form.targetWeekOffset),
      targetWeekStart, targetWeekLabel: getWeekLabel(targetWeekStart), note: form.note.trim(),
      reporterId: form.reporterId || null, reporterName: rep ? (rep.displayName || rep.name) : null,
      status: editTopic?.status || 'queued', updatedAt: serverTimestamp(),
    };
    if (editTopic) await updateDoc(doc(db, 'topicQueue', editTopic.id), payload);
    else await addDoc(collection(db, 'topicQueue'), { ...payload, createdAt: serverTimestamp() });
    setDialogOpen(false);
    void loadData();
  };
  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'topicQueue', id));
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };
  const handleStatusChange = async (topic: Topic, newStatus: string) => {
    await updateDoc(doc(db, 'topicQueue', topic.id), { status: newStatus, updatedAt: serverTimestamp() });
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: newStatus } : t)));
  };

  const saveAiModels = async () => {
    setSavingModels(true);
    try {
      const t = TEXT_MODELS.find((m) => m.key === modelText) || TEXT_MODELS[0];
      const img = IMAGE_MODELS.find((m) => m.key === modelImage) || IMAGE_MODELS[0];
      await setDoc(doc(db, 'config', 'aiModels'), {
        textProvider: t.provider, textModel: t.model, imageProvider: img.provider, imageModel: img.model, imageKey: img.key, updatedAt: serverTimestamp(),
      }, { merge: true });
      setAiLog(`✅ AIモデルを保存しました（文章生成: ${t.label}）`);
    } catch (e: any) { setAiLog(`❌ モデル保存に失敗：${e.message}`); }
    setSavingModels(false);
  };

  const suggestTopicsAI = async () => {
    setSuggesting(true); setAiLog('AIが検索需要からネタを提案中...');
    try {
      const fn = httpsCallable(functions, 'suggestTopics');
      const r: any = await fn({ count: 5 });
      if (r.data?.success) setAiLog(`✅ AIが ${r.data.added} 件のネタをキューに追加しました。内容を確認して ⚡ で記事を生成してください。`);
      else setAiLog(`⚠️ 提案できませんでした：${r.data?.reason || '不明なエラー'}`);
      void loadData();
    } catch (e: any) { setAiLog(`❌ エラー：${e.message}`); }
    setSuggesting(false);
  };

  const triggerAiReporter = async () => {
    setAiRunning(true); setAiLog('集計を実行中...');
    try {
      const aggregate = httpsCallable(functions, 'aggregateWeeklyTrends');
      const generate = httpsCallable(functions, 'generateTrendArticle');
      const r1: any = await aggregate();
      setAiLog(`集計完了（惜しいKW ${r1.data?.topKeywords?.length || 0}件）。記事を生成中...`);
      const r2: any = await generate();
      setAiLog(`✅ 完了：「${r2.data?.slug}」を ${r2.data?.action === 'created' ? '新規作成' : '更新'}しました。記事一覧で確認してください。`);
      void loadData();
    } catch (e: any) { setAiLog(`❌ エラー：${e.message}`); }
    setAiRunning(false);
  };

  const generateForTopic = async (topic: Topic) => {
    setGeneratingId(topic.id);
    setAiLog(`「${topic.keyword}」のSEO記事を生成中...`);
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'generating' } : t)));
    try {
      const generate = httpsCallable(functions, 'generateKeywordArticle');
      const r: any = await generate({ topicId: topic.id, keyword: topic.keyword, category: topic.category, note: topic.note || '', reporterId: topic.reporterId || null });
      if (r.data?.success) {
        const by = r.data.reporter ? `（記者: ${r.data.reporter}）` : '';
        setAiLog(`✅ 完了：「${r.data.title || topic.keyword}」を下書き作成しました${by}。記事一覧のレビュー待ちで確認してください。`);
      } else {
        setAiLog(`⚠️ 生成できませんでした：${r.data?.reason || '不明なエラー'}`);
        setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'queued' } : t)));
      }
      void loadData();
    } catch (e: any) {
      setAiLog(`❌ エラー：${e.message}`);
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'queued' } : t)));
    }
    setGeneratingId(null);
  };

  // ── 専門AI記者 CRUD ──
  const openAddReporter = () => { setEditReporter(null); setReporterForm({ name: '', displayName: '', expertise: '', tone: '', categories: [], emoji: '📝', active: true }); setReporterDialogOpen(true); };
  const openEditReporter = (rep: Reporter) => {
    setEditReporter(rep);
    setReporterForm({ name: rep.name || '', displayName: rep.displayName || '', expertise: rep.expertise || '', tone: rep.tone || '', categories: Array.isArray(rep.categories) ? rep.categories : [], emoji: rep.emoji || '📝', active: rep.active !== false });
    setReporterDialogOpen(true);
  };
  const handleSaveReporter = async () => {
    const payload: any = {
      name: reporterForm.name.trim(), displayName: reporterForm.displayName.trim() || reporterForm.name.trim(),
      expertise: reporterForm.expertise.trim(), tone: reporterForm.tone.trim(), categories: reporterForm.categories,
      emoji: reporterForm.emoji || '📝', active: reporterForm.active, updatedAt: serverTimestamp(),
    };
    if (editReporter) await updateDoc(doc(db, 'reporters', editReporter.id), payload);
    else await addDoc(collection(db, 'reporters'), { ...payload, createdAt: serverTimestamp() });
    setReporterDialogOpen(false);
    void loadData();
  };
  const handleDeleteReporter = async (id: string) => {
    await deleteDoc(doc(db, 'reporters', id));
    setReporters((prev) => prev.filter((r) => r.id !== id));
  };
  const seedReporters = async () => {
    const samples = [
      { name: '佐藤（間取りの専門家）', displayName: '佐藤 一級建築士', emoji: '🏠', expertise: '住宅の間取り・動線計画・採光/通風設計', tone: '実務的で具体的。施主にも分かるよう噛み砕く', categories: ['S.Layout', 'SEKKEIYA'], active: true },
      { name: '田中（テックライター）', displayName: '田中 テックライター', emoji: '🛠️', expertise: 'Rhino・glb/3D変換・CAD/BIM連携などの技術ワークフロー', tone: '手順が明快で再現性重視。専門用語は補足する', categories: ['Workflow', 'S.Models', 'Desktop'], active: true },
      { name: 'リナ（AIニュース担当）', displayName: 'リナ AIウォッチャー', emoji: '📰', expertise: '建築/設計×AIの最新動向・ツール比較', tone: '速報的で分かりやすく、要点を先に述べる', categories: ['AI News', 'S.Presentations'], active: true },
    ];
    for (const s of samples) await addDoc(collection(db, 'reporters'), { ...s, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    void loadData();
  };
  const toggleReporterCategory = (cat: string) => setReporterForm((f) => ({ ...f, categories: f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat] }));

  // ── カレンダー ──
  const weeks = [0, 1, 2, 3].map((offset) => {
    const start = getWeekStart(offset);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    const label = getWeekLabel(start);
    const weekArticles = articles.filter((a) => {
      const d = tsToDate(a.publishedAt) || tsToDate(a.updatedAt);
      return d && d >= start && d <= end && ['published', 'review', 'interview'].includes(a.status || '');
    });
    const weekTopics = topics.filter((t) => t.targetWeekOffset === offset && t.status === 'queued');
    return { offset, label, articles: weekArticles, topics: weekTopics };
  });

  const totalPublished = articles.filter((a) => a.status === 'published').length;
  const totalReview = articles.filter((a) => a.status === 'review').length;
  const thisWeekCount = weeks[0].articles.length;

  const openArticle = (id: string) => onOpenArticle?.(id);

  if (loading) return (
    <Box sx={{ flex: 1, display: 'flex', minHeight: '50vh', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  const drawerField = { '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' } } } as const;

  return (
    <Box sx={{ flex: 1, height: '100%', overflowY: 'auto', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 }, pb: 8 }}>
        {/* ヘッダー */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mb: 0.25 }}>Content Strategy</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>トピックキュー・AI記者の管理</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" startIcon={suggesting ? <CircularProgress size={14} sx={{ color: '#fb923c' }} /> : <AutoAwesomeRoundedIcon />}
              onClick={() => void suggestTopicsAI()} disabled={suggesting}
              sx={{ color: '#fb923c', borderColor: 'rgba(251,146,60,0.4)', textTransform: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { borderColor: '#fb923c', bgcolor: 'rgba(251,146,60,0.05)' } }}>AIでネタ提案</Button>
            <Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} onClick={openAdd}
              sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}0d` } }}>トピックを追加</Button>
            <Button variant="contained" size="small" startIcon={aiRunning ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <SmartToyRoundedIcon />}
              onClick={() => void triggerAiReporter()} disabled={aiRunning}
              sx={{ bgcolor: '#c084fc', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#a855f7' } }}>AI記者を実行</Button>
          </Stack>
        </Box>

        {aiLog && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.25)' }}>
            <Typography variant="caption" sx={{ color: '#c084fc', fontFamily: 'monospace' }}>{aiLog}</Typography>
          </Box>
        )}

        {/* KPI */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mb: 3 }}>
          {[
            { label: '今週の投稿', value: thisWeekCount, icon: <CalendarMonthRoundedIcon />, color: ACCENT, sub: '公開・レビュー' },
            { label: 'レビュー待ち', value: totalReview, icon: <SmartToyRoundedIcon />, color: '#c084fc', sub: 'AI生成・未公開' },
            { label: '公開済み記事', value: totalPublished, icon: <CheckCircleRoundedIcon />, color: '#4ade80', sub: '累計' },
            { label: '待機中ネタ', value: topics.filter((t) => t.status === 'queued').length, icon: <ScheduleRoundedIcon />, color: '#fbbf24', sub: 'キュー内' },
          ].map((kpi) => (
            <Box key={kpi.label} sx={{ p: 1.75, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <Box sx={{ color: kpi.color, display: 'flex', '& svg': { fontSize: 18 } }}>{kpi.icon}</Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{kpi.label}</Typography>
              </Stack>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{kpi.value}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', mt: 0.4 }}>{kpi.sub}</Typography>
            </Box>
          ))}
        </Box>

        {/* AIモデル設定 */}
        <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
            <SmartToyRoundedIcon sx={{ color: '#c084fc' }} />
            <Typography sx={{ fontWeight: 700, color: '#fff' }}>AIモデル設定</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>記事生成・取材・仕上げに使うモデル</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }}>
            <TextField select label="文章生成モデル" size="small" value={modelText} onChange={(e) => setModelText(e.target.value)}
              sx={{ flex: 1, ...drawerField }} InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }}>
              {TEXT_MODELS.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
            </TextField>
            <TextField select label="画像生成モデル" size="small" value={modelImage} onChange={(e) => setModelImage(e.target.value)}
              helperText="※画像/スライド生成は次段で連携予定" sx={{ flex: 1, ...drawerField }}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.3)' } }}>
              {IMAGE_MODELS.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
            </TextField>
            <Button variant="contained" onClick={() => void saveAiModels()} disabled={savingModels}
              startIcon={savingModels ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <CheckCircleRoundedIcon />}
              sx={{ bgcolor: '#c084fc', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#a855f7' } }}>保存</Button>
          </Stack>
        </Box>

        {/* 4週間カレンダー */}
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1.5 }}>
          <CalendarMonthRoundedIcon sx={{ fontSize: 17, mr: 0.75, verticalAlign: 'middle', color: ACCENT }} />4週間カレンダー
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5, mb: 3.5 }}>
          {weeks.map((week) => (
            <Box key={week.offset} sx={{ p: 2, borderRadius: 2, bgcolor: week.offset === 0 ? `${ACCENT}0f` : 'rgba(255,255,255,0.03)', border: `1px solid ${week.offset === 0 ? `${ACCENT}40` : 'rgba(255,255,255,0.07)'}` }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: week.offset === 0 ? ACCENT : 'rgba(255,255,255,0.5)' }}>
                  {week.offset === 0 ? '今週' : `+${week.offset}週`}　{week.label}
                </Typography>
                <Chip label={`${week.articles.length + week.topics.length}件`} size="small" sx={{ fontSize: '0.68rem', height: 18, bgcolor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }} />
              </Stack>
              <Stack spacing={0.75}>
                {week.articles.map((a) => (
                  <Box key={a.id} onClick={() => openArticle(a.id)}
                    sx={{ p: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: a.status === 'published' ? 'rgba(74,222,128,0.08)' : a.status === 'interview' ? 'rgba(251,146,60,0.08)' : 'rgba(192,132,252,0.08)', border: `1px solid ${a.status === 'published' ? 'rgba(74,222,128,0.2)' : a.status === 'interview' ? 'rgba(251,146,60,0.2)' : 'rgba(192,132,252,0.2)'}`, '&:hover': { filter: 'brightness(1.3)' } }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.status === 'published' ? '✅ ' : a.status === 'interview' ? '🎤 ' : '🤖 '}{a.title}
                    </Typography>
                  </Box>
                ))}
                {week.topics.map((t) => (
                  <Box key={t.id} onClick={() => openEdit(t)}
                    sx={{ p: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.25)', '&:hover': { bgcolor: 'rgba(251,191,36,0.12)' } }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#fbbf24', lineHeight: 1.3 }}>📌 {t.keyword}</Typography>
                  </Box>
                ))}
                {week.articles.length + week.topics.length === 0 && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', py: 0.5 }}>予定なし</Typography>
                )}
              </Stack>
            </Box>
          ))}
        </Box>

        {/* 専門AI記者 */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff' }}>
            <SmartToyRoundedIcon sx={{ fontSize: 17, mr: 0.75, verticalAlign: 'middle', color: '#c084fc' }} />専門AI記者
          </Typography>
          <Button size="small" variant="outlined" startIcon={<AddRoundedIcon />} onClick={openAddReporter}
            sx={{ color: '#c084fc', borderColor: 'rgba(192,132,252,0.4)', textTransform: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { borderColor: '#c084fc', bgcolor: 'rgba(192,132,252,0.05)' } }}>記者を追加</Button>
        </Stack>
        {reporters.length === 0 ? (
          <Box sx={{ mb: 3.5, p: 4, borderRadius: 2, border: '1px dashed rgba(192,132,252,0.3)', textAlign: 'center' }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>専門AI記者がまだいません</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', mb: 2.5 }}>分野ごとに人格・専門性・文体を持った記者を作ると、カテゴリ別に一貫した記事を量産できます</Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button variant="contained" startIcon={<SmartToyRoundedIcon />} onClick={() => void seedReporters()}
                sx={{ bgcolor: '#c084fc', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#a855f7' } }}>サンプル記者3名を作成</Button>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openAddReporter}
                sx={{ color: '#c084fc', borderColor: 'rgba(192,132,252,0.4)', textTransform: 'none', borderRadius: 2 }}>自分で追加</Button>
            </Stack>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5, mb: 3.5 }}>
            {reporters.map((rep) => (
              <Box key={rep.id} onClick={() => openEditReporter(rep)} sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(192,132,252,0.05)', cursor: 'pointer', border: '1px solid rgba(192,132,252,0.2)', opacity: rep.active === false ? 0.5 : 1, '&:hover': { bgcolor: 'rgba(192,132,252,0.1)', borderColor: 'rgba(192,132,252,0.4)' } }}>
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                  <Box sx={{ fontSize: '1.6rem', lineHeight: 1 }}>{rep.emoji || '📝'}</Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.3 }}>{rep.displayName || rep.name}</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', mb: 0.75 }}>{rep.expertise}</Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {(rep.categories || []).map((c) => <Chip key={c} label={c} size="small" sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(192,132,252,0.12)', color: '#c084fc' }} />)}
                    </Stack>
                  </Box>
                  <Stack direction="column" spacing={0.5}>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); openEditReporter(rep); }} sx={{ color: ACCENT, p: 0.5 }}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setConfirm({ msg: `記者「${rep.displayName || rep.name}」を削除しますか？`, onOk: () => handleDeleteReporter(rep.id) }); }} sx={{ color: '#ef4444', p: 0.5 }}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
                  </Stack>
                </Stack>
              </Box>
            ))}
          </Box>
        )}

        {/* トピックキュー */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff' }}>
            <ScheduleRoundedIcon sx={{ fontSize: 17, mr: 0.75, verticalAlign: 'middle', color: '#fbbf24' }} />トピックキュー
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>狙う検索KWを追加 → ⚡でSEO記事を生成 → レビュー待ちへ</Typography>
        </Stack>
        <Box sx={{ borderRadius: 2, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          {topics.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.3)', mb: 2 }}>トピックがまだありません</Typography>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openAdd} sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2 }}>最初のトピックを追加</Button>
            </Box>
          ) : topics.map((topic, i) => {
            const sc = TOPIC_STATUS[topic.status] || TOPIC_STATUS.queued;
            return (
              <Box key={topic.id} onClick={() => openEdit(topic)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: 'pointer', borderBottom: i < topics.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, border: `1px solid ${sc.color}33`, fontSize: '0.7rem', minWidth: 90 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.keyword}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>{topic.category}</Typography>
                    {topic.reporterName && <Typography sx={{ fontSize: '0.72rem', color: '#c084fc' }}>✍️ {topic.reporterName}</Typography>}
                    {topic.targetWeekLabel && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>📅 {topic.targetWeekLabel}</Typography>}
                    {topic.note && <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>💬 {topic.note}</Typography>}
                  </Stack>
                </Box>
                <TextField select size="small" value={topic.status} onClick={(e) => e.stopPropagation()} onChange={(e) => void handleStatusChange(topic, e.target.value)}
                  sx={{ width: 120, '& .MuiOutlinedInput-root': { fontSize: '0.78rem', color: sc.color, '& fieldset': { borderColor: `${sc.color}44` } } }}>
                  {Object.entries(TOPIC_STATUS).map(([v, { label }]) => <MenuItem key={v} value={v} sx={{ fontSize: '0.82rem' }}>{label}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="このキーワードでSEO記事を生成">
                    <span>
                      <IconButton size="small" onClick={() => void generateForTopic(topic)} disabled={generatingId === topic.id || topic.status === 'generating'}
                        sx={{ color: '#c084fc', bgcolor: 'rgba(192,132,252,0.1)', '&:hover': { bgcolor: 'rgba(192,132,252,0.2)' }, '&:disabled': { color: 'rgba(192,132,252,0.4)' } }}>
                        {generatingId === topic.id ? <CircularProgress size={16} sx={{ color: '#c084fc' }} /> : <BoltRoundedIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="削除">
                    <IconButton size="small" onClick={() => setConfirm({ msg: 'このトピックを削除しますか？', onOk: () => handleDelete(topic.id) })} sx={{ color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)', '&:hover': { bgcolor: 'rgba(239,68,68,0.15)' } }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* トピック追加/編集 Drawer */}
      <Drawer anchor="right" open={dialogOpen} onClose={() => setDialogOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, bgcolor: '#0e121c', borderLeft: '1px solid rgba(255,255,255,0.1)', color: '#fff' } }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>{editTopic ? 'トピックを編集' : 'トピックを追加'}</Typography>
          <IconButton size="small" onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={2.5}>
            <TextField label="キーワード / 記事タイトルイメージ" fullWidth size="small" value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))}
              placeholder="例: 自動レイアウト カフェ 家具" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField} />
            <TextField select label="カテゴリ" fullWidth size="small" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField}>
              {categoryOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField select label="担当記者（任意）" fullWidth size="small" value={form.reporterId} onChange={(e) => setForm((f) => ({ ...f, reporterId: e.target.value }))}
              helperText="未指定ならカテゴリ一致の記者が自動で担当します" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} FormHelperTextProps={{ sx: { color: 'rgba(255,255,255,0.3)' } }} sx={drawerField}>
              <MenuItem value=""><em>自動（カテゴリで選択）</em></MenuItem>
              {reporters.filter((r) => r.active !== false).map((r) => <MenuItem key={r.id} value={r.id}>{r.emoji || '📝'} {r.displayName || r.name}</MenuItem>)}
            </TextField>
            <TextField select label="対象週" fullWidth size="small" value={form.targetWeekOffset} onChange={(e) => setForm((f) => ({ ...f, targetWeekOffset: Number(e.target.value) }))}
              InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField}>
              {[0, 1, 2, 3].map((offset) => <MenuItem key={offset} value={offset}>{offset === 0 ? '今週' : `${offset}週後`}　（{getWeekLabel(getWeekStart(offset))}）</MenuItem>)}
            </TextField>
            <TextField label="メモ（任意）" fullWidth size="small" multiline rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="GSCで上位を狙いたい理由、参考URLなど" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField} />
            {editTopic && (
              <Button onClick={() => { setConfirm({ msg: 'このトピックを削除しますか？', onOk: () => handleDelete(editTopic.id) }); setDialogOpen(false); }} startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ef4444', textTransform: 'none', justifyContent: 'flex-start', mt: 1 }}>このトピックを削除</Button>
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleSave()} variant="contained" disabled={!form.keyword.trim()}
            sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2 }}>{editTopic ? '更新' : '追加'}</Button>
        </Box>
      </Drawer>

      {/* 記者 追加/編集 Drawer */}
      <Drawer anchor="right" open={reporterDialogOpen} onClose={() => setReporterDialogOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, bgcolor: '#0e121c', borderLeft: '1px solid rgba(255,255,255,0.1)', color: '#fff' } }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.05rem' }}>{editReporter ? '記者を編集' : '専門AI記者を追加'}</Typography>
          <IconButton size="small" onClick={() => setReporterDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Box>
        <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={2}>
              <TextField label="絵文字" size="small" value={reporterForm.emoji} onChange={(e) => setReporterForm((f) => ({ ...f, emoji: e.target.value }))}
                inputProps={{ maxLength: 4, style: { textAlign: 'center', fontSize: '1.2rem' } }} InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={{ width: 90, ...drawerField }} />
              <TextField label="表示名（記事の著者名）" fullWidth size="small" value={reporterForm.displayName} onChange={(e) => setReporterForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="例: 佐藤 一級建築士" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField} />
            </Stack>
            <TextField label="専門分野" fullWidth size="small" value={reporterForm.expertise} onChange={(e) => setReporterForm((f) => ({ ...f, expertise: e.target.value }))}
              placeholder="例: 住宅の間取り・動線計画・採光/通風設計" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField} />
            <TextField label="文体・トーン" fullWidth size="small" multiline rows={2} value={reporterForm.tone} onChange={(e) => setReporterForm((f) => ({ ...f, tone: e.target.value }))}
              placeholder="例: 実務的で具体的。施主にも分かるよう噛み砕く" InputLabelProps={{ sx: { color: 'rgba(255,255,255,0.5)' } }} sx={drawerField} />
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', mb: 1 }}>担当カテゴリ（複数選択可・自動割当に使用）</Typography>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {categoryOptions.map((c) => {
                  const on = reporterForm.categories.includes(c);
                  return <Chip key={c} label={c} size="small" onClick={() => toggleReporterCategory(c)}
                    sx={{ cursor: 'pointer', bgcolor: on ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.05)', color: on ? '#c084fc' : 'rgba(255,255,255,0.5)', border: `1px solid ${on ? 'rgba(192,132,252,0.5)' : 'transparent'}` }} />;
                })}
              </Stack>
            </Box>
            <Chip label={reporterForm.active ? '✓ 有効（生成に使用）' : '無効'} onClick={() => setReporterForm((f) => ({ ...f, active: !f.active }))}
              sx={{ cursor: 'pointer', alignSelf: 'flex-start', bgcolor: reporterForm.active ? 'rgba(74,222,128,0.12)' : 'rgba(107,114,128,0.15)', color: reporterForm.active ? '#4ade80' : 'rgba(255,255,255,0.4)', fontWeight: 700 }} />
            {editReporter && (
              <Button onClick={() => { setConfirm({ msg: 'この記者を削除しますか？', onOk: () => handleDeleteReporter(editReporter.id) }); setReporterDialogOpen(false); }} startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ef4444', textTransform: 'none', justifyContent: 'flex-start', mt: 1 }}>この記者を削除</Button>
            )}
          </Stack>
        </Box>
        <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          <Button onClick={() => setReporterDialogOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleSaveReporter()} variant="contained" disabled={!reporterForm.displayName.trim() && !reporterForm.name.trim()}
            sx={{ bgcolor: '#c084fc', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#a855f7' } }}>{editReporter ? '更新' : '追加'}</Button>
        </Box>
      </Drawer>

      {/* 削除確認 */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)}
        PaperProps={{ sx: { bgcolor: '#0e121c', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', minWidth: 380, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>確認</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>{confirm?.msg}</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={async () => { const c = confirm; setConfirm(null); await c?.onOk(); }} variant="contained" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
