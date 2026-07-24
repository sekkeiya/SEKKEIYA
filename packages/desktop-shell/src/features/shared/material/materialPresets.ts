// マテリアル・コンフィギュレーター（部位ごとの複数マテリアルオプション）の型と適用ヘルパー。
//
// MaterialBinding が「1スロット=1マテリアル」だったのに対し、ここでは
// 「1スロット（部位）= 複数オプション」を扱う。オプションは自己完結スナップショットを内包するため、
// 公開モデルを閲覧する全ユーザーがプロジェクト権限なしでライブ切替できる。
// 適用は既存の applyBindingToObject を再利用する。

import type { DsmtMaterialSnapshot } from '../../dsmt/types';
import { applyBindingToObject } from './applyMaterial';

/** 部位に登録された1つのマテリアル選択肢。 */
export interface MaterialPresetOption {
  id: string;
  title?: string;
  /** スウォッチ表示用の色（無ければ snapshot.params.baseColor を使う）。 */
  swatchColor?: string;
  /** 適用に必要な自己完結スナップショット。 */
  snapshot: DsmtMaterialSnapshot;
  /** 既定で適用するオプション。 */
  isDefault?: boolean;
}

/** グループに属する1メッシュ（＋マテリアルindex）の識別子。 */
export interface MaterialPresetMember {
  meshName?: string;
  materialIndex: number;
}

/**
 * 1部位（=パーツのグループ）に対する複数オプション。
 * members に複数メッシュを入れると「同じ張地のパーツをまとめて1つの素材で切替」できる。
 * 後方互換: members が無い場合は meshName/materialIndex の単一メッシュとして扱う。
 */
export interface MaterialPresetSlot {
  slotKey: string;
  meshName?: string;
  materialIndex: number;
  /** ★グループのメンバー（複数メッシュ）。未設定なら meshName/materialIndex の単一。 */
  members?: MaterialPresetMember[];
  /** 役割名（張地 / 脚 など）。 */
  label?: string;
  options: MaterialPresetOption[];
}

/** スロットのメンバー一覧を返す（members 優先、無ければ単一メッシュにフォールバック）。 */
export function slotMembers(slot: { members?: MaterialPresetMember[]; meshName?: string; materialIndex?: number }): MaterialPresetMember[] {
  if (slot.members && slot.members.length) return slot.members;
  return [{ meshName: slot.meshName, materialIndex: slot.materialIndex ?? 0 }];
}

/** スロットのメンバー数（>1 ならグループ）。 */
export const slotMemberCount = (slot: MaterialPresetSlot): number => slotMembers(slot).length;

/**
 * 家具まるごと1パターン（バリアント）。
 * 各部位（slotKey）にどのオプション（optionId）を割り当てるかの組み合わせを保持する。
 * 部位ごとのオプション（MaterialPresetSlot.options）を参照するだけなので、
 * 同じ素材を二重保存しない。閲覧者はボタン1つで家具全体の見た目を切り替えられる。
 */
export interface MaterialVariant {
  id: string;
  title?: string;
  /** スウォッチ表示用の色（無ければ代表部位の色を使う）。 */
  swatchColor?: string;
  /** slotKey -> optionId の組み合わせ。 */
  selection: Record<string, string>;
  /** 既定で適用するパターン。 */
  isDefault?: boolean;
  /** 保存時に3Dビューアから取得したサムネイル画像のURL（素材バリエーション・ギャラリー用）。 */
  thumbUrl?: string | null;
}

export const presetSlotKey = (s: { meshName?: string; materialIndex?: number }) =>
  `${s.meshName && s.meshName.length ? s.meshName : ''}#${s.materialIndex ?? 0}`;

export const swatchColorOf = (opt?: MaterialPresetOption) =>
  opt?.swatchColor || opt?.snapshot?.params?.baseColor || '#9aa0a6';

/** あるスロットで「現在選択中」または既定のオプションを返す。 */
export function resolveSelectedOption(
  slot: MaterialPresetSlot,
  selectedId?: string,
): MaterialPresetOption | undefined {
  if (!slot.options.length) return undefined;
  return (
    (selectedId && slot.options.find((o) => o.id === selectedId)) ||
    slot.options.find((o) => o.isDefault) ||
    slot.options[0]
  );
}

/**
 * selection（slotKey -> optionId）から、配置アイテムに保存するマテリアル・バインディング配列を作る。
 * S.Layout の FurnitureItem が item.materialBindings として applyBindingToObject で適用する。
 */
