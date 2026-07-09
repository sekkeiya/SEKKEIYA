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
  active: boolean;
  onClick: () => void;
  color?: string;
}

function ScopeItem({ icon, label, count, active, onClick, color }: ScopeItemProps) {
  return (
    <Box sx={{ position: 'relative', mx: 1.5, my: 0.5 }}>
      <CardActionArea
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: 2,
          bgcolor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
        }}
      >
        <Box sx={{
          width: 20, height: 20, borderRadius: 1.5,
          bgcolor: color || 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1, flexShrink: 0,
        }}>
          {React.cloneElement(icon as React.ReactElement<any>, { sx: { fontSize: 14, color: '#fff' } })}
        </Box>
        <Typography sx={{
          color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
          fontSize: 12, fontWeight: active ? 600 : 500, flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {label}
        </Typography>
        {typeof count === 'number' && (
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{count}</Typography>
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
        '&:hover': { bgcolor: active ? `${ACCENT}33` : 'rgba(255,255,255,0.06)' },
      }}
    >
      {published
        ? <PublicRoundedIcon sx={{ fontSize: 13, color, flexShrink: 0 }} />
        : <EditNoteRoundedIcon sx={{ fontSize: 13, color, flexShrink: 0 }} />}
      <Typography sx={{
        flex: 1, minWidth: 0, fontSize: 11.5,
        color: published ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.5)',
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
          '&:hover': { bgcolor: p.active ? `${ACCENT}26` : 'rgba(255,255,255,0.06)' },
          '&:hover .cat-actions': { opacity: 1 },
        }}
      >
        {/* ドラッグハンドル（左） */}
        <IconButton
          size="small" {...attributes} {...listeners}
          onClick={(e) => e.stopPropagation()}
          sx={{ p: 0.25, color: 'rgba(255,255,255,0.28)', cursor: 'grab', '&:active': { cursor: 'grabbing' }, '&:hover': { color: 'rgba(255,255,255,0.7)' }, flexShrink: 0 }}
        >
          <DragIndicatorRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>

        {p.editing ? (
          <TextField
            autoFocus value={p.editValue} onChange={(e) => p.onEditChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') p.onEditCommit(); if (e.key === 'Escape') p.onEditCancel(); }}
            onBlur={p.onEditCommit}
            size="small" variant="standard"
            InputProps={{ disableUnderline: false, sx: { color: '#fff', fontSize: 12, '&:before': { borderColor: 'rgba(255,255,255,0.2)' }, '&:after': { borderColor: ACCENT } } }}
            sx={{ flex: 1, mx: 0.5 }}
          />
        ) : (
          <>
            {/* クリックで展開＋絞り込み */}
            <Box onClick={p.onClick} sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, cursor: 'pointer' }}>
              {p.expanded
                ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', mr: 0.25, flexShrink: 0 }} />
                : <KeyboardArrowRightRoundedIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', mr: 0.25, flexShrink: 0 }} />}
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', mr: 1, flexShrink: 0, bgcolor: `hsl(${hueOf(p.name)},65%,62%)` }} />
              <Typography sx={{
                color: p.active ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: p.active ? 700 : 500,
                flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {p.name}
              </Typography>
            </Box>
            {/* ホバーで改名・削除 */}
            <Box className="cat-actions" sx={{ display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 0.12s', flexShrink: 0 }}>
              <Tooltip title="名前を変更"><IconButton size="small" onClick={(e) => { e.stopPropagation(); p.onStartRename(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}><EditRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
              <Tooltip title="削除"><IconButton size="small" onClick={(e) => { e.stopPropagation(); p.onDelete(); }} sx={{ p: 0.25, color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fa9bb4' } }}><DeleteOutlineRoundedIcon sx={{ fontSize: 13 }} /></IconButton></Tooltip>
            </Box>
            <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', ml: 0.5, flexShrink: 0 }}>{p.items.length}</Typography>
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
  } = useDsbStore();

  // 非管理者が万一 official のまま残らないよう、権限が無ければ account に戻す。
  useEffect(() => { if (!admin && blogScope !== 'account') setBlogScope('account'); }, [admin, blogScope, setBlogScope]);

  // 公式モード用（ナビのハイライト・件数）。account モードでも購読は無害。
  const officialMode = useOfficialBlogStore((s) => s.mode);
  const officialView = useOfficialBlogStore((s) => s.view);
  const officialCount = useOfficialBlogStore((s) => s.articles.length);
  const setOfficialView = useOfficialBlogStore((s) => s.setView);

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
        bgcolor: BRAND.panel,
        borderRight: isProjectSidebarOpen ? `1px solid ${BRAND.line}` : 'none',
        display: 'flex', flexDirection: 'column',
        py: isProjectSidebarOpen ? 2 : 0,
        overflowY: 'auto', overflowX: 'hidden', flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s, border 0.2s',
      }}
    >
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          ブログ / S.Blog
        </Typography>
      </Box>

      {/* 管理者のみ: 自分のブログ ⇄ 公式ブログ の切替（Admin トグル）。 */}
      {admin && (
        <Box sx={{ mx: 1.5, mb: 1, display: 'flex', gap: 0.5, p: 0.4, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { key: 'account' as const, label: '自分のブログ', color: ACCENT },
            { key: 'official' as const, label: '公式ブログ', color: '#38bdf8' },
          ]).map((opt) => {
            const on = blogScope === opt.key;
            return (
              <Box key={opt.key} onClick={() => setBlogScope(opt.key)}
                sx={{ flex: 1, textAlign: 'center', cursor: 'pointer', py: 0.6, borderRadius: 1.5,
                  bgcolor: on ? `${opt.color}22` : 'transparent',
                  boxShadow: on ? `inset 0 0 0 1px ${opt.color}66` : 'none',
                  '&:hover': { bgcolor: on ? `${opt.color}2e` : 'rgba(255,255,255,0.05)' } }}>
                <Typography sx={{ fontSize: 11, fontWeight: on ? 800 : 600, color: on ? opt.color : 'rgba(255,255,255,0.6)' }}>
                  {opt.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1.5, my: 1 }} />

      <Box sx={{ flex: 1 }}>
        {blogScope === 'official' ? (
          /* ── 公式ブログモードのナビ（記事一覧 / Content Strategy / カテゴリ） ── */
          <>
            <ScopeItem
              icon={<ArticleRoundedIcon />} label="記事一覧" count={officialCount}
              active={officialView === 'articles' && officialMode !== 'edit'} onClick={() => setOfficialView('articles')} color="#38bdf8"
            />
            <ScopeItem
              icon={<EventNoteRoundedIcon />} label="Content Strategy"
              active={officialView === 'strategy'} onClick={() => setOfficialView('strategy')} color="#c084fc"
            />
            <ScopeItem
              icon={<CategoryRoundedIcon />} label="カテゴリ"
              active={officialView === 'categories'} onClick={() => setOfficialView('categories')} color="#8e7cc3"
            />
          </>
        ) : (
        <>
        {/* ホーム = おすすめメディアの最新記事フィード（気になる記事→AIと議論→記事化の入口） */}
        <ScopeItem
          icon={<NewspaperRoundedIcon />} label="ホーム"
          active={mode !== 'edit' && view === 'feed'} onClick={() => navAway(() => setView('feed'))} color={ACCENT}
        />
        {/* 概要（データ管理ダッシュボード）。記事編集中でも押せば保存して切り替わる。 */}
        <ScopeItem
          icon={<InsightsRoundedIcon />} label="概要・分析"
          active={mode !== 'edit' && view === 'overview'} onClick={() => navAway(() => setView('overview'))} color="#ff8a65"
        />
        {/* スケジュール = 投稿計画（コンテンツカレンダー） */}
        <ScopeItem
          icon={<EventNoteRoundedIcon />} label="スケジュール"
          active={mode !== 'edit' && view === 'schedule'} onClick={() => navAway(() => setView('schedule'))} color="#5c9ce6"
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

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', mx: 1.5, my: 1 }} />

        {/* カテゴリ */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.25, mb: 0.5 }}>
          <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.8, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
            カテゴリ
          </Typography>
          <Tooltip title="カテゴリを追加">
            <IconButton size="small" onClick={() => setAdding((v) => !v)} sx={{ p: 0.25, color: adding ? ACCENT : 'rgba(255,255,255,0.45)', '&:hover': { color: ACCENT } }}>
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
              InputProps={{ sx: { color: '#fff', fontSize: 12, bgcolor: 'rgba(0,0,0,0.25)' } }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5, '& fieldset': { borderColor: 'rgba(255,255,255,0.14)' }, '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' }, '&.Mui-focused fieldset': { borderColor: ACCENT } } }}
            />
          </Box>
        )}

        {categoryRows.length === 0 && !adding ? (
          <Typography sx={{ px: 2.5, py: 0.5, fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
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
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>S.Blog</Typography>
        </Box>
        <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.6 }}>
          記事は公開サイトと SEKKEIYA 検索に連携予定（後続フェーズ）。
        </Typography>
      </Box>

      {/* カテゴリ削除の確認 */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        PaperProps={{ sx: { bgcolor: '#0e121c', color: '#fff', border: `1px solid ${BRAND.line}`, minWidth: 380, borderRadius: 3, backgroundImage: 'none' } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>カテゴリを削除</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
            「{deleteTarget?.name}」を削除します。
            {deleteTarget && deleteTarget.count > 0
              ? `配下の ${deleteTarget.count} 件の記事は未分類（カテゴリなし）になります（記事自体は削除されません）。`
              : 'このカテゴリには記事がありません。'}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: 'rgba(255,255,255,0.7)' }}>キャンセル</Button>
          <Button onClick={() => { if (uid && deleteTarget) removeCategory(uid, deleteTarget.name); setDeleteTarget(null); }}
            variant="contained" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#dc2626' } }}>削除する</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
