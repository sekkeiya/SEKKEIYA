/**
 * imageThumbnail.ts
 *
 * 大きな PNG data URL を localStorage にそのまま入れると 1〜2 MB/枚 で
 * 数枚しか保存できないため、履歴用に小さな JPEG サムネイルを生成する。
 */

/**
 * 画像 data URL を最大 maxWidth × maxHeight に縮小し、JPEG として再エンコードした
 * data URL を返す（アスペクト比は維持）。
 */
export async function makeHistoryThumbnail(
  dataUrl: string,
  maxWidth = 1280,
  maxHeight = 720,
  quality = 0.85,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error('failed to load image for thumbnail'));
    img.src = dataUrl;
  });
}
