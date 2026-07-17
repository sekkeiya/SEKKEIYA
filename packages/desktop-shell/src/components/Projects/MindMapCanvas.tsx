import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap, Panel, ViewportPortal,
  useNodesState, useReactFlow,
  Handle, Position, BaseEdge, EdgeLabelRenderer, MarkerType, SelectionMode, getBezierPath,
  type Node, type NodeProps, type Edge, type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box, Typography, Button, IconButton, Slider, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import ArrowRightAltRoundedIcon from '@mui/icons-material/ArrowRightAltRounded';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import {
  ResearchCanvasRepository,
  type MindMapNode,
  type MindMapStyle,
  type MindMapSummary,
  type MindMapRelation,
  type MindLayoutKey,
} from '../../features/projects/repositories/ResearchCanvasRepository';
import { openExternal, openBoardSource } from '../../features/projects/research/openSource';
import { KnowledgeSidebar, KNOWLEDGE_DND_TYPE, type KnowledgePick } from './KnowledgeSidebar';
import { DriveAssetSidebar, DRIVE_IMAGE_DND_TYPE } from './DriveAssetSidebar';
import { ArticlePreview } from '../AI/ArticlePreview';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';
import { registerMindMapHost } from '../../features/projects/chat/mindmapBridge';
import { RESEARCH_BOARD_CHANGED_EVENT } from '../../features/projects/chat/researchBoardBridge';
import { ACCOUNT_BOARD_ID, parseBoardKey } from '../../features/projects/repositories/ResearchCanvasRepository';
import { isTauri } from '../../lib/platform';
import {
  MIND_THEMES, DEFAULT_THEME_KEY, resolveTheme, type MindTheme,
  MIND_BACKGROUNDS, DEFAULT_BACKGROUND_KEY, resolveBackground,
  MIND_LAYOUTS, MIND_LAYOUT_SPEC, resolveLayoutSpec,
  MIND_ICON_GROUPS, MIND_ICON_SIZE, MIND_ICON_GAP, findMindIcon,
} from '../../features/projects/mindmap/presets';

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const DEFAULT_STYLE: Required<MindMapStyle> = {
  shape: 'rounded', radius: 10,
  lineStyle: 'curve', lineWidth: 2,
  layout: 'right', hGap: 56, vGap: 14,
  theme: DEFAULT_THEME_KEY, background: DEFAULT_BACKGROUND_KEY,
};

/**
 * 自動で折り返し始める幅(px)。改行は書き手が Shift+Enter / Ctrl+Enter で入れるものなので、
 * ここまでは1行のまま伸ばす。これを超えるとさすがに横長すぎるので折り返す。
 */
/**
 * タブを開いたときの自動キックオフを1アプリセッション=1スコープ1回に抑えるガード。
 * （タブの出入りで毎回AIが挨拶し直すのを防ぐ。アプリ再起動でリセットされる）
 */
const mindmapAutoKickedScopes = new Set<string>();

const MAX_TEXT_W = 420;
/** ノードの枠線の太さ（左右で 2 倍が内容幅から引かれるので、幅の実測に効く）。 */
const NODE_BORDER_W = 1.5;
/** キャンバス2Dの実測と DOM の描画のわずかな差を吸収する遊び(px)。 */
const MEASURE_SLACK = 4;
const SAVE_DEBOUNCE_MS = 1500;

/** トピックに貼った画像の表示幅。高さは元サイズの比率から出す。 */
const NODE_IMAGE_W = 176;
/** 画像とテキスト行の間。 */
const NODE_IMAGE_GAP = 6;
/** 元サイズが分からない画像の高さ比（4:3 相当）。 */
const NODE_IMAGE_FALLBACK_RATIO = 3 / 4;
/** リンク・メモ・出典のバッジ1個分の寸法。 */
const NODE_BADGE_SIZE = 15;

/** ドラッグ中、トピックの外でもこの距離(px)以内なら「隙間への挿入」とみなす。 */
const SIBLING_SNAP_DIST = 140;

/**
 * ドラッグ中の移動先。child=重ねたトピックの子（末尾）に付け替え /
 * sibling=refId の前後（同じ親の兄弟）に挿入。並び替え・階層の上げ下げは sibling で表せる。
 */
type DropPlan =
  | { type: 'child'; parentId: string }
  | { type: 'sibling'; refId: string; before: boolean };

function dropPlanEq(a: DropPlan | null, b: DropPlan | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'child' && b.type === 'child') return a.parentId === b.parentId;
  if (a.type === 'sibling' && b.type === 'sibling') return a.refId === b.refId && a.before === b.before;
  return false;
}

/** 関係線の色（枝の色と混ざらないよう、テーマから独立させる）。 */
const RELATION_COLOR = '#a18cd1';

/** まとめ（サマリー）の寸法: 波括弧の奥行き / 括弧とラベルの間 / 部分木との間。 */
const BRACE_D = 11;
const BRACE_GAP = 6;
const BRACE_OUT_GAP = 12;

function newId(prefix: 'm' | 's' | 'r'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ─── テキスト計測（レイアウト前にノード寸法を確定させる） ─────────────────────

const measureCtx = typeof document !== 'undefined'
  ? document.createElement('canvas').getContext('2d')
  : null;

function nodeFont(depth: number): string {
  const base = 'Inter, "Noto Sans JP", sans-serif';
  if (depth === 0) return `700 15px ${base}`;
  if (depth === 1) return `700 13px ${base}`;
  return `500 12.5px ${base}`;
}
function nodePad(depth: number): { px: number; py: number } {
  if (depth === 0) return { px: 18, py: 10 };
  if (depth === 1) return { px: 13, py: 7 };
  return { px: 10, py: 5 };
}
function nodeLineH(depth: number): number {
  return depth === 0 ? 22 : depth === 1 ? 19 : 18;
}

/** テキストを MAX_TEXT_W で折り返し、実測幅と行を返す（キャンバス2Dで計測）。 */
function wrapText(text: string, depth: number): { lines: string[]; width: number } {
  const t = text || ' ';
  if (!measureCtx) {
    const lines = t.split('\n');
    const width = Math.min(MAX_TEXT_W, Math.max(...lines.map(l => l.length)) * 13);
    return { lines, width };
  }
  measureCtx.font = nodeFont(depth);
  const lines: string[] = [];
  for (const hard of t.split('\n')) {
    let cur = '';
    let curW = 0;
    for (const ch of hard) {
      const w = measureCtx.measureText(ch).width;
      if (curW + w > MAX_TEXT_W && cur) { lines.push(cur); cur = ch; curW = w; }
      else { cur += ch; curW += w; }
    }
    lines.push(cur);
  }
  const width = Math.min(MAX_TEXT_W, Math.max(...lines.map(l => measureCtx!.measureText(l).width)));
  return { lines, width };
}

/**
 * テキストの見た目を決める CSS。letterSpacing を明示的に 0 にしているのが要点で、
 * MUI の Typography は既定で字間を持つため、そのままだとキャンバス2Dの実測
 * （字間なし）より DOM の描画が広くなり、幅が足りず勝手に折り返す。
 */
function textSx(depth: number, color: string) {
  return {
    font: nodeFont(depth), lineHeight: `${nodeLineH(depth)}px`, letterSpacing: 0,
    color,
  } as const;
}

/**
 * キャレット位置に改行を差し込む（Ctrl/Cmd+Enter 用）。
 * ブラウザは textarea の Ctrl+Enter で改行を入れてくれないため、自前で入れて
 * キャレットを改行の直後へ戻す。
 */
function insertNewlineAtCaret(ta: HTMLTextAreaElement, text: string, apply: (next: string) => void) {
  const start = ta.selectionStart ?? text.length;
  const end = ta.selectionEnd ?? start;
  apply(`${text.slice(0, start)}\n${text.slice(end)}`);
  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 1; });
}

/** アイコン列がノード幅に足す分（アイコン＋間隔＋テキストとの間隔）。 */
function iconsWidth(icons?: string[]): number {
  if (!icons?.length) return 0;
  return icons.length * MIND_ICON_SIZE + icons.length * MIND_ICON_GAP;
}

/** ノードの寸法を測るのに必要な中身だけ（まとめラベルからも渡せるようにした最小の形）。 */
type MeasureInput = Pick<MindMapNode, 'text' | 'icons' | 'image' | 'imageW' | 'imageH' | 'link' | 'note' | 'refType'>;

/** テキスト行の末尾に並ぶバッジ（リンク・メモ・出典）の数。 */
function badgeCount(n: MeasureInput): number {
  return (n.link ? 1 : 0) + (n.note ? 1 : 0) + (n.refType ? 1 : 0);
}

/** トピックに貼った画像の表示サイズ。幅は固定、高さは元サイズの比率から。 */
function imageDisplaySize(n: MeasureInput): { w: number; h: number } | null {
  if (!n.image) return null;
  const ratio = n.imageW && n.imageH ? n.imageH / n.imageW : NODE_IMAGE_FALLBACK_RATIO;
  return { w: NODE_IMAGE_W, h: Math.round(NODE_IMAGE_W * ratio) };
}

/**
 * ノードの寸法。box-sizing:border-box なので、内容に使える幅は
 * 「全体幅 − 左右パディング − 左右の枠線」。ここを引き忘れると、実測どおりの文字が
 * ちょうど入りきらず DOM 側で勝手に折り返してしまうので、枠線と遊びまで含めて足す。
 * 画像を貼ったトピックは、画像の下にテキスト行が来る積み重ねで測る（GitMind と同じ形）。
 */
function measureNode(n: MeasureInput, depth: number): { w: number; h: number } {
  const { lines, width } = wrapText(n.text, depth);
  const { px, py } = nodePad(depth);
  const minW = depth === 0 ? 96 : 44;
  const badges = badgeCount(n) * (NODE_BADGE_SIZE + MIND_ICON_GAP);
  const img = imageDisplaySize(n);

  const textRowW = Math.ceil(width) + iconsWidth(n.icons) + badges;
  const textRowH = Math.max(lines.length * nodeLineH(depth), n.icons?.length ? MIND_ICON_SIZE : 0);
  const contentW = Math.max(textRowW, img?.w ?? 0);
  return {
    w: Math.max(minW, contentW + px * 2 + NODE_BORDER_W * 2 + MEASURE_SLACK),
    h: (img ? img.h + NODE_IMAGE_GAP : 0) + textRowH + py * 2,
  };
}

// ─── ツリーレイアウト（tidy tree・主軸/交差軸で汎用化） ───────────────────────

interface MindRect {
  x: number; y: number; w: number; h: number;
  depth: number;
  side: 1 | -1;          // 主軸の向き（h: 1=右/-1=左, v: 1=下/-1=上）
  axis: 'h' | 'v';
  color: string;         // 枝色（描画・ミニマップ用に解決済み）
  hasChildren: boolean;  // collapsed に関係なく子を持つか
  childCount: number;    // 直下の子数（折りたたみバッジ表示用）
}

interface MindLayout {
  rects: Map<string, MindRect>;
  links: Array<{ parent: string; child: string; color: string; side: 1 | -1 }>;
  root: MindMapNode | null;
  axis: 'h' | 'v';
}

/**
 * マインドマップの座標計算（純関数）。
 * 「主軸(main)＝深さ方向 / 交差軸(cross)＝兄弟が並ぶ方向」の抽象座標で tidy tree を組み、
 * 最後に axis で x/y へ割り当てる。これで横向き（マインドマップ・ロジック図）と
 * 縦向き（組織図）を同じ1本のコードで扱う。
 * columnAligned のレイアウトは、同じ深さのノードの主軸開始位置を揃える（ロジック図の見た目）。
 */
