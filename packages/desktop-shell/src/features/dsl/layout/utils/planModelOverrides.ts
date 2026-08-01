import type { LoopAnimSpec } from '../../../shared/walkthrough/loopAnim';

/**
 * プラン（layouts/{planId}）単位のモデル設定上書き。差分のみ持つ:
 * - materialVariantIds: このプランで提案する素材パターン id の絞り込み（未設定=デフォルト全部）
 * - swapModelIds:       このプランで許可する置き換え候補 id（未設定=デフォルト）
 * - anim:               常時アニメの上書き。null=このプランでは切る（未設定=デフォルト）
 * 仕様: docs/superpowers/specs/2026-08-01-plan-model-overrides-design.md §3
 */
export interface PlanModelOverride {
  materialVariantIds?: string[];
  swapModelIds?: string[];
  anim?: LoopAnimSpec | null;
}

export interface OverrideChainEntry {
  layoutId: string;
  modelOverrides: Record<string, PlanModelOverride>;
}

/**
 * Option → 親 Plan → Base の優先順チェーンから modelId の上書きを解決する。
 * エントリが最初に見つかった層を丸ごと採用する（フィールド単位のマージはしない —
 * 「この層の意図で確定」のほうが説明可能性が高い。仕様 §3.2）。
 */
export function resolveModelOverride(
  chain: OverrideChainEntry[],
  modelId: string,
): PlanModelOverride | null {
  for (const entry of chain) {
    const hit = entry?.modelOverrides?.[modelId];
    if (hit) return hit;
  }
  return null;
}

/**
 * 候補リストを id 絞り込みに掛ける。ids 未設定なら全件、設定時は積集合
 * （list の順序を維持し、モデル側から削除済みの id は無視する。仕様 §3.1）。
 */
export function filterByIds<T extends { id?: unknown }>(list: T[], ids?: string[]): T[] {
  if (!Array.isArray(ids)) return list;
  const allow = new Set(ids.map(String));
  return list.filter((x) => allow.has(String(x?.id ?? '')));
}
