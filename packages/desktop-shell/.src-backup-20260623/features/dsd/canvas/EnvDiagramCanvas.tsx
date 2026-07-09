import React, {
  forwardRef, useImperativeHandle,
  useRef, useEffect, useCallback,
} from 'react';
import { useDsdStore, type DsdStyle, type NoiseSource } from '../store/useDsdStore';
import { getPresetPoints, logicalToCanvas, type Point2D } from './shapeUtils';
import { calcSunPosition } from './sunMath';

export interface EnvDiagramCanvasHandle {
  exportPng: (w: number, h: number) => string;
  renderFrame: (w: number, h: number, t: number) => ImageData;
}

interface Props { width: number; height: number; }

// ─── Drag state union ─────────────────────────────────────────────────────────

type DragState =
  | { type: 'compass' }
  | { type: 'noise'; noiseId: string }
  | { type: 'windViewBody'; offsetLx: number; offsetLy: number }
  | { type: 'windViewHandle'; handleIdx: number; origL: number; origR: number; origT: number; origB: number };

// Handle index → which logical edges are free (L=left, R=right, T=top, B=bottom)
const HANDLE_FREE: Array<Array<'L' | 'R' | 'T' | 'B'>> = [
  ['L', 'T'], ['T'], ['R', 'T'],   // 0=NW  1=N   2=NE
  ['R'],                            // 3=E
  ['R', 'B'], ['B'], ['L', 'B'],   // 4=SE  5=S   6=SW
  ['L'],                            // 7=W
];
const HANDLE_CURSORS = [
  'nw-resize', 'n-resize', 'ne-resize',
  'e-resize',
  'se-resize', 's-resize', 'sw-resize',
  'w-resize',
] as const;

function getWindViewHandlePositions(vl: number, vt: number, vr: number, vb: number): [number, number][] {
  const mx = (vl + vr) / 2, my = (vt + vb) / 2;
  return [
    [vl, vt], [mx, vt], [vr, vt],
    [vr, my],
    [vr, vb], [mx, vb], [vl, vb],
    [vl, my],
  ];
}

// ─── Palettes ────────────────────────────────────────────────────────────────

type Palette = {
  bg: string; grid: string;
  building: string; buildingStroke: string;
  windStream: string; windFast: string; windWake: string;
  noiseColors: string[];
  thermalHot: string; thermalWarm: string; thermalCool: string; thermalCold: string; thermalShadow: string;
  northArrow: string; text: string; sub: string;
};

const PALETTES: Record<DsdStyle, Palette> = {
  clean: {
    bg: '#f2f3f5', grid: 'rgba(0,0,0,0.06)',
    building: '#ffffff', buildingStroke: '#424242',
    windStream: '#1565c0', windFast: '#42a5f5', windWake: '#ef5350',
    noiseColors: ['rgba(244,67,54,0.55)', 'rgba(255,152,0,0.45)', 'rgba(255,235,59,0.35)', 'rgba(139,195,74,0.2)', 'rgba(0,0,0,0)'],
    thermalHot: 'rgba(244,81,30,0.45)', thermalWarm: 'rgba(255,160,0,0.3)', thermalCool: 'rgba(41,182,246,0.25)', thermalCold: 'rgba(21,101,192,0.35)', thermalShadow: 'rgba(21,101,192,0.22)',
    northArrow: '#424242', text: '#212121', sub: '#757575',
  },
  bold: {
    bg: '#0d1b3e', grid: 'rgba(255,255,255,0.05)',
    building: '#162354', buildingStroke: '#90caf9',
    windStream: '#64b5f6', windFast: '#b3e5fc', windWake: '#ef9a9a',
    noiseColors: ['rgba(229,57,53,0.65)', 'rgba(251,140,0,0.55)', 'rgba(253,216,53,0.45)', 'rgba(124,179,66,0.3)', 'rgba(0,0,0,0)'],
    thermalHot: 'rgba(229,57,53,0.5)', thermalWarm: 'rgba(251,140,0,0.35)', thermalCool: 'rgba(66,165,245,0.3)', thermalCold: 'rgba(21,101,192,0.4)', thermalShadow: 'rgba(13,27,62,0.5)',
    northArrow: '#90caf9', text: '#e3f2fd', sub: '#90caf9',
  },
  dark: {
    bg: '#0b0f16', grid: 'rgba(255,255,255,0.04)',
    building: '#131924', buildingStroke: '#80cbc4',
    windStream: '#4dd0e1', windFast: '#80deea', windWake: '#ef5350',
    noiseColors: ['rgba(239,83,80,0.6)', 'rgba(255,112,67,0.5)', 'rgba(255,213,79,0.4)', 'rgba(102,187,106,0.25)', 'rgba(0,0,0,0)'],
    thermalHot: 'rgba(255,23,68,0.45)', thermalWarm: 'rgba(255,111,0,0.35)', thermalCool: 'rgba(0,176,255,0.3)', thermalCold: 'rgba(41,121,255,0.4)', thermalShadow: 'rgba(0,0,0,0.45)',
    northArrow: '#80cbc4', text: '#e0e0e0', sub: '#80cbc4',
  },
};

// ─── Wind math (potential flow around cylinder) ───────────────────────────────

