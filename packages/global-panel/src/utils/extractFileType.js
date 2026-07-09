/**
 * 3DSS の古いモデルドキュメントから、優先度 (3DM > GLB > BLEND) に基づいて
 * 実体のファイルタイプを判定する（boardItemAdaptersから分離）。
 * 
 * @param {Object} doc - Firestoreドキュメント (主に3DSSのモデルデータ)
 * @returns {string} 判定されたファイルタイプ文字列の大文字形式 ('3DM', 'GLB', 'UNKNOWN' 等)
 */
export function extractFileType(doc) {
  if (!doc) return "UNKNOWN";

  // 1. ext フィールドが明示的にあればそれを優先
  if (doc.ext && typeof doc.ext === 'string') {
    return doc.ext.toUpperCase();
  }
  
  // 2. 3DSS 固有のフラグプロパティから推測
  if (doc?.has3dm || doc?.["3dm"] || Number(doc?.size3dm) > 0 || Number(doc?.size3dmMB) > 0) return "3DM";
  if (doc?.hasGlb || doc?.["glb"] || Number(doc?.sizeGlb) > 0 || Number(doc?.sizeGlbMB) > 0) return "GLB";
  if (doc?.hasBlend || doc?.["blend"] || Number(doc?.sizeBlend) > 0 || Number(doc?.sizeBlendMB) > 0) return "BLEND";
  
  // 3. files 配列がある場合
  if (doc?.files && Array.isArray(doc.files) && doc.files.length > 0 && typeof doc.files[0] === 'string') {
    return String(doc.files[0]).toUpperCase();
  }
  
  return "UNKNOWN";
}
