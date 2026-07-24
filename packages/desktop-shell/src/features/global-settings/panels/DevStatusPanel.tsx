// Global Settings > 管理者 > 開発状況（管理者専用）。スプリント方式のバックログボード。
// - 上部トグルで表示切替: ボード（既定）⇄ タイムライン（月グリッド上にスプリント帯＝
//   カレンダー/ロードマップ相当。帯には完了率の下地とカテゴリ色の要件ドット）。
// - ボード表示:
//   最上部=現在のスプリント（未アーカイブの最小番号・全幅）。「完了」でアーカイブし、
//   未完了（status !== 'done'）の要件はバックログへ自動返却・完了済みは履歴として残る。
//   その下=今後のスプリント（開閉式）／下段=要求定義・バックログ／最下部=スプリント履歴。
// - 要件カードは1行表示。状態は 未着手/着手/テスト/完了 の4択。カテゴリ（子アプリ等）付与可。
//   スプリント移動はドラッグ&ドロップのみ（左端ハンドル）。
// - スプリント作成はダイアログで期間を設定（既定: 前回終了日の翌日から2週間）。
// - 削除・完了は window.confirm ではなく MUI Dialog で確認する。
// - 期限は個別に持たず「所属スプリントの終了日」に一本化。
// データ: Firestore /devBacklog（項目）+ /devSprints（スプリント）。管理者のみ読み書き。
// onSnapshot で Web/Desktop 即時同期。
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, IconButton, Chip,
  LinearProgress, Tooltip, CircularProgress, Select, MenuItem, Collapse,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import ViewTimelineRoundedIcon from '@mui/icons-material/ViewTimelineRounded';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, useDroppable, MeasuringStrategy,
  defaultDropAnimationSideEffects,
  type DragEndEvent, type DragStartEvent, type CollisionDetection, type DropAnimation,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase/client';

type BacklogType = 'request' | 'requirement';
type ReqStatus = 'todo' | 'doing' | 'testing' | 'done';
type ViewMode = 'board' | 'timeline';

interface BacklogItem {
  id: string;
  type: BacklogType;
  seq?: number;              // 種別内の自動採番（要求1, 要件1 …）
  title: string;
  status?: ReqStatus;        // 要件のみ: 未着手/着手/テスト/完了
  category?: string | null;  // 要件のみ: 機能カテゴリ（CATEGORIES の id）
  requestId?: string | null; // 要件のみ: 親要求（1対多・任意）
  sprintId?: string | null;  // 要件のみ: 所属スプリント（null=バックログ）
  order?: number;            // 手動並び替え順（DnD。未設定なら seq にフォールバック）
  progress?: number;         // 旧データ互換（未使用・statusへ移行）
  done?: boolean;            // 旧データ互換（status==='done' と同期して書く）
  createdAt?: { toMillis?: () => number } | null;
  updatedAt?: unknown;
}

interface Sprint {
  id: string;
  seq: number;               // Sprint 1, 2, …
  startDate: string;         // 'YYYY-MM-DD'
  endDate: string;           // 'YYYY-MM-DD'（この日が要件の期限を兼ねる）
  archived?: boolean;        // 完了（アーカイブ）済みか
  archivedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** 確認ダイアログの内容（null = 非表示） */
interface ConfirmState {
  title: string;
  message: string;
  actionLabel: string;
  color: 'error' | 'success';
  action: () => void;
}

// ── 状態（4択） ───────────────────────────────────────────────────
const STATUSES: { id: ReqStatus; label: string; color: string }[] = [
  { id: 'todo',    label: '未着手', color: 'text.secondary' },
  { id: 'doing',   label: '着手',   color: 'info.main' },
  { id: 'testing', label: 'テスト', color: 'warning.main' },
  { id: 'done',    label: '完了',   color: 'success.main' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));
// 旧データ（status 無し）は done / progress から推定
const statusOf = (r: BacklogItem): ReqStatus =>
  r.status ?? (r.done ? 'done' : ((r.progress || 0) > 0 ? 'doing' : 'todo'));
const isDone = (r: BacklogItem) => statusOf(r) === 'done';

// ── カテゴリ（子アプリ + Chat/Drive/基盤 等）。色は子アプリのタブ色に合わせる ──
const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'general', label: '基盤',   color: '#78909c' },
  { id: 'chat',    label: 'Chat',   color: '#00bcd4' },
  { id: 'drive',   label: 'Drive',  color: '#26a69a' },
  { id: 'ai',      label: 'AI',     color: 'light-dark(#732e7f, #ba68c8)' },
  { id: 'web',     label: 'Web/LP', color: '#42a5f5' },
  { id: 'billing', label: '課金',   color: '#66bb6a' },
  { id: '3dss',    label: 'S.Model',     color: '#ff5252' },
  { id: '3dsl',    label: 'S.Layout',    color: 'light-dark(#ad6700, #ffb74d)' },
  { id: '3dsp',    label: 'S.Slide',     color: 'light-dark(#732e7f, #ba68c8)' },
  { id: '3dsc',    label: 'S.Create',    color: 'light-dark(#ad6700, #ffa726)' },
  { id: '3dsd',    label: 'S.Diagram',   color: 'light-dark(#5a822b, #aed581)' },
  { id: '3dsr',    label: 'S.Drawing',   color: '#4db6ac' },
  { id: '3dsi',    label: 'S.Image',     color: '#ec407a' },
  { id: '3dsq',    label: 'S.Quest',     color: '#5c6bc0' },
  { id: '3dsf',    label: 'S.Portfolio', color: '#7e57c2' },
  { id: '3dsk',    label: 'S.Library',   color: '#26a69a' },
  { id: '3dsb',    label: 'S.Blog',      color: 'light-dark(#921b1b, #e57373)' },
  { id: '3dsm',    label: 'S.Movie',     color: '#C98A4B' },
  { id: '3dsmt',   label: 'S.Material',  color: '#ec407a' },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

const KEY_PREFIX: Record<BacklogType, string> = { request: '要求', requirement: '要件' };
const keyOf = (i?: BacklogItem) => i ? `${KEY_PREFIX[i.type]}${i.seq ?? '?'}` : '?';
// 手動並び順。未設定は seq にフォールバック（既存項目も決定的に並ぶ）。
const orderOf = (i: BacklogItem) => i.order ?? (i.seq ?? 0);
const jstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
const VIEW_STORAGE_KEY = 'sekkeiya.devStatus.view';

