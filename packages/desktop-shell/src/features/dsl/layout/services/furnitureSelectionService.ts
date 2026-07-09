// furnitureSelectionService.ts
// ①自動家具選定エンジン（ルールベース）。
//
// 「この空間にはどんな役割の家具がいくつ要るか」を、製品(アセット)を確定せずに決める工程。
// 出力は FurnitureSlot[]（役割 + 寸法エンベロープ + 配置関係 + 個数）で、②placeSlots / 製品解決へ
// そのまま渡せる契約になっている（[[project_slayout_auto_layout_arch]]）。
//
// スコープ階層: ゾーン → 部屋(roomId) → 住宅(全ゾーン) を入れ子で扱う。配置単位はゾーン。

import type { PlacementRelation } from '../types/layoutRules';
import type { FurnitureSlot, SlotScopeLevel } from '../types/furnitureSlot';
import { getCategoryMeta, getLayoutCategoryLabel } from '../constants/furnitureCategoryDefaults';
import { getRoomCategoryMeta } from '../constants/roomCategories';
import type { ZoneNode } from '../store/useLayoutTaskStore';

/** 部屋プログラムの1エントリ。categoryKey は FURNITURE_CATEGORIES の細粒度キー（寸法の出所）。 */
interface ProgramEntry {
  categoryKey: string;
  relation: PlacementRelation;
  /** 個数。'seats' のときはゾーンの座席数/面積から動的に決める */
  count: number | 'seats';
  /** around 等の親役割（layoutCategory） */
  anchorRole?: string;
}

/**
 * ZonePurpose → 家具プログラム（必要な役割と個数）。
 * roomCategories.ts の purpose と対応。'general' は空（選定対象外）。
 */
const ROOM_PROGRAMS: Record<string, ProgramEntry[]> = {
  living: [
    { categoryKey: 'sofa_3seat',  relation: 'against_wall', count: 1 },
    { categoryKey: 'table_low',   relation: 'center',       count: 1 },
    { categoryKey: 'tv_board',    relation: 'against_wall', count: 1 },
    { categoryKey: 'plant_large', relation: 'corner',       count: 1 },
  ],
  dining: [
    { categoryKey: 'table_dining', relation: 'center', count: 1 },
    { categoryKey: 'chair_dining', relation: 'around', count: 'seats', anchorRole: 'dining_table' },
  ],
  bedroom: [
    { categoryKey: 'bed_double', relation: 'against_wall', count: 1 },
    { categoryKey: 'night_table', relation: 'beside',      count: 1, anchorRole: 'bed' },
    { categoryKey: 'wardrobe',   relation: 'against_wall', count: 1 },
  ],
  study: [
    { categoryKey: 'desk',         relation: 'against_wall', count: 1 },
    { categoryKey: 'chair_office', relation: 'center',       count: 1 },
    { categoryKey: 'bookshelf',    relation: 'against_wall', count: 1 },
  ],
  desk: [
    { categoryKey: 'desk',         relation: 'against_wall', count: 'seats' },
    { categoryKey: 'chair_office', relation: 'center',       count: 'seats' },
  ],
  meeting: [
    { categoryKey: 'table_meeting', relation: 'center', count: 1 },
    { categoryKey: 'chair_office',  relation: 'around', count: 'seats', anchorRole: 'table' },
  ],
  seating: [
    { categoryKey: 'table_dining', relation: 'center', count: 'seats' },
    { categoryKey: 'chair_dining', relation: 'around', count: 'seats', anchorRole: 'dining_table' },
  ],
  general: [],
};

/** ゾーンの面積(㎡)を rect から求める。rect 無しは 0。 */
function zoneAreaSqm(zone: ZoneNode): number {
  if (!zone.rect?.width || !zone.rect?.depth) return 0;
  return (zone.rect.width * zone.rect.depth) / 1_000_000;
}

