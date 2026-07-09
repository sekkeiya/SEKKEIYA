/**
 * smartCategoryEngine
 * ------------------------------------------------------------------
 * ルールベースの自動カテゴライズ中核。
 *  - ファイル名から「ゴミトークン」(Firebaseパス・ランダムID・拡張子など) を除去
 *  - 英日のキーワードを DEFAULT_CATEGORY_MAP の正式な階層 (macro/main/sub) に正しくマッピング
 *
 * 重要: ここで返す macro / main / sub は必ず useUserSettingsStore の
 *       DEFAULT_CATEGORY_MAP に存在する名称と一致させる。
 *       (normalizeAndSanitizeCategory で検証され、一致しないものは破棄されるため)
 */

// ---- マクロカテゴリ定数 (DEFAULT_CATEGORY_MAP のキーと厳密一致) ----
const FURN = '家具 (既製品)';
const EQUIP = '設備・備品';
const GREEN = 'グリーン';
const DECOR = 'インテリア小物';
const ARCH = '建築・空間';
const CHAR = 'キャラクター';

// ---- ノイズ判定 ----------------------------------------------------
// 生成パイプラインやエクスポータが付与する無意味な語。
const STOPWORDS = new Set([
  'users', 'user', 'generated', 'generate', 'generation', 'gen',
  'model', 'models', 'asset', 'assets', 'output', 'outputs',
  'export', 'exports', 'exported', 'tripo', 'tripo3d', 'meshy', 'mesh',
  'scene', 'untitled', 'noname', 'final', 'copy', 'duplicate', 'batchsrc',
  'download', 'downloads', 'file', 'files', 'default', 'new', 'temp', 'tmp',
  'test', 'demo', 'sample', 'result', 'results', 'image', 'images', 'img',
  'render', 'rendered', 'texture', 'baked', 'retopo', 'decimated', 'draft',
  'version', 'rev', 'object', 'group', 'merged', 'combined', 'final2',
  // ローカルパス由来 (C:\Users\<name>\SEKKEIYA\LocalAssets\Images\... 等)
  'ai', 'localassets', 'local', 'sekkeiya', 'images', 'pictures', 'movies',
  'videos', 'documents', 'appdata', 'roaming', 'desktop', 'library',
  // 視点・アングル名 (マルチビュー画像由来の front.png 等。説明ではない)
  'front', 'back', 'rear', 'side', 'top', 'bottom', 'left', 'right',
  'perspective', 'persp', 'view', 'angle', 'iso', 'ortho',
  // 拡張子由来
  'glb', 'gltf', 'fbx', 'obj', 'blend', '3dm', 'skp', 'gh', 'stl', 'usdz',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'webm',
]);

/** 1トークンがノイズ(=タグ・タイトルに使うべきでない)かどうか */
export const isNoiseToken = (raw) => {
  if (!raw) return true;
  const t = String(raw).toLowerCase();
  if (t.length <= 1) return true;
  if (STOPWORDS.has(t)) return true;
  if (/^\d+$/.test(t)) return true; // 純粋な数字 (連番など)
  // 英数字混在の長いトークン = ほぼ確実にID (例: ydmdvqlokyz4vqmlcg1ls2)
  if (t.length >= 10 && /[a-z]/.test(t) && /\d/.test(t)) return true;
  // 16進ハッシュ風
  if (t.length >= 12 && /^[0-9a-f]+$/i.test(t)) return true;
  // 長いASCII連続文字列 = Firebase push id 等のランダム文字列 (例: wdnhhahzqdttxobrdbqc)
  if (/^[a-z0-9]+$/.test(t) && t.length >= 15) return true;
  // 母音が極端に少ない / 子音が5連続する英字列 = ランダムID (例: wdnhhahzqdt)
  if (/^[a-z]+$/.test(t) && t.length >= 8) {
    const vowels = (t.match(/[aeiou]/g) || []).length;
    if (vowels / t.length < 0.25) return true;
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/.test(t)) return true;
  }
  return false;
};

/** トークン配列からノイズを除去 */
export const filterNoiseTokens = (tokens = []) =>
  (tokens || []).filter((t) => !isNoiseToken(t));

