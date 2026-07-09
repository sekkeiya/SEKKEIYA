import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { useDsdStore, type Annotation, type LayoutZone, type LayoutFlow, type LayoutMode } from '../store/useDsdStore';
import { logicalToCanvas, canvasToLogical, type Point2D } from './shapeUtils';
import { categoryDef } from './layoutPalette';

// ─── Style backdrops ─────────────────────────────────────────────────────────

const BG_STYLES = {
  clean: { bg: '#fafafa', text: '#212121', sub: '#757575', grid: 'rgba(0,0,0,0.05)' },
  bold:  { bg: '#ffffff', text: '#1a1a1a', sub: '#616161', grid: 'rgba(0,0,0,0.04)' },
  dark:  { bg: '#0b0f16', text: 'rgba(255,255,255,0.88)', sub: 'rgba(255,255,255,0.5)', grid: 'rgba(255,255,255,0.04)' },
} as const;

const SELECT_HL = '#aed581';
const FLOW_ACCENT = '#ffb74d';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function drawZoneRect(
  ctx: CanvasRenderingContext2D,
  z: LayoutZone, cx: number, cy: number, scale: number,
  fill: string, stroke: string, textColor: string,
  selected: boolean, hover: boolean,
) {
  const [px, py] = logicalToCanvas(z.cx, z.cy, cx, cy, scale);
  const pw = z.w * scale;
  const ph = z.h * scale;
  const x = px - pw / 2;
  const y = py - ph / 2;

  ctx.save();
  if (hover) {
    ctx.shadowColor = FLOW_ACCENT;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = fill;
  ctx.strokeStyle = selected ? SELECT_HL : stroke;
  ctx.lineWidth = selected ? 2.5 : hover ? 2 : 1.5;
  if (ctx.roundRect) {
    ctx.beginPath(); ctx.roundRect(x, y, pw, ph, 8); ctx.fill(); ctx.stroke();
  } else {
    ctx.fillRect(x, y, pw, ph); ctx.strokeRect(x, y, pw, ph);
  }
  ctx.restore();

  const fontSize = Math.max(11, Math.min(scale * 0.65, 16));
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(z.label, px, py);

  if (selected) {
    ctx.save();
    ctx.strokeStyle = SELECT_HL;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x - 4, y - 4, pw + 8, ph + 8);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawZoneBubble(
  ctx: CanvasRenderingContext2D,
  z: LayoutZone, cx: number, cy: number, scale: number,
  fill: string, stroke: string, textColor: string,
  selected: boolean, hover: boolean,
) {
  const [px, py] = logicalToCanvas(z.cx, z.cy, cx, cy, scale);
  const r = (Math.min(z.w, z.h) / 2) * scale;

  ctx.save();
  if (hover) {
    ctx.shadowColor = FLOW_ACCENT;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = fill;
  ctx.strokeStyle = selected ? SELECT_HL : stroke;
  ctx.lineWidth = selected ? 2.5 : hover ? 2 : 1.5;
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();

  const fontSize = Math.max(11, Math.min(scale * 0.55, 14));
  ctx.font = `600 ${fontSize}px Inter, -apple-system, sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(z.label, px, py);

  if (selected) {
    ctx.save();
    ctx.strokeStyle = SELECT_HL;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 2.5) {
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

function drawDashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Animation timeline helpers (GIF intro sequence) ─────────────────────────
// animT 0..1: zones appear (0.00–0.30) → flows draw (0.27–0.53) → walker (0.52–1.0)

function easeOut3(p: number): number { return 1 - Math.pow(1 - p, 3); }

function zoneAppearAlpha(idx: number, total: number, t: number): number {
  if (total === 0) return 1;
  const start = (idx / total) * 0.22;
  const end = start + 0.18;
  if (t >= end) return 1;
  if (t <= start) return 0;
  return easeOut3((t - start) / (end - start));
}

function flowDrawProgress(idx: number, total: number, t: number): number {
  if (total === 0) return 1;
  const start = 0.27 + (idx / Math.max(total, 1)) * 0.20;
  const end = start + 0.16;
  if (t >= end) return 1;
  if (t <= start) return 0;
  return easeOut3((t - start) / (end - start));
}

function walkerPhaseT(t: number): number | null {
  return t >= 0.52 ? (t - 0.52) / 0.48 : null;
}

// ─────────────────────────────────────────────────────────────────────────────

function zoneCenter(z: LayoutZone, cx: number, cy: number, scale: number): Point2D {
  return logicalToCanvas(z.cx, z.cy, cx, cy, scale);
}

function zoneEdgePoint(z: LayoutZone, targetX: number, targetY: number, cx: number, cy: number, scale: number, mode: LayoutMode): Point2D {
  const [zx, zy] = zoneCenter(z, cx, cy, scale);
  const dx = targetX - zx;
  const dy = targetY - zy;
  const dist = Math.hypot(dx, dy) || 1;
  if (mode === 'bubble') {
    const r = (Math.min(z.w, z.h) / 2) * scale;
    return [zx + (dx / dist) * r, zy + (dy / dist) * r];
  }
  const hw = (z.w / 2) * scale;
  const hh = (z.h / 2) * scale;
  const ux = dx / dist;
  const uy = dy / dist;
  const tx = ux !== 0 ? hw / Math.abs(ux) : Infinity;
  const ty = uy !== 0 ? hh / Math.abs(uy) : Infinity;
  const t = Math.min(tx, ty);
  return [zx + ux * t, zy + uy * t];
}

function pointInZone(z: LayoutZone, lx: number, ly: number, mode: LayoutMode): boolean {
  if (mode === 'bubble') {
    const r = Math.min(z.w, z.h) / 2;
    return Math.hypot(lx - z.cx, ly - z.cy) <= r;
  }
  return (
    lx >= z.cx - z.w / 2 && lx <= z.cx + z.w / 2 &&
    ly >= z.cy - z.h / 2 && ly <= z.cy + z.h / 2
  );
}

// Slightly expanded hit box for drag/click – adds padding in logical units
function pointNearZone(z: LayoutZone, lx: number, ly: number, mode: LayoutMode, padMeters: number): boolean {
  if (mode === 'bubble') {
    const r = Math.min(z.w, z.h) / 2 + padMeters;
    return Math.hypot(lx - z.cx, ly - z.cy) <= r;
  }
  return (
    lx >= z.cx - z.w / 2 - padMeters && lx <= z.cx + z.w / 2 + padMeters &&
    ly >= z.cy - z.h / 2 - padMeters && ly <= z.cy + z.h / 2 + padMeters
  );
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
      ctx.save();
      ctx.font = `600 ${ann.fontSize}px Inter, -apple-system, sans-serif`;
      const metrics = ctx.measureText(ann.text);
      const pad = 5;
      const bw = metrics.width + pad * 2;
      const bh = ann.fontSize + pad * 2 - 2;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
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

// ─── Main component ───────────────────────────────────────────────────────────

export interface LayoutDiagramCanvasHandle {
  exportPng(w: number, h: number): string;
  renderFrame(w: number, h: number, animT: number): ImageData;
}

interface Props { width: number; height: number; }

type ZoneDragState = {
  zoneId: string;
  startLx: number; startLy: number;
  originCx: number; originCy: number;
};

export const LayoutDiagramCanvas = forwardRef<LayoutDiagramCanvasHandle, Props>(({ width, height }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const animTRef = useRef<number>(0);

  // Zone move drag
  const [moveDrag, setMoveDrag] = useState<ZoneDragState | null>(null);

  // Flow drag: drag from source zone center to target zone
  const [flowDragCanvasPos, setFlowDragCanvasPos] = useState<Point2D | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);

  const {
    style, layoutMode, layoutTool, layoutCategory,
    zones, addZone, updateZone, removeZone, selectedZoneId, setSelectedZoneId,
    flows, addFlow, selectedFlowId, setSelectedFlowId,
    isLayoutAnimating,
    flowDraftFromId, setFlowDraftFromId,
    annotations, selectedAnnotationId,
  } = useDsdStore();

  // ── Scale helper ────────────────────────────────────────────────────────────
  const getScale = useCallback(() => Math.min(width, height) / 50, [width, height]);

  // ── getLogical: canvas-relative px/py → logical metres ────────────────────
  const getLogical = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / (rect.width * (window.devicePixelRatio || 1)));
    const py = (e.clientY - rect.top) * (canvas.height / (rect.height * (window.devicePixelRatio || 1)));
    // correct: use CSS pixels for logical, matching draw() which uses W/H as CSS dims
    const cssPx = e.clientX - rect.left;
    const cssPy = e.clientY - rect.top;
    const scale = getScale();
    const lp = canvasToLogical(cssPx, cssPy, width / 2, height / 2, scale);
    return { cssPx, cssPy, lp };
  }, [width, height, getScale]);

  // ── Find zone under logical point (with optional extra padding) ─────────────
  const findZoneAt = useCallback((lx: number, ly: number, padMeters = 0): LayoutZone | null => {
    for (let i = zones.length - 1; i >= 0; i--) {
      if (pointNearZone(zones[i], lx, ly, layoutMode, padMeters)) return zones[i];
    }
    return null;
  }, [zones, layoutMode]);

  // ── Draw ───────────────────────────────────────────────────────────────────
  const draw = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    overrideAnimT?: number,
    overrideSelectedZone?: string | null,
    overrideSelectedFlow?: string | null,
    overrideFlowDraft?: string | null,
    overrideFlowDragPos?: Point2D | null,
    overrideHoverZone?: string | null,
    isIntroAnim?: boolean,
  ) => {
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) / 50;
    const colors = BG_STYLES[style] ?? BG_STYLES.clean;

    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    const gsp = Math.min(W, H) * 0.1;
    for (let x = ((cx % gsp) + gsp) % gsp; x < W; x += gsp) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = ((cy % gsp) + gsp) % gsp; y < H; y += gsp) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const selZoneId = overrideSelectedZone === undefined ? selectedZoneId : overrideSelectedZone;
    const selFlowId = overrideSelectedFlow === undefined ? selectedFlowId : overrideSelectedFlow;
    const draftFrom = overrideFlowDraft === undefined ? flowDraftFromId : overrideFlowDraft;
    const dragPos = overrideFlowDragPos === undefined ? flowDragCanvasPos : overrideFlowDragPos;
    const hoverId = overrideHoverZone === undefined ? hoverZoneId : overrideHoverZone;

    // Existing flows
    for (const [fidx, f] of flows.entries()) {
      const from = zones.find(z => z.id === f.fromZoneId);
      const to = zones.find(z => z.id === f.toZoneId);
      if (!from || !to) continue;
      const [fxC, fyC] = zoneCenter(from, cx, cy, scale);
      const [txC, tyC] = zoneCenter(to, cx, cy, scale);
      const [fx, fy] = zoneEdgePoint(from, txC, tyC, cx, cy, scale, layoutMode);
      const [tx, ty] = zoneEdgePoint(to, fxC, fyC, cx, cy, scale, layoutMode);
      const isSel = f.id === selFlowId;
      const progress = isIntroAnim && overrideAnimT !== undefined
        ? flowDrawProgress(fidx, flows.length, overrideAnimT)
        : 1;
      if (progress <= 0) continue;
      if (layoutMode === 'zoning') {
        if (progress >= 1) {
          drawArrow(ctx, fx, fy, tx, ty, isSel ? SELECT_HL : colors.text, isSel ? 3.5 : 2.5);
        } else {
          const mx = fx + (tx - fx) * progress;
          const my = fy + (ty - fy) * progress;
          ctx.save();
          ctx.strokeStyle = isSel ? SELECT_HL : colors.text;
          ctx.lineWidth = isSel ? 3.5 : 2.5;
          ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(mx, my); ctx.stroke();
          const tipGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 18);
          tipGrad.addColorStop(0, 'rgba(255,183,77,0.85)');
          tipGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = tipGrad;
          ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      } else {
        if (progress >= 1) {
          drawDashedLine(ctx, fx, fy, tx, ty, isSel ? SELECT_HL : colors.sub);
        } else {
          const mx = fx + (tx - fx) * progress;
          const my = fy + (ty - fy) * progress;
          ctx.save();
          ctx.strokeStyle = isSel ? SELECT_HL : colors.sub;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(mx, my); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    }

    // Rubber-band preview while dragging a new flow
    if (draftFrom && dragPos) {
      const from = zones.find(z => z.id === draftFrom);
      if (from) {
        const [fxC, fyC] = zoneCenter(from, cx, cy, scale);
        ctx.save();
        ctx.strokeStyle = FLOW_ACCENT;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(fxC, fyC);
        ctx.lineTo(dragPos[0], dragPos[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;

        // Arrowhead preview at cursor
        const dx = dragPos[0] - fxC;
        const dy = dragPos[1] - fyC;
        if (Math.hypot(dx, dy) > 20) {
          const angle = Math.atan2(dy, dx);
          const hLen = 12;
          ctx.fillStyle = FLOW_ACCENT;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(dragPos[0], dragPos[1]);
          ctx.lineTo(dragPos[0] - hLen * Math.cos(angle - Math.PI / 7), dragPos[1] - hLen * Math.sin(angle - Math.PI / 7));
          ctx.lineTo(dragPos[0] - hLen * Math.cos(angle + Math.PI / 7), dragPos[1] - hLen * Math.sin(angle + Math.PI / 7));
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.restore();
      }
    }

    // Zones
    for (const [zidx, z] of zones.entries()) {
      const def = categoryDef(z.category);
      const palette = def[style] ?? def.clean;
      const isSel = z.id === selZoneId;
      const isHover = layoutTool === 'flow' && z.id === hoverId;
      const isDraftSrc = z.id === draftFrom;
      const alpha = isIntroAnim && overrideAnimT !== undefined
        ? zoneAppearAlpha(zidx, zones.length, overrideAnimT)
        : 1;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (isIntroAnim && alpha < 1) {
        const sc = 0.82 + 0.18 * easeOut3(alpha);
        const [zpx, zpy] = logicalToCanvas(z.cx, z.cy, cx, cy, scale);
        ctx.translate(zpx, zpy); ctx.scale(sc, sc); ctx.translate(-zpx, -zpy);
      }
      if (layoutMode === 'zoning') {
        drawZoneRect(ctx, z, cx, cy, scale, palette.fill, isDraftSrc ? FLOW_ACCENT : palette.stroke, palette.text, isSel, isHover || isDraftSrc);
      } else {
        drawZoneBubble(ctx, z, cx, cy, scale, palette.fill, isDraftSrc ? FLOW_ACCENT : palette.stroke, palette.text, isSel, isHover || isDraftSrc);
      }
      ctx.restore();
    }

    // Animated walker — zoning mode only
    if (layoutMode === 'zoning' && flows.length > 0) {
      const wt = isIntroAnim
        ? walkerPhaseT(overrideAnimT ?? 0)
        : (overrideAnimT !== undefined ? overrideAnimT : null);
      if (wt !== null) {
        const segCount = flows.length;
        const segLen = 1 / segCount;
        const segIdx = Math.min(Math.floor(wt / segLen), segCount - 1);
        const segT = (wt - segIdx * segLen) / segLen;
        const f = flows[segIdx];
        const from = zones.find(z => z.id === f.fromZoneId);
        const to = zones.find(z => z.id === f.toZoneId);
        if (from && to) {
          const [fxC, fyC] = zoneCenter(from, cx, cy, scale);
          const [txC, tyC] = zoneCenter(to, cx, cy, scale);
          const [fx, fy] = zoneEdgePoint(from, txC, tyC, cx, cy, scale, layoutMode);
          const [tx, ty] = zoneEdgePoint(to, fxC, fyC, cx, cy, scale, layoutMode);
          const wx = fx + (tx - fx) * segT;
          const wy = fy + (ty - fy) * segT;
          ctx.save();
          const grad = ctx.createRadialGradient(wx, wy, 0, wx, wy, 22);
          grad.addColorStop(0, 'rgba(174,213,129,0.45)');
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(wx, wy, 22, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#aed581';
          ctx.beginPath(); ctx.arc(wx, wy, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#1b2a00'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Annotations
    drawAnnotations(ctx, annotations, cx, cy, scale, selectedAnnotationId);

    // Status label
    ctx.font = `500 12px Inter, -apple-system, sans-serif`;
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const modeLabel = layoutMode === 'zoning' ? 'ゾーニング・動線' : 'バブルダイアグラム';
    ctx.fillText(`${modeLabel}  ·  ${zones.length} ゾーン  ·  ${flows.length} ${layoutMode === 'zoning' ? '動線' : '隣接'}`, 14, H - 14);

    if (zones.length === 0) {
      ctx.fillStyle = colors.sub;
      ctx.font = `13px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('「ゾーン追加」ツールでカテゴリを選んでキャンバスをクリック', cx, cy);
    } else if (layoutTool === 'flow' && zones.length >= 2 && flows.length === 0 && !draftFrom) {
      ctx.fillStyle = colors.sub;
      ctx.font = `12px Inter, -apple-system, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ゾーンからドラッグして別のゾーンで放すと動線が作成されます', cx, H - 40);
    }
  }, [
    style, layoutMode, layoutTool, zones, flows,
    flowDraftFromId, flowDragCanvasPos, hoverZoneId,
    selectedZoneId, selectedFlowId, annotations, selectedAnnotationId,
  ]);

  // ── Render loop ───────────────────────────────────────────────────────────
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

    if (!isLayoutAnimating || layoutMode !== 'zoning' || flows.length === 0) {
      draw(ctx, width, height);
      return;
    }

    const animDuration = Math.max(2500, flows.length * 1300);
    let startTime: number | null = null;
    const animate = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = (ts - startTime) % animDuration;
      const t = elapsed / animDuration;
      animTRef.current = t;
      draw(ctx, width, height, t);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [isLayoutAnimating, layoutMode, flows.length, draw, width, height]);

  // ── Mouse helpers ─────────────────────────────────────────────────────────
  const getCanvasPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>): Point2D => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }, []);

  // ── Mouse down ────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { lp } = getLogical(e);
    // generous hit: 1.0 meter padding around zones
    const hit = findZoneAt(lp[0], lp[1], 1.0);

    if (layoutTool === 'addZone') {
      const def = categoryDef(layoutCategory);
      const isBig = layoutCategory === 'ldk' || layoutCategory === 'outdoor';
      const w = isBig ? 11 : 7;
      const h = isBig ? 8 : 6;
      const id = `zone_${Date.now()}`;
      addZone({ id, category: layoutCategory, label: def.label, cx: lp[0], cy: lp[1], w, h });
      setSelectedZoneId(id);
      return;
    }

    if (layoutTool === 'flow') {
      if (!hit) return;
      // Start a flow drag
      setFlowDraftFromId(hit.id);
      setFlowDragCanvasPos(getCanvasPos(e));
      setSelectedZoneId(null);
      return;
    }

    // Default (none) — select or start a move drag
    if (hit) {
      setSelectedZoneId(hit.id);
      setSelectedFlowId(null);
      setMoveDrag({
        zoneId: hit.id,
        startLx: lp[0], startLy: lp[1],
        originCx: hit.cx, originCy: hit.cy,
      });
    } else {
      setSelectedZoneId(null);
      setSelectedFlowId(null);
    }
  }, [getLogical, getCanvasPos, findZoneAt, layoutTool, layoutCategory, addZone, setSelectedZoneId, setSelectedFlowId, setFlowDraftFromId]);

  // ── Mouse move ────────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { lp } = getLogical(e);

    // Update rubber-band drag pos
    if (flowDraftFromId) {
      setFlowDragCanvasPos(getCanvasPos(e));
    }

    // Move drag
    if (moveDrag) {
      const dx = lp[0] - moveDrag.startLx;
      const dy = lp[1] - moveDrag.startLy;
      updateZone(moveDrag.zoneId, { cx: moveDrag.originCx + dx, cy: moveDrag.originCy + dy });
      return;
    }

    // Hover highlight for flow tool
    if (layoutTool === 'flow') {
      const hit = findZoneAt(lp[0], lp[1], 1.0);
      setHoverZoneId(hit ? hit.id : null);
    } else {
      setHoverZoneId(null);
    }
  }, [getLogical, getCanvasPos, flowDraftFromId, moveDrag, updateZone, layoutTool, findZoneAt]);

  // ── Mouse up ──────────────────────────────────────────────────────────────
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (moveDrag) {
      setMoveDrag(null);
      return;
    }

    if (flowDraftFromId && layoutTool === 'flow') {
      const { lp } = getLogical(e);
      // generous hit for drop target
      const target = findZoneAt(lp[0], lp[1], 1.5);
      if (target && target.id !== flowDraftFromId) {
        addFlow({ id: `flow_${Date.now()}`, fromZoneId: flowDraftFromId, toZoneId: target.id });
      }
      setFlowDraftFromId(null);
      setFlowDragCanvasPos(null);
    }
  }, [moveDrag, flowDraftFromId, layoutTool, getLogical, findZoneAt, addFlow, setFlowDraftFromId]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || (ae as HTMLElement).isContentEditable)) return;
      if (e.key === 'Escape') {
        setFlowDraftFromId(null);
        setFlowDragCanvasPos(null);
        setSelectedZoneId(null);
        setSelectedFlowId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (selectedZoneId) { e.preventDefault(); removeZone(selectedZoneId); }
        else if (selectedFlowId) { e.preventDefault(); useDsdStore.getState().removeFlow(selectedFlowId); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedZoneId, selectedFlowId, removeZone, setSelectedZoneId, setSelectedFlowId, setFlowDraftFromId]);

  // ── Export ────────────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportPng(w: number, h: number): string {
      const offscreen = document.createElement('canvas');
      const dpr = window.devicePixelRatio || 1;
      offscreen.width = w * dpr; offscreen.height = h * dpr;
      const ctx = offscreen.getContext('2d')!;
      ctx.scale(dpr, dpr);
      draw(ctx, w, h, undefined, null, null, null, null, null);
      return offscreen.toDataURL('image/png');
    },
    renderFrame(w: number, h: number, animT: number): ImageData {
      const offscreen = document.createElement('canvas');
      offscreen.width = w; offscreen.height = h;
      const ctx = offscreen.getContext('2d')!;
      draw(ctx, w, h, animT, null, null, null, null, null, true);
      return ctx.getImageData(0, 0, w, h);
    },
  }), [draw]);

  const isFlowDragging = !!flowDraftFromId;
  const cursor =
    layoutTool === 'addZone' ? 'crosshair' :
    layoutTool === 'flow' ? (isFlowDragging ? 'grabbing' : (hoverZoneId ? 'grab' : 'crosshair')) :
    moveDrag ? 'grabbing' :
    (hoverZoneId ? 'move' : 'default');

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (moveDrag) setMoveDrag(null);
          if (flowDraftFromId) { setFlowDraftFromId(null); setFlowDragCanvasPos(null); }
          setHoverZoneId(null);
        }}
      />
    </div>
  );
});

LayoutDiagramCanvas.displayName = 'LayoutDiagramCanvas';
