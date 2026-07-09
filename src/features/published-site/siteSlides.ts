import type { SiteSection } from './siteTypes';
import { SECTION_META } from './siteMeta';

// セクション列を「スライド」へ変換（ブック / 動画ビュー用）。
// 各セクション = 1 スライド：カバー画像（あれば）＋キッカー＋見出し＋本文。

export interface Slide {
  id: string;
  kicker: string;
  title: string;
  body: string;
  image: string | null;
  section: SiteSection; // リッチ描画（チャート/統計/モデル等）のため元セクションを保持
}

// グラフ・統計・グリッド等、画像 1 枚では表せない「データ系」セクション。
export const DATA_SLIDE_TYPES: SiteSection['type'][] = [
  'profilestats', 'usergenres', 'usermodels', 'target', 'works', 'spec', 'regulation',
];

const firstImage = (s: SiteSection): string | null => {
  const a = (s.assetRefs || []).find(x => x.thumbnailUrl && !x.placeholder);
  return a?.thumbnailUrl || null;
};

export function deriveSlides(sections: SiteSection[], projectName: string): Slide[] {
  return sections
    .filter(s => !s.hidden)
    .map(s => {
      const meta = SECTION_META[s.type];
      const isHero = s.type === 'hero';
      return {
        id: s.id,
        kicker: isHero ? '' : meta.label,
        title: (s.title && s.title.trim()) || (isHero ? projectName : meta.label),
        body: (s.body && s.body.trim()) || '',
        image: firstImage(s),
        section: s,
      };
    });
}
