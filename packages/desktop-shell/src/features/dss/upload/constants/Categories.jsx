// src/data/Categories.jsx

/** =========================
 *  タイプ定数
 *  ========================= */
export const TYPES = {
  FURNITURE: "furniture",       // 家具
  ARCHITECTURE: "architecture", // 建築
};

/** =========================
 *  家具（type: furniture）
 *  ========================= */
export const categoryOptions = {
  "ソファ・ロビーチェア": {
    sub: {
      "ソファ": ["1人掛けソファ", "2人掛けソファ", "3人掛けソファ", "組み合わせソファ"],
      "ロビーチェア": ["1人掛けロビーチェア", "2人掛けロビーチェア", "3人掛けロビーチェア", "4人掛けロビーチェア", "ハイベンチ", "ベンチ", "肘付ロビーチェア"],
      "組椅子": [],
      "ボックスチェア": ["ボックスチェア", "スツール"],
      "可動チェア": ["ソファベッド", "リクライナー"],
    },
  },
  "チェア": {
    sub: {
      "チェア": ["アームチェア", "アームレスチェア"],
      "高齢者施設向けチェア": ["アームチェア", "アームレスチェア", "備品"],
      "カウンターチェア": ["背付き", "背なし", "システムカウンターチェア", "カウンターチェアベース"],
      "スツール": [],
      "折りたたみチェア": [],
      "キッズチェア": [],
      "台車": [],
      "その他チェア": [],
    },
  },
  "テーブル": {
    sub: {
      "テーブル": [],
      "ローテーブル": [],
      "組合せテーブル": [],
      "高齢者施設向けテーブル": [],
      "応接テーブル": [],
      "可動式テーブル": [],
      "バンケットテーブル": [],
      "その他テーブル": [],
    },
  },
  "和家具": {
    sub: {
      "チェア": [],
      "テーブル": [],
      "座椅子": [],
      "座卓": [],
      "座布団": [],
      "備品": [],
    },
  },
  "アウトドア家具": {
    sub: {
      "チェア": ["アームチェア", "アームレスチェア", "ラウンジチェア"],
      "カウンターチェア": [],
      "ソファ": [],
      "テーブル": [],
      "ベンチ": [],
      "編み家具": [],
      "パーゴラ": [],
      "その他": [],
    },
  },
  "キッズ家具": {
    sub: {
      "キッズコーナー": [],
      "おむつ替え台": [],
      "ベビーベッド": [],
      "授乳・産後チェア": [],
      "玩具": [],
      "その他": [],
    },
  },
  "エグゼクティブ・応接家具": {
    sub: {
      "エグゼクティブ": [],
      "応接テーブル・備品": [],
      "応接家具": [],
    },
  },
  "キャビネット": {
    sub: {
      "キャビネット": [],
      "ロッカー": [],
      "食器棚": [],
    },
  },
  "ベッド": {
    sub: {
      "シングル": ["収納付き", "脚付き", "マットレス付き"],
      "セミダブル": ["フレームのみ", "マットレス付き"],
      "ダブル以上": ["キングサイズ", "クイーンサイズ"],
    },
  },
  "備品": {
    sub: {
      "グリーン": [],
      "ゴミ箱・傘立て": [],
      "パネル・パーティション": [],
      "ハンガー": [],
      "プランター": [],
      "ミラー": [],
      "照明・ラグ": [],
      "防災": [],
      "その他": [],
    },
  },
};

export const brandOptions = ["IKEA", "無印良品", "カリモク", "ニトリ"];

/** =========================
 *  建築（type: architecture）- サブタイプ別
 *  ========================= */
// subType: 全体
export const categoryOptionsArchitecture = {
  "住宅": {
    sub: {
      "ファサード": ["テスト", "側面", "裏面"],
      "屋根": ["片流れ屋根", "寄棟屋根", "陸屋根"],
    },
  },
  "カフェ": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "オフィス": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "医療・高齢者施設": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "温浴施設": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "宿泊施設": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "福利厚生・公共施設": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
  "文教": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
};

// subType: パーツ
export const categoryOptionsArchitectureParts = {
  "ドア": {
    sub: {
      "ファサード": ["テスト", "側面", "裏面"],
      "屋根": ["片流れ屋根", "寄棟屋根", "陸屋根"],
    },
  },
  "窓": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
};

// subType: 外構
export const categoryOptionsArchitectureOutside = {
  "店": {
    sub: {
      "ファサード": ["テスト", "側面", "裏面"],
      "屋根": ["片流れ屋根", "寄棟屋根", "陸屋根"],
    },
  },
  "信号機": {
    sub: {
      "玄関": ["シューズクローゼット", "土間"],
      "リビング": ["吹き抜け", "リビング階段"],
      "キッチン": ["アイランドキッチン", "L字型キッチン"],
    },
  },
};

