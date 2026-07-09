/**
 * MemoryGraph — AIメモリーのセマンティックグラフビュー（docs/21 Phase B''）。
 *
 * ノード = メモリー（紫=ユーザー / オレンジ=プロジェクト）と、概念ハブ = トピック。
 * 各メモリーが自分の topics に線で繋がることで、共通トピックを持つ記憶が自然に
 * クラスタ化し「人物像＋案件」の意味的な網が見える。ノードクリックで詳細（編集/削除）へ。
 *
 * レイアウトは軽量な力学（Fruchterman-Reingold 風）をクライアントで1回計算する。
 * 決定論的初期化（index ベース・乱数不使用）なので再描画で配置が飛ばない。
 */
import React, { useMemo } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography } from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { memoryTypeLabel, type AiMemory, type MemoryScope } from './aiMemoryApi';

const SCOPE_COLOR: Record<MemoryScope, { border: string; bg: string; fg: string }> = {
  user: { border: 'rgba(168,85,247,0.6)', bg: 'rgba(168,85,247,0.10)', fg: 'light-dark(#470ea0, #c4a3f7)' },
  project: { border: 'rgba(245,158,11,0.65)', bg: 'rgba(245,158,11,0.10)', fg: 'light-dark(#9a5b00, #fcd34d)' },
};

// ── 力学レイアウト（決定論的・乱数不使用） ──────────────────────────────────
// Fruchterman-Reingold（斥力＋引力）に「中心への重力」を足したもの。重力が無いと、
// トピックを共有しない（＝エッジのない）メモリー同士が斥力だけで無限に離れてしまうため、
// 距離比例の重力で全体をコンパクトに保つ。適用は線形積分（重力を打ち消さない）。
interface XY { x: number; y: number }
function computeLayout(ids: string[], edges: [string, string][], iterations = 140): Map<string, XY> {
  const n = ids.length;
  const pos = new Map<string, XY>();
  if (!n) return pos;
  // 初期配置: index ベースで小さな渦に並べる（黄金角でばらけさせる・乱数不使用）
  ids.forEach((id, i) => {
    const a = (i / n) * Math.PI * 2 * 1.61803;
    const r = 30 + i * 3;
    pos.set(id, { x: Math.cos(a) * r, y: Math.sin(a) * r });
  });
  const idx = new Map(ids.map((id, i) => [id, i]));
  const adj: [number, number][] = edges
    .map(([a, b]) => [idx.get(a)!, idx.get(b)!] as [number, number])
    .filter(([a, b]) => a !== undefined && b !== undefined);
  const k = 140;         // 理想エッジ長（ノード幅相応。近づきすぎ/離れすぎを防ぐ）
  const gravity = 0.10;  // 中心への引き戻し（切り離しクラスタの発散を抑える肝）
  const maxStep = 48;    // 1反復あたりの最大移動量
  const arr = ids.map((id) => pos.get(id)!);
  let alpha = 0.9;       // 学習率（徐々に下げて収束させる）
  for (let it = 0; it < iterations; it++) {
    const disp = arr.map(() => ({ x: 0, y: 0 }));
    // 斥力（全ペア）
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = arr[i].x - arr[j].x;
        let dy = arr[i].y - arr[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rep = (k * k) / dist;
        dx = (dx / dist) * rep; dy = (dy / dist) * rep;
        disp[i].x += dx; disp[i].y += dy;
        disp[j].x -= dx; disp[j].y -= dy;
      }
    }
    // 引力（エッジ）
    for (const [a, b] of adj) {
      let dx = arr[a].x - arr[b].x;
      let dy = arr[a].y - arr[b].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const att = (dist * dist) / k;
      dx = (dx / dist) * att; dy = (dy / dist) * att;
      disp[a].x -= dx; disp[a].y -= dy;
      disp[b].x += dx; disp[b].y += dy;
    }
    // 重力（中心へ・距離比例）
    for (let i = 0; i < n; i++) { disp[i].x -= gravity * arr[i].x; disp[i].y -= gravity * arr[i].y; }
    // 適用（線形・1反復の移動量を maxStep でクランプ）
    for (let i = 0; i < n; i++) {
      let mx = (disp[i].x * alpha) / 30;
      let my = (disp[i].y * alpha) / 30;
      const m = Math.sqrt(mx * mx + my * my);
      if (m > maxStep) { mx = (mx / m) * maxStep; my = (my / m) * maxStep; }
      arr[i].x += mx; arr[i].y += my;
    }
    alpha = Math.max(0.05, alpha * 0.965);
  }
  ids.forEach((id, i) => pos.set(id, arr[i]));
  return pos;
}

// ── ノード ─────────────────────────────────────────────────────────────────
const hiddenHandle = { opacity: 0, width: 1, height: 1, border: 'none', minWidth: 0, minHeight: 0 } as const;

const MemoryNode: React.FC<NodeProps> = ({ data, selected }) => {
  const m = (data as any).memory as AiMemory;
  const scope = (data as any).scope as MemoryScope;
  const c = SCOPE_COLOR[scope];
  return (
    <Box sx={{
      width: 168, px: 1.25, py: 1, borderRadius: 2.5, boxSizing: 'border-box', cursor: 'pointer',
      bgcolor: 'var(--brand-surface)', border: '1.5px solid', borderColor: selected ? c.fg : c.border,
      boxShadow: selected ? `0 0 0 3px ${c.bg}, 0 8px 22px rgba(0,0,0,0.3)` : '0 3px 10px rgba(0,0,0,0.2)',
      transition: 'box-shadow .12s, border-color .12s',
    }}>
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c.border, flexShrink: 0 }} />
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: c.fg, letterSpacing: 0.3 }}>
          {memoryTypeLabel(m.type)}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.85)', lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {m.text}
      </Typography>
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </Box>
  );
};

