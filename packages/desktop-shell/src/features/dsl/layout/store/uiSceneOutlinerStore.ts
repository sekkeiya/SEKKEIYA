import { create } from "zustand";

function toArray(v: any): string[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  if (v instanceof Set) return Array.from(v) as string[];
  return [];
}

export interface UiSceneOutlinerState {
  expanded: string[];
  setExpanded: (next: string[] | Set<string> | any) => void;
  resetExpanded: () => void;
  toggleExpanded: (id: string | null | undefined) => void;
  expandAll: (ids: string[] | Set<string> | any) => void;
  collapseAll: () => void;
}

export const useUiSceneOutlinerStore = create<UiSceneOutlinerState>((set) => ({
  expanded: [],

  setExpanded: (next) => set({ expanded: toArray(next) }),

  resetExpanded: () => set({ expanded: [] }),

  toggleExpanded: (id) =>
    set((s) => {
      if (!id) return s;
      const cur = Array.isArray(s.expanded) ? s.expanded : [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { expanded: next };
    }),

  expandAll: (ids) => set({ expanded: toArray(ids) }),

  collapseAll: () => set({ expanded: [] }),
}));
