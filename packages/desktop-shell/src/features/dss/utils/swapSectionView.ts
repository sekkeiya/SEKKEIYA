/**
 * S.Model 詳細画面 SECTION 2「置き換え」（閲覧モード）の寸法比較表のロジック。
 * SwapSection.tsx から切り出した純粋関数だけを置く（React を参照しない）。
 */

// interface ではなく type にしているのは、TypeScript が暗黙のインデックスシグネチャを
// 与えるのが型エイリアスだけだから。これが無いと resolveViewerYawDeg のような
// 「余剰プロパティを許す受け口」へそのまま渡せない。
export type SwapDims = {
  width?: number;
  depth?: number;
  height?: number;
  seatHeight?: number;
  /** GLB の向き補正。候補モデルの実体から来ることがある。 */
  yawDeg?: number;
};

export interface DimCompareRow {
  key: 'width' | 'depth' | 'height' | 'seatHeight';
  label: string;
  own: number;
  candidate: number;
  /** 差（candidate − own）。比較相手が無い／どちらかが未登録なら null。 */
  diff: number | null;
}

/** 差がこの値以下なら「同寸」とみなす。dimsDiffLabel の判定と揃えている。 */
const SAME_SIZE_TOLERANCE_MM = 5;

const NEUTRAL_COLOR = 'rgba(148,163,184,0.6)';
const LARGER_COLOR = '#f0997b';
const SMALLER_COLOR = '#5dcaa5';

const num = (v: unknown): number => Number(v) || 0;

/**
 * 寸法比較表の行を作る。
 * candidate が null なら「元モデルのみ」の表示になり、diff は常に null。
 * SH の行は、元モデルか候補のどちらかに座面高があるときだけ含める。
 */
export function buildDimCompareRows(
  own: SwapDims | null | undefined,
  candidate: SwapDims | null | undefined,
): DimCompareRow[] {
  const hasCandidate = !!candidate;
  const build = (key: DimCompareRow['key'], label: string): DimCompareRow => {
    const o = num(own?.[key]);
    const c = num(candidate?.[key]);
    let diff: number | null = null;
    if (hasCandidate && o > 0 && c > 0) {
      const raw = c - o;
      diff = Math.abs(raw) <= SAME_SIZE_TOLERANCE_MM ? 0 : raw;
    }
    return { key, label, own: o, candidate: c, diff };
  };

  const rows = [
    build('width', 'W 幅'),
    build('depth', 'D 奥行'),
    build('height', 'H 高さ'),
  ];
  const seat = build('seatHeight', 'SH 座面高');
  if (seat.own > 0 || seat.candidate > 0) rows.push(seat);
  return rows;
}

/** 差の表示文字列。0 は `±0`、正は `+100`、負は全角マイナスで `−40`、null は空文字。 */
export function formatDiff(diff: number | null): string {
  if (diff === null) return '';
  const rounded = Math.round(diff);
  if (rounded === 0) return '±0';
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

/** 差に対応する文字色。 */
export function diffColor(diff: number | null): string {
  if (diff === null || diff === 0) return NEUTRAL_COLOR;
  return diff > 0 ? LARGER_COLOR : SMALLER_COLOR;
}

/** 置き換え候補として保存されている参照（extendedMetadata.swapModels の1件）。 */
export interface SwapCandidateRef {
  id: string;
  title?: string;
  thumbUrl?: string | null;
  dimensions?: SwapDims | null;
}

/** 読み込み済み一覧から引いたモデル実体のうち、このセクションが見る部分。 */
export interface SwapCandidateLive {
  id?: string;
  title?: string;
  name?: string;
  thumbnailUrl?: string | null;
  thumbnail?: string | null;
  dimensions?: SwapDims | null;
}

export interface MergedSwapCandidate {
  title: string;
  thumbUrl: string | null;
  dimensions: SwapDims | null;
}

/**
 * 候補の表示情報を解決する。
 *
 * `extendedMetadata.swapModels` に入っているのは *登録した時点のスナップショット* であり
 * （DssFurnitureSwap の addModel が asset の値をコピーして保存する）、候補モデル本体を
 * あとから編集してもこのコピーは更新されない。そのため寸法を直しても置き換えセクションだけ
 * 古い値のままになる（2026-08-02 に実際に発生）。
 *
 * 読み込み済み一覧に実体があるならそちらが正。項目ごとにフォールバックするので、
 * 実体が一部のフィールドしか持たなくても壊れない。
 */
export function mergeSwapCandidate(
  ref: SwapCandidateRef,
  live: SwapCandidateLive | null | undefined,
): MergedSwapCandidate {
  const liveTitle = (live?.title || live?.name || '').trim();
  const liveThumb = live?.thumbnailUrl || live?.thumbnail || null;
  return {
    title: liveTitle || ref.title || '',
    thumbUrl: liveThumb || ref.thumbUrl || null,
    dimensions: live?.dimensions || ref.dimensions || null,
  };
}
