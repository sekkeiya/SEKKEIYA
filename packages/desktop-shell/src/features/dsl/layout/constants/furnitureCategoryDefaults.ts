/**
 * furnitureCategoryDefaults.ts
 * カテゴリキー定義 + プレースホルダー寸法テーブル
 *
 * key          : Firestore のドキュメント ID / ストアのキー（細粒度）
 * label        : UI 表示名（日本語）
 * group        : 一覧でのグループ見出し
 * layoutCategory : autoLayoutService / ルールエンジンが参照する粗粒度カテゴリ
 *                  → LAYOUT_CATEGORIES の key と対応させること
 * aliases      : matchCategoryKey() が認識する追加キーワード
 * icon         : 絵文字アイコン（UI表示用）
 * widthMm / depthMm / heightMm : デフォルト家具未設定時のプレースホルダー寸法
 */

// ─── 粗粒度カテゴリ（ルールエンジン・置き換え検索の単位） ────────────────────────

export interface LayoutCategoryMeta {
  key: string;         // layoutCategory 値（英語スネークケース）
  label: string;       // 日本語表示名
  group: string;       // 選択UI でのグループ
  icon: string;        // 絵文字
  description: string; // 用途説明（ツールチップ等に使用）
}

export const LAYOUT_CATEGORIES: LayoutCategoryMeta[] = [
  // ── シーティング ─────────────────────────────────────────────────────────
  { key: 'sofa',         label: 'ソファ',               group: 'シーティング', icon: '🛋️', description: 'ソファ全般。壁際に配置し、正面にコーヒーテーブルを置く' },
  { key: 'chair',        label: 'チェア・椅子',          group: 'シーティング', icon: '🪑', description: 'ダイニング・ラウンジ・オフィスチェア全般' },
  { key: 'bar_stool',    label: 'バースツール',          group: 'シーティング', icon: '🍺', description: 'カウンター・ハイテーブル専用。座面高 680〜800mm' },
  // ── ベッド・就寝 ──────────────────────────────────────────────────────────
  { key: 'bed',          label: 'ベッド',               group: 'ベッド・就寝', icon: '🛏️', description: 'ベッド全般。ヘッドボード壁付け配置が基本' },
  { key: 'night_table',  label: 'ナイトテーブル',        group: 'ベッド・就寝', icon: '🕯️', description: 'ベッドサイドに配置する小型テーブル（単体／両サイド）' },
  // ── テーブル ──────────────────────────────────────────────────────────────
  { key: 'dining_table', label: 'ダイニングテーブル',    group: 'テーブル', icon: '🍽️', description: '食卓用テーブル。周囲にチェアを自動配置' },
  { key: 'coffee_table', label: 'コーヒー・ローテーブル', group: 'テーブル', icon: '☕', description: 'リビング用の低いテーブル。ソファ正面に配置' },
  { key: 'side_table',   label: 'サイドテーブル',        group: 'テーブル', icon: '🪴', description: 'ソファ・ベッド横に置く補助テーブル' },
  { key: 'desk',         label: 'デスク・ワークテーブル', group: 'テーブル', icon: '💻', description: '作業用デスク。壁面付け・チェアとセットで配置' },
  { key: 'table',        label: 'テーブル（汎用）',       group: 'テーブル', icon: '📐', description: '会議テーブル・カフェテーブル・ハイテーブル等' },
  // ── 収納 ──────────────────────────────────────────────────────────────────
  { key: 'cabinet',      label: 'キャビネット・収納',    group: '収納', icon: '🗄️', description: 'キャビネット・ワードローブ・ドレッサー等。壁際配置' },
  { key: 'shelf',        label: 'シェルフ・ラック',      group: '収納', icon: '📚', description: '本棚・陳列棚・オープンラック等。壁際配置' },
  // ── 什器 ──────────────────────────────────────────────────────────────────
  { key: 'counter',      label: 'カウンター',            group: '什器', icon: '🏪', description: 'レジカウンター・バーカウンター等。壁際または区画中央' },
  { key: 'partition',    label: 'パーテーション・間仕切り', group: '什器', icon: '🔲', description: 'ゾーンの仕切り。ライン沿い配置' },
  // ── デコレーション ────────────────────────────────────────────────────────
  { key: 'plant',        label: '植物・グリーン',        group: 'デコレーション', icon: '🌿', description: '観葉植物。コーナー・壁際に配置' },
  { key: 'rug',          label: 'ラグ・カーペット',      group: 'デコレーション', icon: '🟫', description: '床ラグ。ゾーン中央に平置き' },
  { key: 'lamp',         label: '照明器具',             group: 'デコレーション', icon: '💡', description: 'フロアスタンド・テーブルランプ等' },
  // ── その他 ────────────────────────────────────────────────────────────────
  { key: 'other',        label: 'その他',               group: 'その他', icon: '📦', description: '上記カテゴリに分類されないアイテム' },
];

