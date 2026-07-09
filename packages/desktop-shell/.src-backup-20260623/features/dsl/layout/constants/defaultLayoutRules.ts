import type { BuildingType, LayoutRuleSet } from '../types/layoutRules';

export const DEFAULT_RESIDENTIAL_RULES: LayoutRuleSet = {
  buildingType: 'residential',
  rules: [
    {
      id: 'res-sofa-01',
      buildingType: 'residential',
      furnitureCategory: 'sofa',
      placement: { relation: 'against_wall', marginFromWall: 200, minPassageWidth: 800, priority: 100 }
    },
    {
      id: 'res-table-01',
      buildingType: 'residential',
      furnitureCategory: 'table',
      placement: { relation: 'center', minPassageWidth: 800, spacingBetweenItems: 1000, priority: 80 }
    },
    {
      id: 'res-bed-01',
      buildingType: 'residential',
      furnitureCategory: 'bed',
      placement: { relation: 'corner', marginFromWall: 100, minPassageWidth: 600, priority: 90 }
    },
    {
      id: 'res-chair-01',
      buildingType: 'residential',
      furnitureCategory: 'chair',
      placement: { relation: 'around', minPassageWidth: 600, priority: 70 }
    },
    {
      id: 'res-plant-01',
      buildingType: 'residential',
      furnitureCategory: 'plant',
      placement: { relation: 'corner', marginFromWall: 50, priority: 10 }
    }
  ]
};

export const DEFAULT_CAFE_RULES: LayoutRuleSet = {
  buildingType: 'cafe',
  rules: [
    {
      id: 'cafe-table-01',
      buildingType: 'cafe',
      furnitureCategory: 'table',
      placement: { relation: 'center', minPassageWidth: 1000, spacingBetweenItems: 1500, priority: 100 }
    },
    {
      id: 'cafe-chair-01',
      buildingType: 'cafe',
      furnitureCategory: 'chair',
      placement: { relation: 'around', minPassageWidth: 800, priority: 90 }
    },
    {
      id: 'cafe-counter-01',
      buildingType: 'cafe',
      furnitureCategory: 'counter',
      placement: { relation: 'against_wall', marginFromWall: 0, minPassageWidth: 1200, priority: 80 }
    },
    {
      id: 'cafe-plant-01',
      buildingType: 'cafe',
      furnitureCategory: 'plant',
      placement: { relation: 'corner', marginFromWall: 50, priority: 10 }
    }
  ]
};

export const DEFAULT_OFFICE_RULES: LayoutRuleSet = {
  buildingType: 'office',
  rules: [
    {
      id: 'off-desk-01',
      buildingType: 'office',
      furnitureCategory: 'desk',
      placement: { relation: 'center', minPassageWidth: 1200, spacingBetweenItems: 1600, priority: 100 }
    },
    {
      id: 'off-chair-01',
      buildingType: 'office',
      furnitureCategory: 'chair',
      placement: { relation: 'around', minPassageWidth: 900, priority: 90 }
    },
    {
      id: 'off-cabinet-01',
      buildingType: 'office',
      furnitureCategory: 'cabinet',
      placement: { relation: 'against_wall', marginFromWall: 50, minPassageWidth: 1000, priority: 80 }
    },
    {
      id: 'off-plant-01',
      buildingType: 'office',
      furnitureCategory: 'plant',
      placement: { relation: 'corner', marginFromWall: 50, priority: 10 }
    }
  ]
};

export const DEFAULT_LAYOUT_RULES: Record<string, LayoutRuleSet | null> = {
  residential: DEFAULT_RESIDENTIAL_RULES,
  'residential:living': DEFAULT_RESIDENTIAL_RULES,
  'residential:bedroom': {
    ...DEFAULT_RESIDENTIAL_RULES,
    rules: [
      {
        id: 'res-bed-02',
        buildingType: 'residential',
        furnitureCategory: 'bed',
        placement: { relation: 'against_wall', marginFromWall: 100, minPassageWidth: 800, priority: 100 }
      },
      ...DEFAULT_RESIDENTIAL_RULES.rules.filter(r => r.furnitureCategory !== 'bed')
    ]
  },
  office: DEFAULT_OFFICE_RULES,
  'office:meeting': {
    ...DEFAULT_OFFICE_RULES,
    rules: [
      {
        id: 'off-meeting-01',
        buildingType: 'office',
        furnitureCategory: 'table',
        placement: { relation: 'center', minPassageWidth: 1000, spacingBetweenItems: 2000, priority: 100 }
      },
      ...DEFAULT_OFFICE_RULES.rules.filter(r => r.furnitureCategory !== 'table')
    ]
  },
  'office:desk': DEFAULT_OFFICE_RULES,
  cafe: DEFAULT_CAFE_RULES,
  'cafe:seating': DEFAULT_CAFE_RULES,
  hotel: null,
  custom: null
};