/** =========================
 *  サブタイプ一覧
 *  ========================= */
export const SUBTYPES = {
  [TYPES.FURNITURE]: ["既製品家具", "造作家具"], // 表示目的（データは共通）
  [TYPES.ARCHITECTURE]: ["全体", "パーツ", "外構"],
};

/** =========================
 *  TAXONOMY ルート定義
 *  ========================= */
export const TAXONOMY = {
  [TYPES.FURNITURE]: {
    subtypes: SUBTYPES[TYPES.FURNITURE],
    datasets: {
      default: categoryOptions, // 家具はサブタイプ問わず同一ツリー
    },
    brands: brandOptions,
  },
  [TYPES.ARCHITECTURE]: {
    subtypes: SUBTYPES[TYPES.ARCHITECTURE],
    datasets: {
      "全体": categoryOptionsArchitecture,
      "パーツ": categoryOptionsArchitectureParts,
      "外構": categoryOptionsArchitectureOutside,
    },
  },
};

/** =========================
 *  取得ヘルパー
 *  ========================= */
export const getCategoryTree = (type, subType = "default") => {
  const node = TAXONOMY?.[type];
  if (!node) return {};
  return node.datasets?.[subType] ?? node.datasets?.default ?? {};
};

/** =========================
 *  スラッグ（URL）化
 *  ========================= */
// 建築サブタイプ → スラッグ
export const SUBTYPE_SLUGS = {
  [TYPES.ARCHITECTURE]: {
    "全体": "overall",
    "パーツ": "parts",
    "外構": "outside",
  },
};
export const SUBTYPE_FROM_SLUG = {
  [TYPES.ARCHITECTURE]: {
    overall: "全体",
    parts: "パーツ",
    outside: "外構",
  },
};

// グループ名 → スラッグ
export const GROUP_SLUGS = {
  [TYPES.FURNITURE]: {
    "ソファ・ロビーチェア": "sofa",
    "チェア": "chair",
    "テーブル": "table",
    "和家具": "wagagu",
    "アウトドア家具": "outdoor",
    "キッズ家具": "kids",
    "エグゼクティブ・応接家具": "executive",
    "キャビネット": "cabinet",
    "ベッド": "bed",
    "備品": "supplies",
  },
  "architecture:overall": {
    "住宅": "housing",
    "カフェ": "cafe",
    "オフィス": "office",
    "医療・高齢者施設": "medical-senior",
    "温浴施設": "spa",
    "宿泊施設": "hotel",
    "福利厚生・公共施設": "public",
    "文教": "education",
  },
  "architecture:parts": {
    "ドア": "door",
    "窓": "window",
  },
  "architecture:outside": {
    "店": "storefront",
    "信号機": "signal",
  },
};
// 逆引き（スラッグ → 名称）
export const GROUP_FROM_SLUG = {
  [TYPES.FURNITURE]: Object.fromEntries(
    Object.entries(GROUP_SLUGS[TYPES.FURNITURE]).map(([label, slug]) => [slug, label])
  ),
  "architecture:overall": Object.fromEntries(
    Object.entries(GROUP_SLUGS["architecture:overall"]).map(([label, slug]) => [slug, label])
  ),
  "architecture:parts": Object.fromEntries(
    Object.entries(GROUP_SLUGS["architecture:parts"]).map(([label, slug]) => [slug, label])
  ),
  "architecture:outside": Object.fromEntries(
    Object.entries(GROUP_SLUGS["architecture:outside"]).map(([label, slug]) => [slug, label])
  ),
};

// サブタイプ ↔ スラッグ
export const getSubtypeSlug = (type, subType) =>
  SUBTYPE_SLUGS?.[type]?.[subType] ?? encodeURIComponent(subType ?? "");
export const getSubtypeLabelFromSlug = (type, slug) =>
  SUBTYPE_FROM_SLUG?.[type]?.[slug] ?? decodeURIComponent(slug ?? "");

