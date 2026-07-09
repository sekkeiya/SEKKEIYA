import { create } from 'zustand';

interface AI3DCreateState {
  taskId: string | null;
  status: string;
  glbUrl: string | null;
  imageUrl: string | null; // 入力画像URL
  selectedModel: string;
  busy: boolean;
  contextProjectId: string | null;
  contextWorkspaceId: string | null;
  
  setTaskId: (id: string | null) => void;
  setStatus: (status: string) => void;
  setGlbUrl: (url: string | null) => void;
  setImageUrl: (url: string | null) => void;
  setSelectedModel: (model: string) => void;
  setBusy: (busy: boolean) => void;
  setContext: (projectId: string | null, workspaceId: string | null) => void;
  reset: () => void;
}

export const useAI3DCreateStore = create<AI3DCreateState>((set) => ({
  taskId: null,
  status: '-',
  glbUrl: null,
  imageUrl: null,
  selectedModel: 'tripo3d',
  busy: false,
  contextProjectId: null,
  contextWorkspaceId: null,

  setTaskId: (id) => set({ taskId: id }),
  setStatus: (status) => set({ status }),
  setGlbUrl: (url) => set({ glbUrl: url }),
  setImageUrl: (url) => set({ imageUrl: url }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setBusy: (busy) => set({ busy }),
  setContext: (projectId, workspaceId) => set({ contextProjectId: projectId, contextWorkspaceId: workspaceId }),
  reset: () => set({
    taskId: null,
    status: '-',
    glbUrl: null,
    imageUrl: null,
    busy: false,
    contextProjectId: null,
    contextWorkspaceId: null
  })
}));