function computeMindLayout(mmNodes: MindMapNode[], style: Required<MindMapStyle>, theme: MindTheme): MindLayout {
  const spec = resolveLayoutSpec(style.layout);
  const rects = new Map<string, MindRect>();
  const links: MindLayout['links'] = [];
  if (mmNodes.length === 0) return { rects, links, root: null, axis: spec.axis };

  const horiz = spec.axis === 'h';
  const mainGap = horiz ? style.hGap : style.vGap;
  const crossGap = horiz ? style.vGap : style.hGap;

  const byId = new Map(mmNodes.map(n => [n.id, n]));
  const root = mmNodes.find(n => n.parentId == null) ?? mmNodes[0];

  // 親→子（rank順）。親が見つからない孤児はルート直下として救済する
  const children = new Map<string, MindMapNode[]>();
  mmNodes.forEach(n => children.set(n.id, []));
  mmNodes.forEach(n => {
    if (n.id === root.id) return;
    const pid = n.parentId != null && byId.has(n.parentId) ? n.parentId : root.id;
    children.get(pid)!.push(n);
  });
  children.forEach(list => list.sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt)));

  // 深さ（BFS）
  const depth = new Map<string, number>([[root.id, 0]]);
  const queue = [root.id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const c of children.get(cur) ?? []) {
      depth.set(c.id, (depth.get(cur) ?? 0) + 1);
      queue.push(c.id);
    }
  }

  // 枝色: 第1階層は自前の color ?? テーマのパレット、それ以深は自前の color ?? 親を継承
  const color = new Map<string, string>([[root.id, theme.root]]);
  (children.get(root.id) ?? []).forEach((c, i) => {
    color.set(c.id, c.color ?? theme.palette[i % theme.palette.length]);
  });
  const resolveColor = (id: string): string => {
    if (color.has(id)) return color.get(id)!;
    const n = byId.get(id)!;
    const c = n.color ?? resolveColor(n.parentId != null && byId.has(n.parentId) ? n.parentId : root.id);
    color.set(id, c);
    return c;
  };
  mmNodes.forEach(n => resolveColor(n.id));

  const size = new Map(mmNodes.map(n => [n.id, measureNode(n, depth.get(n.id) ?? 2)]));
  const visibleKids = (id: string): MindMapNode[] => (byId.get(id)?.collapsed ? [] : (children.get(id) ?? []));
  const mainOf = (id: string) => (horiz ? size.get(id)!.w : size.get(id)!.h);
  const crossOf = (id: string) => (horiz ? size.get(id)!.h : size.get(id)!.w);

  // 部分木が交差軸方向に占める幅
  const subCross = new Map<string, number>();
  const calcCross = (id: string): number => {
    if (subCross.has(id)) return subCross.get(id)!;
    const kids = visibleKids(id);
    const v = kids.length === 0
      ? crossOf(id)
      : Math.max(crossOf(id), kids.reduce((s, k) => s + calcCross(k.id), 0) + crossGap * (kids.length - 1));
    subCross.set(id, v);
    return v;
  };

  // ロジック図・組織図: 深さごとの主軸オフセット（ルートの内側の辺を 0 の基準にする）
  const colMain: number[] = [];
  if (spec.columnAligned) {
    const maxMain = new Map<number, number>();
    const walk = (id: string) => {
      const d = depth.get(id) ?? 0;
      maxMain.set(d, Math.max(maxMain.get(d) ?? 0, mainOf(id)));
      visibleKids(id).forEach(k => walk(k.id));
    };
    walk(root.id);
    const maxD = Math.max(...maxMain.keys());
    colMain[0] = -mainOf(root.id) / 2;
    for (let d = 0; d <= maxD; d++) colMain[d + 1] = colMain[d] + (maxMain.get(d) ?? 0) + mainGap;
  }

  const put = (n: MindMapNode, mainStart: number, crossStart: number, side: 1 | -1) => {
    const { w, h } = size.get(n.id)!;
    rects.set(n.id, {
      x: horiz ? mainStart : crossStart,
      y: horiz ? crossStart : mainStart,
      w, h,
      depth: depth.get(n.id) ?? 0, side, axis: spec.axis, color: color.get(n.id)!,
      hasChildren: (children.get(n.id)?.length ?? 0) > 0,
      childCount: children.get(n.id)?.length ?? 0,
    });
  };

  /** mainInner = 枝の付け根側（side方向に見て手前）の主軸座標。 */
  const place = (n: MindMapNode, mainInner: number, crossTop: number, side: 1 | -1) => {
    const ms = mainOf(n.id);
    const C = calcCross(n.id);
    const mainStart = side === 1 ? mainInner : mainInner - ms;
    put(n, mainStart, crossTop + (C - crossOf(n.id)) / 2, side);

    const kids = visibleKids(n.id);
    if (!kids.length) return;
    const kidsC = kids.reduce((s, k) => s + calcCross(k.id), 0) + crossGap * (kids.length - 1);
    let cc = crossTop + (C - kidsC) / 2;
    const d = depth.get(n.id) ?? 0;
    const childInner = spec.columnAligned
      ? side * colMain[d + 1]
      : (side === 1 ? mainStart + ms + mainGap : mainStart - mainGap);
    for (const k of kids) {
      links.push({ parent: n.id, child: k.id, color: color.get(k.id)!, side });
      place(k, childInner, cc, side);
      cc += calcCross(k.id) + crossGap;
    }
  };

  // ルートは原点中心。直下の枝を主軸の正/負どちら側に出すか決める。
  const rMain = mainOf(root.id);
  put(root, -rMain / 2, -crossOf(root.id) / 2, spec.split ? 1 : spec.dir);
  const topKids = visibleKids(root.id);
  const posKids: MindMapNode[] = [];
  const negKids: MindMapNode[] = [];
  if (spec.split) {
    // 左右バランス: rank 順に、累計の部分木幅が小さい側へ（貪欲）
    let hp = 0, hn = 0;
    for (const k of topKids) {
      if (hp <= hn) { posKids.push(k); hp += calcCross(k.id); }
      else { negKids.push(k); hn += calcCross(k.id); }
    }
  } else if (spec.dir === 1) posKids.push(...topKids);
  else negKids.push(...topKids);

  const placeSide = (kids: MindMapNode[], side: 1 | -1) => {
    if (!kids.length) return;
    const total = kids.reduce((s, k) => s + calcCross(k.id), 0) + crossGap * (kids.length - 1);
    let cc = -total / 2;
    const inner = spec.columnAligned
      ? side * colMain[1]
      : (side === 1 ? rMain / 2 + mainGap : -rMain / 2 - mainGap);
    for (const k of kids) {
      links.push({ parent: root.id, child: k.id, color: color.get(k.id)!, side });
      place(k, inner, cc, side);
      cc += calcCross(k.id) + crossGap;
    }
  };
  placeSide(posKids, 1);
  placeSide(negKids, -1);

  return { rects, links, root, axis: spec.axis };
}

// ─── まとめ（サマリー）の幾何 ─────────────────────────────────────────────────

interface SummaryGeom {
  id: string;
  text: string;
  color: string;
  axis: 'h' | 'v';
  side: 1 | -1;
  x: number; y: number;
  regionW: number; regionH: number;
  braceLen: number;
  labelW: number; labelH: number;
}

/**
 * 波括弧のパス。抽象座標（main: 0→d が付け根→先端 / cross: 0→len）で描き、
 * 描画側が SVG の matrix で向きを合わせる。
 */
function bracePath(len: number, d = BRACE_D): string {
  const r = Math.max(2, Math.min(6, len / 4));
  const m = len / 2;
  const s = d * 0.55;
  return [
    'M 0,0', `Q ${s},0 ${s},${r}`,
    `L ${s},${m - r}`, `Q ${s},${m} ${d},${m}`,
    `Q ${s},${m} ${s},${m + r}`,
    `L ${s},${len - r}`, `Q ${s},${len} 0,${len}`,
  ].join(' ');
}

/**
 * まとめの表示位置。対象トピックの「部分木まで含めた外周」の外側に括弧を立てるので、
 * 子孫の上に括弧やラベルが重ならない。折りたたまれた枝の配下は rects に無いので自然に除かれる。
 */
function computeSummaryGeoms(
  summaries: MindMapSummary[],
  rects: Map<string, MindRect>,
  childrenOf: Map<string, string[]>,
): SummaryGeom[] {
  const out: SummaryGeom[] = [];
  for (const s of summaries) {
    const members = s.nodeIds.filter(id => rects.has(id));
    if (!members.length) continue;
    const first = rects.get(members[0])!;
    const { axis, side } = first;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const seen = new Set<string>();
    const stack = [...members];
    while (stack.length) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const r = rects.get(id);
      if (!r) continue;
      minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w);
      minY = Math.min(minY, r.y); maxY = Math.max(maxY, r.y + r.h);
      for (const c of childrenOf.get(id) ?? []) stack.push(c);
    }

    const label = measureNode({ text: s.text || 'まとめ' }, 2);
    const base = { id: s.id, text: s.text, color: first.color, axis, side, labelW: label.w, labelH: label.h };

    if (axis === 'h') {
      const span = maxY - minY;
      const regionH = Math.max(span, label.h);
      const regionW = BRACE_D + BRACE_GAP + label.w;
      out.push({
        ...base,
        x: side === 1 ? maxX + BRACE_OUT_GAP : minX - BRACE_OUT_GAP - regionW,
        y: minY - (regionH - span) / 2,
        regionW, regionH, braceLen: regionH,
      });
    } else {
      const span = maxX - minX;
      const regionW = Math.max(span, label.w);
      const regionH = BRACE_D + BRACE_GAP + label.h;
      out.push({
        ...base,
        x: minX - (regionW - span) / 2,
        y: side === 1 ? maxY + BRACE_OUT_GAP : minY - BRACE_OUT_GAP - regionH,
        regionW, regionH, braceLen: regionW,
      });
    }
  }
  return out;
}

// ─── コンテキスト（ノード/エッジ内から編集操作を呼ぶ） ───────────────────────

interface MindCtxValue {
  selectedIds: string[];
  editingId: string | null;
  dropTargetId: string | null;
  /** 関係線モードの始点。null なら通常モード。 */
  linkingFrom: string | null;
  style: Required<MindMapStyle>;
  theme: MindTheme;
  beginEdit: (id: string) => void;
  endEdit: (cancel?: boolean) => void;
  patchText: (id: string, text: string) => void;
  toggleCollapse: (id: string) => void;
  addChild: (id: string) => void;
  clickNode: (id: string, additive: boolean) => void;
  /** メモバッジのクリック（メモの編集ダイアログを開く）。 */
  openNote: (id: string) => void;
  /** サムネのダブルクリック（画像・記事のプレビューを開く）。 */
  openPreview: (id: string) => void;
  // まとめ
  editingSummaryId: string | null;
  beginEditSummary: (id: string) => void;
  endEditSummary: (cancel?: boolean) => void;
  patchSummaryText: (id: string, text: string) => void;
  deleteSummary: (id: string) => void;
  // 関係線
  selectedRelationId: string | null;
  editingRelationId: string | null;
  selectRelation: (id: string) => void;
  beginEditRelation: (id: string) => void;
  endEditRelation: (cancel?: boolean) => void;
  patchRelationText: (id: string, text: string) => void;
  deleteRelation: (id: string) => void;
}

const MindCtx = createContext<MindCtxValue | null>(null);
const useMindCtx = () => useContext(MindCtx)!;

// ─── アイコン描画 ─────────────────────────────────────────────────────────────

const MindIconView: React.FC<{ iconKey: string; size?: number }> = ({ iconKey, size = MIND_ICON_SIZE }) => {
  const ic = findMindIcon(iconKey);
  if (!ic) return null;
  if (ic.badge) {
    return (
      <Box sx={{
        width: size, height: size, flexShrink: 0,
        borderRadius: ic.badge.round ? '50%' : '4px',
        bgcolor: ic.badge.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.5, fontWeight: 800, lineHeight: 1, letterSpacing: 0,
        userSelect: 'none',
      }}>
        {ic.badge.text}
      </Box>
    );
  }
  return (
    <Box sx={{ width: size, height: size, flexShrink: 0, fontSize: size * 0.86, lineHeight: `${size}px`, textAlign: 'center', userSelect: 'none' }}>
      {ic.emoji}
    </Box>
  );
};

// ─── ノード ───────────────────────────────────────────────────────────────────

interface MindNodeData {
  text: string;
  depth: number;
  side: 1 | -1;
  axis: 'h' | 'v';
  color: string;
  w: number;
  h: number;
  hasChildren: boolean;
  childCount: number;
  collapsed: boolean;
  icons?: string[];
  image?: string;
  imageW?: number;
  imageH?: number;
  link?: string;
  note?: string;
  refType?: 'library' | 'article';
  refId?: string;
  refTitle?: string;
  [key: string]: unknown;
}

/** 深さごとの見た目（GitMind風: ルート=塗り / 第1階層=枝色の淡い塗り / それ以深=素のテキスト）。 */
function nodeVisual(d: MindNodeData, style: Required<MindMapStyle>, theme: MindTheme) {
  const radius = style.shape === 'rect' ? 4 : style.shape === 'pill' ? d.h / 2 : style.radius;
  if (d.depth === 0) return { bg: theme.root, border: 'transparent', fg: theme.rootFg, radius };
  if (d.depth === 1) return { bg: `${d.color}2b`, border: d.color, fg: 'var(--brand-fg)', radius };
  return { bg: 'rgb(var(--brand-fg-rgb) / 0.05)', border: 'transparent', fg: 'rgb(var(--brand-fg-rgb) / 0.85)', radius };
}

const HANDLE_STYLE: React.CSSProperties = {
  opacity: 0, pointerEvents: 'none', width: 1, height: 1, minWidth: 1, minHeight: 1, border: 'none',
};

/** テキスト行の末尾に並ぶ小さな丸バッジ（リンク・メモ・出典）。 */
const badgeSx = {
  width: NODE_BADGE_SIZE, height: NODE_BADGE_SIZE, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: '50%', cursor: 'pointer',
  bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.6)',
  '&:hover': { bgcolor: '#00BFFF', color: '#012' },
} as const;

