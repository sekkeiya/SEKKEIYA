// 横断 Gallery の GalleryItem を SiteAssetRef へ変換するヘルパー。
// 仕様: docs/09_project_site_spec.md §3 / §7（Gallery を Site 層の素材ピッカーに昇華）

import type { GalleryItem, GalleryKind, GalleryRef } from '../gallery/galleryTypes';
import type {
  SiteAssetKind, SiteAssetRef, SiteAssetSourceApp, SiteSectionType,
} from '../projects/types';

/** GalleryRef から供給元アプリ・元ドキュメント ID を取り出す。 */
function resolveSource(ref: GalleryRef): { sourceApp: SiteAssetSourceApp; assetId: string } {
  switch (ref.kind) {
    case 'model':  return { sourceApp: '3dss', assetId: ref.assetId };
    case 'layout': return { sourceApp: '3dsl', assetId: ref.layoutId };
    default:       return { sourceApp: ref.appScope as SiteAssetSourceApp, assetId: ref.workFileId };
  }
}

const KIND_TO_ASSET_KIND: Record<GalleryKind, SiteAssetKind> = {
  model:        'embed3d',
  layout:       'render',
  presentation: 'slidedeck',
  furniture:    'image',
  diagram:      'image',
  image:        'image',
  portfolio:    'pdf',
};

/** Gallery の種別 → 既定で割り当てたい section 種別。 */
const KIND_TO_SECTION_TYPE: Record<GalleryKind, SiteSectionType> = {
  model:        'custom',
  layout:       'layout',
  presentation: 'presentation',
  furniture:    'custom',
  diagram:      'diagram',
  image:        'gallery',
  portfolio:    'portfolio',
};

export function suggestedSectionType(kind: GalleryKind): SiteSectionType {
  return KIND_TO_SECTION_TYPE[kind];
}

export function galleryItemToAssetRef(item: GalleryItem): SiteAssetRef {
  const { sourceApp, assetId } = resolveSource(item.ref);
  return {
    id: item.id,
    sourceApp,
    assetId,
    kind: KIND_TO_ASSET_KIND[item.kind],
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
  };
}
