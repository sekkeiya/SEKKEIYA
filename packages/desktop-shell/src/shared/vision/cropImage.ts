// ページ画像から正規化ボックス領域を切り出すヘルパー。

export interface NormBox { xmin: number; ymin: number; xmax: number; ymax: number; }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * dataURL/URL のページ画像から、0..1 正規化ボックス領域を切り出して dataURL を返す。
 * pad は領域を少し広げる余白（0..1、既定 4%）。maxSize で長辺を縮小する。
 */
export async function cropToDataUrl(
  pageSrc: string,
  box: NormBox,
  opts: { pad?: number; maxSize?: number; mime?: string; quality?: number } = {},
): Promise<string | null> {
  const { pad = 0.04, maxSize = 384, mime = 'image/webp', quality = 0.85 } = opts;
  const img = await loadImage(pageSrc);
  const W = img.naturalWidth, H = img.naturalHeight;
  if (!W || !H) return null;

  const x0 = Math.max(0, (box.xmin - pad)) * W;
  const y0 = Math.max(0, (box.ymin - pad)) * H;
  const x1 = Math.min(1, (box.xmax + pad)) * W;
  const y1 = Math.min(1, (box.ymax + pad)) * H;
  const cw = Math.max(1, Math.round(x1 - x0));
  const ch = Math.max(1, Math.round(y1 - y0));

  const scale = Math.min(1, maxSize / Math.max(cw, ch));
  const outW = Math.max(1, Math.round(cw * scale));
  const outH = Math.max(1, Math.round(ch * scale));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, outW, outH);
  return canvas.toDataURL(mime, quality);
}
