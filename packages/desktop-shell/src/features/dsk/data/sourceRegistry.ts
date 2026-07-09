// SEKKEIYA 公式「ソース・レジストリ」。
// 家具/テクスチャ/イメージ・パース/建材 などタイプ別に厳選ソースを束ね、ユーザーが
// 1クリック（or 一括）で自分の S.Library（Private索引）へ追加できる"レシピ"。
// データ（画像/埋め込み）は配らず、登録先URLと推奨設定だけを配布。索引は各端末で生成する。
// 仕様: docs/16_sekkeiya_search_spec.md
//
// crawlable=true: 追加時にそのまま商品索引化（crawlSiteEntry）まで自動実行。
// crawlable=false: 参照ブックマークとして登録のみ（クロール非対応 or 巡回向きでないサイト）。
// verified=true: 巡回・抽出を実機確認済み（現状 FLYMEe のみ）。それ以外は実験的（精度はサイト次第）。

import { CATALOG_SOURCES } from './catalogSources';

export type SourceKind = 'furniture' | 'texture' | 'render' | 'material';

export interface SourceRegistryEntry {
  id: string;
  site: string;
  genre: string;
  url: string;
  category: string;     // S.Library カテゴリ（ライブラリ・エントリのサイドバー分類）
  tags: string[];
  // 索引商品(CatalogVisionItem)へ付与する S.Models 正典カテゴリ／タグ（useUserSettingsStore.DEFAULT_CATEGORY_MAP）。
  // クロスアプリ（S.Models / Chat）で分類を統一するため。未指定時は category/tags を流用。
  // ※ 検索の種類タブ(SourceKind)は tags の「家具」等で判定するため、家具系は modelTags に種類アンカーを残す。
  modelCategory?: string; // 例 '家具 (既製品)'
  modelTags?: string[];   // 例 ['ソファ','家具']
  crossCategories: boolean; // 推奨巡回スコープ（false=このカテゴリのみ）
  crawlable: boolean;       // 追加時に索引化まで行うか
  verified?: boolean;       // 巡回確認済み
}

export interface SourceRegistryGroup {
  site: string;
  description: string;
  homeUrl: string;
  entries: SourceRegistryEntry[];
}

export interface SourceRegistrySection {
  kind: SourceKind;
  label: string;
  description: string;
  groups: SourceRegistryGroup[];
}

// ── 家具：FLYMEe（カテゴリ別・確認済み） ──
// mCat/mSub は S.Models 正典カテゴリ（DEFAULT_CATEGORY_MAP）に対応。modelTags に「家具」を残し
// 検索の種類タブ(SourceKind=furniture)で拾えるようにする（照明は S.Models 上は設備・備品だが家具タブに含める）。
const FLYMEE_GENRES: { slug: string; genre: string; tags: string[]; mCat: string; mSub: string }[] = [
  { slug: 'sofa',            genre: 'ソファ',               tags: ['ソファ', '家具'],            mCat: '家具 (既製品)', mSub: 'ソファ' },
  { slug: 'chair',           genre: 'チェア・椅子',         tags: ['チェア', '椅子', '家具'],    mCat: '家具 (既製品)', mSub: 'チェア' },
  { slug: 'table',           genre: 'テーブル',             tags: ['テーブル', '家具'],          mCat: '家具 (既製品)', mSub: 'テーブル' },
  { slug: 'desk',            genre: 'デスク・机',           tags: ['デスク', '机', '家具'],      mCat: '家具 (既製品)', mSub: 'テーブル' },
  { slug: 'storage',         genre: '収納家具',             tags: ['収納', '家具'],              mCat: '家具 (既製品)', mSub: '収納・ボード' },
  { slug: 'kitchen-storage', genre: 'キッチン収納・食器棚', tags: ['収納', 'キッチン', '家具'],  mCat: '家具 (既製品)', mSub: '収納・ボード' },
  { slug: 'tv-board',        genre: 'テレビボード',         tags: ['テレビボード', '家具'],      mCat: '家具 (既製品)', mSub: '収納・ボード' },
  { slug: 'coat-rack',       genre: 'ハンガーラック',       tags: ['ハンガーラック', '家具'],    mCat: '家具 (既製品)', mSub: '収納・ボード' },
  { slug: 'lighting',        genre: 'ライト・照明',         tags: ['照明', 'ライト', '家具'],    mCat: '設備・備品',     mSub: '照明器具' },
  { slug: 'bed',             genre: 'ベッド・寝具',         tags: ['ベッド', '寝具', '家具'],    mCat: '家具 (既製品)', mSub: 'ベッド' },
  { slug: 'mirror-dresser',  genre: 'ミラー・ドレッサー',   tags: ['ミラー', 'ドレッサー', '家具'], mCat: '家具 (既製品)', mSub: '収納・ボード' },
  { slug: 'rug',             genre: 'ラグ・カーペット',     tags: ['ラグ', 'カーペット', '家具'], mCat: 'インテリア小物', mSub: 'ファブリック・窓周り' },
];