/**
 * tokenizeClean
 * ファイル名/フォルダ名から「意味のあるトークン」を抽出する。
 *
 * 手順が重要:
 *  1. まずセパレータ(_ - . / 空白)単位で「セグメント」に分割
 *  2. セグメント全体がノイズ(Firebase ID等)なら丸ごと破棄
 *     ← CamelCase分割で長いIDが短い断片(wdnh/hah)に割れて生き残るのを防ぐ
 *  3. 生き残ったセグメントのみ CamelCase / 数字境界で分割し、再度ノイズ除去
 *
 * @param {string} nameWithExt 元のファイル名(拡張子付きでも可)
 * @returns {string[]} 小文字のクリーンなトークン列
 */
export const tokenizeClean = (nameWithExt = '') => {
  const noExt = String(nameWithExt).replace(/\.(glb|gltf|fbx|obj|3dm|blend|skp|stl|usdz)$/i, '');
  // 英数字・各言語の文字以外(空白/記号/コロン等)はすべて区切り扱い ("C:" → "c")
  const segments = noExt.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const tokens = [];
  for (const seg of segments) {
    if (isNoiseToken(seg.toLowerCase())) continue; // IDセグメントを丸ごと除外
    const parts = seg
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Za-z])(\d)/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    for (const p of parts) {
      if (!isNoiseToken(p)) tokens.push(p);
    }
  }
  return tokens;
};

/**
 * baseNameFor
 * file.name に埋め込まれたローカルフルパスや AI プレフィックスを取り除き、
 * 「そのファイル自身の名前」だけを取り出す。
 * 例: "AI_Model_C:\\Users\\yumat\\SEKKEIYA\\...\\chair\\chair_modern_oak_001.glb"
 *      → "chair_modern_oak_001.glb"
 */
export const baseNameFor = (name = '') => {
  const full = String(name || '');
  // パス区切り(/ \)の最後のセグメント
  const last = full.split(/[\/\\]/).pop() || full;
  // 先頭の "AI_Model_" 系プレフィックスを除去
  return last.replace(/^ai[_\-]?model[_\-]?/i, '').trim() || last;
};

/**
 * meaningfulPathTokens
 * file.name にローカルフルパスが埋め込まれていても、意味のあるトークンだけを集める。
 *  - パス区切り(/ \)でセグメント分割
 *  - "Users"/"User" 直後のセグメント = OSユーザー名 → 丸ごと除外
 *    (パス由来の "yumat" 等がタグ・タイトルに漏れるのを防ぐ)
 *  - 各セグメントを tokenizeClean してノイズ除去、順序を保ってユニーク化
 *
 * フォルダ名(例: chair_modern_oak_001) も意味情報として活用できる。
 * @returns {string[]}
 */
export const meaningfulPathTokens = (name = '') => {
  const segments = String(name || '').split(/[\/\\]/);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < segments.length; i++) {
    const segLower = segments[i].toLowerCase();
    // 直前が users/user のセグメントは OSユーザー名 → スキップ
    const prev = i > 0 ? segments[i - 1].toLowerCase() : '';
    if (prev === 'users' || prev === 'user') continue;
    for (const t of tokenizeClean(segments[i])) {
      if (!seen.has(t)) { seen.add(t); out.push(t); }
    }
    void segLower;
  }
  return out;
};

/** クリーンなトークンから表示タイトルを生成 (ASCIIは先頭大文字化) */
export const buildCleanTitle = (cleanTokens = []) => {
  if (!cleanTokens.length) return '';
  return cleanTokens
    .map((t) => (/^[a-z0-9]+$/.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : t))
    .join(' ')
    .trim();
};

// ---- キーワード → カテゴリ階層マップ -------------------------------
// macro は省略時 FURN 扱い。具体的(長い)キーワードほど優先される(下でlength降順ソート)。
const K = (macro, main, sub) => ({ macro, main, sub: sub || '' });

