// .pptx（OOXML）を端末内で解析し、S.Slide の PresentationContent へ変換する。（docs/25 P1）
// 依存: fflate（解凍）＋ DOMParser（WebView2 内蔵）。クラウド不要。
//
// 対応: テキストボックス / 画像 / 単純図形 / グループ（変換合成）。
// 非対応: 表・グラフ・SmartArt（スキップし warnings に記録）。プレースホルダ継承は明示座標のみ。

import { unzipSync } from 'fflate';
import type { PresentationContent, PresentationElement, PresentationPage } from '../types/dsp.types';

const EMU_PER_PT = 12700;           // 1pt = 12700 EMU
const CANVAS_W = 1587;              // 変換先キャンバス幅（アスペクト比は維持）

// ─── 解析結果の中間表現 ─────────────────────────────────────────────────────────
type Xf = { ax: number; ay: number; sx: number; sy: number }; // childX→abs: ax + childX*sx
const IDENTITY: Xf = { ax: 0, ay: 0, sx: 1, sy: 1 };

interface ParsedShape {
  kind: 'text' | 'image' | 'rect';
  x: number; y: number; w: number; h: number; // EMU（slide 絶対座標）
  rotDeg: number;
  text?: string;
  fontPt?: number;
  color?: string;      // #rrggbb
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  fill?: string;       // #rrggbb
  radiusEmu?: number;  // roundRect
  imageBytes?: Uint8Array;
  imageMime?: string;
}

export interface ParsedDeck {
  slideCx: number; // EMU
  slideCy: number;
  slides: { shapes: ParsedShape[] }[];
  warnings: string[];
}

// ─── XML helpers ────────────────────────────────────────────────────────────────
function parseXml(bytes: Uint8Array): Document {
  const text = new TextDecoder('utf-8').decode(bytes);
  return new DOMParser().parseFromString(text, 'application/xml');
}
function childByTag(el: Element, tag: string): Element | null {
  for (let i = 0; i < el.childNodes.length; i++) {
    const n = el.childNodes[i] as any;
    if (n.nodeType === 1 && (n.tagName === tag || n.localName === tag.split(':').pop())) return n as Element;
  }
  return null;
}
function descByTag(el: Element | Document, tag: string): Element | null {
  const list = (el as any).getElementsByTagName(tag);
  return list && list.length ? list[0] : null;
}
function attr(el: Element | null, name: string): string | null {
  return el ? el.getAttribute(name) : null;
}
function emuInt(v: string | null): number { const n = parseInt(v || '0', 10); return isNaN(n) ? 0 : n; }

// xfrm(a:xfrm) から off/ext/rot を取り、親変換を適用した絶対 EMU を返す
function readXfrm(spPr: Element | null, parent: Xf): { x: number; y: number; w: number; h: number; rotDeg: number; radiusEmu: number } | null {
  if (!spPr) return null;
  const xfrm = childByTag(spPr, 'a:xfrm');
  if (!xfrm) return null;
  const off = childByTag(xfrm, 'a:off');
  const ext = childByTag(xfrm, 'a:ext');
  if (!off || !ext) return null;
  const lx = emuInt(attr(off, 'x')), ly = emuInt(attr(off, 'y'));
  const lw = emuInt(attr(ext, 'cx')), lh = emuInt(attr(ext, 'cy'));
  const rot = emuInt(attr(xfrm, 'rot'));
  return {
    x: parent.ax + lx * parent.sx,
    y: parent.ay + ly * parent.sy,
    w: lw * parent.sx,
    h: lh * parent.sy,
    rotDeg: rot ? rot / 60000 : 0,
    radiusEmu: 0,
  };
}

function readColor(fillParent: Element | null): string | undefined {
  if (!fillParent) return undefined;
  const solid = childByTag(fillParent, 'a:solidFill');
  if (!solid) return undefined;
  const srgb = childByTag(solid, 'a:srgbClr');
  const val = attr(srgb, 'val');
  return val ? `#${val}` : undefined;
}

// ─── shape 抽出 ─────────────────────────────────────────────────────────────────
function extractText(sp: Element): { text: string; fontPt?: number; color?: string; bold?: boolean; align?: 'left' | 'center' | 'right' } | null {
  const txBody = childByTag(sp, 'p:txBody');
  if (!txBody) return null;
  const paras = Array.from(txBody.childNodes).filter((n: any) => n.nodeType === 1 && (n.tagName === 'a:p' || n.localName === 'p')) as Element[];
  const lines: string[] = [];
  let fontPt: number | undefined;
  let color: string | undefined;
  let bold = false;
  let align: 'left' | 'center' | 'right' | undefined;
  for (const p of paras) {
    const pPr = childByTag(p, 'a:pPr');
    const algn = attr(pPr, 'algn');
    if (algn && !align) align = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : 'left';
    const runs = Array.from(p.getElementsByTagName('a:r'));
    let line = '';
    for (const r of runs) {
      const t = childByTag(r as Element, 'a:t');
      if (t?.textContent) line += t.textContent;
      const rPr = childByTag(r as Element, 'a:rPr');
      if (rPr) {
        if (fontPt === undefined) { const sz = attr(rPr, 'sz'); if (sz) fontPt = parseInt(sz, 10) / 100; }
        if (!color) color = readColor(rPr);
        if (attr(rPr, 'b') === '1') bold = true;
      }
    }
    lines.push(line);
  }
  const text = lines.join('\n').trim();
  if (!text) return null;
  return { text, fontPt, color, bold, align };
}

