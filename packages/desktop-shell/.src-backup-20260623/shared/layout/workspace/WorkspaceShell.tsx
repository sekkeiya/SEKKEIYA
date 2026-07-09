import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import { WorkspaceTabBar } from './WorkspaceTabBar';
import { WorkspacePanelContainer } from './WorkspacePanelContainer';
import { RightPanelHost } from './RightPanelHost';
import { useAppStore } from '../../../store/useAppStore';
import type { AppScope } from './types';

import { AiCanvasRightSidebar } from '../../../features/ai-canvas/Sidebar/AiCanvasRightSidebar';

export const WorkspaceShell: React.FC = () => {
  const lastLaunchPayload = useAppStore(s => s.lastLaunchPayload);
  const setLastActiveAppScope = useAppStore(s => s.setLastActiveAppScope);
  const setActiveWorkspaceId = useAppStore(s => s.setActiveWorkspaceId);
  const activeWorkspaceId = useAppStore(s => s.activeWorkspaceId);

  // When activeWorkspaceId becomes null (Project Home), force reset the right panel state
  useEffect(() => {
    if (!activeWorkspaceId) {
      import('../../../features/dsl/layout/store/uiRightSidebarStore').then(({ useUiRightSidebarStore }) => {
        useUiRightSidebarStore.getState().resetRightPanels();
      });
    }
  }, [activeWorkspaceId]);

  // Open native tabs dynamically when requested via global launcher
  useEffect(() => {
    if (lastLaunchPayload) {
      const payloadScope = lastLaunchPayload.appScope; // e.g '3DSS'
      const scopeKey = payloadScope.toUpperCase();
      
      const scopeToId: Record<string, string> = {
        '3DSS': 'models',
        '3DSL': 'layout',
        '3DSP': 'presents',
        '3DSC': 'create'
      };
      
      const wsId = scopeToId[scopeKey];
      const normalizedAppScope = payloadScope.toLowerCase() as AppScope;
      
      if (wsId) {
        setLastActiveAppScope(normalizedAppScope);
        setActiveWorkspaceId(wsId);
      }
    }
  }, [lastLaunchPayload, setLastActiveAppScope, setActiveWorkspaceId]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
      <WorkspaceTabBar />
      <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
        <WorkspacePanelContainer />
        {activeWorkspaceId === 'canvas' ? <AiCanvasRightSidebar /> : <RightPanelHost />}
      </Box>
    </Box>
  );
};
