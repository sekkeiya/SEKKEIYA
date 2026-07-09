import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WorkFileLocalBinding } from '../features/projects/types';

interface WorkFileState {
  bindings: Record<string, WorkFileLocalBinding>; // Key: workFileId
  saveBinding: (workFileId: string, bindingData: Omit<WorkFileLocalBinding, 'workFileId'>) => void;
  getBinding: (workFileId: string) => WorkFileLocalBinding | undefined;
  removeBinding: (workFileId: string) => void;
  lastUpdated: number;
  notifyUpdate: () => void;
}

export const useWorkFileStore = create<WorkFileState>()(
  persist(
    (set, get) => ({
      bindings: {},
      saveBinding: (workFileId, bindingData) => set((state) => ({
        bindings: {
          ...state.bindings,
          [workFileId]: {
            ...bindingData,
            workFileId,
          }
        }
      })),
      getBinding: (workFileId) => get().bindings[workFileId],
      removeBinding: (workFileId) => set((state) => {
        const newBindings = { ...state.bindings };
        delete newBindings[workFileId];
        return { bindings: newBindings };
      }),
      lastUpdated: Date.now(),
      notifyUpdate: () => set({ lastUpdated: Date.now() })
    }),
    {
      name: 'sekkeiya-work-files-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
