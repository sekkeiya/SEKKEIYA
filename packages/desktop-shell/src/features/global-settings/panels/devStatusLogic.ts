// 開発状況パネルの純粋ロジック（React / Firebase / DOM 非依存）。
// ここに切り出すことで Vitest で高速に単体テストでき、UI とは独立に「緑＝完了」の判定に使える。
// 対応する要件: 要件2（PF/ツールの親要求からの継承）/ 要件5（列リサイズの計算）/ 状態判定。

export type ReqStatus = 'todo' | 'doing' | 'testing' | 'manualtest' | 'rework' | 'done' | 'archived';

/** ロジックが必要とする最小の項目形（BacklogItem と構造的に互換）。 */
export interface ItemLike {
  status?: ReqStatus;
  done?: boolean;      // 旧データ互換
  progress?: number;   // 旧データ互換
  platform?: string | null;
  category?: string | null;
  requestId?: string | null;
}

/** 状態（4→6択）。旧データ（status 無し）は done / progress から推定する。 */
export function statusOf(r: ItemLike): ReqStatus {
  return r.status ?? (r.done ? 'done' : ((r.progress || 0) > 0 ? 'doing' : 'todo'));
}

export const isDone = (r: ItemLike) => statusOf(r) === 'done';

/**
 * 要件2: 要件は親要求から PF/ツールを継承する。要件が自分の値を持てばそれで上書き（own ?? parent）。
 * @param byId 親要求を id から引く関数（見つからなければ undefined）。
 */
export function resolveEffective(
  item: ItemLike,
  byId: (id: string) => ItemLike | undefined,
): { platform: string | null; category: string | null } {
  const parent = item.requestId ? byId(item.requestId) : undefined;
  return {
    platform: item.platform ?? parent?.platform ?? null,
    category: item.category ?? parent?.category ?? null,
  };
}

/**
 * 要件5: 列リサイズ。掴んだ時点の幅 startW に、ドラッグ量 deltaX を「そのまま加える」。
 * 右へドラッグ（deltaX > 0）= 広がる、が直感に一致する（符号を反転させると逆挙動になる）。
 * 下限 min を下回らないようにクランプする。
 */
export function resizeWidth(startW: number, deltaX: number, min: number): number {
  return Math.max(min, startW + deltaX);
}

export type QueueMode = 'implement' | 'test';

/** 実装対象の状態: 未着手/着手/要修正 */
export function isImplementEligible(item: ItemLike): boolean {
  const s = statusOf(item);
  return s === 'todo' || s === 'doing' || s === 'rework';
}
/** テスト対象の状態: テスト(自動) */
export function isTestEligible(item: ItemLike): boolean {
  return statusOf(item) === 'testing';
}
export function isQueueEligible(item: ItemLike, mode: QueueMode): boolean {
  return mode === 'implement' ? isImplementEligible(item) : isTestEligible(item);
}

/** 要求チェック時に自動チェックする子要件 id（実装対象 or テスト対象＝アクション可能なもの）。 */
export function autoCheckIds(
  requestId: string,
  requirements: (ItemLike & { id: string; requestId?: string | null })[],
): string[] {
  return requirements
    .filter(r => r.requestId === requestId && (isImplementEligible(r) || isTestEligible(r)))
    .map(r => r.id);
}

/** チェック集合とモードから、実際にキューへ入れる要件 id を返す（対象外の状態は除外）。 */
export function queueTargetIds(
  checkedIds: Set<string>,
  requirements: (ItemLike & { id: string })[],
  mode: QueueMode,
): string[] {
  return requirements
    .filter(r => checkedIds.has(r.id) && isQueueEligible(r, mode))
    .map(r => r.id);
}