const SMART_KEYWORDS = [
  // キャラクター -------------------------------------------------
  ['businessman', K(CHAR, '人物', 'ビジネス')],
  ['businesswoman', K(CHAR, '人物', 'ビジネス')],
  ['mannequin', K(CHAR, 'マネキン・トルソー', '全身マネキン')],
  ['torso', K(CHAR, 'マネキン・トルソー', 'トルソー')],
  ['character', K(CHAR, '人物', '')],
  ['avatar', K(CHAR, '人物', '')],
  ['person', K(CHAR, '人物', '')],
  ['people', K(CHAR, '人物', '')],
  ['human', K(CHAR, '人物', '')],
  ['man', K(CHAR, '人物', '成人男性')],
  ['woman', K(CHAR, '人物', '成人女性')],
  ['boy', K(CHAR, '人物', '子供')],
  ['girl', K(CHAR, '人物', '子供')],
  ['child', K(CHAR, '人物', '子供')],
  ['kid', K(CHAR, '人物', '子供')],
  ['baby', K(CHAR, '人物', '幼児')],
  ['キャラクター', K(CHAR, '人物', '')],
  ['キャラ', K(CHAR, '人物', '')],
  ['アバター', K(CHAR, '人物', '')],
  ['人物', K(CHAR, '人物', '')],
  ['人型', K(CHAR, '人物', '')],
  ['男性', K(CHAR, '人物', '成人男性')],
  ['女性', K(CHAR, '人物', '成人女性')],
  ['子供', K(CHAR, '人物', '子供')],
  ['子ども', K(CHAR, '人物', '子供')],
  ['幼児', K(CHAR, '人物', '幼児')],
  ['高齢者', K(CHAR, '人物', '高齢者')],
  ['マネキン', K(CHAR, 'マネキン・トルソー', '全身マネキン')],
  ['トルソー', K(CHAR, 'マネキン・トルソー', 'トルソー')],

  // チェア -------------------------------------------------------
  ['dining chair', K(FURN, 'チェア', 'ダイニングチェア')],
  ['office chair', K(FURN, 'チェア', 'オフィスチェア')],
  ['lounge chair', K(FURN, 'チェア', 'ラウンジチェア')],
  ['gaming chair', K(FURN, 'チェア', 'ゲーミングチェア')],
  ['armchair', K(FURN, 'チェア', 'ラウンジチェア')],
  ['stool', K(FURN, 'チェア', 'スツール')],
  ['bench', K(FURN, 'チェア', 'ベンチ')],
  ['ダイニングチェア', K(FURN, 'チェア', 'ダイニングチェア')],
  ['オフィスチェア', K(FURN, 'チェア', 'オフィスチェア')],
  ['ラウンジチェア', K(FURN, 'チェア', 'ラウンジチェア')],
  ['スツール', K(FURN, 'チェア', 'スツール')],
  ['座椅子', K(FURN, 'チェア', '座椅子')],
  ['chair', K(FURN, 'チェア', '')],
  ['チェア', K(FURN, 'チェア', '')],
  ['椅子', K(FURN, 'チェア', '')],

  // ソファ -------------------------------------------------------
  ['loveseat', K(FURN, 'ソファ', '2人掛けソファ')],
  ['sectional', K(FURN, 'ソファ', 'モジュールソファ')],
  ['ottoman', K(FURN, 'ソファ', 'オットマン')],
  ['couch', K(FURN, 'ソファ', 'カウチソファ')],
  ['sofa', K(FURN, 'ソファ', '')],
  ['ソファ', K(FURN, 'ソファ', '')],
  ['オットマン', K(FURN, 'ソファ', 'オットマン')],

  // テーブル -----------------------------------------------------
  ['dining table', K(FURN, 'テーブル', 'ダイニングテーブル')],
  ['coffee table', K(FURN, 'テーブル', 'コーヒーテーブル')],
  ['side table', K(FURN, 'テーブル', 'サイドテーブル')],
  ['console table', K(FURN, 'テーブル', 'コンソールテーブル')],
  ['meeting table', K(FURN, 'テーブル', '会議テーブル')],
  ['conference table', K(FURN, 'テーブル', '会議テーブル')],
  ['low table', K(FURN, 'テーブル', 'ローテーブル')],
  ['console', K(FURN, 'テーブル', 'コンソールテーブル')],
  ['desk', K(FURN, 'テーブル', 'デスク')],
  ['table', K(FURN, 'テーブル', '')],
  ['ダイニングテーブル', K(FURN, 'テーブル', 'ダイニングテーブル')],
  ['ローテーブル', K(FURN, 'テーブル', 'ローテーブル')],
  ['コーヒーテーブル', K(FURN, 'テーブル', 'コーヒーテーブル')],
  ['デスク', K(FURN, 'テーブル', 'デスク')],
  ['テーブル', K(FURN, 'テーブル', '')],
  ['机', K(FURN, 'テーブル', 'デスク')],

  // 収納・ボード -------------------------------------------------
  ['tv board', K(FURN, '収納・ボード', 'テレビボード')],
  ['tv stand', K(FURN, '収納・ボード', 'テレビボード')],
  ['tv unit', K(FURN, '収納・ボード', 'テレビボード')],
  ['tvboard', K(FURN, '収納・ボード', 'テレビボード')],
  ['bookshelf', K(FURN, '収納・ボード', '本棚')],
  ['bookcase', K(FURN, '収納・ボード', '本棚')],
  ['sideboard', K(FURN, '収納・ボード', 'キャビネット')],
  ['cupboard', K(FURN, '収納・ボード', 'キャビネット')],
  ['cabinet', K(FURN, '収納・ボード', 'キャビネット')],
  ['wardrobe', K(FURN, '収納・ボード', 'ワードローブ')],
  ['closet', K(FURN, '収納・ボード', 'ワードローブ')],
  ['drawer', K(FURN, '収納・ボード', 'チェスト')],
  ['chest', K(FURN, '収納・ボード', 'チェスト')],
  ['shelving', K(FURN, '収納・ボード', 'シェルフ・ラック')],
  ['shelf', K(FURN, '収納・ボード', 'シェルフ・ラック')],
  ['rack', K(FURN, '収納・ボード', 'シェルフ・ラック')],
  ['テレビボード', K(FURN, '収納・ボード', 'テレビボード')],
  ['キャビネット', K(FURN, '収納・ボード', 'キャビネット')],
  ['本棚', K(FURN, '収納・ボード', '本棚')],
  ['収納', K(FURN, '収納・ボード', '')],
  ['棚', K(FURN, '収納・ボード', 'シェルフ・ラック')],

  // ベッド -------------------------------------------------------
  ['bunk bed', K(FURN, 'ベッド', '2段ベッド・ロフト')],
  ['double bed', K(FURN, 'ベッド', 'ダブル')],
  ['single bed', K(FURN, 'ベッド', 'シングル')],
  ['queen bed', K(FURN, 'ベッド', 'クイーン')],
  ['king bed', K(FURN, 'ベッド', 'キング')],
  ['bed', K(FURN, 'ベッド', '')],
  ['ベッド', K(FURN, 'ベッド', '')],
  ['マットレス', K(FURN, 'ベッド', '')],

  // 照明 (設備・備品) -------------------------------------------
  ['pendant light', K(EQUIP, '照明器具', 'ペンダントライト')],
  ['ceiling light', K(EQUIP, '照明器具', 'シーリングライト')],
  ['floor lamp', K(EQUIP, '照明器具', 'フロアスタンド')],
  ['floor light', K(EQUIP, '照明器具', 'フロアスタンド')],
  ['wall light', K(EQUIP, '照明器具', 'ブラケットライト')],
  ['downlight', K(EQUIP, '照明器具', 'ダウンライト')],
  ['spotlight', K(EQUIP, '照明器具', 'スポットライト')],
  ['chandelier', K(EQUIP, '照明器具', 'シャンデリア')],
  ['pendant', K(EQUIP, '照明器具', 'ペンダントライト')],
  ['sconce', K(EQUIP, '照明器具', 'ブラケットライト')],
  ['lamp', K(EQUIP, '照明器具', 'フロアスタンド')],
  ['lighting', K(EQUIP, '照明器具', '')],
  ['light', K(EQUIP, '照明器具', '')],
  ['照明', K(EQUIP, '照明器具', '')],
  ['ペンダントライト', K(EQUIP, '照明器具', 'ペンダントライト')],
  ['シャンデリア', K(EQUIP, '照明器具', 'シャンデリア')],

  // 家電・デバイス (設備・備品) ---------------------------------
  ['washing machine', K(EQUIP, '家電・デバイス', '洗濯機')],
  ['air conditioner', K(EQUIP, '家電・デバイス', 'エアコン')],
  ['refrigerator', K(EQUIP, '家電・デバイス', '冷蔵庫')],
  ['television', K(EQUIP, '家電・デバイス', 'テレビ')],
  ['fridge', K(EQUIP, '家電・デバイス', '冷蔵庫')],
  ['monitor', K(EQUIP, '家電・デバイス', 'PC・モニター')],
  ['speaker', K(EQUIP, '家電・デバイス', 'スピーカー')],
  ['tv', K(EQUIP, '家電・デバイス', 'テレビ')],
  ['冷蔵庫', K(EQUIP, '家電・デバイス', '冷蔵庫')],
  ['テレビ', K(EQUIP, '家電・デバイス', 'テレビ')],
  ['エアコン', K(EQUIP, '家電・デバイス', 'エアコン')],

  // 水回り・住宅設備 (設備・備品) -------------------------------
  ['system kitchen', K(EQUIP, '水回り・住宅設備', 'システムキッチン')],
  ['bathtub', K(EQUIP, '水回り・住宅設備', 'システムバス')],
  ['toilet', K(EQUIP, '水回り・住宅設備', 'トイレ')],
  ['faucet', K(EQUIP, '水回り・住宅設備', '水栓金具')],
  ['kitchen', K(EQUIP, '水回り・住宅設備', 'システムキッチン')],
  ['トイレ', K(EQUIP, '水回り・住宅設備', 'トイレ')],
  ['キッチン', K(EQUIP, '水回り・住宅設備', 'システムキッチン')],

  // グリーン -----------------------------------------------------
  ['観葉植物', K(GREEN, 'インテリアグリーン', '観葉植物（大型）')],
  ['planter', K(GREEN, 'インテリアグリーン', 'プランター・鉢')],
  ['foliage', K(GREEN, 'インテリアグリーン', '')],
  ['greenery', K(GREEN, 'インテリアグリーン', '')],
  ['plant', K(GREEN, 'インテリアグリーン', '')],
  ['tree', K(GREEN, 'インテリアグリーン', '観葉植物（大型）')],
  ['植物', K(GREEN, 'インテリアグリーン', '')],
  ['グリーン', K(GREEN, 'インテリアグリーン', '')],
  ['プランター', K(GREEN, 'インテリアグリーン', 'プランター・鉢')],

  // インテリア小物 ----------------------------------------------
  ['picture frame', K(DECOR, '装飾・アート・趣味', 'アートフレーム・絵画')],
  ['painting', K(DECOR, '装飾・アート・趣味', 'アートフレーム・絵画')],
  ['artwork', K(DECOR, '装飾・アート・趣味', 'アートフレーム・絵画')],
  ['sculpture', K(DECOR, '装飾・アート・趣味', 'オブジェ・彫像')],
  ['vase', K(DECOR, '装飾・アート・趣味', 'オブジェ・彫像')],
  ['clock', K(DECOR, '装飾・アート・趣味', '時計')],
  ['curtain', K(DECOR, 'ファブリック・窓周り', 'カーテン')],
  ['blind', K(DECOR, 'ファブリック・窓周り', 'ブラインド')],
  ['carpet', K(DECOR, 'ファブリック・窓周り', 'ラグ・カーペット')],
  ['cushion', K(DECOR, 'ファブリック・窓周り', 'クッション・ブランケット')],
  ['pillow', K(DECOR, 'ファブリック・窓周り', 'クッション・ブランケット')],
  ['rug', K(DECOR, 'ファブリック・窓周り', 'ラグ・カーペット')],
  ['ラグ', K(DECOR, 'ファブリック・窓周り', 'ラグ・カーペット')],
  ['カーテン', K(DECOR, 'ファブリック・窓周り', 'カーテン')],
  ['時計', K(DECOR, '装飾・アート・趣味', '時計')],

  // 建築・空間 ---------------------------------------------------
  ['curtain wall', K(ARCH, '構造・躯体', '壁')],
  ['staircase', K(ARCH, '構造・躯体', '階段')],
  ['detached house', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['office building', K(ARCH, '建物モデル（全体）', 'オフィスビル')],
  ['sliding door', K(ARCH, '建具（内装・外装）', '引き戸')],
  ['louver', K(ARCH, '構造・躯体', 'ルーバー・格子')],
  ['column', K(ARCH, '構造・躯体', '柱')],
  ['beam', K(ARCH, '構造・躯体', '梁')],
  ['ceiling', K(ARCH, '構造・躯体', '天井')],
  ['roof', K(ARCH, '構造・躯体', '屋根')],
  ['stair', K(ARCH, '構造・躯体', '階段')],
  ['wall', K(ARCH, '構造・躯体', '壁')],
  ['skylight', K(ARCH, '建具（内装・外装）', '天窓')],
  ['door', K(ARCH, '建具（内装・外装）', '片開きドア')],
  ['window', K(ARCH, '建具（内装・外装）', '腰窓')],
  ['carport', K(ARCH, '外構（エクステリア）', 'カーポート・ガレージ')],
  ['garage', K(ARCH, '外構（エクステリア）', 'カーポート・ガレージ')],
  ['terrace', K(ARCH, '外構（エクステリア）', 'テラス・バルコニー')],
  ['balcony', K(ARCH, '外構（エクステリア）', 'テラス・バルコニー')],
  ['pavement', K(ARCH, '外構（エクステリア）', '舗装（ペイビング）')],
  ['fence', K(ARCH, '外構（エクステリア）', 'フェンス・柵')],
  ['gate', K(ARCH, '外構（エクステリア）', '門扉・アプローチ')],
  ['deck', K(ARCH, '外構（エクステリア）', 'ウッドデッキ')],
  ['warehouse', K(ARCH, '建物モデル（全体）', '工場・倉庫')],
  ['factory', K(ARCH, '建物モデル（全体）', '工場・倉庫')],
  ['pavilion', K(ARCH, '建物モデル（全体）', 'パビリオン')],
  ['restaurant', K(ARCH, '建物モデル（全体）', '店舗・レストラン')],
  ['apartment', K(ARCH, '建物モデル（全体）', '集合住宅')],
  ['condominium', K(ARCH, '建物モデル（全体）', '集合住宅')],
  ['residence', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['villa', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['house', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['cafe', K(ARCH, '建物モデル（全体）', '店舗・レストラン')],
  ['引き戸', K(ARCH, '建具（内装・外装）', '引き戸')],
  ['ドア', K(ARCH, '建具（内装・外装）', '片開きドア')],
  ['窓', K(ARCH, '建具（内装・外装）', '腰窓')],
  ['階段', K(ARCH, '構造・躯体', '階段')],
  ['屋根', K(ARCH, '構造・躯体', '屋根')],
  ['壁', K(ARCH, '構造・躯体', '壁')],
  ['住宅', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['戸建', K(ARCH, '建物モデル（全体）', '戸建て住宅')],
  ['マンション', K(ARCH, '建物モデル（全体）', '集合住宅')],
  ['集合住宅', K(ARCH, '建物モデル（全体）', '集合住宅')],
  ['ビル', K(ARCH, '建物モデル（全体）', 'オフィスビル')],
  ['店舗', K(ARCH, '建物モデル（全体）', '店舗・レストラン')],
];

// 具体的なキーワードを優先するため長い順にソート
const SORTED_SMART = [...SMART_KEYWORDS].sort((a, b) => b[0].length - a[0].length);

/**
 * メイン → 代表的なサブカテゴリ (DEFAULT_CATEGORY_MAP に存在する値)。
 * キーワードでサブまで特定できなかったとき、「詳細」欄に妥当な既定値を入れるために使う。
 * ※あくまで既定値。vision AI やユーザーが後から正確な値に上書きできる。
 */
const DEFAULT_SUB_BY_MAIN = {
  'ソファ': '3人掛けソファ',
  'チェア': 'ダイニングチェア',
  'テーブル': 'ダイニングテーブル',
  '収納・ボード': 'シェルフ・ラック',
  'ベッド': 'ダブル',
  '什器・業務用家具': 'その他業務用',
  '照明器具': 'ペンダントライト',
  'インテリアグリーン': '観葉植物（大型）',
  '建具（内装・外装）': '片開きドア',
  '建物モデル（全体）': '戸建て住宅',
};

/**
 * defaultSubFor
 * メインに対する代表サブを返す。mergedCategoryMap が渡されたら、その階層に
 * 実在する場合のみ返す(カスタム分類で存在しないサブを入れないため)。
 * @returns {string} 該当なしは ""
 */
export const defaultSubFor = (macro, main, map = null) => {
  const cand = DEFAULT_SUB_BY_MAIN[main];
  if (!cand) return '';
  if (map) {
    const subs = map?.[macro]?.[main];
    return Array.isArray(subs) && subs.includes(cand) ? cand : '';
  }
  return cand;
};

/**
 * smartClassify
 * @param {string} rawText  小文字化した全文 (フォルダ名 + ファイル名)
 * @param {Set<string>} tokenSet  小文字化したトークン集合 (完全一致照合用)
 * @returns {{macro:string, main:string, sub:string}|null}
 *
 * 照合ルール:
 *  - 複合語(スペース含む) / 日本語 → rawText の部分一致
 *  - 単一ASCII語 → tokenSet の完全一致 ('bed'⊂'embedded' のような誤爆を防ぐ)
 */
export const smartClassify = (rawText = '', tokenSet = new Set()) => {
  const text = (rawText || '').toLowerCase();
  for (const [kw, meta] of SORTED_SMART) {
    const isMulti = kw.includes(' ');
    const isAscii = /^[\x00-\x7f]+$/.test(kw);
    let hit;
    if (isMulti) hit = text.includes(kw);
    else if (isAscii) hit = tokenSet.has(kw);
    else hit = text.includes(kw);
    if (hit) return meta;
  }
  return null;
};
