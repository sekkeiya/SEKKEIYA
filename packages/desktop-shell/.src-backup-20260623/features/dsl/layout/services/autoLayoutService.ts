import { httpsCallable } from "firebase/functions";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "@desktop/lib/firebase/client";
import { getDownloadUrlForModel } from "@desktop/features/dss/utils/modelUtils";

export interface ZonePolygonPoint {
  x: number;
  z: number;
}

export interface ZoneData {
  zoneId: string;
  polygon: ZonePolygonPoint[];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
  buildingType?: string;
  circulations?: {
    id: string;
    type: 'main' | 'sub';
    width: number;
    points: { x: number; z: number }[];
  }[];
}

import type { BuildingType, LayoutRuleSet, FurniturePlacementRule } from '../types/layoutRules';
import { layoutRulesApi } from './layoutRulesApi';

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
  // rect ベースのゾーン定義を優先
  const zone = zones.find((z) => z.id === zoneId);
  let minX: number, minZ: number, maxX: number, maxZ: number;

  if (zone?.rect) {
    const r = zone.rect;
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
      const pad = 2.0;
      minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
    } else {
      minX = -5; minZ = -5; maxX = 5; maxZ = 5;
    }
  }

  const polygon: ZonePolygonPoint[] = [
    { x: minX, z: minZ },
    { x: maxX, z: minZ },
    { x: maxX, z: maxZ },
    { x: minX, z: maxZ },
  ];

  const result: ZoneData = { 
    zoneId, 
    polygon, 
    bounds: { minX, minZ, maxX, maxZ },
    buildingType: zone?.buildingType,
    circulations: zone?.circulations || [],
  };
  console.group('[AutoLayout] extractZoneData');
  console.dir(result);
  console.groupEnd();

  return result;
}

import { useAiProfileStore } from "@desktop/store/useAiProfileStore";
import { useAutoLayoutStore } from "@desktop/features/dsl/layout/store/useAutoLayoutStore";

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

function checkOverlap(
  newX: number, newZ: number,
  newW: number, newD: number,
  placedItems: PlacedBounds[],
  margin: number = 100
): boolean {
  const half_w = newW / 2;
  const half_d = newD / 2;
  const newBounds = {
    minX: newX - half_w - margin,
    maxX: newX + half_w + margin,
    minZ: newZ - half_d - margin,
    maxZ: newZ + half_d + margin,
  };
  return placedItems.some(b =>
    newBounds.minX < b.maxX &&
    newBounds.maxX > b.minX &&
    newBounds.minZ < b.maxZ &&
    newBounds.maxZ > b.minZ
  );
}

/**
 * Heuristic geometry calculation converting semantic AI rules to X/Z coordinates
 */