// ── ツール（category）の単一定義。UI と テスト（要件10「全て」/要件3「Global Settings」）で共有 ──
export const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'all',     label: '全て',   color: '#b0bec5' },
  { id: 'general', label: '基盤',   color: '#78909c' },
  { id: 'chat',    label: 'Chat',   color: '#00bcd4' },
  { id: 'drive',   label: 'Drive',  color: '#26a69a' },
  { id: 'ai',      label: 'AI',     color: 'light-dark(#732e7f, #ba68c8)' },
  { id: 'web',     label: 'Web/LP', color: '#42a5f5' },
  { id: 'billing', label: '課金',   color: '#66bb6a' },
  { id: 'settings', label: 'Global Settings', color: '#90a4ae' },
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
export const CATEGORY_IDS = CATEGORIES.map(c => c.id);

// ── 要件79: SEKKEIYA と無関係なアプリを開発するプロジェクト向けの汎用語彙 ──
// 上の CATEGORIES は SEKKEIYA 本体の子アプリ scope（S.Model / S.Layout …）で、
// 他人のアプリの要求・要件に出しても意味が通らない。ローカルプロジェクトではこちらを候補にする。
// id は CATEGORIES と衝突しない（general のみ同義で重複するため再利用する）ようにしてある。
export const GENERIC_CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'general',  label: '基盤',         color: '#78909c' },
  { id: 'ui',       label: 'UI',           color: '#42a5f5' },
  { id: 'logic',    label: 'ロジック',      color: '#00bcd4' },
  { id: 'api',      label: 'API',          color: '#66bb6a' },
  { id: 'data',     label: 'データ',        color: '#26a69a' },
  { id: 'infra',    label: 'インフラ',      color: '#90a4ae' },
  { id: 'docs',     label: 'ドキュメント',  color: '#b0bec5' },
];

// 汎用の画面候補。SEKKEIYA 固有の画面名（開発状況 / モデル製造ライン …）は出さない。
export const GENERIC_SCREENS = ['ホーム', '一覧', '詳細', '設定', '認証'];
// SEKKEIYA 本体（クラウド）の画面候補。
export const SEKKEIYA_SCREENS = ['開発状況', 'モデル製造ライン', 'AI使用量モニター', 'AI学習モニター', 'コネクタ', '一般'];

// ラベル/色の解決は「どのプロジェクトの値か」に関係なく引けてほしいので、両方を混ぜた辞書を使う。
// （先勝ち＝SEKKEIYA 側を優先。general は同じ内容なので差は出ない）
export const CAT_MAP = Object.fromEntries(
  [...GENERIC_CATEGORIES, ...CATEGORIES].map(c => [c.id, c]),
) as Record<string, typeof CATEGORIES[number]>;
export const toolLabel = (v?: string | null) => v ? (CAT_MAP[v]?.label ?? v) : '';
export const toolColor = (v?: string | null) => v ? (CAT_MAP[v]?.color ?? 'transparent') : 'transparent';

/** 要件79: プロジェクト種別ごとの選択候補（自由入力なので、実データの既出値は呼び出し側で足す）。 */
export interface Vocabulary { categoryIds: string[]; screens: string[]; }
export function vocabularyFor(kind: 'cloud' | 'local' | null): Vocabulary {
  if (kind === 'cloud') return { categoryIds: CATEGORY_IDS, screens: SEKKEIYA_SCREENS };
  return { categoryIds: GENERIC_CATEGORIES.map(c => c.id), screens: GENERIC_SCREENS };
}

// ── ソート/フィルタ（要件12: ヘッダーで並び替え / 要件14: ヘッダーメニューで絞り込み） ──
// 対象列。並び替え・絞り込みできる 6 列。
export type SortKey = 'kind' | 'platform' | 'category' | 'screen' | 'status' | 'sprint';
export interface SortState { key: SortKey | null; dir: 'asc' | 'desc'; }
// 各列 → 許可する値の配列（キー未設定＝全許可 / 空配列＝何も許可しない）。
export type FilterState = Partial<Record<SortKey, string[]>>;

/**
 * 要件12: 指定列で安定ソート。列ごとのソート用の値（数値 or 文字列）は valueOf が返す。
 * key が null なら元の並びのまま。
 */
