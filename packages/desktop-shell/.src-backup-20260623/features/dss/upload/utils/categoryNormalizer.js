import { TAXONOMY, getCategoryTree } from '../constants/Categories';

/**
 * Ensures the given category hierarchy strictly exists in the TAXONOMY.
 * Invalid levels will be discarded (set to empty string).
 * Also trims and sanitizes tags.
 * 
 * @param {Object} data 
 * @param {string} data.type
 * @param {string} data.mainCategory
 * @param {string} data.subCategory
 * @param {string} data.detailCategory
 * @param {Array<string>} data.tags
 * @param {Object} similarityScores (optional) to re-evaluate type
 * @returns {Object} Normalized data
 */
export const normalizeAndSanitizeCategory = (data, similarityScores = {}, mergedCategoryMap = null) => {
  const defaultSafeResult = {
    type: "家具", // Fallback safe value
    mainCategory: "",
    subCategory: "",
    detailCategory: "",
    tags: []
  };

  if (!data || typeof data !== 'object') {
    console.warn('[Normalizer] input is undefined or not an object');
    return defaultSafeResult;
  }

  try {
    const result = {
      type: "",
      mainCategory: "",
      subCategory: "",
      detailCategory: "", // detailCategory is obsolete, always empty
      tags: []
    };

    // 1. Validate Type
    const allowedTypes = mergedCategoryMap ? Object.keys(mergedCategoryMap) : Object.keys(TAXONOMY || {});
    if (data.type && allowedTypes.includes(data.type)) {
      result.type = data.type;
    }

    // 1.5 Re-evaluate "その他" or empty type based on similarity or candidates
    if (result.type === "その他" || !result.type) {
      const { furnitureScore = 0, buildingScore = 0, candidates = [] } = similarityScores || {};
      let overrideType = null;
      let reason = "";

      // Priority 1: Similarity Scores
      if (furnitureScore > 0 || buildingScore > 0) {
        overrideType = furnitureScore >= buildingScore ? "家具" : "建築";
        reason = `[1] similarityScore (F:${furnitureScore}, B:${buildingScore})`;
      } 
      // Priority 2: Candidates presence
      else if (candidates && candidates.length > 0) {
        const hasFurniture = candidates.some(c => c.type === "家具");
        const hasBuilding = candidates.some(c => c.type === "建築");
        if (hasFurniture) { overrideType = "家具"; reason = "[2] candidate F found"; }
        else if (hasBuilding) { overrideType = "建築"; reason = "[2] candidate B found"; }
      }
      
      // Priority 3 & 4: Title / Tags keyword checking
      if (!overrideType) {
         const rawText = [data.title || "", ...(Array.isArray(data.tags) ? data.tags : [])].join(" ").toLowerCase();
         const archStrong = ['villa', 'mansion', 'apartment', 'house', 'building', '住宅', 'マンション', '別荘', 'ビル', '建物'];
         const furnStrong = ['sofa', 'chair', 'table', 'desk', 'bed', 'cabinet', 'shelf', 'pc', 'keyboard', 'display'];
         const archKeywords = ['room', 'office', '建築', '部屋', '外観', '内観', 'ドア', '窓', '屋根', '壁', '店舗', 'カフェ', '施設', 'door', 'wall', 'window', 'frame', 'panel', 'slab'];
         const furnKeywords = ['ソファ', 'チェア', '椅子', '机', 'テーブル', 'ベッド', 'キャビネット', '収納', '棚', '照明', 'furniture', '家具'];

         let fScore = 0, bScore = 0;
         furnStrong.forEach(kw => { if (rawText.includes(kw)) fScore += 10; });
         archStrong.forEach(kw => { if (rawText.includes(kw)) bScore += 10; });
         furnKeywords.forEach(kw => { if (rawText.includes(kw)) fScore += 1; });
         archKeywords.forEach(kw => { if (rawText.includes(kw)) bScore += 1; });

         if (fScore > 0 || bScore > 0) {
            overrideType = fScore >= bScore ? "家具" : "建築";
            reason = `[3/4] keyword analysis (F:${fScore}, B:${bScore})`;
         }
      }

      if (overrideType && allowedTypes.includes(overrideType)) {
        console.log(`[Type Auto-Correction] Overrode 'その他'/missing to '${overrideType}' based on ${reason}.`);
        result.type = overrideType;
      } else {
        console.log(`[Type Final=その他] 
  - no similarity signal
  - no alias match
  - no furniture/building keyword`);
        result.type = "その他";
        if (!allowedTypes.includes(result.type) && allowedTypes.length > 0) {
            result.type = allowedTypes[0]; // Fallback if "その他" doesn't exist
        }
      }
    }

    // 2. Validate MainCategory & SubCategory depth if type exists
    if (result.type && data.mainCategory) {
      const mainCatStr = String(data.mainCategory).trim();
      let foundMain = false;
      let validSubs = [];

      if (mergedCategoryMap && mergedCategoryMap[result.type]) {
          foundMain = Object.keys(mergedCategoryMap[result.type]).includes(mainCatStr);
          if (foundMain) {
              validSubs = mergedCategoryMap[result.type][mainCatStr] || [];
          }
      } else {
          // Fallback to TAXONOMY checking if mergedCategoryMap isn't provided
          const datasets = (TAXONOMY?.[result.type]?.datasets ?? {});
          for (const dKey of Object.keys(datasets)) {
            if (datasets[dKey] && datasets[dKey][mainCatStr]) {
              foundMain = true;
              validSubs = Object.keys(datasets[dKey][mainCatStr].sub || {});
              break;
            }
          }
      }

      if (foundMain) {
        result.mainCategory = mainCatStr;

        // 3. Validate SubCategory
        if (data.subCategory) {
          const subCatStr = String(data.subCategory).trim();
          if (validSubs.includes(subCatStr)) {
            result.subCategory = subCatStr;
          }
        }
      }
    }

    // 4. Sanitize Tags
    if (Array.isArray(data.tags)) {
      const rawTags = data.tags
        .map(t => String(t).trim())
        .filter(t => t.length > 0 && t !== "undefined" && t !== "null");
      
      // Deduplicate
      result.tags = [...new Set(rawTags)];
    }

    return result;

  } catch (e) {
    console.error('[Normalizer Crash]', e);
    // fallback logic inside catch: try to infer type if possible, else "家具"
    let safeType = "家具";
    try {
      if (data && data.title) {
        const titleStr = data.title.toLowerCase();
        const archStrong = ['villa', 'mansion', 'apartment', 'house', 'building', '住宅', 'マンション', '別荘', 'ビル', '建物'];
        if (archStrong.some(kw => titleStr.includes(kw))) {
          safeType = "建築";
        }
      }
    } catch (_) {}

    return {
      type: safeType,
      mainCategory: "",
      subCategory: "",
      detailCategory: "",
      tags: []
    };
  }
};
