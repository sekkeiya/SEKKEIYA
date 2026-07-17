/**
 * DsbSidebar — S.Blog ダッシュボード用左サイドバー。
 * 記事はアカウント単位（users/{uid}/blogArticles）の1プールで管理する。
 * ナビゲーションは「概要・分析」「ホーム（全記事一覧）」＋カテゴリ軸。
 * 下書き/公開済みの絞り込みは一覧本体の状況タブで行うためここには置かない。
 * カテゴリはユーザーが自由に作成・改名・削除でき、ドラッグで並べ替えできる。
 * カテゴリ行クリックで配下の記事をネスト展開（下書き/公開を判別表示）。
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Box, Typography, CardActionArea, Divider, IconButton, TextField, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
} from '@mui/material';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import NewspaperRoundedIcon from '@mui/icons-material/NewspaperRounded';
import RssFeedRoundedIcon from '@mui/icons-material/RssFeedRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import KeyboardArrowRightRoundedIcon from '@mui/icons-material/KeyboardArrowRightRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../../store/useAppStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { useDsbStore } from '../../../features/dsb/store/useDsbStore';
import { useOfficialBlogStore } from '../../../features/dsb/store/useOfficialBlogStore';
import { isBlogAdmin } from '../../../features/dsb/lib/blogAdmin';
import type { BlogArticle } from '../../../features/dsb/types';
import { BRAND } from '../../../styles/theme';

const ACCENT = '#e57373';

// カテゴリ名から安定した色相を作る（小さな色ドット用）。
const hueOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

interface ScopeItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  /** 通知バッジ（締切間近など・0/未指定で非表示。count と違い注意色で表示）。 */
  badgeCount?: number;
  active: boolean;
  onClick: () => void;
  color?: string;
}

