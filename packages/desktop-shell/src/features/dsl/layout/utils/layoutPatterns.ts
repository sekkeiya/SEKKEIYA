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
}

export interface PatternSnapshot {
  lights?: LightConfig[];
  surface?: PatternSurface;
  /** itemId → 素材パターンの option id（'default' = 元素材） */
  itemMaterials?: Record<string, string>;
  /** itemId → 置き換え先の option id（'base' = 元モデル） */
  itemSwaps?: Record<string, string>;
}

export interface LayoutPattern extends PatternSnapshot {
  id: string;
  name: string;
  order?: number;
}

/** Firestore は undefined を受け付けないため、書き込み前に落とす（layoutStateApi と同じ方式）。 */
export function stripUndefinedDeep<T>(v: T): T {
  return JSON.parse(JSON.stringify(v ?? null));
}

/** 4要素すべて空＝保存する意味がないスナップショット。 */
export function isEmptySnapshot(s: PatternSnapshot): boolean {
  if (s.lights && s.lights.length > 0) return false;
  if (s.surface?.finishes && s.surface.finishes.length > 0) return false;
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