function windVelocityLogical(
  lx: number, ly: number,
  windDirDeg: number, R: number,
): [number, number] {
  const phi = windDirDeg * Math.PI / 180;
  const sinp = Math.sin(phi), cosp = Math.cos(phi);
  const fx = -sinp, fy = -cosp;
  const px = cosp, py = -sinp;

  const Xw = lx * fx + ly * fy;
  const Yw = lx * px + ly * py;
  const rw2 = Xw * Xw + Yw * Yw;
  if (rw2 < R * R * 0.04) return [0, 0];

  const R2 = R * R;
  const rw4 = rw2 * rw2;
  const uw = 1 - R2 * (Xw * Xw - Yw * Yw) / rw4;
  const vw = -2 * R2 * Xw * Yw / rw4;

  return [uw * fx + vw * px, uw * fy + vw * py];
}

function computeStreamline(
  psiVal: number, windDirDeg: number, R: number, halfW: number, halfH: number,
): Point2D[] {
  const phi = windDirDeg * Math.PI / 180;
  const sinp = Math.sin(phi), cosp = Math.cos(phi);
  const fx = -sinp, fy = -cosp;
  const px = cosp, py = -sinp;

  const upstreamDist = Math.max(halfW, halfH) * 1.3;
  const Xw0 = -upstreamDist;
  const Yw0 = psiVal;

  let lx = Xw0 * fx + Yw0 * px;
  let ly = Xw0 * fy + Yw0 * py;

  const pts: Point2D[] = [[lx, ly]];
  const dt = 0.28;
  const limit = Math.max(halfW, halfH) * 1.6;

  for (let i = 0; i < 500; i++) {
    const [vx, vy] = windVelocityLogical(lx, ly, windDirDeg, R);
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd < 0.001) break;
    lx += vx / spd * dt;
    ly += vy / spd * dt;
    pts.push([lx, ly]);
    if (Math.abs(lx) > limit || Math.abs(ly) > limit) break;
  }
  return pts;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function convexHullSimple(pts: Point2D[]): Point2D[] {
  const sorted = [...pts].sort(([ax, ay], [bx, by]) => ax !== bx ? ax - bx : ay - by);
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2D[] = [];
  for (const p of sorted) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: Point2D[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) { const p = sorted[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  lower.pop(); upper.pop();
  return [...lower, ...upper];
}

function drawNorthArrow(ctx: CanvasRenderingContext2D, W: number, H: number, color: string, textColor: string) {
  const cx = 28, cy = 32, r = 14;
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx + 5, cy + r * 0.3); ctx.lineTo(cx, cy); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(cx - 5, cy + r * 0.3); ctx.lineTo(cx, cy); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
  ctx.font = 'bold 9px sans-serif'; ctx.fillStyle = textColor; ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy + r + 10);
  ctx.restore();
}

// ─── Core render ─────────────────────────────────────────────────────────────

type RenderParams = {
  style: DsdStyle;
  buildingPolygon: Point2D[];
  buildingWidth: number; buildingDepth: number; buildingHeight: number;
  windDirection: number; windSpeed: number;
  isEnvAnimating: boolean;
  envLayer: string;
  noiseSources: NoiseSource[];
  selectedNoiseId: string | null;
  thermalSeason: string; month: number; latitude: number; northAngle: number;
  diagramTitle: string;
  annotations: { type: string; lx?: number; ly?: number; lx1?: number; ly1?: number; lx2?: number; ly2?: number; text?: string; color: string; fontSize?: number }[];
  // Wind view box
  windViewCx: number; windViewCy: number; windViewW: number; windViewH: number;
  isWindViewSelected: boolean;
};

