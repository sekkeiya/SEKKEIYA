import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Panel,
  useNodesState, useEdgesState, useReactFlow, useUpdateNodeInternals, useNodes, useStore,
  Handle, Position, MarkerType, ConnectionMode,
  BaseEdge, EdgeLabelRenderer,
  type Node, type NodeProps, type Edge, type EdgeProps, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Box, Typography, Button, IconButton, InputBase, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, Tooltip,
} from '@mui/material';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import LocalLibraryRoundedIcon from '@mui/icons-material/LocalLibraryRounded';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import UnfoldLessRoundedIcon from '@mui/icons-material/UnfoldLessRounded';
import UnfoldMoreRoundedIcon from '@mui/icons-material/UnfoldMoreRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useAppStore } from '../../store/useAppStore';
import {
  ResearchCanvasRepository,
  ACCOUNT_BOARD_ID,
  parseBoardKey,
  type ResearchCanvasItem,
  type ResearchCanvasEdge,
  type ResearchNodeRole,
  type ResearchCardPort,
  type ResearchPortSide,
} from '../../features/projects/repositories/ResearchCanvasRepository';
import { registerResearchBoardHost, RESEARCH_BOARD_CHANGED_EVENT } from '../../features/projects/chat/researchBoardBridge';
import { isTauri } from '../../lib/platform';
import { KnowledgePickerDialog } from './KnowledgePickerDialog';
import { DriveAssetSidebar, DRIVE_IMAGE_DND_TYPE } from './DriveAssetSidebar';
import {
  useConnectorStore, useConnectors, getConnector, DEFAULT_CONNECTOR_KEY, CONNECTOR_COLOR_CHOICES,
} from '../../store/useConnectorStore';

// ─── 定数 ─────────────────────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, { bg: string; border: string }> = {
  yellow: { bg: 'light-dark(#fef9c3, #3a3520)', border: 'light-dark(#eab308, #a1861f)' },
  blue:   { bg: 'light-dark(#dbeafe, #1e2a3f)', border: 'light-dark(#3b82f6, #3b6bb6)' },
  pink:   { bg: 'light-dark(#fce7f3, #3a2231)', border: 'light-dark(#ec4899, #b0487f)' },
  green:  { bg: 'light-dark(#dcfce7, #1f3527)', border: 'light-dark(#22c55e, #2f8a52)' },
};
const DEFAULT_NOTE_COLOR = 'yellow';

/**
 * タブを開いたときの自動キックオフを1アプリセッション=1プロジェクト1回に抑えるガード。
 * （タブの出入りで毎回AIが挨拶し直すのを防ぐ。アプリ再起動でリセットされる）
 */
const autoKickedProjects = new Set<string>();

// エッジの関係ラベル（接続詞）は useConnectorStore で管理（ビルトイン＋ユーザーのカスタム）。
// getConnector(key) で色/ラベルを解決、useConnectors() で React 追従の一覧を得る。

/** カードの役割（根拠 → 解釈 → 結論）。エッジで編む論証グラフの階層。 */
const NODE_ROLES: Record<ResearchNodeRole, { label: string; color: string }> = {
  evidence:       { label: '根拠', color: '#26a69a' },
  interpretation: { label: '解釈', color: '#a18cd1' },
  conclusion:     { label: '結論', color: '#ffb74d' },
};

// ─── ロジックの地図（レーン整列）定数 ─────────────────────────────────────────
// 「表示モード」の一つ。役割＝横位置（根拠→解釈→結論の3レーン）、テーマ（連結成分）＝縦の帯、
// で意味に沿ってカードを自動配置し、座標そのものが論証の筋道を語る"地図"にする。
// 保存座標は書き換えず、表示コピーにだけ適用する（自由配置に戻すと元の手置きが残る）。
const MAP_COL_LEFT = [0, 380, 760];  // 根拠 / 解釈 / 結論 レーンの左端X
const MAP_LANE_W = 320;
const MAP_ROW_H = 168;               // カード1枚分の縦ピッチ
const MAP_BAND_GAP = 56;             // テーマ帯どうしの縦間隔
const MAP_HEADER_H = 52;             // レーン上部のラベル帯
const MAP_NOMINAL_W: Record<string, number> = { note: 240, quote: 280, image: 280, link: 260, source: 260 };
const MAP_LANE_META: Array<{ role: ResearchNodeRole; label: string; color: string }> = [
  { role: 'evidence',       label: '根拠 — 素材・記事',   color: '#26a69a' },
  { role: 'interpretation', label: '解釈 — 本PJでの意味', color: '#a18cd1' },
  { role: 'conclusion',     label: '結論 — コンセプト',   color: '#ffb74d' },
];

/** キャンバスの表示モード。free=手置きのまま / map=論証の地図（レーン整列）。 */
type BoardViewMode = 'free' | 'map';

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

/** Tauri では window.open が効かないため plugin-opener を使う（Web はフォールバック） */
function openExternal(url: string) {
  import('@tauri-apps/plugin-opener')
    .then(({ openUrl }) => { if (openUrl) openUrl(url); else window.open(url, '_blank'); })
    .catch(() => window.open(url, '_blank'));
}

/**
 * 引用/ソースカードの出典を開く（トレーサビリティの担保）。
 * library → S.Library を前面に出して該当エントリを選択、article → S.Blog エディタで開く。
 * アプリ内で辿れないときは元URLへフォールバック。
 */
async function openBoardSource(item: ResearchCanvasItem) {
  try {
    if (item.refType === 'library' && item.refId) {
      const { useAppStore } = await import('../../store/useAppStore');
      const s = useAppStore.getState() as any;
      if (s.pinnedTabIds && !s.pinnedTabIds.includes('3dsk')) s.togglePinnedTab?.('3dsk');
      s.setActiveWorkspaceId?.('library');
      s.setLastActiveAppScope?.('3dsk');
      s.setCurrentMainView?.('workspace');
      const { useDskStore } = await import('../../features/dsk/store/useDskStore');
      const dsk = useDskStore.getState();
      if (dsk.entries.length === 0) await dsk.refresh();
      dsk.setSelectedId(item.refId);
      return;
    }
    if (item.refType === 'article' && item.refId) {
      const { useAuthStore } = await import('../../store/useAuthStore');
      const uid = (useAuthStore.getState().currentUser as any)?.uid as string | undefined;
      if (!uid) return;
      const { useAppStore } = await import('../../store/useAppStore');
      const s = useAppStore.getState() as any;
      s.setActiveWorkspaceId?.('blog');
      s.setLastActiveAppScope?.('3dsb');
      s.setCurrentMainView?.('workspace');
      const { useDsbStore } = await import('../../features/dsb/store/useDsbStore');
      const dsb = useDsbStore.getState();
      await dsb.refresh(uid);
      dsb.startEdit(item.refId);
      return;
    }
    if (item.url) openExternal(item.url);
  } catch (e) {
    console.error('[research] 出典を開けませんでした:', e);
    if (item.url) openExternal(item.url);
  }
}

// ─── ノード → アイテム相互変換 ────────────────────────────────────────────────

type CanvasNode = Node<{ item: ResearchCanvasItem }>;
/** dimmed=経路ハイライト時の減光 / hovered=ホバー中の強調。表示コピーにだけ乗せる（非永続）。 */
type CanvasEdge = Edge<{ edge: ResearchCanvasEdge; dimmed?: boolean; hovered?: boolean }>;

function itemToNode(item: ResearchCanvasItem): CanvasNode {
  return { id: item.id, type: item.kind, position: { x: item.x, y: item.y }, data: { item } };
}

function nodesToItems(nodes: CanvasNode[]): ResearchCanvasItem[] {
  return nodes.map(n => ({ ...n.data.item, x: n.position.x, y: n.position.y }));
}

function edgeToRf(edge: ResearchCanvasEdge): CanvasEdge {
  const rel = getConnector(edge.relation);
  return {
    id: edge.id, source: edge.source, target: edge.target, type: 'relation',
    // 四辺ハンドル化に伴い、辺未指定のエッジ（既存保存分・AI作成分）は既定で右→左に付ける
    // （＝従来の左→右の流れ）。手動接続は保存された辺を使う。
    sourceHandle: edge.sourceHandle ?? 'right',
    targetHandle: edge.targetHandle ?? 'left',
    data: { edge },
    markerEnd: { type: MarkerType.ArrowClosed, color: rel.color, width: 16, height: 16 },
  };
}

function rfToEdgeItems(edges: CanvasEdge[]): ResearchCanvasEdge[] {
  return edges.map(e => (e.data as { edge: ResearchCanvasEdge }).edge);
}

// ─── ロジックの地図: レーンレイアウト計算（純関数・表示コピー専用） ────────────
// 役割→列（未設定はエッジの向きから推定）、連結成分→テーマ帯、で座標を決める。
// 「根拠→解釈→結論」が左→右に、同じ論点でつながったカード群が同じ横帯に並ぶことで、
// 膨大な素材が一つのコンセプトに収束していく漏斗が、配置そのものから読める状態を作る。

interface LaneLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  laneHeight: number;
  totalWidth: number;
  tray: { top: number; height: number } | null;
}

function computeLaneLayout(nodes: CanvasNode[], edges: Array<{ source: string; target: string }>): LaneLayoutResult {
  const positions = new Map<string, { x: number; y: number }>();
  const totalWidth = MAP_COL_LEFT[2] + MAP_LANE_W;
  if (nodes.length === 0) return { positions, laneHeight: MAP_HEADER_H + MAP_ROW_H, totalWidth, tray: null };

  const byId = new Map(nodes.map(n => [n.id, n]));
  const hasIn = new Set<string>();
  const hasOut = new Set<string>();
  const adj = new Map<string, Set<string>>();
  nodes.forEach(n => adj.set(n.id, new Set()));
  edges.forEach(e => {
    if (!byId.has(e.source) || !byId.has(e.target)) return;
    hasOut.add(e.source); hasIn.add(e.target);
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  });
  const hasEdge = (id: string) => (adj.get(id)?.size ?? 0) > 0;

  // 列（0=根拠 / 1=解釈 / 2=結論）。役割優先、無ければエッジの入次数/出次数で推定。
  const colOf = (n: CanvasNode): number => {
    const role = n.data.item.role;
    if (role === 'evidence') return 0;
    if (role === 'interpretation') return 1;
    if (role === 'conclusion') return 2;
    const i = hasIn.has(n.id), o = hasOut.has(n.id);
    if (o && !i) return 0;
    if (i && !o) return 2;
    return 1;
  };

  // 連結成分（テーマ帯）を無向グラフで抽出
  const compId = new Map<string, number>();
  let nextComp = 0;
  nodes.forEach(n => {
    if (!hasEdge(n.id) || compId.has(n.id)) return;
    const c = nextComp++;
    const stack = [n.id];
    compId.set(n.id, c);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!compId.has(nb)) { compId.set(nb, c); stack.push(nb); }
      }
    }
  });

  // グループキー: 接続あり→成分 / 役割のみ→単独帯 / どちらも無し→未配置トレイ
  const groupKey = (n: CanvasNode): string => {
    if (hasEdge(n.id)) return `c${compId.get(n.id)}`;
    if (n.data.item.role) return `s${n.id}`;
    return 'tray';
  };
  const bandOrder: string[] = [];
  const bands = new Map<string, CanvasNode[]>();
  const tray: CanvasNode[] = [];
  nodes.forEach(n => {
    const k = groupKey(n);
    if (k === 'tray') { tray.push(n); return; }
    if (!bands.has(k)) { bands.set(k, []); bandOrder.push(k); }
    bands.get(k)!.push(n);
  });

  let bandTop = MAP_HEADER_H;
  for (const k of bandOrder) {
    const cols: CanvasNode[][] = [[], [], []];
    bands.get(k)!.forEach(n => cols[colOf(n)].push(n));
    const rows = Math.max(cols[0].length, cols[1].length, cols[2].length, 1);
    cols.forEach((list, ci) => list.forEach((n, ri) => {
      const w = MAP_NOMINAL_W[n.data.item.kind] ?? 240;
      positions.set(n.id, { x: MAP_COL_LEFT[ci] + (MAP_LANE_W - w) / 2, y: bandTop + ri * MAP_ROW_H });
    }));
    bandTop += rows * MAP_ROW_H + MAP_BAND_GAP;
  }
  const laneHeight = Math.max(bandTop - MAP_BAND_GAP, MAP_HEADER_H + MAP_ROW_H);

  // 未配置トレイ（まだ論証に組み込まれていないカード）はレーンの下に横並び
  let trayInfo: { top: number; height: number } | null = null;
  if (tray.length) {
    const perRow = 4;
    const trayTop = laneHeight + 60;
    const colW = totalWidth / perRow;
    tray.forEach((n, i) => {
      const w = MAP_NOMINAL_W[n.data.item.kind] ?? 240;
      positions.set(n.id, {
        x: Math.max(0, (i % perRow) * colW + (colW - w) / 2),
        y: trayTop + 40 + Math.floor(i / perRow) * MAP_ROW_H,
      });
    });
    trayInfo = { top: trayTop, height: 40 + Math.ceil(tray.length / perRow) * MAP_ROW_H };
  }

  return { positions, laneHeight, totalWidth, tray: trayInfo };
}

// ─── コンテキスト（ノード/エッジ内編集 → 親stateへの反映） ─────────────────────

interface CanvasCtx {
  patchItem: (id: string, patch: Partial<ResearchCanvasItem>) => void;
  patchEdge: (id: string, patch: Partial<ResearchCanvasEdge>) => void;
  /** カードの指定辺に接続口を1つ追加し、その新ポートIDを返す。atIndex 指定でその辺の何番目に挿入するか。 */
  addPort: (id: string, side: ResearchPortSide, atIndex?: number) => string;
  /** カードの接続口を1つ削除する（その口につながる配線も除去。最後の1つは残す）。 */
  removePort: (id: string, portId: string) => void;
  /** ポート編集（＋ボタン表示・右クリック削除）を許可するか（自由配置モードのみ true）。 */
  portsEditable: boolean;
  /** コンパクト表示（タイトル/要点だけ）。false=詳細表示（全文）。ボード全体のトグル。 */
  compact: boolean;
}

/** テキストの1行目（コンパクト表示のタイトルとして使う。空なら ''）。 */
function firstLine(text?: string): string {
  const t = (text || '').trim();
  if (!t) return '';
  const nl = t.indexOf('\n');
  return nl === -1 ? t : t.slice(0, nl);
}
const Ctx = createContext<CanvasCtx | null>(null);
const useCanvasCtx = () => useContext(Ctx)!;

