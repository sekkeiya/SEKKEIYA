// MaterialBinding を React から扱うためのフックと組み立てヘルパー（Phase C 基盤）

import { useEffect, useState } from 'react';
import { subscribeModelBinding, bindingIdForModel, bindingIdForLayoutObject } from './materialBindingApi';
import type { DsmtMaterial, DsmtMaterialSnapshot, MaterialBinding, MaterialBindingSlot } from '../../dsmt/types';

/** DsmtMaterial（または workFile doc）から適用に必要な自己完結スナップショットを作る。 */
export function materialToSnapshot(m: DsmtMaterial | any): DsmtMaterialSnapshot {
  return {
    title: m?.title,
    category: m?.category,
    params: m?.params ?? { baseColor: '#b0b0b0', roughness: 0.6, metalness: 0 },
    maps: m?.maps ?? undefined,
    tiling: m?.tiling ?? undefined,
  };
}

/** スロットキー（meshName + materialIndex）で 1 つのスロットを upsert した新しいバインディングを返す（不変更新）。 */
export function upsertBindingSlot(
  existing: MaterialBinding | null,
  base: { targetType: 'model' | 'layoutObject'; modelId: string; layoutObjectId?: string },
  slot: { meshName?: string; materialIndex?: number; semanticLabel?: string },
  material: DsmtMaterial | any,
): MaterialBinding {
  const id = base.targetType === 'layoutObject' && base.layoutObjectId
    ? bindingIdForLayoutObject(base.layoutObjectId)
    : bindingIdForModel(base.modelId);

  const newSlot: MaterialBindingSlot = {
    meshName: slot.meshName,
    materialIndex: slot.materialIndex,
    semanticLabel: slot.semanticLabel,
    materialId: material?.id,
    material: materialToSnapshot(material),
  };

  const sameSlot = (s: MaterialBindingSlot) =>
    (s.meshName ?? null) === (newSlot.meshName ?? null) &&
    (s.materialIndex ?? null) === (newSlot.materialIndex ?? null);

  const prevSlots = existing?.slots ?? [];
  const slots = prevSlots.some(sameSlot)
    ? prevSlots.map((s) => (sameSlot(s) ? { ...s, ...newSlot, semanticLabel: newSlot.semanticLabel ?? s.semanticLabel } : s))
    : [...prevSlots, newSlot];

  return {
    id,
    targetType: base.targetType,
    modelId: base.modelId,
    layoutObjectId: base.layoutObjectId,
    slots,
  };
}

/** スロットを 1 つ削除した新しいバインディングを返す。 */
export function removeBindingSlot(existing: MaterialBinding, slot: { meshName?: string; materialIndex?: number }): MaterialBinding {
  const slots = existing.slots.filter((s) =>
    !((s.meshName ?? null) === (slot.meshName ?? null) && (s.materialIndex ?? null) === (slot.materialIndex ?? null)),
  );
  return { ...existing, slots };
}

/** モデル既定バインディングをライブ購読するフック。 */
export function useModelBinding(projectId?: string, modelId?: string) {
  const [binding, setBinding] = useState<MaterialBinding | null>(null);
  const [loading, setLoading] = useState<boolean>(!!(projectId && modelId));

  useEffect(() => {
    if (!projectId || !modelId) { setBinding(null); setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeModelBinding(projectId, modelId, (b) => { setBinding(b); setLoading(false); });
    return () => unsub();
  }, [projectId, modelId]);

  return { binding, loading };
}