const SECTION_SX = {
  p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
} as const;
const SELECT_SX = { height: 24, fontSize: 12, '& .MuiSelect-select': { py: 0.25, pl: 0.75, pr: '20px !important' } } as const;
// ドロップダウンの背景を不透明に（テーマの background.paper は半透明=選びにくいため
// メニュー用の不透明面 --brand-glass を使う）。
const MENU_PROPS = {
  PaperProps: {
    sx: {
      bgcolor: 'var(--brand-glass)',
      backgroundImage: 'none', // dark モードの elevation オーバーレイ（半透明）を無効化
      border: '1px solid', borderColor: 'divider',
      backdropFilter: 'blur(10px)',
    },
  },
} as const;
// ダイアログの Paper も不透明面に（背景が透けないように）。
const DIALOG_PAPER_SX = {
  bgcolor: 'var(--brand-glass)',
  backgroundImage: 'none',
  border: '1px solid',
  borderColor: 'divider',
} as const;

// 当たり判定: まずポインタ内（空ゾーンでも確実に拾える）→ 無ければ矩形交差にフォールバック。
const collisionStrategy: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length > 0 ? pointer : rectIntersection(args);
};

// ドロップ時の着地アニメ（スムーズに元位置へ吸い込まれる）。
const DROP_ANIMATION: DropAnimation = {
  duration: 240,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};
// 掴んだカードの持ち上がり表現（overlay 側）。
const DRAG_OVERLAY_SX = {
  transform: 'scale(1.02)',
  boxShadow: '0 14px 32px rgba(0,0,0,0.34)',
  borderColor: 'light-dark(#0875a6, #4fc3f7)',
  cursor: 'grabbing',
} as const;
// useSortable の transition に opacity のフェードを足して滑らかにする。
const sortableTransition = (t: string | undefined) =>
  [t, 'opacity 140ms ease'].filter(Boolean).join(', ');

// ── ドロップ先ID（コンテナ）──────────────────────────────────────
const BACKLOG_DROP_ID = 'backlog';
const REQUESTS_DROP_ID = 'requests';
const sprintDropId = (id: string) => `sprint:${id}`;
const isContainerId = (id: string) =>
  id === BACKLOG_DROP_ID || id === REQUESTS_DROP_ID || id.startsWith('sprint:');

// ── カテゴリの丸ドット＋ラベル ────────────────────────────────────
const CatDot: React.FC<{ id?: string | null; withLabel?: boolean }> = ({ id, withLabel }) => {
  const c = id ? CAT_MAP[id] : undefined;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c ? c.color : 'transparent', border: c ? 'none' : '1px solid', borderColor: 'text.disabled', flexShrink: 0 }} />
      {withLabel && <Typography variant="caption" sx={{ color: c ? 'text.primary' : 'text.disabled', whiteSpace: 'nowrap' }}>{c ? c.label : '未分類'}</Typography>}
    </Box>
  );
};

