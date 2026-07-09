// 家具セマンティックグラフ Phase A — 描画コンポーネント（相性レンズ）。
// ------------------------------------------------------------------
// buildFurnitureGraph（純関数）で算出した nodes/edges を @xyflow/react で描画する。
// 【情報設計】毛玉化を避けるため、意図ある配置にする：
//   - セグメント = subCategory（家具の種類）で「列」に分ける（＝一目で何の仲間か分かる）。
//   - 色 = subCategory ごと。列見出しも出す。
//   - エッジ = companion(相性/一緒に置く=異種間) を主役。similar(似ている/同種) は既定オフ＋トグル。
//   - 孤立(関係なし) はグラフに出さず、左下トレイに件数だけ退避。
// 用途/部屋/ゾーンの階層は右パネル Search&Filter で「絞り込み」として効く（このグラフの外）。
// ノードクリックで onSelectModel（＋centerId 連動で ego 再展開）。

import React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls,
  Handle, Position, useReactFlow,
  type Node, type NodeProps, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography } from '@mui/material';
import {
  buildFurnitureGraph,
  type FurnitureItemInput, type FurnitureGraphNode, type FurnitureGraphKind,
} from './buildFurnitureGraph';

// エッジ種の見た目。companion を主役（濃・太）、similar は従（淡・破線）。
const EDGE_STYLES: Record<FurnitureGraphKind, { label: string; color: string; dash?: string; width: number }> = {
  direct:    { label: 'セット', color: '#ffb74d', width: 2.6 },
  companion: { label: '相性（一緒に置く）', color: '#26a69a', width: 2.2 },
  similar:   { label: '似ている（置換候補）', color: '#8892a0', width: 1.3, dash: '5 4' },
};

// subCategory を安定配色するためのパレット（列見出し・ノード枠に使用）。
const SEG_PALETTE = ['#26a69a', '#4facfe', '#a18cd1', '#ffb74d', '#f06292', '#66bb6a', '#ff8a65', '#9575cd', '#4db6ac', '#ba68c8', '#4dd0e1', '#aed581'];

const NODE_W = 150;
const NODE_H = 96;
const COL_GAP = 210;   // 列（subCategory）間の水平間隔
const ROW_GAP = 118;   // 列内ノードの垂直間隔
const HEADER_Y = -46;  // 列見出しの y

type FNodeData = { node: FurnitureGraphNode; selected: boolean; center: boolean; color: string };
type GLabelData = { text: string; count: number; color: string };

// ── サムネ＋タイトル＋subCategory の家具ノード ──
const FurnitureNode: React.FC<NodeProps> = ({ data }) => {
  const { node, selected, center, color } = data as FNodeData;
  const ring = center ? '#4facfe' : selected ? '#ffffff' : color;
  return (
    <Box sx={{ position: 'relative', width: NODE_W, borderRadius: 1.5, overflow: 'hidden',
      bgcolor: 'light-dark(rgba(255,255,255,0.97), rgba(20,26,38,0.97))',
      border: `${center || selected ? 2.5 : 1.5}px solid ${ring}`,
      boxShadow: center ? '0 0 0 3px rgba(79,172,254,0.28)' : `0 2px 10px ${color}22` }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 6, height: 6, border: 'none' }} />
      <Box sx={{ width: '100%', height: 60, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {node.thumbnailUrl ? (
          <Box component="img" src={node.thumbnailUrl} alt="" draggable={false}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Typography sx={{ fontSize: 10, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>
            {node.subCategory || 'no image'}
          </Typography>
        )}
      </Box>
      <Box sx={{ px: 0.75, py: 0.5, borderTop: `2px solid ${color}` }}>
        <Typography sx={{ fontSize: 10.5, lineHeight: 1.3, color: 'var(--brand-fg)', fontWeight: 600,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.label}
        </Typography>
      </Box>
      <Handle type="source" position={Position.Right} style={{ background: color, width: 6, height: 6, border: 'none' }} />
    </Box>
  );
};

// ── 列見出し（subCategory）──
const GroupLabelNode: React.FC<NodeProps> = ({ data }) => {
  const { text, count, color } = data as GLabelData;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.35, borderRadius: 1,
      bgcolor: `${color}22`, border: `1px solid ${color}`, pointerEvents: 'none' }}>
      <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: color }} />
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-fg)' }}>{text}</Typography>
      <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.55)' }}>{count}</Typography>
    </Box>
  );
};