function ScopeItem({ icon, label, count, badgeCount, active, onClick, color }: ScopeItemProps) {
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgb(var(--brand-fg-rgb) / 0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || 'rgb(var(--brand-fg-rgb) / 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: 'var(--brand-fg)' } })}
        </Box>
        <Typography sx={{
          color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)',
          fontSize: 12, fontWeight: active ? 600 : 500, flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </Typography>
        {typeof count === 'number' && (
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>{count}</Typography>
        )}
        {!!badgeCount && badgeCount > 0 && (
          <Box sx={{ ml: 0.75, minWidth: 18, height: 18, px: 0.5, borderRadius: 999, bgcolor: '#e57373', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{badgeCount > 99 ? '99+' : badgeCount}</Typography>
          </Box>
        )}
      </CardActionArea>
    </Box>
  );
}

// カテゴリ配下の記事1行（インデント表示）。下書き=オレンジ鉛筆/淡色、公開=緑地球/明色で判別。
// active=現在エディタで開いている記事（左サイドバーでハイライト）。
function ArticleChild({ article, active, onClick }: { article: BlogArticle; active: boolean; onClick: () => void }) {
  const published = article.status === 'published';
  const color = published ? '#81c784' : '#ffb74d';
  return (
    <Box
      onClick={onClick}
      sx={{
        mx: 1.5, my: 0.1, pl: 4.5, pr: 1.25, py: 0.5, borderRadius: 2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 0.75,
        bgcolor: active ? `${ACCENT}26` : 'transparent',
        boxShadow: active ? `inset 2px 0 0 ${ACCENT}` : 'none',
        '&:hover': { bgcolor: active ? `${ACCENT}33` : 'rgb(var(--brand-fg-rgb) / 0.06)' },
      }}
    >
      {published
        ? <PublicRoundedIcon sx={{ fontSize: 13, color, flexShrink: 0 }} />
        : <EditNoteRoundedIcon sx={{ fontSize: 13, color, flexShrink: 0 }} />}
      <Typography sx={{
        flex: 1, minWidth: 0, fontSize: 11.5,
        color: published ? 'rgb(var(--brand-fg-rgb) / 0.78)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
        fontStyle: published ? 'normal' : 'italic',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {article.title || '(無題)'}
      </Typography>
      <Typography sx={{ fontSize: 9.5, fontWeight: 700, color, flexShrink: 0, opacity: 0.9 }}>
        {published ? '公開' : '下書き'}
      </Typography>
    </Box>
  );
}

interface CategoryRowProps {
  name: string;
  items: BlogArticle[];
  active: boolean;
  expanded: boolean;
  editing: boolean;
  editValue: string;
  onEditChange: (v: string) => void;
  onEditCommit: () => void;
  onEditCancel: () => void;
  onClick: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onOpenArticle: (id: string) => void;
  activeArticleId: string | null;
}

// ドラッグ可能なカテゴリ行＋配下の記事（展開時）。1カテゴリ＝1つのソート単位。
function SortableCategoryRow(p: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.name });
  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{ position: 'relative', zIndex: isDragging ? 10 : 'auto', opacity: isDragging ? 0.7 : 1 }}
    >
      <Box
        sx={{
          mx: 1.5, my: 0.25, pr: 0.75, py: 0.5, borderRadius: 2,
          display: 'flex', alignItems: 'center',
          bgcolor: p.active ? `${ACCENT}1f` : 'transparent',
          '&:hover': { bgcolor: p.active ? `${ACCENT}26` : 'rgb(var(--brand-fg-rgb) / 0.06)' },
          '&:hover .cat-actions': { opacity: 1 },
        }}
      >
        {/* ドラッグハンドル（左） */}
        <IconButton
          size="small" {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.28)', cursor: 'grab', '&:active': { cursor: 'grabbing' }, '&:hover': { color: 'rgb(var(--brand-fg-rgb) / 0.7)' }, flexShrink: 0 }}
        >
          <DragIndicatorRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>

        {p.editing ? (
          <TextField
            autoFocus value={p.editValue} onChange={(e) => p.onEditChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') p.onEditCommit(); if (e.key === 'Escape') p.onEditCancel(); }}
            onBlur={p.onEditCommit}
            size="small" variant="standard"
            InputProps={{ disableUnderline: false, sx: { color: 'var(--brand-fg)', fontSize: 12, '&:before': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.2)' }, '&:after': { borderColor: ACCENT } } }}
            sx={{ flex: 1, mx: 0.5 }}
          />
        ) : (
          <>
            {/* クリックで展開＋絞り込み */}
            <Box onClick={p.onClick} sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}>
              {p.expanded
                ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mr: 0.25, flexShrink: 0 }} />
                : <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mr: 0.25, flexShrink: 0 }} />}
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', mr: 1, flexShrink: 0, bgcolor: `hsl(${hueOf(p.name)},65%,62%)` }} />
              <Typography sx={{
                color: p.active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: p.active ? 700 : 500,
                flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </Typography>
            </Box>
            {/* ホバーで改名・削除 */}
            <Box className="cat-actions" sx={{ display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
              <Tooltip title="名前を変更"><IconButton size="small" onClick={(e) => { e.stopPropagation(); p.onStartRename(); }} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'var(--brand-fg)' } }}><EditRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
              <Tooltip title="削除"><IconButton size="small" onClick={(e) => { e.stopPropagation(); p.onDelete(); }} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.4)', '&:hover': { color: 'light-dark(#a50832, #fa9bb4)' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', ml: 0.5, flexShrink: 0 }}>{p.items.length}</Typography>
          </>
        )}
      </Box>

      {/* 配下の記事 */}
      {p.expanded && p.items.map((a) => (
        <ArticleChild key={a.id} article={a} active={a.id === p.activeArticleId} onClick={() => p.onOpenArticle(a.id)} />
      ))}
    </Box>
  );
}