const MindNode: React.FC<NodeProps> = ({ id, data }) => {
  const d = data as unknown as MindNodeData;
  const ctx = useMindCtx();
  const selected = ctx.selectedIds.includes(id);
  const editing = ctx.editingId === id;
  const isDropTarget = ctx.dropTargetId === id;
  // 関係線モード中は、始点以外が「つなげる先」の候補
  const isLinkCandidate = !!ctx.linkingFrom && ctx.linkingFrom !== id;
  const v = nodeVisual(d, ctx.style, ctx.theme);
  const { px, py } = nodePad(d.depth);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // 実際に折り返る行数（改行の数だけでは、長文で折り返したときに textarea が足りない）
  const lineCount = useMemo(() => wrapText(d.text, d.depth).lines.length, [d.text, d.depth]);
  const img = imageDisplaySize(d);

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => { taRef.current?.focus(); taRef.current?.select(); }, 30);
    return () => clearTimeout(t);
  }, [editing]);

  /** 枝の付け根側の辺に丸ボタンを置く（横レイアウトなら左右、縦レイアウトなら上下）。 */
  const edgeBadgePos = (offset: number) => (d.axis === 'h'
    ? { top: '50%', transform: 'translateY(-50%)', ...(d.side === 1 ? { right: -offset } : { left: -offset }) }
    : { left: '50%', transform: 'translateX(-50%)', ...(d.side === 1 ? { bottom: -offset } : { top: -offset }) });

  const addOffset = d.hasChildren && !d.collapsed ? 34 : 11;
  const outline = ctx.linkingFrom === id ? RELATION_COLOR
    : selected || isDropTarget ? '#00BFFF'
      : v.border;

  return (
    <Box
      className="mind-node"
      onClick={e => { e.stopPropagation(); ctx.clickNode(id, e.ctrlKey || e.metaKey || e.shiftKey); }}
      onDoubleClick={e => { e.stopPropagation(); if (!ctx.linkingFrom) ctx.beginEdit(id); }}
      sx={{
        position: 'relative',
        width: d.w, minHeight: d.h,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        gap: img ? `${NODE_IMAGE_GAP}px` : 0,
        px: `${px}px`, py: `${py}px`,
        boxSizing: 'border-box',
        bgcolor: v.bg,
        border: `1.5px solid ${outline}`,
        borderStyle: isDropTarget ? 'dashed' : 'solid',
        borderRadius: `${v.radius}px`,
        boxShadow: ctx.linkingFrom === id
          ? `0 0 0 3px ${RELATION_COLOR}40`
          : selected ? '0 0 0 3px rgba(0,191,255,0.18), 0 2px 10px rgba(0,0,0,0.25)' : 'none',
        cursor: 'pointer',
        transition: 'box-shadow .12s, border-color .12s',
        '&:hover': isLinkCandidate ? { boxShadow: `0 0 0 3px ${RELATION_COLOR}55` } : {},
        '&:hover .mind-collapse': { opacity: 1 },
      }}
    >
      {/* 接続用の不可視ハンドル（レイアウトの向き・関係線の向きに応じて4辺すべて用意しておく） */}
      <Handle id="sr" type="source" position={Position.Right} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="sl" type="source" position={Position.Left} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="sb" type="source" position={Position.Bottom} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="st" type="source" position={Position.Top} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="tl" type="target" position={Position.Left} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="tr" type="target" position={Position.Right} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="tt" type="target" position={Position.Top} style={HANDLE_STYLE} isConnectable={false} />
      <Handle id="tb" type="target" position={Position.Bottom} style={HANDLE_STYLE} isConnectable={false} />

      {img && (
        <Box
          component="img"
          src={d.image}
          alt=""
          draggable={false}
          // クリックは親へ通してトピックを選択させる。ダブルクリックだけはここで捕まえ、
          // テキスト編集ではなく中身のプレビューを開く。
          onDoubleClick={e => { e.stopPropagation(); ctx.openPreview(id); }}
          sx={{
            width: img.w, height: img.h, alignSelf: 'center', flexShrink: 0,
            objectFit: 'cover', borderRadius: '6px', display: 'block',
            bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
          }}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: `${MIND_ICON_GAP}px`, minWidth: 0 }}>
        {!!d.icons?.length && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${MIND_ICON_GAP}px`, flexShrink: 0 }}>
            {d.icons.map(k => <MindIconView key={k} iconKey={k} />)}
          </Box>
        )}

        {editing ? (
          <Box
            component="textarea"
            ref={taRef}
            className="nodrag nowheel"
            value={d.text}
            rows={lineCount}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => ctx.patchText(id, e.target.value)}
            onBlur={() => ctx.endEdit()}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); ctx.endEdit(true); }
              // Shift+Enter は textarea の既定で改行が入る。Ctrl/Cmd+Enter は既定では
              // 何も起きないので、同じ「改行」として自前で差し込む。
              else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (taRef.current) insertNewlineAtCaret(taRef.current, d.text, next => ctx.patchText(id, next));
              } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ctx.endEdit(); }
              else if (e.key === 'Tab') { e.preventDefault(); ctx.endEdit(); ctx.addChild(id); }
            }}
            sx={{
              ...textSx(d.depth, v.fg),
              flex: 1, minWidth: 0, p: 0, m: 0,
              bgcolor: 'transparent',
              border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
            }}
          />
        ) : (
          <Typography component="div" sx={{
            ...textSx(d.depth, v.fg),
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            flex: 1, minWidth: 0, userSelect: 'none',
          }}>
            {d.text || ' '}
          </Typography>
        )}

        {/* リンク・メモ・出典のバッジ（テキストの後ろ。クリックで開く） */}
        {(d.link || d.note || d.refType) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: `${MIND_ICON_GAP}px`, flexShrink: 0 }}>
            {d.link && (
              <Tooltip title={d.link}>
                <Box className="nodrag" onClick={e => { e.stopPropagation(); openExternal(d.link!); }}
                  sx={badgeSx}>
                  <LinkRoundedIcon sx={{ fontSize: 12 }} />
                </Box>
              </Tooltip>
            )}
            {d.note && (
              <Tooltip title={d.note}>
                <Box className="nodrag" onClick={e => { e.stopPropagation(); ctx.openNote(id); }}
                  sx={badgeSx}>
                  <StickyNote2OutlinedIcon sx={{ fontSize: 12 }} />
                </Box>
              </Tooltip>
            )}
            {d.refType && (
              <Tooltip title={`出典を開く: ${d.refTitle ?? ''}`}>
                <Box className="nodrag"
                  onClick={e => { e.stopPropagation(); openBoardSource({ refType: d.refType, refId: d.refId, url: d.link }); }}
                  sx={badgeSx}>
                  {d.refType === 'library'
                    ? <LocalLibraryRoundedIcon sx={{ fontSize: 12 }} />
                    : <ArticleRoundedIcon sx={{ fontSize: 12 }} />}
                </Box>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>

      {/* 折りたたみトグル（枝の付け根に乗る丸。折りたたみ中は子数バッジ） */}
      {d.hasChildren && (
        <Box
          className="mind-collapse"
          onClick={e => { e.stopPropagation(); ctx.toggleCollapse(id); }}
          sx={{
            position: 'absolute', ...edgeBadgePos(11),
            width: 18, height: 18, borderRadius: '50%', zIndex: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, lineHeight: 1,
            bgcolor: 'var(--brand-surface)', color: d.collapsed ? d.color : 'rgb(var(--brand-fg-rgb) / 0.6)',
            border: `1.5px solid ${d.color}`,
            cursor: 'pointer',
            opacity: d.collapsed ? 1 : 0, transition: 'opacity .12s',
            '&:hover': { color: d.color },
          }}
        >
          {d.collapsed ? Math.min(99, d.childCount) : '−'}
        </Box>
      )}

      {/* 子トピック追加（単独選択かつ通常モードのみ） */}
      {selected && !editing && !ctx.linkingFrom && ctx.selectedIds.length === 1 && (
        <Box
          onClick={e => { e.stopPropagation(); ctx.addChild(id); }}
          sx={{
            position: 'absolute', ...edgeBadgePos(addOffset),
            width: 20, height: 20, borderRadius: '50%', zIndex: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: '#00BFFF', color: '#012', cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            '&:hover': { bgcolor: '#4facfe' },
          }}
        >
          <AddRoundedIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
    </Box>
  );
};

// ─── まとめノード（波括弧＋ラベル。木の外側に浮く注釈） ───────────────────────

interface SummaryNodeData {
  summaryId: string;
  text: string;
  color: string;
  axis: 'h' | 'v';
  side: 1 | -1;
  regionW: number; regionH: number;
  braceLen: number;
  labelW: number; labelH: number;
  [key: string]: unknown;
}

const SummaryNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as SummaryNodeData;
  const ctx = useMindCtx();
  const editing = ctx.editingSummaryId === d.summaryId;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [hover, setHover] = useState(false);
  const lineCount = useMemo(() => wrapText(d.text, 2).lines.length, [d.text]);

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => { taRef.current?.focus(); taRef.current?.select(); }, 30);
    return () => clearTimeout(t);
  }, [editing]);

  // 抽象座標（main=付け根→先端 / cross=括弧の長さ）を、レイアウトの向きへ写す
  const brace = d.axis === 'h'
    ? (d.side === 1
      ? { tx: 0, ty: 0, m: 'matrix(1,0,0,1,0,0)' }
      : { tx: d.regionW - BRACE_D, ty: 0, m: `matrix(-1,0,0,1,${BRACE_D},0)` })
    : (d.side === 1
      ? { tx: 0, ty: 0, m: 'matrix(0,1,1,0,0,0)' }
      : { tx: 0, ty: d.regionH - BRACE_D, m: `matrix(0,-1,1,0,0,${BRACE_D})` });

  const labelPos = d.axis === 'h'
    ? { left: d.side === 1 ? BRACE_D + BRACE_GAP : 0, top: (d.regionH - d.labelH) / 2 }
    : { top: d.side === 1 ? BRACE_D + BRACE_GAP : 0, left: (d.regionW - d.labelW) / 2 };

  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      sx={{ position: 'relative', width: d.regionW, height: d.regionH }}
    >
      <Box component="svg" width={d.regionW} height={d.regionH}
        sx={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <g transform={`translate(${brace.tx},${brace.ty}) ${brace.m}`}>
          <path d={bracePath(d.braceLen)} fill="none" stroke={d.color} strokeWidth={1.6} opacity={0.85} />
        </g>
      </Box>

      <Box
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => { e.stopPropagation(); ctx.beginEditSummary(d.summaryId); }}
        sx={{
          position: 'absolute', ...labelPos,
          width: d.labelW, minHeight: d.labelH,
          display: 'flex', alignItems: 'center',
          px: '10px', py: '5px', boxSizing: 'border-box',
          borderRadius: '8px', cursor: 'pointer',
          bgcolor: `${d.color}1f`, border: `1px dashed ${d.color}`,
        }}
      >
        {editing ? (
          <Box
            component="textarea"
            ref={taRef}
            className="nodrag nowheel"
            value={d.text}
            rows={lineCount}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => ctx.patchSummaryText(d.summaryId, e.target.value)}
            onBlur={() => ctx.endEditSummary()}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              e.stopPropagation();
              if (e.key === 'Escape') { e.preventDefault(); ctx.endEditSummary(true); }
              else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (taRef.current) insertNewlineAtCaret(taRef.current, d.text, next => ctx.patchSummaryText(d.summaryId, next));
              } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ctx.endEditSummary(); }
            }}
            sx={{
              ...textSx(2, 'var(--brand-fg)'),
              flex: 1, minWidth: 0, p: 0, m: 0,
              bgcolor: 'transparent',
              border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
            }}
          />
        ) : (
          <Typography component="div" sx={{
            ...textSx(2, d.text ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)'),
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1, minWidth: 0, userSelect: 'none',
          }}>
            {d.text || 'まとめ'}
          </Typography>
        )}

        {hover && !editing && (
          <Box
            onClick={e => { e.stopPropagation(); ctx.deleteSummary(d.summaryId); }}
            sx={{
              position: 'absolute', top: -8, right: -8, zIndex: 3,
              width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'var(--brand-surface)', color: 'rgb(var(--brand-fg-rgb) / 0.5)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.2)', cursor: 'pointer',
              '&:hover': { color: '#f87171', borderColor: '#f87171' },
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: 11 }} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

const mindNodeTypes = { mind: MindNode, summary: SummaryNode };

// ─── 枝エッジ（曲線 / 直線 / エルボー、主軸の向きに追従） ─────────────────────

const MindEdge: React.FC<EdgeProps> = ({ sourceX, sourceY, targetX, targetY, data }) => {
  const d = data as { color: string; lineStyle: 'curve' | 'straight' | 'elbow'; lineWidth: number; axis: 'h' | 'v' };
  let path: string;
  if (d.lineStyle === 'straight') {
    path = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  } else if (d.lineStyle === 'elbow') {
    if (d.axis === 'h') {
      const mx = (sourceX + targetX) / 2;
      path = `M ${sourceX},${sourceY} L ${mx},${sourceY} L ${mx},${targetY} L ${targetX},${targetY}`;
    } else {
      const my = (sourceY + targetY) / 2;
      path = `M ${sourceX},${sourceY} L ${sourceX},${my} L ${targetX},${my} L ${targetX},${targetY}`;
    }
  } else if (d.axis === 'h') {
    const c = (targetX - sourceX) * 0.5;
    path = `M ${sourceX},${sourceY} C ${sourceX + c},${sourceY} ${targetX - c},${targetY} ${targetX},${targetY}`;
  } else {
    const c = (targetY - sourceY) * 0.5;
    path = `M ${sourceX},${sourceY} C ${sourceX},${sourceY + c} ${targetX},${targetY - c} ${targetX},${targetY}`;
  }
  return <BaseEdge path={path} style={{ stroke: d.color, strokeWidth: d.lineWidth, fill: 'none', opacity: 0.9 }} />;
};

// ─── 関係線（木と無関係な注釈の矢印。破線＋ラベル） ───────────────────────────

const RelationEdge: React.FC<EdgeProps> = ({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, data,
}) => {
  const d = data as { relationId: string; text: string };
  const ctx = useMindCtx();
  const selected = ctx.selectedRelationId === d.relationId;
  const editing = ctx.editingRelationId === d.relationId;
  const taRef = useRef<HTMLTextAreaElement>(null);

  const [path, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => { taRef.current?.focus(); taRef.current?.select(); }, 30);
    return () => clearTimeout(t);
  }, [editing]);

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={{
        stroke: RELATION_COLOR, strokeWidth: selected ? 2.4 : 1.6,
        strokeDasharray: '5 4', fill: 'none',
      }} />
      <EdgeLabelRenderer>
        <Box
          className="nodrag nopan"
          onClick={e => { e.stopPropagation(); ctx.selectRelation(d.relationId); }}
          onDoubleClick={e => { e.stopPropagation(); ctx.beginEditRelation(d.relationId); }}
          sx={{
            position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all', cursor: 'pointer',
            px: 0.75, py: 0.25, borderRadius: 1.5,
            fontSize: 11, fontWeight: 700, lineHeight: 1.5,
            bgcolor: 'var(--brand-surface)',
            border: `1px solid ${selected ? RELATION_COLOR : 'rgb(var(--brand-fg-rgb) / 0.15)'}`,
            color: d.text ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.4)',
            display: 'flex', alignItems: 'center', gap: 0.5,
          }}
        >
          {editing ? (
            <Box
              component="textarea"
              ref={taRef}
              rows={1}
              value={d.text}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => ctx.patchRelationText(d.relationId, e.target.value)}
              onBlur={() => ctx.endEditRelation()}
              onKeyDown={(e: React.KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === 'Escape') { e.preventDefault(); ctx.endEditRelation(true); }
                else if (e.key === 'Enter') { e.preventDefault(); ctx.endEditRelation(); }
              }}
              sx={{
                width: 88, p: 0, m: 0, font: 'inherit', color: 'var(--brand-fg)',
                bgcolor: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden',
              }}
            />
          ) : (
            <>
              <span>{d.text || '関係'}</span>
              {selected && (
                <Box onClick={e => { e.stopPropagation(); ctx.deleteRelation(d.relationId); }}
                  sx={{ display: 'flex', color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#f87171' } }}>
                  <CloseRoundedIcon sx={{ fontSize: 12 }} />
                </Box>
              )}
            </>
          )}
        </Box>
      </EdgeLabelRenderer>
    </>
  );
};

const mindEdgeTypes = { mind: MindEdge, mindRelation: RelationEdge };

// ─── 右パネル: 共通パーツ ─────────────────────────────────────────────────────

const sectionTitleSx = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
  color: 'rgb(var(--brand-fg-rgb) / 0.45)', mb: 0.75, mt: 2, '&:first-of-type': { mt: 0 },
} as const;

const segSx = (active: boolean) => ({
  flex: 1, px: 1, py: 0.6, textAlign: 'center', cursor: 'pointer',
  fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
  bgcolor: active ? '#00BFFF' : 'transparent',
  color: active ? '#000' : 'rgb(var(--brand-fg-rgb) / 0.65)',
  '&:hover': active ? {} : { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.07)' },
} as const);

const sliderSx = {
  color: '#00BFFF', height: 3,
  '& .MuiSlider-thumb': { width: 12, height: 12 },
  '& .MuiSlider-rail': { color: 'rgb(var(--brand-fg-rgb) / 0.2)' },
} as const;

function Segmented<T extends string>({ value, options, onPick }: {
  value: T; options: Array<{ v: T; label: string }>; onPick: (v: T) => void;
}) {
  return (
    <Box sx={{ display: 'flex', borderRadius: 2, overflow: 'hidden', border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)' }}>
      {options.map(o => <Box key={o.v} onClick={() => onPick(o.v)} sx={segSx(value === o.v)}>{o.label}</Box>)}
    </Box>
  );
}

/** 選択枠つきのプリセットセル（テーマ・背景・レイアウトで共用）。 */
const PresetCell: React.FC<{ active: boolean; label: string; onClick: () => void; children: React.ReactNode }> = ({
  active, label, onClick, children,
}) => (
  <Box onClick={onClick} sx={{ cursor: 'pointer', '&:hover .preset-frame': { borderColor: '#00BFFF' } }}>
    <Box className="preset-frame" sx={{
      border: `2px solid ${active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
      borderRadius: 2, overflow: 'hidden', transition: 'border-color .12s',
    }}>
      {children}
    </Box>
    <Typography sx={{
      mt: 0.4, fontSize: 10, textAlign: 'center', fontWeight: active ? 800 : 600,
      color: active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.5)',
    }}>
      {label}
    </Typography>
  </Box>
);