function renderToCanvas(canvas: HTMLCanvasElement, t: number, params: RenderParams) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pal = PALETTES[params.style];

  const PAD = Math.max(params.buildingWidth, params.buildingDepth) * 2.5 + 12;
  const viewHW = params.buildingWidth / 2 + PAD;
  const viewHH = params.buildingDepth / 2 + PAD;
  const scale = Math.min((W / 2) / viewHW, (H / 2) / viewHH) * 0.92;

  const L2C = (lx: number, ly: number): Point2D =>
    logicalToCanvas(lx, ly, W / 2, H / 2, scale);

  // Background
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  const gridStep = scale * 5;
  for (let x = W / 2 % gridStep; x < W; x += gridStep) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = H / 2 % gridStep; y < H; y += gridStep) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Layer-specific rendering
  if (params.envLayer === 'wind') {
    renderWindLayer(ctx, W, H, scale, L2C, t, pal, {
      ...params,
      windViewCx: params.windViewCx, windViewCy: params.windViewCy,
      windViewW: params.windViewW, windViewH: params.windViewH,
      isWindViewSelected: params.isWindViewSelected,
    });
  } else if (params.envLayer === 'noise') {
    renderNoiseLayer(ctx, W, H, scale, L2C, t, pal, params);
  } else {
    renderThermalLayer(ctx, W, H, scale, L2C, t, pal, params);
  }

  // Building (drawn on top of environment layers)
  const poly = params.buildingPolygon;
  if (poly.length >= 3) {
    ctx.beginPath();
    const [bx0, by0] = L2C(poly[0][0], poly[0][1]);
    ctx.moveTo(bx0, by0);
    for (let i = 1; i < poly.length; i++) {
      const [bx, by] = L2C(poly[i][0], poly[i][1]);
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fillStyle = pal.building;
    ctx.fill();
    ctx.strokeStyle = pal.buildingStroke;
    ctx.lineWidth = params.style === 'bold' ? 2.5 : 1.5;
    ctx.stroke();
  }

  // Annotations
  for (const ann of params.annotations) {
    ctx.save();
    if (ann.type === 'text' && ann.lx !== undefined && ann.ly !== undefined && ann.text) {
      const [ax, ay] = L2C(ann.lx, ann.ly);
      ctx.font = `${ann.fontSize ?? 14}px sans-serif`;
      ctx.fillStyle = ann.color;
      ctx.fillText(ann.text, ax, ay);
    } else if (ann.type === 'arrow' && ann.lx1 !== undefined) {
      const [ax1, ay1] = L2C(ann.lx1!, ann.ly1!);
      const [ax2, ay2] = L2C(ann.lx2!, ann.ly2!);
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
      const ang = Math.atan2(ay2 - ay1, ax2 - ax1);
      ctx.beginPath();
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - 10 * Math.cos(ang - 0.4), ay2 - 10 * Math.sin(ang - 0.4));
      ctx.lineTo(ax2 - 10 * Math.cos(ang + 0.4), ay2 - 10 * Math.sin(ang + 0.4));
      ctx.closePath(); ctx.fillStyle = ann.color; ctx.fill();
    }
    ctx.restore();
  }

  // North arrow
  drawNorthArrow(ctx, W, H, pal.northArrow, pal.text);

  // Title
  const titleSize = Math.max(11, Math.min(16, W / 40));
  ctx.font = `700 ${titleSize}px sans-serif`;
  ctx.fillStyle = pal.text;
  ctx.textAlign = 'left';
  ctx.fillText(params.diagramTitle, 16, 22);

  // Layer label (bottom right, above wind compass area)
  const layerLabel = params.envLayer === 'wind' ? '風環境' : params.envLayer === 'noise' ? '音環境' : '温熱環境';
  ctx.font = `500 ${Math.max(10, titleSize - 2)}px sans-serif`;
  ctx.fillStyle = pal.sub;
  ctx.textAlign = 'right';
  ctx.fillText(layerLabel, W - 16, H - 14);
  ctx.textAlign = 'left';
}

// ─── Wind layer ───────────────────────────────────────────────────────────────