// ── 要件カード（1行・ドラッグ可能） ──────────────────────────────
interface RequirementCardProps {
  item: BacklogItem;
  parent?: BacklogItem;
  onPatch: (id: string, data: Record<string, unknown>) => void;
  onRemove: (item: BacklogItem) => void;
  onOpenDetail: (item: BacklogItem) => void;
}
const RequirementCard: React.FC<RequirementCardProps> = ({ item, parent, onPatch, onRemove, onOpenDetail }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition: sortableTransition(transition) };
  const st = statusOf(item);
  const done = st === 'done';
  return (
    <Paper
      ref={setNodeRef} style={style} elevation={0}
      sx={{ ...SECTION_SX, p: 0.75, opacity: isDragging ? 0.4 : (done ? 0.6 : 1), position: 'relative', zIndex: isDragging ? 1 : 0 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'nowrap' }}>
        {/* ドラッグハンドル（ここだけ掴める） */}
        <Box
          {...attributes} {...listeners}
          sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled', cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicatorRoundedIcon fontSize="small" />
        </Box>
        {/* カテゴリ */}
        <Select
          size="small" displayEmpty value={item.category || ''}
          onChange={(e) => onPatch(item.id, { category: e.target.value || null })}
          renderValue={(v) => <CatDot id={v as string} withLabel />}
          MenuProps={MENU_PROPS}
          sx={{ ...SELECT_SX, minWidth: 96, flexShrink: 0 }}
        >
          <MenuItem value=""><em>未分類</em></MenuItem>
          {CATEGORIES.map(c => (
            <MenuItem key={c.id} value={c.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><CatDot id={c.id} /> {c.label}</Box>
            </MenuItem>
          ))}
        </Select>
        <Chip label={keyOf(item)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22, flexShrink: 0 }} />
        <Tooltip title="クリックで全文・詳細" arrow>
          <Typography
            variant="body2" noWrap
            onClick={() => onOpenDetail(item)}
            sx={{ flex: 1, minWidth: 40, fontWeight: 500, textDecoration: done ? 'line-through' : 'none', cursor: 'pointer', '&:hover': { color: 'light-dark(#0875a6, #4fc3f7)' } }}
          >
            {item.title}
          </Typography>
        </Tooltip>
        {/* 状態（4択） */}
        <Select
          size="small" value={st}
          onChange={(e) => { const v = e.target.value as ReqStatus; onPatch(item.id, { status: v, done: v === 'done' }); }}
          renderValue={(v) => <Typography variant="caption" sx={{ color: STATUS_MAP[v as string].color, fontWeight: 600, whiteSpace: 'nowrap' }}>{STATUS_MAP[v as string].label}</Typography>}
          MenuProps={MENU_PROPS}
          sx={{ ...SELECT_SX, minWidth: 74, flexShrink: 0 }}
        >
          {STATUSES.map(s => (
            <MenuItem key={s.id} value={s.id}>
              <Typography variant="caption" sx={{ color: s.color, fontWeight: 600 }}>{s.label}</Typography>
            </MenuItem>
          ))}
        </Select>
        {parent && (
          <Tooltip title={parent.title} arrow>
            <Chip label={keyOf(parent)} size="small" sx={{ height: 20, fontFamily: 'monospace', fontSize: 11, flexShrink: 0, bgcolor: 'light-dark(rgba(8,117,166,0.12), rgba(79,195,247,0.14))' }} />
          </Tooltip>
        )}
        <IconButton size="small" onClick={() => onRemove(item)} sx={{ flexShrink: 0 }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
};

// ── 要求カード（1行・並び替え可能。完了は子要件から導出） ────────────
interface SortableRequestRowProps {
  item: BacklogItem;
  childItems: BacklogItem[];
  onRemove: (item: BacklogItem) => void;
  onOpenDetail: (item: BacklogItem) => void;
}
const SortableRequestRow: React.FC<SortableRequestRowProps> = ({ item, childItems, onRemove, onOpenDetail }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition: sortableTransition(transition) };
  const derived = childItems.length > 0 && childItems.every(isDone);
  return (
    <Paper ref={setNodeRef} style={style} elevation={0} sx={{ ...SECTION_SX, p: 1.25, opacity: isDragging ? 0.4 : (derived ? 0.6 : 1), position: 'relative', zIndex: isDragging ? 1 : 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box
          {...attributes} {...listeners}
          sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled', cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicatorRoundedIcon fontSize="small" />
        </Box>
        <Chip label={keyOf(item)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
        <Tooltip title="クリックで全文・詳細" arrow>
          <Typography
            variant="body2"
            onClick={() => onOpenDetail(item)}
            sx={{ flex: 1, minWidth: 60, fontWeight: 500, textDecoration: derived ? 'line-through' : 'none', lineHeight: 1.4, cursor: 'pointer', '&:hover': { color: 'light-dark(#0875a6, #4fc3f7)' } }}
          >
            {item.title}
          </Typography>
        </Tooltip>
        {derived && <Chip label="完了" size="small" color="success" sx={{ height: 20 }} />}
        <IconButton size="small" onClick={() => onRemove(item)}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
      {childItems.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', pl: 4, mt: 0.75 }}>
          {childItems.map(c => (
            <Tooltip key={c.id} title={c.title} arrow>
              <Chip
                label={keyOf(c)} size="small"
                sx={{
                  height: 20, fontFamily: 'monospace', fontSize: 11,
                  textDecoration: isDone(c) ? 'line-through' : 'none', opacity: isDone(c) ? 0.6 : 1,
                  bgcolor: 'light-dark(rgba(8,117,166,0.12), rgba(79,195,247,0.14))',
                }}
              />
            </Tooltip>
          ))}
        </Box>
      )}
    </Paper>
  );
};

// ── ドロップ先ゾーン ──────────────────────────────────────────────
const DroppableZone: React.FC<{ droppableId: string; children: React.ReactNode }> = ({ droppableId, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex', flexDirection: 'column', gap: 0.75, borderRadius: 2,
        transition: 'background-color .15s, outline-color .15s',
        outline: '2px dashed transparent',
        ...(isOver ? {
          bgcolor: 'light-dark(rgba(8,117,166,0.06), rgba(79,195,247,0.08))',
          outlineColor: 'light-dark(#0875a6, #4fc3f7)', outlineOffset: 2,
        } : {}),
      }}
    >
      {children}
    </Box>
  );
};

