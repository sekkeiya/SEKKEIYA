import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Button, CircularProgress, Chip, IconButton, Paper, Tooltip,
  Checkbox, TextField, InputAdornment, Select, FormControl, MenuItem, Menu, ListItemIcon,
  Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  FormControlLabel,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { httpsCallable } from 'firebase/functions';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { functions, db } from '../../lib/firebase/client';
import { DEFAULT_SOURCE_SITES } from './types';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import FirstPageRoundedIcon from '@mui/icons-material/FirstPageRounded';
import LastPageRoundedIcon from '@mui/icons-material/LastPageRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { useDsbStore } from './store/useDsbStore';
import { useAuthStore } from '../../store/useAuthStore';
import { DsbEditor } from './DsbEditor';
import { BlogNewsFeed } from './BlogNewsFeed';
import { BlogSourcesView } from './BlogSourcesView';
import { BlogSummary } from './BlogSummary';
import { BlogScheduleView } from './BlogScheduleView';
import { BlogCategoryManager } from './BlogCategoryManager';
import { BlogCategoryInspector } from './BlogCategoryInspector';
import { BlogCategoryStrategist } from './BlogCategoryStrategist';
import { BlogArticleInspector } from './BlogArticleInspector';
import { BRAND } from '../../styles/theme';
import type { BlogArticle, BlogStatus } from './types';

const ACCENT = '#e57373';

// 状況バッジ（サイト管理画面の StatusBadge に倣う）。
const STATUS_META: Record<BlogStatus, { label: string; color: string; bg: string }> = {
  published: { label: '公開', color: 'light-dark(#357838, #81c784)', bg: 'rgba(67,160,71,0.18)' },
  draft: { label: '下書き', color: 'rgb(var(--brand-fg-rgb) / 0.6)', bg: 'rgb(var(--brand-fg-rgb) / 0.08)' },
};
const StatusBadge: React.FC<{ status: BlogStatus }> = ({ status }) => {
  const m = STATUS_META[status];
  return (
    <Chip
      label={m.label} size="small"
      icon={status === 'published' ? <PublicRoundedIcon sx={{ fontSize: '0.8rem !important', color: `${m.color} !important` }} /> : undefined}
      sx={{ height: 20, fontSize: '0.68rem', fontWeight: 800, color: m.color, bgcolor: m.bg, border: `1px solid color-mix(in srgb, ${m.color} 20%, transparent)`, '& .MuiChip-icon': { ml: 0.5 } }}
    />
  );
};

