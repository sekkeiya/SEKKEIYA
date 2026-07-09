import React, { useEffect } from 'react';
import { Box } from '@mui/material';

// @ts-ignore
import LayoutShell from './editor/LayoutShell';

// Store imports for cleanup
import { useToolsStore } from './store/toolsStore/useToolsStore';
import { useMaterialPickerStore } from './store/materialPickerStore';
import { useUiSelectionStore } from './store/uiSelectionStore';
import { useUiRightSidebarStore } from './store/uiRightSidebarStore';
import { useWorkspaceStructureStore } from './store/useWorkspaceStructureStore';
import { useDslWorkspaceContextStore, dslWorkspaceContextKey } from './store/useDslWorkspaceContextStore';
import { useAppStore } from '../../../store/useAppStore';

export interface DslWorkspaceProps {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  appScope?: string;
}

export default function DslWorkspace({ projectId, workspaceId, workspaceName, appScope }: DslWorkspaceProps) {
  const panelSelection = useAppStore(s => s.panelSelections['layout']);
  // 作業中コンテキスト（ワークスペース単位）。存在すれば panelSelection より優先して復元する。
  const workCtx = useDslWorkspaceContextStore(s => s.byWorkspace[dslWorkspaceContextKey(projectId, workspaceId)]);

  const initialBaseId = workCtx ? (workCtx.baseId ?? null) : (panelSelection?.baseId ?? null);
  const initialPlanId = workCtx ? (workCtx.planId ?? null) : (panelSelection?.planId ?? null);
  const initialOptionId = workCtx ? (workCtx.optionId ?? null) : (panelSelection?.optionId ?? null);

  useEffect(() => {
    // Component Did Mount / Update workspaceId
    
    return () => {
      // Component Will Unmount / Before workspaceId changes
      // Strict state isolation
      resetLayoutStores();
    };
  }, [workspaceId, projectId]);
  
  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <LayoutShell
        projectId={projectId}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        initialBaseId={initialBaseId}
        initialPlanId={initialPlanId}
        initialOptionId={initialOptionId}
      />
    </Box>
  );
}

function resetLayoutStores() {
  console.log('[DslWorkspace] resetting layout stores for clean state...');
  
  try {
    const toolsStore = useToolsStore.getState();
    if (toolsStore.reset) toolsStore.reset();
    
    const selectionStore = useUiSelectionStore.getState();
    if (selectionStore.clearSelection) selectionStore.clearSelection();

    const rightSidebarStore = useUiRightSidebarStore.getState();
    // @ts-ignore
    if (rightSidebarStore.resetRightPanels) rightSidebarStore.resetRightPanels();

    const matStore = useMaterialPickerStore.getState();
    // @ts-ignore
    if (matStore.reset) matStore.reset();
    
    // @ts-ignore
    const reqStore = useWorkspaceStructureStore.getState();
    if (reqStore.hydrate) {
      reqStore.hydrate({
        bases: [],
        plansOfSelectedBase: [],
        options: [],
        optionsLoading: false,
        selectedBaseId: null,
        selectedPlanId: null,
        selectedOptionId: null,
        creatingBase: false,
        creatingPlan: false,
        creatingOption: false,
        deletingBase: false,
        deletingPlan: false,
        deletingOption: false,
        duplicatingPlan: false,
        duplicatingOption: false,
      });
    }
  } catch (err) {
    console.error('[DslWorkspace] Error resetting stores:', err);
  }
}
