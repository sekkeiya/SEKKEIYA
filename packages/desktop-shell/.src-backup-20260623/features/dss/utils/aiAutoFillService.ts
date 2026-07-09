import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// ---- Type Definitions ----
export interface AutoFillResult {
  dimensions?: { width: string; depth: string; height: string };
  mainCategory?: string;
  subCategory?: string;
  detailedCategory?: string;
  type?: 'Furniture' | 'Architecture' | 'Uncategorized';
  tags?: string[];
  materials?: string[];
  buildingTypes?: string[];
  rooms?: string[];
  zones?: string[];
  companionClasses?: string[];
  autoFilledFields: string[]; // Track which fields were auto-filled to show highlights
}

// ---- Dimension Extractor (Three.js bounding box) ----
export async function extractDimensionsFromGlb(url: string | null): Promise<AutoFillResult['dimensions'] | null> {
  if (!url) return null;

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      url,
      (gltf) => {
        try {
          const box = new THREE.Box3().setFromObject(gltf.scene);
          // If the box is extremely small (e.g., max distance < 15), it's highly likely it's in meters.
          // Standard web 3D (and Three.js) assumes 1 unit = 1 meter.
          // We convert it to millimeters (mm) by multiplying by 1000.
          // If it's already large, maybe it was exported natively in mm from Rhino.
          
          let size = new THREE.Vector3();
          box.getSize(size);
          
          let w = size.x;
          let d = size.z;  // typically Z is depth in WebGL, or Y depending on up-axis
          let h = size.y;  // typically Y is height

          // Three.js GLTFLoader converts generic up-axis to Y-up automatically
          
          const maxDim = Math.max(w, d, h);
          let scaleFactor = 1000; // Assume meters for GLB standard

          if (maxDim > 50) {
            // If the max dimension is > 50 units, it's likely already in mm or cm.
            // Let's assume mm if it's > 50. E.g. A 500mm chair.
            scaleFactor = 1;
          }

          resolve({
            width: Math.round(w * scaleFactor).toString(),
            height: Math.round(h * scaleFactor).toString(),
            depth: Math.round(d * scaleFactor).toString(), // Using Z for depth
          });
        } catch (e) {
          console.error("Error calculating bounding box:", e);
          resolve(null);
        }
      },
      undefined,
      (error) => {
        console.error("Failed to load GLB for dimension extraction:", error);
        resolve(null);
      }
    );
  });
}

