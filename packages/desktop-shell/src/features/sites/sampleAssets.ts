// テンプレ用のサンプル素材（建築・インテリアのストック写真／動画）。
// 「素材が無い所に仮で入れて完成像を確認する」ためのもの。公開時は実素材へ差し替える想定。
// すべて到達確認済みの安定 URL（Unsplash CDN / MDN CC0 動画）。

import type { SiteAssetRef, SiteSectionType } from '../projects/types';

const U = (id: string, w = 1400) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

// 外観・建築
const EXTERIOR = [
  '1503387762-592deb58ef4e', '1487958449943-2429e8be8625', '1449824913935-59a10b8d2000',
  '1518005020951-eccb494ad742', '1486406146926-c627a92ad1ab', '1567767292278-a4f21aa2d36e',
  '1564013799919-ab600027ffc6', '1416331108676-a22ccb276e35',
];
// インテリア
const INTERIOR = [
  '1460472178825-e5240623afd5', '1493809842364-78817add7ffb', '1505691938895-1758d7feb511',
  '1484154218962-a197022b5858', '1600585154340-be6161a56a0c', '1600607687939-ce8a6c25118c',
  '1600566753086-00f18fb6b3ea', '1600210492486-724fe5c67fb0',
];

const SAMPLE_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const POOL: Record<SiteSectionType, string[]> = {
  hero: [...EXTERIOR, ...INTERIOR],
  layout: [...EXTERIOR, ...INTERIOR],
  gallery: [...INTERIOR, ...EXTERIOR],
  drawing: EXTERIOR,
  diagram: EXTERIOR,
  presentation: INTERIOR,
  portfolio: [...INTERIOR, ...EXTERIOR],
  walkthrough: INTERIOR,
  overview: [],
  custom: [],
};

function hashSalt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function sampleImageRefs(type: SiteSectionType, n: number, salt: string): SiteAssetRef[] {
  const pool = POOL[type]?.length ? POOL[type] : [...EXTERIOR, ...INTERIOR];
  const start = hashSalt(salt) % pool.length;
  return Array.from({ length: n }, (_, i) => {
    const id = pool[(start + i) % pool.length];
    return { id: `sample:${salt}:${i}`, sourceApp: '3dsi', assetId: '', kind: 'image', sample: true, thumbnailUrl: U(id) };
  });
}

export function sampleHeroRef(salt: string): SiteAssetRef {
  const id = EXTERIOR[hashSalt(salt) % EXTERIOR.length];
  return { id: `sample-hero:${salt}`, sourceApp: '3dsi', assetId: '', kind: 'image', sample: true, thumbnailUrl: U(id, 1900) };
}

export function sampleVideoRef(salt: string): SiteAssetRef {
  const poster = U(INTERIOR[hashSalt(salt) % INTERIOR.length]);
  return { id: `sample-vid:${salt}`, sourceApp: '3dsi', assetId: '', kind: 'video', sample: true, thumbnailUrl: poster, videoUrl: SAMPLE_VIDEO };
}

/** セクション種別に応じてサンプル素材を生成（walkthrough は動画、その他は画像）。 */
export function sampleFill(type: SiteSectionType, n: number, salt: string): SiteAssetRef[] {
  if (type === 'walkthrough') return [sampleVideoRef(salt)];
  return sampleImageRefs(type, n, salt);
}

/** SEKKEIYA 提供のテンプレート素材ライブラリ（素材ピッカー用）。 */
export function sampleLibraryRefs(): SiteAssetRef[] {
  const ids = [...EXTERIOR, ...INTERIOR];
  return ids.map((id, i) => ({
    id: `samplelib:${i}`, sourceApp: '3dsi', assetId: '', kind: 'image',
    sample: true, thumbnailUrl: U(id),
  }));
}
