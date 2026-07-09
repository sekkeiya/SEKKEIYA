import type { BuildingType } from './layoutRules';

/** セットとゾーンの配置関係 */
export type SetPlacementRelation =
  | 'against_wall'   // 背面を壁に付ける
  | 'center'         // ゾーン中央
  | 'corner'         // コーナー
  | 'face_window'    // 窓向き
  | 'free';          // 制約なし（エンジン任せ）

/** Auto Layout 配置時の回転自由度 */
export type SetRotationPolicy =
  | 'fixed'    // セットの向きを変えない
  | 'step90'   // 90°刻みで回転可
  | 'free';    // 自由回転可

/**
 * セット配置ルール — セット全体がゾーン内でどう置かれるべきかを定義する。
 * セット内の家具同士の関係は placedItems の実座標が暗黙に表現するため、ここでは持たない。
 */
export interface SetPlacementRule {
  /** ゾーンとの配置関係 */
  relation: SetPlacementRelation;
  /**
   * セット正面方向（セットローカル・エディターTOPビュー基準）
   * 0=下(+手前) / 90=右 / 180=上(奥) / 270=左。方向ベクトル=(sinθ, -cosθ)
   */
  frontDirectionDeg: number;
  /** 背面と壁の間隔 (mm) — against_wall / corner 時に使用 */
  marginFromWallMm: number;
  /** 正面に確保する動線・使用空間 (mm) */
  frontClearanceMm: number;
  /** 配置時の回転自由度 */
  rotationPolicy: SetRotationPolicy;
  /** 同一ゾーンに複数配置可（カフェのテーブルセット等） */
  repeatable: boolean;
  /** repeatable 時の最大配置数（未設定=空き次第） */
  maxCount?: number;
}

export const DEFAULT_SET_PLACEMENT_RULE: SetPlacementRule = {
  relation: 'free',
  frontDirectionDeg: 0,
  marginFromWallMm: 50,
  frontClearanceMm: 600,
  rotationPolicy: 'step90',
  repeatable: false,
};

export interface FurnitureSetItem {
  id: string;
  categoryKey: string;
  entityId?: string;
  title: string;
  thumbnailUrl?: string;
  glbUrl?: string;
  transform: {
    x: number;        // meters (XZ floor plane)
    z: number;
    rotationDeg: number;  // Y-axis rotation degrees
  };
}

export interface FurnitureSet {
  id: string;
  name: string;
  buildingType?: BuildingType;
  zonePurposes?: string[];
  minAreaSqm?: number;
  maxAreaSqm?: number;
  priority?: number;
  styleTags?: string[];
  isOfficial?: boolean;
  adoptionCount?: number;
  rejectionCount?: number;
  visibility?: 'public' | 'private';
  /** Auto Layout 用のセット配置ルール */
  placementRule?: SetPlacementRule;
  items: FurnitureSetItem[];
  thumbnailUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}
