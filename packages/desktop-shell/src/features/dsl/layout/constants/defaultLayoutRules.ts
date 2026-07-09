import type { BuildingType, FurnitureCategoryRelation, LayoutRuleSet } from '../types/layoutRules';

// ─── カテゴリ関係（アンカー → コンパニオン） ───────────────────────────────────

/** 住宅（リビング中心） */
export const DEFAULT_RESIDENTIAL_RELATIONS: FurnitureCategoryRelation[] = [
  { id: 'rel-sofa-coffee',    anchorCategory: 'sofa',         companionCategory: 'coffee_table', relation: 'in_front', distanceMm: 450, count: 1, isActive: true },
  { id: 'rel-sofa-side',      anchorCategory: 'sofa',         companionCategory: 'side_table',   relation: 'beside',   distanceMm: 200, count: 2, isActive: true },
  { id: 'rel-dining-chair',   anchorCategory: 'dining_table', companionCategory: 'chair',        relation: 'around',   distanceMm: 500, count: 4, isActive: true },
  { id: 'rel-bed-night',      anchorCategory: 'bed',          companionCategory: 'night_table',  relation: 'beside',   distanceMm: 100, count: 2, isActive: true },
  { id: 'rel-desk-chair',     anchorCategory: 'desk',         companionCategory: 'chair',        relation: 'in_front', distanceMm: 400, count: 1, isActive: true },
  { id: 'rel-sofa-rug',       anchorCategory: 'sofa',         companionCategory: 'rug',          relation: 'in_front', distanceMm: 100, count: 1, isActive: false },
  { id: 'rel-bed-rug',        anchorCategory: 'bed',          companionCategory: 'rug',          relation: 'in_front', distanceMm: 200, count: 1, isActive: false },
];

/** 住宅・寝室 */
export const DEFAULT_BEDROOM_RELATIONS: FurnitureCategoryRelation[] = [
  { id: 'rel-bed-night-br',   anchorCategory: 'bed',      companionCategory: 'night_table', relation: 'beside',   distanceMm: 100, count: 2, isActive: true },
  { id: 'rel-bed-rug-br',     anchorCategory: 'bed',      companionCategory: 'rug',         relation: 'in_front', distanceMm: 150, count: 1, isActive: true },
  { id: 'rel-desk-chair-br',  anchorCategory: 'desk',     companionCategory: 'chair',       relation: 'in_front', distanceMm: 400, count: 1, isActive: true },
];

/** カフェ */
export const DEFAULT_CAFE_RELATIONS: FurnitureCategoryRelation[] = [
  { id: 'rel-cafe-table-chair',  anchorCategory: 'table',      companionCategory: 'chair',     relation: 'around',   distanceMm: 400, count: 4, isActive: true },
  { id: 'rel-cafe-bar-stool',    anchorCategory: 'counter',    companionCategory: 'bar_stool', relation: 'in_front', distanceMm: 350, count: 3, isActive: true },
  { id: 'rel-cafe-bartable-st',  anchorCategory: 'table',      companionCategory: 'bar_stool', relation: 'around',   distanceMm: 350, count: 4, isActive: false },
];

/** オフィス */
export const DEFAULT_OFFICE_RELATIONS: FurnitureCategoryRelation[] = [
  { id: 'rel-off-desk-chair',   anchorCategory: 'desk',  companionCategory: 'chair',     relation: 'in_front', distanceMm: 400, count: 1, isActive: true },
  { id: 'rel-off-table-chair',  anchorCategory: 'table', companionCategory: 'chair',     relation: 'around',   distanceMm: 500, count: 6, isActive: true },
  { id: 'rel-off-table-plant',  anchorCategory: 'table', companionCategory: 'plant',     relation: 'beside',   distanceMm: 300, count: 1, isActive: false },
];

/** ホテル */
export const DEFAULT_HOTEL_RELATIONS: FurnitureCategoryRelation[] = [
  { id: 'rel-hotel-bed-night',  anchorCategory: 'bed',   companionCategory: 'night_table', relation: 'beside',   distanceMm: 100, count: 2, isActive: true },
  { id: 'rel-hotel-desk-chair', anchorCategory: 'desk',  companionCategory: 'chair',       relation: 'in_front', distanceMm: 400, count: 1, isActive: true },
  { id: 'rel-hotel-sofa-table', anchorCategory: 'sofa',  companionCategory: 'coffee_table', relation: 'in_front', distanceMm: 400, count: 1, isActive: true },
];

