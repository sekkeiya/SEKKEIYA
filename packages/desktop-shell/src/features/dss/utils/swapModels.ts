/**
 * 家具置き換え（`asset.extendedMetadata.swapModels`）の型と読み出しヘルパー。
 * `DssFurnitureSwap`（編集ロジック本体）と `SwapSection`（閲覧/編集の器）の両方から使うため、
 * コンポーネントファイルではなくここに置く（react-refresh/only-export-components 対策）。
 */
export interface SwapModelRef {
  id: string;
  title?: string;
  thumbUrl?: string | null;
  glbUrl?: string | null;
  /** 差し替え先モデル自身の寸法（mm）。配置時にこの寸法でスケールする。 */
  dimensions?: { width?: number; depth?: number; height?: number } | null;
}

/** `model.extendedMetadata.swapModels` を正規化して読む。 */
export function readSwapModels(model: any): SwapModelRef[] {
  const raw = model?.extendedMetadata?.swapModels;
  if (!Array.isArray(raw)) return [];
  return raw.filter((m: any) => m && m.id).map((m: any) => ({ id: m.id, title: m.title ?? '', thumbUrl: m.thumbUrl ?? null, glbUrl: m.glbUrl ?? null, dimensions: m.dimensions ?? null }));
}
