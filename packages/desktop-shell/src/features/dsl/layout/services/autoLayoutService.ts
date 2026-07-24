import { httpsCallable } from "firebase/functions";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "../../../../lib/firebase/client";
import { resolveProduct, resolveGlbUrlDeep } from "./productResolution";

export interface ZonePolygonPoint {
  x: number;
  z: number;
}

export interface ZoneData {
  zoneId: string;
  polygon: ZonePolygonPoint[];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  buildingType?: string;
  /** ゾーンのカテゴリ（部屋）から導出した Auto Layout 用途。セットマッチングに使用 */
  purpose?: string;
  circulations?: {
    id: string;
    type: 'main' | 'sub';
    width: number;
    points: { x: number; z: number }[];
  }[];
}

import type { BuildingType, LayoutRuleSet, FurniturePlacementRule, PlacementRelation } from '../types/layoutRules';
import type { FurnitureSlot, PlacedSlot } from '../types/furnitureSlot';
import type { SetPlacementRule } from '../types/furnitureSet';
import { DEFAULT_SET_PLACEMENT_RULE } from '../types/furnitureSet';
import { getRoomCategoryMeta, resolveCategoryKey } from '../constants/roomCategories';
import { useLayoutTaskStore } from '../store/useLayoutTaskStore';
import { getLayoutCategoryLabel, getCategoryMeta } from '../constants/furnitureCategoryDefaults';
import { layoutRulesApi } from './layoutRulesApi';
import { useFurnitureSelectionStore } from '../store/useFurnitureSelectionStore';
import type { ZoneSelection } from './furnitureSelectionService';

export interface RecommendationResult {
  assetId: string;
  quantity: number;
}

export interface LayoutRule {
  targetId: string;
  position: string;
  relation?: string;
  count: number;
  facing?: string;
}

export interface PlacementItem {
  id: string;
  zoneId?: string;
  entityId: string;
  itemRef: string;
  glbUrl?: string | null;
  dimensionsMm?: { width: number; depth: number; height: number };
  name?: string | null;
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  snapshot: {
    title: string;
    brand?: string;
    thumbnailUrl: string | null;
    glbUrl?: string; // Add glbUrl
  };
}

const MOCK_SETS = [
  { entityId: 'set_4desk_01',    title: '4 Desk Set',      itemRef: 'models/set_4desk_01' },
  { entityId: 'set_lounge_01',   title: 'Lounge Set',      itemRef: 'models/set_lounge_01' },
  { entityId: 'set_collab_01',   title: 'Collab Booth',    itemRef: 'models/set_collab_01' },
  { entityId: 'set_meeting_01',  title: 'Meeting Table 6', itemRef: 'models/set_meeting_01' },
];

/**
 * 対象ゾーンの幾何データ（2D境界ポリゴン）を抽出する。
 * zone.rect が存在する場合はそれを優先使用（AI学習に最も正確な情報）。
 * rect がない場合は items の位置から境界を計算する（後方互換）。
 */
export function extractZoneData(zoneId: string, items: any[], zones: any[] = []): ZoneData {
  // rect ベースのゾーン定義を優先。
  const zone = zones.find((z) => z.id === zoneId);
  // ゾーンが無ければ「部屋（Room.rect）」として扱う＝ゾーンレスの部屋の自動レイアウト。
  const roomAsZone = zone ? null : (useLayoutTaskStore.getState().rooms || []).find((r: any) => r.id === zoneId);
  const rect = zone?.rect || roomAsZone?.rect;
  let minX: number, minZ: number, maxX: number, maxZ: number;

  if (rect) {
    const r = rect;
    minX = r.x - r.width / 2;
    maxX = r.x + r.width / 2;
    minZ = r.z - r.depth / 2;
    maxZ = r.z + r.depth / 2;
  } else {
    // フォールバック: items 位置からバウンディングボックスを計算
    const zoneItems = items.filter((it) => it?.zoneId === zoneId);
    if (zoneItems.length > 0) {
      minX = Infinity; minZ = Infinity; maxX = -Infinity; maxZ = -Infinity;
      for (const it of zoneItems) {
        const px = it?.transform?.position?.[0] ?? 0;
        const pz = it?.transform?.position?.[2] ?? 0;
        minX = Math.min(minX, px);
        minZ = Math.min(minZ, pz);
        maxX = Math.max(maxX, px);
        maxZ = Math.max(maxZ, pz);
      }
      const pad = 2000; // mm
      minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    } else {
      minX = -5000; minZ = -5000; maxX = 5000; maxZ = 5000; // mm
    }
  }

  const polygon: ZonePolygonPoint[] = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];

  // カテゴリ（用途）→ Auto Layout 用途を導出。
  // 「用途は部屋（室）が持つ」モデル: ゾーンが機能サブカテゴリを持てばそれを、
  // 無ければ所属する部屋（室）の用途を使う（zone.category ?? room.category）。
  // 用途は「ゾーンの機能サブ ?? 所属部屋の用途」。ゾーンレス部屋なら部屋自身の用途。
  const roomOfZone = roomAsZone
    ? roomAsZone
    : (zone?.roomId ? (useLayoutTaskStore.getState().rooms || []).find((r) => r.id === zone.roomId) : null);
  const categoryKey = resolveCategoryKey(zone, roomOfZone);
  const catMeta = getRoomCategoryMeta(categoryKey, zone?.buildingType);

  const result: ZoneData = {
    zoneId,
    polygon,
    bounds: { minX, minZ, maxX, maxZ },
    buildingType: zone?.buildingType,
    purpose: zone?.purpose ?? catMeta?.purpose ?? undefined,
    circulations: zone?.circulations || [],
  };
  console.group('[AutoLayout] extractZoneData');
  console.dir(result);
  console.groupEnd();

  return result;
}

import { useAiProfileStore } from "../../../../store/useAiProfileStore";
import { useAutoLayoutStore } from "../store/useAutoLayoutStore";

/**
 * Firebase Functions wrappers
 */
async function fetchRecommendation(zonePurpose: string, areaSqm: number, targetSeats: number, availableAssets: any[]): Promise<RecommendationResult[]> {
  try {
    const profile = useAiProfileStore.getState().aiProfiles.find(p => p.id === 'ai-3dss-recommender:gemini');
    const model = profile?.baseModelId || 'gemini-2.5-flash';

    const fn = httpsCallable(functions, "recommendFurniture");
    const result = await fn({ zonePurpose, areaSqm, targetSeats, availableAssets, model });
    return (result.data as any).recommendations;
  } catch (error) {
    console.error("fetchRecommendation failed:", error);
    return [];
  }
}

async function fetchLayout(zoneDimensions: { width: number; depth: number }, selectedAssets: RecommendationResult[], obstacles: any[]): Promise<LayoutRule[]> {
  try {
    const profile = useAiProfileStore.getState().aiProfiles.find(p => p.id === 'ai-layout-coordinator:gemini');
    const model = profile?.baseModelId || 'gemini-2.5-flash';

    const fn = httpsCallable(functions, "fetchLayout");
    const result = await fn({ zoneDimensions, selectedAssets, obstacles, model });
    return (result.data as any).layoutRules;
  } catch (error) {
    console.error("fetchLayout failed:", error);
    return [];
  }
}

interface PlacedBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** カテゴリ名から典型寸法(mm)を推定する。dimensions が未設定の場合のフォールバック用 */
function estimateDimensionsByCategory(category: string, title: string): { w: number; d: number } {
  const s = `${category} ${title}`.toLowerCase();
  if (s.includes('sofa') || s.includes('ソファ')) {
    if (s.includes('3') || s.includes('三')) return { w: 2200, d: 900 };
    if (s.includes('2') || s.includes('二')) return { w: 1600, d: 900 };
    return { w: 1200, d: 900 };
  }
  if (s.includes('bed') || s.includes('ベッド')) {
    if (s.includes('king') || s.includes('キング')) return { w: 1800, d: 2100 };
    if (s.includes('queen') || s.includes('クイーン')) return { w: 1600, d: 2100 };
    if (s.includes('double') || s.includes('ダブル')) return { w: 1400, d: 2100 };
    if (s.includes('semi')) return { w: 1200, d: 2100 };
    return { w: 1000, d: 2100 };
  }
  if (s.includes('dining') && s.includes('table') || s.includes('ダイニングテーブル')) return { w: 1500, d: 900 };
  if (s.includes('coffee') || s.includes('コーヒー') || s.includes('low') || s.includes('ロー')) return { w: 1100, d: 600 };
  if (s.includes('desk') || s.includes('デスク')) return { w: 1200, d: 650 };
  if (s.includes('meeting') || s.includes('会議')) return { w: 2400, d: 1000 };
  if (s.includes('table') || s.includes('テーブル')) return { w: 1000, d: 700 };
  if (s.includes('chair') || s.includes('チェア') || s.includes('stool') || s.includes('スツール')) return { w: 480, d: 520 };
  if (s.includes('cabinet') || s.includes('キャビネット') || s.includes('wardrobe')) return { w: 900, d: 500 };
  if (s.includes('shelf') || s.includes('本棚') || s.includes('シェルフ')) return { w: 900, d: 300 };
  if (s.includes('tv') || s.includes('テレビ')) return { w: 1800, d: 450 };
  if (s.includes('plant') || s.includes('植') || s.includes('グリーン')) return { w: 500, d: 500 };
  if (s.includes('rug') || s.includes('ラグ') || s.includes('carpet')) return { w: 2000, d: 1500 };
  return { w: 700, d: 700 }; // generic fallback
}

