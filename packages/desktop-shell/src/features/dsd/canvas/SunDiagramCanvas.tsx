import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { useDsdStore, type Annotation } from '../store/useDsdStore';
import { calcSunPosition, calcSunriseSunset } from './sunMath';
import { getPresetPoints, convexHull, logicalToCanvas, canvasToLogical, type Point2D } from './shapeUtils';

// ─── Style definitions ──────────────────────────────────────────────────────

const STYLES = {
  clean: {
    bg: '#fafafa', buildingFill: '#e8e8e8', buildingStroke: '#333333', buildingStrokeWidth: 1.5,
    shadowFill: 'rgba(0,0,0,0.12)', sunArcStroke: 'rgba(255,140,0,0.35)',
    sunColor: '#f57c00', sunGlow: 'rgba(255,140,0,0.2)',
    textColor: '#212121', subTextColor: '#757575',
    gridColor: 'rgba(0,0,0,0.05)', compassColor: '#424242', accentColor: '#f57c00', skyColor: null,
  },
  bold: {
    bg: '#ffffff', buildingFill: '#1565c0', buildingStroke: '#0d47a1', buildingStrokeWidth: 2,
    shadowFill: 'rgba(21,101,192,0.22)', sunArcStroke: 'rgba(255,109,0,0.5)',
    sunColor: '#ff6d00', sunGlow: 'rgba(255,109,0,0.25)',
    textColor: '#1a1a1a', subTextColor: '#616161',
    gridColor: 'rgba(0,0,0,0.04)', compassColor: '#1565c0', accentColor: '#ff6d00', skyColor: null,
  },
  dark: {
    bg: '#0b0f16', buildingFill: 'rgba(255,255,255,0.1)', buildingStroke: 'rgba(255,255,255,0.35)', buildingStrokeWidth: 1.5,
    shadowFill: 'rgba(0,0,0,0.55)', sunArcStroke: 'rgba(255,213,79,0.3)',
    sunColor: '#ffd740', sunGlow: 'rgba(255,213,79,0.15)',
    textColor: 'rgba(255,255,255,0.88)', subTextColor: 'rgba(255,255,255,0.5)',
    gridColor: 'rgba(255,255,255,0.04)', compassColor: 'rgba(255,255,255,0.5)',
    accentColor: '#ffd740', skyColor: '#0b0f16',
  },
} as const;

