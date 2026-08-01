/**
 * Model Info パネル（DssRightPanel）の編集フォームの形。
 *
 * このパネルは「編集中の値(editData)」と「保存済みの値(originalData)」を
 * JSON.stringify で丸ごと比較して変更検知する。両者を別々の場所で組み立てていると
 * キーの有無や順序が食い違ったときに常に「変更あり」と判定され、
 * 自動保存が張り付いて 保存 → 選択の書き戻し → 再保存 の無限ループになる
 * （2026-08-01 実機で発生。editData にだけ `type` があったのが原因）。
 * 比較する2つは必ずこの関数から作ること。
 */

export type ModelInfoLink = { title: string; url: string; price?: string; thumbnail?: string; source?: string };

export const parseCatalogLinks = (item: any): ModelInfoLink[] =>
  (Array.isArray(item?.catalogLinks) ? [...item.catalogLinks] : []);

export const parseRelatedLinks = (item: any): ModelInfoLink[] => {
  if (Array.isArray(item?.relatedLinks)) return [...item.relatedLinks];
  const links: ModelInfoLink[] = [];
  if (Array.isArray(item?.sourceUrls)) {
    item.sourceUrls.forEach((url: string) => {
      if (typeof url === 'string') links.push({ title: '関連リンク', url });
    });
  } else if (item?.sourceUrl) {
    links.push({ title: '関連リンク', url: item.sourceUrl });
  }
  return links;
};

const asArray = (v: unknown): any[] => (Array.isArray(v) ? [...v] : []);

export function buildModelInfoForm(item: any) {
  const typeStr = (item?.modelType || item?.type) === 'Architecture' ? 'Architecture' : 'Furniture';
  const isCustom = item?.tags?.includes('造作家具') || item?.readyStatus === 'custom';

  return {
    id: item?.id,
    title: item?.title || item?.name || 'Untitled',
    macroCategory: item?.macroCategory || (typeStr === 'Architecture' ? '建築・空間' : (isCustom ? '家具 (造作)' : '家具 (既製品)')),
    mainCategory: item?.mainCategory || '',
    // Panel の従来仕様: レガシーの userCategory を subCategory より優先する。
    subCategory: item?.userCategory || item?.subCategory || '',
    tags: asArray(item?.tags),
    buildingTypes: asArray(item?.buildingTypes),
    rooms: asArray(item?.rooms),
    zones: asArray(item?.zones),
    companionClasses: asArray(item?.companionClasses),
    materials: asArray(item?.materials),
    width: item?.dimensions?.width?.toString() || '',
    depth: item?.dimensions?.depth?.toString() || '',
    height: item?.dimensions?.height?.toString() || '',
    price: item?.price?.toString() || '',
    relatedLinks: parseRelatedLinks(item),
    catalogLinks: parseCatalogLinks(item),
    companionModels: asArray(item?.companionModels),
    type: item?.type || '',
    visibility: item?.visibility || 'public',
    character: item?.extendedMetadata?.character || null,
    gimmick: item?.extendedMetadata?.gimmick || null,
  };
}
