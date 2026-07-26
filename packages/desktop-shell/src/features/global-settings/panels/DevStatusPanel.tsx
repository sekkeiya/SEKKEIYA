// Global Settings > 管理者 > 開発状況（管理者専用）。
// 要求 → 要件（1対多）→ スプリント（期間）を管理する。表示は4タブで切替:
//   - ボード      : 既存の D&D カンバン（スプリントへドラッグで割当・完了/アーカイブ）。
//   - 要求・要件  : Excel 風の階層テーブル（要求＝親行 / 要件＝子行。セル直接編集）。
//   - タイムライン: 月グリッド上にスプリント帯（カレンダー/ロードマップ相当）。
//   - 機能一覧    : 着手以降の要件を プラットフォーム×子アプリ で自動集計（読み取り専用）。
// 分類は4軸: プラットフォーム(platform 大) / 子アプリ(category 中) / 画面(screen 小) / 種別(kind)。
//   要求が既定値(platform/category)を持ち、その下に追加する要件が継承する。
// - 要件の状態は 未着手/着手/テスト/完了 の4択。期限は個別に持たず「所属スプリント終了日」に一本化。
// - 削除・スプリント完了は window.confirm ではなく MUI Dialog で確認する。
// データ: Firestore /devBacklog（項目）+ /devSprints（スプリント）。管理者のみ読み書き。onSnapshot で即時同期。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, IconButton, Chip,
  LinearProgress, Tooltip, CircularProgress, Select, MenuItem, Collapse, Checkbox, Menu, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import UnarchiveRoundedIcon from '@mui/icons-material/UnarchiveRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import ViewTimelineRoundedIcon from '@mui/icons-material/ViewTimelineRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  pointerWithin, rectIntersection, useDroppable, MeasuringStrategy,
  defaultDropAnimationSideEffects,
  type DragEndEvent, type DragStartEvent, type CollisionDetection, type DropAnimation,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
// serverTimestamp は queuedAt/archivedAt などデータ値の sentinel 生成にのみ使う（直 DB 呼びは無し）。
// Firestore/Storage の読み書きはすべて BacklogStore（./backlog/FirestoreBacklogStore）経由。
import { serverTimestamp } from 'firebase/firestore';
import { firestoreBacklogStore as store } from './backlog/FirestoreBacklogStore';
import { isTauri } from '../../../lib/platform';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import {
  statusOf, isDone, resolveEffective, resizeWidth, autoCheckIds, queueTargetIds,
  CATEGORIES, CAT_MAP, toolLabel,
  sortRequirements, filterRequirements, type SortKey, type SortState, type FilterState,
  allFixesDone, addFix, toggleFix, updateFixText, removeFix, type Fix,
  timelineTicks, PX_PER_DAY, SCALE_LABEL, type TimeScale,
  sprintRangeById, requestSpan, statusBreakdown, completionRate,
  sortByLanding, partitionHistory, isRequestAtRisk, groupRequests, type GroupKey,
  DEFAULT_PROJECT_KEY,
} from './devStatusLogic';
// 行/セルの共有定義（型・定数・スタイル・小ヘルパー）と presentational コンポーネントは
// backlog/ 配下に切り出し、メモ化した行コンポーネント（RequirementRow / RequestRow）を組む。
import {
  STATUSES, STATUS_MAP, PLATFORMS, PLATFORM_MAP, KIND_MAP,
  STATUS_ORDER, KIND_ORDER, PLATFORM_ORDER, CATEGORY_ORDER,
  SELECT_SX, MENU_PROPS, MENU_PAPER_SX, OPAQUE_MENU_BG, keyOf, COL_COUNT,
  type BacklogType, type ReqStatus, type Platform, type Kind,
} from './backlog/rowConstants';
import {
  CatDot, PlatformBadge, ToolDot,
  PlatformSelect, CategorySelect, ScreenSelect, KindSelect, StatusSelect, SprintSelect,
  InlineText, InlineAddInput,
} from './backlog/rowFields';
import { RequirementRow } from './backlog/RequirementRow';
import { RequestRow } from './backlog/RequestRow';

type ViewMode = 'board' | 'table' | 'timeline' | 'features';

