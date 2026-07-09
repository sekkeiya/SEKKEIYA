import { getAssetsFromDrive, getAssetsFrom3DSS, getAssetsFrom3DSC, getUploadedAssets } from './mockAssetsApi';
import { getRealAssetsFrom3DSS, getRealUploadedAssets } from './realAssetsApi';

// Toggle to true/false globally, or control per-source
const USE_MOCK_ASSETS = {
  aiDrive: true,
  '3dss': false, // Switched to REAL Firebase backend
  '3dsc': true,
  upload: true
};

/**
 * Standardize varied asset shapes to a strict common Asset type.
 * Common Asset Properties:
 * - id: string
 * - source: 'aiDrive' | '3dss' | '3dsc' | 'upload'
 * - assetType: 'image' | 'model' | 'document' | 'generatedImage'
 * - title: string
 * - thumbnailUrl: string
 * - previewUrl: string (optional)
 * - description: string (optional)
 * - metadata: object (optional)
 * - originalRef: string (optional)
 * - createdAt: string (optional)
 * - updatedAt: string (optional)
 */
const formatAsset = (rawAsset, source, assetType) => ({
  id: rawAsset.id || `${source}-${Date.now()}-${Math.random()}`,
  source,
  assetType,
  title: rawAsset.title || 'Untitled',
  thumbnailUrl: rawAsset.thumbnail || rawAsset.url || rawAsset.thumbnailUrl || '',
  previewUrl: rawAsset.url || rawAsset.glbPath || rawAsset.previewUrl || '',
  description: rawAsset.description || '',
  metadata: rawAsset.metadata || {},
  originalRef: rawAsset.originalRef || rawAsset.id || null,
  createdAt: rawAsset.createdAt || new Date().toISOString(),
  updatedAt: rawAsset.updatedAt || new Date().toISOString(),
});

export const fetchAssetsBySource = async (source) => {
  try {
    const isMock = USE_MOCK_ASSETS[source];
    if (isMock) {
      let rawAssets = [];
      switch (source) {
        case 'aiDrive':
          rawAssets = await getAssetsFromDrive();
          return rawAssets.map(a => formatAsset(a, 'aiDrive', 'image'));
        case '3dss':
          rawAssets = await getAssetsFrom3DSS();
          return rawAssets.map(a => formatAsset(a, '3dss', 'model'));
        case '3dsc':
          rawAssets = await getAssetsFrom3DSC();
          return rawAssets.map(a => formatAsset(a, '3dsc', 'model'));
        case 'upload':
          rawAssets = await getUploadedAssets();
          return rawAssets.map(a => formatAsset(a, 'upload', 'image'));
        default:
          return [];
      }
    } else {
      let rawAssets = [];
      // Real implementation bridge
      switch (source) {
        case 'upload':
          rawAssets = await getRealUploadedAssets();
          return rawAssets.map(a => formatAsset(a, 'upload', 'image'));
        case '3dss':
          rawAssets = await getRealAssetsFrom3DSS();
          return rawAssets.map(a => formatAsset(a, '3dss', 'model'));
        default:
          return []; // fallback for unsupported real sources
      }
    }
  } catch (err) {
    console.error(`Asset fetch failed for source: ${source}`, err);
    throw err;
  }
};