export function sortRequirements<T>(
  list: T[],
  sort: SortState,
  valueOf: (item: T, key: SortKey) => string | number,
): T[] {
  if (!sort.key) return list;
  const key = sort.key;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const va = valueOf(a.item, key), vb = valueOf(b.item, key);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.i - b.i; // 同値は元順を保つ（安定ソート）
    })
    .map(x => x.item);
}

/**
 * 要件14: 各列の「許可値」に対し、要件の列値（valueKeyOf）で AND フィルタ。
 * filters にキーが無い列は全許可。空配列の列は何も通さない。
 */
export function filterRequirements<T>(
  list: T[],
  filters: FilterState,
  valueKeyOf: (item: T, key: SortKey) => string,
): T[] {
  const keys = Object.keys(filters) as SortKey[];
  if (keys.length === 0) return list;
  return list.filter(item =>
    keys.every(k => {
      const allowed = filters[k];
      if (!allowed) return true; // 未設定＝全許可
      return allowed.includes(valueKeyOf(item, k));
    }),
  );
}

// ── タイムライン / ガントチャート（要求3・要件16） ──────────────────
// 横軸＝時間（年/月/週/日で粒度切替）、縦軸＝スプリント→要求→要件のネスト。
// 純粋ロジックとしてここに切り出し、Vitest で目盛り生成とグルーピングを検証する。
export type TimeScale = 'year' | 'month' | 'week' | 'day';

/** 粒度ごとの 1 日あたりピクセル。日＝広い / 年＝狭い（ズーム相当）。横スクロール前提の読みやすい尺度。 */
export const PX_PER_DAY: Record<TimeScale, number> = {
  day: 40,
  week: 20,
  month: 8,
  year: 2.2,
};

/** 粒度ごとの目盛りラベル（読みやすさ用の日本語）。 */
export const SCALE_LABEL: Record<TimeScale, string> = {
  year: '年', month: '月', week: '週', day: '日',
};

export interface TimeTick {
  /** 目盛りの表示ラベル */
  label: string;
  /** 目盛りの時刻（ms, UTC 0時基準） */
  ms: number;
  /** 主目盛り（年境界など）＝濃い罫線 */
  major: boolean;
}

const DAY_MS = 86400e3;

/**
 * 要件16: 横軸の目盛りを粒度ごとに生成する。UTC 基準で決定的（TZ 非依存＝テスト可能）。
 * - day  : 毎日（1日を主目盛り）
 * - week : 月曜起点（その月の第1週を主目盛り）
 * - month: 月初（1月を主目盛り）
 * - year : 年初（すべて主目盛り）
 */