export const DsbSidebar: React.FC = () => {
  const isProjectSidebarOpen = useAppStore((s) => s.isProjectSidebarOpen);
  const uid = useAuthStore((s: any) => s.currentUser?.uid as string | undefined);
  const currentUser = useAuthStore((s: any) => s.currentUser);
  const admin = isBlogAdmin(currentUser);
  const {
    articles, view, mode, draft, setView, categoryFilter, categories,
    setCategoryFilter, goHome, addCategory, removeCategory, renameCategory, reorderCategories,
    startEdit, cancelEdit, saveWorkingDraft, blogScope, setBlogScope,
    schedules, loadSchedules,
  } = useDsbStore();

  // 非管理者が万一 official のまま残らないよう、権限が無ければ account に戻す。
  useEffect(() => { if (!admin && blogScope !== 'account') setBlogScope('account'); }, [admin, blogScope, setBlogScope]);

  // 締切間近（予定 planned・7日以内）の件数 → スケジュールの通知バッジ（旧「今週書くもの」の代替）。
  useEffect(() => { if (uid) void loadSchedules(uid); }, [uid, loadSchedules]);
  const dueCount = useMemo(() => {
    const limit = new Date(); limit.setDate(limit.getDate() + 7);
    const week = limit.toISOString().slice(0, 10);
    return schedules.filter((s) => s.status === 'planned' && s.date <= week).length;
  }, [schedules]);

  // 公式モード用（ナビのハイライト・件数・カテゴリ節）。account モードでも購読は無害。
  const officialMode = useOfficialBlogStore((s) => s.mode);
  const officialView = useOfficialBlogStore((s) => s.view);
  const officialArticles = useOfficialBlogStore((s) => s.articles);
  const officialCategoryFilter = useOfficialBlogStore((s) => s.categoryFilter);
  const officialDraftId = useOfficialBlogStore((s) => s.draft?.id ?? null);
  const setOfficialView = useOfficialBlogStore((s) => s.setView);
  const setOfficialCategoryFilter = useOfficialBlogStore((s) => s.setCategoryFilter);
  const officialStartEdit = useOfficialBlogStore((s) => s.startEdit);
  const officialCount = officialArticles.length;

  // 公式記事をカテゴリ名でグルーピング（サイドバーのカテゴリ節。account と同じ「ネスト展開」体験）。
  const officialCategoryRows = useMemo(() => {
    const byCat = new Map<string, typeof officialArticles>();
    for (const a of officialArticles) {
      const c = (a.category?.name || '').trim();
      if (!c) continue;
      (byCat.get(c) ?? byCat.set(c, [] as typeof officialArticles).get(c)!).push(a);
    }
    for (const list of byCat.values()) {
      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'published' ? -1 : 1;
        return String(a.title || '').localeCompare(String(b.title || ''), 'ja');
      });
    }
    return [...byCat.keys()].sort((a, b) => a.localeCompare(b, 'ja')).map((name) => ({ name, items: byCat.get(name) ?? [] }));
  }, [officialArticles]);

  // エディタで開いている記事（左サイドバーのハイライト対象）。
  const activeArticleId = mode === 'edit' ? (draft?.id ?? null) : null;

  // 記事編集中に「概要・分析」「ホーム」へ移動するときは、作業中の内容を自動保存してから切り替える。
  const navAway = (go: () => void) => {
    if (mode === 'edit') { if (uid) void saveWorkingDraft(uid); cancelEdit(); }
    go();
  };

  const [adding, setAdding] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [officialExpanded, setOfficialExpanded] = useState<Set<string>>(new Set());
  const toggleOfficialExpand = (name: string) =>
    setOfficialExpanded((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; count: number } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const toggleExpand = (name: string) =>
    setExpanded((prev) => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

  // 記事を開いたら、その記事のカテゴリを自動展開してハイライトを見える状態にする。
  useEffect(() => {
    if (mode === 'edit' && draft?.category) {
      const cat = draft.category;
      setExpanded((prev) => (prev.has(cat) ? prev : new Set(prev).add(cat)));
    }
  }, [mode, draft?.id, draft?.category]);

  // 表示順 = categories 配列の順（ドラッグで永続化）＋ まだ未登録だが記事が使っているカテゴリを末尾に。
  // 各カテゴリ配下の記事は 公開→下書き、更新日時の新しい順。
  const categoryRows = useMemo(() => {
    const byCat = new Map<string, BlogArticle[]>();
    for (const a of articles) {
      const c = (a.category || '').trim();
      if (!c) continue;
      (byCat.get(c) ?? byCat.set(c, []).get(c)!).push(a);
    }
    for (const list of byCat.values()) {
      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'published' ? -1 : 1;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
    }
    const extra = [...byCat.keys()].filter((n) => !categories.includes(n)).sort((a, b) => a.localeCompare(b, 'ja'));
    const ordered = [...categories, ...extra];
    return ordered.map((name) => ({ name, items: byCat.get(name) ?? [], custom: categories.includes(name) }));
  }, [articles, categories]);

  const submitNewCat = () => {
    const n = newCat.trim();
    if (uid && n) addCategory(uid, n);
    setNewCat('');
    setAdding(false);
  };

  const startRename = (name: string) => { setEditingName(name); setEditValue(name); };
  const commitRename = () => {
    const target = editingName;
    setEditingName(null);
    if (uid && target) renameCategory(uid, target, editValue);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !uid) return;
    const names = categoryRows.map((c) => c.name);
    const from = names.indexOf(String(active.id));
    const to = names.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderCategories(uid, arrayMove(names, from, to));
  };

  return (
    <Box
      sx={{
        width: isProjectSidebarOpen ? 240 : 0,
        height: '100%',
        bgcolor: BRAND.bg,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
      }}
    >
      {/* 自分のブログ ⇄ 公式ブログ の切替は全幅ヘッダーバンド（DsbHeaderBar）へ移設。 */}

      <Box sx={{ flex: 1 }}>
        {blogScope === 'official' ? (
          /* ── 公式ブログモードのナビ（アカウントブログと項目を揃える） ── */
          <>
            {/* ホーム = ニュースフィード（公式は閲覧/インスピレーション用） */}
            <ScopeItem
              icon={<NewspaperRoundedIcon />} label="ホーム"
              active={officialMode !== 'edit' && officialView === 'feed'} onClick={() => setOfficialView('feed')} color={ACCENT}
            />
            {/* 概要・分析・戦略 */}
            <ScopeItem
              icon={<InsightsRoundedIcon />} label="概要・分析・戦略"
              active={officialMode !== 'edit' && officialView === 'overview'} onClick={() => setOfficialView('overview')} color="#ff8a65"
            />
            {/* スケジュール = プロジェクトの Schedules & Tasks（SEKKEIYA Content） */}
            <ScopeItem
              icon={<EventNoteRoundedIcon />} label="スケジュール"
              active={officialMode !== 'edit' && officialView === 'schedule'} onClick={() => setOfficialView('schedule')} color="#5c9ce6"
            />
            {/* コンテンツ戦略は「概要・分析・戦略」に集約したためサイドバー項目を廃止 */}
            {/* 記事一覧 */}
            <ScopeItem
              icon={<ArticleRoundedIcon />} label="記事一覧" count={officialCount}
              active={officialMode !== 'edit' && officialView === 'articles' && !officialCategoryFilter} onClick={() => setOfficialView('articles')} color="#607d8b"
            />
            {/* カテゴリ = カテゴリ管理 */}
            <ScopeItem
              icon={<CategoryRoundedIcon />} label="カテゴリ"
              active={officialMode !== 'edit' && officialView === 'categories'} onClick={() => setOfficialView('categories')} color="#8e7cc3"
            />

            <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

            {/* カテゴリ（記事のカテゴリ名でグルーピング。クリックで絞り込み＋ネスト展開）。
                作成・改名・削除・並べ替えは「カテゴリ」管理ビューで行う（公式カテゴリは階層型の別システム）。 */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.25, mb: 0.5 }}>
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
                カテゴリ
              </Typography>
              <Tooltip title="カテゴリを管理（追加・編集）">
                <IconButton size="small" onClick={() => setOfficialView('categories')} sx={{ p: 0.25, color: 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: '#38bdf8' } }}>
                  <AddRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>

            {officialCategoryRows.length === 0 ? (
              <Typography sx={{ px: 2.5, py: 0.5, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.3)', lineHeight: 1.6 }}>
                記事にカテゴリを設定すると、ここにまとまって表示されます。
              </Typography>
            ) : officialCategoryRows.map((c) => {
              const active = officialView === 'articles' && officialCategoryFilter === c.name;
              const isExpanded = officialExpanded.has(c.name);
              return (
                <Box key={c.name}>
                  <Box
                    sx={{ mx: 1.5, my: 0.25, pr: 0.75, py: 0.5, borderRadius: 2, display: 'flex', alignItems: 'center', cursor: 'pointer',
                      bgcolor: active ? 'rgba(56,189,248,0.14)' : 'transparent',
                      '&:hover': { bgcolor: active ? 'rgba(56,189,248,0.2)' : 'rgb(var(--brand-fg-rgb) / 0.06)' } }}
                    onClick={() => { toggleOfficialExpand(c.name); setOfficialCategoryFilter(c.name); }}
                  >
                    {isExpanded
                      ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mr: 0.25, flexShrink: 0 }} />
                      : <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'rgb(var(--brand-fg-rgb) / 0.5)', mr: 0.25, flexShrink: 0 }} />}
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', mr: 1, flexShrink: 0, bgcolor: `hsl(${hueOf(c.name)},65%,62%)` }} />
                    <Typography sx={{ color: active ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: 12, fontWeight: active ? 700 : 500,
                      flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', ml: 0.5, flexShrink: 0 }}>{c.items.length}</Typography>
                  </Box>
                  {isExpanded && c.items.map((a) => {
                    const published = a.status === 'published';
                    const col = published ? '#81c784' : '#ffb74d';
                    const activeArt = a.id === officialDraftId;
                    return (
                      <Box key={a.id} onClick={() => void officialStartEdit(a.id)}
                        sx={{ mx: 1.5, my: 0.1, pl: 4.5, pr: 1.25, py: 0.5, borderRadius: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.75,
                          bgcolor: activeArt ? 'rgba(56,189,248,0.18)' : 'transparent',
                          boxShadow: activeArt ? 'inset 2px 0 0 #38bdf8' : 'none',
                          '&:hover': { bgcolor: activeArt ? 'rgba(56,189,248,0.24)' : 'rgb(var(--brand-fg-rgb) / 0.06)' } }}>
                        {published
                          ? <PublicRoundedIcon sx={{ fontSize: 13, color: col, flexShrink: 0 }} />
                          : <EditNoteRoundedIcon sx={{ fontSize: 13, color: col, flexShrink: 0 }} />}
                        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 11.5, color: published ? 'rgb(var(--brand-fg-rgb) / 0.78)' : 'rgb(var(--brand-fg-rgb) / 0.5)',
                          fontStyle: published ? 'normal' : 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.title || '(無題)'}
                        </Typography>
                        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: col, flexShrink: 0, opacity: 0.9 }}>
                          {published ? '公開' : '下書き'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </>
        ) : (
        <>
        {/* ホーム = おすすめメディアの最新記事フィード（気になる記事→AIと議論→記事化の入口） */}
        <ScopeItem
          icon={<NewspaperRoundedIcon />} label="ホーム"
          active={mode !== 'edit' && view === 'feed'} onClick={() => navAway(() => setView('feed'))} color={ACCENT}
        />
        {/* ソース記事 = ホームに表示するメディア（RSSソース）を選ぶ画面 */}
        <ScopeItem
          icon={<RssFeedRoundedIcon />} label="情報源"
          active={mode !== 'edit' && view === 'sources'} onClick={() => navAway(() => setView('sources'))} color={ACCENT}
        />
        {/* 概要・分析・戦略（データ管理＋運営戦略）。記事編集中でも押せば保存して切り替わる。 */}
        <ScopeItem
          icon={<InsightsRoundedIcon />} label="概要・分析・戦略"
          active={mode !== 'edit' && view === 'overview'} onClick={() => navAway(() => setView('overview'))} color="#ff8a65"
        />
        {/* スケジュール = 投稿カレンダー（月/リスト・AI投稿計画。タスクなし） */}
        <ScopeItem
          icon={<EventNoteRoundedIcon />} label="スケジュール" badgeCount={dueCount}
          active={mode !== 'edit' && (view === 'schedule' || view === 'plan')} onClick={() => navAway(() => setView('schedule'))} color="#5c9ce6"
        />
        {/* 記事一覧 = 自分の全記事（下書き/公開済みは本体の状況タブで把握） */}
        <ScopeItem
          icon={<ArticleRoundedIcon />} label="記事一覧" count={articles.length}
          active={mode !== 'edit' && view === 'list' && !categoryFilter} onClick={() => navAway(goHome)} color="#607d8b"
        />
        {/* カテゴリ = カテゴリ管理パネル（作成/改名/削除/並べ替え） */}
        <ScopeItem
          icon={<CategoryRoundedIcon />} label="カテゴリ"
          active={mode !== 'edit' && view === 'categories'} onClick={() => navAway(() => setView('categories'))} color="#8e7cc3"
        />

        <Divider sx={{ borderColor: 'rgb(var(--brand-fg-rgb) / 0.07)', mx: 1.5, my: 1 }} />

        {/* カテゴリ */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.25, mb: 0.5 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textTransform: 'uppercase' }}>
            カテゴリ
          </Typography>
          <Tooltip title="カテゴリを追加">
            <IconButton size="small" onClick={() => setAdding((v) => !v)} sx={{ p: 0.25, color: adding ? ACCENT : 'rgb(var(--brand-fg-rgb) / 0.45)', '&:hover': { color: ACCENT } }}>
              <AddRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {adding && (
          <Box sx={{ mx: 1.5, mb: 0.5 }}>
            <TextField
              autoFocus value={newCat} onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitNewCat(); if (e.key === 'Escape') { setAdding(false); setNewCat(''); } }}
              onBlur={() => { if (newCat.trim()) submitNewCat(); else { setAdding(false); } }}
              placeholder="新しいカテゴリ名…" size="small" fullWidth variant="outlined"
              InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 12, bgcolor: 'light-dark(rgba(15,23,42,0.08), rgba(0,0,0,0.25))' } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.14)' }, '&:hover fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.3)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
            />
          </Box>
        )}

        {categoryRows.length === 0 && !adding ? (
          <Typography sx={{ px: 2.5, py: 0.5, fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.3)', lineHeight: 1.6 }}>
            ＋ でカテゴリを作成し、テーマごとに記事を書き溜めましょう。
          </Typography>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={categoryRows.map((c) => c.name)} strategy={verticalListSortingStrategy}>
              {categoryRows.map((c) => (
                <SortableCategoryRow
                  key={c.name}
                  name={c.name} items={c.items}
                  active={view === 'list' && categoryFilter === c.name}
                  expanded={expanded.has(c.name)}
                  editing={editingName === c.name}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onEditCommit={commitRename}
                  onEditCancel={() => setEditingName(null)}
                  onClick={() => { toggleExpand(c.name); setCategoryFilter(c.name); }}
                  onStartRename={() => startRename(c.name)}
                  onDelete={() => setDeleteTarget({ name: c.name, count: c.items.length })}
                  onOpenArticle={(id) => navAway(() => startEdit(id))}
                  activeArticleId={activeArticleId}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
        </>
        )}
      </Box>

      <Box sx={{ px: 2, pt: 1, borderTop: `1px solid ${BRAND.line}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <ArticleRoundedIcon sx={{ fontSize: 13, color: ACCENT }} />
          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)', fontWeight: 600 }}>S.Blog</Typography>
        </Box>
        <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.3)', lineHeight: 1.6 }}>
          記事は公開サイトと SEKKEIYA 検索に連携予定（後続フェーズ）。
        </Typography>
      </Box>

      {/* カテゴリ削除の確認 */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)', border: `1px solid ${BRAND.line}`, minWidth: 380, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>カテゴリを削除</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)', fontSize: '0.9rem' }}>
            「{deleteTarget?.name}」を削除します。
            {deleteTarget && deleteTarget.count > 0
              ? `配下の ${deleteTarget.count} 件の記事は未分類（カテゴリなし）になります（記事自体は削除されません）。`
              : 'このカテゴリには記事がありません。'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.7)' }}>キャンセル</Button>
          <Button onClick={() => { if (uid && deleteTarget) removeCategory(uid, deleteTarget.name); setDeleteTarget(null); }}
            variant="contained" sx={{ bgcolor: '#ef4444', color: 'var(--brand-fg)', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
