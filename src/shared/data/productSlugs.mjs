/**
 * productSlugs.mjs — 製品LP（/products/:slug）のスラッグ正典（単一の真実）。
 *
 * marketplaceData.js（メガメニュー / LP / Marketplace）と、node 実行される
 * scripts/prerender.mjs・scripts/generate-sitemap.mjs の両方から import される。
 * node 側はアセット import（.png）を解決できないため、スラッグだけを
 * 純粋 ESM(.mjs) に分離している。製品の追加・改名時はここを更新すれば
 * メニュー / LP / プリレンダ / sitemap がすべて追従する。
 */
export const PRODUCT_SLUGS = {
  "3dss": "s-models",
  "3dsl": "s-layout",
  "3dsc": "s-create",
  "3dsp": "s-presentations",
  "3dsmt": "s-material",
  "3dsd": "s-diagram",
  "3dsr": "s-drawing",
  "3dsi": "s-image",
  "3dsm": "s-movie",
  "3dsq": "s-quest",
  "3dsf": "s-portfolio",
  "3dsk": "s-library",
  "3dsb": "s-blog",
};

/** プリレンダ・sitemap 用のルート一覧（例: "/products/s-layout"） */
export const PRODUCT_ROUTES = Object.values(PRODUCT_SLUGS).map((s) => `/products/${s}`);
