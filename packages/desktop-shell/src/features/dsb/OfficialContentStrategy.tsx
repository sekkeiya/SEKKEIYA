// 公式ブログの Content Strategy（Web admin AdminStrategyPage の移植）。
// 投稿トピックキュー・専門AI記者・AI記者トリガー（Cloud Functions）・AIモデル設定・4週間カレンダー。
// データ: topicQueue / officialArticles / config/aiModels（Web と同一コレクション）。
// ※「専門AI記者」は運営フロー（戦略→投稿計画→執筆）への一本化に伴い撤去済み。
import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, TextField, Chip, IconButton, CircularProgress,
  Drawer, MenuItem, Tooltip, Stack, Snackbar, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, Collapse,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, getDocs, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase/client';
import { fetchCategoryNames } from './api/officialCategoriesApi';

const ACCENT = '#38bdf8';

type Sev = 'success' | 'error' | 'info';

const TOPIC_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  queued: { label: '待機中', color: 'rgb(var(--brand-fg-rgb) / 0.65)', bg: 'rgb(var(--slate-ink-rgb) / 0.1)' },
  generating: { label: 'AI生成中', color: 'light-dark(#054ea8, #60a5fa)', bg: 'rgba(96,165,250,0.12)' },
  interview: { label: '取材待ち', color: 'light-dark(#aa4e03, #fb923c)', bg: 'rgba(251,146,60,0.12)' },
  review: { label: 'レビュー待ち', color: 'light-dark(#5704a9, #c084fc)', bg: 'rgba(192,132,252,0.12)' },
  published: { label: '公開済み', color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  skip: { label: 'スキップ', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

const CATEGORY_OPTIONS_FALLBACK = ['トレンド', 'Tips / Learn', 'SEKKEIYA', 'S.Layout', 'S.Model', 'S.Slide', 'AI News', 'Workflow', 'Desktop'];

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
  targetWeekLabel?: string; note?: string;
  status: string; [k: string]: unknown;
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
  /** 「概要・分析・戦略」内に埋め込むとき true: 外側のスクロール枠・ページ見出しを省く。 */
  embedded?: boolean;
}

export const OfficialContentStrategy: React.FC<OfficialContentStrategyProps> = ({ onOpenArticle, embedded }) => {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [articles, setArticles] = useState<ArticleLite[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(CATEGORY_OPTIONS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [aiLog, setAiLog] = useState('');
  const [modelText, setModelText] = useState('gemini-2.5-flash');
  const [modelImage, setModelImage] = useState('nanobanana');
  const [savingModels, setSavingModels] = useState(false);
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  // 直近に生成した記事（トピック→ワンクリックでレビューへジャンプする導線用）
  const [lastGenerated, setLastGenerated] = useState<{ id: string; title: string; interviewCount: number } | null>(null);
  // 🛠 開発アップデート記事（開発内容メモ → AIが洗って記事化）
  const [devNotes, setDevNotes] = useState('');
  const [devKind, setDevKind] = useState<'update' | 'howto' | 'notice'>('update');
  const [devCategory, setDevCategory] = useState('お知らせ');
  const [devFocus, setDevFocus] = useState('');
  const [devGenerating, setDevGenerating] = useState(false);
  const [form, setForm] = useState({ keyword: '', category: 'SEKKEIYA', targetWeekOffset: 0 as number, note: '' });
  const [confirm, setConfirm] = useState<{ msg: string; onOk: () => void | Promise<void> } | null>(null);
  const [toast, setToast] = useState<{ msg: string; sev: Sev } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [topicSnap, articleSnap] = await Promise.all([
        getDocs(query(collection(db, 'topicQueue'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'officialArticles'), orderBy('updatedAt', 'desc'))),
      ]);
      setTopics(topicSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      setArticles(articleSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
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

  // AI投稿計画: SEKKEIYAの状況＋運営戦略を分析し、記事案をトピックキューへ投入（4週間に分散）。
  const suggestTopicsAI = async () => {
    setSuggesting(true); setAiLog('SEKKEIYAの状況と戦略から投稿計画を作成中...');
    try {
      const plan = httpsCallable(functions, 'planBlogContent');
      const r: any = await plan({ scope: 'official', count: 6, devNotes: devNotes.trim() || undefined });
      if (r.data?.success && Array.isArray(r.data.topics) && r.data.topics.length) {
        const topicsOut: any[] = r.data.topics;
        for (let i = 0; i < topicsOut.length; i++) {
          const t = topicsOut[i];
          const offset = Math.min(3, Math.floor(i / 2)); // 2件/週で4週に分散
          const start = getWeekStart(offset);
          await addDoc(collection(db, 'topicQueue'), {
            keyword: String(t.topic || '').trim(),
            category: String(t.category || 'SEKKEIYA').trim(),
            targetWeekOffset: offset,
            targetWeekStart: start,
            targetWeekLabel: getWeekLabel(start),
            note: [t.angle, t.rationale].filter(Boolean).join(' / '),
            kind: t.kind || 'promo',
            status: 'queued',
            createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        }
        setAiLog(`✅ ${topicsOut.length} 件の投稿計画をキューに追加しました。内容を確認して ⚡ で記事を生成してください。`);
      } else {
        setAiLog(`⚠️ 提案できませんでした：${r.data?.reason || '不明なエラー'}`);
      }
      void loadData();
    } catch (e: any) { setAiLog(`❌ エラー：${e.message}`); }
    setSuggesting(false);
  };

  // 🛠 開発アップデート記事を生成（開発メモ → AIがユーザー目線の記事に翻訳）
  const generateDevUpdate = async () => {
    if (devGenerating || !devNotes.trim()) return;
    setDevGenerating(true);
    setLastGenerated(null);
    setAiLog('開発内容から記事を生成中...');
    try {
      const fn = httpsCallable(functions, 'generateDevUpdateArticle');
      const r: any = await fn({ notes: devNotes.trim(), kind: devKind, category: devCategory, focus: devFocus.trim() });
      if (r.data?.success) {
        setAiLog(`✅ 完了：「${r.data.title || 'アップデート記事'}」を下書き作成しました。`);
        if (r.data.articleId) setLastGenerated({ id: r.data.articleId, title: r.data.title || 'アップデート記事', interviewCount: 0 });
        setDevNotes(''); setDevFocus('');
      } else {
        setAiLog(`⚠️ 生成できませんでした：${r.data?.reason || '不明なエラー'}`);
      }
    } catch (e: any) {
      setAiLog(`❌ エラー：${e.message}`);
    } finally {
      setDevGenerating(false);
    }
  };

  const generateForTopic = async (topic: Topic) => {
    setGeneratingId(topic.id);
    setLastGenerated(null);
    setAiLog(`「${topic.keyword}」のSEO記事を生成中...`);
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, status: 'generating' } : t)));
    try {
      const generate = httpsCallable(functions, 'generateKeywordArticle');
      const r: any = await generate({ topicId: topic.id, keyword: topic.keyword, category: topic.category, note: topic.note || '' });
      if (r.data?.success) {
        setAiLog(`✅ 完了：「${r.data.title || topic.keyword}」を下書き作成しました。`);
        // ワンクリックでレビューへジャンプできるよう、生成記事を控える
        if (r.data.articleId) setLastGenerated({ id: r.data.articleId, title: r.data.title || topic.keyword, interviewCount: Number(r.data.interviewQuestions) || 0 });
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
    <Box sx={{ flex: 1, display: 'flex', minHeight: embedded ? 160 : '50vh', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: ACCENT }} />
    </Box>
  );

  const drawerField = { '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } } as const;

  // 埋め込み時は外側のスクロール枠を持たず（親のスクロールに乗る）、上下パディングも抑える。
  const OuterBox = embedded
    ? { component: 'div' as const, sx: { width: '100%' } }
    : { component: 'div' as const, sx: { flex: 1, height: '100%', overflowY: 'auto', bgcolor: 'background.default' } };

  return (
    <Box {...OuterBox}>
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: embedded ? 0 : { xs: 2.5, md: 4 }, pb: embedded ? 2 : 8 }}>
        {/* ヘッダー（埋め込み時はセクション見出しに） */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5, flexWrap: 'wrap', gap: 1.5 }}>
          <Box>
            <Typography variant={embedded ? 'subtitle1' : 'h5'} sx={{ fontWeight: 800, color: 'var(--brand-fg)', mb: 0.25 }}>
              {embedded ? '運営ツール' : 'Content Strategy'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
              {embedded ? 'AIモデル設定・開発アップデートから記事化。AI投稿計画・記事ネタはスケジュール画面で。' : 'トピックキュー・AI記者の管理'}
            </Typography>
          </Box>
          {!embedded && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" startIcon={suggesting ? <CircularProgress size={14} sx={{ color: 'light-dark(#aa4e03, #fb923c)' }} /> : <AutoAwesomeRoundedIcon />}
              onClick={() => void suggestTopicsAI()} disabled={suggesting}
              sx={{ color: 'light-dark(#aa4e03, #fb923c)', borderColor: 'rgba(251,146,60,0.4)', textTransform: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { borderColor: '#fb923c', bgcolor: 'rgba(251,146,60,0.05)' } }}>{suggesting ? '計画を作成中…' : 'AI投稿計画'}</Button>
            <Button variant="outlined" size="small" startIcon={<AddRoundedIcon />} onClick={openAdd}
              sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2, fontWeight: 700, '&:hover': { borderColor: ACCENT, bgcolor: `${ACCENT}0d` } }}>トピックを追加</Button>
          </Stack>
          )}
        </Box>

        {aiLog && (
          <Box sx={{ mb: 2, p: 1.5, borderRadius: 2, bgcolor: 'rgba(192,132,252,0.08)', border: '1px solid rgba(192,132,252,0.25)' }}>
            <Typography variant="caption" sx={{ color: 'light-dark(#5704a9, #c084fc)', fontFamily: 'monospace' }}>{aiLog}</Typography>
          </Box>
        )}

        {/* 生成直後: ワンクリックで記事を開いてレビュー/公開へ（作成の入口を滑らかに） */}
        {lastGenerated && onOpenArticle && (
          <Box sx={{ mb: 2, p: 1.75, borderRadius: 2, bgcolor: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.35)',
            display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <CheckCircleRoundedIcon sx={{ color: '#4ade80', flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 160 }}>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--brand-fg)' }}>記事を生成しました</Typography>
              <Typography noWrap sx={{ fontSize: '0.76rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                「{lastGenerated.title}」
                {lastGenerated.interviewCount > 0 ? ` — 取材質問 ${lastGenerated.interviewCount} 件つき` : ' — レビュー待ち'}
              </Typography>
            </Box>
            <Button variant="contained" size="small" endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => { const id = lastGenerated.id; setLastGenerated(null); onOpenArticle(id); }}
              sx={{ bgcolor: '#4ade80', color: '#04331a', fontWeight: 800, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#22c55e' } }}>
              記事を開いてレビュー
            </Button>
            <IconButton size="small" onClick={() => setLastGenerated(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {/* KPI（埋め込み時は「概要・分析・戦略」の統計と重複するので省く） */}
        {!embedded && (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.5, mb: 3 }}>
          {[
            { label: '今週の投稿', value: thisWeekCount, icon: <CalendarMonthRoundedIcon />, color: ACCENT, sub: '公開・レビュー' },
            { label: 'レビュー待ち', value: totalReview, icon: <SmartToyRoundedIcon />, color: 'light-dark(#5704a9, #c084fc)', sub: 'AI生成・未公開' },
            { label: '公開済み記事', value: totalPublished, icon: <CheckCircleRoundedIcon />, color: '#4ade80', sub: '累計' },
            { label: '待機中ネタ', value: topics.filter((t) => t.status === 'queued').length, icon: <ScheduleRoundedIcon />, color: 'light-dark(#aa7c03, #fbbf24)', sub: 'キュー内' },
          ].map((kpi) => (
            <Box key={kpi.label} sx={{ p: 1.75, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.75 }}>
                <Box sx={{ color: kpi.color, display: 'flex', '& svg': { fontSize: 18 } }}>{kpi.icon}</Box>
                <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>{kpi.label}</Typography>
              </Stack>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--brand-fg)', lineHeight: 1 }}>{kpi.value}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)', mt: 0.4 }}>{kpi.sub}</Typography>
            </Box>
          ))}
        </Box>
        )}

        {/* AIモデル設定（コンパクト・折りたたみ。既定は現在のモデルをチップ表示のみ） */}
        <Box sx={{ mb: 3, borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Stack direction="row" alignItems="center" spacing={1} onClick={() => setModelPanelOpen((v) => !v)}
            sx={{ px: 1.75, py: 1.25, cursor: 'pointer', flexWrap: 'wrap', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.02)' } }}>
            <TuneRoundedIcon sx={{ color: 'light-dark(#5704a9, #c084fc)', fontSize: 18 }} />
            <Typography sx={{ fontWeight: 700, color: 'var(--brand-fg)', fontSize: '0.86rem' }}>AIモデル設定</Typography>
            <Chip size="small" label={TEXT_MODELS.find((m) => m.key === modelText)?.label ?? modelText}
              sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgba(192,132,252,0.12)', color: 'light-dark(#5704a9, #c084fc)' }} />
            <Chip size="small" label={IMAGE_MODELS.find((m) => m.key === modelImage)?.label ?? modelImage}
              sx={{ height: 20, fontSize: '0.68rem', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }} />
            <Box sx={{ flex: 1 }} />
            <ExpandMoreRoundedIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', transform: modelPanelOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
          </Stack>
          <Collapse in={modelPanelOpen} unmountOnExit>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'flex-end' }} sx={{ px: 1.75, pb: 1.75, pt: 0.5 }}>
              <TextField select label="文章生成モデル" size="small" value={modelText} onChange={(e) => setModelText(e.target.value)}
                sx={{ flex: 1, ...drawerField }} InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}>
                {TEXT_MODELS.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
              </TextField>
              <TextField select label="画像生成モデル" size="small" value={modelImage} onChange={(e) => setModelImage(e.target.value)}
                helperText="※画像/スライド生成は次段で連携予定" sx={{ flex: 1, ...drawerField }}
                InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} FormHelperTextProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
                {IMAGE_MODELS.map((m) => <MenuItem key={m.key} value={m.key}>{m.label}</MenuItem>)}
              </TextField>
              <Button variant="contained" onClick={() => void saveAiModels()} disabled={savingModels}
                startIcon={savingModels ? <CircularProgress size={16} sx={{ color: '#000' }} /> : <CheckCircleRoundedIcon />}
                sx={{ bgcolor: '#c084fc', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#a855f7' } }}>保存</Button>
            </Stack>
          </Collapse>
        </Box>

        {/* 🛠 開発アップデートから記事を生成（AIが開発状況を洗って記事化） */}
        <Box sx={{ mb: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.25)' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
            <BuildRoundedIcon sx={{ color: ACCENT }} />
            <Typography sx={{ fontWeight: 800, color: 'var(--brand-fg)' }}>開発アップデートから記事を生成</Typography>
            <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.75rem' }}>最近の変更点を貼り付け → AIがユーザー目線の記事に翻訳</Typography>
          </Stack>
          <TextField
            value={devNotes} onChange={(e) => setDevNotes(e.target.value)} fullWidth multiline minRows={4} size="small"
            placeholder={'最近の開発内容・変更点・コミットの要約を貼り付け…\n例:\n- S.BlogにSEO自動最適化を追加（スラッグ/メタ説明/タグ提案）\n- 記事の公開ページを sekkeiya.com/{user}/blog/{slug} に対応\n- 公式ブログのAI記者に開発アップデート記事モードを追加'}
            sx={{ ...drawerField, mb: 1.5, '& textarea': { fontSize: '0.82rem', lineHeight: 1.7 } }} InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <TextField select label="記事タイプ" size="small" value={devKind} onChange={(e) => setDevKind(e.target.value as any)}
              sx={{ width: { xs: '100%', sm: 190 }, ...drawerField }} InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}>
              <MenuItem value="update">新機能・アップデート紹介</MenuItem>
              <MenuItem value="howto">使い方・活用ガイド</MenuItem>
              <MenuItem value="notice">お知らせ</MenuItem>
            </TextField>
            <TextField select label="カテゴリ" size="small" value={devCategory} onChange={(e) => setDevCategory(e.target.value)}
              sx={{ width: { xs: '100%', sm: 170 }, ...drawerField }} InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}>
              {categoryOptions.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="切り口・強調点（任意）" size="small" value={devFocus} onChange={(e) => setDevFocus(e.target.value)}
              placeholder="例: 設計者の時短にどう効くか" sx={{ flex: 1, ...drawerField }} InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} />
            <Button variant="contained" onClick={() => void generateDevUpdate()} disabled={devGenerating || !devNotes.trim()}
              startIcon={devGenerating ? <CircularProgress size={16} sx={{ color: '#001018' }} /> : <AutoAwesomeRoundedIcon />}
              sx={{ bgcolor: ACCENT, color: '#001018', fontWeight: 700, textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#0ea5e9' } }}>
              {devGenerating ? '生成中…' : '記事を生成'}
            </Button>
          </Stack>
        </Box>

        {/* 4週間カレンダー（埋め込み時はスケジュール画面と重複するため非表示） */}
        {!embedded && (<>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'var(--brand-fg)', mb: 1.5 }}>
          <CalendarMonthRoundedIcon sx={{ fontSize: 17, mr: 0.75, verticalAlign: 'middle', color: ACCENT }} />4週間カレンダー
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5, mb: 3.5 }}>
          {weeks.map((week) => (
            <Box key={week.offset} sx={{ p: 2, borderRadius: 2, bgcolor: week.offset === 0 ? `${ACCENT}0f` : 'rgb(var(--brand-fg-rgb) / 0.03)', border: `1px solid ${week.offset === 0 ? `${ACCENT}40` : 'rgb(var(--brand-fg-rgb) / 0.07)'}` }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: week.offset === 0 ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                  {week.offset === 0 ? '今週' : `+${week.offset}週`}　{week.label}
                </Typography>
                <Chip label={`${week.articles.length + week.topics.length}件`} size="small" sx={{ fontSize: '0.68rem', height: 18, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)', color: 'rgb(var(--brand-fg-rgb) / 0.5)' }} />
              </Stack>
              <Stack spacing={0.75}>
                {week.articles.map((a) => (
                  <Box key={a.id} onClick={() => openArticle(a.id)}
                    sx={{ p: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: a.status === 'published' ? 'rgba(74,222,128,0.08)' : a.status === 'interview' ? 'rgba(251,146,60,0.08)' : 'rgba(192,132,252,0.08)', border: `1px solid ${a.status === 'published' ? 'rgba(74,222,128,0.2)' : a.status === 'interview' ? 'rgba(251,146,60,0.2)' : 'rgba(192,132,252,0.2)'}`, '&:hover': { filter: 'brightness(1.3)' } }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--brand-fg)', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.status === 'published' ? '✅ ' : a.status === 'interview' ? '🎤 ' : '🤖 '}{a.title}
                    </Typography>
                  </Box>
                ))}
                {week.topics.map((t) => (
                  <Box key={t.id} onClick={() => openEdit(t)}
                    sx={{ p: 0.75, borderRadius: 1, cursor: 'pointer', bgcolor: 'rgba(251,191,36,0.06)', border: '1px dashed rgba(251,191,36,0.25)', '&:hover': { bgcolor: 'rgba(251,191,36,0.12)' } }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'light-dark(#aa7c03, #fbbf24)', lineHeight: 1.3 }}>📌 {t.keyword}</Typography>
                  </Box>
                ))}
                {week.articles.length + week.topics.length === 0 && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.2)', py: 0.5 }}>予定なし</Typography>
                )}
              </Stack>
            </Box>
          ))}
        </Box>
        </>)}

        {/* 記事ネタ（作成待ち）。埋め込み時（戦略タブ）はスケジュール画面へ誘導し、一覧は二重表示しない */}
        {embedded ? (
          <Box sx={{ p: 2, borderRadius: 2, bgcolor: `${ACCENT}0d`, border: `1px solid ${ACCENT}33`, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <ScheduleRoundedIcon sx={{ color: ACCENT }} />
            <Typography sx={{ flex: 1, minWidth: 180, fontSize: '0.82rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>
              起こした記事ネタの一覧・記事化（⚡）は「スケジュール」画面の右側「記事ネタ（作成待ち）」で行えます。
            </Typography>
          </Box>
        ) : (<>
        {/* 記事ネタ（作成待ち） */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'var(--brand-fg)' }}>
            <ScheduleRoundedIcon sx={{ fontSize: 17, mr: 0.75, verticalAlign: 'middle', color: 'light-dark(#aa7c03, #fbbf24)' }} />記事ネタ（作成待ち）
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>狙う検索KWを追加 → ⚡でSEO記事を生成 → レビュー待ちへ</Typography>
        </Stack>
        <Box sx={{ borderRadius: 2, border: '1px solid rgb(var(--brand-fg-rgb) / 0.07)', overflow: 'hidden' }}>
          {topics.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.3)', mb: 2 }}>トピックがまだありません</Typography>
              <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={openAdd} sx={{ color: ACCENT, borderColor: `${ACCENT}66`, textTransform: 'none', borderRadius: 2 }}>最初のトピックを追加</Button>
            </Box>
          ) : topics.map((topic, i) => {
            const sc = TOPIC_STATUS[topic.status] || TOPIC_STATUS.queued;
            return (
              <Box key={topic.id} onClick={() => openEdit(topic)} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: 'pointer', borderBottom: i < topics.length - 1 ? '1px solid rgb(var(--brand-fg-rgb) / 0.05)' : 'none', '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)' } }}>
                <Chip label={sc.label} size="small" sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 700, border: `1px solid color-mix(in srgb, ${sc.color} 20%, transparent)`, fontSize: '0.7rem', minWidth: 90 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.keyword}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{topic.category}</Typography>
                    {topic.targetWeekLabel && <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)' }}>📅 {topic.targetWeekLabel}</Typography>}
                    {topic.note && <Typography sx={{ fontSize: '0.72rem', color: 'rgb(var(--brand-fg-rgb) / 0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>💬 {topic.note}</Typography>}
                  </Stack>
                </Box>
                <TextField select size="small" value={topic.status} onClick={(e) => e.stopPropagation()} onChange={(e) => void handleStatusChange(topic, e.target.value)}
                  sx={{ width: 120, '& .MuiOutlinedInput-root': { fontSize: '0.78rem', color: sc.color, '& fieldset': { borderColor: `color-mix(in srgb, ${sc.color} 27%, transparent)` } } }}>
                  {Object.entries(TOPIC_STATUS).map(([v, { label }]) => <MenuItem key={v} value={v} sx={{ fontSize: '0.82rem' }}>{label}</MenuItem>)}
                </TextField>
                <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                  {/* 生成済みトピックは記事へジャンプ（レビュー/公開） */}
                  {onOpenArticle && typeof topic.generatedArticleId === 'string' && topic.generatedArticleId && (
                    <Tooltip title="生成した記事を開く（レビュー・公開）">
                      <IconButton size="small" onClick={() => onOpenArticle(topic.generatedArticleId as string)}
                        sx={{ color: '#4ade80', bgcolor: 'rgba(74,222,128,0.1)', '&:hover': { bgcolor: 'rgba(74,222,128,0.2)' } }}>
                        <LaunchRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title={typeof topic.generatedArticleId === 'string' && topic.generatedArticleId ? 'このキーワードで記事を再生成' : 'このキーワードでSEO記事を生成'}>
                    <span>
                      <IconButton size="small" onClick={() => void generateForTopic(topic)} disabled={generatingId === topic.id || topic.status === 'generating'}
                        sx={{ color: 'light-dark(#5704a9, #c084fc)', bgcolor: 'rgba(192,132,252,0.1)', '&:hover': { bgcolor: 'rgba(192,132,252,0.2)' }, '&:disabled': { color: 'light-dark(rgba(87,4,169,0.4), rgba(192,132,252,0.4))' } }}>
                        {generatingId === topic.id ? <CircularProgress size={16} sx={{ color: 'light-dark(#5704a9, #c084fc)' }} /> : <BoltRoundedIcon fontSize="small" />}
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
        </>)}
      </Box>

      {/* トピック追加/編集 Drawer */}
      <Drawer anchor="right" open={dialogOpen} onClose={() => setDialogOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, bgcolor: 'var(--brand-surface)', borderLeft: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', color: 'var(--brand-fg)' } }}>
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.07)' }}>
          <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 800, fontSize: '1.05rem' }}>{editTopic ? 'トピックを編集' : 'トピックを追加'}</Typography>
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
              placeholder="GSCで上位を狙いたい理由、参考URLなど" InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }} sx={drawerField} />
            {editTopic && (
              <Button onClick={() => { setConfirm({ msg: 'このトピックを削除しますか？', onOk: () => handleDelete(editTopic.id) }); setDialogOpen(false); }} startIcon={<DeleteOutlineRoundedIcon />}
                sx={{ color: '#ef4444', textTransform: 'none', justifyContent: 'flex-start', mt: 1 }}>このトピックを削除</Button>
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
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', minWidth: 380, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>確認</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>{confirm?.msg}</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={async () => { const c = confirm; setConfirm(null); await c?.onOk(); }} variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
