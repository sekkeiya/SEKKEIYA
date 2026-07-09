import React, {
  useRef, useEffect, useCallback, forwardRef,
  useImperativeHandle, useState,
} from 'react';
import {
  useDsdStore,
  type Annotation, type SiteElement, type SiteAccess, type SiteAccessDir,
} from '../store/useDsdStore';
import { logicalToCanvas, canvasToLogical, type Point2D } from './shapeUtils';
import { siteElementDef } from './sitePalette';

// ─── Style constants ─────────────────────────────────────────────────────────

const BG_STYLES = {
  clean: {
    bg: '#f5f5f0', text: '#212121', sub: '#757575',
    grid: 'rgba(0,0,0,0.05)',
    siteFill: 'rgba(77,208,225,0.1)', siteStroke: '#4dd0e1',
  },
  bold: {
    bg: '#f0f0ec', text: '#1a1a1a', sub: '#616161',
    grid: 'rgba(0,0,0,0.04)',
    siteFill: 'rgba(0,188,212,0.14)', siteStroke: '#00bcd4',
  },
  dark: {
    bg: '#0b0f16', text: 'rgba(255,255,255,0.88)', sub: 'rgba(255,255,255,0.5)',
    grid: 'rgba(255,255,255,0.04)',
    siteFill: 'rgba(77,208,225,0.14)', siteStroke: '#4dd0e1',
  },
} as const;

const SELECT_HL = '#4dd0e1';

const ACCESS_COLORS: Record<string, Record<string, string>> = {
  pedestrian: { clean: '#4caf50', bold: '#2e7d32', dark: '#81c784' },
  vehicle:    { clean: '#f57c00', bold: '#e65100', dark: '#ffb74d' },
  transit:    { clean: '#0288d1', bold: '#01579b', dark: '#4fc3f7' },
  bicycle:    { clean: '#9c27b0', bold: '#6a1b9a', dark: '#ce93d8' },
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  pedestrian: '歩行者',
  vehicle:    '車両',
  transit:    '公共交通',
  bicycle:    '自転車',
};

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  color: string, lineWidth = 2.5,
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 14;
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineWidth = lineWidth; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - headLen * 0.6 * Math.cos(angle), y2 - headLen * 0.6 * Math.sin(angle));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - headLen * 0.6 * Math.cos(angle), y2 - headLen * 0.6 * Math.sin(angle));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function getSiteBounds(cx: number, cy: number, scale: number, bw: number, bh: number) {
  return { x: cx - (bw * scale) / 2, y: cy - (bh * scale) / 2, w: bw * scale, h: bh * scale };
}

function getAccessEndpoints(
  acc: SiteAccess,
  bnds: { x: number; y: number; w: number; h: number },
  scale: number,
): { x1: number; y1: number; x2: number; y2: number } {
  const arrowLen = Math.max(12 * scale, 48);
  switch (acc.dir as SiteAccessDir) {
    case 'n': {
      const x = bnds.x + bnds.w * acc.offset;
      return { x1: x, y1: bnds.y - arrowLen, x2: x, y2: bnds.y };
    }
    case 's': {
      const x = bnds.x + bnds.w * acc.offset;
      return { x1: x, y1: bnds.y + bnds.h + arrowLen, x2: x, y2: bnds.y + bnds.h };
    }
    case 'e': {
      const y = bnds.y + bnds.h * acc.offset;
      return { x1: bnds.x + bnds.w + arrowLen, y1: y, x2: bnds.x + bnds.w, y2: y };
    }
    case 'w':
    default: {
      const y = bnds.y + bnds.h * acc.offset;
      return { x1: bnds.x - arrowLen, y1: y, x2: bnds.x, y2: y };
    }
  }
}

