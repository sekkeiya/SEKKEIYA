export type BuildingType = 'residential' | 'cafe' | 'office' | 'hotel' | 'custom';
export type PlacementRelation = 'against_wall' | 'center' | 'corner' | 'face_to' | 'around' | 'beside' | 'face_window';

export type ZonePurpose =
  | 'living'    // リビング
  | 'bedroom'   // 寝室
  | 'dining'    // ダイニング
  | 'study'     // 書斎
  | 'seating'   // 客席（カフェ）
  | 'meeting'   // 会議室（オフィス）
  | 'desk'      // 執務エリア（オフィス）
  | 'general';  // 汎用

export interface FurniturePlacementRule {
  id: string;
  buildingType: BuildingType;
  furnitureCategory: string; // e.g., 'sofa', 'table', 'desk', 'plant', 'chair'
  placement: {
    relation: PlacementRelation;
    marginFromWall?: number; // mm
    minPassageWidth?: number; // mm
    spacingBetweenItems?: number; // mm
    priority: number; // Higher number = placed first
  };
}

/** カテゴリ間の関係ルール: アンカー家具 → コンパニオン家具 の配置関係 */
export type CategoryRelationType = 'in_front' | 'beside' | 'around' | 'below';

export interface FurnitureCategoryRelation {
  id: string;
  anchorCategory: string;     // 基準家具カテゴリ (例: 'sofa')
  companionCategory: string;  // 従属家具カテゴリ (例: 'coffee_table')
  relation: CategoryRelationType;
  distanceMm: number;         // アンカーからの距離 (mm)
  count?: number;             // コンパニオン数 (既定1)
  buildingType?: BuildingType;
  isActive: boolean;
}

export interface LayoutRuleSet {
  buildingType: BuildingType;
  rules: FurniturePlacementRule[];
  categoryRelations?: FurnitureCategoryRelation[]; // カテゴリ間関係ルール
  // バージョン管理・カスタム上書き用のフィールド
  currentVersion?: string; // SEKKEIYAデフォルトの現在のバージョンID
  versionId?: string;      // このデータのバージョンID
  label?: string;          // v1, v2などの表示ラベル
  baseVersion?: string;    // カスタムルールの元になったSEKKEIYAのバージョン
  createdAt?: any;         // Timestamp
  updatedAt?: any;         // Timestamp
  createdBy?: string;      // 作成者のUIDなど
}

export interface LayoutRuleSetVersion {
  versionId: string;
  label: string;
  createdAt: any;
  createdBy: string;
  rules: LayoutRuleSet;
}
