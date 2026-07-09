import type { PlacementRelation } from './layoutRules';

/**
 * 自動レイアウト パイプラインの中間表現「スロット」。
 *
 * 設計の核: ①家具選定 と ②家具配置 を疎結合にするため、両者が共有する契約を
 * 「具体的な家具(製品)」ではなく「役割 + 寸法エンベロープ + スタイル + 配置関係」とする。
 *
 *   ① generateSlots → FurnitureSlot[]   （製品未確定。役割と寸法レンジのみ）
 *   ② placeSlots    → PlacedSlot[]      （transform 確定。製品は依然未確定）
 *      resolveProducts(PlacedSlot[], candidates, style) → PlacementItem[]
 *   ③ 差し替え       resolveProducts(既存slot, 別candidates, 別style)（②をスキップ）
 *
 * Phase 0 では型のみ定義し、生成/配置の実体は後続フェーズで実装する。
 */
export interface FurnitureSlot {
  /** スロット一意ID（配置→解決→差し替えを通して安定） */
  slotId: string;
  /** アセット非依存の役割。例: 'sofa' | 'dining_table' | 'chair' | 'tv_board' */
  role: string;
  /** 配置ソルバが使う寸法レンジ(mm)。製品解決はこの範囲内の家具を選ぶ。 */
  envelopeMm: { wMin: number; wMax: number; dMin: number; dMax: number };
  /** 配置・製品解決の双方が参照するスタイルタグ。例: ['modern', 'wood'] */
  styleTags: string[];
  /** 既存の配置関係語彙を流用 */
  relation: PlacementRelation;
  /** このスロットに置く個数 */
  count: number;
  /** around 等の関係配置の親スロット/役割（任意） */
  anchorRef?: string;
}

/** 3D変換（既存 PlacementItem.transform と同形） */
export interface SlotTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

/** ②配置後のスロット。位置は確定済み、製品は未解決。 */
export type PlacedSlot = FurnitureSlot & {
  zoneId: string;
  transform: SlotTransform;
};

/** スロット選定/配置のスコープ階層（住宅→部屋→ゾーン）。後続フェーズで使用。 */
export type SlotScopeLevel = 'house' | 'room' | 'zone';
