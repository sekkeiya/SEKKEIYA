import { 
  TYPES, 
  TAXONOMY,
  categoryOptions, 
  categoryOptionsArchitecture, 
  categoryOptionsArchitectureParts, 
  categoryOptionsArchitectureOutside 
} from '../constants/Categories';
import { ruleBasedClassify } from '../../utils/aiAutoFillService';

/**
 * 1. normalizeTitle
 * Removes raw extensions, common versioning suffixes, and unwanted symbols to create a readable title.
 */
export const normalizeTitle = (filename) => {
  if (!filename) return "";
  let title = filename.toLowerCase();
  
  // Remove known 3D extensions
  title = title.replace(/\.(glb|gltf|fbx|obj|3dm|blend|skp)$/i, '');
  
  // Remove common suffixes like _v1, _final, -lowpoly
  title = title.replace(/[_-]?(v\d+|final|lowpoly|highpoly|test|demo)$/i, '');
  
  // _ - . をスペースに置換
  title = title.replace(/[_\-\.]/g, ' ');
  
  // 連続スペース圧縮
  title = title.replace(/\s+/g, ' ');
  
  return title.trim();
};

/**
 * 2. tokenizeFilename
 * Splits the normalized title into searchable lowercase keywords, considering
 * path separators, underscores, hyphens, spaces, and camelCase boundaries.
 */
export const tokenizeFilename = (normalizedTitle) => {
  // 1. Convert camelCase to space separated (e.g., LivingRoom -> Living Room)
  const spacedTitle = normalizedTitle.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // 2. Split by space (since we normalized symbols to space)
  return spacedTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
};

/**
 * 3. inferType
 * Uses tokens to strongly guess if it's Architecture or Furniture.
 */
export const inferType = (tokens, ext = "") => {
  const archStrong = ['villa', 'mansion', 'apartment', 'house', 'building', '住宅', 'マンション', '別荘', 'ビル', '建物'];
  const furnStrong = ['sofa', 'chair', 'table', 'desk', 'bed', 'cabinet', 'shelf', 'pc', 'keyboard', 'display'];

  const archKeywords = ['room', 'office', '建築', '部屋', '外観', '内観', 'ドア', '窓', '屋根', '壁', '店舗', 'カフェ', '施設', 'door', 'wall', 'window', 'frame', 'panel', 'slab'];
  const furnKeywords = ['ソファ', 'チェア', '椅子', '机', 'テーブル', 'ベッド', 'キャビネット', '収納', '棚', '照明', 'furniture', '家具'];
  
  let archScore = 0;
  let furnScore = 0;
  
  tokens.forEach(t => {
    // High weights
    if (archStrong.some(kw => t.includes(kw))) archScore += 10;
    if (furnStrong.some(kw => t.includes(kw))) furnScore += 10;
    // Normal weights
    if (archKeywords.some(kw => t.includes(kw))) archScore += 1;
    if (furnKeywords.some(kw => t.includes(kw))) furnScore += 1;
  });
  
  if (furnScore > 0 && furnScore >= archScore) return TYPES.FURNITURE;
  if (archScore > 0) return TYPES.ARCHITECTURE;
  
  // Extension hints
  const lowerExt = ext.toLowerCase();
  if (lowerExt === 'gh') return "その他";
  if (lowerExt === '3dm') return TYPES.ARCHITECTURE;

  return TYPES.FURNITURE; // default
};

/**
 * Helper to flatten and search category structures
 */
const searchDictionary = (dictionary, tokens) => {
  let matchedMain = null;
  let matchedSub = null;
  let matchedDetail = null;

  for (const [mainCat, mainData] of Object.entries(dictionary)) {
    // Check if main category matches any token
    if (tokens.some(t => mainCat.toLowerCase().includes(t))) {
      matchedMain = mainCat;
    }

    if (mainData.sub) {
      for (const [subCat, detailArray] of Object.entries(mainData.sub)) {
        // Check sub category
        if (tokens.some(t => subCat.toLowerCase().includes(t))) {
          matchedMain = mainCat;
          matchedSub = subCat;
        }

        // Check detail category
        if (Array.isArray(detailArray)) {
          for (const detail of detailArray) {
            if (tokens.some(t => detail.toLowerCase().includes(t))) {
              matchedMain = mainCat;
              matchedSub = subCat;
              matchedDetail = detail;
              break;
            }
          }
        }
      }
    }
  }
  
  return { mainCategory: matchedMain, subCategory: matchedSub, detailCategory: matchedDetail };
};

export const inferCategoriesForType = (type, tokens) => {
  if (type === TYPES.FURNITURE) {
    return searchDictionary(categoryOptions, tokens);
  } else if (type === TYPES.ARCHITECTURE) {
    // For architecture, search through all options (overall, parts, outside)
    const overall = searchDictionary(categoryOptionsArchitecture, tokens);
    if (overall.mainCategory) return overall;
    
    const parts = searchDictionary(categoryOptionsArchitectureParts, tokens);
    if (parts.mainCategory) return parts;
    
    const outside = searchDictionary(categoryOptionsArchitectureOutside, tokens);
    if (outside.mainCategory) return outside;
  }
  
  return { mainCategory: null, subCategory: null, detailCategory: null };
};