const KEYWORD_MAP: Record<string, { main: string, sub: string, detailed?: string, type: 'Furniture' | 'Architecture' | 'Uncategorized', rooms?: string[], zones?: string[], buildingTypes?: string[], companionClasses?: string[] }> = {
  // Furniture (Ready-made)
  "chair": { type: 'Furniture', main: '家具 (既製品)', sub: 'チェア', rooms: ['ダイニング', '書斎', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "チェアー": { type: 'Furniture', main: '家具 (既製品)', sub: 'チェア', rooms: ['ダイニング', '書斎', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "チェア": { type: 'Furniture', main: '家具 (既製品)', sub: 'チェア', rooms: ['ダイニング', '書斎', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "椅子": { type: 'Furniture', main: '家具 (既製品)', sub: 'チェア', rooms: ['ダイニング', '書斎', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "sofa": { type: 'Furniture', main: '家具 (既製品)', sub: 'ソファ', rooms: ['リビング', '応接室', 'ロビー'], zones: ['リラックス', 'コミュニケーション'], companionClasses: ['ソファセット'], buildingTypes: ['住宅', 'ホテル', 'オフィス', '商業施設'] },
  "ソファ": { type: 'Furniture', main: '家具 (既製品)', sub: 'ソファ', rooms: ['リビング', '応接室', 'ロビー'], zones: ['リラックス', 'コミュニケーション'], companionClasses: ['ソファセット'], buildingTypes: ['住宅', 'ホテル', 'オフィス', '商業施設'] },
  "table": { type: 'Furniture', main: '家具 (既製品)', sub: 'テーブル', rooms: ['ダイニング', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "テーブル": { type: 'Furniture', main: '家具 (既製品)', sub: 'テーブル', rooms: ['ダイニング', '会議室'], zones: ['食事', '作業'], companionClasses: ['ダイニングセット', 'デスクセット'], buildingTypes: ['住宅', 'レストラン', 'オフィス'] },
  "desk": { type: 'Furniture', main: '家具 (既製品)', sub: 'テーブル', detailed: 'デスク', rooms: ['書斎', '子供部屋', 'オフィス'], zones: ['作業'], companionClasses: ['デスクセット'], buildingTypes: ['住宅', 'オフィス', '学校'] },
  "デスク": { type: 'Furniture', main: '家具 (既製品)', sub: 'テーブル', detailed: 'デスク', rooms: ['書斎', '子供部屋', 'オフィス'], zones: ['作業'], companionClasses: ['デスクセット'], buildingTypes: ['住宅', 'オフィス', '学校'] },
  "bed": { type: 'Furniture', main: '家具 (既製品)', sub: 'ベッド', rooms: ['寝室', 'ホテル客室'], zones: ['リラックス'], companionClasses: ['ベッドセット'], buildingTypes: ['住宅', 'ホテル'] },
  "ベッド": { type: 'Furniture', main: '家具 (既製品)', sub: 'ベッド', rooms: ['寝室', 'ホテル客室'], zones: ['リラックス'], companionClasses: ['ベッドセット'], buildingTypes: ['住宅', 'ホテル'] },
  "shelf": { type: 'Furniture', main: '家具 (既製品)', sub: '収納・ボード', rooms: ['リビング', '書斎', '店舗'], zones: ['収納'], buildingTypes: ['住宅', 'オフィス', '商業施設'] },
  "棚": { type: 'Furniture', main: '家具 (既製品)', sub: '収納・ボード', rooms: ['リビング', '書斎', '店舗'], zones: ['収納'], buildingTypes: ['住宅', 'オフィス', '商業施設'] },
  "cabinet": { type: 'Furniture', main: '家具 (既製品)', sub: '収納・ボード', rooms: ['リビング', 'オフィス'], zones: ['収納'], buildingTypes: ['住宅', 'オフィス'] },
  "chest": { type: 'Furniture', main: '家具 (既製品)', sub: '収納・ボード', rooms: ['寝室', 'リビング'], zones: ['収納'], buildingTypes: ['住宅'] },
  "board": { type: 'Furniture', main: '家具 (既製品)', sub: '収納・ボード', rooms: ['リビング'], zones: ['リラックス', '収納'], buildingTypes: ['住宅', 'ホテル'] },
  
  // Equipment / Decor
  "light": { type: 'Furniture', main: '設備・備品', sub: '照明器具', rooms: ['リビング', 'ダイニング', '寝室'], zones: ['全般'], buildingTypes: ['住宅', '商業施設', 'ホテル', 'レストラン'] },
  "照明": { type: 'Furniture', main: '設備・備品', sub: '照明器具', rooms: ['リビング', 'ダイニング', '寝室'], zones: ['全般'], buildingTypes: ['住宅', '商業施設', 'ホテル', 'レストラン'] },
  "lamp": { type: 'Furniture', main: '設備・備品', sub: '照明器具', rooms: ['リビング', '寝室', '書斎'], zones: ['全般'], buildingTypes: ['住宅', 'ホテル'] },
  "plant": { type: 'Furniture', main: 'グリーン', sub: 'インテリアグリーン', rooms: ['リビング', 'エントランス'], zones: ['リラックス'], buildingTypes: ['住宅', 'オフィス', '商業施設'] },
  "プランター": { type: 'Furniture', main: 'グリーン', sub: 'インテリアグリーン', rooms: ['屋外', 'バルコニー', 'エントランス'], zones: ['リラックス'], buildingTypes: ['住宅', '商業施設', 'ホテル'] },
  "鉢": { type: 'Furniture', main: 'グリーン', sub: 'インテリアグリーン', rooms: ['屋内', '屋外'], zones: ['リラックス'], buildingTypes: ['住宅', '商業施設'] },
  "植物": { type: 'Furniture', main: 'グリーン', sub: 'インテリアグリーン', rooms: ['リビング', 'エントランス'], zones: ['リラックス'], buildingTypes: ['住宅', 'オフィス', '商業施設'] },
  "観葉植物": { type: 'Furniture', main: 'グリーン', sub: 'インテリアグリーン', rooms: ['リビング', 'エントランス'], zones: ['リラックス'], buildingTypes: ['住宅', 'オフィス', '商業施設'] },
  "rug": { type: 'Furniture', main: 'インテリア小物', sub: 'ファブリック・窓周り', rooms: ['リビング', '寝室'], zones: ['リラックス'], buildingTypes: ['住宅', 'ホテル'] },
  "ラグ": { type: 'Furniture', main: 'インテリア小物', sub: 'ファブリック・窓周り', rooms: ['リビング', '寝室'], zones: ['リラックス'], buildingTypes: ['住宅', 'ホテル'] },  
  // Architecture
  "door": { type: 'Architecture', main: '建築・空間', sub: '建具（内装・外装）', rooms: ['全般'], zones: ['通路'], buildingTypes: ['全般'] },
  "ドア": { type: 'Architecture', main: '建築・空間', sub: '建具（内装・外装）', rooms: ['全般'], zones: ['通路'], buildingTypes: ['全般'] },
  "window": { type: 'Architecture', main: '建築・空間', sub: '建具（内装・外装）', rooms: ['全般'], zones: ['採光'], buildingTypes: ['全般'] },
  "窓": { type: 'Architecture', main: '建築・空間', sub: '建具（内装・外装）', rooms: ['全般'], zones: ['採光'], buildingTypes: ['全般'] },
  "wall": { type: 'Architecture', main: '建築・空間', sub: '構造・躯体' },
  "stair": { type: 'Architecture', main: '建築・空間', sub: '構造・躯体' },
  
  // Vehicles / Externals
  "car": { type: 'Uncategorized', main: '建築・空間', sub: '外構（エクステリア）', rooms: ['駐車場', 'ガレージ', '屋外'], zones: ['駐車', '屋外'], buildingTypes: ['住宅', '商業施設', 'オフィス'], companionClasses: ['車', '車両'] },
  "車": { type: 'Uncategorized', main: '建築・空間', sub: '外構（エクステリア）', rooms: ['駐車場', 'ガレージ', '屋外'], zones: ['駐車', '屋外'], buildingTypes: ['住宅', '商業施設', 'オフィス'], companionClasses: ['車', '車両'] },
  "自動車": { type: 'Uncategorized', main: '建築・空間', sub: '外構（エクステリア）', rooms: ['駐車場', 'ガレージ', '屋外'], zones: ['駐車', '屋外'], buildingTypes: ['住宅', '商業施設', 'オフィス'], companionClasses: ['車', '車両'] },

  // Generic fallback tags
  "家具": { type: 'Furniture', main: '家具 (既製品)', sub: 'ソファ', rooms: ['リビング', '寝室', 'ダイニング'], zones: ['リラックス'], buildingTypes: ['住宅'] },
  "建材": { type: 'Architecture', main: '建築・空間', sub: '構造・躯体', rooms: ['全般'], zones: ['全般'], buildingTypes: ['全般'] }
};

const EXTRACTION_KEYWORDS = {
  colors: [
    { jp: '白', eng: 'white', tag: 'White' },
    { jp: '黒', eng: 'black', tag: 'Black' },
    { jp: '赤', eng: 'red', tag: 'Red' },
    { jp: '青', eng: 'blue', tag: 'Blue' },
    { jp: '黄', eng: 'yellow', tag: 'Yellow' },
    { jp: '緑', eng: 'green', tag: 'Green' },
    { jp: 'グレー', eng: 'gray', tag: 'Gray' },
    { jp: '茶色', eng: 'brown', tag: 'Brown' },
    { jp: 'ナチュラル', eng: 'natural', tag: 'Natural' }
  ],
  materials: [
    { jp: '木製', eng: 'wood', tag: 'Wood' },
    { jp: 'オーク', eng: 'oak', tag: 'Oak' },
    { jp: 'ウォルナット', eng: 'walnut', tag: 'Walnut' },
    { jp: '鉄', eng: 'iron', tag: 'Iron' },
    { jp: 'スチール', eng: 'steel', tag: 'Steel' },
    { jp: 'レザー', eng: 'leather', tag: 'Leather' },
    { jp: 'ファブリック', eng: 'fabric', tag: 'Fabric' },
    { jp: '布', eng: 'cloth', tag: 'Fabric' },
    { jp: 'ガラス', eng: 'glass', tag: 'Glass' }
  ]
};

export function ruleBasedClassify(title: string, currentTags: string[], categoryHint?: string): {
  type?: 'Furniture' | 'Architecture' | 'Uncategorized';
  mainCategory?: string;
  subCategory?: string;
  detailedCategory?: string;
  newTags?: string[];
  materials?: string[];
  rooms?: string[];
  zones?: string[];
  buildingTypes?: string[];
  companionClasses?: string[];
} {
  const safeTitle = title || "";
  const lowerTitle = safeTitle.toLowerCase();
  const allText = [lowerTitle, ...(currentTags || []).map(t => t?.toLowerCase() || ""), categoryHint?.toLowerCase() || ""].join(" ");
  
  const suggestedTags = new Set(currentTags || []);
  const suggestedMaterials = new Set<string>();
  suggestedTags.add("AI Categorized");

  // Extract Colors and Materials from title
  EXTRACTION_KEYWORDS.colors.forEach(item => {
    if (lowerTitle.includes(item.jp) || lowerTitle.includes(item.eng) || allText.includes(item.jp) || allText.includes(item.eng)) {
      suggestedTags.add(item.tag);
    }
  });

  EXTRACTION_KEYWORDS.materials.forEach(item => {
    if (lowerTitle.includes(item.jp) || lowerTitle.includes(item.eng) || allText.includes(item.jp) || allText.includes(item.eng)) {
      suggestedMaterials.add(item.tag);
    }
  });

  // Find the first matching category keyword
  for (const [keyword, categoryInfo] of Object.entries(KEYWORD_MAP)) {
    if (allText.includes(keyword)) {
      return {
        type: categoryInfo.type,
        mainCategory: categoryInfo.main,
        subCategory: categoryInfo.sub,
        detailedCategory: categoryInfo.detailed,
        newTags: Array.from(suggestedTags),
        materials: Array.from(suggestedMaterials),
        rooms: categoryInfo.rooms || [],
        zones: categoryInfo.zones || [],
        buildingTypes: categoryInfo.buildingTypes || [],
        companionClasses: categoryInfo.companionClasses || []
      };
    }
  }

  // If no main category matched, use heuristics
  if (lowerTitle.includes('car') || lowerTitle.includes('車')) {
      suggestedMaterials.add('Steel');
      suggestedMaterials.add('Glass');
  }

  return { 
    newTags: Array.from(suggestedTags), 
    materials: Array.from(suggestedMaterials),
    rooms: ['未分類'], // Default fallback if no match
    zones: ['未分類'],
    buildingTypes: ['未分類']
  };
}

// ---- Main Pipeline Engine ----
export async function executeAiAutoFill(
  title: string,
  currentTags: string[],
  glbUrl: string | null
): Promise<AutoFillResult> {
  const result: AutoFillResult = {
    autoFilledFields: []
  };

  // 1. Rule-based Classification
  const classification = ruleBasedClassify(title, currentTags);
  if (classification.mainCategory) {
    result.mainCategory = classification.mainCategory;
    result.subCategory = classification.subCategory;
    result.detailedCategory = classification.detailedCategory;
    result.type = classification.type;
    result.autoFilledFields.push('mainCategory', 'subCategory', 'type');
  }

  if (classification.newTags && classification.newTags.length > 0) {
    result.tags = classification.newTags;
    if (classification.newTags.length > currentTags.length) {
      result.autoFilledFields.push('tags');
    }
  }

  if (classification.materials && classification.materials.length > 0) {
    result.materials = classification.materials;
    result.autoFilledFields.push('materials');
  }

  if (classification.rooms && classification.rooms.length > 0) {
    result.rooms = classification.rooms;
    result.autoFilledFields.push('rooms');
  }
  
  if (classification.zones && classification.zones.length > 0) {
    result.zones = classification.zones;
    result.autoFilledFields.push('zones');
  }

  if (classification.buildingTypes && classification.buildingTypes.length > 0) {
    result.buildingTypes = classification.buildingTypes;
    result.autoFilledFields.push('buildingTypes');
  }

  if (classification.companionClasses && classification.companionClasses.length > 0) {
    result.companionClasses = classification.companionClasses;
    result.autoFilledFields.push('companionClasses');
  }

  // 2. Bounding Box Extraction
  if (glbUrl) {
    const dimensions = await extractDimensionsFromGlb(glbUrl);
    if (dimensions && (dimensions.width !== '0' && dimensions.height !== '0')) {
      result.dimensions = dimensions;
      result.autoFilledFields.push('width', 'depth', 'height');
    }
  }

  return result;
}
