// 論証グラフ（セマンティックグラフ）の読み取り専用ビュー。
// ArticleInsight.graph（Research & Memo と同一の items/edges）を @xyflow/react で描画する。
// 役割＝ノード色（根拠/解釈/結論）、関係＝エッジ色（支持/反証/適用/導出）で ResearchCanvas と一貫。
// dagre で左→右（根拠→結論）に自動整列。編集はせず、閲覧・拡大のみ（編集は Research & Memo 側）。

import React from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls,
  Handle, Position, MarkerType, useReactFlow,
  type Node, type NodeProps, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography } from '@mui/material';
import type {
  ResearchCanvasItem, ResearchCanvasEdge, ResearchNodeRole, ResearchEdgeRelation,
} from '../../projects/repositories/ResearchCanvasRepository';

// ResearchCanvas と揃えた配色（依存の重い本体を import せず定数だけ複製）。
const NODE_ROLES: Record<ResearchNodeRole, { label: string; color: string }> = {
  evidence:       { label: '根拠', color: '#26a69a' },
  interpretation: { label: '解釈', color: '#a18cd1' },
  conclusion:     { label: '結論', color: '#ffb74d' },
};
const EDGE_RELATIONS: Record<ResearchEdgeRelation, { label: string; color: string; dash?: string }> = {
  supports:    { label: '支持', color: '#26a69a' },
  applies:     { label: '適用', color: '#4facfe' },
  derives:     { label: '導出', color: '#a18cd1' },
  contradicts: { label: '反証', color: '#f87171', dash: '6 4' },
};

type InsightNodeData = { text: string; role: ResearchNodeRole; kind: string };

// ── 役割で色分けした読み取り専用ノード ──
const InsightNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as InsightNodeData;
  const role = NODE_ROLES[d.role] || NODE_ROLES.evidence;
  return (
    <Box sx={{ position: 'relative', width: 190, px: 1.25, py: 1, borderRadius: 1.5,
      bgcolor: 'light-dark(rgba(255,255,255,0.96), rgba(20,26,38,0.96))',
      border: `1.5px solid ${role.color}`, boxShadow: `0 2px 10px ${role.color}22` }}>
      <Handle type="target" position={Position.Left} style={{ background: role.color, width: 6, height: 6, border: 'none' }} />
      <Box sx={{ display: 'inline-block', mb: 0.5, px: 0.7, borderRadius: 0.75, bgcolor: role.color,
        color: '#0d1017', fontSize: 9, fontWeight: 800, lineHeight: '14px' }}>{role.label}</Box>
      <Typography sx={{ fontSize: 11, lineHeight: 1.45, color: 'var(--brand-fg)',
        display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {d.text}
      </Typography>
      <Handle type="source" position={Position.Right} style={{ background: role.color, width: 6, height: 6, border: 'none' }} />
    </Box>
  );
};

const nodeTypes = { insight: InsightNode };

const NODE_W = 190;
const NODE_H = 108;

/** dagre で LR 整列した nodes/edges を返す（非同期 import でバンドルを分割）。 */
async function layout(items: ResearchCanvasItem[], edges: ResearchCanvasEdge[]): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const mod: any = await import('@dagrejs/dagre');
  const dagre = mod.default ?? mod;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 80, marginx: 16, marginy: 16 });
  g.setDefaultEdgeLabel(() => ({}));
  items.forEach((it) => g.setNode(it.id, { width: NODE_W, height: NODE_H }));
  const validIds = new Set(items.map((i) => i.id));
  const liveEdges = edges.filter((e) => validIds.has(e.source) && validIds.has(e.target));
  liveEdges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const nodes: Node[] = items.map((it) => {
    const p = g.node(it.id);
    return {
      id: it.id,
      type: 'insight',
      position: p ? { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } : { x: it.x, y: it.y },
      data: { text: it.text || '', role: it.role || 'evidence', kind: it.kind },
      draggable: false,
    };
  });
  const rfEdges: Edge[] = liveEdges.map((e) => {
    const rel = EDGE_RELATIONS[e.relation] || EDGE_RELATIONS.supports;
    return {
      id: e.id, source: e.source, target: e.target,
      label: e.label, animated: false,
      style: { stroke: rel.color, strokeWidth: 1.8, strokeDasharray: rel.dash },
      labelStyle: { fill: 'var(--brand-fg)', fontSize: 9, fontWeight: 600 },
      labelBgStyle: { fill: 'light-dark(rgba(255,255,255,0.85), rgba(15,20,30,0.85))' },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: rel.color, width: 14, height: 14 },
    };
  });
  return { nodes, edges: rfEdges };
}

const FitOnData: React.FC<{ dep: unknown }> = ({ dep }) => {
  const { fitView } = useReactFlow();
  React.useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 60);
    return () => clearTimeout(t);
  }, [dep, fitView]);
  return null;
};

interface Props {
  items: ResearchCanvasItem[];
  edges: ResearchCanvasEdge[];
  height?: number | string;
  showControls?: boolean;
}

const ArgumentGraphInner: React.FC<Props> = ({ items, edges, height = 260, showControls = false }) => {
  const [rf, setRf] = React.useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const sig = React.useMemo(() => items.map((i) => i.id).join(',') + '|' + edges.map((e) => e.id).join(','), [items, edges]);

  React.useEffect(() => {
    let alive = true;
    void layout(items, edges).then((r) => { if (alive) setRf(r); });
    return () => { alive = false; };
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) {
    return (
      <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px dashed rgb(var(--brand-fg-rgb) / 0.2)', borderRadius: 1.5 }}>
        <Typography sx={{ fontSize: 11.5, color: 'rgb(var(--brand-fg-rgb) / 0.4)' }}>グラフはまだありません</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, borderRadius: 1.5, overflow: 'hidden', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)',
      '& .react-flow__attribution': { display: 'none' } }}>
      <ReactFlow
        nodes={rf.nodes}
        edges={rf.edges}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        panOnScroll
        zoomOnScroll={showControls}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgb(var(--brand-fg-rgb) / 0.1)" />
        {showControls && <Controls showInteractive={false} />}
        <FitOnData dep={sig} />
      </ReactFlow>
    </Box>
  );
};

export const ArgumentGraph: React.FC<Props> = (props) => (
  <ReactFlowProvider>
    <ArgumentGraphInner {...props} />
  </ReactFlowProvider>
);

/** グラフの凡例（役割色・関係色）。 */
export const ArgumentGraphLegend: React.FC = () => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.75 }}>
    {(Object.keys(NODE_ROLES) as ResearchNodeRole[]).map((r) => (
      <Box key={r} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
        <Box sx={{ width: 9, height: 9, borderRadius: 0.5, bgcolor: NODE_ROLES[r].color }} />
        <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{NODE_ROLES[r].label}</Typography>
      </Box>
    ))}
    <Box sx={{ width: 1, height: 12, bgcolor: 'rgb(var(--brand-fg-rgb) / 0.15)', mx: 0.25 }} />
    {(Object.keys(EDGE_RELATIONS) as ResearchEdgeRelation[]).map((r) => (
      <Box key={r} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
        <Box sx={{ width: 12, height: 2, bgcolor: EDGE_RELATIONS[r].color,
          borderTop: EDGE_RELATIONS[r].dash ? `2px dashed ${EDGE_RELATIONS[r].color}` : undefined }} />
        <Typography sx={{ fontSize: 9.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{EDGE_RELATIONS[r].label}</Typography>
      </Box>
    ))}
  </Box>
);
