// src/features/save/utils/taxonomyParser.js
import { TYPES, TAXONOMY } from '../../../shared/constants/Categories';

/**
 * Parses the user's prompt into a taxonomy aligned with the 3DSS core.
 * @param {string} domain - The selected generator domain (e.g. 'furniture' or 'architecture')
 * @param {string} prompt - The generation input string
 * @returns {Object} { type, mainCategory, subCategory, detailCategory }
 */
export function parsePromptToTaxonomy(domain, prompt) {
  const typeKey = domain === 'furniture' ? TYPES.FURNITURE : TYPES.ARCHITECTURE;
  const taxonomyNode = TAXONOMY[typeKey];
  
  // 1. Initial Defaults
  let result = {
    type: typeKey,
    mainCategory: typeKey === TYPES.FURNITURE ? '家具その他' : '全体', // Or other default
    subCategory: '未分類',
    detailCategory: '',
  };

  // 2. Early return if empty
  if (!prompt || !taxonomyNode) return result;

  const text = prompt.toLowerCase();
  let bestMatch = null;
  
  // 3. Scan the dictionary sequentially to identify levels
  // Note: We want perfect hits on mainCategory > subCategory > detailCategory recursively inside the taxonomy dataset.
  const datasets = taxonomyNode.datasets || {};
  
  for (const [datasetKey, dataset] of Object.entries(datasets)) {
    // datasetKey = 'default' or '全体'
    for (const [mainCat, mainData] of Object.entries(dataset)) {
      const sub = mainData?.sub || {};
      
      for (const [subCat, detailList] of Object.entries(sub)) {
        // Look for depth 3 (detailCategory)
        const matchedDetail = detailList.find(d => text.includes(d.toLowerCase()));
        if (matchedDetail) {
          if (!bestMatch || bestMatch.weight < 3) {
            bestMatch = { mainCategory: mainCat, subCategory: subCat, detailCategory: matchedDetail, weight: 3 };
          }
        }
        
        // Look for depth 2 (subCategory)
        if (text.includes(subCat.toLowerCase())) {
          if (!bestMatch || bestMatch.weight < 2) {
            bestMatch = { mainCategory: mainCat, subCategory: subCat, detailCategory: '', weight: 2 };
          }
        }
      }
      
      // Look for depth 1 (mainCategory)
      if (text.includes(mainCat.toLowerCase())) {
        if (!bestMatch || bestMatch.weight < 1) {
          bestMatch = { mainCategory: mainCat, subCategory: 'その他', detailCategory: '', weight: 1 };
        }
      }
    }
  }

  // 4. Overwrite defaults with best recognized taxonomy nodes
  if (bestMatch) {
    result.mainCategory = bestMatch.mainCategory;
    result.subCategory = bestMatch.subCategory;
    result.detailCategory = bestMatch.detailCategory;
  }

  return result;
}