/** rule.position / relation の生文字列を FurnitureSlot.relation(PlacementRelation) に正規化 */
function normalizeRelation(raw: string | undefined | null): PlacementRelation {
  const s = (raw || '').toLowerCase();
  if (s.includes('wall')) return 'against_wall';
  if (s.includes('corner')) return 'corner';
  if (s.includes('face_window') || s.includes('window')) return 'face_window';
  if (s.includes('around')) return 'around';
  if (s.includes('beside')) return 'beside';
  if (s.includes('face_to') || s.includes('face')) return 'face_to';
  return 'center';
}

/**
 * 配置エンジンへの入力仕様: スロット + Phase1 で確定した配置パラメータ。
 * placeSlots は製品(アセット)に一切触れず、slot.envelopeMm と rule/physicalRule のみで配置を解く。
 */
interface PlacementSpec {
  slot: FurnitureSlot;
  /** rule.targetId。around 親参照 & 製品束縛のキー */
  refId: string;
  /** 生の position/relation/facing/count/marginFromWall を保持（挙動互換のため原文を維持） */
  rule: LayoutRule;
  physicalRule: FurniturePlacementRule | undefined;
}

/**
 * ②配置（純幾何）: スロット仕様をゾーンに配置し PlacedSlot[] を返す。
 * 製品には触れない — 寸法は slot.envelopeMm、配置関係は rule/physicalRule から読む。
 *
 * @param obstacles 既存レイアウトのアイテム配列。AABB に追加して重なりを防ぐ。
 */