// ─── 配置ルール ──────────────────────────────────────────────────────────────

export const DEFAULT_RESIDENTIAL_RULES: LayoutRuleSet = {
  buildingType: 'residential',
  rules: [
    { id: 'res-sofa-01',        buildingType: 'residential', furnitureCategory: 'sofa',         placement: { relation: 'against_wall', marginFromWall: 200, minPassageWidth: 800,  priority: 100 } },
    { id: 'res-dining-01',      buildingType: 'residential', furnitureCategory: 'dining_table', placement: { relation: 'center',       minPassageWidth: 900, spacingBetweenItems: 1200, priority: 95 } },
    { id: 'res-bed-01',         buildingType: 'residential', furnitureCategory: 'bed',          placement: { relation: 'corner',       marginFromWall: 100, minPassageWidth: 600,  priority: 90 } },
    { id: 'res-desk-01',        buildingType: 'residential', furnitureCategory: 'desk',         placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 800,  priority: 85 } },
    { id: 'res-table-01',       buildingType: 'residential', furnitureCategory: 'table',        placement: { relation: 'center',       minPassageWidth: 800, spacingBetweenItems: 1000, priority: 80 } },
    { id: 'res-cabinet-01',     buildingType: 'residential', furnitureCategory: 'cabinet',      placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 700,  priority: 60 } },
    { id: 'res-shelf-01',       buildingType: 'residential', furnitureCategory: 'shelf',        placement: { relation: 'against_wall', marginFromWall: 0,   minPassageWidth: 600,  priority: 55 } },
    { id: 'res-chair-01',       buildingType: 'residential', furnitureCategory: 'chair',        placement: { relation: 'around',       minPassageWidth: 600, priority: 70 } },
    { id: 'res-night-table-01', buildingType: 'residential', furnitureCategory: 'night_table',  placement: { relation: 'beside',       marginFromWall: 0,   minPassageWidth: 500,  priority: 50 } },
    { id: 'res-rug-01',         buildingType: 'residential', furnitureCategory: 'rug',          placement: { relation: 'center',       priority: 20 } },
    { id: 'res-plant-01',       buildingType: 'residential', furnitureCategory: 'plant',        placement: { relation: 'corner',       marginFromWall: 50,  priority: 10 } },
    { id: 'res-lamp-01',        buildingType: 'residential', furnitureCategory: 'lamp',         placement: { relation: 'corner',       marginFromWall: 100, priority: 5 } },
  ],
  categoryRelations: DEFAULT_RESIDENTIAL_RELATIONS,
};

export const DEFAULT_CAFE_RULES: LayoutRuleSet = {
  buildingType: 'cafe',
  rules: [
    { id: 'cafe-table-01',   buildingType: 'cafe', furnitureCategory: 'table',     placement: { relation: 'center',       minPassageWidth: 1000, spacingBetweenItems: 1500, priority: 100 } },
    { id: 'cafe-counter-01', buildingType: 'cafe', furnitureCategory: 'counter',   placement: { relation: 'against_wall', marginFromWall: 0,     minPassageWidth: 1200, priority: 90 } },
    { id: 'cafe-shelf-01',   buildingType: 'cafe', furnitureCategory: 'shelf',     placement: { relation: 'against_wall', marginFromWall: 0,     minPassageWidth: 800,  priority: 70 } },
    { id: 'cafe-chair-01',   buildingType: 'cafe', furnitureCategory: 'chair',     placement: { relation: 'around',       minPassageWidth: 800,  priority: 80 } },
    { id: 'cafe-barseat-01', buildingType: 'cafe', furnitureCategory: 'bar_stool', placement: { relation: 'in_front',     marginFromWall: 350,   minPassageWidth: 700,  priority: 75 } },
    { id: 'cafe-sofa-01',    buildingType: 'cafe', furnitureCategory: 'sofa',      placement: { relation: 'against_wall', marginFromWall: 200,   minPassageWidth: 800,  priority: 60 } },
    { id: 'cafe-plant-01',   buildingType: 'cafe', furnitureCategory: 'plant',     placement: { relation: 'corner',       marginFromWall: 50,    priority: 10 } },
    { id: 'cafe-partition-01', buildingType: 'cafe', furnitureCategory: 'partition', placement: { relation: 'center',     minPassageWidth: 600,  priority: 30 } },
  ],
  categoryRelations: DEFAULT_CAFE_RELATIONS,
};

