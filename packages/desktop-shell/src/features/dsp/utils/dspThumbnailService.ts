import type { PresentationContent } from '../types/dsp.types';

const THUMB_WIDTH = 480;

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Renders the first page of a presentation to a JPEG blob.
 * Covers: shape, text, image, modelCard, drawing. Others are skipped gracefully.
 */
export async function renderPresentationThumbnail(content: PresentationContent): Promise<Blob | null> {
  const page = content.pages?.[0];
  if (!page) return null;

  const cw = content.canvasSize?.width || 1587;
  const ch = content.canvasSize?.height || 1122;
  const scale = THUMB_WIDTH / cw;
  const tw = THUMB_WIDTH;
  const th = Math.round(ch * scale);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tw, th);

  const elements = [...(page.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  for (const el of elements) {
    const x = el.x * scale;
    const y = el.y * scale;
    const w = el.w * scale;
    const h = el.h * scale;
    const opacity = el.opacity != null ? el.opacity / 100 : 1;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (el.rotation) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }

    if (el.type === 'shape') {
      const d = el.data as any;
      ctx.fillStyle = d.fill || 'rgba(100,100,100,0.5)';
      if (d.shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.stroke) {
          ctx.strokeStyle = d.stroke;
          ctx.lineWidth = Math.max(0.5, (d.strokeWidth || 1) * scale);
          ctx.stroke();
        }
      } else {
        const r = Math.min(parseFloat(d.borderRadius || '0') * scale, Math.min(w, h) / 2);
        if (r > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        if (d.stroke) {
          ctx.strokeStyle = d.stroke;
          ctx.lineWidth = Math.max(0.5, (d.strokeWidth || 1) * scale);
          ctx.strokeRect(x, y, w, h);
        }
      }
    } else if (el.type === 'text') {
      const d = el.data as any;
      if (d.bgcolor && d.bgcolor !== 'transparent') {
        ctx.fillStyle = d.bgcolor;
        ctx.fillRect(x, y, w, h);
      }
      const fontSize = Math.max(4, parseFloat(d.fontSize || '16') * scale);
      ctx.font = `${d.fontWeight || 'normal'} ${fontSize}px sans-serif`;
      ctx.fillStyle = d.color || '#000000';
      ctx.textAlign = (d.textAlign as CanvasTextAlign) || 'left';
      ctx.textBaseline = 'top';
      const padding = (d.padding || 0) * scale;
      const lines = (d.text || '').split('\n');
      const lineH = fontSize * 1.3;
      const textX = d.textAlign === 'right' ? x + w - padding : d.textAlign === 'center' ? x + w / 2 : x + padding;
      let lineY = y + padding;
      for (const line of lines) {
        if (lineY + lineH > y + h) break;
        ctx.fillText(line, textX, lineY, w - padding * 2);
        lineY += lineH;
      }
    } else if (el.type === 'image') {
      const d = el.data as any;
      if (d.src) {
        const img = await loadImage(d.src);
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          if (d.crop) {
            const srcX = d.crop.imgX * img.naturalWidth;
            const srcY = d.crop.imgY * img.naturalHeight;
            const srcW = d.crop.imgW * img.naturalWidth;
            const srcH = d.crop.imgH * img.naturalHeight;
            ctx.drawImage(img, srcX, srcY, srcW, srcH, x, y, w, h);
          } else {
            const imgRatio = img.naturalWidth / img.naturalHeight;
            const elRatio = w / h;
            let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
            if (imgRatio > elRatio) {
              sw = img.naturalHeight * elRatio;
              sx = (img.naturalWidth - sw) / 2;
            } else {
              sh = img.naturalWidth / elRatio;
              sy = (img.naturalHeight - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(100,100,100,0.15)';
          ctx.fillRect(x, y, w, h);
        }
      }
    } else if (el.type === 'modelCard') {
      const d = el.data as any;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, h);
      if (d.thumbnailUrl) {
        const img = await loadImage(d.thumbnailUrl);
        if (img) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.drawImage(img, x, y, w, h);
          ctx.restore();
        }
      }
    } else if (el.type === 'drawing') {
      const d = el.data as any;
      if (d.pathData) {
        const p = new Path2D(d.pathData);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.strokeStyle = d.stroke || '#000';
        ctx.lineWidth = d.strokeWidth || 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(p);
        ctx.restore();
      }
    }

    ctx.restore();
  }

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
  });
}
