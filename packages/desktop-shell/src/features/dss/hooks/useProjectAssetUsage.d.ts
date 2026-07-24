/**
 * useProjectAssetUsage.js の型宣言。
 * 実装（.js）の戻り値に合わせて記述している。実装を変更したらここも更新すること。
 */

/** どのレイアウト（Base / Plan / Option）で何個使われているか。 */
export interface AssetUsageLocation {
  optionId: string;
  /** 例: 'Base A / Plan 1 / Option A' */
  pathName: string;
  count: number;
}

export interface AssetUsageInfo {
  totalCount: number;
  locations: AssetUsageLocation[];
}

/** assetId -> 使用状況。 */
export type AssetUsageMap = Record<string, AssetUsageInfo>;

export function useProjectAssetUsage(args: {
  projectId?: string | null;
  /** 既定は 'layout'。 */
  workspaceId?: string;
}): {
  usageMap: AssetUsageMap;
  loading: boolean;
  error: unknown;
};