/** ゾーンの座席数を決める: targetSeats 優先、無ければ面積から推定（2〜8脚） */
function zoneSeats(zone: ZoneNode): number {
  if (zone.targetSeats && zone.targetSeats > 0) return Math.min(zone.targetSeats, 8);
  const area = zoneAreaSqm(zone);
  return Math.max(2, Math.min(8, Math.round(area / 3)));
}

export interface ZoneSelection {
  zoneId: string;
  label: string;
  purpose: string;
  slots: FurnitureSlot[];
}

/** 1ゾーンのスロット選定。製品は確定しない。 */
export function generateSlotsForZone(zone: ZoneNode, buildingType?: string | null): ZoneSelection {
  const meta = getRoomCategoryMeta(zone.category, buildingType);
  const purpose = meta?.purpose ?? 'general';
  const program = ROOM_PROGRAMS[purpose] ?? [];
  const seats = zoneSeats(zone);

  const slots: FurnitureSlot[] = [];
  program.forEach((entry, i) => {
    const cm = getCategoryMeta(entry.categoryKey);
    if (!cm) return;
    const count = entry.count === 'seats' ? seats : entry.count;
    if (count <= 0) return;
    slots.push({
      slotId: `sel_${zone.id}_${i}`,
      role: cm.layoutCategory,
      envelopeMm: { wMin: cm.widthMm, wMax: cm.widthMm, dMin: cm.depthMm, dMax: cm.depthMm },
      styleTags: [],
      relation: entry.relation,
      count,
      anchorRef: entry.anchorRole,
    });
  });

  const label = meta?.label || zone.name || 'ゾーン';
  return { zoneId: zone.id, label, purpose, slots };
}

export interface SelectionContext {
  zones: ZoneNode[];
  buildingType?: string | null;
  activeZoneId?: string | null;
  selectedZoneIds?: string[];
}

/** スコープに含めるゾーンを解決する。 */
function resolveScopeZones(scope: SlotScopeLevel, ctx: SelectionContext): ZoneNode[] {
  const { zones, activeZoneId, selectedZoneIds = [] } = ctx;
  if (scope === 'house') return zones;

  // 基準ゾーン: 選択 → アクティブ → 先頭
  const anchorId = selectedZoneIds[0] || activeZoneId || zones[0]?.id;
  const anchor = zones.find(z => z.id === anchorId);

  if (scope === 'room') {
    if (!anchor) return [];
    // 同じ roomId のゾーン群。roomId が無ければ基準ゾーン単体。
    if (anchor.roomId) return zones.filter(z => z.roomId === anchor.roomId);
    return [anchor];
  }

  // scope === 'zone': 選択中ゾーン群（無ければアクティブ／先頭の単体）
  if (selectedZoneIds.length > 0) return zones.filter(z => selectedZoneIds.includes(z.id));
  return anchor ? [anchor] : [];
}

/**
 * スコープ（ゾーン/部屋/住宅）に対して家具を選定し、ゾーン別の FurnitureSlot を返す。
 * 中身が空（program 未定義の用途のみ）のゾーンは結果から除外する。
 */
export function generateSlots(scope: SlotScopeLevel, ctx: SelectionContext): ZoneSelection[] {
  const targetZones = resolveScopeZones(scope, ctx);
  return targetZones
    .map(z => generateSlotsForZone(z, ctx.buildingType))
    .filter(sel => sel.slots.length > 0);
}

/** 選定結果を人間可読の短い要約にする（toast 用）。 */
export function summarizeSelection(selections: ZoneSelection[]): string {
  if (selections.length === 0) return '選定対象の部屋が見つかりませんでした';
  const totalItems = selections.reduce(
    (sum, sel) => sum + sel.slots.reduce((s, slot) => s + slot.count, 0), 0,
  );
  const perZone = selections.slice(0, 3).map(sel => {
    const parts = sel.slots.map(s => `${getLayoutCategoryLabel(s.role)}×${s.count}`).join('・');
    return `${sel.label}（${parts}）`;
  });
  const more = selections.length > 3 ? ` ほか${selections.length - 3}室` : '';
  return `${selections.length}室・家具${totalItems}点を選定: ${perZone.join(' / ')}${more}`;
}
