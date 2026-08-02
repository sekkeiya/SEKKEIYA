import type { LightConfig } from '../store/useLightingStore';
import type { SurfaceFinish } from '../store/useSurfaceFinishStore';

/**
 * Option を階層ではなく「見た目の組み合わせパターン」として持つためのデータ。
 * 仕様: docs/superpowers/specs/2026-08-01-option-patterns-design.md
 *
 * 差分のみ持つ（未設定のフィールドはプラン/Base の既定へ透過する）。
 * 家具の2項目は「選んだ選択肢の id」を持つ（実バインディングを凍結しない）——
 * 実効バインディングは FurnitureItem のローカル変数に閉じていて外から取れず、
 * また id 参照ならモデル側でパターンが編集されても追従するため。
 */
export interface PatternSurface {
  finishes: SurfaceFinish[];
  activePatterns?: Record<string, string | null>;
  /**
   * 内壁/外壁/床にまとめて貼る素材（useDrawnFinishStore）。面ごとの finishes とは別ストアで、
   * これを含めないと「壁や床の素材が解除された」ように見える（2026-08-01 実機で発生）。
   */
  drawnFinishes?: {
    interiorWall?: unknown | null;
    exteriorWall?: unknown | null;
    floor?: unknown | null;
    styleKey?: string | null;
  } | null;
}

export interface PatternSnapshot {
  lights?: LightConfig[];
  surface?: PatternSurface;
  /** itemId → 素材パターンの option id（'default' = 元素材） */
  itemMaterials?: Record<string, string>;
  /** itemId → 置き換え先の option id（'base' = 元モデル） */
  itemSwaps?: Record<string, string>;
  /** 家具配置のスナップショット（v2）。無し = 配置は現状のまま（v1 提案の後方互換）。 */
  items?: Record<string, unknown>[];
}

export interface LayoutPattern extends PatternSnapshot {
  id: string;
  name: string;
  /** この提案が使う家具配置。null/undefined = 躯体のみの提案（Plan を切り替えない）。 */
  planId?: string | null;
  order?: number;
}

/** items スナップショットの Firestore doc サイズガード（1MB 制限に対する安全マージン）。 */
export const PATTERN_ITEMS_BYTE_LIMIT = 900_000;

/** Firestore は undefined を受け付けないため、書き込み前に落とす（layoutStateApi と同じ方式）。 */
export function stripUndefinedDeep<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}

/** 4要素すべて空＝保存する意味がないスナップショット。 */
export function isEmptySnapshot(s: PatternSnapshot): boolean {
  if (s.lights && s.lights.length > 0) return false;
  if (s.surface?.finishes && s.surface.finishes.length > 0) return false;
  if (s.surface?.drawnFinishes) return false;
  if (s.itemMaterials && Object.keys(s.itemMaterials).length > 0) return false;
  if (s.itemSwaps && Object.keys(s.itemSwaps).length > 0) return false;
  return true;
}

/**
 * 保存した option id を、現在の選択肢配列の index へ解決する。
 * 見つからない場合は 0（＝元の見た目）へ倒す——モデル側からパターンが消えても壊れないように。
 */
export function resolveOptionIndex(
  options: { id: string }[],
  optionId: string | undefined | null,
  baseId: string,
): number {
  if (!optionId || optionId === baseId) return 0;
  const i = options.findIndex((o) => String(o.id) === String(optionId));
  return i > 0 ? i : 0;
}

/** 提案が参照する Plan の解決結果。UI の「使用 Plan 名／Plan が見つかりません」表示に使う。 */
export type ProposalPlanRef =
  | { kind: 'none' }                 // 躯体のみの提案
  | { kind: 'ok'; name: string }
  | { kind: 'missing' };             // 参照先 Plan が削除された

export function resolveProposalPlan(
  planId: string | null | undefined,
  plans: { id: string; name?: string }[],
): ProposalPlanRef {
  if (!planId) return { kind: 'none' };
  const p = plans.find((x) => x.id === planId);
  if (!p) return { kind: 'missing' };
  return { kind: 'ok', name: p.name || 'Plan' };
}

/**
 * Plan の items を提案 doc に入れられる形へ軽量化する。
 * - `_` 始まりの内部フィールド（_assetDraft 等）を除去
 * - JSON にならない値（関数・undefined）は stripUndefinedDeep と同じ理屈で落ちる
 * - 非配列（null/undefined）・サイズ超過は undefined（＝配置はキャプチャしない。見た目だけ保存を続ける）
 * - 空配列は `[]` を返す（undefined にすると呼び出し側の `...(items ? { items } : {})` で
 *   items フィールドごと落ち、提案 doc に古い items が残ってしまう —
 *   「家具を全部消した」状態がキャプチャできないバグになる）
 */
export function sanitizeItemsForSnapshot(items: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(items)) return undefined;
  if (items.length === 0) return [];
  const cleaned = items.map((it) => {
    const src = (it ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(src)) {
      if (key.startsWith('_')) continue;
      out[key] = src[key];
    }
    return stripUndefinedDeep(out);
  });
  const bytes = new TextEncoder().encode(JSON.stringify(cleaned)).length;
  if (bytes > PATTERN_ITEMS_BYTE_LIMIT) {
    console.warn(`[layoutPatterns] 配置スナップショットが上限超過（${bytes}B）— 配置のキャプチャをスキップします`);
    return undefined;
  }
  return cleaned;
}
