import { getDownloadUrlForModel } from "../../../dss/utils/modelUtils";

/**
 * 製品解決(Product Resolution)モジュール。
 *
 * 「スロット/配置済みアイテムに、Library の実家具(製品)を束縛する」工程を一箇所に集約する。
 * これまで calculatePositions の各パスと FurnitureSwapDialog.handleApply に
 * 重複していたフィールド抽出の優先順位チェーンを単一の真実とする。
 *
 * Phase 0: 既存挙動を一切変えずに抽出のみ行う（フォールバック順は従来と同一）。
 */

/** ライブラリの緩いアセット形状から正規化した製品記述子 */
export interface ResolvedProduct {
  entityId: string;
  itemRef: string;
  title: string;
  brand: string;
  thumbnailUrl: string | null;
  glbUrl: string | null;
}

/**
 * アセットオブジェクトから製品フィールドを解決する。
 * 優先順位は従来 calculatePositions / FurnitureSwapDialog で使われていたものと同一。
 */
export function resolveProduct(asset: any): ResolvedProduct {
  return {
    entityId: asset?.metadata?.sourceModelId || asset?.entityId || asset?.id,
    itemRef: asset?.itemRef || `assets/${asset?.id}`,
    title:
      asset?.metadata?.title ||
      asset?.metadata?.name ||
      asset?.title ||
      asset?.name ||
      'Item',
    brand: asset?.metadata?.brand || asset?.metadata?.brandName || '',
    thumbnailUrl:
      asset?.metadata?.thumbnail ||
      asset?.metadata?.thumbnailUrl ||
      asset?.thumbnailUrl ||
      asset?.thumbUrl ||
      asset?.coverUrl ||
      null,
    glbUrl:
      asset?.metadata?.glbUrl ||
      asset?.metadata?.downloadUrl ||
      asset?.glbUrl ||
      asset?.modelUrl ||
      null,
  };
}

/**
 * GLB の URL を深く解決する（companion/extendedMetadata と getDownloadUrlForModel を含む）。
 * calculatePositions の最終 enrich パスで使っていたロジックと同一。
 * asset が無い場合は null を返す。
 */
export function resolveGlbUrlDeep(asset: any): string | null {
  if (!asset) return null;
  let url =
    asset.glbUrl ||
    asset.modelUrl ||
    asset.extendedMetadata?.companionGlbUrl ||
    asset.companionGlbUrl ||
    null;
  if (!url) {
    url =
      getDownloadUrlForModel(asset, 'glb') ||
      (asset.metadata ? getDownloadUrlForModel(asset.metadata, 'glb') : null) ||
      null;
  }
  return url;
}