// spTree を再帰走査し、絶対座標の ParsedShape を出現順で集める
function walkShapes(node: Element, parent: Xf, out: ParsedShape[], rels: Map<string, string>, media: Record<string, Uint8Array>, warnings: string[]) {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i] as any;
    if (child.nodeType !== 1) continue;
    const tag = child.tagName as string;

    if (tag === 'p:sp') {
      const spPr = childByTag(child, 'p:spPr');
      const geo = readXfrm(spPr, parent);
      if (!geo) continue; // 明示座標なし（プレースホルダ継承のみ）はスキップ
      const txt = extractText(child);
      const prst = attr(descByTag(child, 'a:prstGeom'), 'prst');
      if (txt) {
        out.push({ kind: 'text', x: geo.x, y: geo.y, w: geo.w, h: geo.h, rotDeg: geo.rotDeg, ...txt });
      } else {
        const fill = readColor(spPr);
        if (fill || prst) {
          out.push({ kind: 'rect', x: geo.x, y: geo.y, w: geo.w, h: geo.h, rotDeg: geo.rotDeg, fill, radiusEmu: prst === 'roundRect' ? Math.min(geo.w, geo.h) * 0.08 : 0 });
        }
      }
    } else if (tag === 'p:pic') {
      const spPr = childByTag(child, 'p:spPr');
      const geo = readXfrm(spPr, parent);
      if (!geo) continue;
      const blip = descByTag(child, 'a:blip');
      const embed = attr(blip, 'r:embed') || attr(blip, 'embed');
      const target = embed ? rels.get(embed) : undefined;
      const bytes = target ? media[target] : undefined;
      if (bytes) {
        const mime = target!.endsWith('.png') ? 'image/png' : target!.endsWith('.gif') ? 'image/gif' : target!.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
        out.push({ kind: 'image', x: geo.x, y: geo.y, w: geo.w, h: geo.h, rotDeg: geo.rotDeg, imageBytes: bytes, imageMime: mime });
      }
    } else if (tag === 'p:grpSp') {
      const grpSpPr = childByTag(child, 'p:grpSpPr');
      const xfrm = grpSpPr ? childByTag(grpSpPr, 'a:xfrm') : null;
      let childXf = parent;
      if (xfrm) {
        const off = childByTag(xfrm, 'a:off'), ext = childByTag(xfrm, 'a:ext');
        const chOff = childByTag(xfrm, 'a:chOff'), chExt = childByTag(xfrm, 'a:chExt');
        if (off && ext && chOff && chExt) {
          const gx = emuInt(attr(off, 'x')), gy = emuInt(attr(off, 'y'));
          const gcx = emuInt(attr(ext, 'cx')), gcy = emuInt(attr(ext, 'cy'));
          const cx = emuInt(attr(chOff, 'x')), cy = emuInt(attr(chOff, 'y'));
          const ccx = emuInt(attr(chExt, 'cx')) || 1, ccy = emuInt(attr(chExt, 'cy')) || 1;
          const sx = gcx / ccx, sy = gcy / ccy;
          const axLocal = gx - cx * sx, ayLocal = gy - cy * sy;
          // 親変換 parent と合成
          childXf = { ax: parent.ax + axLocal * parent.sx, ay: parent.ay + ayLocal * parent.sy, sx: sx * parent.sx, sy: sy * parent.sy };
        }
      }
      walkShapes(child, childXf, out, rels, media, warnings);
    } else if (tag === 'p:graphicFrame') {
      warnings.push('表/グラフ/SmartArt を1つスキップしました（未対応）');
    }
  }
}

