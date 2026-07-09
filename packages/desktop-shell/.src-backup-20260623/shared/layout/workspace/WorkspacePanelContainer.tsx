import React, { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useAppStore } from '../../../store/useAppStore';
import ProjectHome from '../../../pages/ProjectHome';
import { DssAdapter, DslAdapter, DspAdapter, DscAdapter, AiCanvasAdapter, DsdAdapter, DsrAdapter, DsiAdapter, DsqAdapter, DsfAdapter } from './Adapters';
const FIXED_PANELS = [
  { id: 'models', type: 'ModelsPanel' },
  { id: 'layout', type: 'LayoutPanel' },
  { id: 'presents', type: 'PresentsPanel' },
  { id: 'create', type: 'CreatePanel' },
  { id: 'canvas', type: 'CanvasPanel' },
  { id: 'diagram', type: 'DiagramPanel' },
  { id: 'drawing', type: 'DrawingPanel' },
  { id: 'image', type: 'ImagePanel' },
  { id: 'quest', type: 'QuestPanel' },
  { id: 'portfolio', type: 'PortfolioPanel' },
];

export const WorkspacePanelContainer: React.FC = () => {
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const getActiveWorkspace = useAppStore(s => s.getActiveWorkspace);

  const [mountedPanels, setMountedPanels] = useState<Set<string>>(new Set());
  // 各パネルが「アクティブだったときに渡された payload」を記憶しておく。
  // 非アクティブになっても payload を保持し続けることで、子アプリ（エディタ等）が
  // アンマウントされず、作業中の状態をそのまま残したままタブを行き来できる。
  const [panelPayloads, setPanelPayloads] = useState<Record<string, any>>({});

  useEffect(() => {
    if (activeWorkspaceId) {
      setMountedPanels(prev => {
        if (prev.has(activeWorkspaceId)) return prev;
        const next = new Set(prev);
        next.add(activeWorkspaceId);
        return next;
      });
    }
  }, [activeWorkspaceId]);

  // アクティブなパネルの最新 payload を記憶する
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const rawWs = getActiveWorkspace();
    const payload = {
      projectId: activeProjectId || '',
      workspaceId: activeWorkspaceId,
      workspaceName: rawWs?.name || '',
      appScope: (rawWs as any)?.appScope || (rawWs as any)?.workspaceType || '',
    };
    setPanelPayloads(prev => {
      const existing = prev[activeWorkspaceId];
      if (
        existing &&
        existing.projectId === payload.projectId &&
        existing.workspaceName === payload.workspaceName &&
        existing.appScope === payload.appScope
      ) {
        return prev;
      }
      return { ...prev, [activeWorkspaceId]: payload };
    });
  }, [activeWorkspaceId, activeProjectId, getActiveWorkspace]);

  if (!activeWorkspaceId) {
    // If no specific workspace tab is open, we can show the Overview or an empty state
    return (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, bgcolor: 'background.default' }}>
        <ProjectHome />
      </Box>
    );
  }

  const rawWs = getActiveWorkspace();
  const adapterPayload = {
    projectId: activeProjectId || '',
    workspaceId: activeWorkspaceId,
    workspaceName: rawWs?.name || '',
    appScope: (rawWs as any)?.appScope || (rawWs as any)?.workspaceType || ''
  };

  // Render fixed panels, display current one (KeepAlive)
  return (
    <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {FIXED_PANELS.map(panel => {
        const isActive = panel.id === activeWorkspaceId;
        const isMounted = mountedPanels.has(panel.id);

        if (!isMounted && !isActive) return null;

        // アクティブパネルは最新の payload を、非アクティブパネルは記憶済みの
        // payload を渡し続ける。これにより非アクティブ中もエディタが生き続け、
        // 作業中の状態を保持したままタブ切り替えができる。
        const panelPayload = isActive ? adapterPayload : panelPayloads[panel.id];
        if (!panelPayload) return null;

        return (
          <Box
            key={panel.id}
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: isActive ? 'flex' : 'none',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <PanelRenderer type={panel.type} payload={panelPayload} />
          </Box>
        );
      })}
    </Box>
  );
};

// Assuming payload is passed simply to trigger rendering context
const PanelRenderer: React.FC<{ type: string; payload?: any }> = ({ type, payload }) => {
  switch (type) {
    case 'ProjectOverview':
      return <ProjectHome />;
    case 'ModelsPanel':
      return <DssAdapter payload={payload} />;
    case 'LayoutPanel':
        return <DslAdapter payload={payload} />;
    case 'PresentsPanel':
        return <DspAdapter payload={payload} />;
    case 'CreatePanel':
        return <DscAdapter payload={payload} />;
    case 'CanvasPanel':
        return <AiCanvasAdapter payload={payload} />;
    case 'DiagramPanel':
        return <DsdAdapter payload={payload} />;
    case 'DrawingPanel':
        return <DsrAdapter payload={payload} />;
    case 'ImagePanel':
        return <DsiAdapter payload={payload} />;
    case 'QuestPanel':
        return <DsqAdapter payload={payload} />;
    case 'PortfolioPanel':
        return <DsfAdapter payload={payload} />;
    default:
      return (
        <Box sx={{ flex: 1, p: 4 }}>
          <Typography variant="h6" color="#ff9800">Unknown Panel Type: {type}</Typography>
        </Box>
      );
  }
};