function placeSlots(
  specs: PlacementSpec[],
  zoneData: ZoneData,
  gridHeightMm: number,
  obstacles: any[],
  maxTotalItems: number,
): PlacedSlot[] {
  const { bounds, zoneId } = zoneData;
  const { minX, minZ, maxX, maxZ } = bounds;
  const widthM = Math.abs(maxX - minX);
  const depthM = Math.abs(maxZ - minZ);

  // DSL ワールド座標 = mm。ゾーン bounds も mm のため寸法・マージンは変換不要（恒等）。
  // 変数名の M サフィックスは歴史的経緯（旧メートル前提）で、現在は mm 値を保持する。
  const mmToM = (mm: number) => mm;

  const placed: PlacedSlot[] = [];
  const placedByRefId = new Map<string, PlacedSlot>();

  // ── 既存アイテムを障害物として初期化 ───────────────────────────────────────
  const placedItemsBounds: PlacedBounds[] = obstacles
    .filter(item => item?.transform?.position)
    .map(item => {
      const pos = item.transform.position;
      const cx = Array.isArray(pos) ? pos[0] : (pos.x ?? 0);
      const cz = Array.isArray(pos) ? pos[2] : (pos.z ?? 0);
      const cat = item.category || item.type || '';
      const ttl = item.title || item.name || '';
      const est = estimateDimensionsByCategory(cat, ttl);
      const wM = mmToM(item.dimensionsMm?.width ?? item.metadata?.dimensions?.width ?? est.w);
      const dM = mmToM(item.dimensionsMm?.depth ?? item.metadata?.dimensions?.depth ?? est.d);
      const pad = mmToM(200); // 既存アイテム周囲の最低パディング
      return { minX: cx - wM / 2 - pad, maxX: cx + wM / 2 + pad, minZ: cz - dM / 2 - pad, maxZ: cz + dM / 2 + pad };
    });

  let totalGenerated = 0;

  // priority 降順（physicalRule 由来）でソート
  const sorted = [...specs].sort(
    (a, b) => (b.physicalRule?.placement.priority ?? 0) - (a.physicalRule?.placement.priority ?? 0),
  );

  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;

  // ── アンカー候補生成ヘルパー ───────────────────────────────────────────────
  // 配置ルールに応じた配置候補をランダムシャッフル済みで返す。
  // 毎回異なる壁・位置が選ばれるため、ルールを維持しながら多様なレイアウトが生成される。
  function generateCandidates(
    relation: string, itemW: number, itemD: number, wallOff: number,
  ): Array<{ x: number; z: number; rotY: number }> {
    const cands: Array<{ x: number; z: number; rotY: number }> = [];
    const SLOTS = 5; // 壁ごとの候補数
    if (relation.includes('wall') || relation.includes('against_wall')) {
      for (let s = 0; s < SLOTS; s++) {
        const t = (s + Math.random()) / SLOTS;
        cands.push({ x: minX + t * widthM, z: minZ + wallOff + itemD / 2, rotY: 0 });
        cands.push({ x: minX + t * widthM, z: maxZ - wallOff - itemD / 2, rotY: 180 });
        cands.push({ x: minX + wallOff + itemW / 2, z: minZ + t * depthM, rotY: 90 });
        cands.push({ x: maxX - wallOff - itemW / 2, z: minZ + t * depthM, rotY: -90 });
      }
    } else if (relation.includes('corner')) {
      const c = wallOff + Math.max(itemW, itemD) * 0.5;
      cands.push({ x: minX + c, z: minZ + c, rotY: 0 });
      cands.push({ x: maxX - c, z: minZ + c, rotY: 90 });
      cands.push({ x: minX + c, z: maxZ - c, rotY: -90 });
      cands.push({ x: maxX - c, z: maxZ - c, rotY: 180 });
    } else if (relation.includes('face_window')) {
      for (let s = 0; s < SLOTS; s++) {
        const t = (s + Math.random()) / SLOTS;
        cands.push({ x: minX + t * widthM, z: minZ + wallOff + itemD / 2, rotY: 0 });
        cands.push({ x: minX + t * widthM, z: maxZ - wallOff - itemD / 2, rotY: 180 });
      }
    } else {
      // center/general: 4×4 格子でランダムオフセット
      const GRID = 4;
      for (let gx = 0; gx < GRID; gx++) for (let gz = 0; gz < GRID; gz++) {
        const t = 0.15 + 0.7 * (gx + Math.random()) / GRID;
        const u = 0.15 + 0.7 * (gz + Math.random()) / GRID;
        cands.push({ x: minX + t * widthM, z: minZ + u * depthM, rotY: [0, 90, -90, 180][Math.floor(Math.random() * 4)] });
      }
    }
    return cands.sort(() => Math.random() - 0.5); // シャッフル
  }

  /** AABB 衝突チェック（実寸 + マージン） */
  function isColliding(cx: number, cz: number, iW: number, iD: number, margin: number): boolean {
    const b = { minX: cx - iW / 2 - margin, maxX: cx + iW / 2 + margin, minZ: cz - iD / 2 - margin, maxZ: cz + iD / 2 + margin };
    return placedItemsBounds.some(e => b.minX < e.maxX && b.maxX > e.minX && b.minZ < e.maxZ && b.maxZ > e.minZ);
  }

  /** 境界内チェック */
  function inBounds(cx: number, cz: number, iW: number, iD: number, wall: number): boolean {
    return cx - iW / 2 >= minX + wall && cx + iW / 2 <= maxX - wall &&
           cz - iD / 2 >= minZ + wall && cz + iD / 2 <= maxZ - wall;
  }

  /**
   * 単一候補を試みる。境界内かつ非衝突なら placedItemsBounds に追加して位置を返す。
   * collMargin2pass: 第2パス(フォールバック)で使う縮小マージン
   */
  function tryPlace(
    cx: number, cz: number, rotY: number, iW: number, iD: number,
    collMargin: number, wallMargin: number,
  ): { x: number; z: number; rotY: number } | null {
    const x = Math.max(minX + wallMargin + iW / 2, Math.min(maxX - wallMargin - iW / 2, cx));
    const z = Math.max(minZ + wallMargin + iD / 2, Math.min(maxZ - wallMargin - iD / 2, cz));
    if (!inBounds(x, z, iW, iD, 0)) return null;
    if (isColliding(x, z, iW, iD, collMargin)) return null;
    // 実寸のみ記録（AABB に margin を含めない → 視覚的重なりゼロを保証）
    placedItemsBounds.push({ minX: x - iW / 2, maxX: x + iW / 2, minZ: z - iD / 2, maxZ: z + iD / 2 });
    return { x, z, rotY };
  }

  // ── First Pass: 非-around スロットの配置 ─────────────────────────────────
  for (const { slot, rule, refId, physicalRule } of sorted) {
    if (rule.relation && rule.relation.startsWith('around')) continue;
    const safeCount = Math.min(Math.max(1, parseInt(rule.count as any, 10) || 1), 10);

    const assetWM = mmToM(slot.envelopeMm.wMax);
    const assetDM = mmToM(slot.envelopeMm.dMax);

    const relation = (rule.position || physicalRule?.placement.relation || 'center').toLowerCase();
    // 壁マージン: 200mm 最小（旧 600mm は小部屋で配置領域を著しく制限していた）
    const wallMarginM = Math.max(mmToM(physicalRule?.placement?.marginFromWall ?? 0), mmToM(200));
    // 衝突マージン: 実寸同士の間に最低 300mm のギャップを確保（tryPlace では実寸のみ記録し、ここで gap を適用）
    const collMarginM = mmToM(300);

    const candidates = generateCandidates(relation, assetWM, assetDM, wallMarginM);

    for (let c = 0; c < safeCount; c++) {
      if (totalGenerated >= maxTotalItems) break;

      let pos: { x: number; z: number; rotY: number } | null = null;
      // 通常マージンで試行
      for (const cand of candidates) {
        pos = tryPlace(cand.x, cand.z, cand.rotY, assetWM, assetDM, collMarginM, wallMarginM);
        if (pos) break;
      }
      // 失敗したらマージンを緩めて再試行（狭い部屋のフォールバック）
      if (!pos) {
        for (const cand of candidates) {
          pos = tryPlace(cand.x, cand.z, cand.rotY, assetWM, assetDM, mmToM(50), mmToM(50));
          if (pos) break;
        }
      }

      if (!pos) {
        console.warn(`[AutoLayout] No room for role "${slot.role}" (${Math.round(assetWM)}×${Math.round(assetDM)}mm) – skipped`);
        continue;
      }

      const ps: PlacedSlot = {
        ...slot,
        zoneId,
        transform: {
          position: { x: pos.x, y: gridHeightMm, z: pos.z },
          rotation: { x: 0, y: pos.rotY, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      };
      placed.push(ps);
      totalGenerated++;
      placedByRefId.set(refId, ps);
    }
  }

  // ── Second Pass: around 配置（例: テーブル周りの椅子）─────────────────────
  for (const { slot, rule, physicalRule } of sorted) {
    if (!rule.relation || !rule.relation.includes('around')) continue;

    const tokens = rule.relation.split(' ');
    const parentId = tokens[1] || tokens[0];
    const parent = placedByRefId.get(parentId);

    const cx = parent ? parent.transform.position.x : midX;
    const cz = parent ? parent.transform.position.z : midZ;

    const minPassage = Math.max((rule as any).minPassageWidth || 0, physicalRule?.placement.minPassageWidth ?? 800);
    const spacing = physicalRule?.placement.spacingBetweenItems ?? 0;

    // 半径を計算 (800mm の引き出しスペース考慮)
    const radiusM = mmToM(Math.max(800, minPassage + (spacing / 2)));
    const safeCount = Math.min(Math.max(1, parseInt(rule.count as any, 10) || 1), 10);

    for (let c = 0; c < safeCount; c++) {
      if (totalGenerated >= maxTotalItems) break;

      const angle = (Math.PI * 2 * c) / safeCount;
      const x = cx + radiusM * Math.cos(angle);
      const z = cz + radiusM * Math.sin(angle);

      const relMarginM = mmToM(Math.max((rule as any).marginFromWall || 0, physicalRule?.placement.marginFromWall ?? 200));
      const assetWM = mmToM(slot.envelopeMm.wMax);
      const assetDM = mmToM(slot.envelopeMm.dMax);
      const collisionMarginM = mmToM(300);

      let validPosition = false;
      let finalX = x;
      let finalZ = z;

      for (let attempt = 0; attempt < 20; attempt++) {
        const jx = (Math.random() - 0.5) * radiusM * 0.6;
        const jz = (Math.random() - 0.5) * radiusM * 0.6;
        const testX = Math.max(minX + relMarginM + assetWM / 2, Math.min(maxX - relMarginM - assetWM / 2, x + jx));
        const testZ = Math.max(minZ + relMarginM + assetDM / 2, Math.min(maxZ - relMarginM - assetDM / 2, z + jz));

        const noOverlap = !placedItemsBounds.some(b =>
          (testX - assetWM / 2 - collisionMarginM) < b.maxX &&
          (testX + assetWM / 2 + collisionMarginM) > b.minX &&
          (testZ - assetDM / 2 - collisionMarginM) < b.maxZ &&
          (testZ + assetDM / 2 + collisionMarginM) > b.minZ
        );

        if (noOverlap) {
          finalX = testX;
          finalZ = testZ;
          validPosition = true;
          break;
        }
      }

      if (!validPosition) continue;

      // 実寸のみ記録
      placedItemsBounds.push({ minX: finalX - assetWM / 2, maxX: finalX + assetWM / 2, minZ: finalZ - assetDM / 2, maxZ: finalZ + assetDM / 2 });

      let rotationY = -angle * (180 / Math.PI) - 90;
      if (rule.facing === 'outward') {
        rotationY += 180;
      }

      placed.push({
        ...slot,
        zoneId,
        transform: {
          position: { x: finalX, y: gridHeightMm, z: finalZ },
          rotation: { x: 0, y: rotationY, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
      });
      totalGenerated++;
    }
  }

  return placed;
}

/**
 * 製品解決(③でも再利用): 配置済みスロットにアセットを束縛し PlacementItem[] を生成する。
 *
 * Phase1 では pickAsset が選定済みアセットを返す。③自動家具差し替えでは、配置(transform)を
 * 固定したまま別 candidate/style で pickAsset を差し替えて再実行することで家具のみ入れ替える。
 */
export function resolveProducts(
  placedSlots: PlacedSlot[],
  pickAsset: (slot: PlacedSlot) => any | null,
): PlacementItem[] {
  return placedSlots.map((slot, idx) => {
    const asset = pickAsset(slot);
    const { entityId, itemRef, title, brand, thumbnailUrl, glbUrl } = resolveProduct(asset);
    return {
      id: `placement_${Date.now()}_${idx}`,
      zoneId: slot.zoneId,
      entityId,
      itemRef,
      transform: slot.transform,
      snapshot: { title, brand, thumbnailUrl, glbUrl },
      glbUrl: resolveGlbUrlDeep(asset),
      name: asset?.name ?? asset?.title ?? null,
    };
  });
}

/**
 * Heuristic geometry calculation converting semantic AI rules to X/Z coordinates.
 *
 * パイプライン: ①選定(ルール×アセット→スロット) → ②placeSlots(幾何) → resolveProducts(製品解決)。
 *
 * @param obstacles 既存レイアウトのアイテム配列。AABB に追加して重なりを防ぐ。
 */
function calculatePositions(
  rules: LayoutRule[],
  zoneData: ZoneData,
  availableAssets: any[],
  gridHeightMm: number,
  ruleSet: LayoutRuleSet | null,
  obstacles: any[] = [],
): PlacementItem[] {
  const { zoneId } = zoneData;
  const maxTotalItems = Math.min(availableAssets.length * 5, 30, 50);

  // ── ①選定: ルール×アセット → スロット仕様。slotId→asset で製品を束縛しておく ──
  const shuffledAssets = [...availableAssets].sort(() => Math.random() - 0.5);
  const assetBySlotId = new Map<string, any>();
  const specs: PlacementSpec[] = [];
  let slotSeq = 0;

  for (const rule of rules) {
    const asset = shuffledAssets.find(a => {
      const eid = a.metadata?.sourceModelId || a.entityId || a.id;
      return eid === rule.targetId;
    });
    if (!asset) continue;

    const category = (asset?.category || asset?.title || '').toLowerCase();
    let physicalRule = ruleSet?.rules.find(r => category.includes(r.furnitureCategory.toLowerCase()));
    if (!physicalRule) {
      if (category.includes('sofa') || category.includes('ソファ')) physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'sofa');
      else if (category.includes('chair') || category.includes('チェア')) physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'chair');
      else if (category.includes('table') || category.includes('テーブル')) physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'table');
      else if (category.includes('desk') || category.includes('デスク')) physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'desk');
      else if (category.includes('bed') || category.includes('ベッド')) physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'bed');
    }

    const est = estimateDimensionsByCategory(category, asset?.title || '');
    const w = asset?.extendedMetadata?.dimensions?.width || asset?.metadata?.dimensions?.width || est.w;
    const d = asset?.extendedMetadata?.dimensions?.depth || asset?.metadata?.dimensions?.depth || est.d;

    const isAround = !!(rule.relation && rule.relation.includes('around'));
    const aroundParent = isAround
      ? (rule.relation!.split(' ')[1] || rule.relation!.split(' ')[0])
      : undefined;

    const slotId = `slot_${zoneId}_${slotSeq++}`;
    const slot: FurnitureSlot = {
      slotId,
      role: category,
      envelopeMm: { wMin: w, wMax: w, dMin: d, dMax: d },
      styleTags: [],
      relation: normalizeRelation(rule.position || physicalRule?.placement.relation),
      count: Math.min(Math.max(1, parseInt(rule.count as any, 10) || 1), 10),
      anchorRef: aroundParent,
    };

    assetBySlotId.set(slotId, asset);
    specs.push({ slot, refId: rule.targetId, rule, physicalRule });
  }

  // ── ②配置（純幾何）→ 製品解決 ───────────────────────────────────────────
  const placedSlots = placeSlots(specs, zoneData, gridHeightMm, obstacles, maxTotalItems);
  return resolveProducts(placedSlots, (s) => assetBySlotId.get(s.slotId) ?? null);
}

/**
 * Main Orchestration API. Uses Gemini to Recommend & Layout, then computes geometry.
 */
export interface AutoLayoutContext {
  userId: string;
  projectId: string;
  mode?: 'rules-only' | 'ai';
  setProgressMessage?: (msg: string | null) => void;
  buildingType?: BuildingType;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      res => { clearTimeout(timer); resolve(res); },
      err => { clearTimeout(timer); reject(err); }
    );
  });
}

// ── Set Furniture マッチング ────────────────────────────────────────────────

/**
 * ユーザーセット・公式セットから buildingType / zonePurpose / フットプリントが
 * ゾーンに収まる最適セットを返す。
 *
 * 優先順位:
 *   1. ユーザー自身のセット（カスタマイズ優先）
 *   2. 公式セット（採用率をボーナスとして加算）
 *
 * フィット判定: 0° / 90° 両方向、ゾーン面積の 90% 以内
 * スコアリング: 面積廃棄量（小さいほど優先）+ priority ボーナス(0〜1) + 採用率ボーナス(0〜0.3)
 */
/**
 * ゾーン条件にマッチするセット家具をスコア順に返す。
 * 複数セットパッキングのため、最良1件ではなく候補リスト全体を返す。
 */