export const DEFAULT_OFFICE_RULES: LayoutRuleSet = {
  buildingType: 'office',
  rules: [
    { id: 'off-desk-01',     buildingType: 'office', furnitureCategory: 'desk',      placement: { relation: 'against_wall', minPassageWidth: 1200, spacingBetweenItems: 1600, priority: 100 } },
    { id: 'off-meeting-01',  buildingType: 'office', furnitureCategory: 'table',     placement: { relation: 'center',       minPassageWidth: 1200, spacingBetweenItems: 2000, priority: 90 } },
    { id: 'off-cabinet-01',  buildingType: 'office', furnitureCategory: 'cabinet',   placement: { relation: 'against_wall', marginFromWall: 50,    minPassageWidth: 1000, priority: 70 } },
    { id: 'off-shelf-01',    buildingType: 'office', furnitureCategory: 'shelf',     placement: { relation: 'against_wall', marginFromWall: 0,     minPassageWidth: 900,  priority: 65 } },
    { id: 'off-chair-01',    buildingType: 'office', furnitureCategory: 'chair',     placement: { relation: 'around',       minPassageWidth: 900,  priority: 80 } },
    { id: 'off-partition-01',buildingType: 'office', furnitureCategory: 'partition', placement: { relation: 'center',       minPassageWidth: 800,  priority: 50 } },
    { id: 'off-sofa-01',     buildingType: 'office', furnitureCategory: 'sofa',      placement: { relation: 'against_wall', marginFromWall: 200,   minPassageWidth: 900,  priority: 40 } },
    { id: 'off-plant-01',    buildingType: 'office', furnitureCategory: 'plant',     placement: { relation: 'corner',       marginFromWall: 50,    priority: 10 } },
  ],
  categoryRelations: DEFAULT_OFFICE_RELATIONS,
};

export const DEFAULT_HOTEL_RULES: LayoutRuleSet = {
  buildingType: 'hotel',
  rules: [
    { id: 'hotel-bed-01',    buildingType: 'hotel', furnitureCategory: 'bed',         placement: { relation: 'against_wall', marginFromWall: 100, minPassageWidth: 800,  priority: 100 } },
    { id: 'hotel-desk-01',   buildingType: 'hotel', furnitureCategory: 'desk',        placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 700,  priority: 80 } },
    { id: 'hotel-sofa-01',   buildingType: 'hotel', furnitureCategory: 'sofa',        placement: { relation: 'against_wall', marginFromWall: 200, minPassageWidth: 800,  priority: 70 } },
    { id: 'hotel-night-01',  buildingType: 'hotel', furnitureCategory: 'night_table', placement: { relation: 'beside',       marginFromWall: 0,   minPassageWidth: 500,  priority: 60 } },
    { id: 'hotel-cabinet-01',buildingType: 'hotel', furnitureCategory: 'cabinet',     placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 700,  priority: 50 } },
    { id: 'hotel-chair-01',  buildingType: 'hotel', furnitureCategory: 'chair',       placement: { relation: 'around',       minPassageWidth: 700, priority: 55 } },
    { id: 'hotel-plant-01',  buildingType: 'hotel', furnitureCategory: 'plant',       placement: { relation: 'corner',       marginFromWall: 50,  priority: 10 } },
  ],
  categoryRelations: DEFAULT_HOTEL_RELATIONS,
};

// ─── ゾーン特化ルールセット ──────────────────────────────────────────────────

