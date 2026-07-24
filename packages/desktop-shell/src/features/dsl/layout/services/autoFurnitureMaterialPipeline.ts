/**
 * 自動家具マテリアル付与パイプライン
 *
 * 家具に登録された MaterialVariant（スタイルパターン）を、
 * スタイルキー（natural/modern/japandi）に基づいて自動選択し、
 * materialBindings を生成して layoutDraft アイテムに反映する。
 *
 * 選択ロジック:
 *  1. variant.title をスタイルキーワードでスコアリング → 高得点を採用
 *  2. 同点なら isDefault を優先
 *  3. スコア0（キーワード不一致）なら isDefault → 先頭バリアント にフォールバック
 */
import { readMaterialPresets, readMaterialVariants, expandVariantSelection, buildBindingsFromSelection } from "../../../shared/material/materialPresets";
import type { MaterialVariant, MaterialPresetSlot } from "../../../shared/material/materialPresets";
import { useItemMaterialRegistryStore } from "../store/itemMaterialRegistryStore";

export type FurnitureMaterialStyleKey = "natural" | "modern" | "japandi";

interface FurnitureStyleSpec {
  label: string;
  /** variant.title に対するマッチキーワード（case-insensitive）。 */
  keywords: string[];
}

export const FURNITURE_MATERIAL_STYLES: Record<FurnitureMaterialStyleKey, FurnitureStyleSpec> = {
  natural: {
    label: "ナチュラル",
    keywords: ["ナチュラル", "natural", "木", "oak", "オーク", "ウォールナット", "walnut", "パイン", "pine", "ブラウン", "brown", "ベージュ", "beige", "アイボリー"],
  },
  modern: {
    label: "モダン",
    keywords: ["モダン", "modern", "ブラック", "black", "グレー", "gray", "grey", "グレイ", "スチール", "steel", "ホワイト", "white", "シルバー", "silver", "ダーク", "dark"],
  },
  japandi: {
    label: "ジャパンディ",
    keywords: ["ジャパンディ", "japandi", "和", "桐", "アッシュ", "ash", "竹", "bamboo", "シンプル", "simple", "ナチュラルホワイト", "グレージュ", "greige", "スモーク"],
  },
};

/** variant.title をスタイルキーワードでスコアリングして最適バリアントを選ぶ。 */
export function pickVariantForStyle(
  variants: MaterialVariant[],
  styleKey: FurnitureMaterialStyleKey,
): MaterialVariant | null {
  if (!variants.length) return null;

  const keywords = FURNITURE_MATERIAL_STYLES[styleKey]?.keywords ?? [];
  let best: MaterialVariant | null = null;
  let bestScore = -Infinity;

  for (const v of variants) {
    const title = (v.title ?? "").toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (title.includes(kw.toLowerCase())) score += 1;
    }
    // isDefault でタイブレーク（差し込み量は1未満）
    if (v.isDefault) score += 0.5;
    if (score > bestScore) { best = v; bestScore = score; }
  }

  // キーワード一致なし → isDefault or 先頭
  if (bestScore <= 0.5) {
    return variants.find((v) => v.isDefault) ?? variants[0];
  }
  return best;
}

export interface AutoFurnitureMaterialResult {
  ok: boolean;
  updatedItems: any[];
  applied: number;
  skipped: number;
  styleLabel: string;
  reason?: string;
}

/**
 * layoutItems を走査し、materialVariants を持つアイテムにスタイル一致バリアントを自動適用する。
 * 各アイテムの materialPresets/materialVariants は item 直属 → assets/{modelId} の順で解決。
 */