// ─── parse ──────────────────────────────────────────────────────────────────────
export async function parsePptx(file: File): Promise<ParsedDeck> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const zip = unzipSync(buf);
  const warnings: string[] = [];

  // スライド寸法
  const presXml = zip['ppt/presentation.xml'];
  if (!presXml) throw new Error('ppt/presentation.xml が見つかりません（.pptx ではない可能性）');
  const presDoc = parseXml(presXml);
  const sldSz = descByTag(presDoc, 'p:sldSz');
  const slideCx = emuInt(attr(sldSz, 'cx')) || 12192000;
  const slideCy = emuInt(attr(sldSz, 'cy')) || 6858000;

  // スライド順: presentation.xml.rels の r:id → slideN.xml
  const presRels = zip['ppt/_rels/presentation.xml.rels'];
  const relMap = new Map<string, string>();
  if (presRels) {
    const relDoc = parseXml(presRels);
    Array.from(relDoc.getElementsByTagName('Relationship')).forEach(r => {
      const id = attr(r as Element, 'Id'); const tgt = attr(r as Element, 'Target');
      if (id && tgt) relMap.set(id, tgt.replace(/^\//, ''));
    });
  }
  const sldIdLst = descByTag(presDoc, 'p:sldIdLst');
  let slidePaths: string[] = [];
  if (sldIdLst) {
    slidePaths = Array.from(sldIdLst.getElementsByTagName('p:sldId')).map(s => {
      const rid = attr(s as Element, 'r:id') || attr(s as Element, 'id');
      const tgt = rid ? relMap.get(rid) : undefined;
      return tgt ? (tgt.startsWith('ppt/') ? tgt : `ppt/${tgt}`) : '';
    }).filter(Boolean);
  }
  if (slidePaths.length === 0) {
    // フォールバック: slideN.xml を数値順
    slidePaths = Object.keys(zip).filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => (parseInt(a.match(/(\d+)/)![1]) - parseInt(b.match(/(\d+)/)![1])));
  }

  const slides: { shapes: ParsedShape[] }[] = [];
  for (const path of slidePaths) {
    const xml = zip[path];
    if (!xml) continue;
    const doc = parseXml(xml);

    // 画像 rels
    const relPath = path.replace(/slides\/(slide\d+)\.xml$/, 'slides/_rels/$1.xml.rels');
    const rels = new Map<string, string>();
    if (zip[relPath]) {
      const rd = parseXml(zip[relPath]);
      Array.from(rd.getElementsByTagName('Relationship')).forEach(r => {
        const id = attr(r as Element, 'Id'); let tgt = attr(r as Element, 'Target');
        if (id && tgt) {
          // "../media/imageX.png" → "ppt/media/imageX.png"
          tgt = tgt.replace(/^\.\.\//, 'ppt/').replace(/^\//, '');
          if (!tgt.startsWith('ppt/')) tgt = `ppt/${tgt}`;
          rels.set(id, tgt);
        }
      });
    }
    // media は zip から直接引く（rels の値がキー）
    const media: Record<string, Uint8Array> = zip as any;

    const spTree = descByTag(doc, 'p:spTree');
    const shapes: ParsedShape[] = [];
    if (spTree) walkShapes(spTree, IDENTITY, shapes, rels, media, warnings);
    slides.push({ shapes });
  }

  return { slideCx, slideCy, slides, warnings };
}

// ─── convert → PresentationContent ───────────────────────────────────────────────
export interface PptxConvertOpts {
  /** 画像バイトを Storage 等へ上げて src を返す。失敗時は null（その画像は空枠になる） */
  uploadImage: (bytes: Uint8Array, mime: string) => Promise<{ src: string; assetId?: string; storagePath?: string } | null>;
}

export async function pptxToPresentation(deck: ParsedDeck, opts: PptxConvertOpts): Promise<PresentationContent> {
  const scale = CANVAS_W / deck.slideCx;         // px / EMU
  const canvasW = CANVAS_W;
  const canvasH = Math.round(deck.slideCy * scale);
  const emuPx = (e: number) => Math.round(e * scale);

  const pages: PresentationPage[] = [];
  let seq = 0;
  const newId = () => `el-${Date.now().toString(36)}-${seq++}`;

  for (let s = 0; s < deck.slides.length; s++) {
    const elements: PresentationElement[] = [];
    let z = 0;
    for (const sh of deck.slides[s].shapes) {
      const base = { id: newId(), x: emuPx(sh.x), y: emuPx(sh.y), w: emuPx(sh.w), h: emuPx(sh.h), zIndex: z++, rotation: Math.round(sh.rotDeg || 0), opacity: 100 };
      if (sh.kind === 'text') {
        const fontPx = Math.max(8, Math.round((sh.fontPt || 18) * EMU_PER_PT * scale));
        elements.push({ ...base, type: 'text', data: {
          text: sh.text || '', fontSize: `${fontPx}px`, color: sh.color || '#1d1d1f',
          textAlign: sh.align || 'left', fontWeight: sh.bold ? '700' : '400',
        } } as PresentationElement);
      } else if (sh.kind === 'rect') {
        elements.push({ ...base, type: 'shape', data: {
          shapeType: 'rect', fill: sh.fill || 'rgba(0,0,0,0.05)',
          ...(sh.radiusEmu ? { borderRadius: `${emuPx(sh.radiusEmu)}px` } : {}),
        } } as PresentationElement);
      } else if (sh.kind === 'image' && sh.imageBytes) {
        const up = await opts.uploadImage(sh.imageBytes, sh.imageMime || 'image/png');
        elements.push({ ...base, type: 'image', data: {
          src: up?.src || '', alt: '', ...(up?.assetId ? { assetId: up.assetId } : {}), ...(up?.storagePath ? { storagePath: up.storagePath } : {}),
        } } as PresentationElement);
      }
    }
    pages.push({ id: `page-${Date.now().toString(36)}-${s}`, name: `スライド ${s + 1}`, elements });
  }

  if (pages.length === 0) pages.push({ id: `page-${Date.now().toString(36)}`, name: 'スライド 1', elements: [] });

  return { pages, canvasSize: { width: canvasW, height: canvasH, name: 'PPTX取り込み' } };
}