const TopicNode: React.FC<NodeProps> = ({ data }) => {
  const name = (data as any).name as string;
  const degree = (data as any).degree as number;
  const shared = degree >= 2;
  return (
    <Box sx={{
      px: 1.25, py: 0.5, borderRadius: 999, boxSizing: 'border-box',
      bgcolor: shared ? 'rgb(var(--brand-fg-rgb) / 0.10)' : 'rgb(var(--brand-fg-rgb) / 0.04)',
      border: '1px dashed rgb(var(--brand-fg-rgb) / 0.28)',
    }}>
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Typography sx={{ fontSize: shared ? 11 : 9.5, fontWeight: shared ? 700 : 500,
        color: `rgb(var(--brand-fg-rgb) / ${shared ? 0.7 : 0.45})`, whiteSpace: 'nowrap' }}>
        #{name}
      </Typography>
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
    </Box>
  );
};

const nodeTypes = { memory: MemoryNode, topic: TopicNode };

interface MemoryGraphProps {
  userMemories: AiMemory[];
  projectMemories: AiMemory[];
  onOpenMemory: (m: AiMemory, scope: MemoryScope) => void;
}

const MemoryGraphInner: React.FC<MemoryGraphProps> = ({ userMemories, projectMemories, onOpenMemory }) => {
  const { nodes, edges } = useMemo(() => {
    const mems: { m: AiMemory; scope: MemoryScope }[] = [
      ...userMemories.filter((m) => m.status === 'active').map((m) => ({ m, scope: 'user' as const })),
      ...projectMemories.filter((m) => m.status === 'active').map((m) => ({ m, scope: 'project' as const })),
    ];
    // トピックの次数（共有度）を数える
    const topicDeg = new Map<string, number>();
    mems.forEach(({ m }) => m.topics.forEach((t) => topicDeg.set(t, (topicDeg.get(t) || 0) + 1)));

    const ids: string[] = [];
    const edgeList: [string, string][] = [];
    mems.forEach(({ m, scope }) => {
      const mid = `m:${scope}:${m.id}`;
      ids.push(mid);
      m.topics.forEach((t) => edgeList.push([mid, `t:${t}`]));
    });
    Array.from(topicDeg.keys()).forEach((t) => ids.push(`t:${t}`));

    const pos = computeLayout(ids, edgeList);

    const rfNodes: Node[] = [
      ...mems.map(({ m, scope }) => {
        const id = `m:${scope}:${m.id}`;
        return {
          id, type: 'memory', position: pos.get(id) || { x: 0, y: 0 },
          data: { memory: m, scope }, draggable: true,
        } as Node;
      }),
      ...Array.from(topicDeg.entries()).map(([t, deg]) => {
        const id = `t:${t}`;
        return {
          id, type: 'topic', position: pos.get(id) || { x: 0, y: 0 },
          data: { name: t, degree: deg }, draggable: true,
        } as Node;
      }),
    ];
    const rfEdges: Edge[] = edgeList.map(([a, b], i) => ({
      id: `e${i}`, source: a, target: b,
      style: { stroke: 'rgb(var(--brand-fg-rgb) / 0.18)', strokeWidth: 1 },
    }));
    return { nodes: rfNodes, edges: rfEdges };
  }, [userMemories, projectMemories]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%',
      '& .react-flow__controls': { border: '1px solid rgb(var(--brand-fg-rgb) / 0.12)', borderRadius: '10px', overflow: 'hidden' },
      '& .react-flow__controls-button': { bgcolor: 'var(--brand-surface)', borderBottom: '1px solid rgb(var(--brand-fg-rgb) / 0.08)',
        '& svg': { fill: 'rgb(var(--brand-fg-rgb) / 0.6)' }, '&:hover': { bgcolor: 'rgb(var(--brand-fg-rgb) / 0.08)' } } }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.type === 'memory') onOpenMemory((node.data as any).memory, (node.data as any).scope);
        }}
        fitView
        fitViewOptions={{ maxZoom: 1.3, padding: 0.25 }}
        minZoom={0.15}
        maxZoom={2.5}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color="rgb(var(--brand-fg-rgb) / 0.12)" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* 凡例 */}
      <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 1.5, px: 1.5, py: 0.75,
        borderRadius: 2, bgcolor: 'var(--brand-surface)', border: '1px solid rgb(var(--brand-fg-rgb) / 0.1)', zIndex: 5 }}>
        <LegendDot color={SCOPE_COLOR.user.border} icon={<PersonRoundedIcon sx={{ fontSize: 12 }} />} label="ユーザー" />
        <LegendDot color={SCOPE_COLOR.project.border} icon={<FolderRoundedIcon sx={{ fontSize: 12 }} />} label="プロジェクト" />
      </Box>

      {!nodes.length && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 13, color: 'rgb(var(--brand-fg-rgb) / 0.4)', textAlign: 'center', lineHeight: 1.9 }}>
            まだ表示できるメモリーがありません。<br />AIとの議論を重ねると、ここに考え方の網が育ちます。
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const LegendDot: React.FC<{ color: string; icon: React.ReactNode; label: string }> = ({ color, icon, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: color }} />
    <Box sx={{ color: 'rgb(var(--brand-fg-rgb) / 0.5)', display: 'flex' }}>{icon}</Box>
    <Typography sx={{ fontSize: 10.5, color: 'rgb(var(--brand-fg-rgb) / 0.6)' }}>{label}</Typography>
  </Box>
);

export const MemoryGraph: React.FC<MemoryGraphProps> = (props) => (
  <ReactFlowProvider>
    <MemoryGraphInner {...props} />
  </ReactFlowProvider>
);