export interface Attachment { url: string; path: string; name: string; }

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
const guessImageMime = (name: string): string => ({
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
} as Record<string, string>)[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'image/png';

export interface BacklogItem {
  id: string;
  type: BacklogType;
  seq?: number;              // 種別内の自動採番（要求1, 要件1 …）
  title: string;
  status?: ReqStatus;        // 要件のみ: 未着手/着手/テスト/完了
  category?: string | null;  // 中: 子アプリ scope（CATEGORIES の id）。要求は既定値。
  platform?: Platform | null;// 大: プラットフォーム。要求は既定値・要件は継承。
  screen?: string | null;    // 小: 画面・場所（自由記述・要件のみ）
  reason?: string | null;    // 理由（なぜこの要件か・自由記述・要件のみ）
  notes?: string | null;     // テストメモ／申し送り（不具合の症状・再現手順など・要件のみ）
  kind?: Kind | null;        // 種別（要件のみ）
  requestId?: string | null; // 要件のみ: 親要求（1対多・任意）
  sprintId?: string | null;  // 要件のみ: 所属スプリント（null=バックログ）
  queue?: 'implement' | 'test' | null; // 実装/テストの依頼キュー（null=依頼なし）
  queuedAt?: unknown;        // 依頼時刻（serverTimestamp）
  fixes?: Fix[];             // 要修正の修正項目（軽量チェックリスト・要件のみ）
  attachments?: Attachment[];// 添付画像（要件27・Firebase Storage の URL）
  projectKey?: string;       // プロジェクト軸（Phase 1: 既定 'sekkeiya'）
  testResult?: string | null;// テスト結果（要件62・手動テストの合否/所見。notes と分離・要件のみ）
  order?: number;            // 手動並び替え順（DnD。未設定なら seq にフォールバック）
  progress?: number;         // 旧データ互換（未使用・statusへ移行）
  done?: boolean;            // 旧データ互換（status==='done' と同期して書く）
  createdAt?: { toMillis?: () => number } | null;
  updatedAt?: unknown;
}

export interface Sprint {
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


// ── テーブル列（要件4: 内容を広く・他は狭く / 要件5: 幅をドラッグ調整） ──
type ColKey = 'content' | 'reason' | 'kind' | 'platform' | 'category' | 'screen' | 'status' | 'sprint' | 'attach' | 'testResult';
// 全列を固定幅にして横スクロールで見せる（要件5: 掴んだ境界がカーソルに追従する＝直感的なリサイズ）。
const COLS: { key: ColKey; label: string; def: number; min: number }[] = [
  { key: 'content',  label: '内容',       def: 340, min: 160 },
  { key: 'reason',   label: '理由',       def: 200, min: 120 },
  { key: 'kind',     label: '種別',       def: 78,  min: 56 },
  { key: 'platform', label: 'PF',         def: 62,  min: 48 },
  { key: 'category', label: 'ツール',     def: 116, min: 72 },
  { key: 'screen',   label: '画面',       def: 116, min: 72 },
  { key: 'status',   label: '状態',       def: 112, min: 72 },
  { key: 'sprint',   label: 'スプリント', def: 104, min: 80 },
  { key: 'attach',   label: '添付',       def: 52,  min: 40 },
  { key: 'testResult', label: 'テスト結果', def: 200, min: 120 },
];
const COL_WIDTH_STORAGE_KEY = 'sekkeiya.devStatus.colWidths';

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
const TIMESCALE_STORAGE_KEY = 'sekkeiya.devStatus.timeScale';

const SECTION_SX = {
  p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
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


// ── 要件カード（ボード・1行・ドラッグ可能） ──────────────────────
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
        <Box
          {...attributes} {...listeners}
          sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled', cursor: 'grab', touchAction: 'none', '&:active': { cursor: 'grabbing' } }}
        >
          <DragIndicatorRoundedIcon fontSize="small" />
        </Box>
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

// ── 要求カード（ボード・1行・並び替え可能。完了は子要件から導出） ──
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
  // ボードの追加フォーム
  const [newReqTitle, setNewReqTitle] = useState('');       // 要件（ボード）
  const [newReqParent, setNewReqParent] = useState('');
  const [newReqCategory, setNewReqCategory] = useState('');
  const [newReqTitleReq, setNewReqTitleReq] = useState(''); // 要求（ボード）
  // 追加入力はローカル state の InlineAddInput 側で持つ（要件24: 表全体の再描画を避ける）
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());       // テーブルの折りたたみ
  const [fixCollapsed, setFixCollapsed] = useState<Set<string>>(new Set()); // 要件25: 修正チェックリストの折りたたみ
  const [checked, setChecked] = useState<Set<string>>(new Set());           // 実装/テスト依頼の選択
  const [dateEditId, setDateEditId] = useState<string | null>(null);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState('');
  // openDetail が「前の項目へフラッシュ」するための最新値参照。detailDraft は詳細ダイアログの
  // 1 キー入力ごとに更新されるため、useCallback の依存に入れると全行が毎キー入力で再レンダーされる
  // （row-memoization を無効化する）。ref 経由で読むことで openDetail の参照を安定させる。
  const detailDraftRef = useRef(detailDraft);
  detailDraftRef.current = detailDraft;
  const [previewImg, setPreviewImg] = useState<string | null>(null); // 添付の拡大表示
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null); // 添付ダイアログの対象
  const [view, setView] = useState<ViewMode>(
    () => (localStorage.getItem(VIEW_STORAGE_KEY) as ViewMode) || 'board');
  const [timeScale, setTimeScale] = useState<TimeScale>(
    () => (localStorage.getItem(TIMESCALE_STORAGE_KEY) as TimeScale) || 'month'); // 要件16: 横軸の粒度
  const [expandedTlGroups, setExpandedTlGroups] = useState<Set<string>>(new Set()); // 要件29: タイムラインで展開中の要求（既定=閉じる＝要件を隠す）
  const [tlGroupBy, setTlGroupBy] = useState<GroupKey>('none');                     // ロードマップの行グループ（既定=時間順フラット）
  const [tlHistoryOpen, setTlHistoryOpen] = useState(false);                        // 完了した要求（履歴）の展開
  const tlScrollRef = useRef<HTMLDivElement | null>(null);                          // ロードマップの横スクロール枠
  const tlTodayLeftRef = useRef(0);                                                 // 今日線のコンテンツ座標（現在へスクロール用）
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    const base = Object.fromEntries(COLS.map(c => [c.key, c.def])) as Record<ColKey, number>;
    try { return { ...base, ...JSON.parse(localStorage.getItem(COL_WIDTH_STORAGE_KEY) || '{}') }; } catch { return base; }
  });

  // 列リサイズ（ヘッダー右端を左ドラッグ→幅変更→pointerup で localStorage 保存）
  const startColResize = (key: ColKey, e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[key];
    const min = COLS.find(c => c.key === key)?.min ?? 48;
    const onMove = (ev: PointerEvent) => setColWidths(prev => ({ ...prev, [key]: resizeWidth(startW, ev.clientX - startX, min) }));
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setColWidths(prev => { try { localStorage.setItem(COL_WIDTH_STORAGE_KEY, JSON.stringify(prev)); } catch { /* ignore */ } return prev; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    const u1 = store.subscribeItems(
      (list) => {
        setItems(list);
        setLoaded(s => ({ ...s, items: true }));
      },
      (e) => { setError((e as { message?: string })?.message || '読み込みに失敗しました'); setLoaded(s => ({ ...s, items: true })); },
    );
    const u2 = store.subscribeSprints(
      (list) => {
        setSprints(list);
        setLoaded(s => ({ ...s, sprints: true }));
      },
      (e) => { setError((e as { message?: string })?.message || 'スプリントの読み込みに失敗しました'); setLoaded(s => ({ ...s, sprints: true })); },
    );
    return () => { u1(); u2(); };
  }, []);

  // メモ化した行コンポーネントに渡すハンドラは useCallback で参照安定化する（列幅ドラッグ等の
  // 高頻度再描画で行が再レンダーしないため）。store/setError はモジュール/setState で安定。
  const patchItem = useCallback((id: string, data: Record<string, unknown>) => {
    store.updateItem(id, data)
      .catch((e) => setError((e as { message?: string })?.message || '更新に失敗しました'));
  }, []);
  const patchSprint = (id: string, data: Record<string, unknown>) => {
    store.updateSprint(id, data)
      .catch((e) => setError((e as { message?: string })?.message || '更新に失敗しました'));
  };

  const today = jstToday();
  const sprintList = useMemo(() => [...sprints].sort((a, b) => a.seq - b.seq), [sprints]);
  const activeSprints = useMemo(() => sprintList.filter(s => !s.archived), [sprintList]);
  const currentSprint = activeSprints[0] ?? null;
  const upcoming = useMemo(() => activeSprints.slice(1), [activeSprints]);
  const archivedSprints = useMemo(() => sprintList.filter(s => s.archived).sort((a, b) => b.seq - a.seq), [sprintList]);

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
  const orphanReqs = useMemo(() => requirements.filter(r => !r.requestId), [requirements]);

  // 要件2: PF/ツールは親要求から継承。要件が自分の値を持てば上書き（own ?? parent）。
  const parentOf = (it: BacklogItem) => (it.requestId ? byId.get(it.requestId) : undefined);
  const effPlatform = useCallback((it: BacklogItem): Platform | null => resolveEffective(it, (id) => byId.get(id)).platform as Platform | null, [byId]);
  const effCategory = useCallback((it: BacklogItem): string | null => resolveEffective(it, (id) => byId.get(id)).category, [byId]);
  const catColorOf = (it: BacklogItem) => { const ec = effCategory(it); return ec && CAT_MAP[ec] ? CAT_MAP[ec].color : 'text.disabled'; };
  // 要件3/6: 自由入力で増えたツール/画面の既出値を候補に足す
  const usedTools = useMemo(() => [...new Set(items.map(i => i.category).filter((v): v is string => !!v && !CAT_MAP[v]))], [items]);
  const usedScreens = useMemo(() => [...new Set(requirements.map(r => r.screen).filter((v): v is string => !!v))], [requirements]);

  // 実装/テスト依頼の選択操作
  const toggleItemCheck = useCallback((id: string) =>
    setChecked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  // 要求チェック: 対象状態の子要件をまとめて ON/OFF（全部入っていれば外す、そうでなければ全部入れる）
  const toggleRequestCheck = useCallback((reqId: string) =>
    setChecked(s => {
      const ids = autoCheckIds(reqId, requirements);
      const allOn = ids.length > 0 && ids.every(id => s.has(id));
      const n = new Set(s);
      ids.forEach(id => { if (allOn) n.delete(id); else n.add(id); });
      return n;
    }), [requirements]);

  // 実装/テストの依頼キュー（Firestore に queue フラグを書く）
  const implTargets = useMemo(() => queueTargetIds(checked, requirements, 'implement'), [checked, requirements]);
  const testTargets = useMemo(() => queueTargetIds(checked, requirements, 'test'), [checked, requirements]);
  // 要件23: 選択された修正項目の親要件も実装キュー対象にする（Claude は親要件の未完の修正を実装する）
  const fixParentIds = useMemo(() => {
    const ids = new Set<string>();
    requirements.forEach(r => { if (r.fixes?.some(f => checked.has(f.id))) ids.add(r.id); });
    return [...ids];
  }, [checked, requirements]);
  const implAll = useMemo(() => [...new Set([...implTargets, ...fixParentIds])], [implTargets, fixParentIds]);
  // 1ボタンで統合: 選択のうち実装対象は implement、テスト対象は test をまとめて依頼する。
  const enqueueSelected = () => {
    implAll.forEach(id => patchItem(id, { queue: 'implement', queuedAt: serverTimestamp() }));
    testTargets.forEach(id => patchItem(id, { queue: 'test', queuedAt: serverTimestamp() }));
    setChecked(new Set()); // 依頼後は選択をクリア
  };
  // ボタン表示: 実装だけ/テストだけ/両方 で文言を切り替える
  const dispatchLabel = (() => {
    const i = implAll.length, t = testTargets.length;
    if (i && t) return `実装/テスト実行 (${i + t})`;
    if (i) return `実装 (${i})`;
    if (t) return `テスト作成/実行 (${t})`;
    return '実装/テスト実行 (0)';
  })();

  // ── ソート/フィルタ（要件12: 並び替え / 要件14: ヘッダーメニューで絞り込み） ──
  const [sort, setSort] = useState<SortState>({ key: null, dir: 'asc' });
  const [filters, setFilters] = useState<FilterState>({});
  const [headerMenu, setHeaderMenu] = useState<{ anchor: HTMLElement; key: SortKey } | null>(null);
  const SORT_KEYS: SortKey[] = ['kind', 'platform', 'category', 'screen', 'status', 'sprint'];
  // 論理順（STATUS_ORDER 等）は backlog/rowConstants.ts の定数を import して使う。
  const sprintSeqOf = useCallback((id?: string | null) => id ? (sprints.find(s => s.id === id)?.seq ?? 998) : 999, [sprints]); // バックログは最後
  // ソート用の値（実効値・論理順）
  const sortValueOf = useCallback((item: BacklogItem, key: SortKey): string | number => {
    switch (key) {
      case 'kind': return item.kind ? (KIND_ORDER[item.kind] ?? 900) : 999;
      case 'platform': { const p = effPlatform(item); return p ? (PLATFORM_ORDER[p] ?? 900) : 999; }
      case 'category': { const c = effCategory(item); return c ? (CATEGORY_ORDER[c] ?? 900) : 999; }
      case 'screen': return (item.screen ?? '').toLowerCase();
      case 'status': return STATUS_ORDER[statusOf(item)] ?? 999;
      case 'sprint': return sprintSeqOf(item.sprintId);
    }
  }, [effPlatform, effCategory, sprintSeqOf]);
  // フィルタ用の離散値（空文字＝未設定）
  const filterKeyOf = useCallback((item: BacklogItem, key: SortKey): string => {
    switch (key) {
      case 'kind': return item.kind ?? '';
      case 'platform': return effPlatform(item) ?? '';
      case 'category': return effCategory(item) ?? '';
      case 'screen': return item.screen ?? '';
      case 'status': return statusOf(item);
      case 'sprint': return item.sprintId ?? '';
    }
  }, [effPlatform, effCategory]);
  const filterActive = Object.keys(filters).length > 0;
  const applyView = useCallback((list: BacklogItem[]) =>
    sortRequirements(filterRequirements(list, filters, filterKeyOf), sort, sortValueOf), [filters, sort, filterKeyOf, sortValueOf]);
  // フィルタメニューの値ラベル
  const valueLabel = (key: SortKey, v: string): string => {
    if (v === '') return '（未設定）';
    switch (key) {
      case 'kind': return KIND_MAP[v]?.label ?? v;
      case 'platform': return PLATFORM_MAP[v]?.label ?? v;
      case 'category': return toolLabel(v);
      case 'screen': return v;
      case 'status': return STATUS_MAP[v]?.label ?? v;
      case 'sprint': { const s = sprints.find(x => x.id === v); return s ? `Sprint ${s.seq}` : v; }
    }
  };
  // その列に実在する離散値（論理順に並べる）
  const valueOrder = (key: SortKey, v: string): number | string => {
    if (v === '') return 9999;
    switch (key) {
      case 'kind': return KIND_ORDER[v] ?? 900;
      case 'platform': return PLATFORM_ORDER[v] ?? 900;
      case 'category': return CATEGORY_ORDER[v] ?? 900;
      case 'screen': return v.toLowerCase();
      case 'status': return STATUS_ORDER[v] ?? 900;
      case 'sprint': return sprintSeqOf(v);
    }
  };
  const distinctValues = (key: SortKey): string[] =>
    [...new Set(requirements.map(r => filterKeyOf(r, key)))]
      .sort((a, b) => { const oa = valueOrder(key, a), ob = valueOrder(key, b); return oa < ob ? -1 : oa > ob ? 1 : 0; });
  const toggleFilterValue = (key: SortKey, v: string) => {
    const all = distinctValues(key);
    setFilters(f => {
      const cur = f[key] ?? all;
      const next = cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v];
      const nf = { ...f };
      if (next.length >= all.length) delete nf[key]; else nf[key] = next; // 全部ON→フィルタ解除
      return nf;
    });
  };
  const setFilterAll = (key: SortKey) => setFilters(f => { const nf = { ...f }; delete nf[key]; return nf; });
  const setFilterNone = (key: SortKey) => setFilters(f => ({ ...f, [key]: [] }));

  // ヘッダークリックの統合メニュー（上=並び替え / 下=絞り込みチェックリスト）
  const renderHeaderMenuItems = (key: SortKey) => {
    const allowed = filters[key];
    return [
      <MenuItem key="asc" selected={sort.key === key && sort.dir === 'asc'} onClick={() => { setSort({ key, dir: 'asc' }); setHeaderMenu(null); }}>
        <Typography variant="body2">▲ 昇順で並び替え</Typography>
      </MenuItem>,
      <MenuItem key="desc" selected={sort.key === key && sort.dir === 'desc'} onClick={() => { setSort({ key, dir: 'desc' }); setHeaderMenu(null); }}>
        <Typography variant="body2">▼ 降順で並び替え</Typography>
      </MenuItem>,
      ...(sort.key === key
        ? [<MenuItem key="clr" onClick={() => { setSort({ key: null, dir: 'asc' }); setHeaderMenu(null); }}><Typography variant="body2" sx={{ color: 'text.secondary' }}>並び替えを解除</Typography></MenuItem>]
        : []),
      <Divider key="dv" />,
      <Box key="fh" sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.25 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>絞り込み</Typography>
        <Button size="small" onClick={() => setFilterAll(key)} sx={{ textTransform: 'none', minWidth: 0, px: 0.75 }}>すべて</Button>
        <Button size="small" onClick={() => setFilterNone(key)} sx={{ textTransform: 'none', minWidth: 0, px: 0.75 }}>クリア</Button>
      </Box>,
      ...distinctValues(key).map(v => (
        <MenuItem key={`f-${v || '__empty'}`} dense onClick={() => toggleFilterValue(key, v)} sx={{ py: 0 }}>
          <Checkbox size="small" checked={!allowed || allowed.includes(v)} sx={{ p: 0.5 }} />
          <Typography variant="body2" sx={{ fontSize: 13 }}>{valueLabel(key, v)}</Typography>
        </MenuItem>
      )),
    ];
  };

  const nextSeq = useCallback((type: BacklogType) =>
    Math.max(0, ...items.filter(i => i.type === type).map(i => i.seq || 0)) + 1, [items]);

  const changeView = (v: ViewMode | null) => {
    if (!v) return;
    setView(v);
    try { localStorage.setItem(VIEW_STORAGE_KEY, v); } catch { /* private mode 等は無視 */ }
  };
  const changeScale = (v: TimeScale | null) => {
    if (!v) return;
    setTimeScale(v);
    try { localStorage.setItem(TIMESCALE_STORAGE_KEY, v); } catch { /* private mode 等は無視 */ }
  };
  const toggleTlGroup = (key: string) =>
    setExpandedTlGroups(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  // 今日線が見える位置（ビューポート左から約35%）へ横スクロール
  const scrollToToday = (smooth = true) => {
    const el = tlScrollRef.current;
    if (!el) return;
    const target = Math.max(0, tlTodayLeftRef.current - el.clientWidth * 0.35);
    el.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
  };
  // タイムラインを開いた／粒度を変えた直後に今日へスクロール（描画後の次フレームで）
  useEffect(() => {
    if (view !== 'timeline') return;
    const id = requestAnimationFrame(() => scrollToToday(false));
    return () => cancelAnimationFrame(id);
  }, [view, timeScale, items.length, sprints.length]);

  const toggleCollapse = useCallback((id: string) =>
    setCollapsed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);
  const isExpanded = (id: string) => !collapsed.has(id);
  const toggleFixCollapse = useCallback((id: string) =>
    setFixCollapsed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  // ── 追加系（共通コア＋各フォーム） ────────────────────────────────
  const createRequest = useCallback(async (rawTitle: string, extra?: Partial<BacklogItem>) => {
    const title = rawTitle.trim();
    if (!title) return;
    try {
      await store.addItem({
        type: 'request', seq: nextSeq('request'), title,
        platform: extra?.platform ?? null, category: extra?.category ?? null,
        projectKey: DEFAULT_PROJECT_KEY,
      });
    } catch (e) { setError(e instanceof Error ? e.message : '追加に失敗しました'); }
  }, [nextSeq]);
  const createRequirement = useCallback(async (rawTitle: string, extra: Partial<BacklogItem>) => {
    const title = rawTitle.trim();
    if (!title) return;
    try {
      await store.addItem({
        type: 'requirement', seq: nextSeq('requirement'), title,
        status: 'todo', done: false,
        category: extra.category ?? null,
        platform: extra.platform ?? null,
        kind: extra.kind ?? null,
        screen: null, reason: null, notes: null,
        requestId: extra.requestId ?? null,
        sprintId: extra.sprintId ?? null,
        projectKey: DEFAULT_PROJECT_KEY,
      });
    } catch (e) { setError(e instanceof Error ? e.message : '追加に失敗しました'); }
  }, [nextSeq]);

  // ボード用フォーム
  const addRequest = async () => { const t = newReqTitleReq.trim(); if (!t) return; setNewReqTitleReq(''); await createRequest(t); };
  const addRequirement = async () => {
    const t = newReqTitle.trim(); if (!t) return;
    setNewReqTitle(''); setNewReqParent(''); setNewReqCategory('');
    await createRequirement(t, { requestId: newReqParent || null, category: newReqCategory || null });
  };
  // 修正項目（要修正の要件にぶら下げる軽量チェックリスト）
  const applyFixes = useCallback((item: BacklogItem, newFixes: Fix[]) => {
    const data: Record<string, unknown> = { fixes: newFixes };
    // 全修正が完了 & 要修正 → 自動でテストへ戻す
    if (allFixesDone(newFixes) && statusOf(item) === 'rework') { data.status = 'testing'; data.done = false; }
    patchItem(item.id, data);
  }, [patchItem]);
  const addFixText = useCallback((item: BacklogItem, text: string) => applyFixes(item, addFix(item.fixes, crypto.randomUUID(), text)), [applyFixes]);
  const toggleFixOf = useCallback((item: BacklogItem, id: string) => applyFixes(item, toggleFix(item.fixes ?? [], id)), [applyFixes]);
  const updateFixTextOf = useCallback((item: BacklogItem, id: string, text: string) => applyFixes(item, updateFixText(item.fixes ?? [], id, text)), [applyFixes]);
  const removeFixOf = useCallback((item: BacklogItem, id: string) => applyFixes(item, removeFix(item.fixes ?? [], id)), [applyFixes]);

  // 添付画像（要件27・Firebase Storage）。arrayUnion/arrayRemove で競合なく追加/削除。
  const uploadAttachment = async (itemId: string, file: File | Blob, name: string) => {
    try {
      await store.uploadAttachment(itemId, file, name);
    } catch (e) { setError(e instanceof Error ? e.message : '添付のアップロードに失敗しました'); }
  };
  const removeAttachment = (itemId: string, att: Attachment) => {
    store.removeAttachment(itemId, att)
      .catch(e => setError(e instanceof Error ? e.message : '添付の削除に失敗しました'));
  };
  // クリップボード/ファイル選択から画像を取り込む（Web の HTML5 D&D もこれ）
  const handlePasteAttach = (itemId: string, e: React.ClipboardEvent) => {
    const imgs = [...e.clipboardData.items].filter(i => i.type.startsWith('image/'));
    if (imgs.length === 0) return;
    e.preventDefault();
    imgs.forEach(it => { const f = it.getAsFile(); if (f) void uploadAttachment(itemId, f, f.name || 'pasted.png'); });
  };
  const handlePickAttach = (itemId: string, files: FileList | null) => {
    if (!files) return;
    [...files].forEach(f => void uploadAttachment(itemId, f, f.name));
  };
  // Tauri は OS ファイルドロップを横取りするため、HTML5 ondrop ではなく onDragDropEvent で受ける。
  // 添付ダイアログを開いている間だけ有効化し、ドロップされた画像パスを読んでアップロードする。
  const [attachDragOver, setAttachDragOver] = useState(false);
  useEffect(() => {
    if (!attachTargetId || !isTauri()) return;
    const targetId = attachTargetId;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrentWebview } = await import('@tauri-apps/api/webview');
        const { invoke } = await import('@tauri-apps/api/core');
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
          const p = event?.payload as { type: string; paths?: string[] } | undefined;
          if (!p) return;
          if (p.type === 'over' || p.type === 'enter') { setAttachDragOver(true); return; }
          if (p.type === 'leave') { setAttachDragOver(false); return; }
          if (p.type !== 'drop') return;
          setAttachDragOver(false);
          for (const path of (p.paths ?? [])) {
            const name = path.split(/[\\/]/).pop() || 'image.png';
            if (!IMAGE_EXT_RE.test(name)) continue; // 画像だけ
            try {
              const bytes = await invoke<number[]>('read_local_binary_file', { path });
              await uploadAttachment(targetId, new File([new Uint8Array(bytes)], name, { type: guessImageMime(name) }), name);
            } catch (e) { console.warn('[DevStatus] read dropped file failed:', path, e); }
          }
        });
      } catch (e) { console.warn('[DevStatus] onDragDrop wiring failed:', e); }
    })();
    return () => { setAttachDragOver(false); if (unlisten) unlisten(); };
  }, [attachTargetId]);

  const addChildText = useCallback((req: BacklogItem, text: string) =>
    void createRequirement(text, { requestId: req.id, platform: req.platform ?? null, category: req.category ?? null }), [createRequirement]);

  /** 項目削除（確認ダイアログ経由） */
  const remove = useCallback((item: BacklogItem) => {
    const children = item.type === 'request' ? requirements.filter(r => r.requestId === item.id) : [];
    setConfirm({
      title: `${keyOf(item)} を削除`,
      message: `「${item.title}」を削除しますか？` +
        (children.length ? ` 子要件 ${children.length} 件は「要求なし」として残ります。` : ''),
      actionLabel: '削除', color: 'error',
      action: () => {
        children.forEach(r => patchItem(r.id, { requestId: null }));
        store.removeItem(item.id).catch((e) => setError((e as { message?: string })?.message || '削除に失敗しました'));
      },
    });
  }, [requirements, patchItem]);

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
      await store.addSprint({
        seq: (last?.seq || 0) + 1, startDate: createStart, endDate: createEnd, archived: false,
      });
    } catch (e) { setError(e instanceof Error ? e.message : 'スプリントの作成に失敗しました'); }
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
        store.removeSprint(s.id).catch((e) => setError((e as { message?: string })?.message || '削除に失敗しました'));
      },
    });
  };

  // ── ドラッグ&ドロップ（ボード。並び替え＋コンテナ間移動） ─────────
  const containerOfItem = (it: BacklogItem) =>
    it.type === 'request' ? REQUESTS_DROP_ID : (it.sprintId ? sprintDropId(it.sprintId) : BACKLOG_DROP_ID);
  const itemsInContainer = (cid: string): BacklogItem[] => {
    if (cid === REQUESTS_DROP_ID) return requests;
    if (cid === BACKLOG_DROP_ID) return backlog;
    if (cid.startsWith('sprint:')) return bySprint.get(cid.slice(7)) || [];
    return [];
  };
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
    if ((activeItem.type === 'request') !== (targetContainer === REQUESTS_DROP_ID)) return;

    if (sourceContainer === targetContainer) {
      const list = itemsInContainer(sourceContainer);
      const from = list.findIndex(i => i.id === activeId);
      let to = overItem ? list.findIndex(i => i.id === overItem.id) : list.length - 1;
      if (from < 0) return;
      if (to < 0) to = list.length - 1;
      if (from === to) return;
      persistOrder(arrayMove(list, from, to));
    } else {
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
  const openDetail = useCallback((item: BacklogItem) => {
    if (detailId && detailId !== item.id) {
      const prev = byId.get(detailId);
      const t = detailDraftRef.current.trim();
      if (prev && t && t !== prev.title) patchItem(prev.id, { title: t });
    }
    setDetailId(item.id);
    setDetailDraft(item.title);
  }, [detailId, byId, patchItem]);

  const reqCard = (item: BacklogItem) => (
    <RequirementCard
      key={item.id} item={item}
      parent={item.requestId ? byId.get(item.requestId) : undefined}
      onPatch={patchItem} onRemove={remove} onOpenDetail={openDetail}
    />
  );

  // ── テーブル: 要件行 ─────────────────────────────────────────────
  // COL_COUNT は backlog/rowConstants.ts の単一定義を使う（RequirementRow/RequestRow と共有）。
  // メモ化: 要求ごとの子要件を事前計算する（all=全件 / view=ソート・フィルタ適用）。colWidths 等の
  // データ非依存な再描画では参照が変わらないので、RequestRow / RequirementRow のメモが効く。
  const childListByReq = useMemo(() => {
    const m = new Map<string, { all: BacklogItem[]; view: BacklogItem[] }>();
    requests.forEach(req => {
      const all = requirements.filter(r => r.requestId === req.id);
      m.set(req.id, { all, view: applyView(all) });
    });
    return m;
  }, [requests, requirements, applyView]);
  // 表示する要求（フィルタ時は表示要件が1件以上ある要求のみ。元 renderTable のフィルタ条件と同一）。
  const visibleRequests = useMemo(
    () => (filterActive ? requests.filter(req => (childListByReq.get(req.id)?.view.length ?? 0) > 0) : requests),
    [requests, filterActive, childListByReq]);
  // 要求なしの要件（孤立要件）にもソート/フィルタを適用（安定参照）。
  const visibleOrphans = useMemo(() => applyView(orphanReqs), [applyView, orphanReqs]);

  /** 要求・要件テーブル（Excel 風の階層。内容を広く・メタ列は狭く/幅ドラッグ調整可） */
  const renderTable = () => {
    const EXP_W = 26, DEL_W = 30, CHK_W = 34;
    return (
    // A案: カード枠なしの全幅フラット表示（flex で残りを埋め、テーブル領域だけ縦スクロール）
    <Box sx={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 要件17: この領域を縦スクロール（th を sticky で固定）。要件22: 横スクロールはしない */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {/* width:100% + tableLayout:fixed で全列が画面内に収まる（横スクロールなし）。
            border-collapse:separate は sticky ヘッダーが枠と両立するために必要（collapse だと貼り付かない） */}
        <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, '& td, & th': { borderColor: 'divider', px: 0.75 } }}>
          <colgroup>
            <col style={{ width: CHK_W }} />{/* チェック列 */}
            <col style={{ width: EXP_W }} />
            {COLS.map(c => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
            <col style={{ width: DEL_W }} />
          </colgroup>
          <TableHead>
            <TableRow sx={{ '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 700, whiteSpace: 'nowrap', py: 0.75, position: 'sticky', top: 0, zIndex: 3, bgcolor: OPAQUE_MENU_BG, borderBottom: '1px solid', borderColor: 'divider' } }}>
              <TableCell padding="none" />{/* チェック */}
              <TableCell padding="none" />{/* 開閉 */}
              {COLS.map(c => (
                <TableCell key={c.key} sx={{ position: 'relative' }}>
                  {SORT_KEYS.includes(c.key as SortKey) ? (
                    <Box
                      component="span"
                      onClick={(e) => setHeaderMenu({ anchor: e.currentTarget, key: c.key as SortKey })}
                      sx={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.25, userSelect: 'none', '&:hover': { color: 'light-dark(#0875a6, #4fc3f7)' } }}
                    >
                      {c.label}
                      {sort.key === c.key && <Box component="span" sx={{ fontSize: 9 }}>{sort.dir === 'asc' ? '▲' : '▼'}</Box>}
                      {filters[c.key as SortKey] && <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'light-dark(#0875a6, #4fc3f7)', display: 'inline-block' }} />}
                    </Box>
                  ) : c.label}
                  {/* リサイズハンドル（列の右端を左ドラッグ→その列が伸縮し、右側は横スクロール） */}
                  <Box
                    onPointerDown={(e) => startColResize(c.key, e)}
                    sx={{ position: 'absolute', top: 0, right: 0, width: 8, height: '100%', cursor: 'col-resize', zIndex: 2, touchAction: 'none', '&:hover': { bgcolor: 'light-dark(#0875a6, #4fc3f7)' } }}
                  />
                </TableCell>
              ))}
              <TableCell padding="none" />
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.length === 0 && orphanReqs.length === 0 && (
              <TableRow>
                <TableCell colSpan={COL_COUNT}>
                  <Typography variant="body2" sx={{ color: 'text.secondary', py: 1 }}>
                    まだ項目がありません。下の欄から要求・要件を追加してください。
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visibleRequests.map(req => {
              const cl = childListByReq.get(req.id);
              const kids = cl?.view ?? [];
              // 要求チェックボックスの tri-state（元 reqCheckState と同一のロジック）を primitive で渡す。
              const csIds = autoCheckIds(req.id, requirements);
              const csOn = csIds.filter(id => checked.has(id)).length;
              const csChecked = csIds.length > 0 && csOn === csIds.length;
              const csIndeterminate = csOn > 0 && csOn < csIds.length;
              // 子要件(kids)＋その修正項目の id だけに絞った選択/畳み状態を CSV にする。RequestRow は
              // Set を丸ごと受け取らず、こうして「無関係な行の切替では内容が変わらない」primitive を
              // 受け取ることで React.memo が正しく効く（Set をそのまま渡すと参照が毎回変わり効かない）。
              const relevantIds = kids.flatMap(k => [k.id, ...(k.fixes ?? []).map(f => f.id)]);
              const checkedIdsCsv = relevantIds.filter(id => checked.has(id)).join(',');
              const fixCollapsedIdsCsv = kids.filter(k => fixCollapsed.has(k.id)).map(k => k.id).join(',');
              return (
                <RequestRow
                  key={req.id}
                  req={req}
                  allKids={cl?.all ?? []}
                  kids={kids}
                  expanded={isExpanded(req.id)}
                  sprints={sprints}
                  usedTools={usedTools}
                  usedScreens={usedScreens}
                  csChecked={csChecked}
                  csIndeterminate={csIndeterminate}
                  checkedIdsCsv={checkedIdsCsv}
                  fixCollapsedIdsCsv={fixCollapsedIdsCsv}
                  onToggleRequestCheck={toggleRequestCheck}
                  onToggleCollapse={toggleCollapse}
                  onToggleCheck={toggleItemCheck}
                  onToggleFixCollapse={toggleFixCollapse}
                  onPatch={patchItem}
                  onRemove={remove}
                  onOpenDetail={openDetail}
                  onOpenAttach={setAttachTargetId}
                  onAddFix={addFixText}
                  onToggleFix={toggleFixOf}
                  onUpdateFixText={updateFixTextOf}
                  onRemoveFix={removeFixOf}
                  onAddChild={addChildText}
                />
              );
            })}
            {visibleOrphans.length > 0 && (
              <>
                <TableRow sx={{ bgcolor: 'action.hover', '& td': { py: 0.5, borderBottom: 'none' } }}>
                  <TableCell padding="none" />
                  <TableCell colSpan={COL_COUNT - 1}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>要求なし（{visibleOrphans.length}）</Typography>
                  </TableCell>
                </TableRow>
                {visibleOrphans.map(k => (
                  <RequirementRow
                    key={k.id}
                    item={k}
                    indented
                    sprints={sprints}
                    parentPlatform={null}
                    parentCategory={null}
                    usedTools={usedTools}
                    usedScreens={usedScreens}
                    checked={checked.has(k.id)}
                    fixCheckedBits={(k.fixes ?? []).map(f => checked.has(f.id) ? '1' : '0').join('')}
                    fixCollapsed={fixCollapsed.has(k.id)}
                    onToggleCheck={toggleItemCheck}
                    onToggleFixCollapse={toggleFixCollapse}
                    onPatch={patchItem}
                    onRemove={remove}
                    onOpenDetail={openDetail}
                    onOpenAttach={setAttachTargetId}
                    onAddFix={addFixText}
                    onToggleFix={toggleFixOf}
                    onUpdateFixText={updateFixTextOf}
                    onRemoveFix={removeFixOf}
                  />
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </Box>

      {/* 追加フォーム（要求のみ）。要件18: 下部に固定＋コンパクト */}
      <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: OPAQUE_MENU_BG }}>
        <Chip label="要求" size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }} />
        <InlineAddInput placeholder="要求を追加（例: 〜できるようにしたい）…" variant="outlined" maxWidth={520} onAdd={(t) => void createRequest(t)} />
      </Box>

      {/* ヘッダーのソート/フィルタ・統合メニュー（要件12/14） */}
      <Menu
        anchorEl={headerMenu?.anchor} open={!!headerMenu} onClose={() => setHeaderMenu(null)}
        slotProps={{ paper: { sx: { ...MENU_PAPER_SX, minWidth: 220, maxHeight: 440 } } }}
      >
        {headerMenu ? renderHeaderMenuItems(headerMenu.key) : null}
      </Menu>
    </Box>
    );
  };

  /** 機能一覧（自動集計）: 着手以降の要件を プラットフォーム×子アプリ で並べる読み取り専用ビュー */
  const renderFeatures = () => {
    const feats = requirements.filter(r => statusOf(r) !== 'todo' && statusOf(r) !== 'archived');
    if (feats.length === 0) {
      return (
        <Paper elevation={0} sx={{ ...SECTION_SX, p: 3, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            着手以降の要件がまだありません。要件の状態を「着手」以上にすると、ここに機能として自動集計されます。
          </Typography>
        </Paper>
      );
    }
    // 実効値（要件2: 親要求からの継承を解決した値）で集計する
    const platformOrder: string[] = [...PLATFORMS.map(p => p.id), 'none'];
    const groups = platformOrder
      .map(pid => ({ pid, list: feats.filter(r => (effPlatform(r) || 'none') === pid) }))
      .filter(g => g.list.length > 0);
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map(g => {
          const p = PLATFORM_MAP[g.pid];
          const done = g.list.filter(isDone).length;
          const catIds = [...new Set(g.list.map(r => effCategory(r) || 'none'))];
          // 既知ツール順 → 自由入力ツール → 未分類
          const catOrder = [
            ...CATEGORIES.map(c => c.id).filter(id => catIds.includes(id)),
            ...catIds.filter(id => id !== 'none' && !CAT_MAP[id]),
            ...(catIds.includes('none') ? ['none'] : []),
          ];
          const cats = catOrder
            .map(cid => ({ cid, list: g.list.filter(r => (effCategory(r) || 'none') === cid) }))
            .filter(c => c.list.length > 0);
          return (
            <Paper key={g.pid} elevation={0} sx={{ ...SECTION_SX, p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: p ? p.color : 'text.disabled' }} />
                <Typography variant="h6" sx={{ fontSize: 15, fontWeight: 700 }}>{p ? p.label : 'プラットフォーム未設定'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>{done}/{g.list.length} 完了</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
                {cats.map(c => (
                  <Box key={c.cid}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                      <ToolDot id={c.cid === 'none' ? null : c.cid} />
                      <Typography variant="caption" sx={{ color: c.cid === 'none' ? 'text.disabled' : 'text.primary', whiteSpace: 'nowrap' }}>{c.cid === 'none' ? '未分類' : toolLabel(c.cid)}</Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c.list.filter(isDone).length}/{c.list.length}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {c.list.map(r => (
                        <Box
                          key={r.id} onClick={() => openDetail(r)}
                          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 0.5, py: 0.25, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        >
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, bgcolor: STATUS_MAP[statusOf(r)].color }} />
                          <Typography variant="body2" noWrap sx={{ flex: 1, textDecoration: isDone(r) ? 'line-through' : 'none', opacity: isDone(r) ? 0.65 : 1 }}>{r.title}</Typography>
                          {r.kind && <Typography variant="caption" sx={{ color: KIND_MAP[r.kind].color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{KIND_MAP[r.kind].label}</Typography>}
                          {r.screen && <Typography variant="caption" sx={{ color: 'text.disabled', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.screen}</Typography>}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>
    );
  };

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
          {isReq ? (
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
              <Box>{fieldLabel('状態')}<StatusSelect value={statusOf(it)} onChange={(v) => patchItem(it.id, { status: v, done: v === 'done' })} /></Box>
              <Box>{fieldLabel('種別')}<KindSelect value={it.kind} onChange={(v) => patchItem(it.id, { kind: v })} /></Box>
              <Box>{fieldLabel('プラットフォーム')}<PlatformSelect value={it.platform} inherited={parentOf(it)?.platform ?? null} onChange={(v) => patchItem(it.id, { platform: v })} /></Box>
              <Box sx={{ width: 160 }}>{fieldLabel('ツール')}<CategorySelect value={it.category} inherited={parentOf(it)?.category ?? null} options={usedTools} onChange={(v) => patchItem(it.id, { category: v })} /></Box>
              <Box sx={{ width: 160 }}>{fieldLabel('画面・場所')}<ScreenSelect value={it.screen} options={usedScreens} onChange={(v) => patchItem(it.id, { screen: v })} /></Box>
              <Box sx={{ width: 240 }}>{fieldLabel('理由')}<InlineText value={it.reason} placeholder="理由…" onCommit={(v) => patchItem(it.id, { reason: v })} /></Box>
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
              <Box>{fieldLabel('スプリント')}<SprintSelect value={it.sprintId} sprints={sprints} onChange={(v) => patchItem(it.id, { sprintId: v })} /></Box>
            </Box>
          ) : null}
          {isReq && (
            <Box sx={{ mt: 2 }}>
              {fieldLabel('テストメモ／申し送り（不具合の症状・再現手順・要望など）')}
              <Box sx={{ border: '1px solid', borderColor: it.notes ? 'warning.main' : 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
                <InlineText value={it.notes} placeholder="例: 列の右端を掴んでドラッグしても幅が変わらない" onCommit={(v) => patchItem(it.id, { notes: v })} />
              </Box>
            </Box>
          )}
          {isReq && (
            <Box sx={{ mt: 2 }}>
              {fieldLabel('テスト結果（手動テストの合否・所見）')}
              <Box sx={{ border: '1px solid', borderColor: it.testResult ? 'success.main' : 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
                <InlineText value={it.testResult} placeholder="例: OK — 右サイドバーの「Rhinoへ」ボタンで現在のRhinoファイルに追加できた" onCommit={(v) => patchItem(it.id, { testResult: v })} />
              </Box>
            </Box>
          )}
          {!isReq && (
            <>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                <Box>{fieldLabel('既定プラットフォーム')}<PlatformSelect value={it.platform} onChange={(v) => patchItem(it.id, { platform: v })} /></Box>
                <Box sx={{ width: 160 }}>{fieldLabel('既定のツール')}<CategorySelect value={it.category} options={usedTools} onChange={(v) => patchItem(it.id, { category: v })} /></Box>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                既定値は、この要求に新しく追加する要件へ引き継がれます。
              </Typography>
              <Box sx={{ mt: 2 }}>
                {fieldLabel(`この要求の要件（${kids.length}）`)}
                {kids.length === 0 ? (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    まだ要件が紐づいていません。テーブルでこの要求を開き、下部の欄から追加できます。
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
            </>
          )}
          {isReq && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 2 }}>
              スプリントは、この画面・要求要件テーブルの「スプリント」列・ボードのドラッグのいずれでも変更できます。
            </Typography>
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

  /**
   * タイムライン＝要求ロードマップ（設計: docs/superpowers/specs/2026-07-26-timeline-roadmap-design.md）。
   * 2段ヘッダー（時間の目盛り→スプリント帯）＋要求スイムレーン。要求主軸で「いつ・どの要求が・どこまで」を一目で。
   * 要件16(ガント)/要件19(パネル撤去)/要件29(既定折りたたみ) を包含。
   */
  const renderTimeline = () => {
    const LABEL_W = 256;   // 左ラベル列（横スクロールしても固定）
    const scaleBar = (
      <ToggleButtonGroup
        size="small" exclusive value={timeScale}
        onChange={(_, v) => changeScale(v)}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.1, py: 0.2, fontSize: 12, lineHeight: 1.6 } }}
      >
        {(['year', 'month', 'week', 'day'] as TimeScale[]).map(s => (
          <ToggleButton key={s} value={s}>{SCALE_LABEL[s]}</ToggleButton>
        ))}
      </ToggleButtonGroup>
    );
    const groupBar = (
      <ToggleButtonGroup
        size="small" exclusive value={tlGroupBy}
        onChange={(_, v: GroupKey | null) => v && setTlGroupBy(v)}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.1, py: 0.2, fontSize: 12, lineHeight: 1.6 } }}
      >
        <ToggleButton value="none">時間順</ToggleButton>
        <ToggleButton value="category">ツール</ToggleButton>
        <ToggleButton value="platform">PF</ToggleButton>
      </ToggleButtonGroup>
    );

    const toolbar = (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Typography variant="caption" sx={{ color: 'text.secondary' }}>粒度</Typography>{scaleBar}</Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Typography variant="caption" sx={{ color: 'text.secondary' }}>グループ</Typography>{groupBar}</Box>
        <Button size="small" variant="outlined" onClick={() => scrollToToday(true)} sx={{ textTransform: 'none', color: 'light-dark(#c62828, #ef5350)', borderColor: 'light-dark(#c62828, #ef5350)' }}>現在へ</Button>
      </Box>
    );

    if (sprintList.length === 0) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {toolbar}
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
            スプリントがありません。「スプリント作成」から始めてください。
          </Typography>
        </Box>
      );
    }

    // ── 時間軸（px/日・横スクロール） ──
    const DAY = 86400e3;
    const toMs = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();
    const PAD_DAYS: Record<TimeScale, number> = { day: 2, week: 7, month: 15, year: 45 };
    // 粒度ごとの最低表示期間（スプリントが少なくても“時間軸のキャンバス”を確保）。
    const MIN_SPAN_DAYS: Record<TimeScale, number> = { day: 28, week: 84, month: 210, year: 730 };
    const pad = PAD_DAYS[timeScale] * DAY;
    const todayMs = toMs(today);
    const rangeById = sprintRangeById(sprintList);
    let minMs = Math.min(...sprintList.map(s => toMs(s.startDate)), todayMs) - pad;
    let maxMs = Math.max(...sprintList.map(s => toMs(s.endDate) + DAY), todayMs) + pad;
    // 実データが狭ければ最低幅まで拡張。不足は過去25%・未来75%（先を広めに）に振る。
    const minSpan = MIN_SPAN_DAYS[timeScale] * DAY;
    if (maxMs - minMs < minSpan) {
      const deficit = minSpan - (maxMs - minMs);
      minMs -= deficit * 0.25;
      maxMs += deficit * 0.75;
    }
    // 自然な尺度＋横スクロール（引き伸ばさない）。粒度で密度を変える。
    const pxPerDay = PX_PER_DAY[timeScale];
    const xOf = (ms: number) => ((ms - minMs) / DAY) * pxPerDay;
    const chartW = Math.max(Math.round(xOf(maxMs)), 320);
    const ticks = timelineTicks(minMs, maxMs, timeScale);
    const todayX = xOf(todayMs);
    tlTodayLeftRef.current = LABEL_W + todayX; // 「現在へ」スクロールの目標
    const ROW_H = 30;

    // ── 要求ロードマップの行データ（スケジュール済み＝スプリント割当済みの要件だけ扱う） ──
    type RRow = { request: BacklogItem | null; members: BacklogItem[]; span: ReturnType<typeof requestSpan> };
    const scheduled = (m: BacklogItem) => !!m.sprintId && rangeById.has(m.sprintId);
    const rrAll: RRow[] = requests.map(req => {
      const members = childrenOf(req.id).filter(scheduled);
      return { request: req, members, span: requestSpan(members, rangeById) };
    });
    const orphanScheduled = orphanReqs.filter(scheduled);
    if (orphanScheduled.length) rrAll.push({ request: null, members: orphanScheduled, span: requestSpan(orphanScheduled, rangeById) });
    const rrList = rrAll.filter(rr => rr.span); // 未割当のみの要求はロードマップに出さない
    const allDone = (rr: RRow) => rr.members.length > 0 && rr.members.every(isDone);
    const seqOf = (rr: RRow) => rr.request?.seq ?? 1e9;
    const { active, history } = partitionHistory(rrList, rr => rr.span, allDone, todayMs);
    const activeSorted = sortByLanding(active, rr => rr.span, seqOf);
    const groups = groupRequests(
      activeSorted, tlGroupBy,
      rr => tlGroupBy === 'category' ? (rr.request ? effCategory(rr.request) : null)
        : tlGroupBy === 'platform' ? (rr.request ? effPlatform(rr.request) : null) : null,
    );

    // ── サマリー（全体像） ──
    const doneReqs = requirements.filter(isDone).length;
    const rate = completionRate(requirements);
    const atRisk = active.filter(rr => isRequestAtRisk(rr.members, rangeById, todayMs)).length;
    const kpi = (n: React.ReactNode, k: string, warn?: boolean) => (
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.75, minWidth: 92 }}>
        <Typography sx={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1, color: warn ? 'light-dark(#c62828, #ef5350)' : 'text.primary' }}>{n}</Typography>
        <Typography sx={{ fontSize: 10, opacity: 0.7, letterSpacing: '.04em' }}>{k}</Typography>
      </Box>
    );
    const summary = (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {kpi(<>{currentSprint ? `S${currentSprint.seq}` : '—'}<Typography component="span" sx={{ fontSize: 12, opacity: 0.6 }}> / {sprintList.length}</Typography></>, 'スプリント（現行/総数）')}
        {kpi(active.length, '進行中の要求')}
        {kpi(`${Math.round(rate * 100)}%`, `要件 完了率（${doneReqs}/${requirements.length}）`)}
        {kpi(atRisk, '遅延ぎみ', atRisk > 0)}
        {kpi(currentSprint ? md(currentSprint.endDate) : '—', '現行スプリント終了')}
      </Box>
    );

    // ── 描画ヘルパー ──
    const labelCell = (indent: number, content: React.ReactNode, bold?: boolean) => (
      <Box sx={{
        width: LABEL_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 2,
        bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
        display: 'flex', alignItems: 'center', gap: 0.5, pr: 1, pl: `${8 + indent * 16}px`, minWidth: 0,
        fontWeight: bold ? 700 : 400,
      }}>
        {content}
      </Box>
    );
    const datedTrack = (child: React.ReactNode) => (
      <Box sx={{ position: 'relative', width: chartW, flexShrink: 0 }}>{child}</Box>
    );
    // 状態内訳の積み上げバー（要件のセグメント）
    const stackBar = (members: BacklogItem[], left: number, width: number, dashed?: boolean) => {
      const segs = statusBreakdown(members);
      const total = segs.reduce((a, s) => a + s.count, 0) || 1;
      return (
        <Box sx={{
          position: 'absolute', left, width: Math.max(width, 8), top: 5, bottom: 5, borderRadius: 1,
          border: dashed ? '1px dashed' : '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex',
          bgcolor: dashed ? 'transparent' : 'rgba(127,127,127,0.08)',
        }}>
          {!dashed && segs.map(s => (
            <Box key={s.status} sx={{ width: `${(s.count / total) * 100}%`, bgcolor: STATUS_MAP[s.status]?.color || 'text.disabled', opacity: 0.85 }} />
          ))}
        </Box>
      );
    };
    // 要件1本の細バー
    const itemBar = (item: BacklogItem, left: number, width: number, dashed?: boolean) => {
      const sc = STATUS_MAP[statusOf(item)];
      return (
        <Tooltip arrow title={`${keyOf(item)}: ${item.title}（${sc.label}）`}>
          <Box sx={{
            position: 'absolute', left, width: Math.max(width, 8), top: 7, bottom: 7, borderRadius: 0.75,
            border: '1px solid', borderColor: sc.color,
            bgcolor: dashed ? 'transparent' : (isDone(item) ? sc.color : 'rgba(127,127,127,0.10)'),
            borderStyle: dashed ? 'dashed' : 'solid', opacity: isDone(item) ? 0.55 : 1,
          }} />
        </Tooltip>
      );
    };

    // 1つの要求行（＋展開した要件行）
    const renderRequestRows = (rr: RRow, dim?: boolean): React.ReactNode => {
      const req = rr.request;
      const gkey = req ? req.id : 'orphan';
      const expanded = expandedTlGroups.has(gkey);
      const cat = req ? effCategory(req) : null;
      const pf = req ? effPlatform(req) : null;
      const done = rr.members.filter(isDone).length;
      const rows: React.ReactNode[] = [];
      rows.push(
        <Box key={`rq-${gkey}`} sx={{ display: 'flex', height: ROW_H, position: 'relative', zIndex: 1, opacity: dim ? 0.7 : 1 }}>
          {labelCell(0, (
            <>
              <IconButton size="small" onClick={() => toggleTlGroup(gkey)} sx={{ p: 0.25 }}>
                {expanded ? <ExpandMoreRoundedIcon fontSize="small" /> : <ChevronRightRoundedIcon fontSize="small" />}
              </IconButton>
              <CatDot id={cat} />
              <Typography variant="caption" noWrap sx={{ fontWeight: 600, minWidth: 0, flex: 1 }}>
                {req ? `${keyOf(req)}: ${req.title}` : '要求なし'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontSize: 11 }}>{done}/{rr.members.length}</Typography>
              {pf && <PlatformBadge id={pf} />}
            </>
          ))}
          {datedTrack(rr.span && stackBar(rr.members, xOf(rr.span.startMs), xOf(rr.span.endMs) - xOf(rr.span.startMs)))}
        </Box>,
      );
      if (expanded) {
        rr.members.forEach(item => {
          const rng = item.sprintId ? rangeById.get(item.sprintId) : undefined;
          const kind = item.kind ? KIND_MAP[item.kind] : undefined;
          rows.push(
            <Box key={`it-${item.id}`} sx={{ display: 'flex', height: ROW_H, position: 'relative', zIndex: 1, opacity: dim ? 0.7 : 1 }}>
              {labelCell(1, (
                <>
                  <Typography variant="caption" noWrap sx={{ minWidth: 0, flex: 1, textDecoration: isDone(item) ? 'line-through' : 'none', opacity: isDone(item) ? 0.7 : 1 }}>
                    {keyOf(item)}: {item.title}
                  </Typography>
                  {kind && <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontSize: 10 }}>{kind.label}</Typography>}
                  {item.screen && <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontSize: 10, opacity: 0.8 }}>·{item.screen}</Typography>}
                </>
              ))}
              {datedTrack(rng && itemBar(item, xOf(rng.startMs), xOf(rng.endMs) - xOf(rng.startMs)))}
            </Box>,
          );
        });
      }
      return rows;
    };

    const usedCats = [...new Set(requirements.map(r => effCategory(r)).filter((v): v is string => !!v && !!CAT_MAP[v]))];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {summary}
        {toolbar}
        <Box ref={tlScrollRef} sx={{ overflowX: 'auto', overflowY: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
          <Box sx={{ width: LABEL_W + chartW, position: 'relative' }}>
            {/* 1段目：時間の目盛り */}
            <Box sx={{ display: 'flex', height: 22, borderBottom: '1px solid', borderColor: 'divider' }}>
              {labelCell(0, <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>要求（着地順）</Typography>, true)}
              {datedTrack(<>
                {ticks.map(t => {
                  const x = xOf(t.ms);
                  if (todayX >= 0 && Math.abs(x - todayX) < 22) return null; // 「今日」ピルと重なる目盛りは省く
                  return <Typography key={t.ms} variant="caption" sx={{ position: 'absolute', left: x + 2, top: 3, color: t.major ? 'text.primary' : 'text.secondary', fontWeight: t.major ? 700 : 400, whiteSpace: 'nowrap' }}>{t.label}</Typography>;
                })}
                {todayX >= 0 && todayX <= chartW && (
                  <Box sx={{ position: 'absolute', left: todayX, top: 2, transform: 'translateX(-50%)', bgcolor: 'light-dark(#c62828, #ef5350)', color: '#fff', borderRadius: 0.75, px: 0.5, fontSize: 9, fontWeight: 800, lineHeight: '16px', whiteSpace: 'nowrap', zIndex: 1 }}>今日</Box>
                )}
              </>)}
            </Box>

            {/* 2段目以降：スプリント帯＋要求（共通の縦罫線・今日線を背面に敷く） */}
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: LABEL_W, top: 0, bottom: 0, width: chartW, pointerEvents: 'none', zIndex: 0 }}>
                <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.max(todayX, 0), bgcolor: 'rgba(127,127,127,0.06)' }} />
                {ticks.map(t => (
                  <Box key={t.ms} sx={{ position: 'absolute', left: xOf(t.ms), top: 0, bottom: 0, borderLeft: t.major ? '1px solid' : '1px dashed', borderColor: t.major ? 'divider' : 'action.hover' }} />
                ))}
                {todayX >= 0 && todayX <= chartW && (
                  <Box sx={{ position: 'absolute', left: todayX, top: 0, bottom: 0, borderLeft: '2px solid', borderColor: 'light-dark(#c62828, #ef5350)' }} />
                )}
              </Box>

              {/* スプリント帯レーン */}
              <Box sx={{ display: 'flex', height: 28, position: 'relative', zIndex: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                {labelCell(0, <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>スプリント</Typography>, true)}
                {datedTrack(sprintList.map(s => {
                  const st = rangeById.get(s.id);
                  if (!st) return null;
                  const left = xOf(st.startMs); const width = xOf(st.endMs) - left;
                  const isCur = currentSprint?.id === s.id;
                  const isFuture = st.startMs > todayMs;
                  return (
                    <Box key={s.id} sx={{
                      position: 'absolute', left, width: Math.max(width, 8), top: 4, bottom: 4, borderRadius: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                      border: '1px solid', borderStyle: isFuture ? 'dashed' : 'solid',
                      borderColor: isCur ? 'light-dark(#0875a6, #4fc3f7)' : 'divider',
                      bgcolor: isCur ? 'light-dark(rgba(8,117,166,0.18), rgba(79,195,247,0.22))' : (isFuture ? 'transparent' : 'rgba(127,127,127,0.14)'),
                      opacity: (!isCur && !isFuture) ? 0.65 : 1,
                    }}>
                      <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>S{s.seq}</Typography>
                    </Box>
                  );
                }))}
              </Box>

              {/* 完了した要求（履歴） */}
              {history.length > 0 && (
                <>
                  <Box sx={{ display: 'flex', height: ROW_H, position: 'relative', zIndex: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    {labelCell(0, (
                      <Button size="small" onClick={() => setTlHistoryOpen(o => !o)} startIcon={tlHistoryOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />} sx={{ textTransform: 'none', color: 'text.secondary', fontWeight: 600, fontSize: 12 }}>
                        完了した要求（履歴）{history.length}
                      </Button>
                    ))}
                    {datedTrack(null)}
                  </Box>
                  {tlHistoryOpen && history.map(rr => renderRequestRows(rr, true))}
                </>
              )}

              {/* 要求スイムレーン（グループごと） */}
              {groups.map(g => (
                <React.Fragment key={g.key ?? '__none'}>
                  {tlGroupBy !== 'none' && (
                    <Box sx={{ display: 'flex', height: 26, position: 'relative', zIndex: 1, borderTop: '1px solid', borderColor: 'divider', bgcolor: 'rgba(127,127,127,0.05)' }}>
                      {labelCell(0, (
                        tlGroupBy === 'category'
                          ? <CatDot id={g.key} withLabel />
                          : (g.key ? <PlatformBadge id={g.key as Platform} withLabel /> : <Typography variant="caption" sx={{ color: 'text.disabled' }}>未設定</Typography>)
                      ), true)}
                      {datedTrack(null)}
                    </Box>
                  )}
                  {g.items.map(rr => renderRequestRows(rr))}
                </React.Fragment>
              ))}

              {groups.every(g => g.items.length === 0) && history.length === 0 && (
                <Box sx={{ display: 'flex', height: ROW_H, alignItems: 'center' }}>
                  {labelCell(0, <Typography variant="caption" sx={{ color: 'text.secondary' }}>要求がありません。</Typography>)}
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* 凡例 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 11 }}>
          {STATUSES.filter(s => s.id !== 'archived').map(s => (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: s.color }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{s.label}</Typography>
            </Box>
          ))}
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>｜ ●赤＝今日</Typography>
          {usedCats.length > 0 && <Box sx={{ width: '1px', height: 14, bgcolor: 'divider', mx: 0.5 }} />}
          {usedCats.map(id => <CatDot key={id} id={id} withLabel />)}
        </Box>
      </Box>
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
                  icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', ml: 0.75, bgcolor: catColorOf(r) }} />}
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

  /** ボード表示（D&D カンバン） */
  const renderBoard = () => (
    <DndContext
      sensors={sensors} collisionDetection={collisionStrategy}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}
    >
      {currentSprint && renderSprintPanel(currentSprint, true)}

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
  );

  const loading = !loaded.items || !loaded.sprints;
  const attachItem = attachTargetId ? byId.get(attachTargetId) : undefined;

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2.5, flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flexShrink: 0 }}>
        <FactCheckRoundedIcon sx={{ color: 'light-dark(#0875a6, #4fc3f7)' }} />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>SEKKEIYA Code</Typography>
        <ToggleButtonGroup
          size="small" exclusive value={view}
          onChange={(_, v) => changeView(v)}
          sx={{ ml: 1, '& .MuiToggleButton-root': { textTransform: 'none', px: 1.25, py: 0.25, fontSize: 13 } }}
        >
          <ToggleButton value="board"><ViewKanbanRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />ボード</ToggleButton>
          <ToggleButton value="table"><ViewListRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />要求・要件</ToggleButton>
          <ToggleButton value="timeline"><ViewTimelineRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />タイムライン</ToggleButton>
          <ToggleButton value="features"><AppsRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />機能一覧</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        {view === 'table' && (
          <Button
            variant="contained" size="small" disableElevation
            disabled={implAll.length + testTargets.length === 0}
            onClick={enqueueSelected}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            {dispatchLabel}
          </Button>
        )}
        {(view === 'board' || view === 'timeline') && (
          <Button
            variant="outlined" size="small" startIcon={<AddRoundedIcon />}
            onClick={openCreateSprint} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            スプリント作成
          </Button>
        )}
      </Box>

      {error && (
        <Paper elevation={0} sx={{ ...SECTION_SX, borderColor: 'error.main', color: 'error.main', p: 2 }}>{error}</Paper>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: view === 'table' ? 'hidden' : 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : view === 'timeline' ? (
          renderTimeline()
        ) : view === 'features' ? (
          renderFeatures()
        ) : view === 'table' ? (
          renderTable()
        ) : (
          renderBoard()
        )}
      </Box>

      {/* 要求/要件の詳細ダイアログ */}
      {renderDetailDialog()}

      {/* 添付ダイアログ（要件27: D&D／クリックで選択／Ctrl+V 貼り付け） */}
      <Dialog open={!!attachItem} onClose={() => setAttachTargetId(null)} maxWidth="sm" fullWidth slotProps={{ paper: { sx: DIALOG_PAPER_SX } }}>
        {attachItem && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 16, fontWeight: 700 }}>
              <Chip label={keyOf(attachItem)} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, height: 22 }} />
              添付画像
            </DialogTitle>
            <DialogContent onPaste={(e) => handlePasteAttach(attachItem.id, e)}>
              {(attachItem.attachments?.length ?? 0) > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {attachItem.attachments!.map(att => (
                    <Box key={att.path} sx={{ position: 'relative', '&:hover .att-del': { opacity: 1 } }}>
                      <Box component="img" src={att.url} alt={att.name} onClick={() => setPreviewImg(att.url)} sx={{ height: 88, maxWidth: 180, objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider', cursor: 'zoom-in', display: 'block' }} />
                      <IconButton className="att-del" size="small" onClick={() => void removeAttachment(attachItem.id, att)} sx={{ position: 'absolute', top: -10, right: -10, opacity: 0, bgcolor: 'var(--brand-glass)', border: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'var(--brand-glass)' } }}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              <Box
                component="label"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handlePickAttach(attachItem.id, e.dataTransfer.files); }}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 4, border: '2px dashed', borderRadius: 2, cursor: 'pointer', color: 'text.secondary', transition: 'border-color .12s, background-color .12s', borderColor: attachDragOver ? 'light-dark(#0875a6, #4fc3f7)' : 'divider', bgcolor: attachDragOver ? 'action.hover' : 'transparent', '&:hover': { borderColor: 'light-dark(#0875a6, #4fc3f7)', bgcolor: 'action.hover' } }}
              >
                <ImageRoundedIcon />
                <Typography variant="body2">ここにドラッグ＆ドロップ／クリックで画像を選択</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>（Ctrl+V で貼り付けも可）</Typography>
                <input hidden type="file" accept="image/*" multiple onChange={(e) => { handlePickAttach(attachItem.id, e.target.files); (e.target as HTMLInputElement).value = ''; }} />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setAttachTargetId(null)} sx={{ textTransform: 'none' }}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 添付画像の拡大表示（要件27） */}
      <Dialog open={!!previewImg} onClose={() => setPreviewImg(null)} maxWidth="lg" slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none' } } }}>
        {previewImg && <Box component="img" src={previewImg} alt="" onClick={() => setPreviewImg(null)} sx={{ maxWidth: '92vw', maxHeight: '88vh', display: 'block', cursor: 'zoom-out', borderRadius: 1 }} />}
      </Dialog>

      {/* 確認ダイアログ（削除・スプリント完了） */}
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

      {/* スプリント作成ダイアログ（期間を設定して作成） */}
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
