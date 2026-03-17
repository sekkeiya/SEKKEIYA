/**
 * Normalizes file extensions into standardized AI Drive asset types and categories.
 * 
 * @param {string} filename The name of the file
 * @returns {{ type: string, category: string }}
 */
export const normalizeAssetType = (filename) => {
  if (!filename) return { type: "unknown", category: "Uncategorized" };
  
  const extMatch = filename.match(/\.([a-zA-Z0-9]+)$/);
  const ext = (extMatch ? extMatch[1] : "").toLowerCase();

  switch (ext) {
    case "glb":
    case "gltf":
    case "obj":
    case "fbx":
      return { type: "3d_model", category: "Models" };
      
    case "pdf":
    case "doc":
    case "docx":
    case "txt":
    case "csv":
      return { type: "document", category: "Documents" };
      
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
      return { type: "image", category: "Images" };
      
    case "mp4":
    case "webm":
    case "mov":
      return { type: "video", category: "Videos" };
      
    case "dwg":
    case "dxf":
      return { type: "cad", category: "Architectural Plans" };
      
    default:
      return { type: "unknown", category: "Uncategorized" };
  }
};