const SELECT_HL = '#aed581';

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function drawPolygon(ctx: CanvasRenderingContext2D, pts: Point2D[], fill?: string, stroke?: string, lineWidth = 1.5) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function drawSunSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, glow: string, r = 8) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  grad.addColorStop(0, glow);
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([]);
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3));
    ctx.lineTo(x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9));
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  northAngle: number, color: string, textColor: string,
) {
  ctx.save();
  ctx.font = `bold 10px Inter, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const labels = [
    { label: 'N', a: 0 }, { label: 'E', a: 90 },
    { label: 'S', a: 180 }, { label: 'W', a: 270 },
  ];
  labels.forEach(({ label, a }) => {
    const aRad = (a + northAngle) * Math.PI / 180;
    ctx.fillStyle = label === 'N' ? color : textColor;
    ctx.fillText(label, cx + Math.sin(aRad) * (r + 10), cy - Math.cos(aRad) * (r + 10));
  });

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const nRad = northAngle * Math.PI / 180;
  ctx.beginPath();
  ctx.moveTo(cx + Math.sin(nRad) * (r - 2), cy - Math.cos(nRad) * (r - 2));
  ctx.lineTo(cx + Math.sin(nRad + 0.4) * (r * 0.4), cy - Math.cos(nRad + 0.4) * (r * 0.4));
  ctx.lineTo(cx + Math.sin(nRad - 0.4) * (r * 0.4), cy - Math.cos(nRad - 0.4) * (r * 0.4));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 13;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 4;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2 - headLen * 0.65 * Math.cos(angle), y2 - headLen * 0.65 * Math.sin(angle));
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 7), y2 - headLen * Math.sin(angle - Math.PI / 7));
  ctx.lineTo(x2 - headLen * 0.65 * Math.cos(angle), y2 - headLen * 0.65 * Math.sin(angle));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 7), y2 - headLen * Math.sin(angle + Math.PI / 7));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function getTextBBox(ctx: CanvasRenderingContext2D, ann: Extract<Annotation, { type: 'text' }>, px: number, py: number) {
  ctx.save();
  ctx.font = `600 ${ann.fontSize}px Inter, -apple-system, sans-serif`;
  const w = ctx.measureText(ann.text).width;
  ctx.restore();
  const pad = 5;
  return { x: px - pad, y: py - ann.fontSize - pad + 2, w: w + pad * 2, h: ann.fontSize + pad * 2 - 2 };
}

function drawAnnotations(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  cx: number, cy: number, scale: number,
  selectedId: string | null,
) {
  for (const ann of annotations) {
    const isSelected = ann.id === selectedId;

    if (ann.type === 'text') {
      const [px, py] = logicalToCanvas(ann.lx, ann.ly, cx, cy, scale);
      const fontSize = ann.fontSize;
      ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
      const metrics = ctx.measureText(ann.text);
      const pad = 5;
      const bx = px - pad;
      const by = py - fontSize - pad + 2;
      const bw = metrics.width + pad * 2;
      const bh = fontSize + pad * 2 - 2;

      // Backdrop
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, bw, bh);
      }
      ctx.restore();
      ctx.fillStyle = ann.color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ann.text, px, py);

      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = SELECT_HL;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
        ctx.setLineDash([]);
        ctx.restore();
      }
    } else {
      const [x1, y1] = logicalToCanvas(ann.lx1, ann.ly1, cx, cy, scale);
      const [x2, y2] = logicalToCanvas(ann.lx2, ann.ly2, cx, cy, scale);
      drawArrow(ctx, x1, y1, x2, y2, ann.color);

      if (isSelected) {
        ctx.save();
        ctx.fillStyle = SELECT_HL;
        ctx.strokeStyle = SELECT_HL;
        ctx.lineWidth = 1;
        // Endpoint handles
        for (const [hx, hy] of [[x1, y1], [x2, y2]] as const) {
          ctx.beginPath();
          ctx.arc(hx, hy, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(174,213,129,0.85)';
          ctx.fill();
          ctx.strokeStyle = '#1a1c22';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}

// ── Hit-testing helpers ──────────────────────────────────────────────────────

function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

type HitResult =
  | { id: string; type: 'text'; handle: 'body' }
  | { id: string; type: 'arrow'; handle: 'start' | 'end' | 'body' };

function hitTest(
  ctx: CanvasRenderingContext2D,
  annotations: Annotation[],
  cx: number, cy: number, scale: number,
  px: number, py: number,
  selectedId: string | null,
): HitResult | null {
  // Iterate in reverse so top-most wins
  for (let i = annotations.length - 1; i >= 0; i--) {
    const ann = annotations[i];
    if (ann.type === 'text') {
      const [tx, ty] = logicalToCanvas(ann.lx, ann.ly, cx, cy, scale);
      const bb = getTextBBox(ctx, ann, tx, ty);
      if (px >= bb.x && px <= bb.x + bb.w && py >= bb.y && py <= bb.y + bb.h) {
        return { id: ann.id, type: 'text', handle: 'body' };
      }
    } else {
      const [x1, y1] = logicalToCanvas(ann.lx1, ann.ly1, cx, cy, scale);
      const [x2, y2] = logicalToCanvas(ann.lx2, ann.ly2, cx, cy, scale);
      // Endpoint priority only on selected arrow
      if (ann.id === selectedId) {
        if (Math.hypot(px - x1, py - y1) <= 8) return { id: ann.id, type: 'arrow', handle: 'start' };
        if (Math.hypot(px - x2, py - y2) <= 8) return { id: ann.id, type: 'arrow', handle: 'end' };
      }
      if (pointToSegmentDist(px, py, x1, y1, x2, y2) <= 6) {
        return { id: ann.id, type: 'arrow', handle: 'body' };
      }
    }
  }
  return null;
}

// ─── Main canvas component ────────────────────────────────────────────────────

export interface SunDiagramCanvasHandle {
  exportPng(w: number, h: number): string;
  renderFrame(w: number, h: number, hour: number): ImageData;
}

interface Props { width: number; height: number; }

type TextInputState = {
  visible: boolean;
  px: number; py: number;
  lx: number; ly: number;
  value: string;
};

type DragState = {
  id: string;
  type: 'text' | 'arrow';
  handle: 'body' | 'start' | 'end';
  startLx: number; startLy: number;          // pointer at drag start (logical)
  origin: Annotation;                        // annotation snapshot at drag start
};

export const SunDiagramCanvas = forwardRef<SunDiagramCanvasHandle, Props>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [cursorPos, setCursorPos] = useState<Point2D | null>(null);
  const [textInput, setTextInput] = useState<TextInputState | null>(null);
  const [arrowDraft, setArrowDraft] = useState<{ lx1: number; ly1: number; lx2: number; ly2: number } | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);

  const store = useDsdStore();
  const {
    presetShape, customPolygon, buildingWidth, buildingDepth, buildingHeight,
    northAngle, month, timeHour, latitude, style, isAnimating,
    isDrawingPolygon, draftPolygon,
    annotations, annotationTool, annotationColor, selectedAnnotationId,
    setTimeHour, setDraftPolygon, setCustomPolygon, setPresetShape, setIsDrawingPolygon,
    addAnnotation, updateAnnotation, removeAnnotation, setSelectedAnnotationId,
  } = store;

  const draw = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    overrideHour?: number,
    overrideAnnotations?: Annotation[],
    overrideSelectedId?: string | null,
  ) => {
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / 50;
    const colors = STYLES[style] ?? STYLES.clean;
    const hour = overrideHour ?? timeHour;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = colors.gridColor;
    ctx.lineWidth = 1;
    const gsp = Math.min(W, H) * 0.1;
    for (let x = ((cx % gsp) + gsp) % gsp; x < W; x += gsp) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = ((cy % gsp) + gsp) % gsp; y < H; y += gsp) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Building polygon
    let buildingPts: Point2D[];
    if (presetShape === 'custom' && customPolygon.length >= 3) {
      buildingPts = customPolygon.map(([lx, ly]) => logicalToCanvas(lx, ly, cx, cy, scale));
    } else {
      buildingPts = getPresetPoints(presetShape, buildingWidth, buildingDepth, 0)
        .map(([lx, ly]) => logicalToCanvas(lx, ly, cx, cy, scale));
    }

    // Sun position
    const { altitude, azimuth } = calcSunPosition(latitude, month, hour);
    const { rise, set } = calcSunriseSunset(latitude, month);

    // Shadow
    if (altitude > 1) {
      const altRad = altitude * Math.PI / 180;
      const shadowLen = (buildingHeight / Math.tan(altRad)) * scale;
      const azWithNorth = (azimuth + northAngle) * Math.PI / 180;
      const sdx = -Math.sin(azWithNorth) * shadowLen;
      const sdy = Math.cos(azWithNorth) * shadowLen;
      const shadowPts: Point2D[] = buildingPts.map(([x, y]) => [x + sdx, y + sdy]);
      drawPolygon(ctx, convexHull([...buildingPts, ...shadowPts]), colors.shadowFill);
    }

    // Sun arc
    const arcR = Math.min(W, H) * 0.34;
    ctx.beginPath();
    ctx.strokeStyle = colors.sunArcStroke;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    let arcStarted = false;
    for (let t = rise - 0.5; t <= set + 0.5; t += 0.15) {
      const { altitude: a, azimuth: az } = calcSunPosition(latitude, month, t);
      if (a <= 0) { arcStarted = false; continue; }
      const r = arcR * (1 - a / 90);
      const azRad = (az + northAngle) * Math.PI / 180;
      const sx = cx + r * Math.sin(azRad);
      const sy = cy - r * Math.cos(azRad);
      if (!arcStarted) { ctx.moveTo(sx, sy); arcStarted = true; }
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Hour ticks
    ctx.fillStyle = colors.subTextColor;
    ctx.font = `9px Inter, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let t = Math.ceil(rise); t <= Math.floor(set); t += 3) {
      const { altitude: a, azimuth: az } = calcSunPosition(latitude, month, t);
      if (a <= 0) continue;
      const r = arcR * (1 - a / 90);
      const azRad = (az + northAngle) * Math.PI / 180;
      const tx = cx + r * Math.sin(azRad);
      const ty = cy - r * Math.cos(azRad);
      ctx.beginPath();
      ctx.arc(tx, ty, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = colors.subTextColor;
      ctx.fill();
      ctx.fillStyle = colors.subTextColor;
      ctx.fillText(`${t}h`, tx + 6, ty - 6);
    }

    // Building
    drawPolygon(ctx, buildingPts, colors.buildingFill, colors.buildingStroke, colors.buildingStrokeWidth);

    // Sun indicator
    if (altitude > 0) {
      const r = arcR * (1 - altitude / 90);
      const azRad = (azimuth + northAngle) * Math.PI / 180;
      const sx = cx + r * Math.sin(azRad);
      const sy = cy - r * Math.cos(azRad);

      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(cx, cy);
      ctx.strokeStyle = colors.accentColor;
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.25;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      drawSunSymbol(ctx, sx, sy, colors.sunColor, colors.sunGlow, 7);
    } else {
      ctx.fillStyle = colors.subTextColor;
      ctx.font = `11px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('日没', cx, cy - arcR * 0.6);
    }

    // Draft polygon
    if (isDrawingPolygon && draftPolygon.length > 0) {
      const draftPts = draftPolygon.map(([lx, ly]) => logicalToCanvas(lx, ly, cx, cy, scale));
      ctx.strokeStyle = colors.accentColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(draftPts[0][0], draftPts[0][1]);
      draftPts.slice(1).forEach(([px, py]) => ctx.lineTo(px, py));
      if (cursorPos) ctx.lineTo(cursorPos[0], cursorPos[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      draftPts.forEach(([px, py], i) => {
        ctx.beginPath();
        ctx.arc(px, py, i === 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? colors.accentColor : colors.buildingStroke;
        ctx.fill();
      });
    }

    // Annotations
    const annsToRender = overrideAnnotations ?? annotations;
    const selId = overrideSelectedId === undefined ? selectedAnnotationId : overrideSelectedId;
    drawAnnotations(ctx, annsToRender, cx, cy, scale, selId);

    // Arrow draft preview (in-progress drag)
    if (arrowDraft) {
      const [x1, y1] = logicalToCanvas(arrowDraft.lx1, arrowDraft.ly1, cx, cy, scale);
      const [x2, y2] = logicalToCanvas(arrowDraft.lx2, arrowDraft.ly2, cx, cy, scale);
      ctx.save();
      ctx.globalAlpha = 0.7;
      drawArrow(ctx, x1, y1, x2, y2, annotationColor);
      ctx.restore();
    }

    // Compass
    drawCompassRose(ctx, W - 44, 44, 14, northAngle, colors.compassColor, colors.subTextColor);

    // Labels
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    ctx.font = `500 12px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = colors.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${MONTHS[month - 1]}  ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, 14, H - 14);
    if (altitude > 1) {
      ctx.font = `11px Inter, -apple-system, sans-serif`;
      ctx.fillStyle = colors.accentColor;
      ctx.fillText(`高度角 ${Math.round(altitude)}°  方位角 ${Math.round(azimuth)}°`, 14, H - 30);
    }
  }, [
    presetShape, customPolygon, buildingWidth, buildingDepth, buildingHeight,
    northAngle, month, timeHour, latitude, style,
    isDrawingPolygon, draftPolygon, cursorPos,
    annotations, annotationColor, arrowDraft, selectedAnnotationId,
  ]);

  // ── Render loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    if (!isAnimating) { draw(ctx, width, height); return; }

    const { rise, set } = calcSunriseSunset(latitude, month);
    const animDuration = 7000;
    let startTime: number | null = null;

    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = (ts - startTime) % animDuration;
      const t = elapsed / animDuration;
      const hour = rise + (set - rise) * t;
      setTimeHour(parseFloat(hour.toFixed(2)));
      draw(ctx, width, height, hour);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isAnimating, draw, width, height, latitude, month, setTimeHour]);

  // ── Canvas pixel helpers ──────────────────────────────────────────────────────
  const getLogical = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const scale = Math.min(width, height) / 50;
    return { px, py, lp: canvasToLogical(px, py, width / 2, height / 2, scale) };
  }, [width, height]);

  // ── Mouse interactions ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, lp } = getLogical(e);
    const scale = Math.min(width, height) / 50;
    const cx = width / 2, cy = height / 2;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;

    // Polygon drawing — left it to onClick handler
    if (isDrawingPolygon) return;

    // Text tool — place input on next click
    if (annotationTool === 'text') return;

    // Arrow tool — start draft
    if (annotationTool === 'arrow') {
      setArrowDraft({ lx1: lp[0], ly1: lp[1], lx2: lp[0], ly2: lp[1] });
      return;
    }

    // No tool — hit-test annotations for selection / drag
    const hit = hitTest(ctx, annotations, cx, cy, scale, px, py, selectedAnnotationId);
    if (hit) {
      setSelectedAnnotationId(hit.id);
      const origin = annotations.find(a => a.id === hit.id);
      if (origin) {
        setDrag({
          id: hit.id, type: hit.type, handle: hit.handle,
          startLx: lp[0], startLy: lp[1],
          origin,
        });
      }
    } else {
      setSelectedAnnotationId(null);
    }
  }, [getLogical, width, height, isDrawingPolygon, annotationTool, annotations, selectedAnnotationId, setSelectedAnnotationId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { px, py, lp } = getLogical(e);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const scale = Math.min(width, height) / 50;
    const cx = width / 2, cy = height / 2;

    if (isDrawingPolygon) {
      setCursorPos([px, py]);
    }

    if (arrowDraft) {
      setArrowDraft(d => d ? { ...d, lx2: lp[0], ly2: lp[1] } : null);
      return;
    }

    // Drag in progress
    if (drag) {
      const dx = lp[0] - drag.startLx;
      const dy = lp[1] - drag.startLy;
      if (drag.type === 'text' && drag.origin.type === 'text') {
        updateAnnotation(drag.id, {
          lx: drag.origin.lx + dx,
          ly: drag.origin.ly + dy,
        });
      } else if (drag.type === 'arrow' && drag.origin.type === 'arrow') {
        if (drag.handle === 'start') {
          updateAnnotation(drag.id, { lx1: drag.origin.lx1 + dx, ly1: drag.origin.ly1 + dy });
        } else if (drag.handle === 'end') {
          updateAnnotation(drag.id, { lx2: drag.origin.lx2 + dx, ly2: drag.origin.ly2 + dy });
        } else {
          updateAnnotation(drag.id, {
            lx1: drag.origin.lx1 + dx, ly1: drag.origin.ly1 + dy,
            lx2: drag.origin.lx2 + dx, ly2: drag.origin.ly2 + dy,
          });
        }
      }
      return;
    }

    // Hover cursor feedback for annotations when idle
    if (annotationTool === 'none' && !isDrawingPolygon) {
      const hit = hitTest(ctx, annotations, cx, cy, scale, px, py, selectedAnnotationId);
      if (hit) {
        setHoverCursor(hit.handle === 'start' || hit.handle === 'end' ? 'nwse-resize' : 'move');
      } else {
        setHoverCursor(null);
      }
    } else {
      setHoverCursor(null);
    }
  }, [getLogical, width, height, isDrawingPolygon, arrowDraft, drag, annotationTool, annotations, selectedAnnotationId, updateAnnotation]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (arrowDraft && annotationTool === 'arrow') {
      const { lp } = getLogical(e);
      const dist = Math.hypot(lp[0] - arrowDraft.lx1, lp[1] - arrowDraft.ly1);
      if (dist > 0.5) {
        const id = `ann_${Date.now()}`;
        addAnnotation({
          id, type: 'arrow',
          lx1: arrowDraft.lx1, ly1: arrowDraft.ly1,
          lx2: lp[0], ly2: lp[1],
          color: annotationColor,
        });
      }
      setArrowDraft(null);
      return;
    }
    if (drag) {
      setDrag(null);
    }
  }, [arrowDraft, annotationTool, getLogical, addAnnotation, annotationColor, drag]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Text annotation placement
    if (annotationTool === 'text') {
      const { px, py, lp } = getLogical(e);
      setTextInput({ visible: true, px, py, lx: lp[0], ly: lp[1], value: '' });
      return;
    }

    // Polygon drawing
    if (isDrawingPolygon) {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const scale = Math.min(width, height) / 50;
      const lp = canvasToLogical(px, py, width / 2, height / 2, scale);

      if (draftPolygon.length >= 3) {
        const [fx, fy] = logicalToCanvas(draftPolygon[0][0], draftPolygon[0][1], width / 2, height / 2, scale);
        if (Math.hypot(px - fx, py - fy) < 12) {
          setCustomPolygon(draftPolygon);
          setPresetShape('custom');
          setIsDrawingPolygon(false);
          setDraftPolygon([]);
          return;
        }
      }
      setDraftPolygon([...draftPolygon, lp]);
    }
  }, [annotationTool, isDrawingPolygon, draftPolygon, width, height, getLogical, setDraftPolygon, setCustomPolygon, setPresetShape, setIsDrawingPolygon]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingPolygon || draftPolygon.length < 3) return;
    e.preventDefault();
    setCustomPolygon(draftPolygon);
    setPresetShape('custom');
    setIsDrawingPolygon(false);
    setDraftPolygon([]);
  }, [isDrawingPolygon, draftPolygon, setCustomPolygon, setPresetShape, setIsDrawingPolygon, setDraftPolygon]);

  // ── Keyboard shortcuts (delete selected annotation) ─────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedAnnotationId) return;
      if (textInput?.visible) return;
      // Don't fire when typing in any input/textarea
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeAnnotation(selectedAnnotationId);
      } else if (e.key === 'Escape') {
        setSelectedAnnotationId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedAnnotationId, textInput, removeAnnotation, setSelectedAnnotationId]);

  // ── Text input commit ────────────────────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textInput || !textInput.value.trim()) { setTextInput(null); return; }
    addAnnotation({
      id: `ann_${Date.now()}`,
      type: 'text',
      lx: textInput.lx, ly: textInput.ly,
      text: textInput.value.trim(),
      color: annotationColor,
      fontSize: 13,
    });
    setTextInput(null);
  }, [textInput, addAnnotation, annotationColor]);

  // ── Export API ───────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportPng(w: number, h: number): string {
      const offscreen = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      offscreen.width = w * dpr;
      offscreen.height = h * dpr;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(dpr, dpr);
      // Render annotations but no selection outline
      draw(ctx, w, h, undefined, undefined, null);
      return offscreen.toDataURL('image/png');
    },
    renderFrame(w: number, h: number, hour: number): ImageData {
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const ctx = offscreen.getContext('2d')!;
      // Include annotations in GIF; no selection outline
      draw(ctx, w, h, hour, undefined, null);
      return ctx.getImageData(0, 0, w, h);
    },
  }));

  const cursor = isDrawingPolygon ? 'crosshair'
    : annotationTool === 'text' ? 'text'
    : annotationTool === 'arrow' ? 'crosshair'
    : hoverCursor ?? 'default';

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor }}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setCursorPos(null);
          if (arrowDraft) setArrowDraft(null);
          if (drag) setDrag(null);
          setHoverCursor(null);
        }}
      />

      {/* Floating text input */}
      {textInput?.visible && (
        <input
          autoFocus
          value={textInput.value}
          onChange={e => setTextInput(s => s ? { ...s, value: e.target.value } : null)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitText(); }
            if (e.key === 'Escape') { setTextInput(null); }
          }}
          onBlur={commitText}
          style={{
            position: 'absolute',
            left: textInput.px,
            top: textInput.py - 28,
            background: 'rgba(18,20,26,0.9)',
            border: '1px solid rgba(174,213,129,0.6)',
            borderRadius: 4,
            color: textInput.value ? annotationColor : 'rgba(255,255,255,0.5)',
            fontSize: 13,
            fontFamily: 'Inter, -apple-system, sans-serif',
            fontWeight: 600,
            padding: '3px 8px',
            outline: 'none',
            minWidth: 120,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            zIndex: 20,
          }}
          placeholder="テキストを入力… Enter で確定"
        />
      )}
    </div>
  );
});

SunDiagramCanvas.displayName = 'SunDiagramCanvas';
