import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Handle, Position,
  useNodesState, useEdgesState, type Node, type Edge, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Typography, Stack } from '@mui/material';
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { WorkflowDef } from './workflowTypes';

const ACCENT = '#c4a3f7';
const NODE_BG = '#141821';
const NODE_W = 210;

// ノードは「表示＋選択」のみ。編集は右インスペクタで行う。
interface CanvasCtx {
  draft: WorkflowDef;
  selectedNodeId: string | null;
}
const Ctx = createContext<CanvasCtx | null>(null);
const useCanvasCtx = () => useContext(Ctx)!;

const portStyle = { width: 9, height: 9, background: NODE_BG, border: `2px solid ${ACCENT}` } as const;

const nodeShell = (selected: boolean, tone: { bg: string; border: string }, extra?: object) => ({
  width: NODE_W, p: 1.1, borderRadius: 2, cursor: 'pointer',
  bgcolor: tone.bg,
  border: `1px solid ${selected ? ACCENT : tone.border}`,
  boxShadow: selected ? `0 0 0 2px rgba(196,163,247,0.35), 0 6px 18px rgba(0,0,0,0.4)` : 'none',
  transition: 'box-shadow .12s, border-color .12s',
  ...extra,
});

const TriggerNode: React.FC<NodeProps> = ({ id }) => {
  const { draft, selectedNodeId } = useCanvasCtx();
  return (
    <Box sx={nodeShell(selectedNodeId === id, { bg: 'rgba(79,195,247,0.08)', border: 'rgba(79,195,247,0.45)' })}>
      <Handle type="source" position={Position.Right} style={portStyle} />
      <Stack direction="row" alignItems="center" spacing={0.6}>
        <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 15, color: '#4fc3f7' }} />
        <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>話しかけ</Typography>
      </Stack>
      <Typography sx={{ fontSize: 10.5, color: 'rgba(255,255,255,0.5)', mt: 0.3 }}>
        {draft.triggers.length > 0 ? `${draft.triggers.length} 件の言い回し` : '言い回し未登録'}
      </Typography>
    </Box>
  );
};

const StepNode: React.FC<NodeProps> = ({ id, data }) => {
  const { draft, selectedNodeId } = useCanvasCtx();
  const stepId = (data as any).stepId as string;
  const idx = draft.steps.findIndex((s) => s.id === stepId);
  if (idx < 0) return null;
  const step = draft.steps[idx];
  const on = step.enabled;
  const tone = on ? { bg: 'rgba(196,163,247,0.08)', border: 'rgba(196,163,247,0.45)' } : { bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' };
  return (
    <Box sx={nodeShell(selectedNodeId === id, tone, { opacity: on ? 1 : 0.6 })}>
      <Handle type="target" position={Position.Left} style={portStyle} />
      <Handle type="source" position={Position.Right} style={portStyle} />
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, color: on ? '#1a1030' : 'rgba(255,255,255,0.4)', bgcolor: on ? ACCENT : 'rgba(255,255,255,0.08)' }}>{idx + 1}</Box>
        <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: '#fff' }}>{step.label}</Typography>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5, pl: 3.5 }}>
        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: on ? ACCENT : 'rgba(255,255,255,0.35)' }}>{on ? '使う' : 'スキップ'}</Typography>
        {step.branches && (
          <Stack direction="row" alignItems="center" spacing={0.25}>
            <CallSplitRoundedIcon sx={{ fontSize: 12, color: ACCENT }} />
            <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)' }}>分岐 {step.branches.length}</Typography>
          </Stack>
        )}
      </Stack>
    </Box>
  );
};

const EndNode: React.FC<NodeProps> = ({ id }) => {
  const { selectedNodeId } = useCanvasCtx();
  return (
    <Box sx={nodeShell(selectedNodeId === id, { bg: 'rgba(110,231,168,0.08)', border: 'rgba(110,231,168,0.45)' }, { width: 176 })}>
      <Handle type="target" position={Position.Left} style={portStyle} />
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <CheckCircleRoundedIcon sx={{ fontSize: 17, color: '#6ee7a8' }} />
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>完了・成果物</Typography>
          <Typography sx={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)' }}>結果を報告 / Webに反映</Typography>
        </Box>
      </Stack>
    </Box>
  );
};

