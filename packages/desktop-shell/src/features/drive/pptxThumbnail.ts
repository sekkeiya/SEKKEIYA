// pptx の1枚目スライドを端末内で描画してサムネイル画像（JPEG Blob）を生成する。
// 内蔵サムネ（docProps/thumbnail）を持たない pptx（ツール生成物など）向けのフォールバック。
// 既存の pptx 解析（parsePptx＝ParsedShape に絶対座標/テキスト/画像バイトを持つ）を再利用し、
// Canvas2D で背景→図形→画像→テキストの順に描く。html2canvas 等の依存は不要。
import { parsePptx } from '../dsp/import/pptxImport';

const EMU_PER_PT = 12700; // 1pt = 1/72 inch = 12700 EMU

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 文字（CJK/ラテン混在）を shape 幅で折り返しつつ描く。高さを超えたら打ち切る。
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, w: number, h: number,
  lineH: number, align: 'left' | 'center' | 'right',
) {
  const anchorX = align === 'center' ? x + w / 2 : align === 'right' ? x + w : x;
  let cy = y;
  for (const para of text.split(/\r?\n/)) {
    if (cy > y + h) break;
    let line = '';
    for (const ch of Array.from(para)) {
      const test = line + ch;
      if (ctx.measureText(test).width > w && line) {
        ctx.fillText(line, anchorX, cy);
        cy += lineH;
        line = ch;
        if (cy > y + h) break;
      } else {
        line = test;
      }
    }
    if (line && cy <= y + h) { ctx.fillText(line, anchorX, cy); cy += lineH; }
  }
}

// 1スライドを Canvas に描画して返す（サムネ・プレビュー共通）。
async function renderSlideToCanvas(
  slide: { shapes: any[] }, slideCx: number, slideCy: number, targetW: number,
): Promise<HTMLCanvasElement | null> {
  if (!slide || !slideCx || !slideCy) return null;
  const scale = targetW / slideCx; // px per EMU
  const W = Math.max(1, Math.round(slideCx * scale));
  const H = Math.max(1, Math.round(slideCy * scale));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 背景（白）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  for (const s of slide.shapes) {
    const x = s.x * scale, y = s.y * scale, w = s.w * scale, h = s.h * scale;
    if (w <= 0 || h <= 0) continue;
    ctx.save();
    if (s.rotDeg) {
      const cx = x + w / 2, cy = y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((s.rotDeg * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }
    if (s.kind === 'rect' && s.fill) {
      ctx.fillStyle = s.fill;
      roundRectPath(ctx, x, y, w, h, (s.radiusEmu || 0) * scale);
      ctx.fill();
    } else if (s.kind === 'image' && s.imageBytes) {
      try {
        const blob = new Blob([s.imageBytes], { type: s.imageMime || 'image/png' });
        const bmp = await createImageBitmap(blob);
        ctx.drawImage(bmp, x, y, w, h);
        bmp.close?.();
      } catch { /* この画像はスキップ */ }
    } else if (s.kind === 'text' && s.text) {
      const fontPx = Math.max(8, (s.fontPt || 18) * EMU_PER_PT * scale);
      ctx.fillStyle = s.color || '#111111';
      ctx.font = `${s.bold ? 'bold ' : ''}${fontPx}px "Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = (s.align || 'left') as CanvasTextAlign;
      wrapText(ctx, s.text, x, y, w, h, fontPx * 1.25, s.align || 'left');
    }
    ctx.restore();
  }
  return canvas;
}

/**
 * pptx の1枚目スライドを描画して JPEG Blob を返す。失敗/空なら null（→ 呼び出し側でアイコンにフォールバック）。
 * @param targetW サムネの横幅px（縦はスライド比で自動）。
 */
export async function renderPptxThumbnail(file: File, targetW = 800): Promise<Blob | null> {
  try {
    const deck = await parsePptx(file);
    const canvas = await renderSlideToCanvas(deck.slides?.[0], deck.slideCx, deck.slideCy, targetW);
    if (!canvas) return null;
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
  } catch (e) {
    console.warn('[pptxThumbnail] render failed:', e);
    return null;
  }
}

/**
 * pptx の全スライドを描画して data URL の配列で返す（Drive 内 Quick Look プレビュー用）。
 * @param targetW 各スライドの横幅px。@param maxSlides 上限（メモリ対策）。
 */
export async function renderAllPptxSlideUrls(file: File, targetW = 1400, maxSlides = 60): Promise<string[]> {
  const out: string[] = [];
  try {
    const deck = await parsePptx(file);
    const slides = (deck.slides || []).slice(0, maxSlides);
    for (const slide of slides) {
      const canvas = await renderSlideToCanvas(slide, deck.slideCx, deck.slideCy, targetW);
      if (canvas) out.push(canvas.toDataURL('image/jpeg', 0.82));
    }
  } catch (e) {
    console.warn('[pptxThumbnail] renderAll failed:', e);
  }
  return out;
}