function calculatePositions(rules: LayoutRule[], zoneData: ZoneData, availableAssets: any[], gridHeightMm: number, ruleSet: LayoutRuleSet | null): PlacementItem[] {
  const { bounds, zoneId } = zoneData;
  const { minX, minZ, maxX, maxZ } = bounds;
  const widthM = Math.abs(maxX - minX);
  const depthM = Math.abs(maxZ - minZ);

  // Convert units (grid positions are in meters)
  const mmToM = (mm: number) => mm / 1000;

  const results: PlacementItem[] = [];
  const placedMap = new Map<string, any>(); // targetId -> placement info
  const placedItemsBounds: PlacedBounds[] = []; // AABB tracking

  const maxZoneItems = 50; // hard limit
  const maxTotalItems = Math.min(availableAssets.length * 5, 30, maxZoneItems);
  let totalGenerated = 0;

  const shuffledAssets = [...availableAssets].sort(() => Math.random() - 0.5);
  const enrichedRules = rules.map(rule => {
    const asset = shuffledAssets.find(a => {
      const eid = a.metadata?.sourceModelId || a.entityId || a.id;
      return eid === rule.targetId;
    });
    const category = (asset?.category || asset?.title || "").toLowerCase();
    
    let physicalRule = ruleSet?.rules.find(r => category.includes(r.furnitureCategory.toLowerCase()));
    if (!physicalRule) {
      if (category.includes('sofa') || category.includes('chair') || category.includes('ソファ')) {
        physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'sofa' || r.furnitureCategory === 'chair');
      } else if (category.includes('table') || category.includes('desk') || category.includes('デスク')) {
        physicalRule = ruleSet?.rules.find(r => r.furnitureCategory === 'table' || r.furnitureCategory === 'desk');
      }
    }
    return { rule, asset, physicalRule };
  });

  // Sort by priority (higher first)
  enrichedRules.sort((a, b) => (b.physicalRule?.placement.priority || 0) - (a.physicalRule?.placement.priority || 0));

  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const isWidthShort = widthM <= depthM;

  // First pass: Absolute/Distribution positioning
  for (const { rule, asset, physicalRule } of enrichedRules) {
    if (rule.relation && rule.relation.startsWith("around")) continue;
    
    const safeCount = Math.min(Math.max(1, parseInt(rule.count as any, 10) || 1), 10);
    const category = (asset?.category || asset?.title || "").toLowerCase();

    // 引き出しスペースなどを考慮（テーブル・イス・ソファ等の場合はマージン大）
    const isSeatingOrTable = category.includes('sofa') || category.includes('chair') || category.includes('table') || category.includes('desk') || category.includes('ソファ') || category.includes('チェア') || category.includes('デスク');
    
    const assetWM = mmToM(asset?.extendedMetadata?.dimensions?.width || asset?.metadata?.dimensions?.width || 600);
    const assetDM = mmToM(asset?.extendedMetadata?.dimensions?.depth || asset?.metadata?.dimensions?.depth || 600);

    // 最小間隔600mm -> collisionMargin = 300mm. テーブルイスは800mm -> 400mm
    const baseCollisionMarginM = isSeatingOrTable ? mmToM(400) : mmToM(300);
    const physicalRuleMargin = physicalRule?.placement?.distanceFromOther ? mmToM(physicalRule.placement.distanceFromOther) : 0;
    const collisionMarginM = Math.max(baseCollisionMarginM, physicalRuleMargin);
    
    // 境界余白（最低400mm -> 600mmに増加）
    const ruleMarginM = physicalRule?.placement?.marginFromWall ? mmToM(physicalRule.placement.marginFromWall) : 0;
    const wallMarginM = Math.max(mmToM((rule as any).marginFromWall || 0), ruleMarginM, mmToM(600));
    
    const validMinX = minX + wallMarginM + assetWM / 2;
    const validMaxX = maxX - wallMarginM - assetWM / 2;
    const validMinZ = minZ + wallMarginM + assetDM / 2;
    const validMaxZ = maxZ - wallMarginM - assetDM / 2;

    for (let c = 0; c < safeCount; c++) {
      if (totalGenerated >= maxTotalItems) break;
      if (!asset) continue;

      let bestScore = -Infinity;
      let bestPos = { x: midX, z: midZ, rotationY: 0 };
      
      const NUM_CANDIDATES = 200;
      for (let i = 0; i < NUM_CANDIDATES; i++) {
        // 候補点（ランダム）
        const cx = validMinX < validMaxX ? validMinX + Math.random() * (validMaxX - validMinX) : midX;
        const cz = validMinZ < validMaxZ ? validMinZ + Math.random() * (validMaxZ - validMinZ) : midZ;
        
        // 主動線（短辺側の中央）の判定: 幅900mm（中心から±450mm）のクリアゾーン
        const pathHalfWidthM = mmToM(450);
        let inPath = false;
        if (isWidthShort) {
          if (Math.abs(cx - midX) < pathHalfWidthM + assetWM / 2) inPath = true;
        } else {
          if (Math.abs(cz - midZ) < pathHalfWidthM + assetDM / 2) inPath = true;
        }
        
        const candBounds = {
          minX: cx - assetWM / 2 - collisionMarginM,
          maxX: cx + assetWM / 2 + collisionMarginM,
          minZ: cz - assetDM / 2 - collisionMarginM,
          maxZ: cz + assetDM / 2 + collisionMarginM,
        };
        
        const isOverlap = placedItemsBounds.some(b => 
          candBounds.minX < b.maxX &&
          candBounds.maxX > b.minX &&
          candBounds.minZ < b.maxZ &&
          candBounds.maxZ > b.minZ
        );

        if (isOverlap) continue;

        let score = 0;
        
        // 動線ペナルティ
        if (inPath) score -= 100;
        
        // 角ペナルティ強化 (1.5倍)
        const distToEdgeX = Math.min(Math.abs(cx - minX), Math.abs(maxX - cx));
        const distToEdgeZ = Math.min(Math.abs(cz - minZ), Math.abs(maxZ - cz));
        const inCorner = distToEdgeX < widthM * 0.2 && distToEdgeZ < depthM * 0.2;
        if (inCorner) score -= 5;
        
        // 分散と重心バランスのスコアリング
        let minDist = Infinity;
        for (const pb of placedItemsBounds) {
          const pCenter = { x: (pb.minX + pb.maxX)/2, z: (pb.minZ + pb.maxZ)/2 };
          const dist = Math.sqrt((cx - pCenter.x)**2 + (cz - pCenter.z)**2);
          if (dist < minDist) minDist = dist;
        }
        
        if (placedItemsBounds.length === 0) {
          // 最初のアイテムはゾーン中心付近を好む (1.5倍強化)
          const distToCenter = Math.sqrt((cx - midX)**2 + (cz - midZ)**2);
          score += (10 - distToCenter * 1.5);
        } else {
          score += minDist * 1.3; // 分散スコアを1.3倍に強化
          
          const sumX = placedItemsBounds.reduce((sum, b) => sum + (b.minX+b.maxX)/2, 0) + cx;
          const sumZ = placedItemsBounds.reduce((sum, b) => sum + (b.minZ+b.maxZ)/2, 0) + cz;
          const cmX = sumX / (placedItemsBounds.length + 1);
          const cmZ = sumZ / (placedItemsBounds.length + 1);
          const distCM = Math.sqrt((cmX - midX)**2 + (cmZ - midZ)**2);
          
          score -= distCM * 2.25; // 配置全体の重心がゾーン中央に寄るようにする (1.5倍強化)
        }

        if (score > bestScore) {
          bestScore = score;
          
          let rotationY = 0;
          let semanticPosition = rule.position?.toLowerCase() || physicalRule?.placement.relation || "center";
          if (semanticPosition.includes("wall")) {
            // 壁向け
            if (Math.abs(cx - minX) < Math.abs(cx - maxX) && Math.abs(cx - minX) < Math.abs(cz - minZ) && Math.abs(cx - minX) < Math.abs(cz - maxZ)) {
              rotationY = 90;
            } else if (Math.abs(cx - maxX) < Math.abs(cx - minX) && Math.abs(cx - maxX) < Math.abs(cz - minZ) && Math.abs(cx - maxX) < Math.abs(cz - maxZ)) {
              rotationY = -90;
            } else if (Math.abs(cz - minZ) < Math.abs(cz - maxZ)) {
              rotationY = 0;
            } else {
              rotationY = 180;
            }
          } else {
            // center / general: 90度単位でランダム
            rotationY = (Math.random() > 0.5) ? 0 : 90;
          }
          
          bestPos = { x: cx, z: cz, rotationY };
        }
      }

      if (bestScore === -Infinity) {
        console.warn(`[AutoLayout] Could not find valid non-overlapping position for ${asset.title}`);
        continue; // 配置をスキップ
      }

      placedItemsBounds.push({
        minX: bestPos.x - assetWM / 2 - collisionMarginM,
        maxX: bestPos.x + assetWM / 2 + collisionMarginM,
        minZ: bestPos.z - assetDM / 2 - collisionMarginM,
        maxZ: bestPos.z + assetDM / 2 + collisionMarginM,
      });

      const entityId = asset.metadata?.sourceModelId || asset.entityId || asset.id;
      const title = asset.metadata?.title || asset.metadata?.name || asset.title || asset.name || "Item";
      const brand = asset.metadata?.brand || asset.metadata?.brandName || "";
      const thumbUrl = asset.metadata?.thumbnail || asset.metadata?.thumbnailUrl || asset.thumbnailUrl || asset.thumbUrl || asset.coverUrl || null;
      const glbUrl = asset.metadata?.glbUrl || asset.metadata?.downloadUrl || asset.glbUrl || asset.modelUrl || null;

      const pItem: PlacementItem = {
        id: `placement_${Date.now()}_${totalGenerated}`,
        zoneId: zoneId,
        entityId: entityId,
        itemRef: asset.itemRef || `assets/${asset.id}`,
        transform: {
          position: { x: bestPos.x, y: gridHeightMm, z: bestPos.z },
          rotation: { x: 0, y: bestPos.rotationY, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        snapshot: { title, brand, thumbnailUrl: thumbUrl, glbUrl },
      };

      results.push(pItem);
      totalGenerated++;
      placedMap.set(rule.targetId, pItem);
    }
  }

  // Second pass: relational positioning (e.g. around table)
  for (const { rule, asset, physicalRule } of enrichedRules) {
    if (!rule.relation || !rule.relation.includes("around")) continue;

    const tokens = rule.relation.split(" ");
    const parentId = tokens[1] || tokens[0];
    const parent = placedMap.get(parentId);

    const cx = parent ? parent.transform.position.x : midX;
    const cz = parent ? parent.transform.position.z : midZ;
    
    const minPassage = Math.max((rule as any).minPassageWidth || 0, physicalRule?.placement.minPassageWidth ?? 800);
    const spacing = physicalRule?.placement.spacingBetweenItems ?? 0;
    
    // 半径を計算 (800mm の引き出しスペース考慮)
    const radiusM = mmToM(Math.max(800, minPassage + (spacing / 2)));
    const safeCount = Math.min(Math.max(1, parseInt(rule.count as any, 10) || 1), 10);

    for (let c = 0; c < safeCount; c++) {
      if (totalGenerated >= maxTotalItems) break;
      if (!asset) continue;

      const entityId = asset.metadata?.sourceModelId || asset.entityId || asset.id;
      const title = asset.metadata?.title || asset.metadata?.name || asset.title || "Item";
      const brand = asset.metadata?.brand || asset.metadata?.brandName || "";
      const thumbUrl = asset.metadata?.thumbnail || asset.metadata?.thumbnailUrl || asset.thumbnailUrl || asset.thumbUrl || asset.coverUrl || null;
      const glbUrl = asset.metadata?.glbUrl || asset.metadata?.downloadUrl || asset.glbUrl || null;

      const angle = (Math.PI * 2 * c) / safeCount;
      let x = cx + radiusM * Math.cos(angle);
      let z = cz + radiusM * Math.sin(angle);

      const relMarginM = mmToM(Math.max((rule as any).marginFromWall || 0, physicalRule?.placement.marginFromWall ?? 400));
      const assetWM = mmToM(asset.extendedMetadata?.dimensions?.width || asset.metadata?.dimensions?.width || 600);
      const assetDM = mmToM(asset.extendedMetadata?.dimensions?.depth || asset.metadata?.dimensions?.depth || 600);
      
      const pRuleMargin = physicalRule?.placement?.distanceFromOther ? mmToM(physicalRule.placement.distanceFromOther) : 0;
      const collisionMarginM = Math.max(mmToM(300), pRuleMargin);

      let validPosition = false;
      let finalX = x;
      let finalZ = z;

      for (let attempt = 0; attempt < 10; attempt++) {
        const randomOffsetX = (Math.random() - 0.5) * mmToM(400);
        const randomOffsetZ = (Math.random() - 0.5) * mmToM(400);

        let testX = Math.max(minX + relMarginM, Math.min(maxX - relMarginM, x + randomOffsetX));
        let testZ = Math.max(minZ + relMarginM, Math.min(maxZ - relMarginM, z + randomOffsetZ));

        const candBounds = {
          minX: testX - assetWM / 2 - collisionMarginM,
          maxX: testX + assetWM / 2 + collisionMarginM,
          minZ: testZ - assetDM / 2 - collisionMarginM,
          maxZ: testZ + assetDM / 2 + collisionMarginM,
        };

        const isOverlap = placedItemsBounds.some(b => 
          candBounds.minX < b.maxX &&
          candBounds.maxX > b.minX &&
          candBounds.minZ < b.maxZ &&
          candBounds.maxZ > b.minZ
        );

        if (!isOverlap) {
          finalX = testX;
          finalZ = testZ;
          validPosition = true;
          break;
        }
      }

      if (!validPosition) continue;

      placedItemsBounds.push({
        minX: finalX - assetWM / 2 - collisionMarginM,
        maxX: finalX + assetWM / 2 + collisionMarginM,
        minZ: finalZ - assetDM / 2 - collisionMarginM,
        maxZ: finalZ + assetDM / 2 + collisionMarginM,
      });

      let rotationY = -angle * (180 / Math.PI) - 90;
      if (rule.facing === "outward") {
        rotationY += 180;
      }

      results.push({
        id: `placement_${Date.now()}_${totalGenerated}`,
        zoneId: zoneId,
        entityId: entityId,
        itemRef: asset.itemRef || `assets/${asset.id}`,
        transform: {
          position: { x: finalX, y: gridHeightMm, z: finalZ },
          rotation: { x: 0, y: rotationY, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        },
        snapshot: { title, brand, thumbnailUrl: thumbUrl, glbUrl },
      });
      totalGenerated++;
    }
  }

  const enrichedItems = results.map(item => {
    const asset = availableAssets.find(a => {
      const eid = a.metadata?.sourceModelId || a.entityId || a.id;
      return eid === item.entityId;
    });

    let resolvedGlbUrl = 
      asset?.glbUrl ||
      asset?.modelUrl ||
      asset?.extendedMetadata?.companionGlbUrl ||
      asset?.companionGlbUrl ||
      null;

    if (!resolvedGlbUrl && asset) {
      resolvedGlbUrl = getDownloadUrlForModel(asset, 'glb') || 
                       (asset.metadata ? getDownloadUrlForModel(asset.metadata, 'glb') : null) || 
                       null;
    }

    return {
      ...item,
      glbUrl: resolvedGlbUrl || null,
      name: asset?.name ?? asset?.title ?? null,
    };
  });

  return enrichedItems;
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

export async function runAutoLayout(
  zoneData: ZoneData,
  obstacles: any[] = [],
  availableAssets: any[] = [],
  gridHeightMm: number = 0,
  context?: AutoLayoutContext
): Promise<{ placements: PlacementItem[]; sessionId: string }> {
  const { bounds, zoneId } = zoneData;
  const widthMm = Math.abs(bounds.maxX - bounds.minX) * 1000;
  const depthMm = Math.abs(bounds.maxZ - bounds.minZ) * 1000;
  const areaSqm = (widthMm * depthMm) / 1000000;

  const storeBuildingType = useAutoLayoutStore.getState().buildingType;
  const zonePurpose = useAutoLayoutStore.getState().zonePurpose ?? 'general';
  
  // 優先順位: 1. Project, 2. Zone, 3. Dialog, 4. Default
  const activeBuildingType: BuildingType = 
    (context?.buildingType as BuildingType) || 
    (zoneData.buildingType as BuildingType) || 
    storeBuildingType || 
    'residential';

  // ZonePurpose from Store
  const activeZonePurpose = zonePurpose;

  // Use LLM zone purpose mapping for AI recommendations if needed, 
  // but let's just pass our ZonePurpose as a string.
  const llmZonePurpose = activeZonePurpose === 'general' ? 'lounge' : activeZonePurpose;
  const targetSeats = Math.max(2, Math.floor(areaSqm / 2)); 

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

  const validAssets = enrichedAssets.length > 0 ? enrichedAssets : MOCK_SETS;
  const assetCatalog = validAssets.map(a => {
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
  const results = calculatePositions(layoutRules, zoneData, validAssets, gridHeightMm, ruleSet);

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
