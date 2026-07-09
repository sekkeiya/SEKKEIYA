import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type RenderQuality = 'standard' | 'cycles';

export interface RenderEntry {
  id: string;
  shotId: string;
  shotName: string;
  thumbnail: string; // small JPEG data URL for list display
  quality: RenderQuality;
  renderedAt: number;
}

interface RenderHistoryStore {
  entries: RenderEntry[];
  addEntry: (entry: Omit<RenderEntry, 'id' | 'renderedAt'>) => void;
  removeEntry: (id: string) => void;
  clearAll: () => void;
}

/** Cap entries kept in memory & localStorage. */
const MAX_ENTRIES = 50;

/**
 * Wrap localStorage so QuotaExceededError doesn't kill rendering.
 * On quota overflow, drop oldest entries from the persisted payload and retry.
 */
const safeStorage = {
  getItem: (name: string) => localStorage.getItem(name),
  removeItem: (name: string) => localStorage.removeItem(name),
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
      return;
    } catch (e) {
      // Try shrinking the entries array progressively
      try {
        const parsed = JSON.parse(value);
        const entries: RenderEntry[] = parsed?.state?.entries ?? [];
        let next = entries.slice();
        while (next.length > 0) {
          // Drop the oldest (last in array — addEntry prepends new entries)
          next = next.slice(0, Math.max(1, next.length - Math.ceil(next.length / 4)));
          const trimmed = { ...parsed, state: { ...parsed.state, entries: next } };
          try {
            localStorage.setItem(name, JSON.stringify(trimmed));
            console.warn(
              `[RenderHistory] localStorage quota hit — kept ${next.length} most recent entries`,
            );
            return;
          } catch {
            // keep shrinking
          }
        }
        // Final fallback: clear
        localStorage.removeItem(name);
        console.warn('[RenderHistory] localStorage quota hit — cleared history');
      } catch (err) {
        console.error('[RenderHistory] persistence failed:', err);
      }
    }
  },
};

export const useRenderHistoryStore = create<RenderHistoryStore>()(
  persist(
    (set) => ({
      entries: [],

      addEntry: (entry) =>
        set((s) => {
          const next = [
            { ...entry, id: crypto.randomUUID(), renderedAt: Date.now() },
            ...s.entries,
          ].slice(0, MAX_ENTRIES);
          return { entries: next };
        }),

      removeEntry: (id) =>
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'sekkeiya-render-history',
      storage: createJSONStorage(() => safeStorage),
    },
  ),
);