async function fetchRankedSets(
  uid: string,
  buildingType: string,
  zoneMm: { w: number; d: number },
  zonePurpose?: string | null,
): Promise<{ set: any; rotate90: boolean; score: number; isUser: boolean }[]> {
  try {
    const { collection, query, where, getDocs, limit } = await import('firebase/firestore');

    // ユーザーセットと公式セットを並列取得
    // 公式セットは Firestore ルール（public または自分がオーナーのみ読取可）準拠のため
    // visibility == 'public' を併用する（isOfficial 単独クエリは権限エラーになる）
    const [userSnap, officialSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'modelSets'),
        where('ownerId', '==', uid),
        limit(100),
      )),
      getDocs(query(
        collection(db, 'modelSets'),
        where('isOfficial', '==', true),
        where('visibility', '==', 'public'),
        limit(50),
      )),
    ]);

    // updatedAt は string（ISO）と Firestore Timestamp が混在するため数値msに正規化して比較
    const toMs = (v: any): number => {
      if (!v) return 0;
      if (typeof v === 'string') return new Date(v).getTime() || 0;
      if (typeof v?.toMillis === 'function') return v.toMillis();
      if (typeof v?.seconds === 'number') return v.seconds * 1000;
      return 0;
    };
    const userSets = (userSnap.docs.map(d => ({ id: d.id, ...d.data(), _isUser: true })) as any[])
      .sort((a, b) => toMs(b.updatedAt) - toMs(a.updatedAt));
    // 自分の公式セットは userSnap にも含まれるため重複排除
    const userIds = new Set(userSets.map(s => s.id));
    const officialSets = (officialSnap.docs.map(d => ({ id: d.id, ...d.data(), _isUser: false })) as any[])
      .filter(s => !userIds.has(s.id));

    const allSets = [...userSets, ...officialSets];

    // ゾーン自体の用途（カテゴリ由来）を優先。無ければダイアログで選択した用途
    const activeZonePurpose: string | null =
      zonePurpose ?? (useAutoLayoutStore.getState() as any).zonePurpose ?? null;
    const TOLERANCE = 0.9;
    const scored: { set: any; waste: number; rotate90: boolean; score: number; isUser: boolean }[] = [];

    for (const s of allSets) {
      if (!(s.placedItems?.length > 0)) continue;
      if (!s.footprintMm?.w || !s.footprintMm?.d) continue;

      // buildingType フィルタ（設定あり & 不一致はスキップ）
      if (s.buildingType && s.buildingType !== buildingType) continue;

      // zonePurposes フィルタ
      if (s.zonePurposes?.length > 0 && activeZonePurpose) {
        if (!s.zonePurposes.includes(activeZonePurpose) && !s.zonePurposes.includes('general')) continue;
      }

      // 面積レンジフィルタ
      const areaSqmCurrent = (zoneMm.w * zoneMm.d) / 1_000_000;
      if (s.minAreaSqm != null && areaSqmCurrent < s.minAreaSqm) continue;
      if (s.maxAreaSqm != null && areaSqmCurrent > s.maxAreaSqm) continue;

      // フットプリントフィット判定
      const { w, d } = s.footprintMm;
      const fits0  = w <= zoneMm.w * TOLERANCE && d <= zoneMm.d * TOLERANCE;
      const fits90 = d <= zoneMm.w * TOLERANCE && w <= zoneMm.d * TOLERANCE;
      if (!fits0 && !fits90) continue;

      const zoneArea = zoneMm.w * zoneMm.d;
      const waste = Math.abs(zoneArea - w * d);

      // スコア = priority ボーナス（0〜1）+ 採用率ボーナス（公式セットのみ、最大0.3）
      const priorityBonus = (s.priority ?? 50) / 100;
      const totalVotes = (s.adoptionCount ?? 0) + (s.rejectionCount ?? 0);
      const adoptionBonus = !s._isUser && totalVotes > 0
        ? (s.adoptionCount / totalVotes) * 0.3
        : 0;

      scored.push({
        set: s,
        waste,
        rotate90: !fits0 && fits90,
        score: priorityBonus + adoptionBonus,
        isUser: Boolean(s._isUser),
      });
    }

    if (scored.length === 0) return [];

    scored.sort((a, b) => {
      // ユーザーセットを公式セットより優先
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      // 面積差が10%以内ならスコアで比較
      const wasteRatioDiff = Math.abs(a.waste - b.waste) / Math.max(a.waste + b.waste + 1, 1);
      if (wasteRatioDiff < 0.1) return (b.score ?? 0.5) - (a.score ?? 0.5);
      return a.waste - b.waste;
    });

    console.info(
      `[AutoLayout] fetchRankedSets → ${scored.length}件: `
      + scored.slice(0, 5).map(s => `"${s.set.title}"(${s.isUser ? 'U' : '公式'}, ${s.score.toFixed(2)})`).join(', '),
    );
    return scored.map(({ set, rotate90, score, isUser }) => ({ set, rotate90, score, isUser }));
  } catch (e) {
    console.warn('[AutoLayout] fetchRankedSets failed:', e);
    return [];
  }
}

/** Firestore ドキュメントデータから GLB URL を抽出（フィールド揺れ吸収）。 */
function extractGlbFromDoc(d: any): string | null {
  if (!d) return null;
  const top = d.glbUrl ?? d.modelGlbUrl ?? d.viewerGlbUrl ?? d.glbStoragePath
    ?? d.storageUrl ?? d.modelUrl ?? d.files?.glb?.url ?? d.files?.glb?.downloadUrl
    ?? d.files?.glb?.downloadURL ?? d.files?.glb?.storagePath ?? d.metadata?.glbUrl
    ?? d.metadata?.downloadUrl;
  if (top) return top;

  const lv = d.latestVersion;
  if (lv != null && d.versions?.[lv]) {
    const v = d.versions[lv] as any;
    const u = v.glbUrl ?? v.downloadUrl;
    if (u) return u;
  }
  return d.downloadUrl ?? null;
}

/**
 * assetId から GLB URL を取得する。
 * グローバル assets/{id} → プロジェクト projects/{pid}/assets/{id} の順で探索。
 * 旧形式 Set（placedItem に glbUrl 未保存）の救済に使用。
 */
