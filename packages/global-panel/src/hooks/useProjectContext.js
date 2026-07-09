import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useProjectContext = create(
  persist(
    (set) => ({
      activeProjectId: null,
      setActiveProjectId: (id) => set({ activeProjectId: id }),
      activeBoardId: null,
      setActiveBoardId: (id) => set({ activeBoardId: id }),
    }),
    {
      name: 'sekkeiya-project-context', // key in localStorage
    }
  )
);
