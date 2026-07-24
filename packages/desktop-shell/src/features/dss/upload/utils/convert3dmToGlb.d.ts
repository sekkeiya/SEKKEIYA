/**
 * convert3dmToGlb.js の型宣言。実装の resolve 値に合わせている。
 * 実装を変更したらここも更新すること。
 */

/** Rhino の .3dm を GLB へ変換し、GLB の File を返す。変換不能なら reject。 */
export function convert3dmToGlb(file: File): Promise<File>;
