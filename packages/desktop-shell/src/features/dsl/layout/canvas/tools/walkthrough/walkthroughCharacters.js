// walkthroughCharacters.js
//
// ウォークスルーのキャラクター定義（一人称の目線高さ・三人称のアバター寸法）。
// 建築の視線・スケール検討に役立つよう、年齢・体格の異なるプリセットを用意する。
// 寸法はメートル単位。将来的に実 GLB アバターへ差し替え可能。

export const WALKTHROUGH_CHARACTERS = {
  male: {
    key: "male",
    label: "成人男性",
    short: "男性",
    desc: "標準的な成人男性",
    eyeM: 1.70,      // 一人称の目線高さ
    heightM: 1.75,   // 全高（三人称アバター）
    shoulderM: 0.46, // 肩幅
    color: "#5b8def",
  },
  female: {
    key: "female",
    label: "成人女性",
    short: "女性",
    desc: "標準的な成人女性",
    eyeM: 1.58,
    heightM: 1.62,
    shoulderM: 0.40,
    color: "#e57fb0",
  },
  senior: {
    key: "senior",
    label: "高齢者",
    short: "高齢",
    desc: "やや低い目線・高齢者",
    eyeM: 1.50,
    heightM: 1.56,
    shoulderM: 0.42,
    color: "#c9a14a",
  },
  child: {
    key: "child",
    label: "子供（小学生）",
    short: "子供",
    desc: "小学生くらいの子供",
    eyeM: 1.12,
    heightM: 1.25,
    shoulderM: 0.32,
    color: "#5fc88f",
  },
  toddler: {
    key: "toddler",
    label: "幼児",
    short: "幼児",
    desc: "幼児（低い視線の検討）",
    eyeM: 0.85,
    heightM: 0.95,
    shoulderM: 0.26,
    color: "#e0a25e",
  },
};

export const WALKTHROUGH_CHARACTER_ORDER = ["male", "female", "senior", "child", "toddler"];

export function getCharacter(key) {
  return WALKTHROUGH_CHARACTERS[key] || WALKTHROUGH_CHARACTERS.male;
}

// ── 正規化された「キャラクター記述子」 ───────────────────────────
// プリセット(簡易シルエット)と S.Models 登録モデルを同じ形で扱う。
//   source : "preset" | "model"
//   id     : preset key または modelId
//   glbUrl : 実モデルの GLB URL（preset は null → 簡易アバター）
//   eyeM/heightM/shoulderM : メートル単位
export function presetDescriptor(key) {
  const c = getCharacter(key);
  return {
    source: "preset",
    id: c.key,
    label: c.label,
    short: c.short,
    eyeM: c.eyeM,
    heightM: c.heightM,
    shoulderM: c.shoulderM,
    color: c.color,
    glbUrl: null,
  };
}

export const DEFAULT_CHARACTER = presetDescriptor("male");

// S.Models の asset ドキュメントから記述子を作る
export function modelDescriptor(asset) {
  const heightMm =
    asset?.dimensionsMm?.height ??
    asset?.dimensions?.height ??
    asset?.extendedMetadata?.dimensions?.height ??
    null;
  const heightM = Number.isFinite(heightMm) && heightMm > 10 ? heightMm / 1000 : 1.70;
  const charMeta = asset?.extendedMetadata?.character || {};
  const eyeM = Number.isFinite(charMeta.eyeM)
    ? charMeta.eyeM
    : Math.max(0.4, heightM - 0.12); // 既定: 全高 - 12cm
  return {
    source: "model",
    id: asset.id,
    label: asset.name || asset.title || "キャラクター",
    short: (asset.name || "キャラ").slice(0, 4),
    eyeM,
    heightM,
    shoulderM: Number.isFinite(charMeta.shoulderM) ? charMeta.shoulderM : heightM * 0.26,
    color: charMeta.color || "#8a8f98",
    glbUrl: asset.glbUrl || asset.downloadUrl || asset.raw?.glbUrl || asset.raw?.downloadUrl || null,
    thumbUrl: asset.thumbUrl || asset.thumbnailUrl || "",
  };
}