/**
 * 4. inferMainCategory
 * Extracted explicitly for the requested modularity.
 */
export const inferMainCategory = (type, tokens) => {
  const result = inferCategoriesForType(type, tokens);
  return result.mainCategory;
};

/**
 * 5. inferSubCategory
 */
export const inferSubCategory = (type, tokens) => {
  const result = inferCategoriesForType(type, tokens);
  return result.subCategory;
};

/**
 * 6. inferDetailCategory
 */
export const inferDetailCategory = (type, tokens) => {
  const result = inferCategoriesForType(type, tokens);
  return result.detailCategory;
};

/**
 * 7. generateRuleTags
 * Create tags based on tokens, dimensions, and type.
 */
export const generateRuleTags = (tokens, ext, dimensions, inferredCategories) => {
  const tags = new Set();
  
  // Add original tokens as potential tags (filter short numeric ones)
  tokens.forEach(t => {
    if (t.length > 2 && !/^\d+$/.test(t)) {
      tags.add(t);
    }
  });
  
  if (ext) tags.add(ext.replace('.', '').toUpperCase());
  
  if (dimensions && dimensions.width && dimensions.depth && dimensions.height) {
    // Generate scale tag or bounding box desc if needed
    const maxDim = Math.max(dimensions.width, dimensions.depth, dimensions.height);
    if (maxDim < 500) tags.add("小物");
    else if (maxDim > 2000) tags.add("大型");
  }

  // Add category names if they exist
  if (inferredCategories.mainCategory) tags.add(inferredCategories.mainCategory);
  if (inferredCategories.subCategory) tags.add(inferredCategories.subCategory);
  if (inferredCategories.detailCategory) tags.add(inferredCategories.detailCategory);

  return Array.from(tags).slice(0, 5); // Keep top 5 tags max for default
};

/**
 * Main Controller Function
 */
export const extractDefaultMetadata = (filename, ext, dimensions) => {
  const title = normalizeTitle(filename);
  const tokens = tokenizeFilename(title);
  
  const type = inferType(tokens);
  
  const categories = inferCategoriesForType(type, tokens);
  const mainCategory = categories.mainCategory || "";
  const subCategory = categories.subCategory || "";
  const detailCategory = categories.detailCategory || "";
  
  const tags = generateRuleTags(tokens, ext, dimensions, categories);

  return {
    title,
    type,
    mainCategory,
    subCategory,
    detailCategory,
    tags
  };
};