export function buildBindingsFromSelection(
  presets: MaterialPresetSlot[],
  selection: Record<string, string>,
): Array<{ meshName?: string; materialIndex: number; material: any }> {
  const out: Array<{ meshName?: string; materialIndex: number; material: any }> = [];
  for (const ps of presets) {
    // 明示的に選択された部位のみ上書き（未選択＝元のGLB素材を維持＝「デフォルト」）。
    const sel = selection[ps.slotKey];
    if (!sel) continue;
    const opt = ps.options.find((o) => o.id === sel);
    if (!opt) continue;
    // グループの全メンバーへ同じ素材を適用
    for (const m of slotMembers(ps)) {
      out.push({ meshName: m.meshName || undefined, materialIndex: m.materialIndex, material: opt.snapshot });
    }
  }
  return out;
}

/**
 * selection（slotKey -> optionId）に従って、各部位に選択中マテリアルを適用する。
 * @returns 適用したスロット数
 */
export async function applySelectionToObject(
  root: any,
  presets: MaterialPresetSlot[],
  selection: Record<string, string>,
): Promise<number> {
  if (!root || !presets?.length) return 0;
  const slots: any[] = [];
  for (const ps of presets) {
    // 明示的に選択された部位のみ適用（未選択＝元のGLB素材を維持）。
    const sel = selection[ps.slotKey];
    if (!sel) continue;
    const opt = ps.options.find((o) => o.id === sel);
    if (!opt) continue;
    for (const m of slotMembers(ps)) {
      slots.push({ meshName: m.meshName || undefined, materialIndex: m.materialIndex, material: opt.snapshot });
    }
  }
  if (!slots.length) return 0;
  return applyBindingToObject(root, { id: '', targetType: 'model', modelId: '', slots } as any);
}

/** バリアントの「現在選択中」または既定を返す。 */
export function resolveSelectedVariant(
  variants: MaterialVariant[],
  selectedId?: string,
): MaterialVariant | undefined {
  if (!variants?.length) return undefined;
  return (
    (selectedId && variants.find((v) => v.id === selectedId)) ||
    variants.find((v) => v.isDefault) ||
    undefined
  );
}

/**
 * バリアントの selection を、presets の既定で埋めた完全な selection に展開する。
 * 部位がバリアントに含まれていなければ、その部位の既定オプションを使う。
 */
export function expandVariantSelection(
  presets: MaterialPresetSlot[],
  variant: MaterialVariant,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const ps of presets) {
    const fromVariant = variant.selection?.[ps.slotKey];
    const opt = resolveSelectedOption(ps, fromVariant);
    if (opt) out[ps.slotKey] = opt.id;
  }
  return out;
}

/** バリアントの代表色（明示色 or 最初の部位の選択中オプション色）。 */
export function variantSwatchColor(
  presets: MaterialPresetSlot[],
  variant: MaterialVariant,
): string {
  if (variant.swatchColor) return variant.swatchColor;
  for (const ps of presets) {
    const opt = resolveSelectedOption(ps, variant.selection?.[ps.slotKey]);
    if (opt) return swatchColorOf(opt);
  }
  return '#9aa0a6';
}

/** バリアントの代表テクスチャ画像（最初に見つかった選択中オプションの albedo マップ）。無ければ undefined。 */
export function variantSwatchImage(
  presets: MaterialPresetSlot[],
  variant: MaterialVariant,
): string | undefined {
  for (const ps of presets) {
    const opt = resolveSelectedOption(ps, variant.selection?.[ps.slotKey]);
    const url = opt?.snapshot?.maps?.albedo;
    if (url) return url;
  }
  return undefined;
}

/** model ドキュメントから variants 配列を安全に取り出す。 */
export function readMaterialVariants(model: any): MaterialVariant[] {
  const raw = model?.materialVariants;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v) => v && typeof v.id === 'string' && v.selection && typeof v.selection === 'object')
    .map((v) => ({
      id: v.id,
      title: v.title ?? '',
      swatchColor: v.swatchColor ?? undefined,
      selection: { ...v.selection },
      isDefault: !!v.isDefault,
    }));
}

/** model ドキュメントから presets 配列を安全に取り出す。 */
export function readMaterialPresets(model: any): MaterialPresetSlot[] {
  const raw = model?.materialPresets;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && typeof s.slotKey === 'string' && Array.isArray(s.options))
    .map((s) => ({
      slotKey: s.slotKey,
      meshName: s.meshName ?? undefined,
      materialIndex: Number(s.materialIndex) || 0,
      members: Array.isArray(s.members) && s.members.length
        ? s.members
            .filter((m: any) => m && typeof m === 'object')
            .map((m: any) => ({ meshName: m.meshName ?? undefined, materialIndex: Number(m.materialIndex) || 0 }))
        : undefined,
      label: s.label ?? '',
      options: s.options.filter((o: any) => o && o.id && o.snapshot),
    }));
}
