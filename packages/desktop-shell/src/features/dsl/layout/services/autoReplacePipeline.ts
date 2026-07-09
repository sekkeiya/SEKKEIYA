// autoReplacePipeline.ts
// ③自動家具差し替え: 配置(transform)を固定したまま、各家具を同カテゴリの別アセットへ
// 一括で差し替える。Auto Layout 後に「別パターン／別スタイル」を出すための工程。
//
// 設計上の位置づけ（[[project_slayout_auto_layout_arch]]）:
//   ②配置で確定した位置はそのまま、製品解決(resolveProduct)だけを別candidateで再実行する。
//   手動の FurnitureSwapDialog と同じ「item 形状維持・製品フィールドのみ差し替え」方式を採り、
//   onApplySwap と同一の適用経路（applyLayoutDraft で items 置換）に乗せる。

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../../lib/firebase/client';
import { projectAssetsApi } from '../../../projects/api/projectAssetsApi';
import {
  matchCategoryKey, getCategoryMeta, LAYOUT_CATEGORY_MAP,
} from '../constants/furnitureCategoryDefaults';
import { resolveProduct } from './productResolution';
import { toAffinityFields, substituteScore } from '../../../dss/graph/furnitureAffinity';

/** 差し替え戦略（ボトムギャラリーのスタイルカードに対応） */
export const AUTO_REPLACE_STYLES = {
  variation: { label: 'バリエーション' }, // 同カテゴリからランダムな別案
  compact:   { label: 'コンパクト' },     // フットプリント最小を優先
  spacious:  { label: 'ゆったり' },        // フットプリント最大を優先
} as const;

export type AutoReplaceStyleKey = keyof typeof AUTO_REPLACE_STYLES;

/** アセットから layoutCategory（粗粒度）を解決する。FurnitureSwapDialog と同一ロジック。 */
function getAssetCategory(asset: any): string {
  if (!asset) return 'other';
  const stored =
    asset.layoutCategory ||
    asset.extendedMetadata?.layoutCategory ||
    asset.metadata?.layoutCategory;
  if (stored && LAYOUT_CATEGORY_MAP.has(stored)) return stored;

  const rawCat = (
    asset.extendedMetadata?.mainCategory ||
    asset.extendedMetadata?.category ||
    asset.metadata?.category ||
    asset.category ||
    ''
  ).toLowerCase();
  const rawTitle = (asset.title || asset.metadata?.title || asset.name || '').toLowerCase();

  const fineKey = matchCategoryKey(rawCat, rawTitle);
  if (fineKey) {
    const meta = getCategoryMeta(fineKey);
    if (meta) return meta.layoutCategory;
  }
  return 'other';
}

function getEntityId(asset: any): string {
  if (!asset) return '';
  return asset.metadata?.sourceModelId || asset.entityId || asset.id;
}

type Dims3 = { width: number; depth: number; height: number };

/** 寸法オブジェクト({width,depth,height} か {x,y,z})を正規化。全ゼロ/無効は null。 */
function normDims(d: any): Dims3 | null {
  if (!d) return null;
  const width = Number(d.width ?? d.x) || 0;
  const depth = Number(d.depth ?? d.y) || 0;
  const height = Number(d.height ?? d.z) || 0;
  if (width <= 0 && depth <= 0 && height <= 0) return null;
  return { width, depth, height };
}

/**
 * アセットの寸法(mm)を取り出す。読み順は、ライブラリ配置(LibraryAssetGrid)や
 * モデル差し替え(PropertiesModelPanel)で実績のある正規フィールドを優先。
 * extendedMetadata.dimensions は信頼性が低いため最後の保険のみ。
 */
function assetDimsMm(asset: any): Dims3 | null {
  return normDims(
    asset?.dimensions ||
    asset?.metadata?.dimensions ||
    asset?.dimensionsMm ||
    asset?.extendedMetadata?.dimensions,
  );
}

/**
 * 差し替え先の「正しい実寸」をグローバルアセット（assets/{entityId}）から解決する。
 * ライブラリ配置(LibraryAssetGrid)が使う dimensionsMm / dimensions を正本とするため、
 * 差し替え後もライブラリから普通に配置したときと同じサイズになる。
 * 元アイテムの dimensionsMm には依存しない（過去の不具合で壊れている可能性があるため）。
 */
async function fetchGlobalDims(entityId: string): Promise<Dims3 | null> {
  if (!entityId) return null;
  try {
    const snap = await getDoc(doc(db, 'assets', entityId));
    if (!snap.exists()) return null;
    const d: any = snap.data();
    return normDims(d.dimensionsMm || d.dimensions || d.metadata?.dimensions);
  } catch {
    return null;
  }
}

/** フットプリント(mm²)。dims 不明時は 1000×1000 とみなす。 */
function footprint(asset: any): number {
  const dims = assetDimsMm(asset);
  return (dims?.width || 1000) * (dims?.depth || 1000);
}

