export type AppScope = 'sekkeiya' | '3dss' | '3dsl' | '3dsc' | '3dsp' | '3dsd' | '3dsr' | '3dsf' | '3dsi' | '3dsq' | '3dsb' | '3dsk' | '3dsm' | '3dsmt' | 'ai' | 'rhino';

// 本体同梱の子アプリ scope 一覧（WorkspaceTabBar.tsx の ALL_CHILD_TABS の scope 値と一致させること）。
// WorkspaceTabBar.tsx は画像・MUI・dnd-kit を import する重い .tsx なので、
// useAppStore.ts (起動時に早期ロードされるコアストア) から直接 import すると循環参照になる。
// そのため scope 一覧だけをこの軽量な .ts に切り出し、togglePinnedTab のガードに使う。
export const CHILD_APP_SCOPES: readonly string[] = [
  '3dss', '3dsl', '3dsp', '3dsc', '3dsd', '3dsr',
  '3dsi', '3dsq', '3dsf', '3dsk', '3dsb', '3dsm', '3dsmt',
];

export type PanelType = 
  | 'ProjectOverview' 
  | 'ModelsPanel'
  | 'ModelDetailPanel'
  | 'WorkFilesPanel'
  | 'RhinoTemplatePanel'
  | 'AIChatPanel'
  | 'AIDrivePanel'
  | 'LayoutPanel'
  | 'PresentsPanel'
  | 'CreatePanel'
  | 'DrawingPanel';

export interface PanelModel {
  id: string;              
  type: PanelType;         
  title: string;           
  appScope: AppScope;      
  icon?: string;           
  isClosable: boolean;     
  isDirty?: boolean;       
  
  layout?: 'standard' | 'wide' | 'fullscreen' | 'split';
  dedupeKey?: string;      
  isSingleton?: boolean;   
  
  payload?: {
    projectId?: string;
    workspaceId?: string;
    targetEntityId?: string; 
    [key: string]: any;
  };
}

export type OpenPanelInput = Omit<PanelModel, 'id' | 'title'> & {
  title?: string; 
};

export interface WorkspaceState {
  activePanels: PanelModel[];
  currentPanelId: string | null;
}

export interface WorkspaceActions {
  openPanel: (input: OpenPanelInput) => void;
  closePanel: (panelId: string) => void;
  focusPanel: (panelId: string) => void;
}

export type WorkspaceContextType = WorkspaceState & WorkspaceActions;