const FLYMEE_GROUP: SourceRegistryGroup = {
  site: 'FLYMEe',
  description: '国内最大級のデザイナーズ家具・インテリア通販。カテゴリ別に実在商品（購入リンク付き）を視覚索引化できる。',
  homeUrl: 'https://flymee.jp/',
  entries: FLYMEE_GENRES.map((g) => ({
    id: `flymee-${g.slug}`, site: 'FLYMEe', genre: g.genre,
    url: `https://flymee.jp/category/${g.slug}/`, category: '家具・什器', tags: g.tags,
    modelCategory: g.mCat, modelTags: [g.mSub, ...g.tags],
    crossCategories: false, crawlable: true, verified: true,
  })),
};

// ── 家具：その他EC（実験的・サイト全体を巡回して発見） ──
const FURNITURE_SITES: { site: string; url: string; desc: string }[] = [
  { site: 'ACTUS',         url: 'https://www.actus-interior.com/', desc: '上質な国内外ブランド家具・インテリア。' },
  { site: 'unico',         url: 'https://www.unico-fan.co.jp/',    desc: 'ナチュラルで使いやすいオリジナル家具。' },
  { site: 'IDÉE',          url: 'https://www.idee-online.com/',    desc: '感度の高いデザイン家具・雑貨。' },
  { site: 'LOWYA',         url: 'https://www.low-ya.com/',         desc: 'トレンド感のある低価格オンライン家具。' },
  { site: 'Francfranc',    url: 'https://francfranc.com/',         desc: 'カジュアルでデザイン性の高いインテリア。' },
  { site: 'カリモク家具',  url: 'https://www.karimoku.co.jp/',     desc: '国産木製家具の老舗ブランド。' },
  { site: 'Cassina ixc.',  url: 'https://www.cassina-ixc.jp/',     desc: 'ハイエンドなデザイナーズ家具。' },
];

const FURNITURE_OTHER_GROUPS: SourceRegistryGroup[] = FURNITURE_SITES.map((s) => ({
  site: s.site,
  description: s.desc,
  homeUrl: s.url,
  entries: [{
    id: `furn-${s.site}`, site: s.site, genre: '家具全般',
    url: s.url, category: '家具・什器', tags: ['家具', s.site],
    modelCategory: '家具 (既製品)', modelTags: ['家具', s.site],
    crossCategories: true, crawlable: true, verified: false,
  }],
}));

// ── テクスチャ：PBR/素材ライブラリ（参照ブックマーク） ──
const TEXTURE_SITES: { site: string; url: string; desc: string }[] = [
  { site: 'ambientCG',     url: 'https://ambientcg.com/',          desc: '無料のPBRマテリアル/テクスチャ。CC0。' },
  { site: 'Poly Haven',    url: 'https://polyhaven.com/textures',  desc: '高品質な無料テクスチャ/HDRI。' },
  { site: 'cgbookcase',    url: 'https://cgbookcase.com/',         desc: '無料のシームレスPBRテクスチャ。' },
  { site: 'ShareTextures', url: 'https://www.sharetextures.com/',  desc: '無料テクスチャ/3D素材。' },
  { site: 'textures.com',  url: 'https://www.textures.com/',       desc: '膨大なテクスチャ素材ライブラリ。' },
];

const TEXTURE_GROUPS: SourceRegistryGroup[] = TEXTURE_SITES.map((s) => ({
  site: s.site, description: s.desc, homeUrl: s.url,
  entries: [{
    id: `tex-${s.site}`, site: s.site, genre: 'テクスチャ',
    url: s.url, category: '素材・建材', tags: ['テクスチャ', '素材', s.site],
    crossCategories: true, crawlable: false, verified: false,
  }],
}));