// ─── 右パネル: テーマ / 背景 / レイアウトのプレビュー図 ───────────────────────

const ThemeThumb: React.FC<{ theme: MindTheme; bg?: string }> = ({ theme, bg }) => (
  <Box component="svg" viewBox="0 0 84 52" sx={{ width: '100%', display: 'block', bgcolor: bg ?? 'rgb(var(--brand-fg-rgb) / 0.04)' }}>
    {[0, 1, 2].map(i => (
      <path key={i} d={`M 52,26 C 58,26 58,${11 + i * 15} 64,${11 + i * 15}`}
        fill="none" stroke={theme.palette[i % theme.palette.length]} strokeWidth="1.6" />
    ))}
    <rect x="30" y="20" width="22" height="12" rx="3" fill={theme.root} />
    {[0, 1, 2].map(i => (
      <rect key={i} x="64" y={6 + i * 15} width="15" height="10" rx="2.5"
        fill={theme.palette[i % theme.palette.length]} fillOpacity="0.35"
        stroke={theme.palette[i % theme.palette.length]} strokeWidth="1" />
    ))}
  </Box>
);

const BackgroundThumb: React.FC<{ variant: 'dots' | 'lines' | 'cross' | 'none'; color?: string }> = ({ variant, color }) => {
  const dot = 'rgb(var(--brand-fg-rgb) / 0.35)';
  return (
    <Box component="svg" viewBox="0 0 84 52" sx={{ width: '100%', display: 'block', bgcolor: color ?? 'rgb(var(--brand-fg-rgb) / 0.04)' }}>
      {variant === 'dots' && [...Array(6)].map((_, r) => [...Array(9)].map((_, c) => (
        <circle key={`${r}-${c}`} cx={5 + c * 9.5} cy={5 + r * 8.5} r="1" fill={dot} />
      )))}
      {(variant === 'lines' || variant === 'cross') && [...Array(6)].map((_, r) => (
        <line key={`h${r}`} x1="0" y1={5 + r * 8.5} x2="84" y2={5 + r * 8.5} stroke={dot} strokeWidth="0.6" />
      ))}
      {variant === 'lines' && [...Array(9)].map((_, c) => (
        <line key={`v${c}`} x1={5 + c * 9.5} y1="0" x2={5 + c * 9.5} y2="52" stroke={dot} strokeWidth="0.6" />
      ))}
      {variant === 'cross' && [...Array(6)].map((_, r) => [...Array(9)].map((_, c) => (
        <path key={`x${r}-${c}`} d={`M ${2 + c * 9.5},${5 + r * 8.5} h 6 M ${5 + c * 9.5},${2 + r * 8.5} v 6`}
          stroke={dot} strokeWidth="0.6" />
      )))}
    </Box>
  );
};

/** レイアウトの形を示す模式図。MIND_LAYOUT_SPEC の4フラグからそのまま描く。 */
const LayoutThumb: React.FC<{ layoutKey: MindLayoutKey }> = ({ layoutKey }) => {
  const s = MIND_LAYOUT_SPEC[layoutKey];
  const line = 'rgb(var(--brand-fg-rgb) / 0.4)';
  const chip = 'rgb(var(--brand-fg-rgb) / 0.28)';
  const cx = 42, cy = 26;
  const kids: Array<{ x: number; y: number; d: string }> = [];

  if (s.axis === 'h') {
    const sides: Array<1 | -1> = s.split ? [1, -1] : [s.dir];
    for (const side of sides) {
      const n = s.split ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const y = cy + (i - (n - 1) / 2) * 13;
        const inner = cx + side * 22;               // 子の付け根側の辺
        const x = side === 1 ? inner : inner - 16;  // 子の左端
        const from = cx + side * 10;
        kids.push({
          x, y: y - 4,
          d: s.columnAligned
            ? `M ${from},${cy} L ${from + side * 6},${cy} L ${from + side * 6},${y} L ${inner},${y}`
            : `M ${from},${cy} C ${from + side * 7},${cy} ${inner - side * 7},${y} ${inner},${y}`,
        });
      }
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * 22;
      const inner = cy + s.dir * 12;                // 子の付け根側の辺
      const y = s.dir === 1 ? inner : inner - 8;    // 子の上端
      const from = cy + s.dir * 4;
      kids.push({
        x: x - 8, y,
        d: `M ${cx},${from} L ${cx},${from + s.dir * 4} L ${x},${from + s.dir * 4} L ${x},${inner}`,
      });
    }
  }

  return (
    <Box component="svg" viewBox="0 0 84 52" sx={{ width: '100%', display: 'block', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.04)' }}>
      {kids.map((k, i) => <path key={`l${i}`} d={k.d} fill="none" stroke={line} strokeWidth="1" />)}
      <rect x={cx - 10} y={cy - 4} width="20" height="8" rx="2.5" fill="rgb(var(--brand-fg-rgb) / 0.55)" />
      {kids.map((k, i) => <rect key={`k${i}`} x={k.x} y={k.y} width="16" height="8" rx="2" fill={chip} />)}
    </Box>
  );
};

// ─── 右パネル本体（スタイル / テーマ / レイアウト / アイコン） ────────────────

type PanelTab = 'style' | 'theme' | 'layout' | 'icon';

const PANEL_TABS: Array<{ key: PanelTab; label: string }> = [
  { key: 'style', label: 'スタイル' },
  { key: 'theme', label: 'テーマ' },
  { key: 'layout', label: 'レイアウト' },
  { key: 'icon', label: 'アイコン' },
];