const nodeTypes = { furniture: FurnitureNode, grouplabel: GroupLabelNode };

/** subCategory ごとに列を作る配置。companion は列間、similar は列内に自然に落ちる。 */
function computeLayout(
  gNodes: FurnitureGraphNode[],
  selectedId: string | null,
  centerId: string | null,
): Node[] {
  // subCategory でグルーピング（単値なので列がきれいに割れる）。
  const groups = new Map<string, FurnitureGraphNode[]>();
  for (const n of gNodes) {
    const key = n.subCategory || '未分類';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(n);
  }
  // 件数の多い順に列を並べる（安定）。
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  const segColor = new Map<string, string>();
  ordered.forEach(([seg], i) => segColor.set(seg, SEG_PALETTE[i % SEG_PALETTE.length]));

  const nodes: Node[] = [];
  ordered.forEach(([seg, list], col) => {
    const color = segColor.get(seg)!;
    nodes.push({
      id: `__grp__${seg}`, type: 'grouplabel', selectable: false, draggable: false, connectable: false,
      position: { x: col * COL_GAP, y: HEADER_Y },
      data: { text: seg, count: list.length, color } as GLabelData,
    });
    list.forEach((n, row) => {
      nodes.push({
        id: n.id, type: 'furniture',
        position: { x: col * COL_GAP, y: row * ROW_GAP },
        data: { node: n, selected: n.id === selectedId, center: n.id === centerId, color } as FNodeData,
      });
    });
  });
  return nodes;
}

const FitOnData: React.FC<{ dep: unknown }> = ({ dep }) => {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.18, duration: 300 }), 60);
    return () => clearTimeout(t);
  }, [dep, fitView]);
  return null;
};

export interface DssFurnitureGraphProps {
  /** S.Model の家具アイテム配列（dedupedItemsForGrid をそのまま）。*/
  items: FurnitureItemInput[];
  /** ego-graph の中心。未指定なら全体の非孤立グラフ。*/
  centerId?: string | null;
  /** ハイライト対象（選択中）。*/
  selectedId?: string | null;
  /** ego 展開のホップ数（既定 1）。*/
  hops?: number;
  /** ノードクリック → 選択（RightPanel 連携）。*/
  onSelectModel?: (item: FurnitureItemInput) => void;
  /** ノードダブルクリック → その家具を中心に再展開。*/
  onRecenter?: (id: string) => void;
  height?: number | string;
}