// 壁紙屋本舗（Shopify・索引可能）。サンゲツ等ブランドの壁紙/床材を多数扱う実在商品EC。
// 一覧 /collections/<id> はサーバーレンダリングで /products/ 詳細＋画像＋価格を持つ＝確実に索引できる。
const KABEGAMI_CATS: { genre: string; col: string; tags: string[] }[] = [
  { genre: '輸入壁紙',       col: '1128', tags: ['壁紙', '輸入壁紙'] },
  { genre: 'フリース壁紙',   col: '3506', tags: ['壁紙', 'フリース壁紙'] },
  { genre: '国産壁紙(賃貸向け)', col: '2751', tags: ['壁紙', '国産壁紙'] },
  { genre: 'クッションフロア', col: '2765', tags: ['床材', 'クッションフロア'] },
];
const KABEGAMI_GROUP: SourceRegistryGroup = {
  site: '壁紙屋本舗',
  description: 'サンゲツ等ブランドの壁紙・床材を扱う実在商品EC。商品画像つきで索引でき、テクスチャ照合に使える。',
  homeUrl: 'https://www.kabegamiyahonpo.com/',
  entries: KABEGAMI_CATS.map((c) => ({
    id: `kabe-${c.col}`, site: '壁紙屋本舗', genre: c.genre,
    url: `https://www.kabegamiyahonpo.com/collections/${c.col}`,
    category: '素材・建材', tags: ['テクスチャ', '素材', ...c.tags],
    modelCategory: '素材・建材', modelTags: ['テクスチャ', '素材', ...c.tags],
    crossCategories: false, crawlable: true, verified: false,
  })),
};

// 壁紙・床材メーカー（公式サイトは索引不可なため参照ブックマーク）。有名ブランドの一次資料として。
const WALLPAPER_MAKER_NAMES = new Set(['サンゲツ', 'リリカラ', 'シンコール', '東リ']);
const WALLPAPER_MAKER_GROUP: SourceRegistryGroup = {
  site: '壁紙・床材メーカー（公式）',
  description: 'サンゲツ等メーカー公式の電子カタログ。公式サイトは動的生成で自動索引できないため参照登録（実商品の索引は上の「壁紙屋本舗」で）。',
  homeUrl: 'https://www.sangetsu.co.jp/',
  entries: CATALOG_SOURCES.filter((c) => WALLPAPER_MAKER_NAMES.has(c.manufacturer)).map((c) => ({
    id: `wpmaker-${c.manufacturer}`, site: c.manufacturer, genre: c.genre,
    url: c.url, category: '素材・建材', tags: ['テクスチャ', '素材', c.manufacturer],
    crossCategories: true, crawlable: false, verified: false,
  })),
};

// ── イメージ・パース：事例/参考（参照ブックマーク） ──
const RENDER_SITES: { site: string; url: string; desc: string }[] = [
  { site: 'Houzz',     url: 'https://www.houzz.jp/',     desc: '住宅・インテリアの実例写真が豊富。' },
  { site: 'ArchDaily', url: 'https://www.archdaily.com/',desc: '世界の建築事例・写真。' },
  { site: 'Dezeen',    url: 'https://www.dezeen.com/',   desc: '建築・デザインのニュースと事例。' },
  { site: 'Pinterest', url: 'https://www.pinterest.jp/', desc: 'インテリア・パースの参考画像収集。' },
];

const RENDER_GROUPS: SourceRegistryGroup[] = RENDER_SITES.map((s) => ({
  site: s.site, description: s.desc, homeUrl: s.url,
  entries: [{
    id: `ref-${s.site}`, site: s.site, genre: 'イメージ・事例',
    url: s.url, category: '意匠', tags: ['事例', 'パース', s.site],
    crossCategories: true, crawlable: false, verified: false,
  }],
}));

// ── 建材・仕上げ：既存の電子カタログ・プリセットを再利用（参照ブックマーク） ──
const MATERIAL_GROUP: SourceRegistryGroup = {
  site: '建材・仕上げメーカー',
  description: '壁紙・床材・タイル等の主要メーカー電子カタログ。製品・仕上げの一次資料として登録。',
  homeUrl: 'https://www.sangetsu.co.jp/',
  entries: CATALOG_SOURCES.filter((c) => !WALLPAPER_MAKER_NAMES.has(c.manufacturer)).map((c) => ({
    id: `mat-${c.manufacturer}`, site: c.manufacturer, genre: c.genre,
    url: c.url, category: '素材・建材', tags: [c.genre, c.manufacturer],
    crossCategories: true, crawlable: false, verified: false,
  })),
};

export const SOURCE_SECTIONS: SourceRegistrySection[] = [
  {
    kind: 'furniture',
    label: '家具',
    description: '実在商品を視覚索引化して、家具検索・S.Models 照合に使えます。',
    groups: [FLYMEE_GROUP, ...FURNITURE_OTHER_GROUPS],
  },
  {
    kind: 'texture',
    label: 'テクスチャ・素材',
    description: '壁紙・床材など実商品ECの索引（壁紙屋本舗＝サンゲツ等ブランド）＋ PBR素材ライブラリ／メーカー公式（参照）。',
    groups: [KABEGAMI_GROUP, WALLPAPER_MAKER_GROUP, ...TEXTURE_GROUPS],
  },
  {
    kind: 'render',
    label: 'イメージ・パース',
    description: '内観・建築事例の参考。ムードや構図の引き出しとして登録。',
    groups: RENDER_GROUPS,
  },
  {
    kind: 'material',
    label: '建材・仕上げ',
    description: '壁紙・床材・タイル等メーカーの電子カタログ。',
    groups: [MATERIAL_GROUP],
  },
];