function renderWindLayer(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, scale: number,
  L2C: (lx: number, ly: number) => Point2D,
  t: number,
  pal: Palette,
  p: {
    buildingWidth: number; buildingDepth: number;
    windDirection: number; windSpeed: number;
    windViewCx: number; windViewCy: number; windViewW: number; windViewH: number;
    isWindViewSelected: boolean;
  },
) {
  const R = Math.sqrt(p.buildingWidth * p.buildingDepth) / 2;

  // Wind view canvas rect (top-left / bottom-right)
  const [vl, vt] = L2C(p.windViewCx - p.windViewW / 2, p.windViewCy + p.windViewH / 2);
  const [vr, vb] = L2C(p.windViewCx + p.windViewW / 2, p.windViewCy - p.windViewH / 2);

  // ── Clip everything to the wind view ──────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(vl, vt, vr - vl, vb - vt);
  ctx.clip();

  const halfW = W / (2 * scale);
  const halfH = H / (2 * scale);
  const phi = p.windDirection * Math.PI / 180;
  const sinp = Math.sin(phi), cosp = Math.cos(phi);
  const fx = -sinp, fy = -cosp;

  // Wake zone
  const wakeLen = R * (2 + p.windSpeed * 0.6);
  const wakeW   = R * 1.4;
  const wakeCx = -fx * wakeLen * 0.6;
  const wakeCy = -fy * wakeLen * 0.6;
  const [wcx, wcy] = L2C(wakeCx, wakeCy);

  ctx.save();
  ctx.translate(wcx, wcy);
  ctx.rotate(Math.atan2(-fy, -fx));
  const wakeGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(wakeLen * scale, 1));
  wakeGrad.addColorStop(0, pal.windWake + '55');
  wakeGrad.addColorStop(1, pal.windWake + '00');
  ctx.scale(1, wakeW / wakeLen);
  ctx.beginPath(); ctx.arc(0, 0, wakeLen * scale, 0, Math.PI * 2);
  ctx.fillStyle = wakeGrad; ctx.fill();
  ctx.restore();

  // Streamlines
  const psiVals = [-3.5 * R, -2.5 * R, -1.5 * R, -0.6 * R, 0.6 * R, 1.5 * R, 2.5 * R, 3.5 * R];
  const ANIM_DASH = 0.22;
  const PARTICLE_SPEED = 0.018 * p.windSpeed;

  for (const psi of psiVals) {
    const pts = computeStreamline(psi, p.windDirection, R, halfW, halfH);
    if (pts.length < 4) continue;

    const arcLen: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i][0] - pts[i - 1][0]; const dy = pts[i][1] - pts[i - 1][1];
      arcLen.push(arcLen[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    const totalLen = arcLen[arcLen.length - 1];
    if (totalLen < 1) continue;

    const dashLen = totalLen * ANIM_DASH;
    const gapLen  = totalLen * (1 - ANIM_DASH) / 3;
    const phase   = (t * PARTICLE_SPEED * totalLen) % (dashLen + gapLen);

    // Faint path
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = pal.windStream; ctx.lineWidth = 1;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < pts.length; i++) {
      const [cx, cy] = L2C(pts[i][0], pts[i][1]);
      if (cx < 0 || cx > W || cy < 0 || cy > H) { started = false; continue; }
      if (!started) { ctx.moveTo(cx, cy); started = true; } else { ctx.lineTo(cx, cy); }
    }
    ctx.stroke(); ctx.restore();

    // Animated dash
    ctx.save(); ctx.globalAlpha = 0.85;
    const distRatio = Math.min(1, Math.abs(psi) / (R * 2));
    ctx.strokeStyle = distRatio < 0.5 ? pal.windFast : pal.windStream;
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    let drawing = false;
    let segStart = -phase;
    let segEnd = segStart + dashLen;

    ctx.beginPath();
    for (let i = 1; i < pts.length; i++) {
      const s0 = arcLen[i - 1], s1 = arcLen[i];
      if (s1 < segStart || s0 > segEnd) {
        if (s0 > segEnd) { segStart += dashLen + gapLen; segEnd = segStart + dashLen; drawing = false; if (segStart > totalLen) break; }
        continue;
      }
      const interpPt = (s: number) => {
        const norm = (s - arcLen[i - 1]) / (arcLen[i] - arcLen[i - 1]);
        return L2C(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * norm, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * norm);
      };
      const [cx0, cy0] = s0 >= segStart ? L2C(pts[i - 1][0], pts[i - 1][1]) : interpPt(segStart);
      const [cx1, cy1] = s1 <= segEnd   ? L2C(pts[i][0], pts[i][1]) : interpPt(segEnd);
      if (!drawing) { ctx.moveTo(cx0, cy0); drawing = true; }
      ctx.lineTo(cx1, cy1);
      if (s1 >= segEnd) { segStart += dashLen + gapLen; segEnd = segStart + dashLen; drawing = false; if (segStart > totalLen) break; }
    }
    ctx.stroke(); ctx.restore();
  }

  ctx.restore(); // end clip

  // ── Wind view border ───────────────────────────────────────────────────────
  ctx.save();
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = p.isWindViewSelected ? pal.windStream : pal.windStream + '66';
  ctx.lineWidth   = p.isWindViewSelected ? 1.5 : 1;
  ctx.strokeRect(vl, vt, vr - vl, vb - vt);
  ctx.setLineDash([]);

  // Size label (bottom-right of box, only when selected)
  if (p.isWindViewSelected) {
    ctx.font = '9px sans-serif';
    ctx.fillStyle = pal.sub;
    ctx.textAlign = 'right';
    ctx.fillText(`${p.windViewW.toFixed(0)}×${p.windViewH.toFixed(0)} m`, vr - 4, vb - 4);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // ── Resize handles (8 squares) when selected ──────────────────────────────
  if (p.isWindViewSelected) {
    const handles = getWindViewHandlePositions(vl, vt, vr, vb);
    ctx.save();
    for (const [hx, hy] of handles) {
      ctx.fillStyle = pal.windStream;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
      ctx.strokeRect(hx - 4, hy - 4, 8, 8);
    }
    ctx.restore();
  }

  drawWindCompass(ctx, W, H, p.windDirection, p.windSpeed, pal);
}

function drawWindCompass(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  windDir: number, windSpeed: number, pal: Palette,
) {
  const cx = W - 48, cy = H - 48, r = 26;
  ctx.save(); ctx.globalAlpha = 0.85;

  // Circle
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  ctx.strokeStyle = pal.windStream + '88'; ctx.lineWidth = 1; ctx.stroke();

  // Arrow tip in flow direction
  const dx = Math.sin(windDir * Math.PI / 180) * r * 0.72;
  const dy = -Math.cos(windDir * Math.PI / 180) * r * 0.72;
  const adx = -dx, ady = -dy;

  ctx.strokeStyle = pal.windFast; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - adx * 0.6, cy - ady * 0.6); ctx.lineTo(cx + adx * 0.8, cy + ady * 0.8); ctx.stroke();
  const ang = Math.atan2(ady, adx);
  ctx.beginPath();
  ctx.moveTo(cx + adx * 0.8, cy + ady * 0.8);
  ctx.lineTo(cx + adx * 0.8 - 8 * Math.cos(ang - 0.45), cy + ady * 0.8 - 8 * Math.sin(ang - 0.45));
  ctx.lineTo(cx + adx * 0.8 - 8 * Math.cos(ang + 0.45), cy + ady * 0.8 - 8 * Math.sin(ang + 0.45));
  ctx.closePath(); ctx.fillStyle = pal.windFast; ctx.fill();

  // Drag hint ring
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = pal.windFast + '30'; ctx.lineWidth = 6; ctx.stroke();

  const speedLabels = ['静穏', '微風', '軽風', '和風', '強風', '疾風'];
  ctx.font = '8px sans-serif'; ctx.fillStyle = pal.sub; ctx.textAlign = 'center';
  ctx.fillText(speedLabels[Math.min(windSpeed, 5)], cx, cy + r + 11);
  ctx.restore();
}

// ─── Noise layer ─────────────────────────────────────────────────────────────