import { ALIAS_DICT } from '../constants/CategoryAliasDict';
// 1. Generate flat category index from TAXONOMY
const generateCategoryIndex = () => {
  const index = [];
  
  if (!TAXONOMY) return index; // Safety

  for (const [typeKey, typeData] of Object.entries(TAXONOMY)) {
    const typeLabel = typeKey === TYPES.FURNITURE ? "家具" : "建築";
    
    if (typeData.datasets) {
      for (const dataset of Object.values(typeData.datasets)) {
        if (!dataset) continue;
        for (const [mainCat, mainData] of Object.entries(dataset)) {
          if (!mainCat) continue;
          index.push({
            term: mainCat.toLowerCase(),
            metadata: { type: typeLabel, mainCategory: mainCat, subCategory: "", detailCategory: "" },
            depth: 1
          });
          
          if (mainData.sub) {
            for (const [subCat, details] of Object.entries(mainData.sub)) {
              if (!subCat) continue;
              index.push({
                term: subCat.toLowerCase(),
                metadata: { type: typeLabel, mainCategory: mainCat, subCategory: subCat, detailCategory: "" },
                depth: 2
              });
              
              if (Array.isArray(details)) {
                for (const detail of details) {
                  if (!detail) continue;
                  index.push({
                    term: detail.toLowerCase(),
                    metadata: { type: typeLabel, mainCategory: mainCat, subCategory: subCat, detailCategory: detail },
                    depth: 3
                  });
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Sort by depth descending (deepest first), then term length descending
  index.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return b.term.length - a.term.length;
  });
  
  return index;
};

const CATEGORY_INDEX = generateCategoryIndex();
const SORTED_ALIASES = Object.entries(ALIAS_DICT).sort((a, b) => b[0].length - a[0].length);

const generateDynamicIndex = (mergedCategoryMap) => {
  if (!mergedCategoryMap) return CATEGORY_INDEX;
  const index = [];
  for (const [typeLabel, categories] of Object.entries(mergedCategoryMap)) {
    if (!categories) continue;
    for (const [mainCat, subs] of Object.entries(categories)) {
      if (!mainCat) continue;
      index.push({
        term: mainCat.toLowerCase(),
        metadata: { type: typeLabel, mainCategory: mainCat, subCategory: "", detailCategory: "" },
        depth: 1
      });
      if (Array.isArray(subs)) {
        for (const subCat of subs) {
          if (!subCat) continue;
          index.push({
            term: subCat.toLowerCase(),
            metadata: { type: typeLabel, mainCategory: mainCat, subCategory: subCat, detailCategory: "" },
            depth: 2
          });
        }
      }
    }
  }
  index.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    return b.term.length - a.term.length;
  });
  return index;
};

/**
 * 8. autoFillModelMetadata
 * Main entry point for rule-based extraction leveraging file and folder path.
 */
export const autoFillModelMetadata = (file, existingTags = [], dimensions = null, mergedCategoryMap = null) => {
  // Extract folder hierarchy if available (e.g. dropped via folder)
  const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split(/[\/\\]/) : [];
  const folders = pathParts.slice(0, -1);
  const title = normalizeTitle(file.name);
  const ext = file.name.split('.').pop() || '';
  
  const rawFolders = folders.join(' ').toLowerCase();
  const rawTitle = title.toLowerCase();
  
  const rawString = [...folders, title].join(' ');
  const tokens = tokenizeFilename(rawString);
  
  let type = "";
  let mainCategory = "";
  let subCategory = "";
  let detailCategory = "";
  let ruleApplied = { type: false, mainCategory: false, subCategory: false, detailCategory: false, tags: false };
  let matchInfo = null;

  const currentIndex = generateDynamicIndex(mergedCategoryMap);

  // Inference priority: Try to find any match, but if multiple matches exist, prioritize 家具 > 建築.
  const findMatch = () => {
    let bestMatch = null;
    const evaluate = (match) => {
      if (!match) return;
      if (!bestMatch) {
         bestMatch = match;
      } else {
         // Prioritize Furniture over Architecture over その他
         if (bestMatch.type !== "家具" && match.type === "家具") bestMatch = match;
         else if (bestMatch.type === "その他" && match.type === "建築") bestMatch = match;
      }
    };

    if (rawFolders) {
      for (const item of currentIndex) {
        if (rawFolders.includes(item.term)) evaluate({ source: "folder-taxonomy", match: item.term, ...item.metadata });
      }
    }
    if (rawTitle) {
      for (const item of currentIndex) {
        if (rawTitle.includes(item.term)) evaluate({ source: "filename-taxonomy", match: item.term, ...item.metadata });
      }
    }
    if (rawFolders) {
      for (const [key, alias] of SORTED_ALIASES) {
        if (rawFolders.includes(key)) evaluate({ source: "folder-alias", match: key, ...alias });
      }
    }
    if (rawTitle) {
      for (const [key, alias] of SORTED_ALIASES) {
        if (rawTitle.includes(key)) evaluate({ source: "filename-alias", match: key, ...alias });
      }
    }
    return bestMatch;
  };

  matchInfo = findMatch();

  if (matchInfo) {
    if (matchInfo.type) type = matchInfo.type;
    if (matchInfo.mainCategory) mainCategory = matchInfo.mainCategory;
    if (matchInfo.subCategory) subCategory = matchInfo.subCategory;
    if (matchInfo.detailCategory) detailCategory = ""; // Obsolete
  }

  // 5. Fallback Extension hints for type if completely unmatched
  if (!type && ext) {
    const extHint = inferType([], ext);
    if (extHint) type = extHint; // uses inferType fallback rule (.3dm -> 建築, .gh -> その他)
  }

  // Final fallback to generic token keywords if STILL no type matched (e.g. general terms)
  if (!type) {
    type = inferType(tokens, ext);
  }

  if (mainCategory) ruleApplied.mainCategory = true;
  if (subCategory) ruleApplied.subCategory = true;
  if (type) ruleApplied.type = true;
  
  // Generate tags based on everything
  const generatedTags = generateRuleTags(tokens, ext, dimensions, { mainCategory, subCategory, detailCategory: "" });
  if (generatedTags.length > 0) ruleApplied.tags = true;
  
  // Combine with existing tags
  const tagsSet = new Set([...existingTags, ...generatedTags]);

  // Execute secondary AI classifications
  const aiClassified = ruleBasedClassify(title, Array.from(tagsSet));
  
  if (aiClassified.type && !type) type = aiClassified.type;
  if (aiClassified.mainCategory && !mainCategory) mainCategory = aiClassified.mainCategory;
  if (aiClassified.subCategory && !subCategory) subCategory = aiClassified.subCategory;

  const result = {
    title,          // Pass title back so we can still use it for UI
    type,
    mainCategory,
    subCategory,
    detailCategory: "", // Obsolete
    tags: Array.from(new Set([...tagsSet, ...(aiClassified.newTags || [])])).slice(0, 10),
    rooms: aiClassified.rooms || [],
    zones: aiClassified.zones || [],
    materials: aiClassified.materials || [],
    buildingTypes: aiClassified.buildingTypes || [],
    companionClasses: aiClassified.companionClasses || [],
    ruleApplied
  };

  return result;
};