const fmtDateTime = (iso?: string): string => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('ja-JP', { year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

type FilterKey = 'all' | BlogStatus;
type SortKey = 'title' | 'updated';
type SortDir = 'asc' | 'desc';
const PAGE_SIZE = 20;
// テーブルの列グリッド（チェック / タイトル / 状況 / カテゴリ / 公開先 / 更新日時 / 操作）
const COLS = '34px minmax(150px, 1.8fr) 76px 100px 110px 124px 92px';

interface DsbDashboardProps {
  payload?: { projectId?: string; workspaceName?: string };
}

export const DsbDashboard: React.FC<DsbDashboardProps> = () => {
  const {
    articles, loading, mode, view,
    search, setSearch, statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter, loadCategories,
    refresh, startNew, startEdit, saveDraft, remove, updateDraft, categories,
  } = useDsbStore();

  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const displayName = useAuthStore((s: any) => s.currentUser?.displayName as string | undefined);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: 'success' | 'error' | 'info' } | null>(null);

  // 🔁 リロード復帰: 編集中（AI議論中含む）にリロード/クラッシュで飛んだ場合、
  // DsbEditor が残した localStorage フラグから直前の下書きを自動で開き直す。
  // （正常に閉じた場合はフラグがアンマウント時に消えるので発動しない）
  const restoreTriedRef = React.useRef(false);
  useEffect(() => {
    if (restoreTriedRef.current || mode === 'edit' || articles.length === 0) return;
    restoreTriedRef.current = true;
    try {
      const id = localStorage.getItem('dsb-editing-draft');
      if (!id) return;
      if (articles.some((a) => a.id === id)) {
        startEdit(id);
        setToast({ msg: '編集途中の記事を復元しました（AIとの議論も保存されています）', sev: 'info' });
      } else {
        localStorage.removeItem('dsb-editing-draft'); // 消えた下書きのフラグは掃除
      }
    } catch { /* noop */ }
  }, [articles, mode, startEdit]);

  // 「AIで書く」: テーマ入力 → AIが下書き＋議論の口火を生成 → エディタ（議論パネル付き）へ
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTheme, setAiTheme] = useState('');
  const [aiDrafting, setAiDrafting] = useState(false);

  // SEO×あなたの過去記事から、AIがテーマを戦略的に提案
  type AiTopicSuggestion = { theme: string; category: string; keyword: string; why: string };
  const [aiSuggestions, setAiSuggestions] = useState<AiTopicSuggestion[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  // Webから題材記事を収集（①テーマで検索 / ②おすすめサイトの最新記事）→ 選んだ記事を下書きの題材にする
  type AiSourceRef = { title: string; url: string; source?: string; date?: string; summary?: string };
  const [aiSources, setAiSources] = useState<AiSourceRef[]>([]);
  const [aiSelectedSources, setAiSelectedSources] = useState<Set<number>>(new Set());
  const [aiFetchingSources, setAiFetchingSources] = useState(false);
  const [aiActiveSite, setAiActiveSite] = useState<string>(''); // 選択中のおすすめサイト名（表示用）
  const [saveToLibrary, setSaveToLibrary] = useState(true);     // 題材をS.Libraryに保存（Desktopのみ有効）

  const handleFetchSources = async () => {
    const q = aiTheme.trim();
    if (!q || aiFetchingSources) return;
    setAiActiveSite('');
    setAiFetchingSources(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'sources', query: q });
      if (r.data?.success && Array.isArray(r.data.sources) && r.data.sources.length) {
        setAiSources(r.data.sources);
        setAiSelectedSources(new Set(r.data.sources.slice(0, 3).map((_: any, i: number) => i))); // 上位3件を既定選択
      } else {
        setToast({ msg: r.data?.reason || 'Web記事が見つかりませんでした', sev: 'info' });
      }
    } catch (e: any) {
      setToast({ msg: `Web記事の取得に失敗しました: ${e.message}`, sev: 'error' });
    } finally {
      setAiFetchingSources(false);
    }
  };

  // おすすめサイトの最新記事を取得（テーマ入力不要）
  const handlePickSite = async (site: { name: string; feed: string }) => {
    if (aiFetchingSources) return;
    setAiActiveSite(site.name);
    setAiFetchingSources(true);
    setAiSources([]);
    setAiSelectedSources(new Set());
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'sources', siteFeed: site.feed, siteName: site.name, query: aiTheme.trim() });
      if (r.data?.success && Array.isArray(r.data.sources) && r.data.sources.length) {
        setAiSources(r.data.sources);
        setAiSelectedSources(new Set([0])); // 先頭を既定選択
      } else {
        setToast({ msg: r.data?.reason || `${site.name}の記事を取得できませんでした`, sev: 'info' });
      }
    } catch (e: any) {
      setToast({ msg: `${site.name}の取得に失敗しました: ${e.message}`, sev: 'error' });
    } finally {
      setAiFetchingSources(false);
    }
  };

  const toggleSource = (i: number) => {
    setAiSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleSuggestThemes = async () => {
    if (aiSuggesting) return;
    setAiSuggesting(true);
    try {
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'suggest', count: 5, authorName: displayName || '', categories });
      if (r.data?.success && Array.isArray(r.data.topics)) {
        setAiSuggestions(r.data.topics);
      } else {
        setToast({ msg: `テーマ提案に失敗しました: ${r.data?.reason || '不明なエラー'}`, sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: `テーマ提案に失敗しました: ${e.message}`, sev: 'error' });
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleAiDraft = async () => {
    const theme = aiTheme.trim();
    const chosenSources = aiSources.filter((_, i) => aiSelectedSources.has(i));
    // テーマ入力 or 題材記事のどちらかがあれば下書きできる
    if ((!theme && chosenSources.length === 0) || !uid || aiDrafting) return;
    setAiDrafting(true);
    try {
      // 選んだ題材をS.Libraryに保存（bookmarkInbox 経由。Desktopアプリが回収して
      // ローカルS.Libraryへ＝HTMLスナップショット＋分類＋RAG登録。/clip と同じ入口）
      if (saveToLibrary && chosenSources.length) {
        void Promise.all(chosenSources.map((s) =>
          addDoc(collection(db, 'bookmarkInbox'), {
            ownerId: uid,
            url: s.url,
            title: s.title || s.url,
            ogImage: '',
            selection: s.summary || '',
            favicon: '',
            status: 'pending',
            source: 'sblog-source',
            createdAt: serverTimestamp(),
          }),
        )).catch((e) => console.warn('[DsbDashboard] S.Library queue failed', e));
      }
      const fn = httpsCallable(functions, 'blogDialogue');
      const r: any = await fn({ mode: 'draft', theme, authorName: displayName || '', categories, sourceRefs: chosenSources });
      if (r.data?.success) {
        startNew(uid, displayName, categoryFilter ?? undefined);
        updateDraft({
          title: r.data.title || theme,
          excerpt: r.data.excerpt || '',
          bodyMarkdown: r.data.bodyMarkdown || '',
          tags: Array.isArray(r.data.tags) ? r.data.tags : [],
          ...(r.data.category ? { category: r.data.category } : {}),
          sourceRefs: chosenSources.length ? chosenSources : null,
          aiDialogue: r.data.opener?.text
            ? [{
                role: 'ai' as const,
                text: r.data.opener.points?.length
                  ? `${r.data.opener.text}\n\n論点の候補:\n${r.data.opener.points.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}`
                  : r.data.opener.text,
                ts: new Date().toISOString(),
              }]
            : [],
        });
        setAiDialogOpen(false);
        setAiTheme('');
        setAiSources([]);
        setAiSelectedSources(new Set());
        setAiActiveSite('');
        const savedNote = (saveToLibrary && chosenSources.length) ? '（題材はS.Libraryに保存しました）' : '';
        setToast({ msg: `AIが下書きを作成しました。右の「AIと議論」であなたの考えを反映できます。${savedNote}`, sev: 'success' });
      } else {
        setToast({ msg: `下書き生成に失敗しました: ${r.data?.reason || '不明なエラー'}`, sev: 'error' });
      }
    } catch (e: any) {
      setToast({ msg: `下書き生成に失敗しました: ${e.message}`, sev: 'error' });
    } finally {
      setAiDrafting(false);
    }
  };

  // 一覧テーブルのローカル状態（並べ替え / 選択 / ページング / メニュー / 一括操作 / 確認）。
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkAction, setBulkAction] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  // 行クリックで選択 → 右インスペクターでその記事の設定を編集。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // カテゴリ管理ビューで選択中のカテゴリ（右インスペクターで編集）。
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => Promise<void> } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (uid) { refresh(uid); loadCategories(uid); } }, [uid, refresh, loadCategories]);
  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, sortBy, sortDir]);

  // 状況別件数（タブ表示用）。
  const counts = useMemo(() => {
    const c = { all: articles.length, draft: 0, published: 0 } as Record<FilterKey, number>;
    articles.forEach((a) => { c[a.status]++; });
    return c;
  }, [articles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = articles.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '', 'ja') * dir;
      return (a.updatedAt || '').localeCompare(b.updatedAt || '') * dir;
    });
  }, [articles, search, statusFilter, categoryFilter, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageIds = pageItems.map((a) => a.id);
  const allChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someChecked = pageIds.some((id) => selected.has(id));

  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const handleSave = async () => {
    if (!uid) return;
    setSaving(true);
    try {
      const res = await saveDraft(uid);
      if (res.published && res.knowledgeSynced) {
        setToast({ msg: '公開しました（S.Library に登録・Chat / 検索に連携）', sev: 'success' });
      } else if (res.published && !res.knowledgeSynced) {
        setToast({ msg: '公開しました（S.Library に登録。検索連携は失敗）', sev: 'info' });
      } else {
        setToast({ msg: '下書きを保存しました', sev: 'success' });
      }
    } catch (e) {
      console.error(e);
      setToast({ msg: '保存に失敗しました', sev: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const deleteOne = async (id: string) => {
    if (!uid) return;
    await remove(uid, id);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await confirm.onConfirm();
      setConfirm(null);
      setToast({ msg: '削除しました', sev: 'info' });
    } catch (e) {
      console.error(e);
      setToast({ msg: '削除に失敗しました', sev: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const applyBulk = () => {
    const ids = [...selected];
    if (bulkAction !== 'delete' || ids.length === 0) return;
    setConfirm({
      title: '一括削除',
      message: `${ids.length} 件の記事を削除します。この操作は取り消せません。`,
      confirmLabel: '削除する',
      onConfirm: async () => {
        for (const id of ids) await deleteOne(id).catch(() => {});
        setSelected(new Set());
        setBulkAction('');
      },
    });
  };

  if (mode === 'edit') {
    return (
      <>
        <DsbEditor uid={uid} saving={saving} onSave={handleSave} onToast={(msg, sev) => setToast({ msg, sev })} />
        <Snackbar
          open={!!toast}
          autoHideDuration={3000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
        </Snackbar>
      </>
    );
  }
  if (view === 'feed') {
    // ホーム = おすすめメディアの最新記事フィード（議論ファーストの入口）
    return <BlogNewsFeed />;
  }
  if (view === 'sources') {
    // ソース記事 = ホームに表示するメディア（RSSソース）の選択画面
    return <BlogSourcesView />;
  }
  if (view === 'overview') {
    return <BlogSummary source={{ kind: 'account' }} />;
  }
  if (view === 'schedule' || view === 'plan') {
    // スケジュール = 投稿カレンダー（タスクなし・月/リスト・AI投稿計画）。plan は旧IDの後方互換。
    return <BlogScheduleView />;
  }
  if (view === 'categories') {
    const selCat = selectedCategory;
    return (
      <Box sx={{ flex: 1, height: '100%', display: 'flex', bgcolor: 'background.default', overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
            {/* タイトルは全幅ヘッダーバンドへ移設 */}
            <BlogCategoryStrategist categories={categories} />
            <BlogCategoryManager selectedName={selCat} onSelect={setSelectedCategory} />
          </Box>
        </Box>
        {selCat && (
          <BlogCategoryInspector
            name={selCat}
            uid={uid}
            onClose={() => setSelectedCategory(null)}
            onRenamed={(n) => setSelectedCategory(n)}
            onOpenArticle={(id) => startEdit(id)}
          />
        )}
      </Box>
    );
  }

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'すべて' }, { key: 'published', label: '公開済み' }, { key: 'draft', label: '下書き' },
  ];
  const SortHead: React.FC<{ k: SortKey; label: string }> = ({ k, label }) => (
    <Box onClick={() => { if (sortBy === k) setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(k); setSortDir('asc'); } }}
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', color: sortBy === k ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.55)', '&:hover': { color: 'var(--brand-fg)' } }}>
      {label}{sortBy === k && (sortDir === 'asc' ? <ArrowUpwardRoundedIcon sx={{ fontSize: '0.85rem' }} /> : <ArrowDownwardRoundedIcon sx={{ fontSize: '0.85rem' }} />)}
    </Box>
  );
  const cell = { display: 'flex', alignItems: 'center', minWidth: 0 } as const;
  const targetLabel = (a: BlogArticle) =>
    a.publishTarget.scope === 'account' ? 'アカウント' : (a.publishTarget.projectName ?? `PJ: ${a.publishTarget.projectId}`);

  const selectedArticle = selectedId ? (articles.find((a) => a.id === selectedId) ?? null) : null;

  return (
    <Box sx={{ flex: 1, height: '100%', display: 'flex', bgcolor: 'background.default', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 1120, mx: 'auto', width: '100%', p: { xs: 2.5, md: 4 } }}>
        {/* アクション行（タイトルは全幅ヘッダーバンドへ移設。カテゴリ絞り込みチップと執筆ボタンを残す） */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {categoryFilter && (
              <Chip label={`カテゴリ: ${categoryFilter}`} size="small" onDelete={() => setCategoryFilter(null)}
                sx={{ height: 24, fontSize: '0.72rem', fontWeight: 700, color: ACCENT, bgcolor: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`, '& .MuiChip-deleteIcon': { color: `${ACCENT}aa`, fontSize: '0.95rem', '&:hover': { color: ACCENT } } }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Button variant="outlined" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => setAiDialogOpen(true)}
              sx={{ color: 'light-dark(#921b1b, #e57373)', borderColor: 'rgba(229,115,115,0.45)', textTransform: 'none', fontWeight: 700,
                '&:hover': { borderColor: '#e57373', bgcolor: 'rgba(229,115,115,0.08)' } }}>
              AIで書く
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => uid && startNew(uid, displayName, categoryFilter ?? undefined)}
              sx={{ bgcolor: ACCENT, color: '#191815', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef9a9a' } }}>
              新規記事
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: ACCENT }} /></Box>
        ) : (
          <>
            {/* 状況タブ＋検索（WP 風） */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                {TABS.map((t, i) => (
                  <React.Fragment key={t.key}>
                    {i > 0 && <Box sx={{ width: '1px', height: 12, bgcolor: BRAND.line, mx: 1 }} />}
                    <Box onClick={() => setStatusFilter(t.key)} sx={{ cursor: 'pointer', fontSize: '0.82rem', fontWeight: statusFilter === t.key ? 800 : 500, color: statusFilter === t.key ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)' } }}>
                      {t.label} <Box component="span" sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>({counts[t.key]})</Box>
                    </Box>
                  </React.Fragment>
                ))}
              </Box>
              <TextField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="記事を検索" size="small"
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: '1.05rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} /></InputAdornment>, sx: { color: 'var(--brand-fg)', fontSize: '0.82rem' } }}
                sx={{ width: 230, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }} />
            </Box>

            {/* 一括操作バー＋件数・ページ */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select value={bulkAction} displayEmpty onChange={(e) => setBulkAction(e.target.value)}
                    sx={{ color: 'var(--brand-fg)', fontSize: '0.8rem', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)', borderRadius: 2, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '& .MuiSvgIcon-root': { color: 'rgb(var(--brand-fg-rgb) / 0.5)' } }}
                    MenuProps={{ slotProps: { paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)' } } } }}>
                    <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>一括操作</MenuItem>
                    <MenuItem value="delete" sx={{ fontSize: '0.8rem' }}>記事を削除</MenuItem>
                  </Select>
                </FormControl>
                <Button size="small" onClick={applyBulk} disabled={!bulkAction || selected.size === 0}
                  sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.8)', textTransform: 'none', border: `1px solid ${BRAND.line}`, borderRadius: 1.5, '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.25)' } }}>
                  適用{selected.size > 0 ? ` (${selected.size})` : ''}
                </Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.78rem', mr: 1 }}>{filtered.length} 件</Typography>
                <IconButton size="small" disabled={page <= 1} onClick={() => setPage(1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><FirstPageRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><ChevronLeftRoundedIcon fontSize="small" /></IconButton>
                <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.78rem', minWidth: 56, textAlign: 'center' }}>{page} / {pageCount}</Typography>
                <IconButton size="small" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><ChevronRightRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" disabled={page >= pageCount} onClick={() => setPage(pageCount)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&.Mui-disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' } }}><LastPageRoundedIcon fontSize="small" /></IconButton>
              </Box>
            </Box>

            {/* テーブル */}
            <Paper sx={{ bgcolor: BRAND.panel, border: `1px solid ${BRAND.line}`, borderRadius: 2, overflow: 'hidden' }}>
              {/* ヘッダ行 */}
              <Box sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, borderBottom: `1px solid ${BRAND.line}`, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.03)', fontSize: '0.76rem', fontWeight: 700, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>
                <Checkbox size="small" checked={allChecked} indeterminate={!allChecked && someChecked} onChange={toggleAll} sx={{ p: 0, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&.Mui-checked': { color: ACCENT }, '&.MuiCheckbox-indeterminate': { color: ACCENT } }} />
                <Box sx={cell}><SortHead k="title" label="タイトル" /></Box>
                <Box sx={cell}>状況</Box>
                <Box sx={cell}>カテゴリ</Box>
                <Box sx={cell}>公開先</Box>
                <Box sx={cell}><SortHead k="updated" label="更新日時" /></Box>
                <Box sx={{ ...cell, justifyContent: 'flex-end' }}>操作</Box>
              </Box>

              {/* データ行 */}
              {pageItems.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center', color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: '0.85rem' }}>
                  {articles.length === 0 ? 'まだ記事がありません。「新規記事」から書き始めましょう。' : '条件に一致する記事はありません。'}
                </Box>
              ) : pageItems.map((a) => {
                const checked = selected.has(a.id);
                const isSelected = selectedId === a.id;
                return (
                  <Box key={a.id} onClick={() => setSelectedId(a.id)}
                    sx={{ display: 'grid', gridTemplateColumns: COLS, gap: 1.5, alignItems: 'center', px: 1.5, py: 1, cursor: 'pointer', borderBottom: `1px solid ${BRAND.line}`, transition: 'background 0.12s', boxShadow: isSelected ? `inset 3px 0 0 ${ACCENT}` : 'none', bgcolor: isSelected ? `${ACCENT}1f` : (checked ? `${ACCENT}14` : 'transparent'), '&:hover': { bgcolor: isSelected ? `${ACCENT}26` : 'rgb(var(--brand-fg-rgb) / 0.03)' }, '&:last-of-type': { borderBottom: 'none' } }}>
                    <Checkbox size="small" checked={checked} onClick={(e) => e.stopPropagation()} onChange={() => toggleOne(a.id)} sx={{ p: 0, color: 'rgb(var(--brand-fg-rgb) / 0.35)', '&.Mui-checked': { color: ACCENT } }} />
                    {/* タイトル */}
                    <Box sx={{ ...cell, gap: 1.25 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.05)', border: `1px solid ${BRAND.line}` }}>
                        <ArticleRoundedIcon sx={{ fontSize: '1rem', color: ACCENT }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontWeight: 700, color: isSelected ? ACCENT : 'var(--brand-fg)', fontSize: '0.86rem' }}>{a.title || '(無題)'}</Typography>
                        <Typography noWrap sx={{ fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{a.excerpt || a.bodyMarkdown.slice(0, 60) || '本文なし'}</Typography>
                      </Box>
                    </Box>
                    {/* 状況 */}
                    <Box sx={cell}><StatusBadge status={a.status} /></Box>
                    {/* カテゴリ */}
                    <Box sx={cell}>
                      <Typography noWrap sx={{ fontSize: '0.76rem', color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>{a.category || '—'}</Typography>
                    </Box>
                    {/* 公開先 */}
                    <Box sx={cell}>
                      <Typography noWrap sx={{ fontSize: '0.74rem', color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{targetLabel(a)}</Typography>
                    </Box>
                    {/* 更新日時 */}
                    <Box sx={{ ...cell, color: 'rgb(var(--brand-fg-rgb) / 0.5)', fontSize: '0.74rem' }}>{fmtDateTime(a.updatedAt)}</Box>
                    {/* 操作 */}
                    <Box sx={{ ...cell, justifyContent: 'flex-end', gap: 0.25 }} onClick={(e) => e.stopPropagation()}>
                      <Tooltip title="本文を編集">
                        <IconButton size="small" onClick={() => startEdit(a.id)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.6)', '&:hover': { color: 'var(--brand-fg)' } }}><LaunchRoundedIcon sx={{ fontSize: '1.05rem' }} /></IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuId(a.id); }} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: 'var(--brand-fg)' } }}><MoreVertRoundedIcon sx={{ fontSize: '1.1rem' }} /></IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Paper>
          </>
        )}
      </Box>
      </Box>

      {/* 右インスペクター（記事を選択すると設定をその場で編集） */}
      {selectedArticle && (
        <BlogArticleInspector
          article={selectedArticle}
          uid={uid}
          onClose={() => setSelectedId(null)}
          onOpenEditor={(id) => { setSelectedId(null); startEdit(id); }}
        />
      )}

      {/* 行のケバブメニュー */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { bgcolor: 'var(--brand-surface2)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 180 } } }}>
        <MenuItem onClick={() => { if (menuId) startEdit(menuId); setMenuAnchor(null); }} sx={{ fontSize: '0.85rem' }}>
          <ListItemIcon sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', minWidth: 32 }}><EditRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>編集
        </MenuItem>
        <MenuItem onClick={() => {
          const id = menuId; setMenuAnchor(null);
          if (!id) return;
          const a = articles.find((x) => x.id === id);
          setConfirm({ title: '記事を削除', message: `「${a?.title || '(無題)'}」を削除します。この操作は取り消せません。`, confirmLabel: '削除する', onConfirm: () => deleteOne(id) });
        }} sx={{ fontSize: '0.85rem', color: 'light-dark(#a50832, #fa9bb4)' }}>
          <ListItemIcon sx={{ color: 'light-dark(#a50832, #fa9bb4)', minWidth: 32 }}><DeleteOutlineRoundedIcon sx={{ fontSize: '1.1rem' }} /></ListItemIcon>削除
        </MenuItem>
      </Menu>

      {/* 確認ダイアログ */}
      <Dialog open={!!confirm} onClose={() => !busy && setConfirm(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 420, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>{confirm?.title}</DialogTitle>
        <DialogContent><DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>{confirm?.message}</DialogContentText></DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirm(null)} disabled={busy} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={runConfirm} disabled={busy} variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>
            {busy ? '処理中...' : (confirm?.confirmLabel || 'OK')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 「AIで書く」テーマ入力 */}
      <Dialog open={aiDialogOpen} onClose={() => !aiDrafting && setAiDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgba(229,115,115,0.35)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
        <DialogTitle sx={{ fontWeight: 800, color: 'light-dark(#921b1b, #e57373)', pb: 1 }}>✨ AIで書く</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.55)', fontSize: 13, mb: 2 }}>
            テーマを入れると、AIが下書きと「議論の口火」を用意します。<br />
            そのあとAIと議論して、あなたの考えを記事に反映できます。
          </DialogContentText>
          <TextField
            autoFocus fullWidth size="small"
            placeholder="例: 小さな住宅の収納計画で大切にしていること"
            value={aiTheme}
            onChange={(e) => setAiTheme(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !(e.nativeEvent as any).isComposing) { e.preventDefault(); void handleAiDraft(); } }}
            disabled={aiDrafting}
            sx={{ '& .MuiOutlinedInput-root': { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&.Mui-focused fieldset': { borderColor: '#e57373' } } }}
          />

          {/* 🌐 Webの記事を題材にする（テーマで検索 → 選んだ記事を下書きの題材に） */}
          <Box sx={{ mt: 2 }}>
            <Button size="small" variant="outlined" onClick={() => void handleFetchSources()} disabled={!aiTheme.trim() || aiFetchingSources || aiDrafting}
              startIcon={aiFetchingSources ? <CircularProgress size={13} sx={{ color: 'light-dark(#0a5fa4, #64b5f6)' }} /> : <PublicRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ color: 'light-dark(#0a5fa4, #64b5f6)', borderColor: 'rgba(100,181,246,0.4)', textTransform: 'none', fontSize: 12,
                '&:hover': { borderColor: '#64b5f6', bgcolor: 'rgba(100,181,246,0.06)' } }}>
              {aiFetchingSources && !aiActiveSite ? 'Webから記事を検索中…' : 'Webの記事を題材にする（テーマで検索）'}
            </Button>

            {/* おすすめサイトの最新記事から選ぶ（テーマ入力不要） */}
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 0.75 }}>
                または、おすすめの建築・インテリアメディアの最新記事から選ぶ：
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6 }}>
                {DEFAULT_SOURCE_SITES.map((site) => {
                  const active = aiActiveSite === site.name;
                  return (
                    <Tooltip key={site.name} title={`${site.note}（${site.group}）`} arrow>
                      <Chip label={site.name} size="small" onClick={() => void handlePickSite(site)}
                        disabled={aiFetchingSources || aiDrafting}
                        sx={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, height: 24,
                          bgcolor: active ? '#64b5f6' : 'rgba(100,181,246,0.08)',
                          color: active ? '#000' : 'light-dark(#095fa5, #90caf9)',
                          border: `1px solid ${active ? '#64b5f6' : 'rgba(100,181,246,0.3)'}`,
                          '&:hover': { bgcolor: active ? '#64b5f6' : 'rgba(100,181,246,0.2)' } }} />
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>

            {aiSources.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 220, overflowY: 'auto' }}>
                <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
                  {aiActiveSite ? `${aiActiveSite} の記事から選択` : '題材にする記事を選択'}（{aiSelectedSources.size}件選択中）— 選んだ記事を要約・出典付きで下書きに反映します
                </Typography>
                {aiSources.map((s, i) => {
                  const on = aiSelectedSources.has(i);
                  return (
                    <Box key={i} onClick={() => !aiDrafting && toggleSource(i)}
                      sx={{ p: 1.1, borderRadius: 1.5, cursor: 'pointer', display: 'flex', gap: 1, alignItems: 'flex-start',
                        bgcolor: on ? 'rgba(100,181,246,0.1)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                        border: `1px solid ${on ? '#64b5f6' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                        '&:hover': { borderColor: 'rgba(100,181,246,0.6)' } }}>
                      <Checkbox checked={on} size="small" sx={{ p: 0, mt: 0.2, color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&.Mui-checked': { color: 'light-dark(#0a5fa4, #64b5f6)' } }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 600, fontSize: 12, lineHeight: 1.45 }}>{s.title}</Typography>
                        <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontSize: 10.5, mt: 0.25 }}>
                          {s.source || 'Web'}{s.summary ? ` — ${s.summary}` : ''}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* 題材をS.Libraryに保存（Desktopアプリが回収して原文を保存） */}
            {aiSources.length > 0 && (
              <FormControlLabel
                sx={{ mt: 1, ml: 0 }}
                control={<Checkbox size="small" checked={saveToLibrary} onChange={(e) => setSaveToLibrary(e.target.checked)}
                  sx={{ p: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.3)', '&.Mui-checked': { color: 'light-dark(#0a5fa4, #64b5f6)' } }} />}
                label={<Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                  選んだ題材をS.Libraryに保存（原文スナップショット＋Chat/検索で再利用）
                </Typography>}
              />
            )}
          </Box>

          {/* SEO×あなたの記事傾向からの戦略的テーマ提案 */}
          <Box sx={{ mt: 2 }}>
            <Button size="small" variant="outlined" onClick={() => void handleSuggestThemes()} disabled={aiSuggesting || aiDrafting}
              startIcon={aiSuggesting ? <CircularProgress size={13} sx={{ color: 'light-dark(#921b1b, #e57373)' }} /> : <AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ color: 'light-dark(#921b1b, #e57373)', borderColor: 'rgba(229,115,115,0.4)', textTransform: 'none', fontSize: 12,
                '&:hover': { borderColor: '#e57373', bgcolor: 'rgba(229,115,115,0.06)' } }}>
              {aiSuggesting ? 'あなたの記事傾向を分析中…' : 'テーマをAIに提案してもらう（SEO×あなたの記事傾向）'}
            </Button>
            {aiSuggestions.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 260, overflowY: 'auto' }}>
                {aiSuggestions.map((s, i) => {
                  const selected = aiTheme === s.theme;
                  return (
                    <Box key={i} onClick={() => !aiDrafting && setAiTheme(s.theme)}
                      sx={{ p: 1.25, borderRadius: 1.5, cursor: 'pointer',
                        bgcolor: selected ? 'rgba(229,115,115,0.14)' : 'rgb(var(--brand-fg-rgb) / 0.03)',
                        border: `1px solid ${selected ? '#e57373' : 'rgb(var(--brand-fg-rgb) / 0.1)'}`,
                        '&:hover': { borderColor: 'rgba(229,115,115,0.6)' } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ color: 'var(--brand-fg)', fontWeight: 700, fontSize: 12.5, flex: 1, minWidth: 0 }}>{s.theme}</Typography>
                        <Chip label={s.category} size="small" sx={{ height: 17, fontSize: 10, bgcolor: 'rgba(229,115,115,0.15)', color: 'light-dark(#921b1b, #e57373)' }} />
                      </Box>
                      <Typography sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.45)', fontSize: 11, mt: 0.4, lineHeight: 1.5 }}>
                        🔍 {s.keyword}{s.why ? ` — ${s.why}` : ''}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setAiDialogOpen(false)} disabled={aiDrafting} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={() => void handleAiDraft()} disabled={(!aiTheme.trim() && aiSelectedSources.size === 0) || aiDrafting} variant="contained"
            startIcon={aiDrafting ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <AutoAwesomeRoundedIcon />}
            sx={{ bgcolor: '#e57373', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#ef5350' } }}>
            {aiDrafting ? '下書きを作成中…' : '下書きを作成'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)}>{toast.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
};
