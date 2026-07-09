import { create } from "zustand";
import { Object3D } from "three";

export interface SceneObjectRegistryState {
  map: Map<string, Object3D>;
  baseColliders: Object3D[];
  register: (id: string | null | undefined, obj: Object3D | null) => void;
  getObject: (id: string) => Object3D | null;
  getAllObjects: () => Object3D[];
  setBaseColliders: (colliders: Object3D[]) => void;
  clear: () => void;
}

export const useSceneObjectRegistryStore = create<SceneObjectRegistryState>((set, get) => ({
  map: new Map(),
  baseColliders: [],

  register: (id, obj) => {
    if (!id) return;
    set((s) => {
      const next = new Map(s.map);
      if (obj) next.set(id, obj);
      else next.delete(id);
      return { map: next };
    });
  },

  getObject: (id) => get().map.get(id) || null,

  getAllObjects: () => Array.from(get().map.values()).filter(Boolean) as Object3D[],

  setBaseColliders: (colliders: Object3D[]) => set({ baseColliders: colliders }),

  clear: () => set({ map: new Map(), baseColliders: [] }),
}));