export function timelineTicks(minMs: number, maxMs: number, scale: TimeScale): TimeTick[] {
  const ticks: TimeTick[] = [];
  const d = new Date(minMs);
  d.setUTCHours(0, 0, 0, 0);
  if (scale === 'day') {
    for (let t = d.getTime(); t <= maxMs; t += DAY_MS) {
      const dd = new Date(t);
      ticks.push({ label: `${dd.getUTCMonth() + 1}/${dd.getUTCDate()}`, ms: t, major: dd.getUTCDate() === 1 });
    }
  } else if (scale === 'week') {
    const dow = (d.getUTCDay() + 6) % 7; // 月曜からの経過日数
    d.setUTCDate(d.getUTCDate() - dow);
    for (let t = d.getTime(); t <= maxMs; t += 7 * DAY_MS) {
      const dd = new Date(t);
      ticks.push({ label: `${dd.getUTCMonth() + 1}/${dd.getUTCDate()}`, ms: t, major: dd.getUTCDate() <= 7 });
    }
  } else if (scale === 'month') {
    d.setUTCDate(1);
    for (;;) {
      const t = d.getTime();
      if (t > maxMs) break;
      ticks.push({ label: `${d.getUTCMonth() + 1}月`, ms: t, major: d.getUTCMonth() === 0 });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  } else {
    d.setUTCMonth(0, 1);
    for (;;) {
      const t = d.getTime();
      if (t > maxMs) break;
      ticks.push({ label: `${d.getUTCFullYear()}年`, ms: t, major: true });
      d.setUTCFullYear(d.getUTCFullYear() + 1);
    }
  }
  return ticks;
}

export interface SprintReqGroup {
  /** 親要求 id（null＝要求なしの要件をまとめる末尾グループ） */
  requestId: string | null;
  /** そのグループに属する要件 id（入力順を保つ） */
  requirementIds: string[];
}

/**
 * 要件16: スプリント内の要件を親要求ごとにまとめる（縦軸のネスト構造）。
 * requestId の初出順を保ち、親要求を持たない要件は末尾の null グループへ集める。
 */
export function groupByRequest<T extends { id: string; requestId?: string | null }>(reqs: T[]): SprintReqGroup[] {
  const groups: SprintReqGroup[] = [];
  const index = new Map<string, SprintReqGroup>();
  let orphan: SprintReqGroup | null = null;
  for (const r of reqs) {
    const rid = r.requestId ?? null;
    if (rid === null) {
      if (!orphan) orphan = { requestId: null, requirementIds: [] };
      orphan.requirementIds.push(r.id);
      continue;
    }
    let g = index.get(rid);
    if (!g) { g = { requestId: rid, requirementIds: [] }; index.set(rid, g); groups.push(g); }
    g.requirementIds.push(r.id);
  }
  if (orphan) groups.push(orphan);
  return groups;
}

// ── 要求ロードマップ（2026-07-26 設計）: 要求主軸の算出 ─────────────
// 要求はスプリント直属ではないため、要求バーの範囲は所属要件のスプリントから導出する。
export interface SprintLite { id: string; seq: number; startDate: string; endDate: string; archived?: boolean; }
export interface ReqLite { id?: string; requestId?: string | null; sprintId?: string | null; status?: ReqStatus; done?: boolean; progress?: number; }
export interface Span { startMs: number; endMs: number; }

const ymdToMs = (ymd: string) => new Date(`${ymd}T00:00:00Z`).getTime();

/** スプリント id → 日付範囲（endMs は「終了日の翌0時」＝排他的上限）。 */
export function sprintRangeById(sprints: SprintLite[]): Map<string, Span> {
  const m = new Map<string, Span>();
  for (const s of sprints) m.set(s.id, { startMs: ymdToMs(s.startDate), endMs: ymdToMs(s.endDate) + DAY_MS });
  return m;
}

/** 要求配下のスケジュール済み要件から、最早開始〜最遅終了を求める。1件も無ければ null（＝未定）。 */
export function requestSpan(reqs: ReqLite[], rangeById: Map<string, Span>): Span | null {
  let lo = Infinity, hi = -Infinity;
  for (const r of reqs) {
    if (!r.sprintId) continue;
    const rng = rangeById.get(r.sprintId);
    if (!rng) continue;
    if (rng.startMs < lo) lo = rng.startMs;
    if (rng.endMs > hi) hi = rng.endMs;
  }
  return lo === Infinity ? null : { startMs: lo, endMs: hi };
}

/** 状態内訳バーの表示順（左＝完了→…→未着手）。 */
export const STATUS_ORDER: ReqStatus[] = ['done', 'manualtest', 'testing', 'doing', 'rework', 'todo'];

/** 要件集合を状態ごとに集計（表示順・0件は除外）。積み上げバーのセグメントに使う。 */
export function statusBreakdown(reqs: ReqLite[]): { status: ReqStatus; count: number }[] {
  const counts = new Map<ReqStatus, number>();
  for (const r of reqs) { const s = statusOf(r); counts.set(s, (counts.get(s) ?? 0) + 1); }
  return STATUS_ORDER.filter(s => (counts.get(s) ?? 0) > 0).map(s => ({ status: s, count: counts.get(s) as number }));
}

/** 完了率（done / 全件）。空なら 0。 */
export function completionRate(reqs: ReqLite[]): number {
  return reqs.length ? reqs.filter(isDone).length / reqs.length : 0;
}

/** 着地予定（span.endMs）の早い順。未定（null）は末尾、同着は seq 昇順で安定。 */
export function sortByLanding<T>(list: T[], spanOf: (t: T) => Span | null, seqOf: (t: T) => number): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const sa = spanOf(a.item), sb = spanOf(b.item);
      if (sa && sb && sa.endMs !== sb.endMs) return sa.endMs - sb.endMs;
      if (!sa && sb) return 1;
      if (sa && !sb) return -1;
      return (seqOf(a.item) - seqOf(b.item)) || (a.i - b.i);
    })
    .map(x => x.item);
}

