/**
 * 内装/外装 仕上げ材の「種別正典」。日本の実務分類を参考にした汎用カテゴリ。
 *  - メーカー名・品番はデータに含めない（権利配慮）。種別と部位の枠組みのみ。
 *  - 自動マテリアル付与のキーワード照合、S.Material 登録の種別プリセット、
 *    スターターカタログ生成で共有する。
 */
import type { MaterialApplication, DsmtCategory } from "../types";

export interface FinishSubtype {
  /** 安定キー */
  key: string;
  /** 表示名（タグにも使う実務語） */
  label: string;
  /** 適合部位（複数可） */
  applications: MaterialApplication[];
  /** 既定の素材ジャンル（単色プレースホルダ生成時の category） */
  category: DsmtCategory;
  /** リゾルバ/検索の照合キーワード（label は自動で含める） */
  keywords: string[];
}

export const FINISH_SUBTYPES: FinishSubtype[] = [
  // ── 床 ──
  { key: "flooring_solid",   label: "無垢フローリング",   applications: ["floor"],               category: "wood",  keywords: ["無垢", "フローリング", "オーク", "oak", "ウォールナット", "walnut"] },
  { key: "flooring_eng",     label: "複合フローリング",   applications: ["floor"],               category: "wood",  keywords: ["複合フローリング", "突板", "フローリング"] },
  { key: "tile_carpet",      label: "タイルカーペット",   applications: ["floor"],               category: "fabric", keywords: ["タイルカーペット", "カーペット", "carpet"] },
  { key: "vinyl_sheet",      label: "長尺塩ビシート",     applications: ["floor"],               category: "plastic", keywords: ["長尺", "塩ビ", "ビニル床シート", "vinyl", "シート"] },
  { key: "floor_tile_pvc",   label: "フロアタイル(塩ビ)", applications: ["floor"],               category: "plastic", keywords: ["フロアタイル", "pタイル", "塩ビタイル", "lvt"] },
  { key: "porcelain_tile",   label: "磁器質タイル",       applications: ["floor", "inner_wall"], category: "stone", keywords: ["磁器質タイル", "タイル", "porcelain", "ポリッシュ"] },
  { key: "mosaic_tile",      label: "モザイクタイル",     applications: ["inner_wall", "floor"], category: "stone", keywords: ["モザイクタイル", "モザイク", "mosaic"] },

  // ── 内壁 / 天井 ──
  { key: "vinyl_cloth",      label: "ビニルクロス(量産)", applications: ["inner_wall", "ceiling"], category: "paint", keywords: ["量産クロス", "クロス", "ビニルクロス", "壁紙", "wallpaper"] },
  { key: "woven_cloth",      label: "織物調クロス",       applications: ["inner_wall", "ceiling"], category: "fabric", keywords: ["織物調", "織物", "クロス", "壁紙"] },
  { key: "plaster",          label: "塗り壁(珪藻土/漆喰)", applications: ["inner_wall", "ceiling"], category: "paint", keywords: ["塗り壁", "珪藻土", "漆喰", "プラスター", "plaster", "左官"] },
  { key: "deco_tile",        label: "装飾タイル(調湿)",   applications: ["inner_wall"],            category: "stone", keywords: ["調湿タイル", "装飾タイル", "エコカラット", "タイル"] },
  { key: "wood_panel",       label: "木質パネル/羽目板",  applications: ["inner_wall", "ceiling"], category: "wood",  keywords: ["木質パネル", "羽目板", "板張り", "ルーバー"] },
  { key: "ceiling_board",    label: "化粧石膏ボード",     applications: ["ceiling"],               category: "paint", keywords: ["化粧石膏", "岩綿", "ジプトーン", "天井板"] },

  // ── 外壁 ──
  { key: "siding_ceramic",   label: "窯業系サイディング", applications: ["outer_wall"],            category: "stone", keywords: ["窯業系サイディング", "サイディング", "siding"] },
  { key: "siding_metal",     label: "金属サイディング(ガルバ)", applications: ["outer_wall"],      category: "metal", keywords: ["金属サイディング", "ガルバ", "galvalume", "metal", "板金"] },
  { key: "exterior_plaster", label: "塗り壁(外装)",       applications: ["outer_wall"],            category: "stone", keywords: ["塗り壁", "左官", "吹付", "ジョリパット"] },
  { key: "exterior_tile",    label: "外装タイル",         applications: ["outer_wall"],            category: "stone", keywords: ["外装タイル", "タイル"] },
];

export const FINISH_SUBTYPES_BY_APP: Record<MaterialApplication, FinishSubtype[]> = {
  floor: FINISH_SUBTYPES.filter((s) => s.applications.includes("floor")),
  inner_wall: FINISH_SUBTYPES.filter((s) => s.applications.includes("inner_wall")),
  outer_wall: FINISH_SUBTYPES.filter((s) => s.applications.includes("outer_wall")),
  ceiling: FINISH_SUBTYPES.filter((s) => s.applications.includes("ceiling")),
};

/**
 * 「同じ素材を探す」遷移先候補（メーカー）。名称のみ保持し、リンクは素材名で
 * 各社を探すための検索URLを動的生成する（品番・直URLはデータに焼き込まない）。
 */
export const MAKER_REFERENCES: string[] = [
  "サンゲツ", "リリカラ", "シンコール", "東リ",
  "大建工業", "朝日ウッドテック", "永大産業",
  "LIXIL", "名古屋モザイク工業", "マナトレーディング",
];

/** メーカー名＋素材名から「探す」検索URLを生成する。 */
export function makerSearchUrl(maker: string, materialTitle?: string): string {
  const q = [maker, materialTitle].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
