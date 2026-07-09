import { create } from 'zustand';

export interface MaterialGenProgress {
  current: number;
  total: number;
  label: string;
}

interface MaterialGenStoreState {
  isGenerating: boolean;
  progress: MaterialGenProgress | null;
  setGenerating: (v: boolean) => void;
  setProgress: (p: MaterialGenProgress | null) => void;
}

export const useMaterialGenStore = create<MaterialGenStoreState>((set) => ({
  isGenerating: false,
  progress: null,
  setGenerating: (v) => set({ isGenerating: v }),
  setProgress: (p) => set({ progress: p }),
}));
