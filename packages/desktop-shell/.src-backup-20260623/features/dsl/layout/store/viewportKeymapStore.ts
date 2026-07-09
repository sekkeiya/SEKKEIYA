// src/features/dsl/layout/store/viewportKeymapStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_KEYMAP } from "../config/viewportKeymapConfig";
import type { ViewportKeymap, KeymapBinding } from "../config/viewportKeymapConfig";

type ViewportKeymapState = {
  keymap: ViewportKeymap;
  setKey: (
    group: keyof ViewportKeymap,
    action: string,
    binding: KeymapBinding
  ) => void;
  resetToDefault: () => void;
};

export const useViewportKeymapStore = create<ViewportKeymapState>()(
  persist(
    (set) => ({
      keymap: structuredClone(DEFAULT_KEYMAP),

      setKey: (group, action, binding) => {
        set((state) => {
          const nextKeymap = { ...state.keymap };
          if (!nextKeymap[group]) return state;

          // @ts-ignore dynamic assignment
          nextKeymap[group] = {
            ...nextKeymap[group],
            [action]: binding,
          };
          return { keymap: nextKeymap };
        });
      },

      resetToDefault: () => {
        set({ keymap: structuredClone(DEFAULT_KEYMAP) });
      },
    }),
    {
      name: "sekkeiya-keymap-storage-v2",
    }
  )
);