function drawSiteElement(
  ctx: CanvasRenderingContext2D,
  el: SiteElement, cx: number, cy: number, scale: number,
  fill: string, stroke: string, textColor: string, selected: boolean,
) {
  const [px, py] = logicalToCanvas(el.cx, el.cy, cx, cy, scale);
  const pw = el.w * scale;
  const ph = el.h * scale;
  const x = px - pw / 2;
  const y = py - ph / 2;

  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = selected ? SELECT_HL : stroke;
  ctx.lineWidth = selected ? 2.5 : 1.5;
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 4); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillRect(x, y, pw, ph); ctx.strokeRect(x, y, pw, ph);
  }
  ctx.restore();

  if (pw > 22 && ph > 14) {
    const fontSize = Math.max(10, Math.min(scale * 0.6, 14));
    ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(el.label, px, py);
  }

  if (selected) {
    ctx.save();
    ctx.strokeStyle = SELECT_HL; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - 4, y - 4, pw + 8, ph + 8);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawAccessArrow(
  ctx: CanvasRenderingContext2D,
  access: SiteAccess,
  bnds: { x: number; y: number; w: number; h: number },
  scale: number,
  style: 'clean' | 'bold' | 'dark',
  selected: boolean,
) {
  const color = selected ? SELECT_HL : (ACCESS_COLORS[access.type]?.[style] ?? '#ffffff');
  const { x1, y1, x2, y2 } = getAccessEndpoints(access, bnds, scale);

  drawArrow(ctx, x1, y1, x2, y2, color, 3.5);

  const labelStr = access.label
    ? `${ACCESS_TYPE_LABELS[access.type]}  ${access.label}`
    : ACCESS_TYPE_LABELS[access.type];
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dir: SiteAccessDir = access.dir;
  const isVertical = dir === 'n' || dir === 's';

  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `600 11px Inter, -apple-system, sans-serif`;
  if (isVertical) {
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(labelStr, midX + 8, midY);
  } else {
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(labelStr, midX, Math.min(y1, y2) - 6);
  }
  ctx.restore();
}

function drawNorthArrow(
  ctx: CanvasRenderingContext2D,
  W: number, northAngle: number, style: 'clean' | 'bold' | 'dark',
) {
  const colors = BG_STYLES[style];
  const x = W - 36; const y = 36; const r = 16;
  const rad = (northAngle * Math.PI) / 180;

  const nx = x + r * Math.sin(rad);
  const ny = y - r * Math.cos(rad);
  const sx = x - r * Math.sin(rad);
  const sy = y + r * Math.cos(rad);

  ctx.save();
  ctx.strokeStyle = colors.sub; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.lineTo(x + (r / 3) * Math.cos(rad), y + (r / 3) * Math.sin(rad));
  ctx.lineTo(sx, sy);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = colors.sub; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(x - (r / 3) * Math.cos(rad), y - (r / 3) * Math.sin(rad));
  ctx.lineTo(nx, ny);
  ctx.closePath(); ctx.stroke();

  ctx.fillStyle = colors.text;
  ctx.font = `bold 11px Inter, -apple-system, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', nx + 14 * Math.sin(rad), ny - 14 * Math.cos(rad));
  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, scale: number, style: 'clean' | 'bold' | 'dark',
) {
  const colors = BG_STYLES[style];
  const barLen = 10 * scale;
  const x = 16; const y = H - 16;
  ctx.save();
  ctx.strokeStyle = colors.text; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + barLen, y);
  ctx.moveTo(x, y - 4); ctx.lineTo(x, y);
  ctx.moveTo(x + barLen, y - 4); ctx.lineTo(x + barLen, y);
  ctx.stroke();
  ctx.fillStyle = colors.sub;
  ctx.font = `500 10px Inter, -apple-system, sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('10m', x + barLen + 5, y - 5);
  ctx.restore();
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[], cx: number, cy: number, scale: number, selectedId: string | null,
) {
  for (const ann of annotations) {
    const isSelected = ann.id === selectedId;
    if (ann.type === 'text') {
      const [px, py] = logicalToCanvas(ann.lx, ann.ly, cx, cy, scale);
      ctx.save();
      ctx.font = `600 ${ann.fontSize}px Inter, -apple-system, sans-serif`;
      const metrics = ctx.measureText(ann.text);
      const pad = 5;
      const bw = metrics.width + pad * 2;
      const bh = ann.fontSize + pad * 2 - 2;
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(px - pad, py - ann.fontSize - pad + 2, bw, bh, 3); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = ann.color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(ann.text, px, py);
      if (isSelected) {
        ctx.strokeStyle = SELECT_HL; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
        ctx.strokeRect(px - pad - 2, py - ann.fontSize - pad, bw + 4, bh + 4);
        ctx.setLineDash([]);
      }
      ctx.restore();
    } else {
      const [x1, y1] = logicalToCanvas(ann.lx1, ann.ly1, cx, cy, scale);
      const [x2, y2] = logicalToCanvas(ann.lx2, ann.ly2, cx, cy, scale);
      drawArrow(ctx, x1, y1, x2, y2, ann.color, 2);
    }
  }
}