function renderNoiseLayer(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, scale: number,
  L2C: (lx: number, ly: number) => Point2D,
  t: number,
  pal: Palette,
  p: {
    noiseSources: NoiseSource[];
    selectedNoiseId: string | null;
    isEnvAnimating: boolean;
  },
) {
  const activeNoise = p.noiseSources.filter(s => s.enabled);
  if (activeNoise.length === 0) {
    ctx.save();
    ctx.font = '13px sans-serif'; ctx.fillStyle = pal.sub; ctx.textAlign = 'center';
    ctx.fillText('騒音源を有効にしてください', W / 2, H / 2 - 10);
    ctx.restore();
  }

  // Draw all sources (enabled and disabled, dim disabled ones)
  for (const src of p.noiseSources) {
    const [cx, cy] = L2C(src.lx, src.ly);
    const maxR = scale * (8 + src.level * 7);
    const alpha = src.enabled ? 1 : 0.25;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (src.enabled) {
      // Radial gradient background
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      grad.addColorStop(0,   pal.noiseColors[0]);
      grad.addColorStop(0.25, pal.noiseColors[1]);
      grad.addColorStop(0.5,  pal.noiseColors[2]);
      grad.addColorStop(0.75, pal.noiseColors[3]);
      grad.addColorStop(1,    pal.noiseColors[4]);
      ctx.beginPath(); ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fillStyle = grad; ctx.fill();

      if (p.isEnvAnimating) {
        // Pulsing expanding rings
        const ringSpeed = 0.3 + src.level * 0.1;
        for (let i = 0; i < 3; i++) {
          const phase = ((t * ringSpeed + i / 3) % 1);
          const ringR = maxR * (0.1 + phase * 0.9);
          const ringAlpha = (1 - phase) * 0.75;
          ctx.globalAlpha = alpha * ringAlpha;
          ctx.beginPath(); ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = pal.noiseColors[0];
          ctx.lineWidth = 1.8; ctx.stroke();
        }
        ctx.globalAlpha = alpha;
      } else {
        // Static concentric rings
        ctx.strokeStyle = pal.noiseColors[1]; ctx.lineWidth = 0.8;
        for (let ring = 1; ring <= 3; ring++) {
          ctx.beginPath(); ctx.arc(cx, cy, maxR * ring / 3.5, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }

    // Source dot (all sources, indicates draggable even when disabled)
    const isSelected = src.id === p.selectedNoiseId;
    if (isSelected) {
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = src.enabled ? pal.noiseColors[0] : pal.sub;
    ctx.fill();
    ctx.strokeStyle = pal.text; ctx.lineWidth = 1; ctx.stroke();

    // Label
    ctx.font = `bold 10px sans-serif`; ctx.fillStyle = pal.text; ctx.textAlign = 'center';
    ctx.fillText(src.label, cx, cy - 10);

    if (src.enabled) {
      const dbEst = 40 + src.level * 10;
      ctx.font = '9px sans-serif'; ctx.fillStyle = pal.sub;
      ctx.fillText(`〜${dbEst}dB`, cx, cy + 17);
    }

    ctx.restore();
  }

  drawNoiseLegend(ctx, W, H, pal);
}

function drawNoiseLegend(ctx: CanvasRenderingContext2D, W: number, H: number, pal: Palette) {
  const labels = ['70dB+', '60dB', '50dB', '40dB以下'];
  const colors = pal.noiseColors.slice(0, 4);
  ctx.save();
  ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
  const x = 14, y0 = H - 60;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x - 4, y0 - 12, 80, labels.length * 15 + 8);
  for (let i = 0; i < labels.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y0 + i * 14, 10, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y0 + i * 14, 10, 10);
    ctx.fillStyle = pal.text;
    ctx.fillText(labels[i], x + 14, y0 + i * 14 + 9);
  }
  ctx.restore();
}

// ─── Thermal layer ────────────────────────────────────────────────────────────

function renderThermalLayer(
  ctx: CanvasRenderingContext2D,
  W: number, H: number, scale: number,
  L2C: (lx: number, ly: number) => Point2D,
  t: number,
  pal: Palette,
  p: {
    thermalSeason: string; month: number; latitude: number;
    northAngle: number; buildingPolygon: Point2D[];
    buildingHeight: number; buildingWidth: number; buildingDepth: number;
    isEnvAnimating: boolean;
  },
) {
  const isSummer = p.thermalSeason === 'summer';
  const baseMonth = isSummer ? 6 : 12;

  // Animated or static sun hour
  const hour = p.isEnvAnimating ? 6 + ((t * 0.8) % 12) : 12;
  const { altitude: altDeg, azimuth: azDeg } = calcSunPosition(p.latitude, baseMonth, hour);
  const altRad = altDeg * Math.PI / 180;
  const sunAzRad = azDeg * Math.PI / 180;

  const hotColor  = isSummer ? pal.thermalHot  : pal.thermalWarm;
  const coolColor = isSummer ? pal.thermalCool : pal.thermalCold;

  if (altDeg > 1) {
    // Solar exposure gradient rotates with sun azimuth
    // Sun direction in canvas coords: (sin(az), -cos(az)) — canvas y is down, N is up
    const sunCx = Math.sin(sunAzRad);
    const sunCy = -Math.cos(sunAzRad);
    const r = Math.max(W, H) * 0.7;
    // Start = opposite sun (cool), End = toward sun (hot)
    const thermalGrad = ctx.createLinearGradient(
      W / 2 - sunCx * r, H / 2 - sunCy * r,
      W / 2 + sunCx * r, H / 2 + sunCy * r,
    );
    thermalGrad.addColorStop(0, coolColor.replace(/[\d.]+\)$/, '0.08)'));
    thermalGrad.addColorStop(0.45, coolColor);
    thermalGrad.addColorStop(1,    hotColor);
    ctx.fillStyle = thermalGrad;
    ctx.fillRect(0, 0, W, H);

    // Building shadow: direction opposite sun azimuth
    const shadowDx = -Math.sin(sunAzRad); // East in logical
    const shadowDy = -Math.cos(sunAzRad); // North in logical
    const shadowLen = Math.min(p.buildingHeight / Math.tan(Math.max(altRad, 0.05)), 60);

    const poly = p.buildingPolygon;
    if (poly.length >= 3 && shadowLen > 0.5) {
      const shadowPts: Point2D[] = [
        ...poly,
        ...poly.map(([lx, ly]) => [lx + shadowDx * shadowLen, ly + shadowDy * shadowLen] as Point2D),
      ];
      const hull = convexHullSimple(shadowPts);

      ctx.save();
      ctx.beginPath();
      const [sx0, sy0] = L2C(hull[0][0], hull[0][1]);
      ctx.moveTo(sx0, sy0);
      for (let i = 1; i < hull.length; i++) {
        const [sx, sy] = L2C(hull[i][0], hull[i][1]);
        ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fillStyle = pal.thermalShadow;
      ctx.fill();
      ctx.restore();

      // Shadow length label (midpoint along shadow direction)
      const [shLx, shLy] = L2C(shadowDx * shadowLen * 0.5, shadowDy * shadowLen * 0.5);
      ctx.save();
      ctx.font = '9px sans-serif'; ctx.fillStyle = pal.sub; ctx.textAlign = 'center';
      ctx.fillText(`影 ${shadowLen.toFixed(1)}m`, shLx, shLy);
      ctx.restore();
    }

    // Animated sun indicator: small sun symbol at canvas edge in sun direction
    if (p.isEnvAnimating) {
      const margin = 28;
      const edgeDist = Math.min(
        Math.abs(W / 2 / Math.max(Math.abs(sunCx), 0.01)),
        Math.abs(H / 2 / Math.max(Math.abs(sunCy), 0.01)),
      );
      const indDist = Math.min(edgeDist - margin, Math.min(W, H) * 0.46);
      const indX = W / 2 + sunCx * indDist;
      const indY = H / 2 + sunCy * indDist;
      const sunR = 9;

      ctx.save();
      ctx.globalAlpha = 0.75;
      // Glow
      const glow = ctx.createRadialGradient(indX, indY, 0, indX, indY, sunR * 2.5);
      glow.addColorStop(0, hotColor.replace(/[\d.]+\)$/, '0.6)'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(indX, indY, sunR * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = glow; ctx.fill();
      // Core
      ctx.beginPath(); ctx.arc(indX, indY, sunR, 0, Math.PI * 2);
      ctx.fillStyle = '#ffcc02'; ctx.fill();
      ctx.strokeStyle = '#ff8800'; ctx.lineWidth = 1.5; ctx.stroke();
      // Rays
      ctx.strokeStyle = '#ffcc02'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const ra = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(indX + Math.cos(ra) * (sunR + 3), indY + Math.sin(ra) * (sunR + 3));
        ctx.lineTo(indX + Math.cos(ra) * (sunR + 7), indY + Math.sin(ra) * (sunR + 7));
        ctx.stroke();
      }
      ctx.restore();
    }
  } else {
    // Sun below horizon (night / polar winter)
    ctx.fillStyle = pal.thermalCold;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.font = '11px sans-serif'; ctx.fillStyle = pal.sub; ctx.textAlign = 'center';
    ctx.fillText('日没 / 日の出前', W / 2, H / 2 + 30);
    ctx.restore();
  }

  // Info labels
  ctx.save();
  ctx.font = '10px sans-serif'; ctx.fillStyle = pal.sub; ctx.textAlign = 'right';
  ctx.fillText(isSummer ? '夏至 (6月)' : '冬至 (12月)', W - 16, H - 42);
  if (altDeg > 1) {
    ctx.fillText(`高度 ${altDeg.toFixed(0)}°  方位 ${azDeg.toFixed(0)}°`, W - 16, H - 28);
  }
  if (p.isEnvAnimating) {
    const hh = Math.floor(hour);
    const mm = String(Math.round((hour - hh) * 60)).padStart(2, '0');
    ctx.fillText(`${hh}:${mm}`, W - 16, H - 14);
  } else {
    ctx.fillText(`正午 高度角 ${Math.max(0, altDeg).toFixed(0)}°`, W - 16, H - 14);
  }
  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export const EnvDiagramCanvas = forwardRef<EnvDiagramCanvasHandle, Props>(
  ({ width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef   = useRef<number>(0);
    const tRef      = useRef<number>(0);
    const dragRef   = useRef<DragState | null>(null);

    const store = useDsdStore();
    const setWindDirection         = useDsdStore(s => s.setWindDirection);
    const setNoiseSourcePosition   = useDsdStore(s => s.setNoiseSourcePosition);
    const selectedNoiseSourceId    = useDsdStore(s => s.selectedNoiseSourceId);
    const setSelectedNoiseSourceId = useDsdStore(s => s.setSelectedNoiseSourceId);
    const setWindView              = useDsdStore(s => s.setWindView);
    const setIsWindViewSelected    = useDsdStore(s => s.setIsWindViewSelected);

    const getParams = useCallback((): RenderParams => ({
      style: store.style,
      buildingPolygon: store.presetShape === 'custom' && store.customPolygon.length >= 3
        ? store.customPolygon as Point2D[]
        : getPresetPoints(store.presetShape, store.buildingWidth, store.buildingDepth, store.northAngle),
      buildingWidth: store.buildingWidth,
      buildingDepth: store.buildingDepth,
      buildingHeight: store.buildingHeight,
      windDirection: store.windDirection,
      windSpeed: store.windSpeed,
      isEnvAnimating: store.isEnvAnimating,
      envLayer: store.envLayer,
      noiseSources: store.noiseSources,
      selectedNoiseId: selectedNoiseSourceId,
      thermalSeason: store.thermalSeason,
      month: store.month,
      latitude: store.latitude,
      northAngle: store.northAngle,
      diagramTitle: store.diagramTitle,
      annotations: store.annotations as any[],
      windViewCx: store.windViewCx,
      windViewCy: store.windViewCy,
      windViewW: store.windViewW,
      windViewH: store.windViewH,
      isWindViewSelected: store.isWindViewSelected,
    }), [
      store.style, store.presetShape, store.customPolygon,
      store.buildingWidth, store.buildingDepth, store.buildingHeight,
      store.northAngle, store.windDirection, store.windSpeed,
      store.isEnvAnimating, store.envLayer, store.noiseSources,
      store.thermalSeason, store.month, store.latitude,
      store.diagramTitle, store.annotations, selectedNoiseSourceId,
      store.windViewCx, store.windViewCy, store.windViewW, store.windViewH,
      store.isWindViewSelected,
    ]);

    const draw = useCallback((t: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderToCanvas(canvas, t, getParams());
    }, [getParams]);

    useEffect(() => {
      cancelAnimationFrame(animRef.current);
      if (store.isEnvAnimating) {
        const loop = () => {
          tRef.current += 0.016;
          draw(tRef.current);
          animRef.current = requestAnimationFrame(loop);
        };
        animRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef.current);
      } else {
        draw(0);
      }
    }, [draw, store.isEnvAnimating]);

    // ── Canvas scale helper ──
    const computeCanvasScale = useCallback((W: number, H: number) => {
      const bW = store.buildingWidth, bD = store.buildingDepth;
      const PAD = Math.max(bW, bD) * 2.5 + 12;
      return Math.min((W / 2) / (bW / 2 + PAD), (H / 2) / (bD / 2 + PAD)) * 0.92;
    }, [store.buildingWidth, store.buildingDepth]);

    // ── Coordinate helpers ──
    const toCanvasCoords = useCallback((e: React.MouseEvent): [number, number] => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return [
        (e.clientX - rect.left) * (canvas.width  / rect.width),
        (e.clientY - rect.top)  * (canvas.height / rect.height),
      ];
    }, []);

    // ── Wind view canvas rect helper (returns [vl, vt, vr, vb]) ──
    const getWindViewCanvasRect = useCallback((W: number, H: number, scale: number): [number, number, number, number] => {
      const { windViewCx: cx, windViewCy: cy, windViewW: ww, windViewH: wh } = store;
      const [vl, vt] = logicalToCanvas(cx - ww / 2, cy + wh / 2, W / 2, H / 2, scale);
      const [vr, vb] = logicalToCanvas(cx + ww / 2, cy - wh / 2, W / 2, H / 2, scale);
      return [vl, vt, vr, vb];
    }, [store.windViewCx, store.windViewCy, store.windViewW, store.windViewH]);

    // ── Drag: mousedown ──
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      const [mx, my] = toCanvasCoords(e);
      const canvas = canvasRef.current!;
      const W = canvas.width, H = canvas.height;
      const scale = computeCanvasScale(W, H);

      // 1. Compass widget (always first)
      const ccx = W - 48, ccy = H - 48;
      if (Math.hypot(mx - ccx, my - ccy) < 32) {
        dragRef.current = { type: 'compass' };
        canvas.style.cursor = 'grabbing';
        return;
      }

      // 2. Wind view handles & body (wind layer only)
      if (store.envLayer === 'wind') {
        const [vl, vt, vr, vb] = getWindViewCanvasRect(W, H, scale);
        const handles = getWindViewHandlePositions(vl, vt, vr, vb);

        // Check handles first (higher priority than body)
        for (let i = 0; i < handles.length; i++) {
          const [hx, hy] = handles[i];
          if (Math.abs(mx - hx) <= 7 && Math.abs(my - hy) <= 7) {
            const origL = store.windViewCx - store.windViewW / 2;
            const origR = store.windViewCx + store.windViewW / 2;
            const origT = store.windViewCy + store.windViewH / 2;
            const origB = store.windViewCy - store.windViewH / 2;
            dragRef.current = { type: 'windViewHandle', handleIdx: i, origL, origR, origT, origB };
            setIsWindViewSelected(true);
            canvas.style.cursor = HANDLE_CURSORS[i];
            return;
          }
        }

        // Check body
        if (mx >= vl && mx <= vr && my >= vt && my <= vb) {
          const clickLx = (mx - W / 2) / scale;
          const clickLy = -(my - H / 2) / scale;
          dragRef.current = {
            type: 'windViewBody',
            offsetLx: store.windViewCx - clickLx,
            offsetLy: store.windViewCy - clickLy,
          };
          setIsWindViewSelected(true);
          canvas.style.cursor = 'move';
          return;
        }

        // Click outside → deselect wind view
        setIsWindViewSelected(false);
      }

      // 3. Noise source dots
      for (const src of store.noiseSources) {
        const [scx, scy] = logicalToCanvas(src.lx, src.ly, W / 2, H / 2, scale);
        if (Math.hypot(mx - scx, my - scy) < 18) {
          dragRef.current = { type: 'noise', noiseId: src.id };
          setSelectedNoiseSourceId(src.id);
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
      setSelectedNoiseSourceId(null);
    }, [toCanvasCoords, computeCanvasScale, getWindViewCanvasRect,
        store.envLayer, store.noiseSources,
        store.windViewCx, store.windViewCy, store.windViewW, store.windViewH,
        setIsWindViewSelected, setSelectedNoiseSourceId]);

    // ── Drag: mousemove ──
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      const [mx, my] = toCanvasCoords(e);
      const canvas = canvasRef.current!;
      const W = canvas.width, H = canvas.height;
      const scale = computeCanvasScale(W, H);
      const drag = dragRef.current;

      if (drag) {
        if (drag.type === 'compass') {
          canvas.style.cursor = 'grabbing';
          const ccx = W - 48, ccy = H - 48;
          const angle = Math.atan2(my - ccy, mx - ccx) * 180 / Math.PI;
          setWindDirection(Math.round(((angle - 90) + 360) % 360));

        } else if (drag.type === 'noise') {
          canvas.style.cursor = 'grabbing';
          setNoiseSourcePosition(drag.noiseId, (mx - W / 2) / scale, -(my - H / 2) / scale);

        } else if (drag.type === 'windViewBody') {
          canvas.style.cursor = 'move';
          const lx = (mx - W / 2) / scale;
          const ly = -(my - H / 2) / scale;
          setWindView(lx + drag.offsetLx, ly + drag.offsetLy, store.windViewW, store.windViewH);

        } else if (drag.type === 'windViewHandle') {
          canvas.style.cursor = HANDLE_CURSORS[drag.handleIdx];
          const newLx = (mx - W / 2) / scale;
          const newLy = -(my - H / 2) / scale;
          const MIN = 15; // minimum side length in meters
          let L = drag.origL, R = drag.origR, T = drag.origT, B = drag.origB;
          for (const edge of HANDLE_FREE[drag.handleIdx]) {
            if (edge === 'L') L = Math.min(newLx, R - MIN);
            if (edge === 'R') R = Math.max(newLx, L + MIN);
            if (edge === 'T') T = Math.max(newLy, B + MIN);
            if (edge === 'B') B = Math.min(newLy, T - MIN);
          }
          setWindView((L + R) / 2, (B + T) / 2, R - L, T - B);
        }
        return;
      }

      // ── Hover cursor (no drag) ───────────────────────────────────────────
      const ccx = W - 48, ccy = H - 48;
      if (Math.hypot(mx - ccx, my - ccy) < 32) {
        canvas.style.cursor = 'grab'; return;
      }

      if (store.envLayer === 'wind') {
        const [vl, vt, vr, vb] = getWindViewCanvasRect(W, H, scale);
        const handles = getWindViewHandlePositions(vl, vt, vr, vb);
        for (let i = 0; i < handles.length; i++) {
          const [hx, hy] = handles[i];
          if (Math.abs(mx - hx) <= 7 && Math.abs(my - hy) <= 7) {
            canvas.style.cursor = HANDLE_CURSORS[i]; return;
          }
        }
        if (mx >= vl && mx <= vr && my >= vt && my <= vb) {
          canvas.style.cursor = 'move'; return;
        }
      }

      for (const src of store.noiseSources) {
        const [scx, scy] = logicalToCanvas(src.lx, src.ly, W / 2, H / 2, scale);
        if (Math.hypot(mx - scx, my - scy) < 18) {
          canvas.style.cursor = 'grab'; return;
        }
      }
      canvas.style.cursor = 'default';
    }, [toCanvasCoords, computeCanvasScale, getWindViewCanvasRect,
        setWindDirection, setNoiseSourcePosition, setWindView,
        store.envLayer, store.noiseSources, store.windViewW, store.windViewH]);

    // ── Drag: end ──
    const handleMouseUp = useCallback(() => {
      dragRef.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }, []);

    const handleMouseLeave = useCallback(() => {
      dragRef.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = 'default';
    }, []);

    useImperativeHandle(ref, () => ({
      exportPng(w, h) {
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        renderToCanvas(off, tRef.current, getParams());
        return off.toDataURL('image/png');
      },
      renderFrame(w, h, t) {
        const off = document.createElement('canvas');
        off.width = w; off.height = h;
        renderToCanvas(off, t, getParams());
        return off.getContext('2d')!.getImageData(0, 0, w, h);
      },
    }), [getParams]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain', cursor: 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
    );
  },
);

EnvDiagramCanvas.displayName = 'EnvDiagramCanvas';