export async function autoApplyFurnitureMaterials(
  styleKey: FurnitureMaterialStyleKey,
  layoutItems: any[],
  _projectId?: string,
): Promise<AutoFurnitureMaterialResult> {
  const styleSpec = FURNITURE_MATERIAL_STYLES[styleKey];
  if (!styleSpec) {
    return { ok: false, updatedItems: layoutItems, applied: 0, skipped: 0, styleLabel: styleKey, reason: "不明なスタイルキー" };
  }

  if (!layoutItems.length) {
    return { ok: false, updatedItems: [], applied: 0, skipped: 0, styleLabel: styleSpec.label, reason: "配置家具がありません" };
  }

  // 未取得のアセット ID を収集して一括フェッチ
  const missingIds = new Set<string>();
  for (const item of layoutItems) {
    if (item?.modelId && !Array.isArray(item.materialPresets)) {
      missingIds.add(String(item.modelId));
    }
  }

  const assetCache: Record<string, any> = {};
  if (missingIds.size) {
    const { db } = await import("../../../../lib/firebase/client");
    const { doc, getDoc } = await import("firebase/firestore");
    await Promise.all(
      [...missingIds].map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "assets", id));
          if (snap.exists()) assetCache[id] = { id: snap.id, ...snap.data() };
        } catch { /* ignore */ }
      })
    );
  }

  let applied = 0;
  let skipped = 0;

  const updatedItems = layoutItems.map((item) => {
    if (!item) return item;

    // presets/variants はアイテム直属 → フェッチ済みアセット の順で解決
    const assetDoc = item.modelId ? assetCache[String(item.modelId)] : null;
    const presetsSource = Array.isArray(item.materialPresets) ? item : assetDoc;
    const variantsSource = Array.isArray(item.materialVariants) ? item : assetDoc;

    const presets: MaterialPresetSlot[] = readMaterialPresets(presetsSource);
    const variants: MaterialVariant[] = readMaterialVariants(variantsSource);

    if (!presets.length || !variants.length) {
      skipped++;
      return item;
    }

    const variant = pickVariantForStyle(variants, styleKey);
    if (!variant) {
      skipped++;
      return item;
    }

    const selection = expandVariantSelection(presets, variant);
    const materialBindings = buildBindingsFromSelection(presets, selection);

    if (!materialBindings.length) {
      skipped++;
      return item;
    }

    applied++;
    return { ...item, materialBindings };
  });

  const ok = applied > 0;
  const reason = ok ? undefined : "マテリアルプリセットが登録されている家具が見つかりませんでした";
  return { ok, updatedItems, applied, skipped, styleLabel: styleSpec.label, reason };
}

export interface ApplyFromRegistryResult {
  applied: number;
  styleLabel: string;
}

/**
 * useItemMaterialRegistryStore に登録済みのバリアントを使って即座にマテリアルを適用する。
 * Firestore 不要・即時反映。ウォークスルー FAB から呼び出す。
 *
 * 各 FurnitureItem は matVariants をもとに option.label = variant.title で登録しているため、
 * ここでスタイルキーワードと突き合わせて最適 option の apply() を呼ぶだけでよい。
 */
export function applyFurnitureMaterialStyleFromRegistry(
  styleKey: FurnitureMaterialStyleKey,
): ApplyFromRegistryResult {
  const styleSpec = FURNITURE_MATERIAL_STYLES[styleKey];
  if (!styleSpec) return { applied: 0, styleLabel: styleKey };

  const keywords = styleSpec.keywords;
  const { map } = useItemMaterialRegistryStore.getState();
  let applied = 0;

  map.forEach((entry) => {
    // デフォルトのみのアイテムはスキップ（バリアントなし）
    const variants = entry.options.filter((o) => o.id !== "default");
    if (!variants.length) return;

    // スタイルキーワードで option.label をスコアリング
    let best = variants[0];
    let bestScore = -1;
    for (const opt of variants) {
      const label = (opt.label ?? "").toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (label.includes(kw.toLowerCase())) score += 1;
      }
      if (score > bestScore) { best = opt; bestScore = score; }
    }

    best?.apply?.();
    applied++;
  });

  return { applied, styleLabel: styleSpec.label };
}
