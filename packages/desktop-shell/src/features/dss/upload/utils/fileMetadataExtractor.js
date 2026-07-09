import { 
  TYPES, 
  TAXONOMY,
  categoryOptions, 
  categoryOptionsArchitecture, 
  categoryOptionsArchitectureParts, 
  categoryOptionsArchitectureOutside 
} from '../constants/Categories';
import { ruleBasedClassify } from '../../utils/aiAutoFillService';
import {
  isNoiseToken,
  buildCleanTitle,
  smartClassify,
  meaningfulPathTokens,
  defaultSubFor,
} from './smartCategoryEngine';

/**
 * 1. normalizeTitle
 * Removes raw extensions, common versioning suffixes, and unwanted symbols to create a readable title.
 */
export const normalizeTitle = (filename) => {
  if (!filename) return "";
  let title = filename;

  // Remove known 3D extensions
  title = title.replace(/\.(glb|gltf|fbx|obj|3dm|blend|skp)$/i, '');

  // CamelCase / 数字境界を分割 (小文字化の前に行う: SlidingDoor -> Sliding Door)
  title = title.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  title = title.replace(/([A-Za-z])(\d)/g, '$1 $2');

  // ここで小文字化
  title = title.toLowerCase();

  // Remove common suffixes like _v1, _final, -lowpoly
  title = title.replace(/[_-]?(v\d+|final|lowpoly|highpoly|test|demo)$/i, '');

  // _ - . / をスペースに置換
  title = title.replace(/[_\-\.\/\\]/g, ' ');

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
export const generateRuleTags = (tokens, ext, dimensions, inferredCategories = {}) => {
  const tags = new Set();

  // ファイル名由来の意味のあるトークンのみタグ化 (ID・拡張子・連番等は除外)
  (tokens || []).forEach(t => {
    if (t && t.length > 2 && !isNoiseToken(t)) {
      tags.add(t);
    }
  });

  // 寸法からサイズ感タグ
  if (dimensions && dimensions.width && dimensions.depth && dimensions.height) {
    const maxDim = Math.max(Number(dimensions.width), Number(dimensions.depth), Number(dimensions.height));
    if (maxDim && maxDim < 500) tags.add("小物");
    else if (maxDim > 2000) tags.add("大型");
  }

  return Array.from(tags).slice(0, 6);
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
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  // 意味のあるトークンを抽出する。フォルダ名(例: chair_modern_oak_001)も説明として活用しつつ、
  // ドライブ・OSユーザー名(C:\Users\<name>)・構造フォルダ・視点名(front)はノイズとして除外。
  const pathTokens = meaningfulPathTokens(file.name);
  const droppedFolderTokens = file.webkitRelativePath
    ? meaningfulPathTokens(file.webkitRelativePath)
    : [];
  const cleanTokens = [...new Set([...droppedFolderTokens, ...pathTokens])];

  // 部分一致照合用
  const rawString = cleanTokens.join(' ');
  const tokenSet = new Set(cleanTokens);

  let macroCategory = "";
  let mainCategory = "";
  let subCategory = "";

  // 2. スマート分類 (英日キーワード → 正式な macro/main/sub)
  const smart = smartClassify(rawString, tokenSet);
  if (smart) {
    macroCategory = smart.macro || "";
    mainCategory = smart.main || "";
    subCategory = smart.sub || "";
  }

  // 3. ユーザー自身のタクソノミー(カスタム含む)で補完 — カテゴリ名そのものが
  //    ファイル名/フォルダ名に含まれるケースを拾う
  if (!mainCategory) {
    const currentIndex = generateDynamicIndex(mergedCategoryMap);
    for (const idx of currentIndex) {
      if (idx.term && idx.term.length > 1 && rawString.includes(idx.term)) {
        macroCategory = macroCategory || idx.metadata.type || "";
        mainCategory = idx.metadata.mainCategory || "";
        if (idx.metadata.subCategory) subCategory = idx.metadata.subCategory;
        break;
      }
    }
  }

  // 3.5 サブ未確定なら、メインの代表サブを既定値として補う (詳細欄を空のままにしない)
  if (mainCategory && !subCategory) {
    subCategory = defaultSubFor(macroCategory, mainCategory, mergedCategoryMap);
  }

  const ruleApplied = {
    type: !!macroCategory,
    macroCategory: !!macroCategory,
    mainCategory: !!mainCategory,
    subCategory: !!subCategory,
    tags: false,
  };

  // 4. 表示タイトル: ファイル名由来トークンから簡潔に生成 (最大4語)。
  //    全てゴミなら推定カテゴリ名で代替。
  let title = buildCleanTitle(cleanTokens.slice(0, 4));
  if (!title) title = subCategory || mainCategory || "無題の3Dモデル";

  // 5. タグ (ノイズ除去済み)
  const generatedTags = generateRuleTags(cleanTokens, ext, dimensions, { mainCategory, subCategory });
  if (generatedTags.length > 0) ruleApplied.tags = true;

  const tagsSet = new Set(
    [...(existingTags || []), ...generatedTags].filter(t => t && !isNoiseToken(String(t)))
  );

  // 6. 二次的な空間・素材の補完 (rooms/zones/materials)。未一致時は空配列を返す
  const aiClassified = ruleBasedClassify(title, Array.from(tagsSet));

  return {
    title,
    macroCategory,
    mainCategory,
    subCategory,
    detailCategory: "", // Obsolete
    tags: Array.from(new Set([...tagsSet, ...(aiClassified.newTags || [])]))
      .filter(t => t && !isNoiseToken(String(t)))
      .slice(0, 8),
    rooms: aiClassified.rooms || [],
    zones: aiClassified.zones || [],
    materials: aiClassified.materials || [],
    buildingTypes: aiClassified.buildingTypes || [],
    companionClasses: aiClassified.companionClasses || [],
    ruleApplied,
  };
};
