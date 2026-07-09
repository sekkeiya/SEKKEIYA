// 3Dモデルサムネ（クエリ画像）→ CLIP埋め込み → S.Libraryカタログ索引と最近傍照合。

import { embedImage, cosineSim } from '../../../shared/vision/visionEngine';
import { getAllItems, getAllMeta, countItems, type CatalogVisionItem, type CatalogIndexMeta } from '../../dsk/catalog/catalogVisionStore';

export type { CatalogIndexMeta } from '../../dsk/catalog/catalogVisionStore';

export interface CatalogMatch extends CatalogVisionItem {
  similarity: number; // 0..1（cosine）
}

/** 索引済みアイテム数（0 ならカタログ未索引）。 */
export async function getCatalogIndexCount(): Promise<number> {
  return await countItems();
}

/** 索引済みソース（カタログ/サイト）のメタ一覧。 */
export async function getCatalogSources(): Promise<CatalogIndexMeta[]> {
  return await getAllMeta();
}

/**
 * テキストクエリで索引済み商品を部分一致検索する（家具モードの retrieval 層）。
 * 商品名(label)・ブランド・カタログ名・価格・出典サイトを対象に、語をすべて含むものを返す。
 * 空クエリなら索引の先頭から topN 件（ブラウズ用途）。
 */
export async function searchCatalogByText(
  queryText: string,
  topN = 60,
): Promise<CatalogVisionItem[]> {
  const items = await getAllItems();
  if (!items.length) return [];
  const terms = queryText.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return items.slice(0, topN);
  const hay = (it: CatalogVisionItem) =>
    [it.label, it.brand, it.catalogTitle, it.price, it.siteUrl, it.category, ...(it.tags || [])]
      .filter(Boolean).join(' ').toLowerCase();
  const matched = items.filter((it) => {
    const h = hay(it);
    return terms.every((t) => h.includes(t));
  });
  return matched.slice(0, topN);
}

/**
 * クエリ画像（Blob または URL/dataURL）に近いカタログ商品を類似度順に返す。
 * 索引が空なら空配列。
 */
export async function searchCatalogByImage(
  query: Blob | string,
  topN = 12,
): Promise<CatalogMatch[]> {
  const items = await getAllItems();
  if (!items.length) return [];
  const q = await embedImage(query);
  const scored: CatalogMatch[] = items.map((it) => ({ ...it, similarity: cosineSim(q, it.embedding) }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topN);
}
