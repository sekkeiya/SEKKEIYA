/**
 * extractDimensionsFromGlb.js の型宣言。実装の JSDoc と戻り値に合わせている。
 * 実装を変更したらここも更新すること。
 */

/** GLB のバウンディングボックスから mm 単位の寸法を求める。 */
export function extractDimensionsFromGlb(glbFile: File): Promise<{
  width: number;
  depth: number;
  height: number;
}>;