async function resolveGlbUrlForAsset(
  assetId: string,
  projectId?: string | null,
): Promise<string | null> {
  if (!assetId) return null;
  try {
    const { doc: fsDoc, getDoc: fsGetDoc } = await import('firebase/firestore');

    // 1) グローバル assets
    const globalSnap = await fsGetDoc(fsDoc(db, 'assets', assetId));
    if (globalSnap.exists()) {
      const url = extractGlbFromDoc(globalSnap.data());
      if (url) return url;
    }

    // 2) プロジェクト assets（Set に projectId がある場合）
    if (projectId) {
      const projSnap = await fsGetDoc(fsDoc(db, 'projects', projectId, 'assets', assetId));
      if (projSnap.exists()) {
        const url = extractGlbFromDoc(projSnap.data());
        if (url) return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// セット配置エンジン
// SetPlacementRule（壁付け/中央/コーナー/窓向き・正面方向・クリアランス・回転ポリシー・
// 繰り返し）を解釈してゾーン内へセットを配置する。複数セットのパッキングに対応。
//
// 座標系:
//   ワールド XZ 平面 (mm)。DSL レイアウトのワールド座標は mm（ParametricRoom / zone.rect 同様）。
//   セットローカルも mm（エディタ TOP ビュー: x=右, y=奥行）→ ローカル→ワールド: x→X, y→Z（鏡像なし）。
//   正面方向ベクトル = (sinθ, -cosθ)（θ=frontDirectionDeg, 0=手前/-Z）。
//   90°回転1ステップ = (x,z)→(z,-x)、rotY += 90。正面ベクトルも同じ変換を受ける。
// ───────────────────────────────────────────────────────────────────────────

interface OccupiedBox {
  minX: number; maxX: number; minZ: number; maxZ: number;
  kind: 'solid' | 'clearance';
}

interface SetPlacementSpot {
  centerX: number;   // セット中心ワールドX (mm)
  centerZ: number;   // セット中心ワールドZ (mm)
  rotSteps: number;  // 90°回転ステップ数 (0-3)
  solid: OccupiedBox;
  clearance: OccupiedBox | null;
}

const SIDE_PAD_MM = 30;      // 壁付け以外の境界からの最小パッド (mm)
const SET_GAP_MM = 300;      // セット同士の最低ギャップ (mm)
const MAX_SETS_PER_ZONE = 4; // 1ゾーンに配置する異種セット数の上限

function rotStepVec(v: { x: number; z: number }, steps: number): { x: number; z: number } {
  let { x, z } = v;
  const k = ((steps % 4) + 4) % 4;
  for (let i = 0; i < k; i++) { const t = x; x = z; z = -t; }
  return { x, z };
}

function boxesOverlap(a: { minX: number; maxX: number; minZ: number; maxZ: number }, b: { minX: number; maxX: number; minZ: number; maxZ: number }): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
}

function boxInside(b: { minX: number; maxX: number; minZ: number; maxZ: number }, bounds: { minX: number; minZ: number; maxX: number; maxZ: number }, pad = 0): boolean {
  return b.minX >= bounds.minX + pad && b.maxX <= bounds.maxX - pad
      && b.minZ >= bounds.minZ + pad && b.maxZ <= bounds.maxZ - pad;
}

function expandBox<T extends { minX: number; maxX: number; minZ: number; maxZ: number }>(b: T, e: number) {
  return { minX: b.minX - e, maxX: b.maxX + e, minZ: b.minZ - e, maxZ: b.maxZ + e };
}

/** セットの solid/clearance ボックスを候補位置から構築 */
function makeSetBoxes(
  cx: number, cz: number,
  extX: number, extZ: number,
  front: { x: number; z: number },
  clearMm: number,
): { solid: OccupiedBox; clearance: OccupiedBox | null } {
  const solid: OccupiedBox = {
    minX: cx - extX / 2, maxX: cx + extX / 2,
    minZ: cz - extZ / 2, maxZ: cz + extZ / 2,
    kind: 'solid',
  };
  let clearance: OccupiedBox | null = null;
  if (clearMm > 0) {
    const alongZ = Math.abs(front.z) > 0.5; // 正面がZ軸方向か
    const extN = alongZ ? extZ : extX;      // 正面軸方向のセット奥行
    const ccx = cx + front.x * (extN / 2 + clearMm / 2);
    const ccz = cz + front.z * (extN / 2 + clearMm / 2);
    const cw = alongZ ? extX : clearMm;
    const cd = alongZ ? clearMm : extZ;
    clearance = {
      minX: ccx - cw / 2, maxX: ccx + cw / 2,
      minZ: ccz - cd / 2, maxZ: ccz + cd / 2,
      kind: 'clearance',
    };
  }
  return { solid, clearance };
}

/**
 * placementRule を解釈してセット1個分の配置位置を計算する。
 * クリアランスは 100% → 50% → 0% の3パスで緩和しながら探索する。
 * 配置できない場合は null。
 */
function computeSetPlacement(
  set: any,
  zoneBounds: { minX: number; minZ: number; maxX: number; maxZ: number },
  occupied: OccupiedBox[],
): SetPlacementSpot | null {
  const rule: SetPlacementRule = { ...DEFAULT_SET_PLACEMENT_RULE, ...(set.placementRule ?? {}) };
  const fw = set.footprintMm?.w ?? 0;
  const fd = set.footprintMm?.d ?? 0;
  if (fw <= 0 || fd <= 0) return null;

  const marginMm = Math.max(0, rule.marginFromWallMm ?? 50);
  const clearFullMm = Math.max(0, rule.frontClearanceMm ?? 0);
  const theta = ((rule.frontDirectionDeg ?? 0) * Math.PI) / 180;
  // 正面方向ベクトル（レイアウト座標系）:
  //   エディタローカルでは (sinθ, -cosθ)（0=手前/画面下=-y）だが、
  //   setToPlacementItems で奥行き軸を鏡像補正（エディタ +y → レイアウト -Z）するため、
  //   レイアウト系では z 成分が反転して (sinθ, +cosθ) になる（0=手前=+Z=画面下）。
  const front0 = { x: Math.sin(theta), z: Math.cos(theta) };
  const allowedSteps = rule.rotationPolicy === 'fixed' ? [0] : [0, 1, 2, 3];

  // 回転後のワールドAABB寸法（90°毎に w/d 入替）
  const dimsAt = (steps: number) => (steps % 2 === 0 ? { w: fw, d: fd } : { w: fd, d: fw });

  type Cand = { cx: number; cz: number; steps: number; front: { x: number; z: number } };
  const cands: Cand[] = [];

  // 実行ごとに候補順をシャッフルしてレイアウトの多様性を出す
  // （ルール上の制約 — 壁付け・向き・クリアランス — は維持される）
  const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

  // 壁定義: 内向き法線。壁付けは「正面 = 内向き法線」になる回転のみ採用
  const walls = shuffle([
    { id: 'zmin', n: { x: 0, z: 1 } },
    { id: 'zmax', n: { x: 0, z: -1 } },
    { id: 'xmin', n: { x: 1, z: 0 } },
    { id: 'xmax', n: { x: -1, z: 0 } },
  ]);

  // 壁沿いスロット（シャッフル + 微小ジッタで毎回異なる位置に。繰り返し時は衝突回避で自然に展開）
  const slotTs = shuffle([0.5, 0.38, 0.62, 0.26, 0.74, 0.14, 0.86, 0.06, 0.94])
    .map(t => Math.max(0, Math.min(1, t + (Math.random() - 0.5) * 0.08)));

  const pushWallCands = (cornerOnly: boolean) => {
    for (const steps of allowedSteps) {
      const f = rotStepVec(front0, steps);
      const { w: extX, d: extZ } = dimsAt(steps);
      for (const wall of walls) {
        const dot = f.x * wall.n.x + f.z * wall.n.z;
        if (dot < 0.9) continue; // 背面が壁を向く回転のみ
        const alongZ = Math.abs(wall.n.z) > 0.5; // 壁がZ軸に垂直（minZ/maxZ壁）か
        const extN = alongZ ? extZ : extX;       // 法線方向のセット奥行
        const extW = alongZ ? extX : extZ;       // 壁沿い方向のセット幅
        // 法線方向の中心座標: 壁 + マージン + 奥行/2
        const nCoord = wall.n.z > 0.5 ? zoneBounds.minZ + marginMm + extN / 2
                     : wall.n.z < -0.5 ? zoneBounds.maxZ - marginMm - extN / 2
                     : wall.n.x > 0.5 ? zoneBounds.minX + marginMm + extN / 2
                     : zoneBounds.maxX - marginMm - extN / 2;
        // 壁沿い方向の可動範囲
        const wMin = (alongZ ? zoneBounds.minX : zoneBounds.minZ) + SIDE_PAD_MM + extW / 2;
        const wMax = (alongZ ? zoneBounds.maxX : zoneBounds.maxZ) - SIDE_PAD_MM - extW / 2;
        if (wMax < wMin) continue; // 壁よりセットが大きい
        const ts = cornerOnly
          ? [0, 1] // コーナー: 両端のみ
          : slotTs;
        for (const t of ts) {
          const wCoord = cornerOnly
            ? (t === 0 ? wMin + Math.max(0, marginMm - SIDE_PAD_MM) : wMax - Math.max(0, marginMm - SIDE_PAD_MM))
            : wMin + t * (wMax - wMin);
          cands.push({
            cx: alongZ ? wCoord : nCoord,
            cz: alongZ ? nCoord : wCoord,
            steps,
            front: f,
          });
        }
      }
    }
  };

  const pushCenterCands = () => {
    const cx0 = (zoneBounds.minX + zoneBounds.maxX) / 2;
    const cz0 = (zoneBounds.minZ + zoneBounds.maxZ) / 2;
    const W = zoneBounds.maxX - zoneBounds.minX;
    const D = zoneBounds.maxZ - zoneBounds.minZ;
    // 中央付近の候補をシャッフル + 微小ジッタ付きで試行（多様性のため）
    const offsets = shuffle([
      [0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15],
      [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3],
      [0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22],
    ]);
    for (const steps of allowedSteps) {
      const f = rotStepVec(front0, steps);
      for (const [ox, oz] of offsets) {
        const jx = (Math.random() - 0.5) * 0.06 * W;
        const jz = (Math.random() - 0.5) * 0.06 * D;
        cands.push({ cx: cx0 + ox * W + jx, cz: cz0 + oz * D + jz, steps, front: f });
      }
    }
  };

  switch (rule.relation) {
    case 'against_wall':
      pushWallCands(false);
      break;
    case 'corner':
      pushWallCands(true);
      break;
    case 'face_window':
      // TODO: 窓データがゾーンに入ったら窓のある壁を優先する。現状は壁付けと同等。
      pushWallCands(false);
      break;
    case 'center':
      pushCenterCands();
      break;
    case 'free':
    default:
      // 自由: 中央 → 壁際の順で探索
      pushCenterCands();
      pushWallCands(false);
      break;
  }

  // クリアランス緩和3パス: 100% → 50% → 0%
  for (const cf of [1, 0.5, 0]) {
    const clearMm = clearFullMm * cf;
    for (const cand of cands) {
      const { w: extX, d: extZ } = dimsAt(cand.steps);
      const { solid, clearance } = makeSetBoxes(cand.cx, cand.cz, extX, extZ, cand.front, clearMm);
      if (!boxInside(solid, zoneBounds, 0)) continue;
      if (clearance && !boxInside(clearance, zoneBounds, 0)) continue;
      // solid は既存 solid（+ギャップ）とも既存 clearance とも重なってはいけない
      const solidBlocked = occupied.some(o =>
        o.kind === 'solid' ? boxesOverlap(expandBox(solid, SET_GAP_MM / 2), o) : boxesOverlap(solid, o),
      );
      if (solidBlocked) continue;
      // clearance は既存 solid と重なってはいけない（clearance 同士は許容）
      const clearBlocked = clearance
        ? occupied.some(o => o.kind === 'solid' && boxesOverlap(clearance, o))
        : false;
      if (clearBlocked) continue;
      if (cf < 1) {
        console.info(`[AutoLayout] "${set.title}": クリアランスを${cf * 100}%に緩和して配置`);
      }
      return { centerX: cand.cx, centerZ: cand.cz, rotSteps: cand.steps, solid, clearance };
    }
  }

  return null;
}

/**
 * ランク順のセット候補をゾーンへ貪欲法でパッキングする。
 * - 各セットの placementRule を解釈（壁付け・正面方向・クリアランス・回転）
 * - repeatable セットは同一ゾーンに maxCount まで繰り返し配置
 * - 配置済みセットのクリアランス帯は後続セットの solid 配置を妨げる
 */
async function packSetsIntoZone(
  candidates: { set: any }[],
  zoneData: ZoneData,
  obstacles: any[],
  gridHeightMm: number,
): Promise<{ placements: PlacementItem[]; placedSets: { id: string; title: string }[] }> {
  const { bounds } = zoneData;

  // 既存アイテムを solid 障害物として初期化（ワールド = mm、寸法も mm のまま）
  const occupied: OccupiedBox[] = obstacles
    .filter(item => item?.transform?.position)
    .map(item => {
      const pos = item.transform.position;
      const cx = Array.isArray(pos) ? pos[0] : (pos.x ?? 0);
      const cz = Array.isArray(pos) ? pos[2] : (pos.z ?? 0);
      const est = estimateDimensionsByCategory(item.category || item.type || '', item.title || item.name || '');
      const wMm = item.dimensionsMm?.width ?? item.metadata?.dimensions?.width ?? est.w;
      const dMm = item.dimensionsMm?.depth ?? item.metadata?.dimensions?.depth ?? est.d;
      return {
        minX: cx - wMm / 2, maxX: cx + wMm / 2,
        minZ: cz - dMm / 2, maxZ: cz + dMm / 2,
        kind: 'solid' as const,
      };
    });

  const placements: PlacementItem[] = [];
  const placedSets: { id: string; title: string }[] = [];
  const MAX_TOTAL_ITEMS = 60;

  for (const cand of candidates) {
    if (placedSets.length >= MAX_SETS_PER_ZONE) break;
    if (placements.length >= MAX_TOTAL_ITEMS) break;
    const set = cand.set;
    const rule: SetPlacementRule = { ...DEFAULT_SET_PLACEMENT_RULE, ...(set.placementRule ?? {}) };
    const maxInstances = rule.repeatable ? Math.min(rule.maxCount || 8, 8) : 1;

    let instancesPlaced = 0;
    for (let i = 0; i < maxInstances; i++) {
      const spot = computeSetPlacement(set, bounds, occupied);
      if (!spot) break;
      const items = await setToPlacementItems(set, zoneData, gridHeightMm, spot, `${placedSets.length}_${i}`);
      placements.push(...items);
      occupied.push(spot.solid);
      if (spot.clearance) occupied.push(spot.clearance);
      instancesPlaced++;
      console.info(
        `[AutoLayout] 配置: "${set.title}" #${i + 1} relation=${rule.relation} `
        + `rot=${spot.rotSteps * 90}° @ (${spot.centerX.toFixed(2)}, ${spot.centerZ.toFixed(2)})`,
      );
      if (placements.length >= MAX_TOTAL_ITEMS) break;
    }
    if (instancesPlaced > 0) placedSets.push({ id: set.id, title: set.title });
  }

  return { placements, placedSets };
}

/**
 * ModelSet の placedItems を PlacementItem[] に変換。
 * Set のローカル座標（mm）をセット中心原点化し、spot（配置位置 + 90°回転ステップ）を
 * 適用してワールド座標（m）に変換する。
 * 各アイテムの GLB URL を Firestore から解決して PlacementItem に含める。
 */
async function setToPlacementItems(
  set: any,
  zoneData: ZoneData,
  gridHeightMm: number,
  spot: SetPlacementSpot,
  idSuffix = '0',
): Promise<PlacementItem[]> {
  const { zoneId } = zoneData;
  const cx = spot.centerX; // 配置先セット中心 X (m)
  const cz = spot.centerZ; // 配置先セット中心 Z (m)
  const rotSteps = ((spot.rotSteps % 4) + 4) % 4;

  const items: any[] = set.placedItems ?? [];

  // セット自身のフットプリント中心（mm）を求めてセンタリングの原点にする。
  // これをしないと、セット内部の座標原点に依存して全体がゾーン中心からズレる。
  let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
  for (const it of items) {
    sMinX = Math.min(sMinX, it.x - it.w / 2);
    sMaxX = Math.max(sMaxX, it.x + it.w / 2);
    sMinY = Math.min(sMinY, it.y - it.d / 2);
    sMaxY = Math.max(sMaxY, it.y + it.d / 2);
  }
  const setCenterX = (sMinX + sMaxX) / 2;
  const setCenterY = (sMinY + sMaxY) / 2;

  // GLB URL 解決:
  //   1) placedItem に保存済みの glbUrl を最優先（新形式・最も確実）
  //   2) 無ければ assets/{id} から解決（旧形式の Set 向けフォールバック）
  const idsNeedingFetch = [...new Set(
    items.filter((i: any) => !i.glbUrl && i.assetId).map((i: any) => i.assetId),
  )] as string[];
  const glbMap = new Map<string, string | null>();
  await Promise.all(
    idsNeedingFetch.map(async id => {
      glbMap.set(id, await resolveGlbUrlForAsset(id, set.projectId));
    }),
  );

  const result = items.map((item: any, idx: number) => {
    // エディタ・レイアウトとも「X=左右 / 奥行 / 回転=上軸」で対応するため鏡像にしない。
    // セット中心を原点化した上で、奥行(エディタ Y)→レイアウト Z にそのままマップする。
    // 画面見た目を一致させる座標変換:
    //   セットエディタ TOP は「画面上 = +y」(Z-up, camera up=[0,1,0])、
    //   レイアウト TOP は「画面上 = -Z」(LayoutCameraRig up=(0,0,-1))。
    //   → y をそのまま Z に写すと上下鏡像になるため、奥行き軸を反転する。
    //   回転は両ビューとも画面上 CCW が正のため符号変換不要（基準向きも一致）。
    let lx = item.x - setCenterX;     // mm (world X)
    let lz = -(item.y - setCenterY);  // mm (world Z) — 鏡像補正（エディタ +y = レイアウト -Z）
    let rot = item.rotation ?? 0;     // 上軸回転はそのまま

    // placementRule が決めた 90°回転ステップを適用: 1ステップ = (x, z) → (z, -x)
    for (let s = 0; s < rotSteps; s++) {
      const tmp = lx;
      lx = lz;
      lz = -tmp;
    }
    rot = (rot + rotSteps * 90) % 360;

    const glbUrl = item.glbUrl ?? glbMap.get(item.assetId) ?? null;
    if (!glbUrl) {
      console.warn(
        `[AutoLayout] Set item "${item.title}" (asset=${item.assetId}) `
        + `has no GLB URL → ボックス表示になります。セットを再保存すると解決されます。`,
      );
    } else {
      console.log(`[AutoLayout] Set item "${item.title}" glbUrl(full):`, glbUrl);
    }

    return {
      id: `set_${set.id}_${idSuffix}_${item.instanceId ?? idx}`,
      zoneId,
      entityId: item.assetId,
      itemRef: `assets/${item.assetId}`,
      glbUrl,
      // 正しいスケールのため寸法を渡す (mm)。ネイティブ単位に関係なく描画サイズが安定する
      dimensionsMm: { width: item.w, depth: item.d, height: item.h ?? Math.min(item.w, item.d) },
      name: item.title ?? null,
      transform: {
        position: { x: cx + lx, y: gridHeightMm, z: cz + lz },
        rotation: { x: 0, y: rot, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      snapshot: {
        title: item.title ?? '',
        thumbnailUrl: item.thumbnailUrl ?? null,
        glbUrl: glbUrl ?? undefined,
      },
    } as PlacementItem;
  });

  const resolved = result.filter(r => r.glbUrl).length;
  console.log(`[AutoLayout] Set "${set.title}": ${resolved}/${result.length} items に GLB URL あり`);
  console.log('[AutoLayout] zoneCenter(m):', { cx, cz });
  console.table(result.map((r, i) => ({
    title: r.name,
    'in.x(mm)': items[i].x,
    'in.y(mm)': items[i].y,
    'in.rot': items[i].rotation,
    'out.X(m)': Number(r.transform.position.x.toFixed(2)),
    'out.Z(m)': Number(r.transform.position.z.toFixed(2)),
    'out.rotY': r.transform.rotation.y,
  })));

  return result;
}

/**
 * セットが必要役割(requiredRoles=layoutCategory)をどれだけ含むかの充足率(0〜1)。
 * セット内アイテムの categoryKey → layoutCategory に変換して必要役割と突き合わせる。
 */
function setCoverage(set: any, requiredRoles: string[]): number {
  if (requiredRoles.length === 0) return 0;
  const setRoles = new Set<string>();
  for (const it of (set?.items || [])) {
    const meta = getCategoryMeta(it.categoryKey);
    if (meta) setRoles.add(meta.layoutCategory);
  }
  const covered = requiredRoles.filter(r => setRoles.has(r)).length;
  return covered / requiredRoles.length;
}

/**
 * ①選定のプログラム充足率でセット候補を再ランキングする。
 * 充足率の高い順。同率は元の順序（fetchRankedSets のユーザー優先/面積/スコア順）を維持。
 */
function rankSetsByProgram<T extends { set: any }>(ranked: T[], requiredRoles: string[]): T[] {
  const withCov = ranked.map((r, i) => ({ r, i, cov: setCoverage(r.set, requiredRoles) }));
  withCov.sort((a, b) => (b.cov - a.cov) || (a.i - b.i));
  console.info(
    `[AutoLayout] rankSetsByProgram(必要役割: ${requiredRoles.join('/')}) → `
    + withCov.slice(0, 5).map(x => `"${x.r.set?.title ?? x.r.set?.name}"(${Math.round(x.cov * 100)}%)`).join(', '),
  );
  return withCov.map(x => x.r);
}

/**
 * ①選定駆動の個別配置（フォールバック）: useFurnitureSelectionStore に保存された FurnitureSlot を
 * そのまま ②placeSlots → 製品解決 に流す。製品は availableAssets / ユーザーデフォルト家具から
 * role(=layoutCategory) で束縛し、見つからなければプレースホルダーボックスを置く。
 * セットでプログラムを満たせなかった場合にのみ使う。
 *
 * 「①自動家具選定」と「②自動レイアウト」を繋ぐ連携点（[[project_slayout_auto_layout_arch]]）。
 */
async function runSelectionLayout(
  zoneData: ZoneData,
  obstacles: any[],
  gridHeightMm: number,
  selection: ZoneSelection,
  ruleSet: LayoutRuleSet | null,
  availableAssets: any[],
  context?: AutoLayoutContext,
): Promise<PlacementItem[]> {
  // ── 候補プール: 渡されたアセット + ユーザーデフォルト家具 ──
  const pool: any[] = [...(availableAssets || [])];
  if (context?.userId) {
    try {
      const { getMergedDefaults } = await import('./furnitureDefaultsApi');
      const { getCategoryMeta } = await import('../constants/furnitureCategoryDefaults');
      const defaults = await getMergedDefaults(context.userId, context.projectId);
      defaults.forEach((entry: any, key: string) => {
        const meta = getCategoryMeta(key);
        pool.push({
          id: entry.entityId,
          entityId: entry.entityId,
          title: entry.title,
          category: meta?.layoutCategory ?? key,
          thumbnailUrl: entry.thumbnailUrl,
          metadata: { dimensions: { width: entry.widthMm ?? meta?.widthMm, depth: entry.depthMm ?? meta?.depthMm } },
          _isDefault: true,
        });
      });
    } catch (e) {
      console.warn('[AutoLayout/selection] defaults fetch failed', e);
    }
  }

  const assetCat = (a: any) => (a?.category || a?.title || '').toLowerCase();

  // role(layoutCategory) → 候補。最初の一致を採用。無ければプレースホルダー。
  const pickForRole = (role: string): any => {
    const r = role.toLowerCase();
    const hit = pool.find(a => { const c = assetCat(a); return c === r || c.includes(r); });
    if (hit) return hit;
    return {
      id: `placeholder_${role}`,
      entityId: `placeholder_${role}`,
      title: getLayoutCategoryLabel(role),
      category: role,
      _isPlaceholder: true,
    };
  };

  // around 親参照のため role → 最初の slotId を控える
  const roleToSlotId = new Map<string, string>();
  for (const s of selection.slots) {
    if (!roleToSlotId.has(s.role)) roleToSlotId.set(s.role, s.slotId);
  }

  const assetBySlotId = new Map<string, any>();
  const specs: PlacementSpec[] = selection.slots.map(slot => {
    assetBySlotId.set(slot.slotId, pickForRole(slot.role));
    const isAround = slot.relation === 'around';
    const parentSlotId = slot.anchorRef ? roleToSlotId.get(slot.anchorRef) : undefined;
    const physicalRule = ruleSet?.rules.find(rr => {
      const fc = rr.furnitureCategory.toLowerCase();
      return slot.role.includes(fc) || fc.includes(slot.role);
    });
    const rule: LayoutRule = {
      targetId: slot.slotId,
      position: slot.relation,
      relation: isAround ? `around ${parentSlotId ?? ''}` : undefined,
      count: slot.count,
    };
    return { slot, refId: slot.slotId, rule, physicalRule };
  });

  const maxTotalItems = Math.min(
    selection.slots.reduce((sum, s) => sum + s.count, 0),
    50,
  );

  const placedSlots = placeSlots(specs, zoneData, gridHeightMm, obstacles, maxTotalItems);
  return resolveProducts(placedSlots, (s) => assetBySlotId.get(s.slotId) ?? null);
}

export async function runAutoLayout(
  zoneData: ZoneData,
  obstacles: any[] = [],
  availableAssets: any[] = [],
  gridHeightMm: number = 0,
  context?: AutoLayoutContext
): Promise<{ placements: PlacementItem[]; sessionId: string; matchedSetId?: string }> {
  const { bounds, zoneId } = zoneData;
  // DSL ワールド座標 = mm（zone.rect / ParametricRoom / gridHeightMm すべて mm）
  const widthMm = Math.abs(bounds.maxX - bounds.minX);
  const depthMm = Math.abs(bounds.maxZ - bounds.minZ);
  const areaSqm = (widthMm * depthMm) / 1000000;

  const storeBuildingType = useAutoLayoutStore.getState().buildingType;
  const zonePurpose = useAutoLayoutStore.getState().zonePurpose ?? 'general';
  
  // 優先順位: 1. Project, 2. Zone, 3. Dialog, 4. Default
  const activeBuildingType: BuildingType = 
    (context?.buildingType as BuildingType) || 
    (zoneData.buildingType as BuildingType) || 
    storeBuildingType || 
    'residential';

  // ゾーン自体の用途（カテゴリ由来）を優先。無ければダイアログで選択した用途
  const activeZonePurpose = zoneData.purpose ?? zonePurpose;

  // Use LLM zone purpose mapping for AI recommendations if needed,
  // but let's just pass our ZonePurpose as a string.
  const llmZonePurpose = activeZonePurpose === 'general' ? 'lounge' : activeZonePurpose;
  const targetSeats = Math.max(2, Math.floor(areaSqm / 2));

  // ── ①選定の取り込み: 「自動家具選定」で確定した役割プログラム ─────────────
  // このゾーンに選定があれば、それを「必要な役割リスト」として読み、②のセット選定を
  // プログラム充足率で並べ替える（選定＝何が要るか／配置＝どのセットで満たすか）。
  // 選定は配置成功時に1回限りで消費（consume-once）する。
  const userSelection = useFurnitureSelectionStore.getState().selections[zoneId];
  const requiredRoles: string[] = userSelection
    ? Array.from(new Set(userSelection.slots.map(s => s.role)))
    : [];

  // ── Set Furniture を優先的に使用（デフォルト家具より先に試みる）──────────
  // ランク順のセット候補を placementRule（壁付け/中央/コーナー/向き/クリアランス/繰り返し）に
  // 従ってゾーンへパッキングする。1件も置けなければ従来のヒューリスティックへフォールバック。
  if (context?.userId) {
    try {
      useAutoLayoutStore.getState().setProgressMessage('セットを検索中...');
      const rankedRaw = await fetchRankedSets(
        context.userId,
        activeBuildingType,
        { w: widthMm, d: depthMm },
        activeZonePurpose,
      );
      // ①選定があれば、プログラム充足率（必要役割をどれだけ含むか）で再ランキング。
      const ranked = requiredRoles.length > 0
        ? rankSetsByProgram(rankedRaw, requiredRoles)
        : rankedRaw;
      if (ranked.length > 0) {
        useAutoLayoutStore.getState().setProgressMessage(
          requiredRoles.length > 0 ? '選定に合うセットを配置中...' : 'セットを配置中...',
        );
        const { placements, placedSets } = await packSetsIntoZone(
          ranked, zoneData, obstacles, gridHeightMm,
        );
        if (placements.length > 0) {
          console.log(
            `[AutoLayout] Set Furniture パッキング完了: `
            + `${placedSets.length}セット / ${placements.length}アイテム → `
            + placedSets.map(s => `"${s.title}"`).join(', '),
          );
          useAutoLayoutStore.getState().setProgressMessage(null);
          if (userSelection) useFurnitureSelectionStore.getState().clearZone(zoneId); // 選定を消費
          const sessionId = crypto.randomUUID();
          // セットマッチのセッションをログに残す（採用率記録のため）
          try {
            const { doc: fsDoc, setDoc: fsSetDoc, serverTimestamp } = await import('firebase/firestore');
            await fsSetDoc(fsDoc(db, 'layout_generation_logs', sessionId), {
              sessionId,
              userId: context?.userId ?? null,
              projectId: context?.projectId ?? null,
              matchedSetId: placedSets[0].id,
              matchedSetTitle: placedSets[0].title,
              matchedSetIsOfficial: ranked.find(r => r.set.id === placedSets[0].id)?.set.isOfficial ?? false,
              placedSetIds: placedSets.map(s => s.id),
              zoneInfo: { purpose: activeZonePurpose, areaSqm, buildingType: activeBuildingType },
              placedItemCount: placements.length,
              mode: 'set_furniture',
              rating: null,
              ratingComment: null,
              ratedAt: null,
              timestamp: serverTimestamp(),
            });
          } catch (logErr) {
            console.warn('[AutoLayout] session log failed (set_furniture):', logErr);
          }
          return { placements, sessionId, matchedSetId: placedSets[0].id };
        }
        console.warn('[AutoLayout] セット候補はあるが配置スペースなし → ヒューリスティックへフォールバック');
      }
    } catch (e) {
      console.warn('[AutoLayout] Set Furniture matching failed, falling back to defaults', e);
    }
  }

  // ── ①選定の個別フォールバック ──────────────────────────────────────────────
  // 選定はあるが、それを満たすセットが無い／置けなかった場合は、選定スロットを
  // 個別家具（デフォルト家具、無ければプレースホルダー）として直接配置する。
  if (userSelection && userSelection.slots.length > 0) {
    try {
      useAutoLayoutStore.getState().setProgressMessage('選定した家具を個別配置中...');
      let selRuleSet: LayoutRuleSet | null = null;
      try {
        selRuleSet = await layoutRulesApi.getLayoutRuleSet(activeBuildingType, activeZonePurpose, context?.projectId, context?.userId);
      } catch (e) {
        console.warn('[AutoLayout/selection] rule set fetch failed', e);
      }
      const placements = await runSelectionLayout(zoneData, obstacles, gridHeightMm, userSelection, selRuleSet, availableAssets, context);
      useAutoLayoutStore.getState().setProgressMessage(null);
      if (placements.length > 0) {
        useFurnitureSelectionStore.getState().clearZone(zoneId); // 選定を消費
        const sessionId = crypto.randomUUID();
        console.log(`[AutoLayout] 選定の個別配置（セット非該当）: ${placements.length}点 (zone=${zoneId}, ${userSelection.label})`);
        return { placements, sessionId };
      }
      console.warn('[AutoLayout] 選定の個別配置も不可 → 通常フローへ');
    } catch (e) {
      console.warn('[AutoLayout] 選定の個別配置に失敗 → 通常フローへ', e);
    }
  }

  // Format assets for the LLM correctly (summarize to save tokens)
  // Auto Layout実行時のみメモリ上で補完
  const enrichedAssets = await Promise.all(
    (availableAssets || []).map(async (asset) => {
      if (asset.extendedMetadata) return asset; // 既にある場合はスキップ
      if (!asset.entityId) return asset;
      try {
        const sourceDoc = await getDoc(doc(db, 'assets', asset.entityId));
        if (!sourceDoc.exists()) return asset;
        const source = sourceDoc.data();
        return {
          ...asset,
          extendedMetadata: source.extendedMetadata ?? null,
          buildingTypes: source.buildingTypes ?? [],
          rooms: source.rooms ?? [],
          zones: source.zones ?? [],
        };
      } catch (e) {
        console.warn('Failed to fetch source asset metadata:', e);
        return asset;
      }
    })
  );

  // ── ユーザー設定のデフォルト家具を取得して availableAssets に注入 ──────────
  let defaultsMap: Map<string, any> = new Map();
  if (context?.userId) {
    try {
      const { getMergedDefaults } = await import('./furnitureDefaultsApi');
      defaultsMap = await getMergedDefaults(context.userId, context.projectId);
    } catch (e) {
      console.warn('[AutoLayout] defaults fetch failed', e);
    }
  }

  // デフォルト家具のうち availableAssets に含まれていないものをプレースホルダーとして追加
  if (defaultsMap.size > 0) {
    const existingEntityIds = new Set(enrichedAssets.map((a: any) => a.entityId || a.id));
    const { getCategoryMeta } = await import('../constants/furnitureCategoryDefaults');
    defaultsMap.forEach((entry, key) => {
      if (!existingEntityIds.has(entry.entityId)) {
        const meta = getCategoryMeta(key);
        enrichedAssets.push({
          id: entry.entityId,
          entityId: entry.entityId,
          title: entry.title,
          category: meta?.layoutCategory ?? key,
          thumbnailUrl: entry.thumbnailUrl,
          metadata: {
            dimensions: {
              width: entry.widthMm ?? meta?.widthMm ?? 1000,
              depth: entry.depthMm ?? meta?.depthMm ?? 1000,
            },
          },
          _isDefault: true,
        });
      }
    });
  }

  // デフォルト家具もなければプレースホルダーボックスをカテゴリ別に生成
  if (enrichedAssets.length === 0) {
    const { FURNITURE_CATEGORIES } = await import('../constants/furnitureCategoryDefaults');
    const buildingFilter: Record<string, string[]> = {
      residential: ['sofa_2seat', 'chair_dining', 'table_dining', 'table_coffee', 'bed_double', 'tv_board', 'plant_large'],
      office:      ['desk', 'chair_office', 'table_meeting', 'shelf', 'plant_small'],
      cafe:        ['table_dining', 'chair_dining', 'counter_register', 'plant_large'],
      hotel:       ['bed_double', 'chair_lounge', 'table_side', 'tv_board'],
    };
    const keys = buildingFilter[activeBuildingType] ?? buildingFilter.residential;
    keys.forEach(key => {
      const meta = FURNITURE_CATEGORIES.find(c => c.key === key);
      if (!meta) return;
      enrichedAssets.push({
        id: `placeholder_${key}`,
        entityId: `placeholder_${key}`,
        title: meta.label,
        category: meta.layoutCategory,
        metadata: { dimensions: { width: meta.widthMm, depth: meta.depthMm } },
        _isPlaceholder: true,
      });
    });
  }

  const validAssets = enrichedAssets.length > 0 ? enrichedAssets : MOCK_SETS;
  const assetCatalog = validAssets.map((a: any) => {
    const id = a.metadata?.sourceModelId || a.entityId || a.id;
    const w = a.metadata?.dimensions?.width || 1000;
    const d = a.metadata?.dimensions?.depth || 1000;
    return { id, title: a.title, category: a.category || "Furniture", width: w, depth: d };
  });

  const mode = context?.mode || 'ai';
  const setProgress = context?.setProgressMessage || (() => {});

  let ruleSet: LayoutRuleSet | null = null;
  try {
    ruleSet = await layoutRulesApi.getLayoutRuleSet(activeBuildingType, activeZonePurpose, context?.projectId, context?.userId);
  } catch (e) {
    console.error('[AutoLayout] Failed to load layout rules', e);
  }

  let recommended: RecommendationResult[] = [];
  let layoutRules: LayoutRule[] = [];

  try {
    if (mode === 'rules-only') {
    console.log('[AutoLayout] Rules-only mode selected. Skipping AI.');
  } else {
    let phase1Timer: ReturnType<typeof setTimeout> | undefined;
    let phase2Timer: ReturnType<typeof setTimeout> | undefined;

    try {
      console.log('[AutoLayout] Running AI Pipeline with 30s timeout limit');
      const setProgressMessage = useAutoLayoutStore.getState().setProgressMessage;

      setProgressMessage('家具を選定中...');

      phase1Timer = setTimeout(() => {
        setProgressMessage('実行中...（初回起動のため少々お待ちください）');
      }, 10000);

      phase2Timer = setTimeout(() => {
        setProgressMessage('配置ルールを計算中...');
      }, 20000);
      
      const aiExecution = async () => {
        const recs = await fetchRecommendation(llmZonePurpose, areaSqm, targetSeats, assetCatalog);
        setProgressMessage('配置ルールを計算中...');
        const rules = await fetchLayout({ width: widthMm, depth: depthMm }, recs, obstacles);
        return { recs, rules };
      };
      
      const res = await withTimeout(aiExecution(), 30000, "AI Pipeline");
      recommended = res.recs;
      layoutRules = res.rules;
    } catch (e) {
      console.warn("AI pipeline failed or timed out. Falling back to rules-only.", e);
    } finally {
      clearTimeout(phase1Timer);
      clearTimeout(phase2Timer);
    }
  }

  if (!layoutRules || layoutRules.length === 0) {
    setProgress("ヒューリスティック配置を計算...");
    console.warn("Generating heuristic fallback layout rules.");
    if (!recommended || recommended.length === 0) {
      const maxTypes = Math.max(1, Math.floor(Math.min(validAssets.length * 5, 30) / (targetSeats > 0 ? targetSeats : 2)));
      recommended = assetCatalog.slice(0, maxTypes).map((a: any) => ({ assetId: a.id, quantity: targetSeats > 0 ? targetSeats : 2 }));
    }

    layoutRules = recommended.map(r => {
      const asset = assetCatalog.find(a => a.id === r.assetId);
      const cat = (asset?.category || asset?.title || "").toLowerCase();
      let position = 'center';

      if (cat.includes('sofa') || cat.includes('chair') || cat.includes('ソファ') || cat.includes('チェア')) {
        position = 'wall';
      } else if (cat.includes('plant') || cat.includes('decor') || cat.includes('植栽') || cat.includes('小物')) {
        position = 'corner';
      } else if (cat.includes('desk') || cat.includes('table') || cat.includes('デスク') || cat.includes('テーブル')) {
        position = 'center';
      }

      return { targetId: r.assetId, position, count: r.quantity };
    });
  }

  setProgress(null);

  console.log('[AutoLayout] Applying Heuristics Geometry');
  const results = calculatePositions(layoutRules, zoneData, validAssets, gridHeightMm, ruleSet, obstacles);

  console.group('[AutoLayout] runAutoLayout final result');
  console.log('zoneId:', zoneId, 'rules:', layoutRules.length, 'results:', results.length);
  console.dir(results);
  console.groupEnd();

  const sessionId = crypto.randomUUID();

  if (context?.userId) {
    try {
      const profile = useAiProfileStore.getState().aiProfiles.find(p => p.id === 'ai-layout-coordinator:gemini');
      const modelUsed = profile?.baseModelId || 'gemini-2.5-flash';

      const rawData = {
        sessionId,
        userId: context.userId ?? null,
        projectId: context.projectId ?? null,
        zoneInfo: {
          purpose: zonePurpose ?? null,
          areaSqm: areaSqm ?? null,
          targetSeats: targetSeats ?? null
        },
        availableAssetIds: validAssets.map(a => a.id || a.entityId || a.modelId || null),
        modelUsed: modelUsed ?? null,
        recommendationResult: recommended ?? [],
        layoutRules: layoutRules ?? [],
        placedItemCount: results.length ?? 0,
        rating: null,
        ratingComment: null,
        ratedAt: null,
        wasModified: false,
      };

      const cleanUndefined = (obj: any): any => {
        if (obj === undefined) return null;
        if (obj === null || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(cleanUndefined);
        const res: any = {};
        for (const key in obj) {
          res[key] = obj[key] === undefined ? null : cleanUndefined(obj[key]);
        }
        return res;
      };

      const logData = cleanUndefined(rawData);
      logData.timestamp = serverTimestamp();

      await setDoc(doc(db, "layout_generation_logs", sessionId), logData);
      console.log(`[AutoLayout] Log saved successfully for session: ${sessionId}`);
    } catch (err) {
      console.error("[AutoLayout] Failed to save generation log", err);
    }
  }

    return { placements: results, sessionId };
  } finally {
    setProgress(null);
    useAutoLayoutStore.getState().setProgressMessage(null);
  }
}
