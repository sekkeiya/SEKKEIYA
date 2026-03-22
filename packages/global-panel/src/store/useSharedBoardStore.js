import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSharedBoardStore = create(
  persist(
    (set) => ({
      currentBoardId: null,
      setCurrentBoardId: (id) => set({ currentBoardId: id }),
    }),
    {
      name: 'sekkeiya-board-storage', // key in localStorage
    }
  )
);