function pointInElement(el: SiteElement, lx: number, ly: number, padM = 0): boolean {
  return (
    lx >= el.cx - el.w / 2 - padM && lx <= el.cx + el.w / 2 + padM &&
    ly >= el.cy - el.h / 2 - padM && ly <= el.cy + el.h / 2 + padM
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface SiteDiagramCanvasHandle {
  exportPng(w: number, h: number): string;
  renderFrame(w: number, h: number, t: number): ImageData;
}

interface Props { width: number; height: number; }

type ElementDragState = {
  elementId: string;
  startLx: number; startLy: number;
  originCx: number; originCy: number;
};

export const SiteDiagramCanvas = forwardRef<SiteDiagramCanvasHandle, Props>(
  ({ width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [moveDrag, setMoveDrag] = useState<ElementDragState | null>(null);
    const arrowStartRef = useRef<Point2D | null>(null);
    const animTRef = useRef(0);

    const {
      style, siteBoundaryW, siteBoundaryH, siteNorthAngle,
      siteElements, addSiteElement, updateSiteElement, removeSiteElement,
      selectedSiteElementId, setSelectedSiteElementId,
      siteAccesses, addSiteAccess, selectedSiteAccessId, setSelectedSiteAccessId,
      siteTool, siteElementType,
      isSiteAnimating,
      annotations, selectedAnnotationId, annotationTool,
      addAnnotation, annotationColor,
    } = useDsdStore();

    const getScale = useCallback(() => Math.min(width, height) / 80, [width, height]);

    const getLogical = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const cssPx = e.clientX - rect.left;
      const cssPy = e.clientY - rect.top;
      const scale = getScale();
      const lp = canvasToLogical(cssPx, cssPy, width / 2, height / 2, scale);
      return { cssPx, cssPy, lp };
    }, [width, height, getScale]);

    const findElementAt = useCallback((lx: number, ly: number): SiteElement | null => {
      for (let i = siteElements.length - 1; i >= 0; i--) {
        if (pointInElement(siteElements[i], lx, ly, 0.5)) return siteElements[i];
      }
      return null;
    }, [siteElements]);

    const draw = useCallback((
      ctx: CanvasRenderingContext2D, W: number, H: number,
      overrideSelEl?: string | null,
      overrideSelAcc?: string | null,
      overrideAnimT?: number,
    ) => {
      const cx = W / 2; const cy = H / 2;
      const scale = Math.min(W, H) / 80;
      const colors = BG_STYLES[style] ?? BG_STYLES.clean;
      const bnds = getSiteBounds(cx, cy, scale, siteBoundaryW, siteBoundaryH);

      ctx.fillStyle = colors.bg;
      ctx.fillRect(0, 0, W, H);

      // 10m grid
      ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
      const gsp = 10 * scale;
      const offX = ((cx % gsp) + gsp) % gsp;
      const offY = ((cy % gsp) + gsp) % gsp;
      for (let x = offX; x < W; x += gsp) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = offY; y < H; y += gsp) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      const selEl  = overrideSelEl  !== undefined ? overrideSelEl  : selectedSiteElementId;
      const selAcc = overrideSelAcc !== undefined ? overrideSelAcc : selectedSiteAccessId;

      // Context elements (behind site boundary)
      for (const el of siteElements) {
        const def = siteElementDef(el.type);
        const palette = def[style] ?? def.clean;
        drawSiteElement(ctx, el, cx, cy, scale, palette.fill, palette.stroke, palette.text, el.id === selEl);
      }

      // Site boundary
      ctx.save();
      ctx.fillStyle = colors.siteFill;
      ctx.strokeStyle = colors.siteStroke;
      ctx.lineWidth = 2.5;
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(bnds.x, bnds.y, bnds.w, bnds.h, 4); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(bnds.x, bnds.y, bnds.w, bnds.h);
        ctx.strokeRect(bnds.x, bnds.y, bnds.w, bnds.h);
      }
      const labelSize = Math.max(11, Math.min(scale * 0.65, 16));
      ctx.font = `700 ${labelSize}px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = colors.siteStroke;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('計画地', cx, cy);
      if (bnds.w > 56 && bnds.h > 28) {
        ctx.font = `500 10px Inter, -apple-system, sans-serif`;
        ctx.fillStyle = colors.sub;
        ctx.fillText(`${siteBoundaryW}m × ${siteBoundaryH}m`, cx, cy + labelSize + 4);
      }
      ctx.restore();

      // Access arrows
      for (const acc of siteAccesses) {
        drawAccessArrow(ctx, acc, bnds, scale, style, acc.id === selAcc);
      }

      // Animated dots along access arrows
      const shouldAnimate = overrideAnimT !== undefined || isSiteAnimating;
      if (shouldAnimate && siteAccesses.length > 0) {
        const animT = overrideAnimT ?? animTRef.current;
        siteAccesses.forEach((acc, i) => {
          const phase = (animT + i / siteAccesses.length) % 1;
          const { x1, y1, x2, y2 } = getAccessEndpoints(acc, bnds, scale);
          const dotX = x1 + (x2 - x1) * phase;
          const dotY = y1 + (y2 - y1) * phase;
          const color = ACCESS_COLORS[acc.type]?.[style] ?? '#ffffff';
          ctx.save();
          ctx.shadowColor = color; ctx.shadowBlur = 10;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      }

      drawNorthArrow(ctx, W, siteNorthAngle, style);
      drawScaleBar(ctx, W, H, scale, style);
      drawAnnotations(ctx, annotations, cx, cy, scale, selectedAnnotationId);

      // Status text
      ctx.font = `500 12px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = colors.text;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(
        `敷地コンテキスト  ·  ${siteElements.length} 要素  ·  ${siteAccesses.length} アクセス`,
        14, H - 14,
      );

      if (siteElements.length === 0 && siteAccesses.length === 0) {
        ctx.fillStyle = colors.sub;
        ctx.font = `13px Inter, -apple-system, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(
          'サイドバーからコンテキスト要素・アクセスを追加できます',
          cx, cy + siteBoundaryH * scale / 2 + 32,
        );
      }
    }, [
      style, siteBoundaryW, siteBoundaryH, siteNorthAngle,
      siteElements, siteAccesses, annotations,
      selectedSiteElementId, selectedSiteAccessId, selectedAnnotationId,
      isSiteAnimating,
    ]);

    // Static draw (when not animating)
    useEffect(() => {
      if (isSiteAnimating && siteAccesses.length > 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      draw(ctx, width, height);
    }, [draw, width, height, isSiteAnimating, siteAccesses.length]);

    // Animation loop (RAF)
    useEffect(() => {
      if (!isSiteAnimating || siteAccesses.length === 0) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d')!;

      let start: number | null = null;
      let rafId: number;
      const loop = (ts: number) => {
        if (start === null) start = ts;
        animTRef.current = ((ts - start) / 3000) % 1;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        draw(ctx, width, height);
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(rafId);
    }, [isSiteAnimating, siteAccesses.length, draw, width, height]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      const { lp } = getLogical(e);

      if (siteTool === 'addElement') {
        const { siteElementType: type } = useDsdStore.getState();
        const def = siteElementDef(type);
        const id = `el_${Date.now()}`;
        addSiteElement({ id, type, label: def.label, cx: lp[0], cy: lp[1], w: def.defaultW, h: def.defaultH });
        setSelectedSiteElementId(id);
        return;
      }

      if (siteTool === 'addAccess') {
        const { siteAccessType, siteBoundaryW: bw, siteBoundaryH: bh } = useDsdStore.getState();
        const [lx, ly] = lp;

        let dir: SiteAccessDir;
        let offset: number;

        if (lx < -bw / 2) {
          dir = 'w';
          offset = Math.max(0.05, Math.min(0.95, (bh / 2 - ly) / bh));
        } else if (lx > bw / 2) {
          dir = 'e';
          offset = Math.max(0.05, Math.min(0.95, (bh / 2 - ly) / bh));
        } else if (ly > bh / 2) {
          dir = 'n';
          offset = Math.max(0.05, Math.min(0.95, (lx + bw / 2) / bw));
        } else if (ly < -bh / 2) {
          dir = 's';
          offset = Math.max(0.05, Math.min(0.95, (lx + bw / 2) / bw));
        } else {
          // Inside or on boundary — snap to closest edge
          const distN = bh / 2 - ly;
          const distS = ly + bh / 2;
          const distE = bw / 2 - lx;
          const distW = lx + bw / 2;
          const minDist = Math.min(distN, distS, distE, distW);
          if (minDist === distN) {
            dir = 'n'; offset = Math.max(0.05, Math.min(0.95, (lx + bw / 2) / bw));
          } else if (minDist === distS) {
            dir = 's'; offset = Math.max(0.05, Math.min(0.95, (lx + bw / 2) / bw));
          } else if (minDist === distE) {
            dir = 'e'; offset = Math.max(0.05, Math.min(0.95, (bh / 2 - ly) / bh));
          } else {
            dir = 'w'; offset = Math.max(0.05, Math.min(0.95, (bh / 2 - ly) / bh));
          }
        }

        addSiteAccess({
          id: `acc_${Date.now()}`,
          type: siteAccessType,
          label: '',
          dir,
          offset,
        });
        return;
      }

      if (annotationTool === 'text') {
        const { annotationColor: color } = useDsdStore.getState();
        addAnnotation({ id: `ann_${Date.now()}`, type: 'text', lx: lp[0], ly: lp[1], text: '注記', color, fontSize: 14 });
        return;
      }

      if (annotationTool === 'arrow') {
        if (!arrowStartRef.current) {
          arrowStartRef.current = lp;
        } else {
          const { annotationColor: color } = useDsdStore.getState();
          addAnnotation({
            id: `ann_${Date.now()}`, type: 'arrow',
            lx1: arrowStartRef.current[0], ly1: arrowStartRef.current[1],
            lx2: lp[0], ly2: lp[1], color,
          });
          arrowStartRef.current = null;
        }
        return;
      }

      const hit = findElementAt(lp[0], lp[1]);
      if (hit) {
        setSelectedSiteElementId(hit.id);
        setSelectedSiteAccessId(null);
        setMoveDrag({ elementId: hit.id, startLx: lp[0], startLy: lp[1], originCx: hit.cx, originCy: hit.cy });
      } else {
        setSelectedSiteElementId(null);
        setSelectedSiteAccessId(null);
      }
    }, [getLogical, siteTool, annotationTool, findElementAt, addSiteElement, addSiteAccess, setSelectedSiteElementId, setSelectedSiteAccessId, addAnnotation]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!moveDrag) return;
      const { lp } = getLogical(e);
      updateSiteElement(moveDrag.elementId, {
        cx: moveDrag.originCx + (lp[0] - moveDrag.startLx),
        cy: moveDrag.originCy + (lp[1] - moveDrag.startLy),
      });
    }, [moveDrag, getLogical, updateSiteElement]);

    const handleMouseUp = useCallback(() => setMoveDrag(null), []);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
        if (e.key === 'Escape') {
          setSelectedSiteElementId(null);
          setSelectedSiteAccessId(null);
          arrowStartRef.current = null;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const { selectedSiteElementId: selEl } = useDsdStore.getState();
          if (selEl) { e.preventDefault(); removeSiteElement(selEl); }
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [setSelectedSiteElementId, setSelectedSiteAccessId, removeSiteElement]);

    useImperativeHandle(ref, () => ({
      exportPng(w: number, h: number): string {
        const offscreen = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        offscreen.width = w * dpr; offscreen.height = h * dpr;
        const ctx = offscreen.getContext('2d')!;
        ctx.scale(dpr, dpr);
        draw(ctx, w, h, null, null);
        return offscreen.toDataURL('image/png');
      },
      renderFrame(w: number, h: number, t: number): ImageData {
        const offscreen = document.createElement('canvas');
        offscreen.width = w; offscreen.height = h;
        const ctx = offscreen.getContext('2d')!;
        draw(ctx, w, h, null, null, t);
        return ctx.getImageData(0, 0, w, h);
      },
    }));

    const cursor = (siteTool === 'addElement' || siteTool === 'addAccess')
      ? 'crosshair'
      : moveDrag ? 'grabbing' : 'default';

    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setMoveDrag(null)}
        />
      </div>
    );
  },
);

SiteDiagramCanvas.displayName = 'SiteDiagramCanvas';