/** 「全要件完了 かつ span が今日より前に終わっている」要求を history へ、それ以外を active へ。 */
export function partitionHistory<T>(
  list: T[], spanOf: (t: T) => Span | null, allDone: (t: T) => boolean, todayMs: number,
): { active: T[]; history: T[] } {
  const active: T[] = [], history: T[] = [];
  for (const t of list) {
    const sp = spanOf(t);
    if (allDone(t) && sp && sp.endMs <= todayMs) history.push(t);
    else active.push(t);
  }
  return { active, history };
}

/** 遅延ぎみ判定: スケジュール済み要件で「所属スプリント終了 ≤ 今日 かつ 未完了」が1件でもあれば true。 */
export function isRequestAtRisk(reqs: ReqLite[], rangeById: Map<string, Span>, todayMs: number): boolean {
  return reqs.some(r => {
    if (!r.sprintId || isDone(r)) return false;
    const rng = rangeById.get(r.sprintId);
    return !!rng && rng.endMs <= todayMs;
  });
}

export type GroupKey = 'none' | 'category' | 'platform';

/** 要求を key でグループ化（none は 1 グループ）。初出順を保つ。 */
export function groupRequests<T>(list: T[], key: GroupKey, keyOf: (t: T) => string | null): { key: string | null; items: T[] }[] {
  if (key === 'none') return [{ key: null, items: list }];
  const order: (string | null)[] = [];
  const m = new Map<string | null, T[]>();
  for (const t of list) {
    const k = keyOf(t);
    if (!m.has(k)) { m.set(k, []); order.push(k); }
    (m.get(k) as T[]).push(t);
  }
  return order.map(k => ({ key: k, items: m.get(k) as T[] }));
}

// ── 修正項目（要修正の要件にぶら下げる軽量チェックリスト） ──
export interface Fix { id: string; text: string; done: boolean; }
/** 修正が1件以上あり、すべて done なら true（＝全完了→自動でテストへ戻す条件）。 */
export function allFixesDone(fixes?: Fix[]): boolean {
  return !!fixes && fixes.length > 0 && fixes.every(f => f.done);
}
export function addFix(fixes: Fix[] | undefined, id: string, text: string): Fix[] {
  return [...(fixes ?? []), { id, text: text.trim(), done: false }];
}
export function toggleFix(fixes: Fix[], id: string): Fix[] {
  return fixes.map(f => (f.id === id ? { ...f, done: !f.done } : f));
}
export function updateFixText(fixes: Fix[], id: string, text: string): Fix[] {
  return fixes.map(f => (f.id === id ? { ...f, text: text.trim() } : f));
}
export function removeFix(fixes: Fix[], id: string): Fix[] {
  return fixes.filter(f => f.id !== id);
}

// ── プロジェクト軸（Phase 1: 既定 'sekkeiya' 固定。切替 UI は Phase 2） ──
export const DEFAULT_PROJECT_KEY = 'sekkeiya';
export function normalizeProjectKey(v?: string | null): string {
  const t = (v ?? '').trim();
  return t.length ? t : DEFAULT_PROJECT_KEY;
}
