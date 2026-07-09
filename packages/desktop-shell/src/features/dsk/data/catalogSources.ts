// 主要内装仕上げメーカーの電子カタログ／製品サイト プリセット。
// SEKKEIYA Chat の library_add_url や AddEntryDialog のワンクリック登録の元データ。
// ※ 深いカタログURLは変動しやすいため、確実で安定した公式トップ/カタログ入口を採用。

export interface CatalogSource {
  manufacturer: string;
  /** 登録時のタイトル。 */
  title: string;
  url: string;
  /** 取り扱いジャンル（壁紙/床材/タイル等）。 */
  genre: string;
}

export const CATALOG_SOURCES: CatalogSource[] = [
  // 壁紙・クロス系
  { manufacturer: 'サンゲツ',           title: 'サンゲツ 製品・電子カタログ',         url: 'https://www.sangetsu.co.jp/',        genre: '壁紙・床材・ファブリック' },
  { manufacturer: 'リリカラ',           title: 'リリカラ 製品・電子カタログ',         url: 'https://www.lilycolor.co.jp/',       genre: '壁紙・床材・カーテン' },
  { manufacturer: 'シンコール',         title: 'シンコール 製品・電子カタログ',       url: 'https://www.sincol.co.jp/',          genre: '壁紙・床材' },
  { manufacturer: '東リ',               title: '東リ 製品・電子カタログ',             url: 'https://www.toli.co.jp/',            genre: '床材・壁紙' },
  { manufacturer: 'ルノン',             title: 'ルノン 製品・電子カタログ',           url: 'https://www.runon.co.jp/',           genre: '壁紙・機能性壁材' },
  // 床材系
  { manufacturer: '大建工業（DAIKEN）', title: '大建工業 製品・電子カタログ',         url: 'https://www.daiken.jp/',             genre: 'フローリング・建材' },
  { manufacturer: '朝日ウッドテック',   title: '朝日ウッドテック 製品・電子カタログ', url: 'https://www.woodtec.co.jp/',         genre: 'フローリング' },
  { manufacturer: '永大産業（EIDAI）',  title: '永大産業 製品・電子カタログ',         url: 'https://www.eidai.com/',             genre: 'フローリング・建材' },
  // タイル・石材系
  { manufacturer: 'LIXIL（リクシル）',  title: 'LIXIL 製品・電子カタログ',            url: 'https://www.lixil.co.jp/',           genre: 'タイル・建材・住宅設備' },
  { manufacturer: '名古屋モザイク工業', title: '名古屋モザイク工業 製品・電子カタログ', url: 'https://www.nagoya-mosaic.co.jp/',  genre: '輸入タイル' },
  { manufacturer: 'ADVAN（アドヴァン）', title: 'ADVAN 製品・電子カタログ',           url: 'https://www.advan.co.jp/',           genre: 'タイル・石材・建材' },
  // ファブリック（カーテン・張地・カーペット）系
  { manufacturer: '川島織物セルコン',   title: '川島織物セルコン 製品・電子カタログ', url: 'https://kawashimaselkon.co.jp/',     genre: 'カーテン・張地・カーペット' },
  { manufacturer: 'スミノエ',           title: 'スミノエ 製品・電子カタログ',         url: 'https://suminoe.jp/',                genre: 'カーテン・カーペット' },
];