const nodeTypes = { trigger: TriggerNode, step: StepNode, end: EndNode };

const NODE_GAP = 250;
const ROW_Y = 90;
function autoPos(id: string, order: number, layout?: WorkflowDef['layout'], live?: Record<string, { x: number; y: number }>): { x: number; y: number } {
  return live?.[id] ?? layout?.[id] ?? { x: 40 + order * NODE_GAP, y: ROW_Y };
}

interface Props {
  draft: WorkflowDef;
  setDraft: React.Dispatch<React.SetStateAction<WorkflowDef>>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  /** 閲覧のみ（公式アカウント以外）。ノード移動を無効化し、選択・パン・ズームだけ許可。 */
  readOnly?: boolean;
}

const CanvasInner: React.FC<Props> = ({ draft, setDraft, selectedNodeId, onSelectNode, readOnly = false }) => {
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const livePos = useRef<Record<string, { x: number; y: number }>>({ ...(draft.layout ?? {}) });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const sig = draft.steps.map((s) => s.id).join('|');
  useEffect(() => {
    const d = draftRef.current;
    const layout = d.layout;
    const ns: Node[] = [];
    ns.push({ id: 'trigger', type: 'trigger', position: autoPos('trigger', 0, layout, livePos.current), data: {} });
    d.steps.forEach((s, i) => ns.push({ id: s.id, type: 'step', position: autoPos(s.id, i + 1, layout, livePos.current), data: { stepId: s.id } }));
    ns.push({ id: 'end', type: 'end', position: autoPos('end', d.steps.length + 1, layout, livePos.current), data: {} });
    setNodes(ns);

    const es: Edge[] = [];
    const chain = ['trigger', ...d.steps.map((s) => s.id), 'end'];
    for (let i = 0; i < chain.length - 1; i++) es.push({ id: `${chain[i]}->${chain[i + 1]}`, source: chain[i], target: chain[i + 1] });
    setEdges(es);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, setNodes, setEdges]);

  const onNodeDragStop = (_e: React.MouseEvent, node: Node) => {
    livePos.current[node.id] = { x: node.position.x, y: node.position.y };
    setDraft((d) => ({ ...d, layout: { ...(d.layout ?? {}), [node.id]: { x: node.position.x, y: node.position.y } } }));
  };

  const ctx: CanvasCtx = { draft, selectedNodeId };

  return (
    <Ctx.Provider value={ctx}>
      {/* react-flow の Controls（＋−⤢）は既定が白背景なのでダークテーマに合わせる */}
      <Box sx={{
        width: '100%', height: '100%',
        '& .react-flow__controls': { boxShadow: '0 4px 14px rgba(0,0,0,0.4)', borderRadius: '8px', overflow: 'hidden' },
        '& .react-flow__controls-button': {
          background: '#1a1f2b', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', width: 26, height: 26,
          '&:hover': { background: '#242b3a' },
          '& svg': { fill: 'rgba(255,255,255,0.75)', maxWidth: 12, maxHeight: 12 },
          '&:last-of-type': { borderBottom: 'none' },
        },
      }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_e, node) => onSelectNode(node.id)}
        onPaneClick={() => onSelectNode(null)}
        nodeTypes={nodeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: 'default', animated: true, style: { stroke: 'rgba(196,163,247,0.7)', strokeWidth: 2 } }}
        style={{ background: NODE_BG }}
      >
        <Background color="rgba(255,255,255,0.06)" gap={22} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
      </Box>
    </Ctx.Provider>
  );
};

export const WorkflowCanvas: React.FC<Props> = (props) => (
  <ReactFlowProvider>
    <CanvasInner {...props} />
  </ReactFlowProvider>
);