export const DevStatusPanel = () => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loaded, setLoaded] = useState({ items: false, sprints: false });
  const [error, setError] = useState<string | null>(null);
  const [newReqTitle, setNewReqTitle] = useState('');
  const [newReqParent, setNewReqParent] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('');
  const [newReqTitleReq, setNewReqTitleReq] = useState('');
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null); // 確認ダイアログ
  const [createOpen, setCreateOpen] = useState(false);               // スプリント作成ダイアログ
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);   // 詳細ダイアログ対象
  const [detailDraft, setDetailDraft] = useState('');              // タイトル編集ドラフト
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) || 'board');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const u1 = onSnapshot(
      collection(db, 'devBacklog'),
      (snap) => {
        setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BacklogItem, 'id'>) })));
        setLoaded(s => ({ ...s, items: true }));
      },
      (e) => { setError(e?.message || '読み込みに失敗しました'); setLoaded(s => ({ ...s, items: true })); },
    );
    const u2 = onSnapshot(
      collection(db, 'devSprints'),
      (snap) => {
        setSprints(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Sprint, 'id'>) })));
        setLoaded(s => ({ ...s, sprints: true }));
      },
      (e) => { setError(e?.message || 'スプリントの読み込みに失敗しました'); setLoaded(s => ({ ...s, sprints: true })); },
    );
    return () => { u1(); u2(); };
  }, []);

  const patchItem = (id: string, data: Record<string, unknown>) => {
    updateDoc(doc(db, 'devBacklog', id), { ...data, updatedAt: serverTimestamp() })
      .catch((e) => setError(e?.message || '更新に失敗しました'));
  };
  const patchSprint = (id: string, data: Record<string, unknown>) => {
    updateDoc(doc(db, 'devSprints', id), { ...data, updatedAt: serverTimestamp() })
      .catch((e) => setError(e?.message || '更新に失敗しました'));
  };

  const today = jstToday();
  const sprintList = useMemo(() => [...sprints].sort((a, b) => a.seq - b.seq), [sprints]);
  const activeSprints = useMemo(() => sprintList.filter(s => !s.archived), [sprintList]);
  const currentSprint = activeSprints[0] ?? null;
  const upcoming = useMemo(() => activeSprints.slice(1), [activeSprints]);
  const archivedSprints = useMemo(() => sprintList.filter(s => s.archived).sort((a, b) => b.seq - a.seq), [sprintList]);

  // 並びは手動順（order）を尊重。未設定は seq にフォールバック。
  const requests = useMemo(
    () => items.filter(i => i.type === 'request').sort((a, b) => orderOf(a) - orderOf(b)),
    [items]);
  const requirements = useMemo(
    () => items.filter(i => i.type === 'requirement').sort((a, b) => orderOf(a) - orderOf(b)),
    [items]);
  const backlog = useMemo(() => requirements.filter(r => !r.sprintId), [requirements]);
  const bySprint = useMemo(() => {
    const m = new Map<string, BacklogItem[]>();
    requirements.forEach(r => { if (r.sprintId) m.set(r.sprintId, [...(m.get(r.sprintId) || []), r]); });
    return m;
  }, [requirements]);
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);
  const childrenOf = (requestId: string) => requirements.filter(r => r.requestId === requestId);

  const nextSeq = (type: BacklogType) =>
    Math.max(0, ...items.filter(i => i.type === type).map(i => i.seq || 0)) + 1;

  const changeView = (v: ViewMode | null) => {
    if (!v) return;
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* private mode 等は無視 */ }
  };

  const addRequest = async () => {
    const title = newReqTitleReq.trim();
    if (!title) return;
    setNewReqTitleReq('');
    try {
      await addDoc(collection(db, 'devBacklog'), {
        type: 'request', seq: nextSeq('request'), title,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e: any) { setError(e?.message || '追加に失敗しました'); }
  };

  const addRequirement = async () => {
    const title = newReqTitle.trim();
    if (!title) return;
    setNewReqTitle(''); setNewReqParent(''); setNewReqCategory('');
    try {
      await addDoc(collection(db, 'devBacklog'), {
        type: 'requirement', seq: nextSeq('requirement'), title,
        status: 'todo', done: false, category: newReqCategory || null,
        requestId: newReqParent || null, sprintId: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e: any) { setError(e?.message || '追加に失敗しました'); }
  };

  /** 項目削除（確認ダイアログ経由） */
  const remove = (item: BacklogItem) => {
    const children = item.type === 'request' ? childrenOf(item.id) : [];
    setConfirm({
      title: `${keyOf(item)} を削除`,
      message: `「${item.title}」を削除しますか？` +
        (children.length ? ` 子要件 ${children.length} 件は「要求なし」として残ります。` : ''),
      actionLabel: '削除', color: 'error',
      action: () => {
        children.forEach(r => patchItem(r.id, { requestId: null }));
        deleteDoc(doc(db, 'devBacklog', item.id)).catch((e) => setError(e?.message || '削除に失敗しました'));
      },
    });
  };

  /** スプリント作成ダイアログを開く（期間は自動入力・編集可） */
  const openCreateSprint = () => {
    const last = sprintList[sprintList.length - 1];
    const start = last ? addDays(last.endDate, 1) : today;
    setCreateStart(start);
    setCreateEnd(addDays(start, 13));
    setCreateOpen(true);
  };

  const createSprint = async () => {
    if (!createStart || !createEnd || createEnd < createStart) return;
    setCreateOpen(false);
    const last = sprintList[sprintList.length - 1];
    try {
      await addDoc(collection(db, 'devSprints'), {
        seq: (last?.seq || 0) + 1, startDate: createStart, endDate: createEnd, archived: false,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    } catch (e: any) { setError(e?.message || 'スプリントの作成に失敗しました'); }
  };

  /** 完了（アーカイブ）。確認ダイアログ経由。 */
  const completeSprint = (s: Sprint) => {
    const list = bySprint.get(s.id) || [];
    const unfinished = list.filter(r => !isDone(r));
    setConfirm({
      title: `Sprint ${s.seq} を完了`,
      message: unfinished.length
        ? `未完了の要件 ${unfinished.length} 件はバックログに戻ります。完了しますか？`
        : 'すべての要件が完了しています。アーカイブしますか？',
      actionLabel: '完了する', color: 'success',
      action: () => {
        unfinished.forEach(r => patchItem(r.id, { sprintId: null }));
        patchSprint(s.id, { archived: true, archivedAt: serverTimestamp() });
      },
    });
  };

  const unarchiveSprint = (s: Sprint) => patchSprint(s.id, { archived: false });

  /** スプリント削除（確認ダイアログ経由） */
  const removeSprint = (s: Sprint) => {
    const list = bySprint.get(s.id) || [];
    setConfirm({
      title: `Sprint ${s.seq} を削除`,
      message: list.length
        ? `所属する要件 ${list.length} 件はバックログに戻ります。削除しますか？`
        : `Sprint ${s.seq}（${md(s.startDate)} – ${md(s.endDate)}）を削除しますか？`,
      actionLabel: '削除', color: 'error',
      action: () => {
        list.forEach(r => patchItem(r.id, { sprintId: null }));
        deleteDoc(doc(db, 'devSprints', s.id)).catch((e) => setError(e?.message || '削除に失敗しました'));
      },
    });
  };

  // ── ドラッグ&ドロップ（並び替え＋コンテナ間移動） ─────────────────
  // コンテナ = 'requests' / 'backlog' / 'sprint:<id>'。要求は requests 内でのみ、
  // 要件は sprint/backlog 間で並び替え・移動できる。順序は order フィールドに保存。
  const containerOfItem = (it: BacklogItem) =>
    it.type === 'request' ? REQUESTS_DROP_ID : (it.sprintId ? sprintDropId(it.sprintId) : BACKLOG_DROP_ID);
  const itemsInContainer = (cid: string): BacklogItem[] => {
    if (cid === REQUESTS_DROP_ID) return requests;
    if (cid === BACKLOG_DROP_ID) return backlog;
    if (cid.startsWith('sprint:')) return bySprint.get(cid.slice(7)) || [];
    return [];
  };
  /** リストを 0,1,2… の order に振り直して、変わったものだけ保存する。 */
  const persistOrder = (list: BacklogItem[], override?: (it: BacklogItem, idx: number) => Record<string, unknown> | null) => {
    list.forEach((it, idx) => {
      const extra = override?.(it, idx);
      if (extra) patchItem(it.id, { order: idx, ...extra });
      else if (orderOf(it) !== idx) patchItem(it.id, { order: idx });
    });
  };

  const handleDragStart = (e: DragStartEvent) => setActiveDragId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id), overId = String(over.id);
    if (activeId === overId) return;
    const activeItem = byId.get(activeId);
    if (!activeItem) return;

    const overItem = isContainerId(overId) ? undefined : byId.get(overId);
    const targetContainer = isContainerId(overId) ? overId : (overItem ? containerOfItem(overItem) : null);
    if (!targetContainer) return;
    const sourceContainer = containerOfItem(activeItem);
    // 種別違いの越境は不可（要求⇔要件は混ぜない）
    if ((activeItem.type === 'request') !== (targetContainer === REQUESTS_DROP_ID)) return;

    if (sourceContainer === targetContainer) {
      // 同一コンテナ内で並び替え
      const list = itemsInContainer(sourceContainer);
      const from = list.findIndex(i => i.id === activeId);
      let to = overItem ? list.findIndex(i => i.id === overItem.id) : list.length - 1;
      if (from < 0) return;
      if (to < 0) to = list.length - 1;
      if (from === to) return;
      persistOrder(arrayMove(list, from, to));
    } else {
      // 別コンテナへ移動（要件のみ）: sprintId 変更＋挿入位置で order 振り直し
      const targetSprintId = targetContainer === BACKLOG_DROP_ID ? null : targetContainer.slice(7);
      const targetList = itemsInContainer(targetContainer);
      let insertIdx = overItem ? targetList.findIndex(i => i.id === overItem.id) : targetList.length;
      if (insertIdx < 0) insertIdx = targetList.length;
      const newList = [...targetList];
      newList.splice(insertIdx, 0, activeItem);
      persistOrder(newList, (it) => it.id === activeId ? { sprintId: targetSprintId } : null);
    }
  };
  const activeDragItem = activeDragId ? byId.get(activeDragId) : undefined;

  /** 列サマリー（N件中M件完了＋完了率） */
  const renderColumnSummary = (list: BacklogItem[]) => {
    if (list.length === 0) return null;
    const doneCount = list.filter(isDone).length;
    const pct = Math.round((doneCount / list.length) * 100);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {list.length} 件中 {doneCount} 件完了
        </Typography>
        <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
        <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 32, textAlign: 'right' }}>{pct}%</Typography>
      </Box>
    );
  };

  /** 詳細ダイアログを開く（別項目に切替える前に、編集中タイトルを保存） */
  const openDetail = (item: BacklogItem) => {
    if (detailId && detailId !== item.id) {
      const prev = byId.get(detailId);
      const t = detailDraft.trim();
      if (prev && t && t !== prev.title) patchItem(prev.id, { title: t });
    }
    setDetailId(item.id);
    setDetailDraft(item.title);
  };

  const reqCard = (item: BacklogItem) => (
    <RequirementCard
      key={item.id} item={item}
      parent={item.requestId ? byId.get(item.requestId) : undefined}
      onPatch={patchItem} onRemove={remove} onOpenDetail={openDetail}
    />
  );

  /** 要求/要件の詳細ダイアログ（全文＋メタ情報の閲覧・編集） */
  const renderDetailDialog = () => {
    const it = detailId ? byId.get(detailId) : undefined;
    if (!it) return null;
    const isReq = it.type === 'requirement';
    const kids = it.type === 'request' ? childrenOf(it.id) : [];
    const derived = kids.length > 0 && kids.every(isDone);
    const sp = it.sprintId ? sprints.find(s => s.id === it.sprintId) : null;
    const saveTitle = () => { const t = detailDraft.trim(); if (t && t !== it.title) patchItem(it.id, { title: t }); };
    const close = () => { saveTitle(); setDetailId(null); };
    const fieldLabel = (t: string) => (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{t}</Typography>
    );
    return (
      <Dialog open onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: DIALOG_PAPER_SX } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, fontWeight: 700 }}>
          <Chip label={keyOf(it)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
          {isReq ? '要件の詳細' : '要求の詳細'}
          {isReq && (
            <Typography component="span" variant="caption" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              {sp ? `Sprint ${sp.seq}` : 'バックログ'}
            </Typography>
          )}
          {!isReq && derived && <Chip label="完了" size="small" color="success" sx={{ height: 20 }} />}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth multiline minRows={2} maxRows={12} autoFocus
            label="内容" value={detailDraft}
            onChange={(e) => setDetailDraft(e.target.value)}
            onBlur={saveTitle}
            sx={{ mt: 1 }}
          />
          {isReq && (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <Box>
                {fieldLabel('状態')}
                <Select
                  size="small" value={statusOf(it)} MenuProps={MENU_PROPS}
                  onChange={(e) => { const v = e.target.value as ReqStatus; patchItem(it.id, { status: v, done: v === 'done' }); }}
                  renderValue={(v) => <Typography variant="caption" sx={{ color: STATUS_MAP[v as string].color, fontWeight: 600 }}>{STATUS_MAP[v as string].label}</Typography>}
                  sx={{ minWidth: 110 }}
                >
                  {STATUSES.map(s => <MenuItem key={s.id} value={s.id}><Typography variant="caption" sx={{ color: s.color, fontWeight: 600 }}>{s.label}</Typography></MenuItem>)}
                </Select>
              </Box>
              <Box>
                {fieldLabel('カテゴリ')}
                <Select
                  size="small" displayEmpty value={it.category || ''} MenuProps={MENU_PROPS}
                  onChange={(e) => patchItem(it.id, { category: e.target.value || null })}
                  renderValue={(v) => <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><CatDot id={v as string} /> {v ? CAT_MAP[v as string]?.label : '未分類'}</Box>}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value=""><em>未分類</em></MenuItem>
                  {CATEGORIES.map(c => <MenuItem key={c.id} value={c.id}><Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><CatDot id={c.id} /> {c.label}</Box></MenuItem>)}
                </Select>
              </Box>
              <Box>
                {fieldLabel('親要求')}
                <Select
                  size="small" displayEmpty value={it.requestId || ''} MenuProps={MENU_PROPS}
                  onChange={(e) => patchItem(it.id, { requestId: e.target.value || null })}
                  sx={{ minWidth: 150, maxWidth: 220 }}
                >
                  <MenuItem value=""><em>要求なし</em></MenuItem>
                  {requests.map(r => <MenuItem key={r.id} value={r.id}>{keyOf(r)}: {r.title.length > 18 ? `${r.title.slice(0, 18)}…` : r.title}</MenuItem>)}
                </Select>
              </Box>
            </Box>
          )}
          {isReq && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
              所属スプリントの変更は、ボード上でカードをドラッグしてください。
            </Typography>
          )}
          {!isReq && (
            <Box sx={{ mt: 2 }}>
              {fieldLabel(`この要求の要件（${kids.length}）`)}
              {kids.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  まだ要件が紐づいていません。バックログで要件を追加するとき「親要求」に選べます。
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {kids.map(k => (
                    <Box key={k.id} onClick={() => openDetail(k)} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}>
                      <Chip label={keyOf(k)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 20 }} />
                      <Typography variant="body2" noWrap sx={{ flex: 1, textDecoration: isDone(k) ? 'line-through' : 'none', opacity: isDone(k) ? 0.6 : 1 }}>{k.title}</Typography>
                      <Typography variant="caption" sx={{ color: STATUS_MAP[statusOf(k)].color, fontWeight: 600, whiteSpace: 'nowrap' }}>{STATUS_MAP[statusOf(k)].label}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => { setDetailId(null); remove(it); }} sx={{ textTransform: 'none' }}>削除</Button>
          <Button variant="contained" disableElevation onClick={close} sx={{ textTransform: 'none' }}>閉じる</Button>
        </DialogActions>
      </Dialog>
    );
  };

  /** スプリントパネル（ボード表示・全幅） */
  const renderSprintPanel = (sprint: Sprint, isCurrent: boolean) => {
    const list = bySprint.get(sprint.id) || [];
    const inRange = sprint.startDate <= today && today <= sprint.endDate;
    const overdue = sprint.endDate < today;
    return (
      <Paper
        key={sprint.id} elevation={0}
        sx={{ ...SECTION_SX, p: 2, borderColor: isCurrent ? 'light-dark(#0875a6, #4fc3f7)' : 'divider' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 15 }}>Sprint {sprint.seq}</Typography>
          {inRange && isCurrent && <Chip label="進行中" size="small" color="info" sx={{ height: 20 }} />}
          {overdue && <Chip label="期限超過" size="small" color="error" variant="outlined" sx={{ height: 20 }} />}
          {dateEditId === sprint.id ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
              <TextField
                type="date" size="small" value={sprint.startDate} autoFocus
                onChange={(e) => e.target.value && patchSprint(sprint.id, { startDate: e.target.value })}
                sx={{ '& input': { fontSize: 12, py: 0.4 } }}
              />
              <Typography variant="caption">–</Typography>
              <TextField
                type="date" size="small" value={sprint.endDate}
                onChange={(e) => e.target.value && patchSprint(sprint.id, { endDate: e.target.value })}
                sx={{ '& input': { fontSize: 12, py: 0.4 } }}
              />
              <Button size="small" onClick={() => setDateEditId(null)} sx={{ textTransform: 'none', minWidth: 0 }}>OK</Button>
            </Box>
          ) : (
            <Tooltip title="クリックで期間を編集" arrow>
              <Typography
                variant="caption" onClick={() => setDateEditId(sprint.id)}
                sx={{ color: 'text.secondary', cursor: 'pointer', ml: 0.5, textDecoration: 'underline dotted', textUnderlineOffset: 3 }}
              >
                {md(sprint.startDate)} – {md(sprint.endDate)}
              </Typography>
            </Tooltip>
          )}
          <Box sx={{ flex: 1 }} />
          {isCurrent && (
            <Button
              size="small" variant="outlined" color="success" startIcon={<CheckCircleOutlineRoundedIcon />}
              onClick={() => completeSprint(sprint)}
              sx={{ textTransform: 'none', whiteSpace: 'nowrap', py: 0.25 }}
            >
              完了
            </Button>
          )}
          <IconButton size="small" onClick={() => removeSprint(sprint)}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ mt: 1 }}>{renderColumnSummary(list)}</Box>
        <DroppableZone droppableId={sprintDropId(sprint.id)}>
          {list.length === 0 ? (
            <Box sx={{ py: 1.5, textAlign: 'center', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                ここに要件をドロップして割り当て
              </Typography>
            </Box>
          ) : (
            <SortableContext items={list.map(r => r.id)} strategy={verticalListSortingStrategy}>
              {list.map(reqCard)}
            </SortableContext>
          )}
        </DroppableZone>
      </Paper>
    );
  };

  /** タイムライン表示（カレンダー/ロードマップ相当）。月グリッド＋スプリント帯＋今日線。 */
  const renderTimeline = () => {
    if (sprintList.length === 0) {
      return (
        <Paper elevation={0} sx={{ ...SECTION_SX, p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            スプリントがありません。「スプリント作成」から始めてください。
          </Typography>
        </Paper>
      );
    }
    const DAY = 86400e3;
    const toMs = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();
    const minMs = Math.min(...sprintList.map(s => toMs(s.startDate)), toMs(today)) - 2 * DAY;
    const maxMs = Math.max(...sprintList.map(s => toMs(s.endDate)), toMs(today)) + 4 * DAY;
    const span = maxMs - minMs;
    const pctOf = (ms: number) => ((ms - minMs) / span) * 100;
    const todayPct = pctOf(toMs(today) + DAY / 2);
    // 月境界（範囲内の毎月1日）
    const months: { label: string; p: number }[] = [];
    const cur = new Date(minMs);
    cur.setUTCDate(1);
    for (;;) {
      cur.setUTCMonth(cur.getUTCMonth() + 1);
      if (cur.getTime() >= maxMs) break;
      months.push({ label: `${cur.getUTCMonth() + 1}月`, p: pctOf(cur.getTime()) });
    }
    const LABEL_W = 92;
    return (
      <Paper elevation={0} sx={{ ...SECTION_SX, p: 2, pt: 1.5 }}>
        {/* 月ラベル */}
        <Box sx={{ position: 'relative', ml: `${LABEL_W}px`, height: 18, mb: 0.5 }}>
          {months.map(m => (
            <Typography key={`${m.label}-${m.p}`} variant="caption" sx={{ position: 'absolute', left: `${m.p}%`, transform: 'translateX(-50%)', color: 'text.secondary' }}>
              {m.label}
            </Typography>
          ))}
        </Box>
        <Box sx={{ position: 'relative' }}>
          {/* 月グリッド線・今日線（全行を貫く） */}
          <Box sx={{ position: 'absolute', top: 0, bottom: 0, left: `${LABEL_W}px`, right: 0, pointerEvents: 'none' }}>
            {months.map(m => (
              <Box key={m.p} sx={{ position: 'absolute', left: `${m.p}%`, top: 0, bottom: 0, borderLeft: '1px dashed', borderColor: 'divider' }} />
            ))}
            {todayPct >= 0 && todayPct <= 100 && (
              <Box sx={{ position: 'absolute', left: `${todayPct}%`, top: 0, bottom: 0, borderLeft: '2px solid', borderColor: 'light-dark(#c62828, #ef5350)' }}>
                <Typography variant="caption" sx={{ position: 'absolute', top: -4, left: 4, color: 'light-dark(#c62828, #ef5350)', whiteSpace: 'nowrap' }}>今日</Typography>
              </Box>
            )}
          </Box>
          {/* スプリント帯（1行=1スプリント。帯=期間、下地=完了率、ドット=要件カテゴリ） */}
          {sprintList.map(s => {
            const list = bySprint.get(s.id) || [];
            const doneCount = list.filter(isDone).length;
            const isCur = currentSprint?.id === s.id;
            const left = pctOf(toMs(s.startDate));
            const width = Math.max(pctOf(toMs(s.endDate) + DAY) - left, 1.5);
            return (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', height: 44 }}>
                <Typography variant="body2" sx={{ width: LABEL_W, flexShrink: 0, fontWeight: isCur ? 700 : 500, opacity: s.archived ? 0.6 : 1 }}>
                  Sprint {s.seq}
                </Typography>
                <Box sx={{ flex: 1, position: 'relative', height: 30 }}>
                  <Box sx={{
                    position: 'absolute', left: `${left}%`, width: `${width}%`, top: 2, bottom: 2,
                    borderRadius: 1.5, border: '1px solid', overflow: 'hidden',
                    borderColor: isCur ? 'light-dark(#0875a6, #4fc3f7)' : 'divider',
                    bgcolor: s.archived
                      ? 'light-dark(rgba(46,125,50,0.08), rgba(102,187,106,0.08))'
                      : 'light-dark(rgba(8,117,166,0.08), rgba(79,195,247,0.08))',
                    opacity: s.archived ? 0.8 : 1,
                    display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75,
                  }}>
                    {/* 完了率の下地 */}
                    {list.length > 0 && (
                      <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(doneCount / list.length) * 100}%`, bgcolor: 'light-dark(rgba(46,125,50,0.16), rgba(102,187,106,0.16))' }} />
                    )}
                    <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', zIndex: 1 }}>
                      {md(s.startDate)}–{md(s.endDate)}{list.length ? ` ${doneCount}/${list.length}` : ''}
                    </Typography>
                    {list.map(r => (
                      <Tooltip key={r.id} arrow title={`${keyOf(r)}: ${r.title}（${STATUS_MAP[statusOf(r)].label}）`}>
                        <Box sx={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                          bgcolor: r.category ? CAT_MAP[r.category]?.color : 'text.disabled',
                          opacity: isDone(r) ? 0.55 : 1,
                        }} />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
        {/* カテゴリ凡例（使われているものだけ） */}
        {(() => {
          const used = [...new Set(requirements.map(r => r.category).filter(Boolean))] as string[];
          if (!used.length) return null;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mt: 1.5, pl: `${LABEL_W}px` }}>
              {used.map(id => <CatDot key={id} id={id} withLabel />)}
            </Box>
          );
        })()}
      </Paper>
    );
  };

  /** 履歴（アーカイブ済みスプリント）の1行 */
  const renderArchivedRow = (sprint: Sprint) => {
    const list = bySprint.get(sprint.id) || [];
    const doneCount = list.filter(isDone).length;
    return (
      <Paper key={sprint.id} elevation={0} sx={{ ...SECTION_SX, p: 1.5, opacity: 0.85 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Sprint {sprint.seq}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {md(sprint.startDate)} – {md(sprint.endDate)}
          </Typography>
          {list.length > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {doneCount}/{list.length} 完了
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Tooltip title="アーカイブを解除して戻す" arrow>
            <IconButton size="small" onClick={() => unarchiveSprint(sprint)}>
              <UnarchiveRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => removeSprint(sprint)}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Box>
        {list.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
            {list.map(r => (
              <Tooltip key={r.id} title={r.title} arrow>
                <Chip
                  icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', ml: 0.75, bgcolor: r.category ? CAT_MAP[r.category]?.color : 'text.disabled' }} />}
                  label={`${keyOf(r)}: ${r.title.length > 18 ? `${r.title.slice(0, 18)}…` : r.title}`}
                  size="small"
                  sx={{ height: 22, fontSize: 11, textDecoration: isDone(r) ? 'line-through' : 'none', opacity: isDone(r) ? 0.7 : 1 }}
                />
              </Tooltip>
            ))}
          </Box>
        )}
      </Paper>
    );
  };

  const renderToggle = (label: string, count: number, open: boolean, onToggle: () => void) => (
    <Button
      onClick={onToggle} size="small"
      startIcon={open ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
      sx={{ textTransform: 'none', color: 'text.secondary', alignSelf: 'flex-start', fontWeight: 600 }}
    >
      {label}（{count}）
    </Button>
  );

  const loading = !loaded.items || !loaded.sprints;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2.5, overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <FactCheckRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>開発状況</Typography>
        {/* 表示切替 */}
        <ToggleButtonGroup
          size="small" exclusive value={view}
          onChange={(_, v) => changeView(v)}
          sx={{ ml: 1, '& .MuiToggleButton-root': { textTransform: 'none', px: 1.25, py: 0.25, fontSize: 13 } }}
        >
          <ToggleButton value="board"><ViewKanbanRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />ボード</ToggleButton>
          <ToggleButton value="timeline"><ViewTimelineRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />タイムライン</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined" size="small" startIcon={<AddRoundedIcon />}
          onClick={openCreateSprint} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          スプリント作成
        </Button>
      </Box>

      {error && (
        <Paper elevation={0} sx={{ ...SECTION_SX, borderColor: 'error.main', color: 'error.main', p: 2 }}>{error}</Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : view === 'timeline' ? (
        renderTimeline()
      ) : (
        <DndContext
          sensors={sensors} collisionDetection={collisionStrategy}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}
        >
          {/* ── 現在のスプリント（全幅） ─────────────────────── */}
          {currentSprint && renderSprintPanel(currentSprint, true)}

          {/* ── 今後のスプリント（開閉式） ───────────────────── */}
          {upcoming.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {renderToggle('今後のスプリント', upcoming.length, upcomingOpen, () => setUpcomingOpen(o => !o))}
              <Collapse in={upcomingOpen} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {upcoming.map(s => renderSprintPanel(s, false))}
                </Box>
              </Collapse>
            </Box>
          )}

          {/* ── 下段: 要求定義（左）/ バックログ（右）。常に半々（minmax(0,1fr)で
                長い要件タイトルに列幅を引っ張られないようにする） ─────────── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
            <Paper elevation={0} sx={{ ...SECTION_SX, p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16, mb: 1 }}>要求定義</Typography>
              <DroppableZone droppableId={REQUESTS_DROP_ID}>
                {requests.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>まだ項目がありません。</Typography>
                ) : (
                  <SortableContext items={requests.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    {requests.map(item => (
                      <SortableRequestRow key={item.id} item={item} childItems={childrenOf(item.id)} onRemove={remove} onOpenDetail={openDetail} />
                    ))}
                  </SortableContext>
                )}
              </DroppableZone>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
                <TextField
                  size="small" placeholder="要求を追加（例: 〜できるようにしたい）…" value={newReqTitleReq}
                  onChange={(e) => setNewReqTitleReq(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addRequest(); }}
                  sx={{ flex: 1, minWidth: 140 }}
                />
                <Button
                  variant="contained" size="small" disableElevation startIcon={<AddRoundedIcon />}
                  onClick={() => void addRequest()} disabled={!newReqTitleReq.trim()}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  追加
                </Button>
              </Box>
            </Paper>

            <Paper elevation={0} sx={{ ...SECTION_SX, p: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 16, mb: 1 }}>バックログ</Typography>
              <DroppableZone droppableId={BACKLOG_DROP_ID}>
                {backlog.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 0.5 }}>
                    未アサインの要件はありません。
                  </Typography>
                ) : (
                  <SortableContext items={backlog.map(r => r.id)} strategy={verticalListSortingStrategy}>
                    {backlog.map(reqCard)}
                  </SortableContext>
                )}
              </DroppableZone>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 1.5 }}>
                <TextField
                  size="small" placeholder="要件を追加（例: ○○機能を実装する）…" value={newReqTitle}
                  onChange={(e) => setNewReqTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addRequirement(); }}
                  sx={{ flex: 1, minWidth: 160 }}
                />
                <Select
                  size="small" displayEmpty value={newReqCategory}
                  onChange={(e) => setNewReqCategory(e.target.value)}
                  renderValue={(v) => v ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><CatDot id={v as string} /> {CAT_MAP[v as string]?.label}</Box> : <em style={{ color: 'gray' }}>カテゴリ</em>}
                  MenuProps={MENU_PROPS}
                  sx={{ height: 40, minWidth: 120, fontSize: 13 }}
                >
                  <MenuItem value=""><em>カテゴリなし</em></MenuItem>
                  {CATEGORIES.map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><CatDot id={c.id} /> {c.label}</Box>
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  size="small" displayEmpty value={newReqParent}
                  onChange={(e) => setNewReqParent(e.target.value)}
                  MenuProps={MENU_PROPS}
                  sx={{ height: 40, minWidth: 108, fontSize: 13 }}
                >
                  <MenuItem value=""><em>要求なし</em></MenuItem>
                  {requests.map(r => (
                    <MenuItem key={r.id} value={r.id}>
                      {keyOf(r)}: {r.title.length > 12 ? `${r.title.slice(0, 12)}…` : r.title}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  variant="contained" size="small" disableElevation startIcon={<AddRoundedIcon />}
                  onClick={() => void addRequirement()} disabled={!newReqTitle.trim()}
                  sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                >
                  追加
                </Button>
              </Box>
            </Paper>
          </Box>

          {/* ── スプリント履歴（アーカイブ済み・開閉式） ─────────── */}
          {archivedSprints.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {renderToggle('スプリント履歴', archivedSprints.length, historyOpen, () => setHistoryOpen(o => !o))}
              <Collapse in={historyOpen} timeout="auto" unmountOnExit>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {archivedSprints.map(renderArchivedRow)}
                </Box>
              </Collapse>
            </Box>
          )}

          {/* ドラッグ中の見た目（ポインタ追従・持ち上がり表現＋滑らかな着地） */}
          <DragOverlay dropAnimation={DROP_ANIMATION}>
            {activeDragItem ? (
              <Paper elevation={8} sx={{ ...SECTION_SX, ...DRAG_OVERLAY_SX, p: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <DragIndicatorRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                <CatDot id={activeDragItem.category} withLabel />
                <Chip label={keyOf(activeDragItem)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{activeDragItem.title}</Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── 要求/要件の詳細ダイアログ（全文・編集） ───────────── */}
      {renderDetailDialog()}

      {/* ── 確認ダイアログ（削除・スプリント完了） ─────────────── */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: DIALOG_PAPER_SX } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>{confirm?.title}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>{confirm?.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }}>キャンセル</Button>
          <Button
            variant="contained" disableElevation color={confirm?.color || 'error'}
            onClick={() => { confirm?.action(); setConfirm(null); }}
            sx={{ textTransform: 'none' }}
          >
            {confirm?.actionLabel || 'OK'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── スプリント作成ダイアログ（期間を設定して作成） ──────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: DIALOG_PAPER_SX } }}>
        <DialogTitle sx={{ fontSize: 16, fontWeight: 700 }}>
          Sprint {(sprintList[sprintList.length - 1]?.seq || 0) + 1} を作成
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
            <TextField
              label="開始" type="date" size="small" value={createStart}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                setCreateStart(v);
                if (!createEnd || createEnd < v) setCreateEnd(addDays(v, 13));
              }}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>–</Typography>
            <TextField
              label="終了" type="date" size="small" value={createEnd}
              onChange={(e) => e.target.value && setCreateEnd(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            既定は{sprintList.length ? '前回スプリント終了日の翌日' : '今日'}から2週間。
            {createEnd && createStart && createEnd >= createStart &&
              ` 期間: ${Math.round((new Date(createEnd).getTime() - new Date(createStart).getTime()) / 86400e3) + 1} 日間`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>キャンセル</Button>
          <Button
            variant="contained" disableElevation
            disabled={!createStart || !createEnd || createEnd < createStart}
            onClick={() => void createSprint()}
            sx={{ textTransform: 'none' }}
          >
            作成
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
