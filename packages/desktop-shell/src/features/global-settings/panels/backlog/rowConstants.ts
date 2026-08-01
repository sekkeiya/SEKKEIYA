// backlog/rowConstants.ts — DevStatusPanel の行/セル描画で共有する型・定数・スタイル・小ヘルパー。
// 行コンポーネント（RequirementRow / RequestRow）と DevStatusPanel の双方から参照する単一定義。
// ※ React コンポーネントはここに置かない（→ rowFields.tsx）。react-refresh の
//    only-export-components 警告を避けるため、この .ts は「値・型」だけを持つ。
import { CATEGORIES, GENERIC_CATEGORIES } from '../devStatusLogic';
import type { BacklogItem } from '../DevStatusPanel';

// ── 分類の軸となる小さな union 型（BacklogItem はこれらを参照する） ──
export type BacklogType = 'request' | 'requirement';
export type ReqStatus = 'todo' | 'doing' | 'testing' | 'manualtest' | 'rework' | 'done' | 'archived';
export type Platform = 'desktop' | 'web' | 'common' | 'backend';
export type Kind = 'uiux' | 'feature' | 'improve' | 'bug' | 'perf' | 'refactor';

// ── 状態（4択） ───────────────────────────────────────────────────
export const STATUSES: { id: ReqStatus; label: string; color: string }[] = [
  { id: 'todo',    label: '未着手', color: 'text.secondary' },
  { id: 'doing',   label: '着手',   color: 'info.main' },
  { id: 'testing',    label: 'テスト',       color: 'warning.main' },
  { id: 'manualtest', label: 'テスト（手動）', color: 'light-dark(#7b1fa2, #ce93d8)' },
  { id: 'rework',     label: '要修正',       color: 'error.main' },
  { id: 'done',       label: '完了',         color: 'success.main' },
  { id: 'archived',   label: 'アーカイブ',   color: 'text.disabled' },
];
export const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s]));

// ── プラットフォーム（大項目） ────────────────────────────────────
export const PLATFORMS: { id: Platform; label: string; short: string; color: string }[] = [
  { id: 'desktop', label: 'Desktop', short: 'D',  color: '#4fc3f7' },
  { id: 'web',     label: 'Web',     short: 'W',  color: '#42a5f5' },
  { id: 'common',  label: '共通',    short: '共', color: '#90a4ae' },
  { id: 'backend', label: 'Backend', short: 'BE', color: '#66bb6a' },
];
export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map(p => [p.id, p])) as Record<string, typeof PLATFORMS[number]>;

// ── 種別 ──────────────────────────────────────────────────────────
export const KINDS: { id: Kind; label: string; color: string }[] = [
  { id: 'uiux',     label: 'UI/UX',      color: 'light-dark(#732e7f, #ba68c8)' },
  { id: 'feature',  label: '新機能',     color: 'light-dark(#0875a6, #4fc3f7)' },
  { id: 'improve',  label: '改善',       color: 'light-dark(#2e7d32, #66bb6a)' },
  { id: 'bug',      label: 'バグ',       color: 'light-dark(#c62828, #ef5350)' },
  { id: 'perf',     label: '性能',       color: 'light-dark(#ad6700, #ffa726)' },
  { id: 'refactor', label: 'リファクタ', color: '#90a4ae' },
];
export const KIND_MAP = Object.fromEntries(KINDS.map(k => [k.id, k])) as Record<string, typeof KINDS[number]>;

// ── 論理順（ソート/フィルタで使う。定数なのでモジュールスコープに固定） ──
export const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i])) as Record<string, number>;
export const KIND_ORDER = Object.fromEntries(KINDS.map((k, i) => [k.id, i])) as Record<string, number>;
export const PLATFORM_ORDER = Object.fromEntries(PLATFORMS.map((p, i) => [p.id, i])) as Record<string, number>;
// 要件79: ローカルプロジェクト用の汎用分類も並び順に含める（含めないと undefined でソートが崩れる）。
// id が重複する 'general' は SEKKEIYA 側の位置を優先する。
const CATEGORY_ORDER_SOURCE = [
  ...CATEGORIES,
  ...GENERIC_CATEGORIES.filter(g => !CATEGORIES.some(c => c.id === g.id)),
];
export const CATEGORY_ORDER = Object.fromEntries(CATEGORY_ORDER_SOURCE.map((c, i) => [c.id, i])) as Record<string, number>;

// ── 小さなセレクトの共有スタイル ─────────────────────────────────
export const SELECT_SX = { height: 24, fontSize: 12, '& .MuiSelect-select': { py: 0.25, pl: 0.75, pr: '8px !important' }, '& .MuiSelect-icon': { display: 'none' } } as const;
// ドロップダウンの背景（要件7: 透けると文字が読めないので完全不透明・blur なし）。
export const OPAQUE_MENU_BG = 'light-dark(#ffffff, #232a30)';
export const MENU_PAPER_SX = {
  bgcolor: OPAQUE_MENU_BG,
  backgroundImage: 'none', // dark モードの elevation オーバーレイ（半透明）を無効化
  border: '1px solid', borderColor: 'divider',
  boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  // 要件11: メニューの文字は折り返さず一行に収める / 要件13: 文字サイズをツール列(13px)に統一
  '& .MuiMenuItem-root, & .MuiAutocomplete-option': { whiteSpace: 'nowrap', fontSize: 13 },
} as const;
export const MENU_PROPS = { PaperProps: { sx: MENU_PAPER_SX } } as const;
// Autocomplete のリストボックスにも同じ不透明面を適用（要件7）。
export const AC_SLOT_PROPS = { paper: { sx: MENU_PAPER_SX } } as const;
// Autocomplete を状態/スプリントの Select と同じ「枠つき・▼付きの小さなプルダウン」見た目に揃える。
export const AC_COMPACT_SX = {
  '& .MuiOutlinedInput-root': { minHeight: 26, py: '1px', pl: 0.5, pr: '8px !important', fontSize: 12, bgcolor: 'action.hover' },
  '& .MuiOutlinedInput-input': { py: '2px !important', fontSize: 12 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
  '& .MuiAutocomplete-endAdornment': { right: 3 },
} as const;

// ── 表示キー（要求1 / 要件1 …） ──────────────────────────────────
export const KEY_PREFIX: Record<BacklogType, string> = { request: '要求', requirement: '要件' };
export const keyOf = (i?: BacklogItem) => i ? `${KEY_PREFIX[i.type]}${i.seq ?? '?'}` : '?';

// 総列数はここでは持たない。列の表示/非表示に追従させる必要があるため、
// DevStatusPanel が visibleCols から算出して `colCount` prop で各行へ渡す
// （以前はリテラル 13 を手動同期していたが、列を隠すとズレるため廃止した）。