/** layoutCategory キー → LayoutCategoryMeta のマップ */
export const LAYOUT_CATEGORY_MAP = new Map<string, LayoutCategoryMeta>(
  LAYOUT_CATEGORIES.map(c => [c.key, c])
);

/** layoutCategory キーの日本語ラベルを返す（未知のキーはそのまま返す） */
export function getLayoutCategoryLabel(key: string): string {
  return LAYOUT_CATEGORY_MAP.get(key)?.label ?? key;
}

/** layoutCategory キーのアイコン絵文字を返す */
export function getLayoutCategoryIcon(key: string): string {
  return LAYOUT_CATEGORY_MAP.get(key)?.icon ?? '📦';
}

// ─── 細粒度カテゴリ（デフォルト家具設定・セット管理の単位） ────────────────────

export interface FurnitureCategoryMeta {
  key: string;
  label: string;
  group: string;
  layoutCategory: string;  // → LAYOUT_CATEGORIES.key と一致させること
  aliases: string[];       // matchCategoryKey() が認識する追加キーワード（英日混在可）
  icon: string;            // 絵文字（グループのものを継承してよい）
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export const FURNITURE_CATEGORIES: FurnitureCategoryMeta[] = [
  // ── ソファ ────────────────────────────────────────────────────────────────
  { key: 'sofa_1seat',    label: '1人掛けソファ',    group: 'ソファ',     layoutCategory: 'sofa',
    aliases: ['1seat', '1人掛け', 'one seat', 'single sofa', '1p sofa'],
    icon: '🛋️', widthMm: 800,  depthMm: 850,  heightMm: 750 },
  { key: 'sofa_2seat',    label: '2人掛けソファ',    group: 'ソファ',     layoutCategory: 'sofa',
    aliases: ['2seat', '2人掛け', 'two seat', 'loveseat', '2p sofa'],
    icon: '🛋️', widthMm: 1500, depthMm: 850,  heightMm: 750 },
  { key: 'sofa_3seat',    label: '3人掛けソファ',    group: 'ソファ',     layoutCategory: 'sofa',
    aliases: ['3seat', '3人掛け', 'three seat', '3p sofa'],
    icon: '🛋️', widthMm: 2200, depthMm: 850,  heightMm: 750 },
  { key: 'sofa_couch',    label: 'カウチソファ',      group: 'ソファ',     layoutCategory: 'sofa',
    aliases: ['couch', 'sectional', 'l-shape', 'l字', 'コーナーソファ'],
    icon: '🛋️', widthMm: 2400, depthMm: 1500, heightMm: 750 },
  { key: 'ottoman',       label: 'オットマン',        group: 'ソファ',     layoutCategory: 'sofa',
    aliases: ['footstool', 'foot rest', 'フットスツール'],
    icon: '🪑', widthMm: 600,  depthMm: 600,  heightMm: 420 },

  // ── チェア ────────────────────────────────────────────────────────────────
  { key: 'armchair',      label: 'アームチェア',      group: 'チェア',     layoutCategory: 'chair',
    aliases: ['arm chair', 'accent chair', '肘掛け椅子', 'アクセントチェア', 'easy chair'],
    icon: '🪑', widthMm: 820,  depthMm: 820,  heightMm: 900 },
  { key: 'chair_dining',  label: 'ダイニングチェア',  group: 'チェア',     layoutCategory: 'chair',
    aliases: ['dining chair', '食卓椅子', 'side chair'],
    icon: '🪑', widthMm: 450,  depthMm: 500,  heightMm: 800 },
  { key: 'chair_lounge',  label: 'ラウンジチェア',    group: 'チェア',     layoutCategory: 'chair',
    aliases: ['lounge chair', 'relax chair', '読書椅子', 'リクライナー', 'recliner'],
    icon: '🪑', widthMm: 750,  depthMm: 800,  heightMm: 900 },
  { key: 'chair_office',  label: 'オフィスチェア',    group: 'チェア',     layoutCategory: 'chair',
    aliases: ['office chair', 'task chair', 'desk chair', 'ゲーミングチェア', 'gaming chair', 'ergonomic'],
    icon: '🪑', widthMm: 650,  depthMm: 650,  heightMm: 1100 },
  { key: 'stool',         label: 'スツール',          group: 'チェア',     layoutCategory: 'chair',
    aliases: ['丸椅子', 'ミルク缶スツール'],
    icon: '🪑', widthMm: 380,  depthMm: 380,  heightMm: 460 },
  { key: 'bar_stool',     label: 'バースツール',      group: 'チェア',     layoutCategory: 'bar_stool',
    aliases: ['counter stool', 'high stool', 'ハイスツール', 'カウンターチェア', 'counter chair'],
    icon: '🍺', widthMm: 380,  depthMm: 380,  heightMm: 750 },
  { key: 'bench',         label: 'ベンチ',            group: 'チェア',     layoutCategory: 'chair',
    aliases: ['long bench', '長椅子', 'hall bench'],
    icon: '🪑', widthMm: 1200, depthMm: 400,  heightMm: 450 },

  // ── テーブル ──────────────────────────────────────────────────────────────
  { key: 'table_dining',  label: 'ダイニングテーブル', group: 'テーブル',  layoutCategory: 'dining_table',
    aliases: ['dining table', '食卓', 'kitchen table', 'eettafel'],
    icon: '🍽️', widthMm: 1400, depthMm: 800,  heightMm: 720 },
  { key: 'table_low',     label: 'ローテーブル',      group: 'テーブル',   layoutCategory: 'coffee_table',
    aliases: ['low table', 'center table', 'センターテーブル', '座卓'],
    icon: '☕', widthMm: 1200, depthMm: 600,  heightMm: 400 },
  { key: 'table_coffee',  label: 'コーヒーテーブル',  group: 'テーブル',   layoutCategory: 'coffee_table',
    aliases: ['coffee table', 'cocktail table'],
    icon: '☕', widthMm: 900,  depthMm: 500,  heightMm: 450 },
  { key: 'table_side',    label: 'サイドテーブル',    group: 'テーブル',   layoutCategory: 'side_table',
    aliases: ['side table', 'end table', 'エンドテーブル'],
    icon: '🪴', widthMm: 450,  depthMm: 450,  heightMm: 550 },
  { key: 'console_table', label: 'コンソールテーブル', group: 'テーブル',  layoutCategory: 'side_table',
    aliases: ['console table', 'hall table', 'foyer table', 'エントランステーブル', 'ホールテーブル'],
    icon: '🪴', widthMm: 1200, depthMm: 350,  heightMm: 800 },
  { key: 'desk',          label: 'デスク',            group: 'テーブル',   layoutCategory: 'desk',
    aliases: ['writing desk', 'work desk', '勉強机', '書斎机', 'standing desk', 'スタンディングデスク'],
    icon: '💻', widthMm: 1200, depthMm: 600,  heightMm: 720 },
  { key: 'table_meeting', label: '会議テーブル',      group: 'テーブル',   layoutCategory: 'table',
    aliases: ['meeting table', 'conference table', '会議机', 'boardroom table'],
    icon: '📐', widthMm: 2400, depthMm: 1000, heightMm: 720 },
  { key: 'table_bar',     label: 'バーテーブル',      group: 'テーブル',   layoutCategory: 'table',
    aliases: ['bar table', 'high table', 'ハイテーブル', 'standing table', 'pub table', 'bistro table'],
    icon: '🍺', widthMm: 700,  depthMm: 700,  heightMm: 1000 },

  // ── 収納・ボード ──────────────────────────────────────────────────────────
  { key: 'tv_board',      label: 'テレビボード',      group: '収納・ボード', layoutCategory: 'cabinet',
    aliases: ['tv stand', 'media console', 'テレビ台', 'テレビスタンド', 'entertainment unit'],
    icon: '📺', widthMm: 1800, depthMm: 450,  heightMm: 550 },
  { key: 'sideboard',     label: 'サイドボード',      group: '収納・ボード', layoutCategory: 'cabinet',
    aliases: ['buffet', 'credenza', 'クレデンツァ', 'コンソールキャビネット'],
    icon: '🗄️', widthMm: 1400, depthMm: 450,  heightMm: 850 },
  { key: 'dresser',       label: 'ドレッサー',        group: '収納・ボード', layoutCategory: 'cabinet',
    aliases: ['dressing table', '化粧台', '鏡台', 'vanity'],
    icon: '🪞', widthMm: 1000, depthMm: 450,  heightMm: 750 },
  { key: 'cabinet',       label: 'キャビネット',      group: '収納・ボード', layoutCategory: 'cabinet',
    aliases: ['storage cabinet', '収納棚', 'chest'],
    icon: '🗄️', widthMm: 900,  depthMm: 450,  heightMm: 1800 },
  { key: 'shelf',         label: 'シェルフ・ラック',  group: '収納・ボード', layoutCategory: 'shelf',
    aliases: ['open shelf', 'open rack', 'オープンラック', 'floating shelf'],
    icon: '📚', widthMm: 900,  depthMm: 350,  heightMm: 1800 },
  { key: 'wardrobe',      label: 'ワードローブ',      group: '収納・ボード', layoutCategory: 'cabinet',
    aliases: ['armoire', 'clothes cabinet', '洋服タンス', 'クローゼット', 'closet'],
    icon: '👔', widthMm: 1200, depthMm: 600,  heightMm: 2000 },
  { key: 'bookshelf',     label: '本棚',              group: '収納・ボード', layoutCategory: 'shelf',
    aliases: ['bookcase', 'book rack', '書棚', 'ブックシェルフ'],
    icon: '📚', widthMm: 900,  depthMm: 300,  heightMm: 1800 },
  { key: 'mirror_floor',  label: '姿見',              group: '収納・ボード', layoutCategory: 'other',
    aliases: ['floor mirror', 'standing mirror', 'full length mirror', '全身鏡', 'フルレングスミラー'],
    icon: '🪞', widthMm: 600,  depthMm: 150,  heightMm: 1600 },

  // ── ベッド ────────────────────────────────────────────────────────────────
  { key: 'bed_single',    label: 'ベッド（シングル）',    group: 'ベッド', layoutCategory: 'bed',
    aliases: ['single bed', 'twin bed', 'シングルベッド'],
    icon: '🛏️', widthMm: 1000, depthMm: 2000, heightMm: 500 },
  { key: 'bed_semidouble', label: 'ベッド（セミダブル）', group: 'ベッド', layoutCategory: 'bed',
    aliases: ['semi double', 'semidouble bed', 'セミダブルベッド'],
    icon: '🛏️', widthMm: 1200, depthMm: 2000, heightMm: 500 },
  { key: 'bed_double',    label: 'ベッド（ダブル）',      group: 'ベッド', layoutCategory: 'bed',
    aliases: ['double bed', 'full bed', 'ダブルベッド'],
    icon: '🛏️', widthMm: 1400, depthMm: 2000, heightMm: 500 },
  { key: 'bed_queen',     label: 'ベッド（クイーン）',    group: 'ベッド', layoutCategory: 'bed',
    aliases: ['queen bed', 'queen size', 'クイーンベッド', 'クイーンサイズ'],
    icon: '🛏️', widthMm: 1600, depthMm: 2000, heightMm: 500 },
  { key: 'bed_king',      label: 'ベッド（キング）',      group: 'ベッド', layoutCategory: 'bed',
    aliases: ['king bed', 'king size', 'キングベッド', 'キングサイズ'],
    icon: '🛏️', widthMm: 1800, depthMm: 2000, heightMm: 500 },
  { key: 'night_table',   label: 'ナイトテーブル',        group: 'ベッド', layoutCategory: 'night_table',
    aliases: ['nightstand', 'bedside table', 'ベッドサイドテーブル', 'bedside cabinet', '枕元テーブル'],
    icon: '🕯️', widthMm: 500,  depthMm: 400,  heightMm: 600 },
  { key: 'bed_bunk',      label: '二段ベッド',            group: 'ベッド', layoutCategory: 'bed',
    aliases: ['bunk bed', '二段ベッド', '2段ベッド', 'loft bed'],
    icon: '🛏️', widthMm: 1000, depthMm: 2000, heightMm: 1700 },

  // ── 什器・業務用 ──────────────────────────────────────────────────────────
  { key: 'counter_register', label: 'レジカウンター', group: '什器・業務用', layoutCategory: 'counter',
    aliases: ['register', 'checkout counter', 'レジ', 'cashier counter'],
    icon: '🏪', widthMm: 1200, depthMm: 600,  heightMm: 900 },
  { key: 'bar_counter',   label: 'バーカウンター',    group: '什器・業務用', layoutCategory: 'counter',
    aliases: ['bar', 'bartop', 'キッチンカウンター', 'kitchen counter', 'ドリンクバー'],
    icon: '🍸', widthMm: 2000, depthMm: 600,  heightMm: 1050 },
  { key: 'display_shelf', label: '陳列棚',            group: '什器・業務用', layoutCategory: 'shelf',
    aliases: ['display rack', '商品棚', 'gondola', 'store shelf'],
    icon: '🛍️', widthMm: 900,  depthMm: 400,  heightMm: 1800 },
  { key: 'display_case',  label: 'ショーケース',      group: '什器・業務用', layoutCategory: 'shelf',
    aliases: ['showcase', 'glass case', 'jewel case', 'ガラスケース', '宝石ケース'],
    icon: '💎', widthMm: 1200, depthMm: 500,  heightMm: 1000 },
  { key: 'partition',     label: 'パーテーション',    group: '什器・業務用', layoutCategory: 'partition',
    aliases: ['divider', '間仕切り', 'room divider', 'screen', 'パネル'],
    icon: '🔲', widthMm: 1200, depthMm: 50,   heightMm: 1800 },
  { key: 'whiteboard',    label: 'ホワイトボード',    group: '什器・業務用', layoutCategory: 'other',
    aliases: ['white board', '黒板', 'blackboard', 'chalkboard', 'プロジェクタースクリーン'],
    icon: '📋', widthMm: 1800, depthMm: 100,  heightMm: 1200 },
  { key: 'locker',        label: 'ロッカー',          group: '什器・業務用', layoutCategory: 'cabinet',
    aliases: ['shoe locker', '下駄箱', 'storage locker', 'シューズロッカー'],
    icon: '🔒', widthMm: 900,  depthMm: 500,  heightMm: 1800 },

  // ── 水回り・設備 ──────────────────────────────────────────────────────────
  { key: 'kitchen',       label: 'システムキッチン',  group: '設備', layoutCategory: 'other',
    aliases: ['kitchen', 'キッチン', 'I型キッチン', 'L型キッチン', 'ペニンシュラ', 'アイランドキッチン'],
    icon: '🍳', widthMm: 2700, depthMm: 650,  heightMm: 850 },
  { key: 'kitchen_island', label: 'キッチンアイランド', group: '設備', layoutCategory: 'other',
    aliases: ['island', 'kitchen island', 'アイランド'],
    icon: '🍳', widthMm: 1200, depthMm: 800,  heightMm: 900 },
  { key: 'toilet',        label: 'トイレ',            group: '設備', layoutCategory: 'other',
    aliases: ['wc', 'lavatory', '便器', 'toilet bowl'],
    icon: '🚽', widthMm: 400,  depthMm: 750,  heightMm: 800 },
  { key: 'bath',          label: 'システムバス',      group: '設備', layoutCategory: 'other',
    aliases: ['bathtub', '浴槽', 'バスタブ', 'bathroom unit', 'bath unit'],
    icon: '🛁', widthMm: 1600, depthMm: 1600, heightMm: 2200 },
  { key: 'bathtub',       label: 'バスタブ（単体）',  group: '設備', layoutCategory: 'other',
    aliases: ['free standing tub', 'freestanding bathtub', '置き型バスタブ', 'soaking tub'],
    icon: '🛁', widthMm: 1700, depthMm: 800,  heightMm: 600 },
  { key: 'washbasin',     label: '洗面台',            group: '設備', layoutCategory: 'other',
    aliases: ['sink', 'vanity unit', '洗面器', 'wash basin', 'ラバボ'],
    icon: '🚿', widthMm: 750,  depthMm: 500,  heightMm: 850 },

  // ── グリーン ──────────────────────────────────────────────────────────────
  { key: 'plant_large',   label: '観葉植物（大型）',  group: 'グリーン', layoutCategory: 'plant',
    aliases: ['large plant', 'tree', '大型観葉', 'indoor tree', 'フィカス', 'ウンベラータ', 'モンステラ'],
    icon: '🌿', widthMm: 600,  depthMm: 600,  heightMm: 1800 },
  { key: 'plant_small',   label: '観葉植物（小型）',  group: 'グリーン', layoutCategory: 'plant',
    aliases: ['small plant', 'potted plant', '小型観葉', '鉢植え', 'succulent', '多肉植物'],
    icon: '🪴', widthMm: 300,  depthMm: 300,  heightMm: 600 },
  { key: 'plant_medium',  label: '観葉植物（中型）',  group: 'グリーン', layoutCategory: 'plant',
    aliases: ['medium plant', '中型観葉', 'floor plant'],
    icon: '🌱', widthMm: 450,  depthMm: 450,  heightMm: 1200 },

  // ── ファブリック ──────────────────────────────────────────────────────────
  { key: 'rug',           label: 'ラグ・カーペット',  group: 'ファブリック', layoutCategory: 'rug',
    aliases: ['carpet', 'area rug', 'rug', 'カーペット', '絨毯', 'じゅうたん'],
    icon: '🟫', widthMm: 2000, depthMm: 1500, heightMm: 10 },

  // ── 照明 ──────────────────────────────────────────────────────────────────
  { key: 'pendant_light', label: 'ペンダントライト',  group: '照明', layoutCategory: 'lamp',
    aliases: ['pendant', 'hanging light', 'chandelier', 'シャンデリア', 'ダウンライト'],
    icon: '💡', widthMm: 300,  depthMm: 300,  heightMm: 1500 },
  { key: 'floor_lamp',    label: 'フロアスタンド',    group: '照明', layoutCategory: 'lamp',
    aliases: ['floor lamp', 'standing lamp', 'フロアライト', 'フロアランプ', 'arc lamp'],
    icon: '🪔', widthMm: 350,  depthMm: 350,  heightMm: 1600 },
  { key: 'table_lamp',    label: 'テーブルランプ',    group: '照明', layoutCategory: 'lamp',
    aliases: ['desk lamp', 'bedside lamp', 'テーブルライト', 'スタンドライト'],
    icon: '💡', widthMm: 300,  depthMm: 300,  heightMm: 500 },
  { key: 'wall_light',    label: 'ウォールライト',    group: '照明', layoutCategory: 'lamp',
    aliases: ['wall lamp', 'sconce', '壁照明', 'ブラケットライト'],
    icon: '🔆', widthMm: 200,  depthMm: 200,  heightMm: 300 },

  // ── アウトドア ────────────────────────────────────────────────────────────
  { key: 'outdoor_sofa',  label: 'アウトドアソファ',  group: 'アウトドア', layoutCategory: 'sofa',
    aliases: ['garden sofa', 'patio sofa', 'outdoor couch', 'テラスソファ', 'ガーデンソファ'],
    icon: '☀️', widthMm: 1800, depthMm: 900,  heightMm: 700 },
  { key: 'outdoor_chair', label: 'アウトドアチェア',  group: 'アウトドア', layoutCategory: 'chair',
    aliases: ['garden chair', 'patio chair', 'ガーデンチェア', 'テラスチェア', 'deck chair'],
    icon: '☀️', widthMm: 600,  depthMm: 650,  heightMm: 850 },
  { key: 'outdoor_table', label: 'アウトドアテーブル', group: 'アウトドア', layoutCategory: 'table',
    aliases: ['garden table', 'patio table', 'ガーデンテーブル', 'テラステーブル'],
    icon: '☀️', widthMm: 1200, depthMm: 800,  heightMm: 720 },
  { key: 'outdoor_sunbed', label: 'サンベッド',        group: 'アウトドア', layoutCategory: 'other',
    aliases: ['sunbed', 'sun lounger', 'デッキチェア', 'chaise lounge', 'lounger'],
    icon: '🏖️', widthMm: 2000, depthMm: 700,  heightMm: 400 },
];

// ─── ヘルパー関数 ──────────────────────────────────────────────────────────────

/** キーからメタデータを取得 */
export function getCategoryMeta(key: string): FurnitureCategoryMeta | undefined {
  return FURNITURE_CATEGORIES.find(c => c.key === key);
}

/** グループ別にカテゴリを整理して返す */
export function getCategoriesByGroup(): Map<string, FurnitureCategoryMeta[]> {
  const map = new Map<string, FurnitureCategoryMeta[]>();
  for (const cat of FURNITURE_CATEGORIES) {
    const list = map.get(cat.group) ?? [];
    list.push(cat);
    map.set(cat.group, list);
  }
  return map;
}

/**
 * 資産の category / subCategory / title 文字列からキーを推定する。
 * aliases フィールドを活用して広いカバレッジを実現する。
 */
export function matchCategoryKey(rawCategory: string, title = ''): string | null {
  if (!rawCategory && !title) return null;
  const hay = `${rawCategory} ${title}`.toLowerCase().trim();

  // aliases も含めて全カテゴリを走査（長いキーワードから照合して誤マッチを防ぐ）
  const sorted = [...FURNITURE_CATEGORIES].sort(
    (a, b) => Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length))
  );

  for (const cat of sorted) {
    // key 自体
    if (hay.includes(cat.key.toLowerCase().replace(/_/g, ' '))) return cat.key;
    if (hay.includes(cat.key.toLowerCase())) return cat.key;
    // aliases
    for (const alias of cat.aliases) {
      if (hay.includes(alias.toLowerCase())) return cat.key;
    }
    // label（日本語）
    if (hay.includes(cat.label.toLowerCase())) return cat.key;
  }

  // layoutCategory レベルへのフォールバック
  for (const lc of LAYOUT_CATEGORIES) {
    if (hay.includes(lc.key)) return FURNITURE_CATEGORIES.find(c => c.layoutCategory === lc.key)?.key ?? null;
  }

  return null;
}

/**
 * layoutCategory キーの粗粒度一覧を返す（ルール編集の選択肢に使用）。
 * FURNITURE_CATEGORIES から重複なく収集し、LAYOUT_CATEGORIES の順序に並べる。
 */
export function getUniqueLayoutCategories(): LayoutCategoryMeta[] {
  const keys = new Set(FURNITURE_CATEGORIES.map(c => c.layoutCategory));
  // LAYOUT_CATEGORIES の順序を維持しつつ、FURNITURE_CATEGORIES に実際に存在するものだけ返す
  return LAYOUT_CATEGORIES.filter(lc => keys.has(lc.key));
}
