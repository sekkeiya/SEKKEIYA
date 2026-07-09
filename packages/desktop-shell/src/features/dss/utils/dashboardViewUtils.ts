import { getCanonicalModelId } from './modelUtils';

export interface UsageLocation {
  optionId: string;
  pathName: string;
  count: number;
}

export interface UsageInfo {
  totalCount: number;
  locations: UsageLocation[];
}

export interface DedupedAsset {
  item: any; // The primary project asset doc
  usageInfo: UsageInfo;
}

export interface LayoutAssetGroup {
  pathName: string; // The layout path string, e.g., '未配置', 'Plan 1 / A-1'
  items: DedupedAsset[];
}

/**
 * Builds a deduplicated list of unique assets based on sourceModelId.
 * Aggregates the separate usage values into a single usageInfo struct.
 */
export function buildDedupedAssetsView(
  projectAssets: any[],
  usageMap: Record<string, UsageInfo | number>
): DedupedAsset[] {
  const map = new Map<string, { item: any; duplicateIds: string[]; allAssets: any[] }>();

  projectAssets.forEach((asset) => {
    let uniqueKey = asset.name || asset.title || asset.metadata?.sourceModelId || asset.entityId;

    if (!uniqueKey) {
      const canonical = getCanonicalModelId(asset);
      if (canonical && canonical !== asset.id) {
        uniqueKey = canonical;
      }
    }

    if (!uniqueKey) {
      uniqueKey = asset.id;
    }

    if (!map.has(uniqueKey)) {
      map.set(uniqueKey, { item: asset, duplicateIds: [asset.id], allAssets: [asset] });
    } else {
      map.get(uniqueKey)!.duplicateIds.push(asset.id);
      map.get(uniqueKey)!.allAssets.push(asset);
    }
  });

  return Array.from(map.values()).map(({ item, duplicateIds, allAssets }) => {
    let totalCount = 0;
    const locationsMap = new Map<string, UsageLocation>();

    for (const did of duplicateIds) {
      const uInfo = usageMap[did];
      if (!uInfo) continue;

      if (typeof uInfo === 'object') {
        totalCount += uInfo.totalCount || 0;
        (uInfo.locations || []).forEach((loc) => {
          if (!locationsMap.has(loc.optionId)) {
            locationsMap.set(loc.optionId, { ...loc });
          } else {
            locationsMap.get(loc.optionId)!.count += loc.count;
          }
        });
      } else if (typeof uInfo === 'number') {
        totalCount += uInfo;
      }
    }

    const mergedItem = { ...item };
    mergedItem.files = item.files ? { ...item.files } : {};
    
    allAssets.forEach(a => {
      let ext = (a.ext || a.format || '').toLowerCase();
      const url = a.modelUrl || a.url || a.fileUrl || a.downloadUrl || a.metadata?.modelUrl || '';
      
      if (!ext && url) {
        ext = url.split('.').pop()?.toLowerCase().replace(/\?.*$/, '') || '';
      }
      
      if (ext && ext.length <= 5) {
         if (!mergedItem.files[ext]) {
             mergedItem.files[ext] = { url, size: a.size || a.fileSize || 0 };
         }
      }
      
      if (a === item) return;
      
      if (a.files && typeof a.files === 'object' && !Array.isArray(a.files)) {
         mergedItem.files = { ...mergedItem.files, ...a.files };
      }
      
      if (a.glbUrl && !mergedItem.glbUrl) mergedItem.glbUrl = a.glbUrl;
      if (a.blendUrl && !mergedItem.blendUrl) mergedItem.blendUrl = a.blendUrl;
    });

    return {
      item: mergedItem,
      usageInfo: {
        totalCount,
        locations: Array.from(locationsMap.values()).sort((a, b) =>
          a.pathName.localeCompare(b.pathName)
        ),
      },
    };
  });
}

/**
 * Builds sections mapped to each Layout path.
 * If an asset is used in multiple layouts, it will appear under each layout's section.
 * Within a single layout section, assets are deduplicated.
 */
export function buildGroupedLayoutUsageView(
  projectAssets: any[],
  usageMap: Record<string, UsageInfo | number>
): LayoutAssetGroup[] {
  const dedupedGlobals = buildDedupedAssetsView(projectAssets, usageMap);

  const groupsMap = new Map<string, DedupedAsset[]>();
  const UNPLACED_KEY = '未配置';

  // Make sure '未配置' group exists initially so it's always ordered if it has items
  groupsMap.set(UNPLACED_KEY, []);

  dedupedGlobals.forEach((deduped) => {
    const { usageInfo } = deduped;
    
    if (!usageInfo.locations || usageInfo.locations.length === 0) {
      // Put in unplaced group
      groupsMap.get(UNPLACED_KEY)!.push(deduped);
    } else {
      // Put in each specific path
      usageInfo.locations.forEach((loc) => {
        if (!groupsMap.has(loc.pathName)) {
          groupsMap.set(loc.pathName, []);
        }
        // Push a shallow clone, though they refer to the same item
        groupsMap.get(loc.pathName)!.push(deduped);
      });
    }
  });

  // Sort items within each group by Name (ascending)
  // Name fallback order: item.name -> item.metadata.name -> item.title -> ...
  const sortItemsByName = (a: DedupedAsset, b: DedupedAsset) => {
    const nameA = a.item.name || a.item.metadata?.name || a.item.title || '';
    const nameB = b.item.name || b.item.metadata?.name || b.item.title || '';
    return nameA.localeCompare(nameB);
  };

  const finalGroups: LayoutAssetGroup[] = [];

  // Rules:
  // 1. "未配置" always first, if not empty
  // 2. Base / Plan / Option paths follow, alphabetically
  // 3. Keep out empty groups

  const unplacedItems = groupsMap.get(UNPLACED_KEY)!;
  if (unplacedItems.length > 0) {
    unplacedItems.sort(sortItemsByName);
    finalGroups.push({
      pathName: UNPLACED_KEY,
      items: unplacedItems,
    });
  }

  const otherKeys = Array.from(groupsMap.keys())
    .filter((k) => k !== UNPLACED_KEY)
    .sort((a, b) => a.localeCompare(b)); // alphabetical path names

  otherKeys.forEach((key) => {
    const groupItems = groupsMap.get(key)!;
    if (groupItems.length > 0) {
      groupItems.sort(sortItemsByName);
      finalGroups.push({
        pathName: key,
        items: groupItems,
      });
    }
  });

  return finalGroups;
}
