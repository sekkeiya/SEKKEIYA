export interface LayoutAssetRef {
  sourceType: 'ref' | 'local' | 'asset';
  modelId?: string;
  ownerUid?: string;
  url?: string; // glbUrl or objectUrl
}

export interface TransformState {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export interface LayoutSceneObject {
  id: string; // Unique instance ID
  kind: 'model' | 'group' | 'light' | string;
  modelId?: string;   // Reference to global/local model library
  
  title: string;
  name?: string;
  label?: string;

  brand?: string;
  ownerHandle?: string;
  type?: string;
  subType?: string;
  group?: string;
  thumbUrl?: string | null;

  glbUrl: string; // Resolvable GLB/GLTF string (network url, or blob objectUrl)
  
  transform: TransformState;
  
  createdAtMs: number;
}

export interface LayoutDocument {
  id?: string;
  name?: string;
  memo?: string;
  order?: number;
  layout: {
    items: LayoutSceneObject[];
  };
  // Firebase specific timestamps will be omitted or handled in adapters
}

export interface LayoutWorkspaceProps {
  projectId: string;
  workspaceId: string;
  workspaceName?: string;
  appScope?: string;
}
