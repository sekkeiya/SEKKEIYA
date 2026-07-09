import { create } from 'zustand';

export interface ShotCamera {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface Shot {
  id: string;
  name: string;
  thumbnail: string | null;
  camera: ShotCamera;
  createdAt: number;
}

interface ShotStore {
  shots: Shot[];
  activeShotId: string | null;
  addShot: (camera: ShotCamera, thumbnail: string | null) => string;
  removeShot: (id: string) => void;
  renameShot: (id: string, name: string) => void;
  updateThumbnail: (id: string, thumbnail: string) => void;
  updateShot: (id: string, patch: Partial<Pick<Shot, 'thumbnail' | 'camera'>>) => void;
  setActiveShotId: (id: string | null) => void;
}

export const useShotStore = create<ShotStore>((set, get) => ({
  shots: [],
  activeShotId: null,

  addShot: (camera, thumbnail) => {
    const id = crypto.randomUUID();
    const index = get().shots.length + 1;
    set((s) => ({
      shots: [...s.shots, { id, name: `Shot ${index}`, thumbnail, camera, createdAt: Date.now() }],
      activeShotId: id,
    }));
    return id;
  },

  removeShot: (id) =>
    set((s) => ({
      shots: s.shots.filter((sh) => sh.id !== id),
      activeShotId: s.activeShotId === id ? (s.shots[0]?.id ?? null) : s.activeShotId,
    })),

  renameShot: (id, name) =>
    set((s) => ({
      shots: s.shots.map((sh) => (sh.id === id ? { ...sh, name } : sh)),
    })),

  updateThumbnail: (id, thumbnail) =>
    set((s) => ({
      shots: s.shots.map((sh) => (sh.id === id ? { ...sh, thumbnail } : sh)),
    })),

  updateShot: (id, patch) =>
    set((s) => ({
      shots: s.shots.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
    })),

  setActiveShotId: (id) => set({ activeShotId: id }),
}));
