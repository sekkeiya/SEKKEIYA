import { create } from 'zustand';

// 「AI実行（おまかせ）」で実行する工程のオン/オフ。すべて個別に切り替え可能。
export type AiStepKey =
  | 'label' | 'layout' | 'replace' | 'material' | 'furMat'
  | 'lighting' | 'angles' | 'render' | 'movie';

interface AiPipelineState {
  steps: Record<AiStepKey, boolean>;
  setStep: (key: AiStepKey, v: boolean) => void;
  renderQuality: 'standard' | 'cycles'; // パース生成の品質
  setRenderQuality: (q: 'standard' | 'cycles') => void;
}

export const useAiPipelineStore = create<AiPipelineState>((set) => ({
  steps: {
    label: true,
    layout: true,
    replace: true,
    material: true,
    furMat: true,
    lighting: true,
    angles: true,
    render: true,
    movie: false, // 重い工程は既定オフ
  },
  setStep: (key, v) => set((s) => ({ steps: { ...s.steps, [key]: v } })),
  renderQuality: 'standard',
  setRenderQuality: (q) => set({ renderQuality: q }),
}));