// グループ ↔ スラッグ
export const getGroupSlug = (type, subTypeLabel, groupKey) => {
  if (type === TYPES.ARCHITECTURE) {
    const stSlug = getSubtypeSlug(type, subTypeLabel);
    const key = `architecture:${stSlug}`;
    return GROUP_SLUGS[key]?.[groupKey] ?? encodeURIComponent(groupKey ?? "");
  }
  if (type === TYPES.FURNITURE) {
    return GROUP_SLUGS[TYPES.FURNITURE]?.[groupKey] ?? encodeURIComponent(groupKey ?? "");
  }
  return encodeURIComponent(groupKey ?? "");
};
export const getGroupLabelFromSlug = (type, subTypeLabel, slug) => {
  if (type === TYPES.ARCHITECTURE) {
    const stSlug = getSubtypeSlug(type, subTypeLabel);
    const key = `architecture:${stSlug}`;
    return GROUP_FROM_SLUG[key]?.[slug] ?? decodeURIComponent(slug ?? "");
  }
  if (type === TYPES.FURNITURE) {
    return GROUP_FROM_SLUG[TYPES.FURNITURE]?.[slug] ?? decodeURIComponent(slug ?? "");
  }
  return decodeURIComponent(slug ?? "");
};

/** =========================
 *  サブカテゴリ ↔ スラッグ（共通）
 *  ========================= */

// 必要なものから徐々に増やせます。未登録は encodeURIComponent を使うので壊れません。
const SUBITEM_SLUGS = {
  // --- 家具：ソファ・ロビーチェア ---
  "ソファ": "sofa",
  "1人掛けソファ": "1-seater-sofa",
  "2人掛けソファ": "2-seater-sofa",
  "3人掛けソファ": "3-seater-sofa",
  "組み合わせソファ": "modular-sofa",

  "ロビーチェア": "lobbychair",
  "1人掛けロビーチェア": "1-seater-lobby-chair",
  "2人掛けロビーチェア": "2-seater-lobby-chair",
  "3人掛けロビーチェア": "3-seater-lobby-chair",
  "4人掛けロビーチェア": "4-seater-lobby-chair",
  "ハイベンチ": "high-bench",
  "ベンチ": "bench",
  "肘付ロビーチェア": "lobby-chair-with-arms",

  "組椅子": "kumii",
  "ボックスチェア": "boxchair",
  "スツール": "stool",
  "可動チェア": "movable-chair",
  "ソファベッド": "sofa-bed",
  "リクライナー": "recliner",

  // --- 家具：チェア グループ ---
  "チェア": "chair",
  "アームチェア": "arm-chair",
  "アームレスチェア": "armless-chair",

  "高齢者施設向けチェア": "elderly-chair",
  "備品": "supplies",

  "カウンターチェア": "counter-chair",
  "背付き": "with-backrest",
  "背なし": "backless",
  "システムカウンターチェア": "system-counter-chair",
  "カウンターチェアベース": "counter-chair-base",

  "折りたたみチェア": "folding-chair",
  "キッズチェア": "kids-chair",
  "台車": "platform-trolley",
  "その他チェア": "other-chairs",

  // --- 家具：テーブル グループ ---
  "テーブル": "table",
  "ローテーブル": "low-table",
  "組合せテーブル": "modular-table",
  "高齢者施設向けテーブル": "elderly-table",
  "応接テーブル": "reception-table",
  "可動式テーブル": "mobile-table",
  "バンケットテーブル": "banquet-table",
  "その他テーブル": "other-tables",

  // --- 家具：和家具 ---
  "座椅子": "zaisu",
  "座卓": "zataku",
  "座布団": "zabuton",

  // --- 家具：アウトドア家具 ---
  "ラウンジチェア": "lounge-chair",
  "編み家具": "woven-furniture",
  "パーゴラ": "pergola",
  "その他": "others",

  // --- 家具：キッズ家具 ---
  "キッズコーナー": "kids-corner",
  "おむつ替え台": "diaper-changing-table",
  "ベビーベッド": "baby-bed",
  "授乳・産後チェア": "nursing-postpartum-chair",
  "玩具": "toys",

  // --- 家具：エグゼクティブ・応接家具 ---
  "エグゼクティブ": "executive",
  "応接テーブル・備品": "reception-table-supplies",
  "応接家具": "reception-furniture",

  // --- 家具：キャビネット ---
  "キャビネット": "cabinet",
  "ロッカー": "locker",
  "食器棚": "cupboard",

  // --- 家具：ベッド ---
  "シングル": "single",
  "セミダブル": "semi-double",
  "ダブル以上": "double-or-larger",
  "収納付き": "with-storage",
  "脚付き": "with-legs",
  "マットレス付き": "with-mattress",
  "フレームのみ": "frame-only",
  "キングサイズ": "king",
  "クイーンサイズ": "queen",

  // --- 家具：備品 ---
  "グリーン": "greenery",
  "ゴミ箱・傘立て": "trash-umbrella-stand",
  "パネル・パーティション": "panel-partition",
  "ハンガー": "hanger",
  "プランター": "planter",
  "ミラー": "mirror",
  "照明・ラグ": "lighting-rug",
  "防災": "disaster-prevention",

  // --- 建築：共通ラベル ---
  "ファサード": "facade",
  "屋根": "roof",
  "玄関": "entrance",
  "リビング": "living",
  "キッチン": "kitchen",

  // --- 建築：サンプル要素（データ内に登場） ---
  "テスト": "test",
  "側面": "side",
  "裏面": "rear",

  // 屋根のバリエーション
  "片流れ屋根": "single-slope-roof",
  "寄棟屋根": "hipped-roof",
  "陸屋根": "flat-roof",
};


