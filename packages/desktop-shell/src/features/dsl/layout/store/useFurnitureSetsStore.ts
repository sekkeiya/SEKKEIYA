import { create } from 'zustand';
import type { FurnitureSet } from '../types/furnitureSet';

interface FurnitureSetsState {
  sets: FurnitureSet[];
  loaded: boolean;
  loading: boolean;

  load: (uid: string) => Promise<void>;
  save: (uid: string, set: FurnitureSet) => Promise<void>;
  remove: (uid: string, id: string) => Promise<void>;
}

export const useFurnitureSetsStore = create<FurnitureSetsState>((setState, getState) => ({
  sets: [],
  loaded: false,
  loading: false,

  load: async (uid) => {
    if (getState().loading || getState().loaded) return;
    setState({ loading: true });
    try {
      const { furnitureSetsApi } = await import('../services/furnitureSetsApi');
      const sets = await furnitureSetsApi.list(uid);
      setState({ sets, loaded: true });
    } catch (e) {
      console.warn('[useFurnitureSetsStore] load failed:', e);
    } finally {
      setState({ loading: false });
    }
  },

  save: async (uid, set) => {
    const { furnitureSetsApi } = await import('../services/furnitureSetsApi');
    await furnitureSetsApi.save(uid, set);
    setState(s => {
      const exists = s.sets.findIndex(x => x.id === set.id);
      const next = exists >= 0
        ? s.sets.map(x => x.id === set.id ? set : x)
        : [set, ...s.sets];
      return { sets: next };
    });
    // S.Model の modelSets へも同期（非ブロッキング）
    import('../services/furnitureSetSync').then(({ syncFurnitureSetToModelSet }) =>
      syncFurnitureSetToModelSet(uid, set),
    );
  },

  remove: async (uid, id) => {
    const { furnitureSetsApi } = await import('../services/furnitureSetsApi');
    await furnitureSetsApi.delete(uid, id);
    setState(s => ({ sets: s.sets.filter(x => x.id !== id) }));
    // S.Model の同期済みエントリも削除（非ブロッキング）
    import('../services/furnitureSetSync').then(({ deleteSyncedModelSet }) =>
      deleteSyncedModelSet(id),
    );
  },
}));
