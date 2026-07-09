export function normalizeFilterPayload(rawPayload) {
  // Expected AI output payload format examples:
  // { mainCategory: "家具", keyword: "ソファ", maxPrice: 30000, colors: ["red"] }
  // or { category: "家具", priceMax: 30000 }
  console.log("[Before Normalize] raw payload:", rawPayload);

  let typeMatch = null;
  let mainMatch = null;
  let subMatch = null;
  let priceMatch = null;

  let normalizedPayload = { ...rawPayload };

  // Combine loosely structured texts into a single search string block and lowercase for easy matching
  const searchStr = [
    rawPayload.mainCategory,
    rawPayload.keyword,
    rawPayload.query,
    rawPayload.category,
    rawPayload.subCategory,
    rawPayload.groupLabel,
    rawPayload.subLabel
  ].filter(Boolean).join(" ").toLowerCase();

  const hasCategoryKeyword = searchStr.length > 0;

  // Synonyms dictionaries
  const synonyms = {
    sofa: ["sofa", "ソファ", "ソファー", "カウチ", "ロビーソファ", "ロビーチェア"],
    chair: ["chair", "チェア", "椅子", "イス", "いす", "座椅子", "スツール", "カウンターチェア", "キッズチェア", "折りたたみチェア"],
    table: ["table", "テーブル", "机", "デスク", "ローテーブル", "応接テーブル"],
    bed: ["bed", "ベッド", "寝具", "シングル", "セミダブル", "ダブル"],
    cabinet: ["cabinet", "キャビネット", "ロッカー", "食器棚", "収納", "棚", "シェルフ"],
    japan: ["和家具", "座卓", "こたつ"],
    outdoor: ["アウトドア家具", "屋外", "ガーデン"],
    equipment: ["備品", "グリーン", "植物", "ゴミ箱", "照明", "ランプ", "ラグ", "カーペット"],
    architecture: ["建築", "住宅", "オフィス", "カフェ", "店舗", "施設", "ドア", "扉", "窓", "建具"],
  };

  const matches = (keys) => keys.some((k) => searchStr.includes(k));

  // 1. Map to TYPE (furniture vs architecture)
  if (matches(synonyms.architecture)) {
    typeMatch = "architecture";
  } else if (matches(synonyms.sofa) || matches(synonyms.chair) || matches(synonyms.table) || matches(synonyms.bed) || matches(synonyms.cabinet) || searchStr.includes("家具")) {
    typeMatch = "furniture";
  } else {
    // default
    typeMatch = "furniture";
  }

  // 2. Identify mainCategory & subCategory
  if (typeMatch === "furniture") {
    if (matches(synonyms.sofa)) {
      mainMatch = "ソファ・ロビーチェア";
      if (searchStr.includes("ロビー")) subMatch = "ロビーチェア";
      else subMatch = "ソファ";
    } else if (matches(synonyms.chair)) {
      mainMatch = "チェア";
      if (searchStr.includes("カウンター")) subMatch = "カウンターチェア";
      else if (searchStr.includes("スツール")) subMatch = "スツール";
      else if (searchStr.includes("折りたたみ")) subMatch = "折りたたみチェア";
      else if (searchStr.includes("キッズ")) subMatch = "キッズチェア";
      else subMatch = "チェア";
    } else if (matches(synonyms.table)) {
      mainMatch = "テーブル";
      if (searchStr.includes("ローテーブル") || searchStr.includes("座卓")) subMatch = "ローテーブル";
      else if (searchStr.includes("応接")) subMatch = "応接テーブル";
      else subMatch = "テーブル";
    } else if (matches(synonyms.bed)) {
      mainMatch = "ベッド";
      if (searchStr.includes("シングル")) subMatch = "シングル";
      else if (searchStr.includes("セミダブル")) subMatch = "セミダブル";
      else if (searchStr.includes("ダブル")) subMatch = "ダブル以上";
    } else if (matches(synonyms.cabinet)) {
      mainMatch = "キャビネット";
      if (searchStr.includes("ロッカー")) subMatch = "ロッカー";
      else if (searchStr.includes("食器棚")) subMatch = "食器棚";
      else subMatch = "キャビネット";
    } else if (matches(synonyms.japan)) {
      mainMatch = "和家具";
    } else if (matches(synonyms.outdoor)) {
      mainMatch = "アウトドア家具";
    } else if (matches(synonyms.equipment)) {
      mainMatch = "備品";
    }
  } else if (typeMatch === "architecture") {
    if (searchStr.includes("住宅")) mainMatch = "住宅";
    else if (searchStr.includes("オフィス")) mainMatch = "オフィス";
    else if (searchStr.includes("カフェ") || searchStr.includes("店舗")) mainMatch = "カフェ";
    else if (searchStr.includes("ドア") || searchStr.includes("扉") || searchStr.includes("建具")) mainMatch = "ドア";
    else if (searchStr.includes("窓")) mainMatch = "窓";
  }

  // Assign resolved taxonomy fields directly so components use them natively
  if (typeMatch) normalizedPayload.type = typeMatch;
  if (mainMatch) normalizedPayload.mainCategory = mainMatch;
  if (subMatch) normalizedPayload.subCategory = subMatch;

  // Cleanup old keys so dashboard actions are clean
  delete normalizedPayload.category;
  delete normalizedPayload.query;
  delete normalizedPayload.keyword;
  delete normalizedPayload.groupLabel;
  delete normalizedPayload.subLabel;

  if (hasCategoryKeyword && !mainMatch && !subMatch && rawPayload.maxPrice === undefined && Object.keys(rawPayload).length > 0) {
    console.warn(`[Filter Normalize Warning] category keyword detected but no taxonomy match found: "${searchStr}"`);
  }

  // 3. Price normalization
  const incomingPrice = rawPayload.maxPrice ?? rawPayload.priceMax ?? rawPayload.price ?? rawPayload.max_price;
  if (incomingPrice !== undefined) {
    if (typeof incomingPrice === "string") {
      const parsed = parseInt(incomingPrice.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) {
        priceMatch = parsed;
      }
    } else if (typeof incomingPrice === "number") {
      priceMatch = incomingPrice;
    }
    if (priceMatch !== null) {
      normalizedPayload.maxPrice = priceMatch;
    }
    delete normalizedPayload.priceMax;
    delete normalizedPayload.price;
    delete normalizedPayload.max_price;
  }

  console.log("[After Normalize] normalized payload:", normalizedPayload);
  return normalizedPayload;
}