// ラベル -> スラッグ
export const getSubSlug = (label) =>
  SUBITEM_SLUGS[label] ?? encodeURIComponent(label ?? "");

// スラッグ -> ラベル
export const getSubLabelFromSlug = (slug) => {
  const decoded = decodeURIComponent(slug ?? "");
  const hit = Object.entries(SUBITEM_SLUGS).find(([, s]) => s === slug);
  return hit ? hit[0] : decoded;
};

/* ============================================================
 *  追加：リンク生成＆解析ヘルパ（UI から呼び出すだけでOK）
 * ============================================================ */

// 型ガード的な軽い安全策
export const ensureType = (t) =>
  t === TYPES.FURNITURE || t === TYPES.ARCHITECTURE ? t : TYPES.FURNITURE;

// ASCII スラッグ or encodeURI の安全化（undefined を空に）
const toSlugSafe = (s) => (s == null ? "" : s);

/** ラベルから正規 URL を生成（/categories/...）
 *  e.g. buildCategoryPath("furniture", { groupLabel:"チェア", subLabel:"高齢者施設向けチェア" })
 *   -> /categories/furniture/chair/elderly-chair
 */
export function buildCategoryPath(
  type,
  {
    subTypeLabel,  // 建築のみ（"全体" など）
    groupLabel,    // 家具 or 建築
    subLabel,      // サブカテゴリ
  } = {}
) {
  const t = ensureType(String(type || "").toLowerCase());
  const parts = ["/categories", t];

  // 建築のときだけサブタイプ
  if (t === TYPES.ARCHITECTURE && subTypeLabel) {
    parts.push(getSubtypeSlug(t, subTypeLabel));
  }

  if (groupLabel) {
    const gSlug = getGroupSlug(t, subTypeLabel, groupLabel);
    parts.push(toSlugSafe(gSlug));
  }

  if (subLabel) {
    parts.push(toSlugSafe(getSubSlug(subLabel)));
  }

  // 連続スラッシュ除去 & 末尾スラ無し
  return parts.join("/").replace(/\/+/g, "/").replace(/\/$/, "");
}

/** URL params をラベルへ復元
 *  例）parseCategoryParams("furniture", { subType:"chair", group:"elderly-chair" })
 */
export function parseCategoryParams(type, { subType, group, leaf } = {}) {
  const t = ensureType(String(type || "").toLowerCase());

  const subTypeLabel =
    t === TYPES.ARCHITECTURE && subType
      ? getSubtypeLabelFromSlug(t, subType)
      : undefined;

  const groupLabel = group
    ? getGroupLabelFromSlug(t, subTypeLabel, group)
    : undefined;

  const subLabel = leaf ? getSubLabelFromSlug(leaf) : undefined;

  return { type: t, subTypeLabel, groupLabel, subLabel };
}

/** 選択判定の安全比較（ラベル/スラッグ混在でも true）
 *  UI の isSelected* で利用するとバグりません
 */
export function isSameSubType(type, a, b) {
  if (!a || !b) return false;
  const t = ensureType(type);
  // ラベル同士
  if (a === b) return true;
  // 片方がスラッグだった場合に同値化
  return getSubtypeLabelFromSlug(t, a) === b || getSubtypeLabelFromSlug(t, b) === a;
}

export function isSameGroup(type, subTypeLabel, a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  // a/b がラベルかスラッグか不定でも、両方ラベル化して比較
  // まず a をラベル化
  const aLabel =
    /%|[^\x00-\x7F]/.test(a) // URLエンコードや非ASCIIが含まれるなら decode
      ? getGroupLabelFromSlug(type, subTypeLabel, decodeURIComponent(a))
      : getGroupLabelFromSlug(type, subTypeLabel, a) || a;

  // b をラベル化
  const bLabel =
    /%|[^\x00-\x7F]/.test(b)
      ? getGroupLabelFromSlug(type, subTypeLabel, decodeURIComponent(b))
      : getGroupLabelFromSlug(type, subTypeLabel, b) || b;

  return aLabel === bLabel;
}
