export type AppScope = 'sekkeiya' | '3dss' | '3dsl' | '3dsc' | '3dsp' | '3dsd' | '3dsr' | '3dsf' | '3dsi' | '3dsq' | '3dsb' | 'ai' | 'rhino';

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