const RightPanel: React.FC<{
  tab: PanelTab;
  setTab: (t: PanelTab) => void;
  style: Required<MindMapStyle>;
  theme: MindTheme;
  patchStyle: (patch: MindMapStyle) => void;
  applyTheme: (key: string) => void;
  applyLayout: (key: MindLayoutKey) => void;
  selectedNode: MindMapNode | null;
  patchNodeColor: (id: string, color: string | undefined) => void;
  toggleIcon: (id: string, iconKey: string) => void;
  onClose: () => void;
}> = ({ tab, setTab, style, theme, patchStyle, applyTheme, applyLayout, selectedNode, patchNodeColor, toggleIcon, onClose }) => {
  const [themeSub, setThemeSub] = useState<'theme' | 'background'>('theme');
  const selectedIsRoot = selectedNode?.parentId == null;

  return (
    <Box sx={{
      position: 'absolute', top: 12, right: 12, zIndex: 30, width: 262,
      maxHeight: 'calc(100% - 24px)',
      display: 'flex', flexDirection: 'column',
      bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)',
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3,
      boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
    }}>
      {/* タブ行 */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, pt: 0.5, flexShrink: 0 }}>
        {PANEL_TABS.map(t => {
          const active = tab === t.key;
          return (
            <Box key={t.key} onClick={() => setTab(t.key)} sx={{
              flex: 1, textAlign: 'center', py: 1, cursor: 'pointer',
              fontSize: 11.5, fontWeight: active ? 800 : 600, whiteSpace: 'nowrap',
              color: active ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.55)',
              borderBottom: `2px solid ${active ? '#00BFFF' : 'transparent'}`,
              '&:hover': active ? {} : { color: 'var(--brand-fg)' },
            }}>
              {t.label}
            </Box>
          );
        })}
        <IconButton size="small" onClick={onClose} sx={{ ml: 0.25, mb: 0.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 1.75 }}>
        {tab === 'style' && (
          <>
            <Typography sx={sectionTitleSx}>形</Typography>
            <Segmented value={style.shape}
              options={[{ v: 'rounded', label: '角丸' }, { v: 'rect', label: '四角' }, { v: 'pill', label: 'ピル' }]}
              onPick={v => patchStyle({ shape: v })} />

            {style.shape === 'rounded' && (
              <>
                <Typography sx={sectionTitleSx}>角の半径</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }}>
                  <Slider size="small" min={0} max={20} value={style.radius}
                    onChange={(_, v) => patchStyle({ radius: v as number })} sx={sliderSx} />
                  <Typography sx={{ fontSize: 11, width: 26, textAlign: 'right', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{style.radius}</Typography>
                </Box>
              </>
            )}

            <Typography sx={sectionTitleSx}>関連線</Typography>
            <Segmented value={style.lineStyle}
              options={[{ v: 'curve', label: '曲線' }, { v: 'straight', label: '直線' }, { v: 'elbow', label: '直角' }]}
              onPick={v => patchStyle({ lineStyle: v })} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 1, px: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>太さ</Typography>
              <Slider size="small" min={1} max={4} step={0.5} value={style.lineWidth}
                onChange={(_, v) => patchStyle({ lineWidth: v as number })} sx={sliderSx} />
              <Typography sx={{ fontSize: 11, width: 26, textAlign: 'right', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{style.lineWidth}px</Typography>
            </Box>

            <Typography sx={sectionTitleSx}>ノード間の距離</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>水平</Typography>
              <Slider size="small" min={24} max={140} value={style.hGap}
                onChange={(_, v) => patchStyle({ hGap: v as number })} sx={sliderSx} />
              <Typography sx={{ fontSize: 11, width: 26, textAlign: 'right', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{style.hGap}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }}>
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)', flexShrink: 0 }}>垂直</Typography>
              <Slider size="small" min={6} max={60} value={style.vGap}
                onChange={(_, v) => patchStyle({ vGap: v as number })} sx={sliderSx} />
              <Typography sx={{ fontSize: 11, width: 26, textAlign: 'right', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{style.vGap}</Typography>
            </Box>

            <Typography sx={sectionTitleSx}>選択中の枝の色</Typography>
            {selectedNode && !selectedIsRoot ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 0.25 }}>
                {theme.palette.map(c => (
                  <Box key={c} onClick={() => patchNodeColor(selectedNode.id, c)}
                    sx={{
                      width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', bgcolor: c,
                      border: selectedNode.color === c ? '2px solid var(--brand-fg)' : '2px solid transparent',
                      '&:hover': { transform: 'scale(1.15)' }, transition: 'transform .1s',
                    }} />
                ))}
                <Tooltip title="自動（親の色 / テーマのパレット順）">
                  <Box onClick={() => patchNodeColor(selectedNode.id, undefined)}
                    sx={{
                      width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                      border: `2px solid ${selectedNode.color == null ? 'var(--brand-fg)' : 'rgb(var(--brand-fg-rgb) / 0.3)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.6)',
                    }}>A</Box>
                </Tooltip>
              </Box>
            ) : (
              <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)', px: 0.25 }}>
                {selectedIsRoot ? '中心トピックの色はテーマで決まります' : '枝のトピックを選ぶと色を変えられます'}
              </Typography>
            )}
          </>
        )}

        {tab === 'theme' && (
          <>
            <Segmented value={themeSub}
              options={[{ v: 'theme' as const, label: 'テーマ' }, { v: 'background' as const, label: '背景を変更' }]}
              onPick={setThemeSub} />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.75 }}>
              {themeSub === 'theme'
                ? MIND_THEMES.map(t => (
                  <PresetCell key={t.key} active={style.theme === t.key} label={t.label} onClick={() => applyTheme(t.key)}>
                    <ThemeThumb theme={t} bg={resolveBackground(style.background).color} />
                  </PresetCell>
                ))
                : MIND_BACKGROUNDS.map(b => (
                  <PresetCell key={b.key} active={style.background === b.key} label={b.label}
                    onClick={() => patchStyle({ background: b.key })}>
                    <BackgroundThumb variant={b.variant} color={b.color} />
                  </PresetCell>
                ))}
            </Box>
            {themeSub === 'theme' && (
              <Typography sx={{ mt: 1.5, fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6 }}>
                テーマを選ぶと中心色・枝のパレット・形・線がまとめて切り替わります。個別に変えた枝の色はそのまま残ります。
              </Typography>
            )}
          </>
        )}

        {tab === 'layout' && (
          <>
            {(['mindmap', 'logic'] as const).map(group => (
              <Box key={group}>
                <Typography sx={sectionTitleSx}>{group === 'mindmap' ? 'マインドマップ' : 'ロジック図'}</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {MIND_LAYOUTS.filter(l => l.group === group).map(l => (
                    <PresetCell key={l.key} active={style.layout === l.key} label={l.label} onClick={() => applyLayout(l.key)}>
                      <LayoutThumb layoutKey={l.key} />
                    </PresetCell>
                  ))}
                </Box>
              </Box>
            ))}
            <Typography sx={{ mt: 1.75, fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.35)', lineHeight: 1.6 }}>
              マインドマップは枝が伸びる形、ロジック図は同じ深さのトピックを列（行）に揃える形です。線の種類は選んだ形に合わせて切り替わります。
            </Typography>
          </>
        )}

        {tab === 'icon' && (
          <>
            {!selectedNode ? (
              <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.4)', lineHeight: 1.7 }}>
                トピックを選ぶと、アイコンを付けられます。
              </Typography>
            ) : (
              <>
                <Typography sx={sectionTitleSx}>付いているアイコン</Typography>
                {selectedNode.icons?.length ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedNode.icons.map(k => (
                      <Tooltip key={k} title={`${findMindIcon(k)?.label ?? k} — クリックで外す`}>
                        <Box onClick={() => toggleIcon(selectedNode.id, k)} sx={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 28, height: 28, borderRadius: 1.5, cursor: 'pointer',
                          border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
                          '&:hover': { borderColor: '#f87171', bgcolor: 'rgba(248,113,113,0.1)' },
                        }}>
                          <MindIconView iconKey={k} size={18} />
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                    まだありません。下から選んで付けられます。
                  </Typography>
                )}

                {MIND_ICON_GROUPS.map(g => (
                  <Box key={g.key}>
                    <Typography sx={sectionTitleSx}>{g.label}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {g.icons.map(ic => {
                        const on = selectedNode.icons?.includes(ic.key) ?? false;
                        return (
                          <Tooltip key={ic.key} title={ic.label}>
                            <Box onClick={() => toggleIcon(selectedNode.id, ic.key)} sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 28, height: 28, borderRadius: 1.5, cursor: 'pointer',
                              border: `1px solid ${on ? '#00BFFF' : 'transparent'}`,
                              bgcolor: on ? 'rgba(0,191,255,0.14)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
                              '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)' },
                            }}>
                              <MindIconView iconKey={ic.key} size={18} />
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

// ─── 本体 ─────────────────────────────────────────────────────────────────────

interface Props {
  /** ボードキー（scope|docId）。ResearchCanvas と同じボード doc の mindmap フィールドを使う。 */
  boardKey: string;
}

type MindRFNode = Node<MindNodeData, 'mind'>;
type SummaryRFNode = Node<SummaryNodeData, 'summary'>;
type AnyRFNode = MindRFNode | SummaryRFNode;

const BG_VARIANT: Record<'dots' | 'lines' | 'cross', BackgroundVariant> = {
  dots: BackgroundVariant.Dots,
  lines: BackgroundVariant.Lines,
  cross: BackgroundVariant.Cross,
};

/** Ctrl+Z の単位。木・まとめ・関係線をひとまとめに戻す。 */
interface MindSnapshot {
  nodes: MindMapNode[];
  summaries: MindMapSummary[];
  relations: MindMapRelation[];
}

const MindMapInner: React.FC<Props> = ({ boardKey }) => {
  // データ/ブリッジは boardKey（ボード単位）、チャット・キックオフは scope（プロジェクト/個人単位）。
  const boardScope = parseBoardKey(boardKey).scope;
  const [mmNodes, setMmNodes] = useState<MindMapNode[]>([]);
  const [summaries, setSummaries] = useState<MindMapSummary[]>([]);
  const [relations, setRelations] = useState<MindMapRelation[]>([]);
  const [styleState, setStyleState] = useState<MindMapStyle>({});
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  // ドラッグ中の移動先プラン（sibling の挿入線の描画用。child の強調は dropTargetId が担う）
  const [dropPlan, setDropPlanState] = useState<DropPlan | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('style');
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(null);
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  // ドラッグ空振り時にレイアウト座標へ戻すための再同期トリガー
  const [layoutNonce, setLayoutNonce] = useState(0);
  // 挿入まわり（メモ・画像・リンク・知識・Drive）
  const [uploading, setUploading] = useState(false);
  // 右側に出るパネル（スタイル / Drive / 知識）は同じ場所を使うので、常にどれか1つ
  const [rightPane, setRightPane] = useState<'none' | 'style' | 'drive' | 'knowledge'>('none');
  const [linkDialog, setLinkDialog] = useState<null | { nodeId: string; url: string }>(null);
  const [noteDialog, setNoteDialog] = useState<null | { nodeId: string; text: string }>(null);
  // サムネのダブルクリックで開くプレビュー（記事なら本文、それ以外は画像を大きく）
  const [previewId, setPreviewId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toggleRightPane = useCallback((pane: 'style' | 'drive' | 'knowledge') => {
    setRightPane(cur => (cur === pane ? 'none' : pane));
  }, []);

  const { fitView, screenToFlowPosition } = useReactFlow();
  const style: Required<MindMapStyle> = useMemo(() => ({ ...DEFAULT_STYLE, ...styleState }), [styleState]);
  const theme = useMemo(() => resolveTheme(style.theme), [style.theme]);
  const background = useMemo(() => resolveBackground(style.background), [style.background]);
  /** 単独操作（子追加・編集・色/アイコン）の対象。複数選択なら最後に選んだもの。 */
  const primaryId = selectedIds.length ? selectedIds[selectedIds.length - 1] : null;

  // 最新の状態を ref に写しておく（保存のデバウンス、履歴の記録、キー操作など
  // 「レンダー後に走る処理」から常に最新を読むため）。コミット後に同期する。
  const mmRef = useRef<MindMapNode[]>([]);
  const sumRef = useRef<MindMapSummary[]>([]);
  const relRef = useRef<MindMapRelation[]>([]);
  const styleRef = useRef<MindMapStyle>({});
  useEffect(() => { mmRef.current = mmNodes; }, [mmNodes]);
  useEffect(() => { sumRef.current = summaries; }, [summaries]);
  useEffect(() => { relRef.current = relations; }, [relations]);
  useEffect(() => { styleRef.current = styleState; }, [styleState]);

  // ─── 読み込み（空なら中心トピックを自動生成） ───────────────────────────────
  const lastSavedRef = useRef<string>('');
  useEffect(() => {
    let cancelled = false;
    // 親が <ReactFlowProvider key={boardKey}> で包んでいるためボード切替＝再マウントで、
    // ここは実質マウント時のみ走る。ボードを跨いで前の木が一瞬見えないよう、念のため戻す。
    setLoading(true);
    setSelectedIds([]);
    setEditingId(null);
    ResearchCanvasRepository.load(boardKey)
      .then(({ mindmap, mindmapStyle, mindmapSummaries, mindmapRelations }) => {
        if (cancelled) return;
        lastSavedRef.current = JSON.stringify({ mindmap, mindmapStyle, mindmapSummaries, mindmapRelations });
        if (mindmap.length === 0) {
          const now = new Date().toISOString();
          setMmNodes([{ id: newId('m'), parentId: null, rank: 0, text: '中心トピック', createdAt: now, updatedAt: now }]);
        } else {
          setMmNodes(mindmap);
        }
        setStyleState(mindmapStyle);
        setSummaries(mindmapSummaries);
        setRelations(mindmapRelations);
      })
      .catch(err => console.error('[mindmap] 読み込みに失敗:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [boardKey]);

  // ─── 保存（デバウンス・失敗時は自動リトライ） ───────────────────────────────
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushSaveRef = useRef<() => void>(() => {});
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const payload = {
      mindmap: mmRef.current,
      mindmapStyle: styleRef.current,
      mindmapSummaries: sumRef.current,
      mindmapRelations: relRef.current,
    };
    const json = JSON.stringify(payload);
    if (json === lastSavedRef.current) return;
    const prev = lastSavedRef.current;
    lastSavedRef.current = json;
    ResearchCanvasRepository.save(boardKey, payload)
      .then(() => setSaveError(false))
      .catch(err => {
        console.error('[mindmap] 保存に失敗:', err);
        lastSavedRef.current = prev;
        setSaveError(true);
        setTimeout(() => flushSaveRef.current(), 10_000);
      });
  }, [boardKey]);
  // リトライのタイマーは「そのとき最新の flushSave」を呼ぶ（boardKey 切替後も正しい宛先へ書く）
  useEffect(() => { flushSaveRef.current = flushSave; }, [flushSave]);

  useEffect(() => {
    if (loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [mmNodes, summaries, relations, styleState, loading, flushSave]);
  useEffect(() => () => { flushSave(); }, [flushSave]);

  // ─── 元に戻す / やり直す ─────────────────────────────────────────────────────
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastSnapRef = useRef<string>('');
  const histTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const takeSnapshot = useCallback((): string => JSON.stringify({
    nodes: mmRef.current, summaries: sumRef.current, relations: relRef.current,
  } satisfies MindSnapshot), []);

  const applySnapshot = useCallback((snap: string) => {
    const parsed = JSON.parse(snap) as MindSnapshot;
    lastSnapRef.current = snap;
    setMmNodes(parsed.nodes);
    setSummaries(parsed.summaries);
    setRelations(parsed.relations);
    setEditingId(null);
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    const prev = h.past.pop()!;
    h.future.push(lastSnapRef.current);
    applySnapshot(prev);
  }, [applySnapshot]);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const next = h.future.pop()!;
    h.past.push(lastSnapRef.current);
    applySnapshot(next);
  }, [applySnapshot]);

  useEffect(() => {
    if (loading) return;
    if (histTimerRef.current) clearTimeout(histTimerRef.current);
    histTimerRef.current = setTimeout(() => {
      const snap = takeSnapshot();
      if (snap === lastSnapRef.current) return;
      if (lastSnapRef.current) historyRef.current.past.push(lastSnapRef.current);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      lastSnapRef.current = snap;
    }, 500);
  }, [mmNodes, summaries, relations, loading, takeSnapshot]);
  useEffect(() => {
    if (loading) return;
    // ロード直後の状態を履歴の基準にする（初回の Ctrl+Z で空ボードに戻らないように）
    lastSnapRef.current = takeSnapshot();
    historyRef.current = { past: [], future: [] };
  }, [loading, takeSnapshot]);

  // ─── 木の操作 ────────────────────────────────────────────────────────────────
  const rootId = useMemo(() => mmNodes.find(n => n.parentId == null)?.id ?? null, [mmNodes]);

  const patchNode = useCallback((id: string, patch: Partial<MindMapNode>) => {
    setMmNodes(nds => nds.map(n => n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n));
  }, []);

  const editOriginRef = useRef<{ id: string; text: string } | null>(null);
  const beginEdit = useCallback((id: string) => {
    // 編集中のノード内でのダブルクリック（単語選択）が親へ伝播しても、
    // 編集前テキスト（Escape で戻す値）を編集途中の内容で上書きしない。
    if (editOriginRef.current?.id === id) return;
    const n = mmRef.current.find(x => x.id === id);
    if (!n) return;
    editOriginRef.current = { id, text: n.text };
    setSelectedIds([id]);
    setEditingId(id);
  }, []);
  const endEdit = useCallback((cancel = false) => {
    const origin = editOriginRef.current;
    if (cancel && origin) patchNode(origin.id, { text: origin.text });
    editOriginRef.current = null;
    setEditingId(null);
  }, [patchNode]);

  const addChild = useCallback((parentId: string) => {
    const now = new Date().toISOString();
    const id = newId('m');
    setMmNodes(nds => {
      const siblings = nds.filter(n => n.parentId === parentId);
      const rank = siblings.length ? Math.max(...siblings.map(s => s.rank)) + 1 : 0;
      return nds
        .map(n => n.id === parentId && n.collapsed ? { ...n, collapsed: false, updatedAt: now } : n)
        .concat({ id, parentId, rank, text: '', createdAt: now, updatedAt: now });
    });
    editOriginRef.current = { id, text: '' };
    setSelectedIds([id]);
    setEditingId(id);
  }, []);

  const addSibling = useCallback((id: string) => {
    const node = mmRef.current.find(n => n.id === id);
    if (!node) return;
    if (node.parentId == null) { addChild(id); return; } // ルートで押されたら子を追加
    const now = new Date().toISOString();
    const newNodeId = newId('m');
    setMmNodes(nds => {
      const siblings = nds.filter(n => n.parentId === node.parentId).sort((a, b) => a.rank - b.rank);
      const idx = siblings.findIndex(s => s.id === id);
      const next = siblings[idx + 1];
      const rank = next ? (node.rank + next.rank) / 2 : node.rank + 1;
      return nds.concat({ id: newNodeId, parentId: node.parentId, rank, text: '', createdAt: now, updatedAt: now });
    });
    editOriginRef.current = { id: newNodeId, text: '' };
    setSelectedIds([newNodeId]);
    setEditingId(newNodeId);
  }, [addChild]);

  const collectSubtree = useCallback((id: string, nds: MindMapNode[]): Set<string> => {
    const ids = new Set<string>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nds) {
        if (n.parentId != null && ids.has(n.parentId) && !ids.has(n.id)) { ids.add(n.id); grew = true; }
      }
    }
    return ids;
  }, []);

  /** 選択中のトピックを枝ごと削除。ぶら下がる関係線・まとめも一緒に畳む。 */
  const deleteSelected = useCallback(() => {
    const targets = selectedIds.filter(id => id !== rootId);
    if (!targets.length) return;
    const ids = new Set<string>();
    for (const t of targets) for (const i of collectSubtree(t, mmRef.current)) ids.add(i);
    const parentOfFirst = mmRef.current.find(n => n.id === targets[0])?.parentId ?? null;
    setMmNodes(nds => nds.filter(n => !ids.has(n.id)));
    setRelations(rs => rs.filter(r => !ids.has(r.source) && !ids.has(r.target)));
    setSummaries(ss => ss
      .map(s => (s.nodeIds.some(i => ids.has(i)) ? { ...s, nodeIds: s.nodeIds.filter(i => !ids.has(i)) } : s))
      .filter(s => s.nodeIds.length > 0));
    setSelectedIds(parentOfFirst ? [parentOfFirst] : []);
    setEditingId(null);
  }, [selectedIds, rootId, collectSubtree]);

  const toggleCollapse = useCallback((id: string) => {
    const n = mmRef.current.find(x => x.id === id);
    if (n) patchNode(id, { collapsed: !n.collapsed });
  }, [patchNode]);

  const toggleIcon = useCallback((id: string, iconKey: string) => {
    const n = mmRef.current.find(x => x.id === id);
    if (!n) return;
    const cur = n.icons ?? [];
    const next = cur.includes(iconKey) ? cur.filter(k => k !== iconKey) : [...cur, iconKey];
    // 空配列ではなく undefined に落として、アイコン無しのノードを保存データに残さない
    patchNode(id, { icons: next.length ? next : undefined });
  }, [patchNode]);

  // ─── トピックへの挿入（メモ・画像・リンク・知識・Drive）────────────────────
  /**
   * 画像をトピックに貼る。ノードの寸法は描画前に確定させる必要があるので、
   * 元サイズを読んでから貼る（読めなければ 4:3 とみなす）。
   */
  const loadImageDims = useCallback((url: string) => new Promise<{ w: number; h: number } | null>(resolve => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = url;
  }), []);

  const attachImage = useCallback(async (nodeId: string, url: string) => {
    const dims = await loadImageDims(url);
    patchNode(nodeId, { image: url, imageW: dims?.w, imageH: dims?.h });
    setSelectedIds([nodeId]);
  }, [patchNode, loadImageDims]);

  const handleImageFile = useCallback(async (nodeId: string, file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await ResearchCanvasRepository.uploadImage(boardKey, file);
      await attachImage(nodeId, url);
    } catch (err) {
      console.error('[mindmap] 画像のアップロードに失敗:', err);
    } finally {
      setUploading(false);
    }
  }, [boardKey, attachImage]);

  /** 知識パネルで選んだ出典を、指定トピックの子トピックとして足す。 */
  const addKnowledgeChildren = useCallback((parentId: string, picked: KnowledgePick[]) => {
    if (!picked.length) return;
    const now = new Date().toISOString();
    const added = picked.map(p => ({
      id: newId('m'), parentId, rank: 0,
      // 要点の取り込みでは text＝要点の本文（refTitle はあくまで出典名）
      text: p.text || p.refTitle || '無題',
      image: p.image,
      link: p.url, refType: p.refType, refId: p.refId, refTitle: p.refTitle,
      createdAt: now, updatedAt: now,
    } satisfies MindMapNode));
    setMmNodes(nds => {
      const siblings = nds.filter(n => n.parentId === parentId);
      let rank = siblings.length ? Math.max(...siblings.map(s => s.rank)) + 1 : 0;
      added.forEach(a => { a.rank = rank++; });
      return nds
        .map(n => n.id === parentId && n.collapsed ? { ...n, collapsed: false, updatedAt: now } : n)
        .concat(added);
    });
    // サムネの元サイズは後追いで読み込み、取れたところで比率を正す
    // （読み込み前は 4:3 のプレースホルダー比で描画される）
    added.forEach(a => {
      if (!a.image) return;
      loadImageDims(a.image).then(dims => {
        if (dims) patchNode(a.id, { imageW: dims.w, imageH: dims.h });
      });
    });
  }, [loadImageDims, patchNode]);

  const openNote = useCallback((id: string) => {
    const n = mmRef.current.find(x => x.id === id);
    if (n) setNoteDialog({ nodeId: id, text: n.note ?? '' });
  }, []);

  /** サムネのダブルクリック: 中身を大きく見せる（選択も動かして文脈を合わせる）。 */
  const openPreview = useCallback((id: string) => {
    setSelectedIds([id]);
    setPreviewId(id);
  }, []);

  // 空欄で保存＝外す。undefined にして、保存データに空文字を残さない
  const commitNoteDialog = useCallback(() => {
    if (!noteDialog) return;
    const text = noteDialog.text.trim();
    patchNode(noteDialog.nodeId, { note: text || undefined });
    setNoteDialog(null);
  }, [noteDialog, patchNode]);

  const commitLinkDialog = useCallback(() => {
    if (!linkDialog) return;
    const raw = linkDialog.url.trim();
    const url = raw && !/^https?:\/\//.test(raw) ? `https://${raw}` : raw;
    patchNode(linkDialog.nodeId, { link: url || undefined });
    setLinkDialog(null);
  }, [linkDialog, patchNode]);

  // ─── まとめ ──────────────────────────────────────────────────────────────────
  /** 選択が「同じ親を持つ兄弟」かつルートを含まないときだけ、まとめを作れる。 */
  const canSummarize = useMemo(() => {
    if (!selectedIds.length || (rootId != null && selectedIds.includes(rootId))) return false;
    const parents = new Set(selectedIds.map(id => mmNodes.find(n => n.id === id)?.parentId ?? null));
    return parents.size === 1 && !parents.has(null);
  }, [selectedIds, rootId, mmNodes]);

  const addSummary = useCallback(() => {
    if (!canSummarize) return;
    const now = new Date().toISOString();
    const id = newId('s');
    setSummaries(ss => [...ss, { id, nodeIds: [...selectedIds], text: '', createdAt: now, updatedAt: now }]);
    setEditingSummaryId(id);
  }, [canSummarize, selectedIds]);

  const summaryOriginRef = useRef<{ id: string; text: string } | null>(null);
  const patchSummaryText = useCallback((id: string, text: string) => {
    setSummaries(ss => ss.map(s => s.id === id ? { ...s, text, updatedAt: new Date().toISOString() } : s));
  }, []);
  const beginEditSummary = useCallback((id: string) => {
    if (summaryOriginRef.current?.id === id) return;
    const s = sumRef.current.find(x => x.id === id);
    if (!s) return;
    summaryOriginRef.current = { id, text: s.text };
    setEditingSummaryId(id);
  }, []);
  const endEditSummary = useCallback((cancel = false) => {
    const origin = summaryOriginRef.current;
    if (cancel && origin) patchSummaryText(origin.id, origin.text);
    summaryOriginRef.current = null;
    setEditingSummaryId(null);
  }, [patchSummaryText]);
  const deleteSummary = useCallback((id: string) => {
    setSummaries(ss => ss.filter(s => s.id !== id));
    setEditingSummaryId(cur => (cur === id ? null : cur));
  }, []);

  // ─── 関係線 ──────────────────────────────────────────────────────────────────
  const addRelation = useCallback((source: string, target: string) => {
    const now = new Date().toISOString();
    setRelations(rs => (
      rs.some(r => r.source === source && r.target === target)
        ? rs
        : [...rs, { id: newId('r'), source, target, createdAt: now, updatedAt: now }]
    ));
  }, []);
  const relationOriginRef = useRef<{ id: string; text: string } | null>(null);
  const patchRelationText = useCallback((id: string, text: string) => {
    setRelations(rs => rs.map(r => r.id === id ? { ...r, text, updatedAt: new Date().toISOString() } : r));
  }, []);
  const beginEditRelation = useCallback((id: string) => {
    if (relationOriginRef.current?.id === id) return;
    const r = relRef.current.find(x => x.id === id);
    if (!r) return;
    relationOriginRef.current = { id, text: r.text ?? '' };
    setSelectedRelationId(id);
    setEditingRelationId(id);
  }, []);
  const endEditRelation = useCallback((cancel = false) => {
    const origin = relationOriginRef.current;
    if (cancel && origin) patchRelationText(origin.id, origin.text);
    relationOriginRef.current = null;
    setEditingRelationId(null);
  }, [patchRelationText]);
  const deleteRelation = useCallback((id: string) => {
    setRelations(rs => rs.filter(r => r.id !== id));
    setSelectedRelationId(cur => (cur === id ? null : cur));
    setEditingRelationId(cur => (cur === id ? null : cur));
  }, []);

  // ─── AI 連携（SEKKEIYA Chat の verb からライブ操作できるようホスト登録）────────
  // 追加/削除は state に入るので、既存の debounce 保存にそのまま乗る。
  useEffect(() => {
    return registerMindMapHost({
      boardKey,
      getTopics: () => mmRef.current,
      getRelations: () => relRef.current,
      getSummaries: () => sumRef.current,
      addTopics: (nodes, expandIds) => {
        const now = new Date().toISOString();
        const expand = new Set(expandIds);
        setMmNodes(nds => nds
          .map(n => (expand.has(n.id) && n.collapsed ? { ...n, collapsed: false, updatedAt: now } : n))
          .concat(nodes));
        // サムネの元サイズは後追いで読み込んで比率を正す
        nodes.forEach(n => {
          if (!n.image || n.imageW) return;
          loadImageDims(n.image).then(d => { if (d) patchNode(n.id, { imageW: d.w, imageH: d.h }); });
        });
      },
      patchTopic: patchNode,
      removeTopics: ids => {
        const idSet = new Set(ids);
        setMmNodes(nds => nds.filter(n => !idSet.has(n.id)));
        setRelations(rs => rs.filter(r => !idSet.has(r.source) && !idSet.has(r.target)));
        setSummaries(ss => ss
          .map(s => (s.nodeIds.some(i => idSet.has(i)) ? { ...s, nodeIds: s.nodeIds.filter(i => !idSet.has(i)) } : s))
          .filter(s => s.nodeIds.length > 0));
      },
      addRelations: rels => setRelations(rs => [...rs, ...rels]),
      removeRelations: ids => {
        const idSet = new Set(ids);
        setRelations(rs => rs.filter(r => !idSet.has(r.id)));
      },
    });
  }, [boardKey, patchNode, loadImageDims]);

  // 別ウィンドウ（ポップアウトした SEKKEIYA OS の AI）がヘッドレスで更新したら読み直す。
  // part==='mindmap' のイベントだけ拾う（ノード画面のヘッドレス更新では読み直さない＝
  // ローカルの未保存編集を不必要に上書きしない）。
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) =>
      listen<{ projectId: string; part?: string }>(RESEARCH_BOARD_CHANGED_EVENT, (e) => {
        if (e.payload?.projectId !== boardKey || e.payload?.part !== 'mindmap') return;
        ResearchCanvasRepository.load(boardKey)
          .then(({ mindmap, mindmapStyle, mindmapSummaries, mindmapRelations }) => {
            lastSavedRef.current = JSON.stringify({ mindmap, mindmapStyle, mindmapSummaries, mindmapRelations });
            setMmNodes(mindmap);
            setStyleState(mindmapStyle);
            setSummaries(mindmapSummaries);
            setRelations(mindmapRelations);
          })
          .catch(err => console.error('[mindmap] 外部更新の再読込に失敗:', err));
      }).then(fn => { unlisten = fn; })
    );
    return () => { unlisten?.(); };
  }, [boardKey]);

  // ─── AI キックオフ（タブを開いたらチャットを開き、AIから対話を切り出させる）──
  const isAccountBoard = boardScope === ACCOUNT_BOARD_ID;

  const kickoffText = useCallback(() => {
    const head =
      '【マインドマップ・キックオフ】これは Research & Memo タブを開いた際の内部指示です（ユーザーの発話ではありません）。';
    const frame = isAccountBoard
      ? 'ここはアカウントサイトの個人マインドマップで、ユーザーが「自分の目指す方向性・やりたいこと」をあなたと一緒に、中心トピックから枝分かれさせて構造化していく場です。'
      : 'ユーザーはこれから Research & Memo のマインドマップで設計デザインの深掘りを始めます。';
    const questions = isAccountBoard
      ? '挨拶は一言だけにして、その人の内発的な動機を引き出す具体的な問いを1〜2個投げかける（例: 3年後に手がけていたい仕事、これまでで一番手応えを感じた瞬間、譲れない価値観 など）。'
      : '挨拶は一言だけにして、デザイナーの発想力を掻き立てる具体的な問いを1〜2個投げかける（例: 敷地で一番心が動いた瞬間、施主の暮らしの理想の一場面——プロジェクトの文脈に合わせて選ぶ）。';
    return head + frame +
      'あなたから対話を切り出してください。まず mindmap_get でマインドマップの現状を確認すること。' +
      `中心トピックだけ（または空）なら: ${questions}` +
      'トピックが既にあるなら: マップの現状を一言で要約し、次に深掘りしたい枝を1つだけ提案する。' +
      '一度に多くを聞かないこと。以後は毎ターン、対話で言語化できた論点・気づき・選択肢を、' +
      'ユーザーに頼まれなくても mindmap_add_topics でトピック化していくこと' +
      '（親子で構造化し、長い補足は note に。枝をまたぐ関係は mindmap_connect_topics。置いたら一言報告。マップが成果物、チャットは対話）。';
  }, [isAccountBoard]);

  useEffect(() => {
    if (loading) return; // マップ読込後に実行（キックオフが現状を踏まえられるように）
    // ポップアウト中でなければ本体チャットを開く（ポップアウト中はストア側ガードで no-op）。
    useAppStore.getState().setAIChatOpen(true);
    if (mindmapAutoKickedScopes.has(boardScope)) return;
    mindmapAutoKickedScopes.add(boardScope);
    (async () => {
      const { useAIChatStore } = await import('../../store/useAIChatStore');
      const chat = useAIChatStore.getState();
      const sessionIds = new Set(chat.getSessionsForProject(boardScope).map(s => s.id));
      // 既に対話履歴があるスコープでは挨拶し直さない（チャットを開くだけ）
      if (chat.messages.some(m => sessionIds.has(m.sessionId))) return;
      // 自動オープンなのでポップアウト窓のフォーカスは奪わない（focus:false）。
      const { dispatchChatKickoff } = await import('../../features/projects/chat/chatKickoff');
      await dispatchChatKickoff({ projectId: boardScope, source: 'sidebar_chat', text: kickoffText() }, { focus: false });
    })().catch(err => console.error('[mindmap] 自動キックオフに失敗:', err));
  }, [loading, boardScope, kickoffText]);

  /** ノードのクリック: 関係線モードなら「つなぐ」、通常なら選択（Ctrl/Shift で追加選択）。 */
  const clickNode = useCallback((id: string, additive: boolean) => {
    setSelectedRelationId(null);
    if (linkingFrom) {
      if (id !== linkingFrom) addRelation(linkingFrom, id);
      setLinkingFrom(null);
      setSelectedIds([id]);
      return;
    }
    setSelectedIds(cur => (additive
      ? (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id])
      : [id]));
  }, [linkingFrom, addRelation]);

  const patchStyle = useCallback((patch: MindMapStyle) => {
    setStyleState(s => ({ ...s, ...patch }));
  }, []);
  // テーマ・レイアウトは「まとめて効く」プリセット。付随スタイル（形・線）も一緒に入れる。
  const applyTheme = useCallback((key: string) => {
    patchStyle({ theme: key, ...(resolveTheme(key).style ?? {}) });
  }, [patchStyle]);
  const applyLayout = useCallback((key: MindLayoutKey) => {
    patchStyle({ layout: key, ...(MIND_LAYOUTS.find(l => l.key === key)?.style ?? {}) });
  }, [patchStyle]);

  // ─── レイアウト → React Flow ノード/エッジ ──────────────────────────────────
  // Web フォント（Inter / Noto Sans JP）の読み込み前にキャンバス2Dで測ると、
  // フォールバックのフォントの字幅で測ってしまい、実際の描画とずれて折り返しが起きる。
  // 読み込みが終わったら測り直す。
  const [fontsReady, setFontsReady] = useState(() => document.fonts?.status === 'loaded');
  useEffect(() => {
    if (fontsReady || !document.fonts) return;
    let cancelled = false;
    document.fonts.ready.then(() => { if (!cancelled) setFontsReady(true); });
    return () => { cancelled = true; };
  }, [fontsReady]);

  const layout = useMemo(
    () => computeMindLayout(mmNodes, style, theme),
    // fontsReady は計算に渡さないが、字幅が変わるので測り直しの合図として依存に入れる
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mmNodes, style, theme, fontsReady],
  );

  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const n of mmNodes) {
      if (n.parentId == null) continue;
      const list = m.get(n.parentId);
      if (list) list.push(n.id); else m.set(n.parentId, [n.id]);
    }
    return m;
  }, [mmNodes]);

  const summaryGeoms = useMemo(
    () => computeSummaryGeoms(summaries, layout.rects, childrenOf),
    [summaries, layout, childrenOf],
  );

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<AnyRFNode>([]);
  useEffect(() => {
    const next: AnyRFNode[] = [];
    for (const n of mmNodes) {
      const r = layout.rects.get(n.id);
      if (!r) continue; // 折りたたまれた枝の配下は描画しない
      next.push({
        id: n.id, type: 'mind',
        position: { x: r.x, y: r.y },
        data: {
          text: n.text, depth: r.depth, side: r.side, axis: r.axis, color: r.color,
          w: r.w, h: r.h,
          hasChildren: r.hasChildren, childCount: r.childCount,
          collapsed: !!n.collapsed, icons: n.icons,
          image: n.image, imageW: n.imageW, imageH: n.imageH,
          link: n.link, note: n.note,
          refType: n.refType, refId: n.refId, refTitle: n.refTitle,
        },
        draggable: r.depth > 0 && editingId !== n.id,
        // 範囲選択（selectionOnDrag）は React Flow の選択機構を使うので selectable が要る。
        // ただし選択の正は自前の selectedIds で、ここへは「反映」するだけ
        // （トピック一覧はレイアウトから毎回組み直すため、React Flow 側に選択を持たせると
        //   組み直しのたびに消えてしまう）。範囲選択の結果は onSelectionChange で取り込む。
        selectable: true,
        selected: selectedIds.includes(n.id),
        // React Flow は selectable・draggable がどちらも false のノードのインライン style に
        // pointer-events:none を入れる。ここは selectable なので不要だが、
        // まとめノードと条件を揃えて明示しておく。
        style: { pointerEvents: 'all' },
      });
    }
    for (const g of summaryGeoms) {
      next.push({
        id: `sum_${g.id}`, type: 'summary',
        position: { x: g.x, y: g.y },
        data: {
          summaryId: g.id, text: g.text, color: g.color, axis: g.axis, side: g.side,
          regionW: g.regionW, regionH: g.regionH, braceLen: g.braceLen,
          labelW: g.labelW, labelH: g.labelH,
        },
        draggable: false, selectable: false,
        style: { pointerEvents: 'all' },
      });
    }
    setRfNodes(next);
  }, [layout, mmNodes, summaryGeoms, editingId, selectedIds, layoutNonce, setRfNodes]);

  /**
   * 範囲選択（左ドラッグ）の結果を自前の選択へ取り込む。
   * 並びは「最後に選んだもの＝primary」の意味を持つので、既にあるものの順序は保ち、
   * 増えた分だけ末尾に足す。内容が同じなら prev を返して再レンダーを止める
   * （self.selected → React Flow → ここ → self.selected のループを断つ）。
   */
  const onSelectionChange = useCallback(({ nodes }: { nodes: AnyRFNode[] }) => {
    const ids = nodes.filter(n => n.type === 'mind').map(n => n.id);
    setSelectedIds(prev => {
      const set = new Set(ids);
      const next = [...prev.filter(id => set.has(id)), ...ids.filter(id => !prev.includes(id))];
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, []);

  const rfEdges = useMemo<Edge[]>(() => {
    const branches: Edge[] = layout.links.map(l => ({
      id: `e_${l.parent}_${l.child}`,
      source: l.parent, target: l.child, type: 'mind',
      sourceHandle: layout.axis === 'h' ? (l.side === 1 ? 'sr' : 'sl') : (l.side === 1 ? 'sb' : 'st'),
      targetHandle: layout.axis === 'h' ? (l.side === 1 ? 'tl' : 'tr') : (l.side === 1 ? 'tt' : 'tb'),
      data: { color: l.color, lineStyle: style.lineStyle, lineWidth: style.lineWidth, axis: layout.axis },
    }));
    // 関係線は木と無関係に引けるので、2ノードの位置関係から近い辺どうしを選んで結ぶ
    const rels: Edge[] = relations.flatMap(r => {
      const a = layout.rects.get(r.source);
      const b = layout.rects.get(r.target);
      if (!a || !b) return []; // どちらかが折りたたみの中なら描かない
      const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
      const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
      const horiz = Math.abs(dx) >= Math.abs(dy);
      return [{
        id: `rel_${r.id}`,
        source: r.source, target: r.target, type: 'mindRelation',
        sourceHandle: horiz ? (dx > 0 ? 'sr' : 'sl') : (dy > 0 ? 'sb' : 'st'),
        targetHandle: horiz ? (dx > 0 ? 'tl' : 'tr') : (dy > 0 ? 'tt' : 'tb'),
        data: { relationId: r.id, text: r.text ?? '' },
        zIndex: 10,
        markerEnd: { type: MarkerType.ArrowClosed, color: RELATION_COLOR, width: 14, height: 14 },
      }];
    });
    return [...branches, ...rels];
  }, [layout, relations, style.lineStyle, style.lineWidth]);

  // レイアウトの形を変えたら全体を見渡せる位置へ
  useEffect(() => {
    const t = window.setTimeout(() => { try { fitView({ maxZoom: 1, duration: 350 }); } catch { /* noop */ } }, 60);
    return () => window.clearTimeout(t);
  }, [style.layout, fitView]);

  // 兄弟挿入のインジケーター（基準トピックの前/後の隙間に置く線。フロー座標）
  const dropIndicator = useMemo(() => {
    if (dropPlan?.type !== 'sibling') return null;
    const r = layout.rects.get(dropPlan.refId);
    if (!r) return null;
    if (r.axis === 'h') {
      // 横レイアウト: 兄弟は縦に並ぶ → 水平線。枝の付け根側の辺に揃える
      const len = Math.max(64, r.w);
      return {
        x: r.side === 1 ? r.x : r.x + r.w - len,
        y: (dropPlan.before ? r.y - style.vGap / 2 : r.y + r.h + style.vGap / 2) - 1.5,
        w: len, h: 3,
      };
    }
    // 縦レイアウト（組織図）: 兄弟は横に並ぶ → 垂直線
    const len = Math.max(48, r.h);
    return {
      x: (dropPlan.before ? r.x - style.hGap / 2 : r.x + r.w + style.hGap / 2) - 1.5,
      y: r.side === 1 ? r.y : r.y + r.h - len,
      w: 3, h: len,
    };
  }, [dropPlan, layout, style.vGap, style.hGap]);

  // ─── ドラッグでトピックを動かす（子に付け替え / 兄弟の並び替え / 階層の上げ下げ）──
  const dragSubtreeRef = useRef<Set<string>>(new Set());
  const dropPlanRef = useRef<DropPlan | null>(null);

  const onNodeDragStart = useCallback((_: MouseEvent | TouchEvent, node: AnyRFNode) => {
    if (node.type !== 'mind') return;
    dragSubtreeRef.current = collectSubtree(node.id, mmRef.current);
    dropPlanRef.current = null;
  }, [collectSubtree]);

  const onNodeDrag = useCallback((_: MouseEvent | TouchEvent, node: AnyRFNode) => {
    if (node.type !== 'mind') return;
    const cx = node.position.x + node.data.w / 2;
    const cy = node.position.y + node.data.h / 2;
    const rootId0 = mmRef.current.find(n => n.parentId == null)?.id ?? null;

    let plan: DropPlan | null = null;
    // 1) トピックに重ねている → そのトピックの子にする
    for (const [id, r] of layout.rects) {
      if (dragSubtreeRef.current.has(id)) continue;
      if (cx >= r.x - 8 && cx <= r.x + r.w + 8 && cy >= r.y - 8 && cy <= r.y + r.h + 8) {
        plan = { type: 'child', parentId: id };
        break;
      }
    }
    // 2) トピックの外だが近くにいる → 最寄りトピックの兄弟として挿入
    //    （前/後は交差軸＝兄弟が並ぶ方向のどちら側かで決める）。ルートは兄弟を持てないので除外。
    if (!plan) {
      let best: { id: string; dist: number } | null = null;
      for (const [id, r] of layout.rects) {
        if (dragSubtreeRef.current.has(id) || id === rootId0) continue;
        const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w));
        const dy = Math.max(r.y - cy, 0, cy - (r.y + r.h));
        const dist = Math.hypot(dx, dy);
        if (dist < (best?.dist ?? SIBLING_SNAP_DIST)) best = { id, dist };
      }
      if (best) {
        const r = layout.rects.get(best.id)!;
        const before = r.axis === 'h' ? cy < r.y + r.h / 2 : cx < r.x + r.w / 2;
        plan = { type: 'sibling', refId: best.id, before };
      }
    }

    dropPlanRef.current = plan;
    setDropPlanState(p => (dropPlanEq(p, plan) ? p : plan));
    const childTarget = plan?.type === 'child' ? plan.parentId : null;
    setDropTargetId(t => (t === childTarget ? t : childTarget));
  }, [layout]);

  /**
   * ドロップの受け口。落とした位置のトピックに、Drive 画像は「貼る」、
   * 知識は「子トピックとして取り込む」、OS のファイルはアップロードして貼る。
   * トピックの上でなければ何もしない。
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const flow = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    let hit: string | null = null;
    for (const [id, r] of layout.rects) {
      if (flow.x >= r.x && flow.x <= r.x + r.w && flow.y >= r.y && flow.y <= r.y + r.h) { hit = id; break; }
    }
    if (!hit) return;
    const knowledge = e.dataTransfer.getData(KNOWLEDGE_DND_TYPE);
    if (knowledge) {
      try { addKnowledgeChildren(hit, JSON.parse(knowledge) as KnowledgePick[]); } catch { /* 壊れたペイロードは無視 */ }
      return;
    }
    const driveUrl = e.dataTransfer.getData(DRIVE_IMAGE_DND_TYPE);
    if (driveUrl) { attachImage(hit, driveUrl); return; }
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(hit, file);
  }, [screenToFlowPosition, layout, attachImage, handleImageFile, addKnowledgeChildren]);

  const onNodeDragStop = useCallback((_: MouseEvent | TouchEvent, node: AnyRFNode) => {
    if (node.type !== 'mind') return;
    const plan = dropPlanRef.current;
    dropPlanRef.current = null;
    setDropPlanState(null);
    setDropTargetId(null);
    dragSubtreeRef.current = new Set();

    const finish = () => setLayoutNonce(v => v + 1); // レイアウト座標へスナップバック
    const dragged = mmRef.current.find(n => n.id === node.id);
    if (!dragged || !plan) { finish(); return; }

    // プランから移動先（親・rank）を確定する
    let newParent: string;
    let newRank: number;
    if (plan.type === 'child') {
      newParent = plan.parentId;
      const siblings = mmRef.current.filter(n => n.parentId === newParent && n.id !== node.id);
      newRank = siblings.length ? Math.max(...siblings.map(s => s.rank)) + 1 : 0;
    } else {
      const ref = mmRef.current.find(n => n.id === plan.refId);
      if (!ref || ref.parentId == null) { finish(); return; }
      newParent = ref.parentId;
      // 自分を除いた並びの中で、ref の前/後に入る rank を採る（間は中間値）
      const siblings = mmRef.current
        .filter(n => n.parentId === newParent && n.id !== node.id)
        .sort((a, b) => a.rank - b.rank || a.createdAt.localeCompare(b.createdAt));
      const idx = siblings.findIndex(s => s.id === plan.refId);
      if (idx < 0) { finish(); return; }
      if (plan.before) {
        const prev = siblings[idx - 1];
        newRank = prev ? (prev.rank + ref.rank) / 2 : ref.rank - 1;
      } else {
        const next = siblings[idx + 1];
        newRank = next ? (ref.rank + next.rank) / 2 : ref.rank + 1;
      }
    }

    const now = new Date().toISOString();
    const parentChanged = dragged.parentId !== newParent;
    setMmNodes(nds => nds.map(n => {
      if (n.id === node.id) return { ...n, parentId: newParent, rank: newRank, updatedAt: now };
      if (plan.type === 'child' && n.id === newParent && n.collapsed) return { ...n, collapsed: false, updatedAt: now };
      return n;
    }));
    // 親が変わると「同じ親の兄弟をくくる」前提が崩れるので、まとめから外す
    // （同じ親の中の並び替えなら、まとめの一員のまま）
    if (parentChanged) {
      setSummaries(ss => ss
        .map(s => (s.nodeIds.includes(node.id) ? { ...s, nodeIds: s.nodeIds.filter(i => i !== node.id) } : s))
        .filter(s => s.nodeIds.length > 0));
    }
    finish();
  }, []);

  // ─── キーボード操作 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
        e.preventDefault();
        if (e.key.toLowerCase() === 'y' || e.shiftKey) redo(); else undo();
        return;
      }
      if (editingId || editingSummaryId || editingRelationId) return; // 編集中は textarea 側で処理
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

      if (e.key === 'Escape' && linkingFrom) { e.preventDefault(); setLinkingFrom(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedRelationId) {
        e.preventDefault(); deleteRelation(selectedRelationId); return;
      }
      if (!primaryId) return;
      if (e.key === 'Tab') { e.preventDefault(); addChild(primaryId); }
      // Enter=同じ階層 / Tab=子トピック（GitMind と同じ割り当て）。
      // 新しいトピックは即編集に入るので、Enter 連打で同じ階層に並べていける。
      else if (e.key === 'Enter') { e.preventDefault(); addSibling(primaryId); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      else if (e.key === 'F2') { e.preventDefault(); beginEdit(primaryId); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    primaryId, editingId, editingSummaryId, editingRelationId, linkingFrom, selectedRelationId,
    addChild, addSibling, deleteSelected, deleteRelation, beginEdit, undo, redo,
  ]);

  // ─── コンテキスト ────────────────────────────────────────────────────────────
  const ctxValue = useMemo<MindCtxValue>(() => ({
    selectedIds, editingId, dropTargetId, linkingFrom, style, theme,
    beginEdit, endEdit,
    patchText: (id, text) => patchNode(id, { text }),
    toggleCollapse, addChild, clickNode, openNote, openPreview,
    editingSummaryId, beginEditSummary, endEditSummary, patchSummaryText, deleteSummary,
    selectedRelationId, editingRelationId,
    selectRelation: setSelectedRelationId,
    beginEditRelation, endEditRelation, patchRelationText, deleteRelation,
  }), [
    selectedIds, editingId, dropTargetId, linkingFrom, style, theme,
    beginEdit, endEdit, patchNode, toggleCollapse, addChild, clickNode, openNote, openPreview,
    editingSummaryId, beginEditSummary, endEditSummary, patchSummaryText, deleteSummary,
    selectedRelationId, editingRelationId, beginEditRelation, endEditRelation, patchRelationText, deleteRelation,
  ]);

  const primaryNode = useMemo(() => mmNodes.find(n => n.id === primaryId) ?? null, [mmNodes, primaryId]);
  const previewNode = useMemo(() => mmNodes.find(n => n.id === previewId) ?? null, [mmNodes, previewId]);
  // 記事プレビューは正本（users/{uid}/blogArticles）から本文を読むので所有者 uid が要る
  const uid = useAuthStore(s => s.currentUser?.uid);

  const toolButtonSx = {
    px: 1.25, py: 0.5, fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 2,
    color: 'var(--brand-fg)', bgcolor: 'var(--brand-surface)',
    border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    '&:hover': { borderColor: '#00BFFF', bgcolor: 'var(--brand-surface)' },
    '&:disabled': { color: 'rgb(var(--brand-fg-rgb) / 0.3)' },
  } as const;

  return (
    <MindCtx.Provider value={ctxValue}>
      <Box
        // 右ドラッグ＝画面移動にするため、ブラウザ既定の右クリックメニューを抑止する
        // （React Flow はペイン上では自前で抑止するが、ノードの上は対象外）。
        onContextMenu={e => e.preventDefault()}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        sx={{
          position: 'absolute', inset: 0,
          bgcolor: background.color ?? 'transparent',
          // 範囲選択の後に React Flow が出す「まとめて動かす」枠は使わない。
          // トピックの座標はレイアウトから導出しているので、これで動かされると
          // 枝の付け替え処理を通さずに位置だけがずれてしまう（選択の見た目は各トピック側が持つ）。
          '& .react-flow__nodesselection': { display: 'none' },
          '& .react-flow__controls': {
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
          },
          '& .react-flow__controls-button': {
            bgcolor: 'var(--brand-surface)',
            borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
            width: 28, height: 28,
            '& svg': { fill: 'rgb(var(--brand-fg-rgb) / 0.6)', maxWidth: 12, maxHeight: 12 },
            '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', '& svg': { fill: '#00BFFF' } },
          },
        }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          nodeTypes={mindNodeTypes}
          edgeTypes={mindEdgeTypes}
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => {
            setSelectedIds([]);
            setSelectedRelationId(null);
            setLinkingFrom(null);
            if (editingId) endEdit();
          }}
          nodesConnectable={false}
          // ノード画面と同じ操作感に揃える: 左ドラッグ＝範囲選択 / 右ドラッグ＝画面移動。
          // 範囲選択はペイン上で始めたときだけ働くので、トピックの左ドラッグ（＝移動）とは競合しない。
          selectionOnDrag
          // Partial: 枠に少しでも重なったトピックを選ぶ（既定の Full は枠が完全に囲んだものだけ）。
          selectionMode={SelectionMode.Partial}
          panOnDrag={[2]}
          // false: トピックのドラッグ開始時に選択状態を書き換えない。未選択のトピックも
          // 「選択→再ドラッグ」の二手を踏まず、一度の左ドラッグでそのまま掴んで動かせる。
          selectNodesOnDrag={false}
          multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
          onSelectionChange={onSelectionChange}
          zoomOnDoubleClick={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          minZoom={0.1}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          {background.variant !== 'none' && (
            <Background variant={BG_VARIANT[background.variant]} gap={22} size={1.5}
              color="rgb(var(--brand-fg-rgb) / 0.14)" />
          )}

          {/* ドラッグ中の挿入位置インジケーター（兄弟の隙間に入る線） */}
          {dropIndicator && (
            <ViewportPortal>
              <Box sx={{
                position: 'absolute', pointerEvents: 'none',
                left: dropIndicator.x, top: dropIndicator.y,
                width: dropIndicator.w, height: dropIndicator.h,
                bgcolor: '#00BFFF', borderRadius: '2px',
                boxShadow: '0 0 8px rgba(0,191,255,0.9)',
              }} />
            </ViewportPortal>
          )}

          <Controls showInteractive={false} />
          <MiniMap
            position="bottom-right"
            pannable zoomable
            nodeColor={n => ((n.data as { color?: string })?.color ?? '#888')}
            nodeStrokeColor="transparent"
            nodeBorderRadius={3}
            maskColor="rgb(var(--brand-fg-rgb) / 0.12)"
            style={{
              width: 180, height: 120,
              backgroundColor: 'var(--brand-surface)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
              borderRadius: 8,
            }}
          />

          <Panel position="top-left">
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button startIcon={<SubdirectoryArrowRightRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                disabled={!primaryId}
                onClick={() => primaryId && addChild(primaryId)}>
                子トピック
              </Button>
              <Button startIcon={<AddRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                disabled={!primaryId || primaryId === rootId}
                onClick={() => primaryId && addSibling(primaryId)}>
                同じ階層
              </Button>
              <Button startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                disabled={!selectedIds.some(id => id !== rootId)}
                onClick={deleteSelected}>
                削除
              </Button>

              {/* ── 選択中のトピックに挿入する（ノード画面のツールバーと同じ並び）── */}
              <Box sx={{ width: '1px', height: 20, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', mx: 0.25 }} />
              <Tooltip title="選んだトピックに補足メモを付ける">
                <span>
                  <Button startIcon={<StickyNote2OutlinedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                    disabled={!primaryId}
                    onClick={() => primaryId && openNote(primaryId)}>
                    メモ
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="選んだトピックに画像を貼る（トピックへドラッグ&ドロップでも貼れます）">
                <span>
                  <Button
                    startIcon={uploading
                      ? <CircularProgress size={13} sx={{ color: '#00BFFF' }} />
                      : <ImageOutlinedIcon sx={{ fontSize: 15 }} />}
                    sx={toolButtonSx} disabled={!primaryId || uploading}
                    onClick={() => fileInputRef.current?.click()}>
                    画像
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="選んだトピックにリンクを付ける">
                <span>
                  <Button startIcon={<LinkRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                    disabled={!primaryId}
                    onClick={() => primaryId && setLinkDialog({
                      nodeId: primaryId,
                      url: mmNodes.find(n => n.id === primaryId)?.link ?? '',
                    })}>
                    リンク
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="S.Library / S.Blog の知識を子トピックとして取り込む（クリック / トピックへドラッグ）">
                <span>
                  <Button startIcon={<LocalLibraryRoundedIcon sx={{ fontSize: 15 }} />}
                    sx={{ ...toolButtonSx, ...(rightPane === 'knowledge' ? { borderColor: '#00BFFF', color: '#00BFFF' } : {}) }}
                    onClick={() => toggleRightPane('knowledge')}>
                    知識
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="SEKKEIYA Drive の画像をトピックに貼る">
                <span>
                  <Button startIcon={<CloudOutlinedIcon sx={{ fontSize: 15 }} />}
                    sx={{ ...toolButtonSx, ...(rightPane === 'drive' ? { borderColor: '#00BFFF', color: '#00BFFF' } : {}) }}
                    onClick={() => toggleRightPane('drive')}>
                    Drive
                  </Button>
                </span>
              </Tooltip>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', mx: 0.25 }} />

              <Tooltip title="選んだトピック（同じ階層の兄弟）を波括弧でくくり、要約を書く。Ctrl+クリックで複数選択">
                <span>
                  <Button startIcon={<DataObjectRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
                    disabled={!canSummarize}
                    onClick={addSummary}>
                    まとめる
                  </Button>
                </span>
              </Tooltip>
              <Tooltip title="選んだトピックから、別のトピックへ関係の矢印を引く">
                <span>
                  <Button startIcon={<ArrowRightAltRoundedIcon sx={{ fontSize: 17 }} />}
                    sx={{ ...toolButtonSx, ...(linkingFrom ? { borderColor: RELATION_COLOR, color: RELATION_COLOR } : {}) }}
                    disabled={!primaryId && !linkingFrom}
                    onClick={() => setLinkingFrom(cur => (cur ? null : primaryId))}>
                    関係線
                  </Button>
                </span>
              </Tooltip>

              <Button startIcon={<PaletteOutlinedIcon sx={{ fontSize: 15 }} />}
                sx={{ ...toolButtonSx, ...(rightPane === 'style' ? { borderColor: '#00BFFF', color: '#00BFFF' } : {}) }}
                onClick={() => toggleRightPane('style')}>
                スタイル
              </Button>
              {loading && <CircularProgress size={14} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', ml: 0.5 }} />}
            </Box>

            {linkingFrom ? (
              <Typography sx={{
                mt: 0.75, px: 1, py: 0.4, fontSize: 11, fontWeight: 700, borderRadius: 1.5, display: 'inline-block',
                color: RELATION_COLOR, bgcolor: `${RELATION_COLOR}1f`, border: `1px solid ${RELATION_COLOR}66`,
              }}>
                関係線: つなげたいトピックをクリック（Escape でやめる）
              </Typography>
            ) : (
              <Typography sx={{ mt: 0.75, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
                クリックで選択・Ctrl+クリックで複数選択・左ドラッグで範囲選択 / Enter: 同じ階層 / Tab: 子トピック / ダブルクリック: 編集（編集中は Shift+Enter・Ctrl+Enter で改行） / Delete: 枝ごと削除 / トピックをドラッグ: 移動（重ねて子に・隙間に入れて並び替え） / 右ドラッグで画面移動 / Ctrl+Zで戻す
              </Typography>
            )}
            {saveError && (
              <Typography onClick={flushSave} sx={{
                mt: 0.5, px: 1, py: 0.4, fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 1.5,
                color: '#f87171', bgcolor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)',
                display: 'inline-block',
              }}>
                ⚠ マインドマップの保存に失敗しました — クリックで再試行
              </Typography>
            )}
          </Panel>
        </ReactFlow>

        {rightPane === 'style' && (
          <RightPanel
            tab={panelTab}
            setTab={setPanelTab}
            style={style}
            theme={theme}
            patchStyle={patchStyle}
            applyTheme={applyTheme}
            applyLayout={applyLayout}
            selectedNode={primaryNode}
            patchNodeColor={(id, color) => patchNode(id, { color })}
            toggleIcon={toggleIcon}
            onClose={() => setRightPane('none')}
          />
        )}

        <DriveAssetSidebar
          open={rightPane === 'drive'}
          onClose={() => setRightPane('none')}
          onPick={url => { if (primaryId) attachImage(primaryId, url); }}
        />

        <KnowledgeSidebar
          open={rightPane === 'knowledge'}
          onClose={() => setRightPane('none')}
          // クリック時: 選択中トピック（未選択なら中心トピック）の子に取り込む
          onPick={items => {
            const parent = primaryId ?? rootId;
            if (parent) addKnowledgeChildren(parent, items);
          }}
        />

        <input ref={fileInputRef} type="file" accept="image/*" hidden
          onChange={e => {
            const f = e.target.files?.[0];
            if (f && primaryId) handleImageFile(primaryId, f);
            e.target.value = '';
          }} />

        {/* サムネのダブルクリック → 中身のプレビュー（記事は本文、それ以外は画像を大きく） */}
        <Dialog open={!!previewNode} onClose={() => setPreviewId(null)}
          maxWidth={false}
          PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible', m: 2 } }}>
          {previewNode && (previewNode.refType === 'article' && previewNode.refId && uid ? (
            <ArticlePreview
              articleId={previewNode.refId}
              ownerUid={uid}
              coverUrl={previewNode.image}
              title={previewNode.refTitle ?? previewNode.text}
            />
          ) : (
            <Box sx={{
              width: 'min(900px, 88vw)', maxHeight: '88vh',
              display: 'flex', flexDirection: 'column',
              bgcolor: 'var(--brand-surface)', color: 'var(--brand-fg)',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: 3, overflow: 'hidden',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, flexShrink: 0 }}>
                <Typography sx={{
                  flex: 1, minWidth: 0, fontSize: 13, fontWeight: 800,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {previewNode.refTitle || previewNode.text || '画像'}
                </Typography>
                {previewNode.refType && previewNode.refId && (
                  <Button size="small" startIcon={<LocalLibraryRoundedIcon sx={{ fontSize: 15 }} />}
                    onClick={() => openBoardSource({
                      refType: previewNode.refType, refId: previewNode.refId, url: previewNode.link,
                    })}
                    sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: '#00BFFF' }}>
                    出典を開く
                  </Button>
                )}
                {previewNode.image && (
                  <Button size="small" onClick={() => openExternal(previewNode.image!)}
                    sx={{ fontSize: 11, fontWeight: 700, textTransform: 'none', color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
                    元画像を開く
                  </Button>
                )}
                <IconButton size="small" onClick={() => setPreviewId(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
                  <CloseRoundedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Box sx={{
                flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'light-dark(rgba(15,23,42,0.06), rgba(0,0,0,0.35))', p: 1,
              }}>
                <Box component="img" src={previewNode.image} alt=""
                  sx={{ maxWidth: '100%', maxHeight: 'calc(88vh - 60px)', objectFit: 'contain', display: 'block' }} />
              </Box>
            </Box>
          ))}
        </Dialog>

        {/* リンク: 空で確定すると外す */}
        <Dialog open={!!linkDialog} onClose={() => setLinkDialog(null)} maxWidth="xs" fullWidth
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>トピックにリンクを付ける</DialogTitle>
          <DialogContent sx={{ pt: '12px !important' }}>
            <TextField autoFocus fullWidth size="small" label="URL" placeholder="https://..."
              value={linkDialog?.url ?? ''}
              onChange={e => setLinkDialog(d => (d ? { ...d, url: e.target.value } : d))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitLinkDialog(); } }}
              InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
              InputProps={{ sx: { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
              sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }} />
            <Typography sx={{ mt: 1, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
              空のまま保存すると、リンクを外します。
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setLinkDialog(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
            <Button onClick={commitLinkDialog} variant="contained"
              sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#4facfe' } }}>
              保存
            </Button>
          </DialogActions>
        </Dialog>

        {/* メモ: 空で確定すると外す */}
        <Dialog open={!!noteDialog} onClose={() => setNoteDialog(null)} maxWidth="sm" fullWidth
          PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
          <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>トピックのメモ</DialogTitle>
          <DialogContent sx={{ pt: '12px !important' }}>
            <TextField autoFocus fullWidth multiline minRows={5} size="small"
              placeholder="このトピックの補足・根拠・気づきなど"
              value={noteDialog?.text ?? ''}
              onChange={e => setNoteDialog(d => (d ? { ...d, text: e.target.value } : d))}
              InputProps={{ sx: { color: 'var(--brand-fg)', fontSize: 13, '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
              sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }} />
            <Typography sx={{ mt: 1, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
              空のまま保存すると、メモを外します。
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setNoteDialog(null)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
            <Button onClick={commitNoteDialog} variant="contained"
              sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#4facfe' } }}>
              保存
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </MindCtx.Provider>
  );
};

/** GitMind 風マインドマップエディタ。boardKey のボード doc（mindmap フィールド）を編集する。 */
export const MindMapCanvas: React.FC<Props> = ({ boardKey }) => (
  <ReactFlowProvider key={boardKey}>
    <MindMapInner boardKey={boardKey} />
  </ReactFlowProvider>
);

export default MindMapCanvas;
