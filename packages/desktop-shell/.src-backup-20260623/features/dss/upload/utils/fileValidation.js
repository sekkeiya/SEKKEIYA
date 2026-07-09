// モデルファイルの拡張子バリデーション
export const isValidModelFile = (fileName) => {
    const allowedExtensions = ['.3dm', '.glb', '.skp', '.blend', '.gh'];
    return allowedExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

// サムネイル画像の拡張子バリデーション
export const isValidImageFile = (fileName) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    return allowedExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};
