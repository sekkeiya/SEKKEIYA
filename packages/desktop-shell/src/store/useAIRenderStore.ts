import { create } from 'zustand';

interface AIRenderState {
  taskId: string | null;
  status: string;
  resultUrl: string | null;
  imageUrl: string | null; // 入力画像URLまたはプロンプトベースの場合の初期画像
  prompt: string;
  selectedModel: string;
  busy: boolean;
  contextProjectId: string | null;
  contextWorkspaceId: string | null;
  startedAtMs: number | null;          // local timestamp when generation kicked off
  estimatedDurationMs: number | null;  // server-provided expected wall time
  progress: number;                    // 0–100 estimated progress

  setTaskId: (id: string | null) => void;
  setStatus: (status: string) => void;
  setResultUrl: (url: string | null) => void;
  setImageUrl: (url: string | null) => void;
  setPrompt: (text: string) => void;
  setSelectedModel: (model: string) => void;
  setBusy: (busy: boolean) => void;
  setContext: (projectId: string | null, workspaceId: string | null) => void;
  setStartedAt: (ms: number | null) => void;
  setEstimatedDurationMs: (ms: number | null) => void;
  setProgress: (p: number) => void;
  reset: () => void;
}

export const useAIRenderStore = create<AIRenderState>((set) => ({
  taskId: null,
  status: '-',
  resultUrl: null,
  imageUrl: null,
  prompt: '',
  selectedModel: 'nanobanana',
  busy: false,
  contextProjectId: null,
  contextWorkspaceId: null,
  startedAtMs: null,
  estimatedDurationMs: null,
  progress: 0,

  setTaskId: (id) => set({ taskId: id }),
  setStatus: (status) => set({ status }),
  setResultUrl: (url) => set({ resultUrl: url }),
  setImageUrl: (url) => set({ imageUrl: url }),
  setPrompt: (text) => set({ prompt: text }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setBusy: (busy) => set({ busy }),
  setContext: (projectId, workspaceId) => set({ contextProjectId: projectId, contextWorkspaceId: workspaceId }),
  setStartedAt: (ms) => set({ startedAtMs: ms }),
  setEstimatedDurationMs: (ms) => set({ estimatedDurationMs: ms }),
  setProgress: (p) => set({ progress: Math.max(0, Math.min(100, p)) }),
  reset: () => set({
    taskId: null,
    status: '-',
    resultUrl: null,
    imageUrl: null,
    prompt: '',
    busy: false,
    contextProjectId: null,
    contextWorkspaceId: null,
    startedAtMs: null,
    estimatedDurationMs: null,
    progress: 0,
  })
}));