// ─── 接続ハンドル（動的ポート。辺ごとに複数の接続口を持てる） ────────────────────
// connectionMode=loose で source ハンドルを接続先にもできる＝どの口からでも双方向に矢印を引ける。
// 辺ホバーで出る「＋」で接続口を増やせる。既定（ports 未設定）は四辺中央に1つずつ。

const SIDE_POSITION: Record<ResearchPortSide, Position> = {
  top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left,
};
const ALL_SIDES: ResearchPortSide[] = ['top', 'right', 'bottom', 'left'];

/** 既定ポート（四辺中央に1つずつ。id は従来のエッジ互換のため辺名そのもの）。 */
function effectivePorts(item: ResearchCanvasItem): ResearchCardPort[] {
  if (item.ports && item.ports.length) return item.ports;
  return ALL_SIDES.map(side => ({ id: side, side }));
}

/** 辺方向に i 番目/全 n 個のポートを均等配置する style。 */
function portStyle(side: ResearchPortSide, i: number, n: number): React.CSSProperties {
  const frac = ((i + 1) / (n + 1)) * 100;
  const base: React.CSSProperties = { width: 10, height: 10, background: 'var(--brand-surface)', border: '2px solid #00BFFF' };
  return side === 'left' || side === 'right' ? { ...base, top: `${frac}%` } : { ...base, left: `${frac}%` };
}

// 操作ボタンは「カードの内側」に寄せる。辺の外側（＝線の端点を掴んで付け替えるゾーン）を
// 空けておくことで、＋ボタンが再接続ドラッグを奪わないようにする。
const CTRL_INSET_ADD = 7;    // 「＋」= 辺のすぐ内側（「−」はポートのすぐ外側＝下の minusBtnSx）

function addBtnSx(side: ResearchPortSide) {
  switch (side) {
    case 'top':    return { top: CTRL_INSET_ADD, left: '50%', ml: '-9px' };
    case 'bottom': return { bottom: CTRL_INSET_ADD, left: '50%', ml: '-9px' };
    case 'left':   return { left: CTRL_INSET_ADD, top: '50%', mt: '-9px' };
    case 'right':  return { right: CTRL_INSET_ADD, top: '50%', mt: '-9px' };
  }
}
/**
 * ポート i（全 n 個）の「−」ボタンを、そのポート（境界上の○）のすぐ外側に置く。
 * ホバー時のみ表示なので外側でも再接続の邪魔にならず、○のそばで「この口を消す」と分かる。
 */
const MINUS_OUTSET = -22; // カード外側へ（右端から22px外＝○のすぐ脇）
function minusBtnSx(side: ResearchPortSide, i: number, n: number) {
  const frac = `${((i + 1) / (n + 1)) * 100}%`;
  switch (side) {
    case 'top':    return { top: MINUS_OUTSET, left: frac, ml: '-8px' };
    case 'bottom': return { bottom: MINUS_OUTSET, left: frac, ml: '-8px' };
    case 'left':   return { left: MINUS_OUTSET, top: frac, mt: '-8px' };
    case 'right':  return { right: MINUS_OUTSET, top: frac, mt: '-8px' };
  }
}
/** 辺中央の「＋」を出すための、見えないホバー領域（辺をホバーしたら＋が現れる）。 */
function sidePadSx(side: ResearchPortSide) {
  switch (side) {
    case 'top':    return { top: 8, left: '50%', ml: '-34px', width: 68, height: 30 };
    case 'bottom': return { bottom: 8, left: '50%', ml: '-34px', width: 68, height: 30 };
    case 'left':   return { left: 8, top: '50%', mt: '-34px', width: 30, height: 68 };
    case 'right':  return { right: 8, top: '50%', mt: '-34px', width: 30, height: 68 };
  }
}

const NodeHandles: React.FC<{ item: ResearchCanvasItem }> = ({ item }) => {
  const { addPort, removePort, portsEditable } = useCanvasCtx();
  const ports = effectivePorts(item);
  // ホバー中の辺（＋を出す）とポート（−を出す）。JS 管理でホバーの隙間による消失を防ぐ。
  const [hover, setHover] = useState<{ side: ResearchPortSide | null; port: string | null }>({ side: null, port: null });
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enter = (h: { side: ResearchPortSide; port: string | null }) => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setHover(h);
  };
  // 辺ホバー: その辺を対象にする（ポートの−表示状態は保持したまま＋を出す）
  const enterSide = (side: ResearchPortSide) => {
    if (clearRef.current) clearTimeout(clearRef.current);
    setHover(prev => ({ side, port: prev.port }));
  };
  const scheduleClear = () => {
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setHover({ side: null, port: null }), 120);
  };
  useEffect(() => () => { if (clearRef.current) clearTimeout(clearRef.current); }, []);

  const ctrlBaseSx = {
    position: 'absolute' as const,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'opacity .12s, transform .12s',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
    '&:hover': { transform: 'scale(1.15)' },
  };

  return (
    <>
      {ALL_SIDES.map(side => {
        const list = ports.filter(p => p.side === side);
        return (
          <React.Fragment key={side}>
            {/* 辺中央の見えないホバー領域。ここに触れると「＋」が現れる（辺をホバーで追加）。
                ハンドルより前に置き、z を持たせないことで接続口(ハンドル)のドラッグは妨げない。 */}
            {portsEditable && (
              <Box
                className="nodrag nopan"
                onMouseEnter={() => enterSide(side)}
                onMouseLeave={scheduleClear}
                sx={{ position: 'absolute', ...sidePadSx(side) }}
              />
            )}
            {list.map((p, i) => {
              const showMinus = portsEditable && hover.port === p.id;
              return (
                <React.Fragment key={p.id}>
                  <Handle
                    id={p.id} type="source" position={SIDE_POSITION[side]} style={portStyle(side, i, list.length)}
                    onMouseEnter={portsEditable ? () => enter({ side, port: p.id }) : undefined}
                    onMouseLeave={portsEditable ? scheduleClear : undefined}
                    // 右クリックでも接続口を削除できる（「−」ボタンと同機能）
                    onContextMenu={portsEditable ? (e => { e.preventDefault(); e.stopPropagation(); removePort(item.id, p.id); }) : undefined}
                  />
                  {portsEditable && (
                    <Box
                      className="nodrag nopan"
                      onMouseEnter={() => enter({ side, port: p.id })}
                      onMouseLeave={scheduleClear}
                      onClick={e => { e.stopPropagation(); removePort(item.id, p.id); }}
                      title="この接続口を削除"
                      sx={{
                        ...ctrlBaseSx, ...minusBtnSx(side, i, list.length),
                        width: 16, height: 16, borderRadius: '50%',
                        bgcolor: 'light-dark(#e53950, #fa5a72)', color: '#fff', zIndex: 7,
                        opacity: showMinus ? 1 : 0, pointerEvents: showMinus ? 'auto' : 'none',
                      }}
                    >
                      <RemoveRoundedIcon sx={{ fontSize: 12 }} />
                    </Box>
                  )}
                </React.Fragment>
              );
            })}
            {portsEditable && (() => {
              const showAdd = hover.side === side;
              return (
                <Box
                  className="nodrag nopan"
                  onMouseEnter={() => enterSide(side)}
                  onMouseLeave={scheduleClear}
                  onClick={e => { e.stopPropagation(); addPort(item.id, side); }}
                  title="接続口を増やす"
                  sx={{
                    ...ctrlBaseSx, ...addBtnSx(side),
                    width: 18, height: 18, borderRadius: '50%',
                    bgcolor: '#00BFFF', color: '#000', zIndex: 6,
                    opacity: showAdd ? 1 : 0, pointerEvents: showAdd ? 'auto' : 'none',
                  }}
                >
                  <AddRoundedIcon sx={{ fontSize: 13 }} />
                </Box>
              );
            })()}
          </React.Fragment>
        );
      })}
    </>
  );
};

/** カード上部に出す役割バッジ（根拠/解釈/結論）。 */
const RoleBadge: React.FC<{ role?: ResearchNodeRole }> = ({ role }) => {
  if (!role || !NODE_ROLES[role]) return null;
  const r = NODE_ROLES[role];
  return (
    <Box sx={{
      alignSelf: 'flex-start', mb: 0.5, px: 0.7, py: 0.1, borderRadius: 1,
      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', lineHeight: 1.6,
      color: r.color, border: `1px solid ${r.color}`, opacity: 0.9,
    }}>
      {r.label}
    </Box>
  );
};

// ─── 付箋ノード ───────────────────────────────────────────────────────────────

const NoteNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { patchItem, compact } = useCanvasCtx();
  const item = (data as any).item as ResearchCanvasItem;
  const tone = NOTE_COLORS[item.color || DEFAULT_NOTE_COLOR] || NOTE_COLORS[DEFAULT_NOTE_COLOR];
  const [editing, setEditing] = useState(!item.text);
  const [draft, setDraft] = useState(item.text || '');

  const commit = () => {
    setEditing(false);
    if (draft !== item.text) patchItem(id, { text: draft });
  };

  // コンパクト表示: 1行目をタイトルとして1行だけ（ダブルクリックで詳細編集に展開）
  if (compact && !editing) {
    const title = firstLine(item.text);
    return (
      <Box
        onDoubleClick={() => { setDraft(item.text || ''); setEditing(true); }}
        sx={{
          width: 240, p: 1, borderRadius: 2, boxSizing: 'border-box',
          bgcolor: tone.bg,
          border: '1px solid', borderColor: selected ? '#00BFFF' : tone.border,
          boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex', alignItems: 'center', gap: 0.75,
        }}
      >
        <NodeHandles item={item} />
        {item.role && NODE_ROLES[item.role] && (
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, bgcolor: NODE_ROLES[item.role].color }} />
        )}
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title || <span style={{ opacity: 0.4 }}>空のメモ</span>}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onDoubleClick={() => { setDraft(item.text || ''); setEditing(true); }}
      sx={{
        width: 240, minHeight: 110, p: 1.5, borderRadius: 2, boxSizing: 'border-box',
        bgcolor: tone.bg,
        border: '1px solid', borderColor: selected ? '#00BFFF' : tone.border,
        boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'box-shadow .12s, border-color .12s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <NodeHandles item={item} />
      <RoleBadge role={item.role} />
      {editing ? (
        <InputBase
          className="nodrag"
          multiline autoFocus fullWidth
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit(); }}
          placeholder="リサーチ内容・気づきを書く..."
          sx={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: 'var(--brand-fg)', alignItems: 'flex-start' }}
        />
      ) : (
        <Typography sx={{ flex: 1, fontSize: 13, lineHeight: 1.6, color: 'var(--brand-fg)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {item.text || <span style={{ opacity: 0.4 }}>ダブルクリックで編集</span>}
        </Typography>
      )}

      {selected && (
        <Box className="nodrag" sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mt: 1, pt: 0.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', flexWrap: 'wrap' }}>
          {Object.entries(NOTE_COLORS).map(([key, c]) => (
            <Box key={key} onClick={() => patchItem(id, { color: key })}
              sx={{ width: 14, height: 14, borderRadius: '50%', cursor: 'pointer', bgcolor: c.bg,
                border: '2px solid', borderColor: (item.color || DEFAULT_NOTE_COLOR) === key ? '#00BFFF' : c.border }} />
          ))}
          <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: 'rgb(var(--brand-fg-rgb) / 0.12)', mx: 0.4 }} />
          {(Object.entries(NODE_ROLES) as Array<[ResearchNodeRole, { label: string; color: string }]>).map(([key, r]) => (
            <Box key={key}
              onClick={() => patchItem(id, { role: item.role === key ? undefined : key })}
              sx={{
                px: 0.7, py: 0.1, borderRadius: 1, cursor: 'pointer',
                fontSize: 9.5, fontWeight: 800, lineHeight: 1.6,
                color: item.role === key ? r.color : 'rgb(var(--brand-fg-rgb) / 0.45)',
                border: '1px solid',
                borderColor: item.role === key ? r.color : 'rgb(var(--brand-fg-rgb) / 0.2)',
                '&:hover': { borderColor: r.color, color: r.color },
              }}>
              {r.label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── 画像ノード ───────────────────────────────────────────────────────────────

const ImageNode: React.FC<NodeProps> = ({ data, selected }) => {
  const { compact } = useCanvasCtx();
  const item = (data as any).item as ResearchCanvasItem;
  // コンパクト表示: サムネを小さく・キャプションは隠す
  const w = compact ? 150 : 280;
  return (
    <Box sx={{
      width: w, borderRadius: 2, overflow: 'hidden',
      border: '1px solid', borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.15)',
      boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      bgcolor: 'var(--brand-surface)',
    }}>
      <NodeHandles item={item} />
      <img src={item.url} alt={item.text || ''} draggable={false}
        style={compact
          ? { width: '100%', height: 96, objectFit: 'cover', display: 'block', pointerEvents: 'none' }
          : { width: '100%', display: 'block', pointerEvents: 'none' }} />
      {!compact && item.text && (
        <Typography sx={{ px: 1.25, py: 0.75, fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{item.text}</Typography>
      )}
    </Box>
  );
};

// ─── リンクノード ─────────────────────────────────────────────────────────────

const LinkNode: React.FC<NodeProps> = ({ data, selected }) => {
  const item = (data as any).item as ResearchCanvasItem;
  let host = '';
  try { host = item.url ? new URL(item.url).hostname : ''; } catch { /* 不正URLはホスト名なし */ }
  return (
    <Box sx={{
      width: 260, p: 1.25, borderRadius: 2, boxSizing: 'border-box',
      bgcolor: 'var(--brand-surface)',
      border: '1px solid', borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.15)',
      boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', gap: 1,
    }}>
      <NodeHandles item={item} />
      <LinkRoundedIcon sx={{ fontSize: 18, color: '#00BFFF', flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.text || item.url}
        </Typography>
        {host && <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>{host}</Typography>}
      </Box>
      <IconButton className="nodrag" size="small" onClick={() => item.url && openExternal(item.url)}
        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: '#00BFFF' } }}>
        <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );
};

// ─── 引用ノード（根拠の最小単位。出典に必ず遡れる） ────────────────────────────

const QuoteNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { patchItem, compact } = useCanvasCtx();
  const item = (data as any).item as ResearchCanvasItem;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text || '');

  const commit = () => {
    setEditing(false);
    if (draft !== item.text) patchItem(id, { text: draft });
  };

  // コンパクト表示: 出典タイトル（無ければ引用1行目）を1行だけ
  if (compact && !editing) {
    const title = item.refTitle || firstLine(item.text);
    return (
      <Box
        onDoubleClick={() => { setDraft(item.text || ''); setEditing(true); }}
        sx={{
          width: 280, p: 1, pl: 1.25, borderRadius: 2, boxSizing: 'border-box',
          bgcolor: 'var(--brand-surface)',
          border: '1px solid', borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.15)',
          borderLeft: '3px solid #a18cd1',
          boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: 0.75,
        }}
      >
        <NodeHandles item={item} />
        <FormatQuoteRoundedIcon sx={{ fontSize: 15, color: '#a18cd1', flexShrink: 0 }} />
        <Typography sx={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title || <span style={{ opacity: 0.4 }}>空の引用</span>}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onDoubleClick={() => { setDraft(item.text || ''); setEditing(true); }}
      sx={{
        width: 280, minHeight: 90, p: 1.5, pl: 1.75, borderRadius: 2, boxSizing: 'border-box',
        bgcolor: 'var(--brand-surface)',
        border: '1px solid', borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.15)',
        borderLeft: '3px solid #a18cd1',
        boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'box-shadow .12s, border-color .12s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <NodeHandles item={item} />
      <FormatQuoteRoundedIcon sx={{ fontSize: 16, color: '#a18cd1', mb: 0.5 }} />
      {editing ? (
        <InputBase
          className="nodrag"
          multiline autoFocus fullWidth
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit(); }}
          placeholder="引用・根拠となる一節..."
          sx={{ flex: 1, fontSize: 12.5, lineHeight: 1.65, color: 'var(--brand-fg)', alignItems: 'flex-start' }}
        />
      ) : (
        <Typography sx={{ flex: 1, fontSize: 12.5, lineHeight: 1.65, color: 'var(--brand-fg)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {item.text || <span style={{ opacity: 0.4 }}>ダブルクリックで編集</span>}
        </Typography>
      )}
      {(item.refTitle || item.url) && (
        <Box className="nodrag" onClick={() => openBoardSource(item)}
          sx={{
            mt: 1, pt: 0.75, borderTop: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
            display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer',
            '&:hover .quote-src': { color: '#a18cd1' },
          }}>
          {item.refType === 'article'
            ? <ArticleRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />
            : <MenuBookRoundedIcon sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }} />}
          <Typography className="quote-src" sx={{
            fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.5)', transition: 'color .12s',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {item.refTitle || item.url}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── ソースノード（S.Library / S.Blog への参照カード） ─────────────────────────

const SourceNode: React.FC<NodeProps> = ({ data, selected }) => {
  const item = (data as any).item as ResearchCanvasItem;
  const isArticle = item.refType === 'article';
  const accent = isArticle ? '#ff8a65' : '#26a69a';
  return (
    <Box sx={{
      width: 260, p: 1.25, borderRadius: 2, boxSizing: 'border-box',
      bgcolor: 'var(--brand-surface)',
      border: '1px solid', borderColor: selected ? '#00BFFF' : 'rgb(var(--brand-fg-rgb) / 0.15)',
      boxShadow: selected ? '0 0 0 2px rgba(0,191,255,0.25), 0 8px 20px rgba(0,0,0,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', gap: 1,
    }}>
      <NodeHandles item={item} />
      {isArticle
        ? <ArticleRoundedIcon sx={{ fontSize: 20, color: accent, flexShrink: 0 }} />
        : <MenuBookRoundedIcon sx={{ fontSize: 20, color: accent, flexShrink: 0 }} />}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.refTitle || item.text || '無題'}
        </Typography>
        <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.45)' }}>
          {isArticle ? 'S.Blog' : 'S.Library'}{item.refMeta ? ` / ${item.refMeta}` : ''}
        </Typography>
      </Box>
      <IconButton className="nodrag" size="small" onClick={() => openBoardSource(item)}
        sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&:hover': { color: accent } }}>
        <OpenInNewRoundedIcon sx={{ fontSize: 15 }} />
      </IconButton>
    </Box>
  );
};

// ─── レーン背景ノード（ロジックの地図モードの帯・ラベル。非対話・最背面） ──────

const LaneNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as { label: string; color: string; w: number; h: number };
  return (
    <Box sx={{
      width: d.w, height: d.h, borderRadius: 3, boxSizing: 'border-box',
      border: `1px dashed ${d.color}55`, bgcolor: `${d.color}0d`,
      pointerEvents: 'none', position: 'relative',
    }}>
      <Typography sx={{
        position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center',
        fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: d.color, opacity: 0.8,
      }}>
        {d.label}
      </Typography>
    </Box>
  );
};

const nodeTypes = { note: NoteNode, image: ImageNode, link: LinkNode, quote: QuoteNode, source: SourceNode, lane: LaneNode };

// ─── ワイヤー経路（直交ルーティング＋手動編集点） ─────────────────────────────
// 経路は水平垂直（Manhattan）ベース＋角丸: 接続口からスタブでまっすぐ出て、L字/Z字に
// 水平・垂直の線分だけでつなぎ、曲がり角にだけ丸みをつける。障害物があれば中線をずらして
// 回避する。編集点はワイヤー選択中に○として表示され、ドラッグで移動（隣接点と揃うと
// 水平/垂直にスナップ）・区間中央のゴースト○で追加・ダブルクリックで削除できる。

type WirePoint = { x: number; y: number };
type ObstacleRect = { x: number; y: number; w: number; h: number };

const AVOID_MARGIN = 14;   // カードの周囲に確保する余白（この内側を線が通らないようにする）
const STUB_LEN = 22;       // 接続口から出る短い直線（線の出入りの向きを保つ）
const SNAP_DIST = 12;      // 編集点ドラッグ時、隣接点とこの距離以内なら水平/垂直に吸着
const CORNER_RADIUS = 14;  // 曲がり角の丸みの半径

function rectContains(r: ObstacleRect, p: WirePoint): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** 線分 a-b が矩形と交差するか（端点が内部にある場合も交差扱い）。 */
function segIntersectsRect(a: WirePoint, b: WirePoint, r: ObstacleRect): boolean {
  if (Math.max(a.x, b.x) < r.x || Math.min(a.x, b.x) > r.x + r.w ||
      Math.max(a.y, b.y) < r.y || Math.min(a.y, b.y) > r.y + r.h) return false;
  if (rectContains(r, a) || rectContains(r, b)) return true;
  // 4隅が線分の同じ側に揃っていれば交差しない（bbox 重なりは上で確認済み）
  const dx = b.x - a.x, dy = b.y - a.y;
  const cross = (px: number, py: number) => dx * (py - a.y) - dy * (px - a.x);
  const c1 = cross(r.x, r.y), c2 = cross(r.x + r.w, r.y);
  const c3 = cross(r.x, r.y + r.h), c4 = cross(r.x + r.w, r.y + r.h);
  return !((c1 > 0 && c2 > 0 && c3 > 0 && c4 > 0) || (c1 < 0 && c2 < 0 && c3 < 0 && c4 < 0));
}

/** 接続口の向き（+x/-x/+y/-y）。 */
function dirOf(pos: Position | undefined): WirePoint {
  switch (pos) {
    case Position.Left:   return { x: -1, y: 0 };
    case Position.Right:  return { x: 1, y: 0 };
    case Position.Top:    return { x: 0, y: -1 };
    case Position.Bottom: return { x: 0, y: 1 };
    default: return { x: 1, y: 0 };
  }
}

/** 折れ線 pts が障害物に当たらないか（線分の端点が矩形内のものは自分のカード近傍として除外）。 */
function polylineClear(pts: WirePoint[], rects: ObstacleRect[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const r of rects) {
      if (rectContains(r, pts[i]) || rectContains(r, pts[i + 1])) continue;
      if (segIntersectsRect(pts[i], pts[i + 1], r)) return false;
    }
  }
  return true;
}

/**
 * 接続口の向きから、スタブ端 a→b を水平垂直だけでつなぐ角（interior corners）を返す。
 * 同軸（両方水平/両方垂直）は中線を挟んだ Z 字、直交する向きは L 字1角。
 * 障害物があれば中線位置(f)をずらして当たらない候補を選ぶ（見つからなければ中央）。
 */
function orthogonalCorners(
  s: WirePoint, sPos: Position | undefined, t: WirePoint, tPos: Position | undefined, obstacles: ObstacleRect[],
): WirePoint[] {
  const sd = dirOf(sPos), td = dirOf(tPos);
  const a = { x: s.x + sd.x * STUB_LEN, y: s.y + sd.y * STUB_LEN };
  const b = { x: t.x + td.x * STUB_LEN, y: t.y + td.y * STUB_LEN };
  const sHoriz = sd.x !== 0, tHoriz = td.x !== 0;
  const full = (c: WirePoint[]) => [s, a, ...c, b, t];

  let candidates: WirePoint[][];
  if (sHoriz && tHoriz) {
    // 水平→水平: 中央の縦線でつなぐ Z 字（当たれば縦線Xを前後にずらす）
    candidates = [0.5, 0.35, 0.65, 0.2, 0.8].map(f => {
      const mx = a.x + (b.x - a.x) * f;
      return [{ x: mx, y: a.y }, { x: mx, y: b.y }];
    });
  } else if (!sHoriz && !tHoriz) {
    // 垂直→垂直: 中央の横線でつなぐ Z 字
    candidates = [0.5, 0.35, 0.65, 0.2, 0.8].map(f => {
      const my = a.y + (b.y - a.y) * f;
      return [{ x: a.x, y: my }, { x: b.x, y: my }];
    });
  } else if (sHoriz && !tHoriz) {
    candidates = [[{ x: b.x, y: a.y }]];  // L 字（水平に出て垂直に入る）
  } else {
    candidates = [[{ x: a.x, y: b.y }]];  // L 字（垂直に出て水平に入る）
  }
  for (const c of candidates) if (polylineClear(full(c), obstacles)) return c;
  return candidates[0];
}

/** 点列を直線でつなぎ、曲がり角にだけ丸みをつけたパス（直線ベース＋角丸）。 */
function roundedPolylinePath(pts: WirePoint[], radius = CORNER_RADIUS): string {
  // ほぼ重なった点（スタブと編集点が接近した場合など）は除去してから描く
  const p = pts.filter((pt, i) => i === 0 || Math.hypot(pt.x - pts[i - 1].x, pt.y - pts[i - 1].y) > 0.5);
  if (p.length < 2) return '';
  let d = `M ${p[0].x},${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], c = p[i], b = p[i + 1];
    const l1 = Math.hypot(c.x - a.x, c.y - a.y), l2 = Math.hypot(b.x - c.x, b.y - c.y);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    // 角の手前 r で直線を止め、角を制御点にした2次ベジェで丸める
    const p1 = { x: c.x - ((c.x - a.x) / l1) * r, y: c.y - ((c.y - a.y) / l1) * r };
    const p2 = { x: c.x + ((b.x - c.x) / l2) * r, y: c.y + ((b.y - c.y) / l2) * r };
    d += ` L ${p1.x},${p1.y} Q ${c.x},${c.y} ${p2.x},${p2.y}`;
  }
  const last = p[p.length - 1];
  return `${d} L ${last.x},${last.y}`;
}

/** 折れ線の全長のちょうど中間にある点（ラベル配置用）。 */
function polylineMidpoint(pts: WirePoint[]): WirePoint {
  const lens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lens.push(l); total += l;
  }
  let acc = 0;
  for (let i = 0; i < lens.length; i++) {
    if (acc + lens[i] >= total / 2) {
      const t = lens[i] > 0 ? (total / 2 - acc) / lens[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t };
    }
    acc += lens[i];
  }
  return pts[Math.floor(pts.length / 2)];
}

/** 接続口の向きに沿って少し出た点（線の出入りの向きを保つスタブ）。 */
function stubPoint(p: WirePoint, pos: Position | undefined, len = STUB_LEN): WirePoint {
  switch (pos) {
    case Position.Left:   return { x: p.x - len, y: p.y };
    case Position.Right:  return { x: p.x + len, y: p.y };
    case Position.Top:    return { x: p.x, y: p.y - len };
    case Position.Bottom: return { x: p.x, y: p.y + len };
    default: return p;
  }
}

// ─── 関係エッジ（ワイヤー。クリックで編集点＋右パネル、ダブルクリックで理由を書ける） ──

const RelationEdge: React.FC<EdgeProps> = ({
  id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd,
}) => {
  const { patchEdge, portsEditable } = useCanvasCtx();
  const { edge, dimmed, hovered } = data as { edge: ResearchCanvasEdge; dimmed?: boolean; hovered?: boolean };
  const rel = getConnector(edge.relation);
  const focused = !!selected || !!hovered;  // 選択 or ホバー中＝際立たせる
  const { screenToFlowPosition } = useReactFlow();
  const nodes = useNodes();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(edge.label || '');

  // ドラッグ中の編集点列（コミット前のプレビュー）。離した時点で保存する。
  const [dragWps, setDragWps] = useState<WirePoint[] | null>(null);
  // 手動の編集点は自由配置モードのみ有効（地図モードはカード座標が別物で、保存済みの点が合わない）
  const savedWps = portsEditable && edge.waypoints?.length ? edge.waypoints : null;
  const manual = dragWps ?? savedWps;

  // 手動の編集点が無いときは、接続口の向きから水平垂直（L字/Z字）の経路を自動生成する。
  // 他カードに刺さる場合は中線をずらして回避（見つからなければ中央）。
  const autoWps = useMemo<WirePoint[]>(() => {
    if (manual) return [];
    const obstacles: ObstacleRect[] = [];
    for (const n of nodes) {
      if (n.id === source || n.id === target || n.id.startsWith('lane-')) continue;
      const w = n.measured?.width ?? 240, h = n.measured?.height ?? 140;
      obstacles.push({ x: n.position.x - AVOID_MARGIN, y: n.position.y - AVOID_MARGIN, w: w + AVOID_MARGIN * 2, h: h + AVOID_MARGIN * 2 });
    }
    return orthogonalCorners({ x: sourceX, y: sourceY }, sourcePosition, { x: targetX, y: targetY }, targetPosition, obstacles);
  }, [manual, nodes, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const anchors = manual ?? autoWps;

  // 経路: 水平垂直ベース＋角丸。接続口からスタブでまっすぐ出て、角（自動/手動）を経由してつなぐ。
  const pts: WirePoint[] = [
    { x: sourceX, y: sourceY }, stubPoint({ x: sourceX, y: sourceY }, sourcePosition),
    ...anchors,
    stubPoint({ x: targetX, y: targetY }, targetPosition), { x: targetX, y: targetY },
  ];
  const path = roundedPolylinePath(pts);
  // ラベルは経路長のちょうど中間へ（選択中は編集点○と重ならないよう少し下げる）
  const mid = polylineMidpoint(pts);
  const labelX = mid.x;
  const labelY = mid.y + (selected && portsEditable ? 18 : 0);

  // 編集点のドラッグ（base[idx] を動かし、離したら保存）。ゴースト○は挿入してから同じ流れ。
  // 隣接点（前後の角。端は接続口座標）と近づいたら水平/垂直にスナップして直角を作りやすくする。
  const beginDrag = (base: WirePoint[], idx: number) => (ev: React.PointerEvent) => {
    if (ev.button !== 0) return;
    ev.stopPropagation(); ev.preventDefault();
    let cur = base;
    setDragWps(cur);
    const onMove = (e: PointerEvent) => {
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      let x = p.x, y = p.y;
      const left = idx > 0 ? cur[idx - 1] : { x: sourceX, y: sourceY };
      const right = idx < cur.length - 1 ? cur[idx + 1] : { x: targetX, y: targetY };
      // 前後どちらかの点と X（or Y）が近ければ揃える＝縦線/横線になる
      for (const ref of [left, right]) {
        if (Math.abs(x - ref.x) < SNAP_DIST) x = ref.x;
        if (Math.abs(y - ref.y) < SNAP_DIST) y = ref.y;
      }
      cur = cur.map((w, i) => (i === idx ? { x: Math.round(x), y: Math.round(y) } : w));
      setDragWps(cur);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      setDragWps(null);
      patchEdge(id, { waypoints: cur });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const removeWaypoint = (idx: number) => {
    const rest = (savedWps ?? []).filter((_, i) => i !== idx);
    patchEdge(id, { waypoints: rest.length ? rest : undefined });
  };

  const commitLabel = () => {
    setEditing(false);
    const text = draft.trim();
    if (text !== (edge.label || '')) patchEdge(id, { label: text || undefined });
  };

  // 編集点○とゴースト○（各線分の中央。ドラッグでそこに編集点を追加）
  const showHandles = !!selected && !dimmed && portsEditable;
  const ghostSegs: Array<{ p: WirePoint; base: WirePoint[]; idx: number }> = [];
  if (showHandles) {
    const n = anchors.length;
    // pts = [s, sStub, ...anchors(n), tStub, t]。両端のスタブ区間(k=0, k=末尾)は除いて中央区間だけにゴーストを置く。
    for (let k = 1; k <= n + 1; k++) {
      const p = { x: (pts[k].x + pts[k + 1].x) / 2, y: (pts[k].y + pts[k + 1].y) / 2 };
      const j = Math.max(0, Math.min(k - 1, n));  // anchors への挿入位置
      ghostSegs.push({ p, base: [...anchors.slice(0, j), p, ...anchors.slice(j)], idx: j });
    }
  }

  // 既定コネクタ(だから)で理由も無い線は、未フォーカス時はラベルを出さず小さな点だけにして
  // 「だから」の洪水を防ぐ。非既定(でも/例えば等)や理由付きは語だけのチップを出す。
  const isDefault = edge.relation === DEFAULT_CONNECTOR_KEY;
  const showDotOnly = !focused && isDefault && !edge.label;

  return (
    <>
      {/* フォーカス中は背景色のケーシング(縁取り)を線の下に敷き、交差する他線の上を跨ぐように見せる */}
      {focused && !dimmed && (
        <path d={path} fill="none" stroke="var(--brand-bg)" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <BaseEdge id={id} path={path} markerEnd={markerEnd as string}
        style={{
          stroke: rel.color, strokeWidth: focused ? 2.6 : 1.7, strokeDasharray: rel.dash,
          opacity: dimmed ? 0.1 : focused ? 1 : 0.66, transition: 'opacity .15s, stroke-width .1s',
        }} />
      <EdgeLabelRenderer>
        <Box className="nodrag nopan"
          sx={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: dimmed ? 'none' : 'all',
            opacity: dimmed ? 0.15 : 1, transition: 'opacity .15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
            zIndex: focused ? 20 : 2,
          }}>
          {editing ? (
            <InputBase
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') { setDraft(edge.label || ''); setEditing(false); } }}
              placeholder="理由（なぜ繋がるのか）..."
              sx={{
                width: 200, px: 1, py: 0.25, borderRadius: 1.5, fontSize: 10.5,
                color: 'var(--brand-fg)', bgcolor: 'var(--brand-surface)',
                border: `1px solid ${rel.color}`, boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              }}
            />
          ) : showDotOnly ? (
            // 既定・理由なし・未フォーカス → 小さな点だけ（ホバー/選択で語＋理由に展開）
            <Box
              onDoubleClick={() => { setDraft(edge.label || ''); setEditing(true); }}
              title={rel.label}
              sx={{
                width: 7, height: 7, borderRadius: '50%', cursor: 'pointer',
                bgcolor: rel.color, opacity: 0.7, border: '1.5px solid var(--brand-bg)',
                '&:hover': { opacity: 1 },
              }} />
          ) : (
            <Box
              onDoubleClick={() => { setDraft(edge.label || ''); setEditing(true); }}
              title={edge.label || rel.label}
              sx={{
                px: 0.8, py: 0.15, borderRadius: 1.5, cursor: 'pointer',
                maxWidth: focused ? 260 : 120,
                fontSize: 10.5, fontWeight: 700, lineHeight: 1.7, textAlign: 'center',
                color: rel.color, bgcolor: 'var(--brand-surface)',
                border: `1px solid ${focused ? rel.color : 'rgb(var(--brand-fg-rgb) / 0.12)'}`,
                boxShadow: focused ? '0 3px 10px rgba(0,0,0,0.28)' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                opacity: focused ? 1 : 0.82,
              }}>
              {/* 未フォーカスは語だけ・フォーカスで理由まで（洪水を防ぐ） */}
              {rel.label}{focused && edge.label ? `｜${edge.label}` : ''}
            </Box>
          )}
        </Box>

        {/* ワイヤーの編集点（実線○=手動: ドラッグで移動・ダブルクリックで削除 / 破線○=自動迂回: ドラッグでその位置に固定） */}
        {showHandles && anchors.map((p, i) => (
          <Box key={`wp-${i}`} className="nodrag nopan"
            onPointerDown={beginDrag([...anchors], i)}
            onDoubleClick={manual ? (e => { e.stopPropagation(); removeWaypoint(i); }) : undefined}
            title={manual ? 'ドラッグで移動 / ダブルクリックで削除' : 'ドラッグでこの位置に固定'}
            sx={{
              position: 'absolute', width: 13, height: 13, borderRadius: '50%', boxSizing: 'border-box',
              transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
              bgcolor: 'var(--brand-surface)', border: `2px ${manual ? 'solid' : 'dashed'} ${rel.color}`,
              cursor: 'grab', pointerEvents: 'all', zIndex: 12,
              '&:hover': { boxShadow: `0 0 0 3px ${rel.color}44` },
            }} />
        ))}
        {/* 区間中央のゴースト○（ドラッグで編集点を追加） */}
        {showHandles && ghostSegs.map(g => (
          <Box key={`gh-${g.idx}`} className="nodrag nopan"
            onPointerDown={beginDrag(g.base, g.idx)}
            title="ドラッグで編集点を追加"
            sx={{
              position: 'absolute', width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box',
              transform: `translate(-50%, -50%) translate(${g.p.x}px, ${g.p.y}px)`,
              bgcolor: 'var(--brand-surface)', border: `1.5px dashed ${rel.color}`, opacity: 0.6,
              cursor: 'grab', pointerEvents: 'all', zIndex: 11,
              '&:hover': { opacity: 1, boxShadow: `0 0 0 3px ${rel.color}33` },
            }} />
        ))}
      </EdgeLabelRenderer>
    </>
  );
};

const edgeTypes = { relation: RelationEdge };

// ─── スマート整列ガイド（ノードを動かすと他ノードの端/中心に吸着＋青いガイド線） ──
// ドラッグ中のノードABの端(左右上下)・中心が、他ノードBの対応する端/中心と閾値以内に
// 近づいたら、その位置へスナップする座標(snapX/Y)と、引くべきガイド線の座標を返す。

interface HelperLinesResult { horizontal?: number; vertical?: number; snapX?: number; snapY?: number }

function getHelperLines(
  change: { id: string; position?: { x: number; y: number } },
  nodes: Node[],
  distance: number,
): HelperLinesResult {
  const a = nodes.find(n => n.id === change.id);
  if (!a || !change.position) return {};
  const wA = a.measured?.width ?? 240, hA = a.measured?.height ?? 140;
  const aLeft = change.position.x, aRight = aLeft + wA, aCX = aLeft + wA / 2;
  const aTop = change.position.y, aBottom = aTop + hA, aCY = aTop + hA / 2;
  let vDist = distance, hDist = distance;
  const res: HelperLinesResult = {};

  for (const b of nodes) {
    if (b.id === a.id || b.id.startsWith('lane-')) continue;
    const wB = b.measured?.width ?? 240, hB = b.measured?.height ?? 140;
    const bLeft = b.position.x, bRight = bLeft + wB, bCX = bLeft + wB / 2;
    const bTop = b.position.y, bBottom = bTop + hB, bCY = bTop + hB / 2;
    // 縦ガイド（x をスナップ）: 左-左 / 右-右 / 左-右 / 右-左 / 中心-中心
    const vx: Array<[number, number, number]> = [
      [Math.abs(aLeft - bLeft), bLeft, bLeft],
      [Math.abs(aRight - bRight), bRight - wA, bRight],
      [Math.abs(aLeft - bRight), bRight, bRight],
      [Math.abs(aRight - bLeft), bLeft - wA, bLeft],
      [Math.abs(aCX - bCX), bCX - wA / 2, bCX],
    ];
    for (const [d, snap, line] of vx) if (d < vDist) { vDist = d; res.snapX = snap; res.vertical = line; }
    // 横ガイド（y をスナップ）: 上-上 / 下-下 / 上-下 / 下-上 / 中心-中心
    const hy: Array<[number, number, number]> = [
      [Math.abs(aTop - bTop), bTop, bTop],
      [Math.abs(aBottom - bBottom), bBottom - hA, bBottom],
      [Math.abs(aTop - bBottom), bBottom, bBottom],
      [Math.abs(aBottom - bTop), bTop - hA, bTop],
      [Math.abs(aCY - bCY), bCY - hA / 2, bCY],
    ];
    for (const [d, snap, line] of hy) if (d < hDist) { hDist = d; res.snapY = snap; res.horizontal = line; }
  }
  return res;
}

/** 整列ガイド線を描くキャンバス（フロー座標→ビューポート変換して全面に線を1本ずつ）。 */
const HelperLines: React.FC<{ horizontal?: number; vertical?: number }> = ({ horizontal, vertical }) => {
  const width = useStore(s => s.width);
  const height = useStore(s => s.height);
  const transform = useStore(s => s.transform); // [x, y, zoom]
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi; canvas.height = height * dpi;
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, width, height);
    // 控えめに: 細い破線＋半透明（配置の目印として最低限、地図の邪魔をしない）
    ctx.strokeStyle = 'rgba(0, 191, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    if (typeof vertical === 'number') {
      const x = vertical * transform[2] + transform[0];
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    if (typeof horizontal === 'number') {
      const y = horizontal * transform[2] + transform[1];
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }, [width, height, transform, horizontal, vertical]);
  return <canvas ref={ref} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 5 }} />;
};

// ─── 右サイドバー: 選択中ワイヤーの編集パネル ────────────────────────────────
// ワイヤーを1本選択すると出る。接続詞（だから/でも/…＋カスタム）の切替・理由の記入・
// 編集点のリセット・線の削除をここに集約する（エッジ上のポップアップだと地図を隠すため）。

const EdgeInspector: React.FC<{
  edge: ResearchCanvasEdge;
  /** 編集点の操作が有効か（自由配置モードのみ。地図モードは自動配置で座標が合わない） */
  canEditPoints: boolean;
  patchEdge: (id: string, patch: Partial<ResearchCanvasEdge>) => void;
  onDelete: () => void;
  onClose: () => void;
  /** 右端からの距離(px)。Drive パネルと重ならないよう開いているときは左へ寄せる。 */
  rightPx?: number;
}> = ({ edge, canEditPoints, patchEdge, onDelete, onClose, rightPx = 12 }) => {
  const connectors = useConnectors();
  const addPreset = useConnectorStore(s => s.addPreset);
  const removePreset = useConnectorStore(s => s.removePreset);
  const rel = getConnector(edge.relation);
  const [draft, setDraft] = useState(edge.label || '');
  const [addingCustom, setAddingCustom] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState(CONNECTOR_COLOR_CHOICES[0]);
  // ボード側（ダブルクリック編集）でラベルが変わったら追従（レンダー中の派生state更新パターン）
  const [prevLabel, setPrevLabel] = useState(edge.label || '');
  if (prevLabel !== (edge.label || '')) {
    setPrevLabel(edge.label || '');
    setDraft(edge.label || '');
  }

  const commitCustom = () => {
    const text = customLabel.trim();
    if (!text) { setAddingCustom(false); return; }
    const key = addPreset(text, customColor);
    patchEdge(edge.id, { relation: key });
    setCustomLabel(''); setAddingCustom(false);
  };
  const commitLabel = () => {
    const text = draft.trim();
    if (text !== (edge.label || '')) patchEdge(edge.id, { label: text || undefined });
  };

  const sectionSx = { fontSize: 10.5, fontWeight: 800, letterSpacing: '0.04em', color: 'rgb(var(--brand-fg-rgb) / 0.45)' } as const;

  return (
    <Box className="nodrag nopan" sx={{
      position: 'absolute', top: 52, right: rightPx, width: 240, zIndex: 6,
      maxHeight: 'calc(100% - 64px)', overflowY: 'auto',
      p: 1.5, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.25,
      bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: rel.color, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-fg)', flex: 1 }}>
          ワイヤーの編集
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', p: 0.25 }}>
          <CloseRoundedIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Box>

      <Box>
        <Typography sx={{ ...sectionSx, mb: 0.5 }}>つなぎ方（接続詞）</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
          {connectors.map(r => (
            <Box key={r.key}
              onClick={() => patchEdge(edge.id, { relation: r.key })}
              // カスタムは右クリックで削除
              onContextMenu={r.builtin ? undefined : (e => { e.preventDefault(); e.stopPropagation(); removePreset(r.key); if (edge.relation === r.key) patchEdge(edge.id, { relation: DEFAULT_CONNECTOR_KEY }); })}
              title={r.builtin ? undefined : 'クリックで適用 / 右クリックで削除'}
              sx={{
                px: 0.7, py: 0.15, borderRadius: 1, cursor: 'pointer',
                fontSize: 10, fontWeight: 800, lineHeight: 1.6,
                color: edge.relation === r.key ? '#000' : r.color,
                bgcolor: edge.relation === r.key ? r.color : 'transparent',
                border: `1px solid ${r.color}`,
                '&:hover': { bgcolor: edge.relation === r.key ? r.color : `${r.color}22` },
              }}>
              {r.label}
            </Box>
          ))}
          {/* ＋ カスタムラベル追加 */}
          {!addingCustom ? (
            <Box onClick={() => setAddingCustom(true)} title="ラベルを追加"
              sx={{
                px: 0.7, py: 0.15, borderRadius: 1, cursor: 'pointer',
                fontSize: 10, fontWeight: 800, lineHeight: 1.6,
                color: 'rgb(var(--brand-fg-rgb) / 0.55)', border: '1px dashed rgb(var(--brand-fg-rgb) / 0.3)',
                '&:hover': { color: '#00BFFF', borderColor: '#00BFFF' },
              }}>
              ＋
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, width: '100%', mt: 0.4 }}>
              <InputBase
                autoFocus value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitCustom(); if (e.key === 'Escape') setAddingCustom(false); }}
                placeholder="ラベル名"
                sx={{ width: 92, px: 0.75, py: 0.15, borderRadius: 1, fontSize: 10.5, color: 'var(--brand-fg)', border: `1px solid ${customColor}` }}
              />
              {CONNECTOR_COLOR_CHOICES.map(c => (
                <Box key={c} onClick={() => setCustomColor(c)}
                  sx={{ width: 12, height: 12, borderRadius: '50%', cursor: 'pointer', bgcolor: c, flexShrink: 0,
                    border: customColor === c ? '2px solid var(--brand-fg)' : '2px solid transparent' }} />
              ))}
              <Box onClick={commitCustom} title="追加"
                sx={{ px: 0.6, py: 0.15, borderRadius: 1, cursor: 'pointer', fontSize: 10, fontWeight: 800, bgcolor: '#00BFFF', color: '#000' }}>
                追加
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      <Box>
        <Typography sx={{ ...sectionSx, mb: 0.5 }}>理由（なぜ繋がるのか）</Typography>
        <InputBase
          value={draft} fullWidth multiline maxRows={3}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitLabel(); } }}
          placeholder="一言メモ..."
          sx={{
            px: 1, py: 0.4, borderRadius: 1.5, fontSize: 11, color: 'var(--brand-fg)',
            border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
            '&.Mui-focused': { borderColor: rel.color },
          }}
        />
      </Box>

      {canEditPoints && (
        <Box>
          <Typography sx={{ ...sectionSx, mb: 0.5 }}>線の形</Typography>
          <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)', lineHeight: 1.6 }}>
            線上の○をドラッグ＝編集点を追加・移動 / 編集点をダブルクリック＝削除
          </Typography>
          {edge.waypoints?.length ? (
            <Button size="small" onClick={() => patchEdge(edge.id, { waypoints: undefined })}
              sx={{ mt: 0.5, fontSize: 10.5, textTransform: 'none', color: '#00BFFF', p: 0, minWidth: 0 }}>
              編集点をリセット（自動経路に戻す）
            </Button>
          ) : null}
        </Box>
      )}

      <Button size="small" startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} />} onClick={onDelete}
        sx={{ alignSelf: 'flex-start', fontSize: 11, textTransform: 'none', color: '#f87171', p: 0.25, minWidth: 0 }}>
        このワイヤーを削除
      </Button>
    </Box>
  );
};

// ─── キャンバス本体 ───────────────────────────────────────────────────────────

interface Props {
  /** ボードキー（scope|docId）。scope=projectId or 'account'。区切り無しは既定ボード。 */
  boardKey: string;
}

const SAVE_DEBOUNCE_MS = 1500;

const CanvasInner: React.FC<Props> = ({ boardKey }) => {
  // データ/ブリッジ/イベントは boardKey（ボード単位）、チャット・キックオフは scope（プロジェクト/個人単位）。
  const { scope } = parseBoardKey(boardKey);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [driveOpen, setDriveOpen] = useState(false);
  // カード表示密度: false=詳細（全文）/ true=コンパクト（タイトル/要点だけ）
  const [compact, setCompact] = useState(false);
  // 表示モード: free=手置きのまま / map=ロジックの地図（レーン整列・非破壊）
  const [viewMode, setViewMode] = useState<BoardViewMode>('free');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getViewport } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  // 整列ガイド線（ドラッグ中に他ノードと揃う位置に出る）
  const [helperLineV, setHelperLineV] = useState<number | undefined>(undefined);
  const [helperLineH, setHelperLineH] = useState<number | undefined>(undefined);
  // ホバー中のワイヤー（その線を強調＝密なボードで追跡しやすく）
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // 保存まわり: 最後に保存したJSONと比較して差分があるときだけ書き込む
  const lastSavedRef = useRef<string>('');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef<CanvasNode[]>([]);
  nodesRef.current = nodes;
  const edgesRef = useRef<CanvasEdge[]>([]);
  edgesRef.current = edges;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    ResearchCanvasRepository.load(boardKey)
      .then(({ items, edges: loadedEdges }) => {
        if (cancelled) return;
        lastSavedRef.current = JSON.stringify({ items, edges: loadedEdges });
        setNodes(items.map(itemToNode));
        setEdges(loadedEdges.map(edgeToRf));
      })
      .catch(err => console.error('Research canvas load failed:', err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [boardKey, setNodes, setEdges]);

  // 別ウィンドウ（ポップアウトした SEKKEIYA OS の AI）がボードをヘッドレスで更新したら、
  // Firestore から読み直して本体のキャンバスへ反映する（この窓はライブホストを持つが、
  // 別窓のオーケストレーターはホストを共有できず Firestore 経由で書くため）。
  // 注意: 反映は上書き型のため、AI 更新と同時にこの窓で手編集していると手編集が失われうる。
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) =>
      listen<{ projectId: string }>(RESEARCH_BOARD_CHANGED_EVENT, (e) => {
        if (e.payload?.projectId !== boardKey) return;
        ResearchCanvasRepository.load(boardKey)
          .then(({ items, edges: loadedEdges }) => {
            lastSavedRef.current = JSON.stringify({ items, edges: loadedEdges });
            setNodes(items.map(itemToNode));
            setEdges(loadedEdges.map(edgeToRf));
          })
          .catch(err => console.error('[research] 外部更新の再読込に失敗:', err));
      }).then(fn => { unlisten = fn; })
    );
    return () => { unlisten?.(); };
  }, [boardKey, setNodes, setEdges]);

  const flushSaveRef = useRef<() => void>(() => {});
  const flushSave = useCallback(() => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    const items = nodesToItems(nodesRef.current);
    const edgeItems = rfToEdgeItems(edgesRef.current);
    const json = JSON.stringify({ items, edges: edgeItems });
    if (json === lastSavedRef.current) return;
    const prevSaved = lastSavedRef.current;
    lastSavedRef.current = json;
    ResearchCanvasRepository.save(boardKey, { items, edges: edgeItems })
      .then(() => setSaveError(false))
      .catch(err => {
        console.error('Research canvas save failed:', err);
        // 失敗を「保存済み」と誤認すると以後の再試行が走らずサイレントにデータが消えるため、
        // 比較値を巻き戻して警告を出し、10秒後に自動リトライする。
        lastSavedRef.current = prevSaved;
        setSaveError(true);
        setTimeout(() => flushSaveRef.current(), 10_000);
      });
  }, [boardKey]);
  flushSaveRef.current = flushSave;

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  // ロード完了後のノード/エッジ変化（移動/削除/編集/接続）を保存対象にする
  useEffect(() => {
    if (loading) return;
    scheduleSave();
  }, [nodes, edges, loading, scheduleSave]);

  // アンマウント・プロジェクト切替時に未保存分をフラッシュ
  useEffect(() => () => { flushSave(); }, [flushSave]);

  const patchItem = useCallback((id: string, patch: Partial<ResearchCanvasItem>) => {
    setNodes(nds => nds.map(n => n.id === id
      ? { ...n, data: { item: { ...n.data.item, ...patch, updatedAt: new Date().toISOString() } } }
      : n));
  }, [setNodes]);

  // エッジの更新は edgeToRf で作り直す（relation 変更で線色・矢印マーカーも追従させる）
  const patchEdge = useCallback((id: string, patch: Partial<ResearchCanvasEdge>) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== id) return e;
      const merged = { ...(e.data as { edge: ResearchCanvasEdge }).edge, ...patch, updatedAt: new Date().toISOString() };
      return { ...edgeToRf(merged), selected: e.selected };
    }));
  }, [setEdges]);

  /**
   * ハンドルのドラッグ接続。どの辺からでも双方向に引ける（connectionMode=loose）。
   * 同じカード間でも別の辺を使えば2本・3本と重ねずに引ける。既定の関係タイプで張り、
   * 選択状態にしてすぐ関係タイプを切り替えられるようにする。
   */
  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    // 重複ガードは設けない。1つの辺から何本でも、同じカード間でも複数本を自由に引ける。
    setEdges(eds => {
      const now = new Date().toISOString();
      const edge: ResearchCanvasEdge = {
        id: newId(), source: conn.source, target: conn.target,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        relation: DEFAULT_CONNECTOR_KEY, createdAt: now, updatedAt: now,
      };
      return [...eds.map(e => ({ ...e, selected: false })), { ...edgeToRf(edge), selected: true }];
    });
  }, [setEdges]);

  // カードの指定辺に接続口（ポート）を追加し、新ポートIDを返す（＋ボタン／接続時の自動追加で使用）。
  // atIndex を渡すと、その辺のポート列の atIndex 番目へ挿入する（既存ポートの「間」に作れる）。
  const addPort = useCallback((id: string, side: ResearchPortSide, atIndex?: number): string => {
    const portId = 'p_' + Math.random().toString(36).slice(2, 8);
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const cur = effectivePorts(n.data.item);
      const newPort: ResearchCardPort = { id: portId, side };
      // 辺内の順序＝均等割りの並び順。辺別に分けて atIndex 番目へ挿入する
      // （辺をまたいだ配列順はレイアウトに影響しないので、side ごとにまとめて良い）。
      const sidePorts = cur.filter(p => p.side === side);
      const nonSide = cur.filter(p => p.side !== side);
      const idx = atIndex == null ? sidePorts.length : Math.max(0, Math.min(atIndex, sidePorts.length));
      const newSide = [...sidePorts.slice(0, idx), newPort, ...sidePorts.slice(idx)];
      const ports: ResearchCardPort[] = [...nonSide, ...newSide];
      return { ...n, data: { item: { ...n.data.item, ports, updatedAt: new Date().toISOString() } } };
    }));
    // ハンドルが増えて同じ辺の口が再配置されるので、React Flow に再計測させて
    // 既存の配線の端点も新しい口の位置へ追従させる（呼ばないと線が取り残される）。
    setTimeout(() => updateNodeInternals(id), 0);
    return portId;
  }, [setNodes, updateNodeInternals]);

  // 接続口を削除（その口につながる配線も除去）。最後の1つは残す（口ゼロを防ぐ）。
  const removePort = useCallback((id: string, portId: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const cur = effectivePorts(n.data.item);
      if (cur.length <= 1) return n;
      const ports = cur.filter(p => p.id !== portId);
      return { ...n, data: { item: { ...n.data.item, ports, updatedAt: new Date().toISOString() } } };
    }));
    // edges 側は edgeToRf で sourceHandle/targetHandle が必ず入っている（既定は right/left）ので単純一致で除去
    setEdges(eds => eds.filter(e => !(
      (e.source === id && e.sourceHandle === portId) ||
      (e.target === id && e.targetHandle === portId)
    )));
    setTimeout(() => updateNodeInternals(id), 0);
  }, [setNodes, setEdges, updateNodeInternals]);

  // ドラッグ接続の始点を記録し、既存ハンドル以外（カード本体）へドロップされたら
  // 相手カードに接続口を自動で足してつなぐ。
  const connectFromRef = useRef<{ nodeId: string | null; handleId: string | null } | null>(null);
  const onConnectStart = useCallback((_: any, params: { nodeId: string | null; handleId: string | null }) => {
    connectFromRef.current = { nodeId: params.nodeId, handleId: params.handleId };
  }, []);

  const NODE_FALLBACK: Record<string, { w: number; h: number }> = {
    note: { w: 240, h: 140 }, quote: { w: 280, h: 130 }, image: { w: 280, h: 220 }, link: { w: 260, h: 64 }, source: { w: 260, h: 64 },
  };
  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent, connState: any) => {
    const from = connectFromRef.current;
    connectFromRef.current = null;
    if (!from?.nodeId) return;
    // 既存ハンドルに着地した場合は onConnect が処理済み → 何もしない
    if (connState?.toHandle || connState?.isValid) return;

    const pt = 'changedTouches' in event
      ? (event.changedTouches[0] ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY } : null)
      : { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY };
    if (!pt) return;
    const flow = screenToFlowPosition(pt);

    // ドロップ地点にあるカード（始点カード・レーン背景を除く）を探す
    const target = [...nodesRef.current].reverse().find(n => {
      if (n.id === from.nodeId) return false;
      const w = n.measured?.width ?? NODE_FALLBACK[n.data.item.kind]?.w ?? 240;
      const h = n.measured?.height ?? NODE_FALLBACK[n.data.item.kind]?.h ?? 120;
      return flow.x >= n.position.x && flow.x <= n.position.x + w && flow.y >= n.position.y && flow.y <= n.position.y + h;
    });
    if (!target) return;

    // ドロップ地点に近い辺を選び、そこに接続口を足す
    const w = target.measured?.width ?? NODE_FALLBACK[target.data.item.kind]?.w ?? 240;
    const h = target.measured?.height ?? NODE_FALLBACK[target.data.item.kind]?.h ?? 120;
    const dx = (flow.x - (target.position.x + w / 2)) / (w / 2);
    const dy = (flow.y - (target.position.y + h / 2)) / (h / 2);
    const side: ResearchPortSide = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'bottom' : 'top');

    // ドロップ地点の「辺に沿った位置」から挿入インデックスを決め、既存ポートの間に作る
    // （末尾固定ではなく、落とした場所に応じて上下/左右の間に入る）。
    const along = (side === 'left' || side === 'right')
      ? (flow.y - target.position.y) / h
      : (flow.x - target.position.x) / w;
    const f = Math.max(0, Math.min(1, along));
    const existing = effectivePorts(target.data.item).filter(p => p.side === side).length;
    let atIndex = 0;
    for (let k = 0; k < existing; k++) { if ((k + 1) / (existing + 1) < f) atIndex++; }
    const portId = addPort(target.id, side, atIndex);

    setEdges(eds => {
      const now = new Date().toISOString();
      const edge: ResearchCanvasEdge = {
        id: newId(), source: from.nodeId!, target: target.id,
        sourceHandle: from.handleId ?? undefined, targetHandle: portId,
        relation: DEFAULT_CONNECTOR_KEY, createdAt: now, updatedAt: now,
      };
      return [...eds.map(e => ({ ...e, selected: false })), { ...edgeToRf(edge), selected: true }];
    });
  }, [screenToFlowPosition, addPort, setEdges]);

  // 既存エッジの端点を別の接続口へ付け替え（線の始点/終点を左ドラッグ）。
  // 付け替え先が無い（空ドロップ）ときは何もしない＝線を維持する。
  const onReconnect = useCallback((oldEdge: Edge, conn: Connection) => {
    if (!conn.source || !conn.target) return;
    setEdges(eds => eds.map(e => {
      if (e.id !== oldEdge.id) return e;
      const data = (e.data as { edge: ResearchCanvasEdge }).edge;
      const merged: ResearchCanvasEdge = {
        ...data, source: conn.source!, target: conn.target!,
        sourceHandle: conn.sourceHandle ?? undefined, targetHandle: conn.targetHandle ?? undefined,
        updatedAt: new Date().toISOString(),
      };
      return { ...edgeToRf(merged), selected: e.selected };
    }));
  }, [setEdges]);

  // ─── 元に戻す / やり直す（Ctrl+Z / Ctrl+Shift+Z・Ctrl+Y）────────────────────
  // nodes/edges のスナップショット(JSON)を履歴に積む。編集が 500ms 落ち着くたびに
  // 直前の確定スナップショットを past へ。適用時は lastSnapRef を書き換えるので
  // 記録タイマーは「差分なし」と判断して二重記録しない。
  const historyRef = useRef<{ past: string[]; future: string[] }>({ past: [], future: [] });
  const lastSnapRef = useRef<string>('');
  const histTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applySnapshot = useCallback((snap: string) => {
    const parsed = JSON.parse(snap) as { items: ResearchCanvasItem[]; edges: ResearchCanvasEdge[] };
    lastSnapRef.current = snap;
    setNodes(parsed.items.map(itemToNode));
    setEdges(parsed.edges.map(edgeToRf));
    // ポート構成が変わっている可能性があるのでハンドルを再計測（配線端点を追従）
    setTimeout(() => parsed.items.forEach(it => updateNodeInternals(it.id)), 0);
  }, [setNodes, setEdges, updateNodeInternals]);

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

  // 変更が落ち着いたら履歴へ記録（差分があるときだけ past に積む）
  useEffect(() => {
    if (loading) return;
    if (histTimerRef.current) clearTimeout(histTimerRef.current);
    histTimerRef.current = setTimeout(() => {
      const snap = JSON.stringify({ items: nodesToItems(nodesRef.current), edges: rfToEdgeItems(edgesRef.current) });
      if (snap === lastSnapRef.current) return;
      if (lastSnapRef.current) historyRef.current.past.push(lastSnapRef.current);
      if (historyRef.current.past.length > 100) historyRef.current.past.shift();
      historyRef.current.future = [];
      lastSnapRef.current = snap;
    }, 500);
  }, [nodes, edges, loading]);

  // ロード完了時点のスナップショットを基準にする（初回で空履歴に）
  useEffect(() => {
    if (loading) return;
    lastSnapRef.current = JSON.stringify({ items: nodesToItems(nodesRef.current), edges: rfToEdgeItems(edgesRef.current) });
    historyRef.current = { past: [], future: [] };
    // loading が false になった初回だけ実行したいので依存は loading のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Ctrl+Z / Ctrl+Shift+Z（Ctrl+Y）。テキスト編集中はブラウザ既定に譲る。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      e.preventDefault();
      if (k === 'y' || (k === 'z' && e.shiftKey)) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ─── 経路ハイライト（トレーサビリティ）──────────────────────────────────────
  // カードを1枚選択すると、そこから上流（根拠側）・下流（結論側）に繋がる
  // 全経路を残して他を減光する。「なぜこの結論？」にエッジを遡って即答するための表示。
  const trace = useMemo(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length !== 1) return null;
    const rootId = selectedNodes[0].id;
    if (!edges.some(e => e.source === rootId || e.target === rootId)) return null;

    const nodeIds = new Set<string>([rootId]);
    const edgeIds = new Set<string>();
    const walk = (dir: 'up' | 'down') => {
      const visited = new Set<string>([rootId]);
      const stack = [rootId];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const e of edges) {
          const [from, to] = dir === 'up' ? [e.target, e.source] : [e.source, e.target];
          if (from !== cur) continue;
          edgeIds.add(e.id);
          nodeIds.add(to);
          if (!visited.has(to)) { visited.add(to); stack.push(to); }
        }
      }
    };
    walk('up');
    walk('down');
    return { nodeIds, edgeIds };
  }, [nodes, edges]);

  // ─── ロジックの地図（表示モード map）─────────────────────────────────────────
  // 役割＝列・テーマ＝帯でカードを再配置した「表示座標」を計算する。保存 state は不変。
  const laneLayout = useMemo(
    () => (viewMode === 'map' ? computeLaneLayout(nodes, edges.map(e => ({ source: e.source, target: e.target }))) : null),
    [viewMode, nodes, edges],
  );

  // レーンの背景（帯＋「根拠/解釈/結論」ラベル、未配置トレイ）。最背面の非対話ノード。
  const laneNodes = useMemo<Node[]>(() => {
    if (viewMode !== 'map' || !laneLayout) return [];
    const out: Node[] = MAP_LANE_META.map((m, i) => ({
      id: `lane-${m.role}`, type: 'lane',
      position: { x: MAP_COL_LEFT[i], y: 0 },
      data: { label: m.label, color: m.color, w: MAP_LANE_W, h: laneLayout.laneHeight },
      style: { width: MAP_LANE_W, height: laneLayout.laneHeight },
      draggable: false, selectable: false, deletable: false, zIndex: -1,
    }));
    if (laneLayout.tray) {
      out.push({
        id: 'lane-tray', type: 'lane',
        position: { x: 0, y: laneLayout.tray.top },
        data: { label: '未配置 — まだ論証に組み込まれていないカード', color: '#888780', w: laneLayout.totalWidth, h: laneLayout.tray.height },
        style: { width: laneLayout.totalWidth, height: laneLayout.tray.height },
        draggable: false, selectable: false, deletable: false, zIndex: -1,
      });
    }
    return out;
  }, [viewMode, laneLayout]);

  // 表示ノード: map モードはレーン座標を上書き＋背景レーンを前置。減光は表示コピーにだけ適用。
  const displayNodes = useMemo<Node[]>(() => {
    const base: CanvasNode[] = viewMode === 'map' && laneLayout
      ? nodes.map(n => ({ ...n, position: laneLayout.positions.get(n.id) ?? n.position }))
      : nodes;
    const traced = trace
      ? base.map(n => (trace.nodeIds.has(n.id) ? n : { ...n, className: 'trace-dim' }))
      : base;
    return viewMode === 'map' ? [...laneNodes, ...traced] : traced;
  }, [nodes, viewMode, laneLayout, laneNodes, trace]);

  // 表示エッジ: 経路ハイライトの減光（trace）＋ホバー強調（hovered/zIndex）を表示コピーに乗せる
  const displayEdges = useMemo(
    () => edges.map(e => {
      const dimmed = trace ? !trace.edgeIds.has(e.id) : false;
      const hovered = e.id === hoveredEdgeId;
      const focused = hovered || !!e.selected;
      if (!dimmed && !hovered && !focused) return e;
      return { ...e, zIndex: focused ? 1000 : undefined, data: { ...e.data!, dimmed, hovered } };
    }),
    [edges, trace, hoveredEdgeId],
  );

  // 右サイドバー: ワイヤーをちょうど1本選択しているときに編集パネルを出す
  const selectedEdge = useMemo(() => {
    const sel = edges.filter(e => e.selected);
    return sel.length === 1 ? sel[0] : null;
  }, [edges]);

  // 背景レーンノードの変更（選択・寸法等）は保存 state に混ぜない
  const handleNodesChange = useCallback((changes: any[]) => {
    const filtered = changes.filter(c => !(typeof c?.id === 'string' && c.id.startsWith('lane-')));

    // スマート整列スナップ（単一ノードのドラッグ中のみ）: 他ノードの端/中心に近づくと吸着し、
    // 青いガイド線を出す。閾値は画面上で一定になるようズームで割る（低ズームでも効きすぎない）。
    let vLine: number | undefined, hLine: number | undefined;
    const dragPos = filtered.filter(c => c.type === 'position' && c.dragging && c.position);
    if (dragPos.length === 1) {
      const zoom = getViewport().zoom || 1;
      const helpers = getHelperLines(dragPos[0], nodesRef.current, 6 / zoom);
      if (helpers.snapX != null) dragPos[0].position.x = helpers.snapX;
      if (helpers.snapY != null) dragPos[0].position.y = helpers.snapY;
      vLine = helpers.vertical; hLine = helpers.horizontal;
    }
    setHelperLineV(vLine);
    setHelperLineH(hLine);

    // ノード移動に連動して、手動編集点を持つワイヤーの端の角を「水平垂直のまま」追従させる。
    // （※上で position をスナップ済みなので、以降の delta もスナップ後の値を使う）
    // （編集点なしのワイヤーは毎レンダー自動ルーティングし直すので元々追従する）
    const moves = filtered
      .filter(c => c.type === 'position' && c.position)
      .map(c => {
        const old = nodesRef.current.find(n => n.id === c.id);
        if (!old) return null;
        const dx = c.position.x - old.position.x, dy = c.position.y - old.position.y;
        if (!dx && !dy) return null;
        return {
          id: c.id as string, dx, dy,
          cx: c.position.x + (old.measured?.width ?? 240) / 2,
          cy: c.position.y + (old.measured?.height ?? 140) / 2,
        };
      })
      .filter((m): m is { id: string; dx: number; dy: number; cx: number; cy: number } => m != null);

    if (moves.length) {
      // 端点→隣接編集点の線分が縦(x共有)か横(y共有)かを、編集点とカード中心の近い軸で判定し、
      // その共有軸だけノードの移動量ぶん動かす＝直角を保ったまま角がついてくる。
      const followEnd = (wp: WirePoint, m: { dx: number; dy: number; cx: number; cy: number }): WirePoint =>
        Math.abs(wp.x - m.cx) <= Math.abs(wp.y - m.cy)
          ? { x: wp.x + m.dx, y: wp.y }   // 縦線（x共有）→ x を追従
          : { x: wp.x, y: wp.y + m.dy };  // 横線（y共有）→ y を追従

      setEdges(eds => eds.map(e => {
        const data = (e.data as { edge: ResearchCanvasEdge }).edge;
        if (!data.waypoints?.length) return e;
        const srcMove = moves.find(m => m.id === e.source);
        const tgtMove = moves.find(m => m.id === e.target);
        if (!srcMove && !tgtMove) return e;

        let wps: WirePoint[];
        if (srcMove && tgtMove && srcMove.dx === tgtMove.dx && srcMove.dy === tgtMove.dy) {
          // 両端が同じ量だけ動く（複数選択のグループ移動）→ 全編集点を平行移動して形を保つ
          wps = data.waypoints.map(w => ({ x: w.x + srcMove.dx, y: w.y + srcMove.dy }));
        } else {
          wps = data.waypoints.map(w => ({ ...w }));
          if (srcMove) wps[0] = followEnd(wps[0], srcMove);
          if (tgtMove) wps[wps.length - 1] = followEnd(wps[wps.length - 1], tgtMove);
        }
        const merged = { ...data, waypoints: wps, updatedAt: new Date().toISOString() };
        return { ...edgeToRf(merged), selected: e.selected };
      }));
    }

    onNodesChange(filtered);
  }, [onNodesChange, setEdges, getViewport]);

  // モード切替時に全体表示へ寄せる（地図の俯瞰／手置きの俯瞰）
  useEffect(() => {
    const t = window.setTimeout(() => { try { fitView({ maxZoom: 1, duration: 400 }); } catch { /* noop */ } }, 80);
    return () => window.clearTimeout(t);
  }, [viewMode, fitView]);

  // 表示密度の切替でカードサイズが変わるので、ハンドルを再計測してワイヤー端点を追従させる
  useEffect(() => {
    const t = window.setTimeout(() => nodesRef.current.forEach(n => updateNodeInternals(n.id)), 30);
    return () => window.clearTimeout(t);
  }, [compact, updateNodeInternals]);

  // ─── 階層整列（根拠→解釈→結論を左→右に敷き直す）───────────────────────────
  // エッジで繋がっているカードだけを格子状に整列し、未接続カードは動かさない。
  // 列＝流れの段階（source→target の最長路）、列の左端 X は完全に揃え、列内は
  // 等間隔で縦積み・列同士は縦中央を揃える。座標がグリッドに乗るので、直交ワイヤーが
  // まっすぐな水平線/Z字になり「一目で流れがわかる」状態を作る。
  // 手動編集点は整列で座標が全部変わるためリセットし、自動ルーティングに任せる。
  const [aligning, setAligning] = useState(false);
  const autoAlign = useCallback(async (opts?: { fit?: boolean }) => {
    const edgeItems = rfToEdgeItems(edgesRef.current);
    if (edgeItems.length === 0) return;
    setAligning(true);
    try {
      const involved = new Set<string>();
      edgeItems.forEach(e => { involved.add(e.source); involved.add(e.target); });
      const targets = nodesRef.current.filter(n => involved.has(n.id));
      if (targets.length === 0) return;
      const targetIds = new Set(targets.map(n => n.id));
      const compEdges = edgeItems.filter(e => targetIds.has(e.source) && targetIds.has(e.target));

      const FALLBACK_SIZE: Record<string, { width: number; height: number }> = {
        note: { width: 240, height: 140 }, quote: { width: 280, height: 130 },
        image: { width: 280, height: 220 }, link: { width: 260, height: 64 }, source: { width: 260, height: 64 },
      };
      const sizeOf = (n: CanvasNode) => ({
        width: n.measured?.width ?? FALLBACK_SIZE[n.data.item.kind]?.width ?? 240,
        height: n.measured?.height ?? FALLBACK_SIZE[n.data.item.kind]?.height ?? 120,
      });

      const H_GAP = 150;  // 列間（直交ワイヤーの Z 折れ用の余白）
      const V_GAP = 36;   // 列内のカード間
      const COMP_GAP = 90; // 連結成分（別テーマ）どうしの縦間隔

      // ── 無向の連結成分に分割（テーマごとに別ブロックとして整列）──
      const adj = new Map<string, Set<string>>();
      targets.forEach(n => adj.set(n.id, new Set()));
      compEdges.forEach(e => { adj.get(e.source)!.add(e.target); adj.get(e.target)!.add(e.source); });
      const compOf = new Map<string, number>();
      let compCount = 0;
      for (const n of targets) {
        if (compOf.has(n.id)) continue;
        const c = compCount++;
        const stack = [n.id];
        compOf.set(n.id, c);
        while (stack.length) {
          const cur = stack.pop()!;
          for (const nb of adj.get(cur) ?? []) if (!compOf.has(nb)) { compOf.set(nb, c); stack.push(nb); }
        }
      }
      const comps: CanvasNode[][] = Array.from({ length: compCount }, () => []);
      targets.forEach(n => comps[compOf.get(n.id)!].push(n));
      // 成分の順序は現在の位置（上にあるものから）で安定させる
      comps.sort((A, B) => Math.min(...A.map(n => n.position.y)) - Math.min(...B.map(n => n.position.y)));

      const posMap = new Map<string, { x: number; y: number }>();
      let compTop = 0;
      let placedMaxW = 0;

      for (const comp of comps) {
        const ids = new Set(comp.map(n => n.id));
        const inComp = compEdges.filter(e => ids.has(e.source) && ids.has(e.target));

        // ── 巡回（双方向の矢印など）を除いた DAG を作る（DFS の逆行辺を除外）──
        // 巡回を残したまま最長路を取るとランクが膨張して空の列や無限大座標が生まれるため。
        const outEdges = new Map<string, typeof inComp>(comp.map(n => [n.id, []]));
        inComp.forEach(e => outEdges.get(e.source)!.push(e));
        const color = new Map<string, number>(); // 0=未訪問 1=探索中 2=完了
        const dagEdges: typeof inComp = [];
        const dfs = (u: string) => {
          color.set(u, 1);
          for (const e of outEdges.get(u) ?? []) {
            const cv = color.get(e.target) ?? 0;
            if (cv === 1) continue; // 探索中の先祖へ戻る辺＝巡回 → ランク計算から除外
            dagEdges.push(e);
            if (cv === 0) dfs(e.target);
          }
          color.set(u, 2);
        };
        comp.forEach(n => { if (!(color.get(n.id) ?? 0)) dfs(n.id); });

        // ── 列（rank）: DAG 上の source→target の最長路（DAG なので必ず収束）──
        const rank = new Map<string, number>(comp.map(n => [n.id, 0]));
        for (let pass = 0; pass < comp.length; pass++) {
          let changed = false;
          for (const e of dagEdges) {
            const r = rank.get(e.source)! + 1;
            if (r > rank.get(e.target)!) { rank.set(e.target, r); changed = true; }
          }
          if (!changed) break;
        }
        // 空の列が残らないよう、使われているランクだけを 0,1,2… に詰め直す
        const usedRanks = [...new Set(comp.map(n => rank.get(n.id)!))].sort((a, b) => a - b);
        const rankRemap = new Map(usedRanks.map((r, i) => [r, i]));
        comp.forEach(n => rank.set(n.id, rankRemap.get(rank.get(n.id)!)!));

        // ── 列ごとに分け、まず現在の縦位置で並べる ──
        const maxRank = Math.max(...comp.map(n => rank.get(n.id)!));
        const cols: CanvasNode[][] = Array.from({ length: maxRank + 1 }, () => []);
        comp.forEach(n => cols[rank.get(n.id)!].push(n));
        cols.forEach(col => col.sort((a, b) => a.position.y - b.position.y));

        // ── 隣の列の接続相手の平均行位置（barycenter）で並び替え、交差を減らす ──
        const rowIndex = new Map<string, number>();
        const reindex = () => cols.forEach(col => col.forEach((n, i) => rowIndex.set(n.id, i)));
        reindex();
        const neighborsOf = (nid: string, colRank: number) =>
          inComp.flatMap(e => {
            const other = e.source === nid ? e.target : e.target === nid ? e.source : null;
            return other && rank.get(other) === colRank ? [other] : [];
          });
        for (const dir of [1, -1] as const) {  // 左→右、右→左の2スイープ
          const order = dir === 1 ? cols.keys() : [...cols.keys()].reverse();
          for (const c of order) {
            const refRank = c - dir;
            if (refRank < 0 || refRank > maxRank) continue;
            cols[c] = cols[c]
              .map((n, i) => {
                const nbs = neighborsOf(n.id, refRank);
                const key = nbs.length ? nbs.reduce((s, o) => s + (rowIndex.get(o) ?? 0), 0) / nbs.length : i;
                return { n, key, i };
              })
              .sort((a, b) => a.key - b.key || a.i - b.i)
              .map(x => x.n);
            reindex();
          }
        }

        // ── 配置: 列の左端 X を揃え、列内は等間隔で縦積み・列同士は縦中央を揃える ──
        const colWidths = cols.map(col => Math.max(...col.map(n => sizeOf(n).width)));
        const colHeights = cols.map(col =>
          col.reduce((s, n) => s + sizeOf(n).height, 0) + V_GAP * Math.max(0, col.length - 1));
        const compH = Math.max(...colHeights);
        let colX = 0;
        cols.forEach((col, c) => {
          let y = compTop + (compH - colHeights[c]) / 2;  // 縦中央揃え
          for (const n of col) {
            posMap.set(n.id, { x: Math.round(colX), y: Math.round(y) });
            y += sizeOf(n).height + V_GAP;
          }
          colX += colWidths[c] + H_GAP;
        });
        placedMaxW = Math.max(placedMaxW, colX - H_GAP);
        compTop += compH + COMP_GAP;
      }

      // ── 整列前の左上を基準に平行移動して、グラフ全体がボード上で飛ばないようにする ──
      const minX0 = Math.min(...targets.map(n => n.position.x));
      const minY0 = Math.min(...targets.map(n => n.position.y));
      const minX1 = Math.min(...[...posMap.values()].map(p => p.x));
      const minY1 = Math.min(...[...posMap.values()].map(p => p.y));
      setNodes(nds => nds.map(n => {
        const pos = posMap.get(n.id);
        return pos ? { ...n, position: { x: pos.x - minX1 + minX0, y: pos.y - minY1 + minY0 } } : n;
      }));

      // ── 手動編集点は座標が全部変わって崩れるためリセット（自動直交ルーティングへ）──
      setEdges(eds => eds.map(e => {
        const data = (e.data as { edge: ResearchCanvasEdge }).edge;
        if (!data.waypoints?.length) return e;
        const merged = { ...data, waypoints: undefined, updatedAt: new Date().toISOString() };
        return { ...edgeToRf(merged), selected: e.selected };
      }));

      // AI が組み上げた直後は流れ全体が視界に入るよう、ゆっくり全体表示に合わせる
      if (opts?.fit) window.setTimeout(() => { try { fitView({ maxZoom: 1, duration: 500 }); } catch { /* noop */ } }, 90);
    } catch (e) {
      console.error('[research] 整列に失敗:', e);
    } finally {
      setAligning(false);
    }
  }, [setNodes, setEdges, fitView]);

  // AI がカードを接続した直後などに、少し待ってから自動で整列する。
  // 連続する add_items / connect_items の呼び出しを1回の整列にまとめる（500ms デバウンス）。
  const arrangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestAutoArrange = useCallback(() => {
    if (arrangeTimerRef.current) clearTimeout(arrangeTimerRef.current);
    arrangeTimerRef.current = setTimeout(() => { autoAlign({ fit: true }); }, 500);
  }, [autoAlign]);
  useEffect(() => () => { if (arrangeTimerRef.current) clearTimeout(arrangeTimerRef.current); }, []);

  // 表示密度（コンパクト⇄詳細）を切り替えたら、その密度に合わせて自動で整列し直す。
  // カードの再計測（ResizeObserver→measured更新）を待ってから走らせる。初回マウントは除く。
  const compactInitRef = useRef(true);
  useEffect(() => {
    if (compactInitRef.current) { compactInitRef.current = false; return; }
    if (loading) return;
    const t = window.setTimeout(() => { autoAlign({ fit: true }); }, 180);
    return () => window.clearTimeout(t);
  }, [compact, loading, autoAlign]);

  // SEKKEIYA Chat（verb）からボードをライブ操作できるようホスト登録する。
  // 追加/削除は nodes/edges state に入るので、既存の debounce 保存にそのまま乗る。
  useEffect(() => {
    return registerResearchBoardHost({
      projectId: boardKey,
      getItems: () => nodesToItems(nodesRef.current),
      addItems: items => setNodes(nds => [...nds, ...items.map(itemToNode)]),
      patchItem,
      removeItems: ids => {
        const idSet = new Set(ids);
        setNodes(nds => nds.filter(n => !idSet.has(n.id)));
        // 消えたカードにぶら下がるエッジも一緒に消す（宙に浮いたエッジを残さない）
        setEdges(eds => eds.filter(e => !idSet.has(e.source) && !idSet.has(e.target)));
      },
      getEdges: () => rfToEdgeItems(edgesRef.current),
      addEdges: newEdges => setEdges(eds => [...eds, ...newEdges.map(edgeToRf)]),
      patchEdge,
      removeEdges: ids => {
        const idSet = new Set(ids);
        setEdges(eds => eds.filter(e => !idSet.has(e.id)));
      },
      arrange: requestAutoArrange,
    });
  }, [boardKey, setNodes, setEdges, patchItem, patchEdge, requestAutoArrange]);

  const viewportCenter = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }, [screenToFlowPosition]);

  const addItem = useCallback((partial: Omit<ResearchCanvasItem, 'id' | 'x' | 'y' | 'createdAt' | 'updatedAt'>, pos?: { x: number; y: number }) => {
    // 位置指定がない（＝中心置き）ときだけ、連続追加で完全に重ならないよう軽くばらす
    const jitter = pos ? () => 0 : () => (Math.random() - 0.5) * 60;
    const p = pos ?? viewportCenter();
    const now = new Date().toISOString();
    const item: ResearchCanvasItem = { id: newId(), x: p.x + jitter(), y: p.y + jitter(), createdAt: now, updatedAt: now, ...partial };
    setNodes(nds => [...nds, itemToNode(item)]);
  }, [setNodes, viewportCenter]);

  /**
   * 「SEKKEIYA OS に相談」: チャットを開き、AI側から対話を切り出させる。
   * キックオフ指示は hidden で送るためチャット欄にはAIの問いかけだけが表示される。
   * ★ポップアウト窓へ切り出し中はキックオフをその窓へ委譲する（本体では会話が見えないため）。
   */
  const isAccountBoard = scope === ACCOUNT_BOARD_ID;

  // ボードのスコープに応じたキックオフ本文（プロジェクト=設計の深掘り / 個人=方向性・ビジョン）
  const kickoffText = useCallback((entry: 'button' | 'auto') => {
    const head = entry === 'button'
      ? '【リサーチボード・キックオフ】これはUIボタンからの内部指示です（ユーザーの発話ではありません）。'
      : '【リサーチボード・キックオフ】これは Research & Memo タブを開いた際の内部指示です（ユーザーの発話ではありません）。';
    const frame = isAccountBoard
      ? 'ここはアカウントサイトの個人ボードで、ユーザーが「自分の目指す方向性・やりたいこと」をあなたと一緒に整理し、根拠（自分の経験・価値観・強み）→ロジック→ビジョン（結論）へと論理を組み立てる場です。'
      : 'ユーザーはこれからリサーチボードで設計デザインの深掘りを始めます。';
    const questions = isAccountBoard
      ? '挨拶は一言だけにして、その人の内発的な動機を引き出す具体的な問いを1〜2個投げかける（例: 3年後に手がけていたい仕事、これまでで一番手応えを感じた瞬間、これだけは譲れないと感じる価値観、避けたい働き方 など）。'
      : '挨拶は一言だけにして、デザイナーの発想力・想像力を掻き立てる具体的な問いを1〜2個投げかける（例: 敷地で一番心が動いた瞬間、施主の暮らしの理想の一場面、参照したい空間体験——プロジェクトの文脈に合わせて選ぶ）。';
    const common =
      '一度に多くを聞かないこと。以後は毎ターン、対話で言語化できた論点・決定・根拠を、' +
      'ユーザーに頼まれなくても research_board_add_items / connect_items でボードへカード化・接続していくこと' +
      '（カードには必ず role を付ける。置いたら一言報告。ボードが成果物、チャットは対話）。';
    if (entry === 'auto') {
      return head + frame +
        'あなたから対話を切り出してください。まず research_board_get でボードの現状を確認すること。' +
        `ボードが空なら: ${questions}` +
        'カードが既にあるなら: 現状を一言で要約し、hints（役割未設定・宙に浮いたカード・根拠のない結論）があればそれを整える一手を1つだけ提案する。' +
        common;
    }
    return head + frame + 'あなたから対話を切り出してください。' + questions + common;
  }, [isAccountBoard]);

  const startAiKickoff = useCallback(() => {
    (async () => {
      const { dispatchChatKickoff } = await import('../../features/projects/chat/chatKickoff');
      await dispatchChatKickoff({ projectId: scope, source: 'sidebar_chat', text: kickoffText('button') });
    })().catch(err => console.error('[research] AI キックオフに失敗:', err));
  }, [scope, kickoffText]);

  // タブを開いたらチャットを自動で開き、このプロジェクトの対話履歴がまだ無ければ
  // AI から最初の一声を送らせる（1アプリセッション=1プロジェクト1回）。
  useEffect(() => {
    if (loading) return; // ボード読込後に実行（キックオフがボードの現状を踏まえられるように）
    // ポップアウト中でなければ本体チャットを開く（ポップアウト中はストア側ガードで no-op）。
    useAppStore.getState().setAIChatOpen(true);
    if (autoKickedProjects.has(scope)) return;
    autoKickedProjects.add(scope);
    (async () => {
      const { useAIChatStore } = await import('../../store/useAIChatStore');
      const chat = useAIChatStore.getState();
      const sessionIds = new Set(chat.getSessionsForProject(scope).map(s => s.id));
      // 既に対話履歴があるプロジェクトでは挨拶し直さない（チャットを開くだけ）
      if (chat.messages.some(m => sessionIds.has(m.sessionId))) return;
      // ★チャットのある場所（本体 or ポップアウト窓）でキックオフを実行する。
      // 自動オープンなのでポップアウト窓のフォーカスは奪わない（focus:false）。
      const { dispatchChatKickoff } = await import('../../features/projects/chat/chatKickoff');
      await dispatchChatKickoff({ projectId: scope, source: 'sidebar_chat', text: kickoffText('auto') }, { focus: false });
    })().catch(err => console.error('[research] 自動キックオフに失敗:', err));
  }, [loading, scope, kickoffText]);

  const handleImageFile = useCallback(async (file: File, pos?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const url = await ResearchCanvasRepository.uploadImage(boardKey, file);
      addItem({ kind: 'image', url, text: '' }, pos);
    } catch (err) {
      console.error('Research canvas image upload failed:', err);
    } finally {
      setUploading(false);
    }
  }, [boardKey, addItem]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // 右の Drive パネルからのドラッグ → URL 参照でそのまま画像カードに（アップロード不要）
    const driveUrl = e.dataTransfer.getData(DRIVE_IMAGE_DND_TYPE);
    if (driveUrl) { addItem({ kind: 'image', url: driveUrl, text: '' }, pos); return; }
    // OS からのファイルドロップ → アップロードして画像カードに
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleImageFile(file, pos);
  }, [screenToFlowPosition, handleImageFile, addItem]);

  const handleAddLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    addItem({ kind: 'link', url: /^https?:\/\//.test(url) ? url : `https://${url}`, text: linkTitle.trim() });
    setLinkUrl(''); setLinkTitle(''); setLinkDialogOpen(false);
  };

  const toolButtonSx = {
    px: 1.25, py: 0.5, fontSize: 12, fontWeight: 700, textTransform: 'none', borderRadius: 2,
    color: 'var(--brand-fg)', bgcolor: 'var(--brand-surface)',
    border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
    '&:hover': { borderColor: '#00BFFF', bgcolor: 'var(--brand-surface)' },
  } as const;

  return (
    <Ctx.Provider value={{ patchItem, patchEdge, addPort, removePort, portsEditable: viewMode === 'free', compact }}>
    <Box ref={wrapperRef}
      sx={{
        position: 'absolute', inset: 0,
        // 接続ハンドルは普段は控えめに、カードにホバーしたときだけはっきり見せる
        '& .react-flow__handle': { opacity: 0.25, transition: 'opacity .12s' },
        '& .react-flow__node:hover .react-flow__handle, & .react-flow__handle:hover, & .react-flow__node.selected .react-flow__handle': { opacity: 1 },
        // ＋/− ボタンの表示は NodeHandles 側の hover 状態で制御（辺/ポート単位）
        // 経路ハイライト: 選択カードの論証チェーン外を減光する
        '& .react-flow__node': { transition: 'opacity .15s' },
        '& .react-flow__node.trace-dim': { opacity: 0.22 },
        // react-flow Controls をダークテーマに合わせる（デフォルトは白背景）
        '& .react-flow__controls': {
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)',
        },
        '& .react-flow__controls-button': {
          bgcolor: 'var(--brand-surface)',
          borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
          width: 28, height: 28,
          '& svg': { fill: 'rgb(var(--brand-fg-rgb) / 0.6)', maxWidth: 12, maxHeight: 12 },
          '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)', '& svg': { fill: '#00BFFF' } },
        },
      }}
      onDrop={handleDrop} onDragOver={e => e.preventDefault()}
      // 右ドラッグ=パンにするため、ブラウザ既定の右クリックメニューを抑止（ポートの右クリック削除は別途動作）
      onContextMenu={e => e.preventDefault()}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onReconnect={onReconnect}
        onEdgeMouseEnter={(_, e) => setHoveredEdgeId(e.id)}
        onEdgeMouseLeave={() => setHoveredEdgeId(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // loose: どの辺のハンドルからでも source/target 両方向に接続できる（矢印を自由に引ける）
        connectionMode={ConnectionMode.Loose}
        // 地図モードは自動配置なのでドラッグ移動・接続を止め、地図を安定させる（選択は可＝経路ハイライト）
        nodesDraggable={viewMode === 'free'}
        nodesConnectable={viewMode === 'free'}
        connectionLineStyle={{ stroke: '#00BFFF', strokeWidth: 1.8 }}
        connectionRadius={28}
        // 左ドラッグ=範囲選択（複数まとめて選択→まとめて移動）、右ドラッグ=画面パン
        selectionOnDrag
        panOnDrag={[2]}
        // false: ノードのドラッグ開始時に選択状態を書き換えない。これで未選択ノードも
        // 「選択→再ドラッグ」の二手を踏まず、一度の左ドラッグでそのまま掴んで動かせる
        // （クリック＝押して離すでの選択はそのまま。selectionOnDrag との競合も解消）。
        selectNodesOnDrag={false}
        // 複数選択して Delete でまとめて削除（接続エッジも自動で除去される）
        deleteKeyCode="Delete"
        multiSelectionKeyCode={['Shift', 'Control', 'Meta']}
        fitView
        fitViewOptions={{ maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="rgb(var(--brand-fg-rgb) / 0.14)" />
        <Controls showInteractive={false} />
        <HelperLines horizontal={helperLineH} vertical={helperLineV} />

        {/* 空キャンバスのスターター（対話が主役。チャットは自動で開き、AIが切り出す） */}
        {!loading && nodes.length === 0 && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 4 }}>
            <Box sx={{ textAlign: 'center', pointerEvents: 'auto', maxWidth: 640, px: 3 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'rgb(var(--brand-fg-rgb) / 0.75)', mb: 0.75 }}>
                リサーチボードを始めましょう
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgb(var(--brand-fg-rgb) / 0.4)', mb: 3 }}>
                {isAccountBoard
                  ? 'SEKKEIYA OS と対話しながら、自分の目指す方向性・やりたいことを根拠→ロジック→ビジョンへ編み上げていきます'
                  : 'SEKKEIYA OS と対話しながら、根拠→ロジック→コンセプトをこのボードに編み上げていきます'}
              </Typography>

              <Box
                onClick={startAiKickoff}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 1.25,
                  px: 2.5, py: 1.5, borderRadius: 3, cursor: 'pointer', textAlign: 'left',
                  bgcolor: 'var(--brand-surface)',
                  border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
                  transition: 'border-color .15s, transform .15s, box-shadow .15s',
                  '&:hover': {
                    borderColor: '#a18cd1',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    '& .starter-icon': { color: '#a18cd1' },
                  },
                }}>
                <AutoAwesomeIcon className="starter-icon" sx={{ fontSize: 22, color: 'rgb(var(--brand-fg-rgb) / 0.45)', transition: 'color .15s' }} />
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-fg)' }}>
                    SEKKEIYA OS に相談
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', color: 'rgb(var(--brand-fg-rgb) / 0.45)', lineHeight: 1.5 }}>
                    AIとの対話で発想を深め、ボードに言語化していく
                  </Typography>
                </Box>
              </Box>

              <Typography sx={{ mt: 2.5, fontSize: '0.7rem', color: 'rgb(var(--brand-fg-rgb) / 0.25)' }}>
                メモ・画像・リンク・知識はツールバーから / 画像はドラッグ&ドロップ・Drive パネルからも追加できます
              </Typography>
            </Box>
          </Box>
        )}

        <Panel position="top-left">
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button startIcon={<StickyNote2OutlinedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
              onClick={() => addItem({ kind: 'note', text: '', color: DEFAULT_NOTE_COLOR })}>
              メモ
            </Button>
            <Button startIcon={uploading ? <CircularProgress size={13} sx={{ color: '#00BFFF' }} /> : <ImageOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={toolButtonSx} disabled={uploading}
              onClick={() => fileInputRef.current?.click()}>
              画像
            </Button>
            <Button startIcon={<LinkRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
              onClick={() => setLinkDialogOpen(true)}>
              リンク
            </Button>
            <Button startIcon={<LocalLibraryRoundedIcon sx={{ fontSize: 15 }} />} sx={toolButtonSx}
              onClick={() => setPickerOpen(true)}>
              知識
            </Button>
            <Button startIcon={<CloudOutlinedIcon sx={{ fontSize: 15 }} />}
              sx={{ ...toolButtonSx, ...(driveOpen ? { borderColor: '#00BFFF', color: '#00BFFF' } : {}) }}
              onClick={() => setDriveOpen(v => !v)}>
              Drive
            </Button>

            {/* ── 表示モード切替（自由配置 ⇄ ロジックの地図）── */}
            <Box sx={{
              display: 'flex', ml: 0.5, borderRadius: 2, overflow: 'hidden',
              border: '1px solid rgb(var(--brand-fg-rgb) / 0.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
              {([
                { mode: 'free' as const, label: '自由配置', icon: <BubbleChartRoundedIcon sx={{ fontSize: 15 }} /> },
                { mode: 'map' as const, label: 'ロジックの地図', icon: <HubRoundedIcon sx={{ fontSize: 15 }} /> },
              ]).map(({ mode, label, icon }) => {
                const active = viewMode === mode;
                return (
                  <Box key={mode} onClick={() => setViewMode(mode)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.5, px: 1.25, py: 0.5,
                      cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                      bgcolor: active ? '#00BFFF' : 'var(--brand-surface)',
                      color: active ? '#000' : 'var(--brand-fg)',
                      '&:hover': active ? {} : { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)' },
                    }}>
                    {icon}{label}
                  </Box>
                );
              })}
            </Box>

            {viewMode === 'free' && (
              <Button startIcon={aligning ? <CircularProgress size={13} sx={{ color: '#00BFFF' }} /> : <AccountTreeRoundedIcon sx={{ fontSize: 15 }} />}
                sx={toolButtonSx} disabled={aligning || loading || edges.length === 0}
                onClick={() => autoAlign()}>
                整列
              </Button>
            )}

            {/* カード表示密度: コンパクト（タイトルだけ）⇄ 詳細（全文） */}
            <Button
              startIcon={compact ? <UnfoldMoreRoundedIcon sx={{ fontSize: 15 }} /> : <UnfoldLessRoundedIcon sx={{ fontSize: 15 }} />}
              sx={{ ...toolButtonSx, ...(compact ? { borderColor: '#00BFFF', color: '#00BFFF' } : {}) }}
              onClick={() => setCompact(v => !v)}
              title={compact ? 'クリックで詳細表示（全文）に切替' : 'クリックでコンパクト表示（タイトルだけ）に切替'}>
              {compact ? '詳細表示' : 'コンパクト'}
            </Button>
            {loading && <CircularProgress size={14} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.4)', ml: 0.5 }} />}
          </Box>
          <Typography sx={{ mt: 0.75, fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.35)' }}>
            {viewMode === 'map'
              ? 'ロジックの地図: 根拠→解釈→結論のレーンにカードを自動配置（手置きは保持されます）／自由配置に戻せます'
              : 'ダブルクリックで編集 / 左ドラッグで範囲選択→まとめて移動・Deleteでまとめて削除 / 右ドラッグで画面移動 / 辺の○をドラッグで接続・＋−で接続口を増減 / 線をクリック→○ドラッグで形を調整（ラベルは右パネル） / Ctrl+Zで戻す'}
          </Typography>
          {saveError && (
            <Typography onClick={flushSave} sx={{
              mt: 0.5, px: 1, py: 0.4, fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 1.5,
              color: '#f87171', bgcolor: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)',
              display: 'inline-block',
            }}>
              ⚠ ボードの保存に失敗しました — クリックで再試行
            </Typography>
          )}
        </Panel>
      </ReactFlow>

      {selectedEdge && (
        <EdgeInspector
          key={selectedEdge.id}
          edge={(selectedEdge.data as { edge: ResearchCanvasEdge }).edge}
          canEditPoints={viewMode === 'free'}
          patchEdge={patchEdge}
          onDelete={() => setEdges(eds => eds.filter(e => e.id !== selectedEdge.id))}
          onClose={() => setEdges(eds => eds.map(e => (e.selected ? { ...e, selected: false } : e)))}
          rightPx={driveOpen ? 12 + 264 + 8 : 12}
        />
      )}

      <DriveAssetSidebar
        open={driveOpen}
        onClose={() => setDriveOpen(false)}
        onPick={url => addItem({ kind: 'image', url, text: '' })}
      />

      <input ref={fileInputRef} type="file" accept="image/*" hidden
        onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />

      <KnowledgePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={partials => {
          // ビューポート中心を起点に、複数枚は縦に少しずつずらして重なりを避ける
          const c = viewportCenter();
          partials.forEach((p, i) => addItem(p, { x: c.x + (i % 2) * 40, y: c.y + i * 60 }));
        }}
      />

      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', borderRadius: 3, color: 'var(--brand-fg)' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '0.95rem', pb: 1 }}>リンクを追加</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField label="URL *" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} fullWidth size="small" autoFocus
            placeholder="https://..."
            InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
            InputProps={{ sx: { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
            sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }} />
          <TextField label="タイトル" value={linkTitle} onChange={e => setLinkTitle(e.target.value)} fullWidth size="small"
            onKeyDown={e => { if (e.key === 'Enter') handleAddLink(); }}
            InputLabelProps={{ sx: { color: 'rgb(var(--brand-fg-rgb) / 0.5)', '&.Mui-focused': { color: '#00BFFF' } } }}
            InputProps={{ sx: { color: 'var(--brand-fg)', '& fieldset': { borderColor: 'rgb(var(--brand-fg-rgb) / 0.15)' } } }}
            sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: '#00BFFF' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLinkDialogOpen(false)} sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', textTransform: 'none' }}>キャンセル</Button>
          <Button onClick={handleAddLink} disabled={!linkUrl.trim()} variant="contained"
            sx={{ bgcolor: '#00BFFF', color: '#000', fontWeight: 700, textTransform: 'none', borderRadius: 2,
              '&:hover': { bgcolor: '#4facfe' }, '&:disabled': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.1)', color: 'rgb(var(--brand-fg-rgb) / 0.3)' } }}>
            追加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </Ctx.Provider>
  );
};

/** Research & Memo タブの無限キャンバス（Miro風・論証グラフ）。boardKey でボードを指定。 */
export const ResearchCanvas: React.FC<Props> = ({ boardKey }) => (
  <ReactFlowProvider key={boardKey}>
    <CanvasInner boardKey={boardKey} />
  </ReactFlowProvider>
);

export default ResearchCanvas;
