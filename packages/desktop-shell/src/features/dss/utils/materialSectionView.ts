/**
 * S.Model 詳細画面 SECTION 1「素材」（閲覧モード）の表示ロジック。
 * MaterialSection.tsx から切り出した純粋関数だけを置く（React も three も参照しない）。
 */
import {
  resolveSelectedOption, slotMembers, variantSwatchColor, variantSwatchImage,
  type MaterialPresetOption, type MaterialPresetSlot, type MaterialVariant,
} from '../../shared/material/materialPresets';
import { slotDisplayTitle } from './materialSlotLabel';

/** スウォッチの見た目。imageUrl があれば画像を敷き、無ければ color のベタ塗り。 */
export interface SwatchVisual {
  imageUrl?: string;
  color: string;
}

const FALLBACK_SWATCH_COLOR = '#9aa0a6';

/**
 * オプション 1 件のスウォッチ表現。
 * テクスチャ主体のマテリアルは baseColor が乗算用の白になるため、albedo マップがあれば
 * それを最優先する（色だけを見せると白い矩形になり比較にならない）。
 */
export function swatchVisualOf(option: MaterialPresetOption): SwatchVisual {
  const imageUrl = option?.snapshot?.maps?.albedo || undefined;
  const color = option?.swatchColor || option?.snapshot?.params?.baseColor || FALLBACK_SWATCH_COLOR;
  return imageUrl ? { imageUrl, color } : { color };
}

/** パターン 1 件のカード表現。保存時サムネ > 代表テクスチャ > 代表色。 */
export function variantVisualOf(presets: MaterialPresetSlot[], variant: MaterialVariant): SwatchVisual {
  const color = variantSwatchColor(presets, variant);
  const imageUrl = variant.thumbUrl || variantSwatchImage(presets, variant) || undefined;
  return imageUrl ? { imageUrl, color } : { color };
}

/** selection（slotKey -> optionId）同士が同じ組み合わせかどうか。 */
export function selectionsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** ビューア下に出す「選択中」の文字列。未選択の部位は含めない。 */
export function selectionSummary(presets: MaterialPresetSlot[], selection: Record<string, string>): string {
  const parts: string[] = [];
  presets.forEach((ps, index) => {
    const optionId = selection[ps.slotKey];
    if (!optionId) return;
    const opt = resolveSelectedOption(ps, optionId);
    if (!opt) return;
    const name = slotDisplayTitle(ps.label, slotMembers(ps)[0]?.meshName, index);
    const title = (opt.title || '').trim();
    parts.push(title ? `${name} ${title}` : name);
  });
  return parts.length ? parts.join('　／　') : '元の見た目';
}

/** 4 列グリッドを埋めるための点線プレースホルダ数。カード 0 枚のときは 0。 */
export function placeholderCount(cardCount: number): number {
  if (cardCount <= 0) return 0;
  return (4 - (cardCount % 4)) % 4;
}