const BEDROOM_RULES: LayoutRuleSet = {
  ...DEFAULT_RESIDENTIAL_RULES,
  rules: [
    { id: 'res-bed-br',        buildingType: 'residential', furnitureCategory: 'bed',         placement: { relation: 'against_wall', marginFromWall: 100, minPassageWidth: 800, priority: 100 } },
    { id: 'res-night-br',      buildingType: 'residential', furnitureCategory: 'night_table', placement: { relation: 'beside',       marginFromWall: 0,   minPassageWidth: 500, priority: 80 } },
    { id: 'res-desk-br',       buildingType: 'residential', furnitureCategory: 'desk',        placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 700, priority: 70 } },
    { id: 'res-wardrobe-br',   buildingType: 'residential', furnitureCategory: 'cabinet',     placement: { relation: 'against_wall', marginFromWall: 0,   minPassageWidth: 700, priority: 60 } },
    { id: 'res-chair-br',      buildingType: 'residential', furnitureCategory: 'chair',       placement: { relation: 'around',       minPassageWidth: 600, priority: 50 } },
    { id: 'res-plant-br',      buildingType: 'residential', furnitureCategory: 'plant',       placement: { relation: 'corner',       marginFromWall: 50,  priority: 10 } },
  ],
  categoryRelations: DEFAULT_BEDROOM_RELATIONS,
};

// ─── 全ルールマップ ──────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT_RULES: Record<string, LayoutRuleSet | null> = {
  residential:          DEFAULT_RESIDENTIAL_RULES,
  'residential:living': DEFAULT_RESIDENTIAL_RULES,
  'residential:bedroom': BEDROOM_RULES,
  'residential:study':  {
    ...DEFAULT_RESIDENTIAL_RULES,
    rules: [
      { id: 'res-desk-st', buildingType: 'residential', furnitureCategory: 'desk',    placement: { relation: 'against_wall', marginFromWall: 50,  minPassageWidth: 800, priority: 100 } },
      { id: 'res-shelf-st',buildingType: 'residential', furnitureCategory: 'shelf',   placement: { relation: 'against_wall', marginFromWall: 0,   minPassageWidth: 600, priority: 80 } },
      { id: 'res-chair-st',buildingType: 'residential', furnitureCategory: 'chair',   placement: { relation: 'in_front',     minPassageWidth: 600, priority: 70 } },
      { id: 'res-plant-st',buildingType: 'residential', furnitureCategory: 'plant',   placement: { relation: 'corner',       marginFromWall: 50,  priority: 10 } },
    ],
  },
  office:           DEFAULT_OFFICE_RULES,
  'office:meeting': {
    ...DEFAULT_OFFICE_RULES,
    rules: [
      { id: 'off-meeting-m', buildingType: 'office', furnitureCategory: 'table',   placement: { relation: 'center',       minPassageWidth: 1000, spacingBetweenItems: 2000, priority: 100 } },
      { id: 'off-chair-m',   buildingType: 'office', furnitureCategory: 'chair',   placement: { relation: 'around',       minPassageWidth: 900,  priority: 90 } },
      { id: 'off-plant-m',   buildingType: 'office', furnitureCategory: 'plant',   placement: { relation: 'corner',       marginFromWall: 50,   priority: 10 } },
    ],
  },
  'office:desk':    DEFAULT_OFFICE_RULES,
  cafe:             DEFAULT_CAFE_RULES,
  'cafe:seating':   DEFAULT_CAFE_RULES,
  'cafe:bar': {
    ...DEFAULT_CAFE_RULES,
    rules: [
      { id: 'cafe-bar-counter', buildingType: 'cafe', furnitureCategory: 'counter',   placement: { relation: 'against_wall', marginFromWall: 0,   minPassageWidth: 1200, priority: 100 } },
      { id: 'cafe-bar-stool',   buildingType: 'cafe', furnitureCategory: 'bar_stool', placement: { relation: 'in_front',     marginFromWall: 350, minPassageWidth: 700,  priority: 90 } },
      { id: 'cafe-bartable',    buildingType: 'cafe', furnitureCategory: 'table',     placement: { relation: 'center',       minPassageWidth: 900, spacingBetweenItems: 1200, priority: 70 } },
      { id: 'cafe-bar-plant',   buildingType: 'cafe', furnitureCategory: 'plant',     placement: { relation: 'corner',       marginFromWall: 50,  priority: 10 } },
    ],
    categoryRelations: [
      { id: 'rel-bar-counter-stool', anchorCategory: 'counter', companionCategory: 'bar_stool', relation: 'in_front', distanceMm: 350, count: 4, isActive: true },
    ],
  },
  hotel:    DEFAULT_HOTEL_RULES,
  custom:   null,
};