/** 戦略に応じて候補から1件選ぶ。candidates は current を除外済み・1件以上を想定。 */
function pickByStyle(candidates: any[], styleKey: AutoReplaceStyleKey): any {
  if (styleKey === 'compact') {
    return candidates.reduce((a, b) => (footprint(b) < footprint(a) ? b : a));
  }
  if (styleKey === 'spacious') {
    return candidates.reduce((a, b) => (footprint(b) > footprint(a) ? b : a));
  }
  // variation: ランダム（実行ごとに別案が出る）
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * 相性（寸法近接＋部屋/ゾーン文脈＋素材整合）で候補を絞ってからスタイルを適用する。
 * furnitureAffinity（可視化グラフと同じ正典 substituteScore）で「元家具に最も近い候補」を上位化し、
 * その上位内でスタイル（compact/spacious/variation）を効かせる。
 * 寸法/文脈/素材のいずれも無く相性が測れない場合は従来の pickByStyle に委譲（＝無回帰）。
 */
function pickByAffinityAndStyle(
  candidates: any[], original: any, styleKey: AutoReplaceStyleKey, stats: { affinity: number },
): any {
  const oaf = toAffinityFields(original);
  let maxS = 0;
  const scored = candidates.map((c) => {
    const s = substituteScore(oaf, toAffinityFields(c));
    if (s > maxS) maxS = s;
    return { c, s };
  });
  if (maxS <= 0) return pickByStyle(candidates, styleKey); // 相性シグナルなし → 従来動作
  stats.affinity++;
  const top = scored.filter((x) => x.s >= maxS - 1e-9).map((x) => x.c);
  return pickByStyle(top, styleKey);
}

export interface AutoReplaceResult {
  ok: boolean;
  updatedItems?: any[];
  replaced: number;
  reason?: string;
}

/**
 * 配置済みアイテムを同カテゴリの別アセットへ一括差し替えする。
 * transform は維持し、製品フィールド（modelId/title/glb/snapshot 等）のみ差し替える。
 */
export async function autoReplaceFurniture(
  styleKey: AutoReplaceStyleKey,
  items: any[],
  projectId: string | null,
): Promise<AutoReplaceResult> {
  if (!items?.length) return { ok: false, replaced: 0, reason: '差し替える家具がありません' };
  if (!projectId) return { ok: false, replaced: 0, reason: 'プロジェクトが特定できません' };

  let pool: any[] = [];
  try {
    pool = await projectAssetsApi.getAssets(projectId);
  } catch (e) {
    console.error('[autoReplace] asset fetch failed', e);
    return { ok: false, replaced: 0, reason: 'ライブラリの取得に失敗しました' };
  }

  // 候補をカテゴリ別にグループ化
  const byCategory = new Map<string, any[]>();
  for (const a of pool) {
    const cat = getAssetCategory(a);
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(a);
  }

  let skippedUnknown = 0;
  const affinityStats = { affinity: 0 };

  // ── 1) 各アイテムの差し替え先(pick)を決める（同期）──────────────────────────
  const plans = items.map(item => {
    const eid = item.modelId || item.assetId || item.entityId;
    if (!eid) return { item };

    // アイテムのカテゴリ: プール内の元アセット優先、無ければアイテムのタイトル等から推定
    const sourceAsset = pool.find(a => getEntityId(a) === eid);
    const probe = sourceAsset ?? { ...item, title: item.title || item.snapshot?.title || item.name };
    const category = getAssetCategory(probe);

    // カテゴリ不明（other）は異種家具（テーブル↔イス等）を取り違える危険があるため差し替えない。
    if (category === 'other') { skippedUnknown++; return { item }; }

    // byCategory は getAssetCategory でグループ済み＝同一カテゴリの候補のみが入っている。
    const candidates = (byCategory.get(category) || []).filter(a => getEntityId(a) !== eid);
    if (candidates.length === 0) return { item }; // 同カテゴリの代替なし → そのまま

    // 相性(寸法+文脈+素材)で上位化 → その中でスタイル適用。probe が元家具の相性フィールド源。
    const pick = pickByAffinityAndStyle(candidates, probe, styleKey, affinityStats);
    const newEid = getEntityId(pick);
    if (!newEid || newEid === eid) return { item };
    return { item, pick, newEid };
  });

  // ── 2) 差し替え先の正しい実寸をグローバルアセットから解決（重複は1回だけ）──
  const dimsCache = new Map<string, Dims3 | null>();
  const uniqueEids = Array.from(new Set(plans.filter(p => p.pick).map(p => p.newEid as string)));
  await Promise.all(uniqueEids.map(async (eid) => {
    dimsCache.set(eid, await fetchGlobalDims(eid));
  }));

  // ── 3) 反映: transform は維持し、製品フィールドと「新家具の実寸」を差し替える ──
  let replaced = 0;
  const updatedItems = plans.map(({ item, pick, newEid }) => {
    if (!pick || !newEid) return item;
    const { title, brand, thumbnailUrl, glbUrl, itemRef } = resolveProduct(pick);
    // 正本(グローバル) → プール内寸法 → 強制せず null(ネイティブ) の順。元アイテム寸法には依存しない。
    const newDims = dimsCache.get(newEid) ?? assetDimsMm(pick) ?? null;
    replaced++;
    return {
      ...item,
      modelId: newEid,
      assetId: newEid,
      entityId: newEid,
      title,
      name: title,
      label: title,
      brand,
      thumbUrl: thumbnailUrl,
      glbUrl,
      itemRef,
      dimensionsMm: newDims,
      snapshot: { title, brand, thumbnailUrl, glbUrl },
    };
  });

  if (skippedUnknown > 0) {
    console.info(`[autoReplace] カテゴリ不明のため ${skippedUnknown} 点は差し替えをスキップ（取り違え防止）`);
  }
  if (affinityStats.affinity > 0) {
    console.info(`[autoReplace] ${affinityStats.affinity} 点を相性(寸法+文脈+素材)で優先選定`);
  }
  return { ok: true, updatedItems, replaced };
}