/** 全エントリ（一括追加用）。 */
export const ALL_SOURCE_ENTRIES: SourceRegistryEntry[] =
  SOURCE_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.entries));

// ── 絞り込み・並び替え ──
export type SourceStatus = 'verified' | 'experimental' | 'reference';

export function entryStatus(e: SourceRegistryEntry): SourceStatus {
  return e.verified ? 'verified' : e.crawlable ? 'experimental' : 'reference';
}

export const STATUS_LABEL: Record<SourceStatus, string> = {
  verified: '確認済', experimental: '実験的', reference: '参照',
};

export const KIND_COLOR: Record<SourceKind, string> = {
  furniture: '#7dd3fc', texture: '#c4b5fd', render: '#fca5a5', material: '#86efac',
};

// ── SEKKEIYA SEARCH 商品モードのタブ定義 ──
// ラベルは SOURCE_SECTIONS（＝S.Library と同じ正典）から生成し、両者のドリフトを防ぐ。
// 商品索引(catalogVisionStore)は category と tags しか持たないため、種類判定は
// category（S.Library カテゴリ）＋ tags のヒューリスティックで行う。
export const PRODUCT_SEARCH_MODES: { kind: SourceKind; label: string }[] =
  SOURCE_SECTIONS.map((s) => ({ kind: s.kind, label: s.label }));

/**
 * 索引済み商品が、ある種類(SourceKind)に属するかの推定。
 * texture と material はどちらも category='素材・建材' のため、tags で切り分ける
 * （texture は「テクスチャ/素材/PBR」タグ、material はそれ以外の建材・仕上げカタログ）。
 */
export function catalogItemMatchesKind(
  item: { category?: string | null; tags?: string[] | null },
  kind: SourceKind,
): boolean {
  const cat = item.category ?? '';
  const tags = (item.tags ?? []).map((t) => t.toLowerCase());
  const hasTag = (...ks: string[]) => ks.some((k) => tags.some((t) => t.includes(k.toLowerCase())));
  // 分類情報を持たないレガシー索引（category/tags 追加前に索引化された商品）は家具として扱う。
  // ※ 現状クロール対象＝家具のみのため、未分類の索引商品は実質すべて家具。
  const unclassified = !cat && tags.length === 0;
  switch (kind) {
    case 'furniture': return cat.startsWith('家具') || hasTag('家具') || unclassified;
    case 'texture':   return (hasTag('テクスチャ', 'texture', 'pbr', '素材')) && !hasTag('家具');
    case 'material':  return cat === '素材・建材' && !hasTag('テクスチャ', 'texture', 'pbr');
    case 'render':    return cat === '意匠' || hasTag('パース', '事例', 'render');
    default:          return true;
  }
}

export type RegistrySort = 'default' | 'name' | 'status';

export interface RegistryFilter {
  kinds: SourceKind[];      // 空=すべて
  statuses: SourceStatus[]; // 空=すべて
  added: 'all' | 'added' | 'notAdded';
  search: string;
  sort: RegistrySort;
}

export const DEFAULT_REGISTRY_FILTER: RegistryFilter = {
  kinds: [], statuses: [], added: 'all', search: '', sort: 'default',
};

const STATUS_ORDER: Record<SourceStatus, number> = { verified: 0, experimental: 1, reference: 2 };

/** エントリにフィルタ＋並び替えを適用（added 判定は isAdded で外部委譲）。 */
export function applyFilter(
  list: SourceRegistryEntry[],
  filter: RegistryFilter,
  isAdded: (e: SourceRegistryEntry) => boolean,
): SourceRegistryEntry[] {
  const q = filter.search.trim().toLowerCase();
  let out = list.filter((e) => {
    if (filter.statuses.length && !filter.statuses.includes(entryStatus(e))) return false;
    if (filter.added === 'added' && !isAdded(e)) return false;
    if (filter.added === 'notAdded' && isAdded(e)) return false;
    if (q) {
      const hay = `${e.site} ${e.genre} ${e.url} ${e.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  if (filter.sort === 'name') out = [...out].sort((a, b) => `${a.site} ${a.genre}`.localeCompare(`${b.site} ${b.genre}`, 'ja'));
  else if (filter.sort === 'status') out = [...out].sort((a, b) => STATUS_ORDER[entryStatus(a)] - STATUS_ORDER[entryStatus(b)]);
  return out;
}
