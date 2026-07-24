import { useEffect, useRef } from 'react';
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
import { useEditorModeStore } from './store/useEditorModeStore';
import { useAppStore } from '../../../store/useAppStore';

export interface DslWorkspaceProps {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  appScope?: string;
}

export default function DslWorkspace({ projectId, workspaceId, workspaceName }: DslWorkspaceProps) {
  // 作業中コンテキスト（ワークスペース単位）／panelSelection から初期選択を「マウント時に一度だけ」確定する。
  // ⚠️ これらをリアクティブに購読すると、LayoutShell 側の setContext(selected→workCtx) と
  //    useWorkspaceStructure の initial→selected 同期が双方向ループになり Maximum update depth に陥る。
  //    そのため getState() で一度だけ読み、workspace が変わったときのみ取り直す。
  const ctxKey = dslWorkspaceContextKey(projectId, workspaceId);
  const initialRef = useRef<{ key: string; baseId: string | null; planId: string | null; optionId: string | null } | null>(null);
  if (!initialRef.current || initialRef.current.key !== ctxKey) {
    const wc = useDslWorkspaceContextStore.getState().byWorkspace[ctxKey];
    const ps = useAppStore.getState().panelSelections['layout'];
    initialRef.current = {
      key: ctxKey,
      baseId: wc ? (wc.baseId ?? null) : (ps?.baseId ?? null),
      planId: wc ? (wc.planId ?? null) : (ps?.planId ?? null),
      optionId: wc ? (wc.optionId ?? null) : (ps?.optionId ?? null),
    };
  }
  const initialBaseId = initialRef.current.baseId;
  const initialPlanId = initialRef.current.planId;
  const initialOptionId = initialRef.current.optionId;

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
    // 断面クリッピング高さを 1500mm (= Three.js m スケールで 1.5) にリセット。
    // BaseGlb が mm スケール GLB をロードすると自動的に mm 単位に合わせて上書きする。
    useEditorModeStore.getState().setSectionClipHeight(1.5);

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