const DssFurnitureGraphInner: React.FC<DssFurnitureGraphProps> = ({
  items, centerId = null, selectedId = null, hops = 1, onSelectModel, onRecenter, height = '100%',
}) => {
  // similar（似ている/同種）は毛玉の主因なので既定オフ。トグルで表示。
  const [showSimilar, setShowSimilar] = React.useState(false);

  const graph = React.useMemo(
    () => buildFurnitureGraph(items || [], { centerId, hops, includeSimilar: showSimilar }),
    [items, centerId, hops, showSimilar],
  );

  const { rfNodes, rfEdges } = React.useMemo(() => {
    const nodes = computeLayout(graph.nodes, selectedId, centerId);
    const edges: Edge[] = graph.edges.map((e) => {
      const st = EDGE_STYLES[e.kind];
      return {
        id: e.id, source: e.source, target: e.target, animated: false,
        style: { stroke: st.color, strokeWidth: st.width, strokeDasharray: st.dash, opacity: e.kind === 'similar' ? 0.5 : 0.9 },
      };
    });
    return { rfNodes: nodes, rfEdges: edges };
  }, [graph, selectedId, centerId]);

  const sig = React.useMemo(
    () => graph.nodes.map((n) => n.id).join(',') + '|' + graph.edges.length + '|' + selectedId + '|' + showSimilar,
    [graph, selectedId, showSimilar],
  );

  const handleNodeClick = React.useCallback((_: React.MouseEvent, n: Node) => {
    if (n.type !== 'furniture') return;
    const gn = (n.data as FNodeData)?.node;
    if (gn && onSelectModel) onSelectModel(gn.raw);
  }, [onSelectModel]);

  const handleNodeDouble = React.useCallback((_: React.MouseEvent, n: Node) => {
    if (n.type === 'furniture' && onRecenter) onRecenter(n.id);
  }, [onRecenter]);

  if (!items || items.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: 12, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>家具がありません</Typography>
      </Box>
    );
  }

  const centerLonely = !!centerId && graph.nodes.length <= 1;
  const nothingShown = graph.nodes.length === 0;

  return (
    <Box sx={{ position: 'relative', height, borderRadius: 1.5, overflow: 'hidden',
      border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
      '& .react-flow__attribution': { display: 'none' } }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        elementsSelectable
        minZoom={0.1}
        panOnScroll
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDouble}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgb(var(--brand-fg-rgb) / 0.1)" />
        <Controls showInteractive={false} />
        <FitOnData dep={sig} />
      </ReactFlow>

      {/* 凡例（エッジ種）＋ similar トグル */}
      <Box sx={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1,
        bgcolor: 'light-dark(rgba(255,255,255,0.82), rgba(15,20,30,0.82))', px: 1, py: 0.5, borderRadius: 1 }}>
        {(['companion', 'direct'] as FurnitureGraphKind[]).map((k) => (
          <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pointerEvents: 'none' }}>
            <Box sx={{ width: 14, height: 0, borderTop: `${EDGE_STYLES[k].width}px solid ${EDGE_STYLES[k].color}` }} />
            <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.65)' }}>{EDGE_STYLES[k].label}</Typography>
          </Box>
        ))}
        <Box
          onClick={() => setShowSimilar((v) => !v)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.4, cursor: 'pointer', px: 0.6, py: 0.15, borderRadius: 0.75,
            border: `1px solid ${showSimilar ? EDGE_STYLES.similar.color : 'rgb(var(--brand-fg-rgb) / 0.25)'}`,
            bgcolor: showSimilar ? `${EDGE_STYLES.similar.color}22` : 'transparent' }}
        >
          <Box sx={{ width: 14, height: 0, borderTop: `${EDGE_STYLES.similar.width}px dashed ${EDGE_STYLES.similar.color}` }} />
          <Typography sx={{ fontSize: 9, color: 'rgb(var(--brand-fg-rgb) / 0.75)' }}>
            {EDGE_STYLES.similar.label}{showSimilar ? '' : '（表示）'}
          </Typography>
        </Box>
      </Box>

      {/* 統計＋未整備トレイ */}
      <Box sx={{ position: 'absolute', bottom: 8, left: 8,
        bgcolor: 'light-dark(rgba(255,255,255,0.82), rgba(15,20,30,0.82))', px: 1, py: 0.5, borderRadius: 1,
        pointerEvents: 'none' }}>
        <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>
          関係 {graph.stats.edgeCount} ・ ノード {graph.stats.shownNodes}
          {graph.stats.isolatedCount > 0 && ` ・ 未整備 ${graph.stats.isolatedCount}件`}
        </Typography>
      </Box>

      {(centerLonely || nothingShown) && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          textAlign: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 11, color: 'rgb(var(--brand-fg-rgb) / 0.5)' }}>
            {centerLonely
              ? 'この家具に繋がる相性が見つかりません（メタデータ未整備の可能性）'
              : '相性の関係が見つかりません。左上「似ている」を表示すると同種のつながりが出ます'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export const DssFurnitureGraph: React.FC<DssFurnitureGraphProps> = (props) => (
  <ReactFlowProvider>
    <DssFurnitureGraphInner {...props} />
  </ReactFlowProvider>
);
